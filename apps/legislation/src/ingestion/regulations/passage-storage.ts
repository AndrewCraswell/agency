import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { embeddingTokenizer } from "../../models/embedding-tokenizer.js"
import { digest } from "./contracts.js"
import { buildLegalPassages } from "./passages.js"
import { buildLegalTextProjection, storedLegalSourceBlocks } from "./reader-text.js"
import { storageBatchBytes, storageBatchRecords } from "./storage-contract.js"
import { requireRights } from "./storage.js"

export const legalPassageScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("provision"), versionId: z.uuid(), editionId: z.uuid() }),
  z.strictObject({ kind: z.literal("publication"), versionId: z.uuid(), observationId: z.uuid() })
])
type Scope = z.infer<typeof legalPassageScopeSchema>
const snapshotSchema = z.object({
  body: z.string(),
  heading: z.string(),
  blocks: z.unknown(),
  rights_profile_id: z.string(),
  source_id: z.string(),
  jurisdiction_id: z.string(),
  input_contract: z.string(),
  source_hash: z.string().regex(/^[a-f0-9]{64}$/)
})

async function transaction<T>(pool: pg.Pool, action: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
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

export async function readLegalPassageScope(client: pg.PoolClient, scope: Scope) {
  const result =
    scope.kind === "provision"
      ? await client.query(
          `SELECT e.rights_profile_id,e.source_id,e.jurisdiction_id
      FROM legislation.legal_edition_provisions m JOIN legislation.legal_provision_versions v ON v.id=m.version_id
      JOIN legislation.legal_editions e ON e.id=m.edition_id
      WHERE v.id=$1 AND e.id=$2 AND e.published_at IS NOT NULL FOR SHARE OF v,e,m`,
          [scope.versionId, scope.editionId]
        )
      : await client.query(
          `SELECT o.rights_profile_id,o.source_id,o.jurisdiction_id
      FROM legislation.regulatory_document_observations o JOIN legislation.regulatory_document_versions v ON v.id=o.version_id
      JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
      WHERE v.id=$1 AND o.id=$2 FOR SHARE OF v,o,b`,
          [scope.versionId, scope.observationId]
        )
  invariant(result.rows.length === 1, "legal_passage_source_unavailable")
  const snapshot = snapshotSchema
    .pick({ rights_profile_id: true, source_id: true, jurisdiction_id: true })
    .parse(result.rows[0])
  await requireRights(client, snapshot.rights_profile_id, "displayText")
  await requireRights(client, snapshot.rights_profile_id, "localSearch")
  return snapshot
}

export async function readLegalPassageSource(client: pg.PoolClient, scope: Scope) {
  const metadata = await readLegalPassageScope(client, scope)
  const text =
    scope.kind === "provision"
      ? await client.query(
          "SELECT body,heading,blocks,input_contract,legislation.legal_passage_source_hash(body,heading,blocks,input_contract) AS source_hash FROM legislation.legal_provision_versions WHERE id=$1 FOR SHARE",
          [scope.versionId]
        )
      : await client.query(
          "SELECT body,heading,blocks,input_contract,legislation.legal_passage_source_hash(body,heading,blocks,input_contract) AS source_hash FROM legislation.regulatory_document_versions WHERE id=$1 FOR SHARE",
          [scope.versionId]
        )
  return snapshotSchema.parse({ ...metadata, ...text.rows[0] })
}

/** Local passage preparation only: no embedding requests, publication heads or outbox acknowledgements. */
export async function materializeLegalPassages(
  pool: pg.Pool,
  input: { scope: Scope; model: "openai/text-embedding-3-small" | "voyageai/voyage-4"; context: string }
) {
  const scope = legalPassageScopeSchema.parse(input.scope)
  const context = z.string().max(16000).parse(input.context).trim()
  const snapshot = await transaction(pool, (client) => readLegalPassageSource(client, scope))
  const tokenizer = await embeddingTokenizer(input.model)
  const sourceBlocks = storedLegalSourceBlocks({
    body: snapshot.body,
    blocks: snapshot.blocks,
    inputContract: snapshot.input_contract
  })
  const projection = buildLegalTextProjection({
    versionId: scope.versionId,
    body: snapshot.body,
    blocks: sourceBlocks
  })
  const prepared = buildLegalPassages({ projection, sourceBlocks, tokenizer, context })
  const id = digest(JSON.stringify([scope.kind, prepared.generation]))
  const manifestHash = digest(JSON.stringify(prepared.passages))
  return transaction(pool, async (client) => {
    const current = await readLegalPassageSource(client, scope)
    invariant(isDeepStrictEqual(current, snapshot), "legal_passage_source_changed")
    // One immutable generation is either wholly inserted or replay-verified under this transaction lock.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [id])
    const inserted = await client.query(
      `INSERT INTO legislation.legal_passage_generations
      (id,provision_version_id,document_version_id,contract,body_hash,tokenizer_id,context,manifest_hash,passage_count,eligibility)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        id,
        scope.kind === "provision" ? scope.versionId : null,
        scope.kind === "publication" ? scope.versionId : null,
        prepared.contract,
        prepared.bodyHash,
        prepared.tokenizerId,
        context,
        manifestHash,
        prepared.passages.length,
        prepared.eligibility
      ]
    )
    if (inserted.rowCount === 0) {
      const existing = await client.query(
        "SELECT manifest_hash,passage_count FROM legislation.legal_passage_generations WHERE id=$1",
        [id]
      )
      invariant(
        existing.rows[0]?.manifest_hash === manifestHash &&
          existing.rows[0]?.passage_count === prepared.passages.length,
        "legal_passage_generation_conflict"
      )
      const rows = await client.query(
        "SELECT data FROM legislation.legal_passages WHERE generation_id=$1 ORDER BY ordinal",
        [id]
      )
      invariant(
        isDeepStrictEqual(
          rows.rows.map((row) => row.data),
          prepared.passages
        ),
        "legal_passage_replay_mismatch"
      )
    } else {
      let start = 0
      while (start < prepared.passages.length) {
        const rows = prepared.passages.slice(start, start + storageBatchRecords).map((data) => ({
          id: digest(JSON.stringify([id, data.ordinal])),
          ordinal: data.ordinal,
          body: data.text,
          input_text: data.inputText,
          data
        }))
        let payload = JSON.stringify(rows)
        while (Buffer.byteLength(payload) > storageBatchBytes && rows.length > 1) {
          rows.splice(Math.ceil(rows.length / 2))
          payload = JSON.stringify(rows)
        }
        invariant(Buffer.byteLength(payload) <= storageBatchBytes, "legal_passage_storage_row_limit")
        await client.query(
          `INSERT INTO legislation.legal_passages(id,generation_id,ordinal,body,input_text,data)
          SELECT x.id,$1,x.ordinal,x.body,x.input_text,x.data FROM jsonb_to_recordset($2::jsonb)
          AS x(id text,ordinal integer,body text,input_text text,data jsonb)`,
          [id, payload]
        )
        start += rows.length
      }
    }
    await client.query(
      `INSERT INTO legislation.legal_passage_source_provenance(generation_id,source_hash) VALUES($1,$2)
      ON CONFLICT(generation_id) DO UPDATE SET source_hash=EXCLUDED.source_hash
      WHERE legislation.legal_passage_source_provenance.source_hash IS DISTINCT FROM EXCLUDED.source_hash`,
      [id, current.source_hash]
    )
    return {
      generationId: id,
      passages: prepared.passages.length,
      eligibility: prepared.eligibility,
      reused: inserted.rowCount === 0
    }
  })
}

/** Internal version-scoped lexical canary. HTTP authentication and broader search selection are separate gates. */
export async function searchLegalPassages(
  pool: pg.Pool,
  input: { scope: Scope; generationId: string; query: string; limit?: number }
) {
  const scope = legalPassageScopeSchema.parse(input.scope)
  const generationId = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.generationId)
  const query = z.string().trim().min(1).max(500).parse(input.query)
  const limit = z
    .int()
    .min(1)
    .max(50)
    .parse(input.limit ?? 10)
  return transaction(pool, async (client) => {
    await readLegalPassageSource(client, scope)
    const generation = await client.query(
      `SELECT id FROM legislation.legal_passage_generations WHERE id=$1
      AND provision_version_id IS NOT DISTINCT FROM $2::uuid AND document_version_id IS NOT DISTINCT FROM $3::uuid`,
      [
        generationId,
        scope.kind === "provision" ? scope.versionId : null,
        scope.kind === "publication" ? scope.versionId : null
      ]
    )
    invariant(generation.rows.length === 1, "legal_passage_generation_scope_mismatch")
    const result = await client.query(
      `SELECT p.id,p.ordinal,p.body,p.data,ts_rank_cd(p.search_vector,q.query) AS score
      FROM legislation.legal_passages p CROSS JOIN websearch_to_tsquery('english',$2) AS q(query)
      WHERE p.generation_id=$1 AND p.search_vector @@ q.query ORDER BY score DESC,p.ordinal LIMIT $3`,
      [generationId, query, limit]
    )
    return result.rows.map((row) =>
      z
        .object({
          id: z.string(),
          ordinal: z.int().nonnegative(),
          body: z.string(),
          data: z.unknown(),
          score: z.number().nonnegative()
        })
        .parse(row)
    )
  })
}
