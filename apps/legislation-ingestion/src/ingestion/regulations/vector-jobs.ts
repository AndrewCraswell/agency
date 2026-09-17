import { randomUUID } from "node:crypto"
import type { OpenRouterEmbeddingClient } from "@repo/legislation-core/embeddings/openrouter-embeddings"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { runLegalEmbeddingShard } from "./vector-worker.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const shardRequestSchema = z.strictObject({
  generationId: hash,
  shardIndex: z.int().min(0).max(15)
})
const claimSchema = z.object({
  generationId: hash,
  shardIndex: z.int().min(0).max(15),
  fence: z.int().positive(),
  leaseToken: z.uuid()
})

async function transaction<T>(pool: pg.Pool, action: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    invariant(
      (await client.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_embedding_wrong_target"
    )
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='60s'")
    const result = await action(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/** Creates the fixed 16-shard durable inventory for one pending vector generation. */
export async function initializeLegalEmbeddingShards(pool: pg.Pool, generationIdInput: unknown) {
  const generationId = hash.parse(generationIdInput)
  return transaction(pool, async (client) => {
    const generation = await client.query(
      "SELECT 1 FROM legislation.legal_embedding_generations WHERE id=$1 AND state='pending' FOR SHARE",
      [generationId]
    )
    invariant(generation.rowCount === 1, "legal_embedding_generation_not_pending")
    await client.query(
      `INSERT INTO legislation.legal_embedding_shards(generation_id,shard_count,shard_index)
      SELECT $1,16,index FROM generate_series(0,15) AS index ON CONFLICT DO NOTHING`,
      [generationId]
    )
    const count = (
      await client.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM legislation.legal_embedding_shards WHERE generation_id=$1 AND shard_count=16",
        [generationId]
      )
    ).rows[0]?.count
    invariant(count === 16, "legal_embedding_shard_inventory_mismatch")
    return { generationId, shardCount: 16 as const }
  })
}

export async function claimLegalEmbeddingShard(pool: pg.Pool, input: unknown) {
  const request = shardRequestSchema.parse(input)
  const leaseToken = randomUUID()
  return transaction(pool, async (client) => {
    const claimed = (
      await client.query<{
        attempts: number
        cursor_passage_id: string | null
        fence: number
        possible_repeated_paid_attempts: number
      }>(
        `UPDATE legislation.legal_embedding_shards SET
          fence=fence+1,lease_token=$3,lease_expires_at=clock_timestamp()+interval '5 minutes',
          attempts=attempts+1,
          possible_repeated_paid_attempts=possible_repeated_paid_attempts+(last_attempt_state='requesting')::integer,
          last_attempt_state='requesting',last_error=NULL,updated_at=clock_timestamp()
        WHERE generation_id=$1 AND shard_count=16 AND shard_index=$2 AND state='pending'
        AND (lease_token IS NULL OR lease_expires_at<=clock_timestamp())
        RETURNING cursor_passage_id,fence,attempts,possible_repeated_paid_attempts`,
        [request.generationId, request.shardIndex, leaseToken]
      )
    ).rows[0]
    if (!claimed) {
      const state = (
        await client.query<{ state: string }>(
          "SELECT state FROM legislation.legal_embedding_shards WHERE generation_id=$1 AND shard_count=16 AND shard_index=$2",
          [request.generationId, request.shardIndex]
        )
      ).rows[0]?.state
      invariant(state, "legal_embedding_shard_missing")
      return state === "complete" ? null : undefined
    }
    return {
      ...request,
      fence: claimed.fence,
      leaseToken,
      afterPassageId: claimed.cursor_passage_id,
      attempts: claimed.attempts,
      possibleRepeatedPaidAttempts: claimed.possible_repeated_paid_attempts
    }
  })
}

async function finishLegalEmbeddingShard(
  pool: pg.Pool,
  claimInput: unknown,
  result: {
    nextAfterPassageId: string | null
    exhausted: boolean
    inserted: number
    reused: number
    promptTokens?: number
    totalTokens?: number
  }
) {
  const claim = claimSchema.parse(claimInput)
  const promptTokens = z
    .int()
    .nonnegative()
    .parse(result.promptTokens ?? 0)
  const totalTokens = z
    .int()
    .nonnegative()
    .parse(result.totalTokens ?? 0)
  invariant(totalTokens >= promptTokens, "legal_embedding_usage_invalid")
  return transaction(pool, async (client) => {
    const updated = await client.query(
      `UPDATE legislation.legal_embedding_shards SET cursor_passage_id=$5,
        state=CASE WHEN $6 THEN 'complete' ELSE 'pending' END,
        lease_token=NULL,lease_expires_at=NULL,last_attempt_state='idle',
        provider_prompt_tokens=provider_prompt_tokens+$7,
        provider_total_tokens=provider_total_tokens+$8,
        inserted_vectors=inserted_vectors+$9,reused_vectors=reused_vectors+$10,
        last_error=NULL,updated_at=clock_timestamp()
      WHERE generation_id=$1 AND shard_count=16 AND shard_index=$2 AND fence=$3 AND lease_token=$4`,
      [
        claim.generationId,
        claim.shardIndex,
        claim.fence,
        claim.leaseToken,
        result.nextAfterPassageId,
        result.exhausted,
        promptTokens,
        totalTokens,
        result.inserted,
        result.reused
      ]
    )
    invariant(updated.rowCount === 1, "legal_embedding_shard_lease_lost")
  })
}

async function failLegalEmbeddingShard(pool: pg.Pool, claimInput: unknown, failureCode: string) {
  const claim = claimSchema.parse(claimInput)
  const code = z
    .string()
    .regex(/^[a-z_]+$/)
    .max(100)
    .parse(failureCode)
  return transaction(pool, async (client) => {
    const updated = await client.query(
      `UPDATE legislation.legal_embedding_shards SET lease_token=NULL,lease_expires_at=NULL,
      last_error=$5,updated_at=clock_timestamp()
      WHERE generation_id=$1 AND shard_count=16 AND shard_index=$2 AND fence=$3 AND lease_token=$4`,
      [claim.generationId, claim.shardIndex, claim.fence, claim.leaseToken, code]
    )
    invariant(updated.rowCount === 1, "legal_embedding_shard_lease_lost")
  })
}

/** Claims, runs and checkpoints one durable shard page. A failed attempt remains visible for conservative cost accounting. */
export async function runLegalEmbeddingShardJob(
  pool: pg.Pool,
  input: unknown,
  client: Pick<OpenRouterEmbeddingClient, "embed">
) {
  const request = shardRequestSchema.parse(input)
  const claim = await claimLegalEmbeddingShard(pool, request)
  if (claim === null) {
    return { ...request, state: "complete" as const, reusedCheckpoint: true }
  }
  invariant(claim, "legal_embedding_shard_busy")
  try {
    const result = await runLegalEmbeddingShard(
      pool,
      {
        generationId: request.generationId,
        shardCount: 16,
        shardIndex: request.shardIndex,
        afterPassageId: claim.afterPassageId
      },
      client
    )
    await finishLegalEmbeddingShard(pool, claim, result)
    return {
      ...result,
      attempts: claim.attempts,
      possibleRepeatedPaidAttempts: claim.possibleRepeatedPaidAttempts,
      state: result.exhausted ? ("complete" as const) : ("pending" as const),
      reusedCheckpoint: false
    }
  } catch (error) {
    await failLegalEmbeddingShard(pool, claim, "legal_embedding_worker_failed")
    throw error
  }
}
