import { regulatoryEmbeddingRouteForModel } from "@repo/legislation-core/embeddings/embedding-routing"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { isLegalSearchDatabaseName } from "@repo/legislation-core/legal-text/search-database-role"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const requestSchema = z.strictObject({
  generationId: hash,
  shardCount: z.literal(16),
  shardIndex: z.int().min(0).max(15),
  afterPassageId: hash.nullable().default(null),
  limit: z.int().min(1).max(256).default(256)
})
const modelSchema = z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"])
const tables = {
  "openai/text-embedding-3-small": "legislation.legal_openai_small_embeddings",
  "voyageai/voyage-4": "legislation.legal_voyage_4_embeddings"
} as const
const candidateSchema = z.object({
  passage_id: hash,
  input_hash: hash,
  input_text: z.string().min(1).max(16_000),
  source_generation_id: hash,
  source_passage_generation_id: hash,
  source_passage_id: hash,
  vector_hash: hash,
  conflicting_hashes: z.int().positive()
})

async function reusableCandidates(
  client: pg.PoolClient,
  input: z.output<typeof requestSchema>,
  generation: { dimensions: number; input_contract: string; model: keyof typeof tables; passage_generation_id: string }
) {
  const table = tables[generation.model]
  return z.array(candidateSchema).parse(
    (
      await client.query(
        `WITH candidates AS (
          SELECT p.id AS passage_id,p.input_text,p.data->>'inputHash' AS input_hash
          FROM legislation.legal_search_passages p
          LEFT JOIN ${table} current ON current.generation_id=$1 AND current.passage_id=p.id
          WHERE p.generation_id=$2 AND p.id>$3
            AND get_byte(decode(substring(p.id,1,2),'hex'),0)%$4=$5 AND current.passage_id IS NULL
          ORDER BY p.id LIMIT $6
        )
        SELECT c.*,
          source.source_generation_id,source.source_passage_generation_id,source.source_passage_id,
          source.vector_hash,source.conflicting_hashes
        FROM candidates c
        JOIN LATERAL (
          SELECT
            (array_agg(e.generation_id ORDER BY g.completed_at DESC,e.generation_id,e.passage_id))[1]
              AS source_generation_id,
            (array_agg(e.passage_generation_id ORDER BY g.completed_at DESC,e.generation_id,e.passage_id))[1]
              AS source_passage_generation_id,
            (array_agg(e.passage_id ORDER BY g.completed_at DESC,e.generation_id,e.passage_id))[1]
              AS source_passage_id,
            (array_agg(e.vector_hash ORDER BY g.completed_at DESC,e.generation_id,e.passage_id))[1] AS vector_hash,
            count(DISTINCT e.vector_hash)::integer AS conflicting_hashes
          FROM ${table} e
          JOIN legislation.legal_embedding_generations g ON g.id=e.generation_id
          WHERE e.input_hash=c.input_hash AND e.generation_id<>$1
            AND g.model=$7 AND g.dimensions=$8 AND g.input_contract=$9 AND g.state IN ('embedded','ready')
            AND EXISTS (
              SELECT 1 FROM legislation.legal_search_memberships m
              WHERE m.generation_id=e.passage_generation_id AND NOT EXISTS (
                SELECT 1 FROM legislation.legal_search_revocations r
                WHERE r.scope_kind=m.scope_kind AND r.scope_id=m.scope_id
              )
            )
          HAVING count(*)>0
        ) source ON true ORDER BY c.passage_id`,
        [
          input.generationId,
          generation.passage_generation_id,
          input.afterPassageId ?? "",
          input.shardCount,
          input.shardIndex,
          input.limit,
          generation.model,
          generation.dimensions,
          generation.input_contract
        ]
      )
    ).rows
  )
}

/** Copies only exact, completed, rights-active model/input identities; ambiguous source vectors fail closed. */
export async function reuseLegalEmbeddingShard(pool: pg.Pool, input: unknown) {
  const request = requestSchema.parse(input)
  const client = await pool.connect()
  try {
    invariant(
      isLegalSearchDatabaseName((await client.query("SELECT current_database() AS name")).rows[0]?.name),
      "legal_embedding_wrong_target"
    )
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='60s'")
    const generation = (
      await client.query<{
        dimensions: number
        input_contract: string
        model: string
        passage_generation_id: string
        state: string
      }>(
        `SELECT passage_generation_id,model,dimensions,input_contract,state
        FROM legislation.legal_embedding_generations WHERE id=$1`,
        [request.generationId]
      )
    ).rows[0]
    invariant(generation, "legal_embedding_generation_missing")
    const model = modelSchema.parse(generation.model)
    const route = regulatoryEmbeddingRouteForModel(model)
    invariant(
      generation.state === "pending" &&
        generation.dimensions === route.dimensions &&
        generation.input_contract === route.embeddingInputContract,
      "legal_embedding_generation_not_runnable"
    )
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [generation.passage_generation_id])
    const targetMembership = await client.query(
      `SELECT 1 FROM legislation.legal_search_memberships m
      WHERE m.generation_id=$1 AND NOT EXISTS (
        SELECT 1 FROM legislation.legal_search_revocations r
        WHERE r.scope_kind=m.scope_kind AND r.scope_id=m.scope_id
      ) LIMIT 1`,
      [generation.passage_generation_id]
    )
    invariant(targetMembership.rowCount === 1, "legal_embedding_search_membership_unavailable")
    let candidates = await reusableCandidates(client, request, { ...generation, model })
    const lockedSources = new Set<string>()
    while (true) {
      const unlockedSources = [...new Set(candidates.map((row) => row.source_passage_generation_id))]
        .filter((id) => !lockedSources.has(id))
        .sort()
      if (unlockedSources.length === 0) break
      for (const sourceGeneration of unlockedSources) {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [sourceGeneration])
        lockedSources.add(sourceGeneration)
      }
      // A source can disappear before its lock is acquired, revealing the next exact source. Lock until stable.
      candidates = await reusableCandidates(client, request, { ...generation, model })
    }
    for (const candidate of candidates) {
      invariant(candidate.conflicting_hashes === 1, "legal_embedding_reuse_conflict")
      invariant(digest(candidate.input_text) === candidate.input_hash, "legal_embedding_input_hash_mismatch")
    }
    const table = tables[model]
    const payload = candidates.map((candidate) => ({
      passage_id: candidate.passage_id,
      input_hash: candidate.input_hash,
      source_generation_id: candidate.source_generation_id,
      source_passage_id: candidate.source_passage_id,
      vector_hash: candidate.vector_hash
    }))
    const inserted =
      payload.length === 0
        ? { rowCount: 0 }
        : await client.query(
            `INSERT INTO ${table}
            (generation_id,passage_generation_id,passage_id,model,dimensions,input_hash,vector_hash,embedding)
            SELECT $1,$2,x.passage_id,$3,$4,x.input_hash,x.vector_hash,source.embedding
            FROM jsonb_to_recordset($5::jsonb)
            AS x(passage_id text,input_hash text,source_generation_id text,source_passage_id text,vector_hash text)
            JOIN ${table} source ON source.generation_id=x.source_generation_id
              AND source.passage_id=x.source_passage_id AND source.input_hash=x.input_hash
              AND source.vector_hash=x.vector_hash
            ON CONFLICT DO NOTHING RETURNING passage_id`,
            [request.generationId, generation.passage_generation_id, model, route.dimensions, JSON.stringify(payload)]
          )
    invariant(inserted.rowCount === payload.length, "legal_embedding_reuse_write_conflict")
    await client.query("COMMIT")
    return { reused: payload.length, saturated: payload.length === request.limit }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
