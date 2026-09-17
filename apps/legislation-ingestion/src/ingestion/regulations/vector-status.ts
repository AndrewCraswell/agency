import { regulatoryEmbeddingRouteForModel } from "@repo/legislation-core/embeddings/embedding-routing"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const modelSchema = z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"])

/** Read-only operator evidence. It does not initialize, dispatch, complete or promote a vector generation. */
export async function inspectLegalEmbeddingGeneration(pool: pg.Pool, generationIdInput: unknown) {
  const generationId = hash.parse(generationIdInput)
  const client = await pool.connect()
  try {
    invariant(
      (await client.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_embedding_wrong_target"
    )
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await client.query("SET LOCAL statement_timeout='30s'")
    const generation = (
      await client.query<{
        completed_at: Date | null
        created_at: Date
        dimensions: number
        expected_count: number
        input_contract: string
        manifest_hash: string
        model: string
        passage_generation_id: string
        ready_at: Date | null
        state: string
      }>(
        `SELECT passage_generation_id,model,dimensions,input_contract,manifest_hash,expected_count,state,
        created_at,completed_at,ready_at FROM legislation.legal_embedding_generations WHERE id=$1`,
        [generationId]
      )
    ).rows[0]
    invariant(generation, "legal_embedding_generation_missing")
    const model = modelSchema.parse(generation.model)
    const route = regulatoryEmbeddingRouteForModel(model)
    invariant(route.dimensions === generation.dimensions, "legal_embedding_generation_route_mismatch")
    const table = `legislation.${route.storageTable}`
    const inventory = (
      await client.query<{
        active_memberships: number
        copied_passages: number
        expected_input_bytes: number
        expected_tokens: number
        missing_token_counts: number
        vectors: number
      }>(
        `SELECT
          (SELECT count(*)::integer FROM legislation.legal_search_passages
            WHERE generation_id=$2) AS copied_passages,
          (SELECT coalesce(sum((data->>'tokenCount')::bigint),0)::bigint FROM legislation.legal_search_passages
            WHERE generation_id=$2) AS expected_tokens,
          (SELECT coalesce(sum(octet_length(input_text)),0)::bigint FROM legislation.legal_search_passages
            WHERE generation_id=$2) AS expected_input_bytes,
          (SELECT count(*)::integer FROM legislation.legal_search_passages
            WHERE generation_id=$2 AND data->>'tokenCount' IS NULL) AS missing_token_counts,
          (SELECT count(*)::integer FROM ${table} WHERE generation_id=$1) AS vectors,
          (SELECT count(*)::integer FROM legislation.legal_search_memberships m
            WHERE m.generation_id=$2 AND NOT EXISTS (
              SELECT 1 FROM legislation.legal_search_revocations r
              WHERE r.scope_kind=m.scope_kind AND r.scope_id=m.scope_id
            )) AS active_memberships`,
        [generationId, generation.passage_generation_id]
      )
    ).rows[0]
    invariant(inventory, "legal_embedding_inventory_missing")
    const shards = (
      await client.query<{
        attempts: number
        blocked: number
        complete: number
        expired_leases: number
        inserted_vectors: number
        leased: number
        possible_repeated_paid_attempts: number
        provider_prompt_tokens: number
        provider_total_tokens: number
        reused_vectors: number
        total: number
      }>(
        `SELECT count(*)::integer AS total,
          count(*) FILTER (WHERE state='complete')::integer AS complete,
          count(*) FILTER (WHERE state='blocked')::integer AS blocked,
          count(*) FILTER (WHERE lease_token IS NOT NULL)::integer AS leased,
          count(*) FILTER (WHERE lease_token IS NOT NULL AND lease_expires_at<=clock_timestamp())::integer AS expired_leases,
          coalesce(sum(attempts),0)::integer AS attempts,
          coalesce(sum(possible_repeated_paid_attempts),0)::integer AS possible_repeated_paid_attempts,
          coalesce(sum(provider_prompt_tokens),0)::bigint AS provider_prompt_tokens,
          coalesce(sum(provider_total_tokens),0)::bigint AS provider_total_tokens,
          coalesce(sum(inserted_vectors),0)::integer AS inserted_vectors,
          coalesce(sum(reused_vectors),0)::integer AS reused_vectors
        FROM legislation.legal_embedding_shards WHERE generation_id=$1 AND shard_count=16`,
        [generationId]
      )
    ).rows[0]
    invariant(shards, "legal_embedding_shard_inventory_missing")
    await client.query("COMMIT")

    const blockers: string[] = []
    if (inventory.active_memberships === 0) blockers.push("search_membership_unavailable")
    if (inventory.copied_passages !== generation.expected_count) blockers.push("passage_inventory_mismatch")
    if (inventory.missing_token_counts > 0) blockers.push("passage_token_count_missing")
    if (![0, 16].includes(shards.total)) blockers.push("shard_inventory_mismatch")
    if (shards.blocked > 0) blockers.push("blocked_shards")
    if (inventory.vectors > generation.expected_count) blockers.push("vector_inventory_exceeds_expected")
    if (generation.state === "blocked") blockers.push("generation_blocked")
    const exactVectors = inventory.vectors === generation.expected_count
    const completeShards = shards.total === 16 && shards.complete === 16
    return {
      generationId,
      passageGenerationId: generation.passage_generation_id,
      model,
      dimensions: generation.dimensions,
      inputContract: generation.input_contract,
      manifestHash: generation.manifest_hash,
      state: generation.state,
      createdAt: generation.created_at.toISOString(),
      completedAt: generation.completed_at?.toISOString() ?? null,
      readyAt: generation.ready_at?.toISOString() ?? null,
      inventory: {
        expectedPassages: generation.expected_count,
        copiedPassages: inventory.copied_passages,
        expectedTokens: Number(inventory.expected_tokens),
        expectedInputBytes: Number(inventory.expected_input_bytes),
        vectors: inventory.vectors,
        rawVectorBytes: inventory.vectors * generation.dimensions * Float32Array.BYTES_PER_ELEMENT,
        coveragePercent: Number(((inventory.vectors / generation.expected_count) * 100).toFixed(4))
      },
      rights: { activeMemberships: inventory.active_memberships },
      execution: {
        shardCount: shards.total,
        completeShards: shards.complete,
        pendingShards: shards.total - shards.complete - shards.blocked,
        blockedShards: shards.blocked,
        leasedShards: shards.leased,
        expiredLeases: shards.expired_leases,
        attempts: shards.attempts,
        possibleRepeatedPaidAttempts: shards.possible_repeated_paid_attempts,
        providerPromptTokens: Number(shards.provider_prompt_tokens),
        providerTotalTokens: Number(shards.provider_total_tokens),
        insertedVectors: shards.inserted_vectors,
        reusedVectors: shards.reused_vectors
      },
      gates: {
        dispatchable: generation.state === "pending" && blockers.length === 0,
        completable: generation.state === "pending" && blockers.length === 0 && exactVectors && completeShards,
        embedded: ["embedded", "ready"].includes(generation.state) && exactVectors && completeShards,
        ready: generation.state === "ready" && exactVectors && completeShards,
        blockers
      }
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
