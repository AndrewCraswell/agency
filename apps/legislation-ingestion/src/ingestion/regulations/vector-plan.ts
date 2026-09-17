import { createHash } from "node:crypto"
import {
  regulatoryEmbeddingRouteForModel,
  type RegulatoryEmbeddingModel
} from "@repo/legislation-core/embeddings/embedding-routing"
import { embeddingTokenizer } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const modelSchema = z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"])
export const legalEmbeddingPlanSchema = z.strictObject({
  contract: z.literal("legal-embedding-plan-2026-09-17"),
  passageGenerationId: hash,
  passageManifestHash: hash,
  sourceMetadataHash: hash,
  model: modelSchema,
  dimensions: z.union([z.literal(1024), z.literal(1536)]),
  inputContract: z.string().min(1).max(256),
  tokenizerId: z.string().min(1).max(256),
  expectedCount: z.int().positive(),
  expectedTokens: z.int().nonnegative(),
  expectedInputBytes: z.int().nonnegative(),
  inputInventoryHash: hash,
  shardCount: z.literal(16),
  planHash: hash
})
export type LegalEmbeddingPlan = z.infer<typeof legalEmbeddingPlanSchema>

export function validateLegalEmbeddingPlan(input: unknown): LegalEmbeddingPlan {
  const plan = legalEmbeddingPlanSchema.parse(input)
  const { planHash, ...identity } = plan
  invariant(planHash === digest(JSON.stringify(identity)), "legal_embedding_plan_hash_mismatch")
  const route = regulatoryEmbeddingRouteForModel(plan.model)
  invariant(
    plan.dimensions === route.dimensions && plan.inputContract === route.embeddingInputContract,
    "legal_embedding_plan_route_mismatch"
  )
  return plan
}

async function transaction<T>(pool: pg.Pool, action: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    invariant(
      (await client.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_embedding_wrong_target"
    )
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
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

/** Freezes one exact copied passage generation without registering or dispatching vector work. */
export async function planLegalEmbeddingGeneration(
  pool: pg.Pool,
  passageGenerationIdInput: unknown,
  modelInput: RegulatoryEmbeddingModel
): Promise<LegalEmbeddingPlan> {
  const passageGenerationId = hash.parse(passageGenerationIdInput)
  const model = modelSchema.parse(modelInput)
  const route = regulatoryEmbeddingRouteForModel(model)
  const tokenizer = await embeddingTokenizer(model)
  return transaction(pool, async (client) => {
    const generation = (
      await client.query<{ metadata: Record<string, unknown> }>(
        `SELECT g.metadata FROM legislation.legal_search_generations g
        WHERE g.id=$1 AND EXISTS (
          SELECT 1 FROM legislation.legal_search_memberships m WHERE m.generation_id=g.id AND NOT EXISTS (
            SELECT 1 FROM legislation.legal_search_revocations r
            WHERE r.scope_kind=m.scope_kind AND r.scope_id=m.scope_id
          )
        )`,
        [passageGenerationId]
      )
    ).rows[0]
    invariant(generation, "legal_embedding_search_membership_unavailable")
    const metadata = z
      .object({
        manifest_hash: hash,
        passage_count: z.int().positive(),
        tokenizer_id: z.string().min(1).max(256),
        eligibility: z.literal("eligible")
      })
      .passthrough()
      .parse(generation.metadata)
    invariant(metadata.tokenizer_id === tokenizer.id, "legal_embedding_tokenizer_mismatch")
    const inventory = createHash("sha256")
    inventory.update("[")
    let afterId = ""
    let count = 0
    let expectedTokens = 0
    let expectedInputBytes = 0
    while (true) {
      const page = await client.query<{
        id: string
        input_hash: string
        input_text: string
        token_count: number
      }>(
        `SELECT id,input_text,data->>'inputHash' AS input_hash,(data->>'tokenCount')::integer AS token_count
        FROM legislation.legal_search_passages WHERE generation_id=$1 AND id>$2 ORDER BY id LIMIT 1000`,
        [passageGenerationId, afterId]
      )
      if (page.rows.length === 0) break
      for (const row of page.rows) {
        const id = hash.parse(row.id)
        const inputHash = hash.parse(row.input_hash)
        const tokenCount = z.int().nonnegative().parse(row.token_count)
        invariant(digest(row.input_text) === inputHash, "legal_embedding_input_hash_mismatch")
        invariant((await tokenizer.count(row.input_text)) === tokenCount, "legal_embedding_token_count_mismatch")
        inventory.update(count === 0 ? "" : ",")
        inventory.update(JSON.stringify([id, inputHash, tokenCount]))
        count += 1
        expectedTokens += tokenCount
        expectedInputBytes += Buffer.byteLength(row.input_text)
        invariant(count <= 1_000_000 && expectedInputBytes <= 64 * 1024 * 1024, "legal_embedding_plan_limit")
        afterId = id
      }
    }
    inventory.update("]")
    invariant(count === metadata.passage_count, "legal_embedding_passage_inventory_mismatch")
    const identity = {
      contract: "legal-embedding-plan-2026-09-17" as const,
      passageGenerationId,
      passageManifestHash: metadata.manifest_hash,
      sourceMetadataHash: digest(JSON.stringify(generation.metadata)),
      model,
      dimensions: route.dimensions,
      inputContract: route.embeddingInputContract,
      tokenizerId: tokenizer.id,
      expectedCount: count,
      expectedTokens,
      expectedInputBytes,
      inputInventoryHash: inventory.digest("hex"),
      shardCount: 16 as const
    }
    return validateLegalEmbeddingPlan({ ...identity, planHash: digest(JSON.stringify(identity)) })
  })
}
