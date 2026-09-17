import { regulatoryEmbeddingRouteForModel } from "@repo/legislation-core/embeddings/embedding-routing"
import { validateEmbeddingTokenBudget } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const requestSchema = z.strictObject({
  generationId: hash,
  shardCount: z.literal(16),
  shardIndex: z.int().min(0).max(15),
  afterPassageId: hash.nullable().default(null),
  scanLimit: z.int().min(1).max(512).default(512),
  batchLimit: z.int().min(1).max(64).default(64),
  byteLimit: z
    .int()
    .min(16_000)
    .max(1024 * 1024)
    .default(1024 * 1024)
})

const modelSchema = z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"])

const tables = {
  "openai/text-embedding-3-small": "legislation.legal_openai_small_embeddings",
  "voyageai/voyage-4": "legislation.legal_voyage_4_embeddings"
} as const

const candidateSchema = z.object({
  passage_id: hash,
  input_text: z.string().min(1).max(16_000),
  input_hash: hash,
  token_count: z.int().positive()
})

/** Selects one deterministic, token-verified provider batch without changing search or vector state. */
export async function selectLegalEmbeddingShard(pool: pg.Pool, input: unknown) {
  const request = requestSchema.parse(input)
  const client = await pool.connect()
  try {
    invariant(
      (await client.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_embedding_wrong_target"
    )
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await client.query("SET LOCAL statement_timeout='60s'")
    const generation = (
      await client.query<{ passage_generation_id: string; model: string; state: string }>(
        `SELECT passage_generation_id,model,state FROM legislation.legal_embedding_generations
        WHERE id=$1`,
        [request.generationId]
      )
    ).rows[0]
    invariant(generation, "legal_embedding_generation_missing")
    const model = modelSchema.parse(generation.model)
    invariant(generation.state === "pending", "legal_embedding_generation_not_pending")
    const route = regulatoryEmbeddingRouteForModel(model)
    const candidates = z.array(candidateSchema).parse(
      (
        await client.query(
          `SELECT p.id AS passage_id,p.input_text,p.data->>'inputHash' AS input_hash,
          (p.data->>'tokenCount')::integer AS token_count
          FROM legislation.legal_search_passages p
          LEFT JOIN ${tables[model]} e ON e.generation_id=$1 AND e.passage_id=p.id
          WHERE p.generation_id=$2 AND p.id>$3
          AND get_byte(decode(substring(p.id,1,2),'hex'),0)%$4=$5 AND e.passage_id IS NULL
          ORDER BY p.id LIMIT $6`,
          [
            request.generationId,
            generation.passage_generation_id,
            request.afterPassageId ?? "",
            request.shardCount,
            request.shardIndex,
            request.scanLimit
          ]
        )
      ).rows
    )
    const selected: typeof candidates = []
    let bytes = 0
    for (const candidate of candidates) {
      const candidateBytes = Buffer.byteLength(candidate.input_text)
      if (selected.length >= request.batchLimit || bytes + candidateBytes > request.byteLimit) {
        break
      }
      invariant(digest(candidate.input_text) === candidate.input_hash, "legal_embedding_input_hash_mismatch")
      selected.push(candidate)
      bytes += candidateBytes
    }
    if (candidates.length > 0) {
      invariant(selected.length > 0, "legal_embedding_batch_byte_limit")
    }
    if (selected.length > 0) {
      const checked = await validateEmbeddingTokenBudget(
        model,
        selected.map((candidate) => candidate.input_text)
      )
      invariant(
        selected.every((candidate, index) => candidate.token_count === checked.counts[index]),
        "legal_embedding_token_count_mismatch"
      )
    }
    await client.query("COMMIT")
    return {
      generationId: request.generationId,
      model,
      dimensions: route.dimensions,
      inputContract: route.embeddingInputContract,
      shardCount: request.shardCount,
      shardIndex: request.shardIndex,
      shardKey: digest(
        JSON.stringify(["legal-embedding-shard", request.generationId, request.shardCount, request.shardIndex])
      ),
      afterPassageId: request.afterPassageId,
      nextAfterPassageId: selected.at(-1)?.passage_id ?? request.afterPassageId,
      scanned: candidates.length,
      bytes,
      exhausted: selected.length === candidates.length && candidates.length < request.scanLimit,
      items: selected.map((candidate) => ({
        passageId: candidate.passage_id,
        inputHash: candidate.input_hash,
        inputText: candidate.input_text,
        tokenCount: candidate.token_count
      }))
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
