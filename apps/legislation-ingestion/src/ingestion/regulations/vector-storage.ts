import { isDeepStrictEqual } from "node:util"
import { regulatoryEmbeddingRouteForModel } from "@repo/legislation-core/embeddings/embedding-routing"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const routeSchema = z.discriminatedUnion("model", [
  z.strictObject({ model: z.literal("openai/text-embedding-3-small"), dimensions: z.literal(1536) }),
  z.strictObject({ model: z.literal("voyageai/voyage-4"), dimensions: z.literal(1024) })
])
const generationRequestSchema = z.strictObject({
  passageGenerationId: hash,
  model: z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"]),
  inputContract: z.string().min(1).max(256),
  manifestHash: hash,
  expectedCount: z.int().positive()
})
const vectorItemSchema = z.strictObject({
  passageId: hash,
  inputHash: hash,
  embedding: z.array(z.number()).min(1)
})
const batchRequestSchema = z.strictObject({
  generationId: hash,
  model: z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"]),
  items: z.array(vectorItemSchema).min(1).max(256)
})

const routes = {
  "openai/text-embedding-3-small": {
    dimensions: regulatoryEmbeddingRouteForModel("openai/text-embedding-3-small").dimensions,
    table: "legislation.legal_openai_small_embeddings"
  },
  "voyageai/voyage-4": {
    dimensions: regulatoryEmbeddingRouteForModel("voyageai/voyage-4").dimensions,
    table: "legislation.legal_voyage_4_embeddings"
  }
} as const

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

function route(model: keyof typeof routes) {
  return routeSchema.parse({ model, dimensions: routes[model].dimensions })
}

/** Registers one immutable model-specific vector generation over one exact passage generation. */
export async function registerLegalEmbeddingGeneration(pool: pg.Pool, input: unknown) {
  const request = generationRequestSchema.parse(input)
  const selected = route(request.model)
  const id = digest(
    JSON.stringify([
      "legal-embedding-generation",
      request.passageGenerationId,
      request.model,
      selected.dimensions,
      request.inputContract,
      request.manifestHash,
      request.expectedCount
    ])
  )
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [id])
    const source = (
      await client.query<{ passage_count: number; eligibility: string; actual_count: number }>(
        `SELECT (g.metadata->>'passage_count')::integer AS passage_count,
        g.metadata->>'eligibility' AS eligibility,count(p.id)::integer AS actual_count
        FROM legislation.legal_search_generations g
        LEFT JOIN legislation.legal_search_passages p ON p.generation_id=g.id
        WHERE g.id=$1 GROUP BY g.id`,
        [request.passageGenerationId]
      )
    ).rows[0]
    invariant(source, "legal_embedding_passage_generation_missing")
    invariant(source.eligibility === "eligible", "legal_embedding_passage_generation_ineligible")
    invariant(
      source.passage_count === request.expectedCount && source.actual_count === request.expectedCount,
      "legal_embedding_passage_inventory_mismatch"
    )
    const inserted = await client.query(
      `INSERT INTO legislation.legal_embedding_generations
      (id,passage_generation_id,model,dimensions,input_contract,manifest_hash,expected_count)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        id,
        request.passageGenerationId,
        request.model,
        selected.dimensions,
        request.inputContract,
        request.manifestHash,
        request.expectedCount
      ]
    )
    const stored = (
      await client.query(
        `SELECT passage_generation_id,model,dimensions,input_contract,manifest_hash,expected_count,state
        FROM legislation.legal_embedding_generations WHERE id=$1`,
        [id]
      )
    ).rows[0]
    invariant(
      stored?.passage_generation_id === request.passageGenerationId &&
        stored.model === request.model &&
        stored.dimensions === selected.dimensions &&
        stored.input_contract === request.inputContract &&
        stored.manifest_hash === request.manifestHash &&
        stored.expected_count === request.expectedCount,
      "legal_embedding_generation_replay_conflict"
    )
    return {
      generationId: id,
      model: request.model,
      dimensions: selected.dimensions,
      state: stored.state,
      reused: inserted.rowCount === 0
    }
  })
}

/** Stores exact passage/vector pairs. A changed retry fails instead of replacing an earlier provider result. */
export async function storeLegalEmbeddingBatch(pool: pg.Pool, input: unknown) {
  const request = batchRequestSchema.parse(input)
  invariant(
    new Set(request.items.map((item) => item.passageId)).size === request.items.length,
    "legal_embedding_duplicate_passage"
  )
  const selected = route(request.model)
  const rows = request.items.map((item) => {
    invariant(
      item.embedding.length === selected.dimensions && item.embedding.every(Number.isFinite),
      "legal_embedding_invalid_vector"
    )
    const norm = Math.hypot(...item.embedding)
    invariant(Number.isFinite(norm) && norm > 0, "legal_embedding_invalid_vector")
    return { ...item, vectorHash: digest(JSON.stringify(item.embedding)) }
  })
  return transaction(pool, async (client) => {
    const generation = (
      await client.query<{ passage_generation_id: string; model: string; dimensions: number; state: string }>(
        `SELECT passage_generation_id,model,dimensions,state FROM legislation.legal_embedding_generations
        WHERE id=$1 FOR SHARE`,
        [request.generationId]
      )
    ).rows[0]
    invariant(generation, "legal_embedding_generation_missing")
    invariant(
      generation.model === request.model && generation.dimensions === selected.dimensions,
      "legal_embedding_generation_route_mismatch"
    )
    invariant(["pending", "embedded"].includes(generation.state), "legal_embedding_generation_not_writable")
    const passages = await client.query<{ id: string; input_hash: string }>(
      `SELECT id,data->>'inputHash' AS input_hash FROM legislation.legal_search_passages
      WHERE generation_id=$1 AND id=ANY($2::text[]) ORDER BY id FOR SHARE`,
      [generation.passage_generation_id, rows.map((row) => row.passageId)]
    )
    const expected = rows
      .map((row) => ({ id: row.passageId, input_hash: row.inputHash }))
      .toSorted((left, right) => left.id.localeCompare(right.id))
    invariant(isDeepStrictEqual(passages.rows, expected), "legal_embedding_input_mismatch")

    const payload = JSON.stringify(
      rows.map((row) => ({
        passage_id: row.passageId,
        input_hash: row.inputHash,
        vector_hash: row.vectorHash,
        embedding: JSON.stringify(row.embedding)
      }))
    )
    const table = routes[request.model].table
    const inserted = await client.query(
      `INSERT INTO ${table}
      (generation_id,passage_generation_id,passage_id,model,dimensions,input_hash,vector_hash,embedding)
      SELECT $1,$2,x.passage_id,$3,$4,x.input_hash,x.vector_hash,x.embedding::vector
      FROM jsonb_to_recordset($5::jsonb)
      AS x(passage_id text,input_hash text,vector_hash text,embedding text)
      ON CONFLICT(generation_id,passage_id) DO NOTHING`,
      [request.generationId, generation.passage_generation_id, request.model, selected.dimensions, payload]
    )
    invariant(generation.state === "pending" || inserted.rowCount === 0, "legal_embedding_completed_generation_changed")
    const stored = await client.query<{ passage_id: string; input_hash: string; vector_hash: string }>(
      `SELECT passage_id,input_hash,vector_hash FROM ${table}
      WHERE generation_id=$1 AND passage_id=ANY($2::text[]) ORDER BY passage_id`,
      [request.generationId, rows.map((row) => row.passageId)]
    )
    invariant(
      isDeepStrictEqual(
        stored.rows,
        rows
          .map((row) => ({ passage_id: row.passageId, input_hash: row.inputHash, vector_hash: row.vectorHash }))
          .toSorted((left, right) => left.passage_id.localeCompare(right.passage_id))
      ),
      "legal_embedding_batch_replay_conflict"
    )
    return { inserted: inserted.rowCount, reused: rows.length - (inserted.rowCount ?? 0) }
  })
}

/** Marks a generation complete only after every expected passage has one verified vector. */
export async function completeLegalEmbeddingGeneration(pool: pg.Pool, generationIdInput: unknown) {
  const generationId = hash.parse(generationIdInput)
  return transaction(pool, async (client) => {
    const generation = (
      await client.query<{
        model: keyof typeof routes
        expected_count: number
        state: string
      }>("SELECT model,expected_count,state FROM legislation.legal_embedding_generations WHERE id=$1 FOR UPDATE", [
        generationId
      ])
    ).rows[0]
    invariant(generation, "legal_embedding_generation_missing")
    if (["embedded", "ready"].includes(generation.state)) {
      return { generationId, vectors: generation.expected_count, reused: true }
    }
    invariant(generation.state === "pending", "legal_embedding_generation_not_pending")
    const table = routes[generation.model].table
    const count = (
      await client.query<{ count: number }>(`SELECT count(*)::integer AS count FROM ${table} WHERE generation_id=$1`, [
        generationId
      ])
    ).rows[0]?.count
    invariant(count === generation.expected_count, "legal_embedding_generation_incomplete")
    const updated = await client.query(
      `UPDATE legislation.legal_embedding_generations
      SET state='embedded',completed_at=clock_timestamp() WHERE id=$1 AND state='pending'`,
      [generationId]
    )
    invariant(updated.rowCount === 1, "legal_embedding_generation_state_changed")
    return { generationId, vectors: count, reused: false }
  })
}
