import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import type { materializeLegalPassages } from "./passage-storage.js"
import { requireRights } from "./storage.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const span = z.strictObject({ blockId: z.string(), start: z.int().nonnegative(), end: z.int().nonnegative() })
// Field order reconstructs the canonical manifest serialization after a JSONB round trip.
const passage = z.strictObject({
  id: hash,
  versionId: z.uuid(),
  ordinal: z.int().nonnegative(),
  start: z.int().nonnegative(),
  end: z.int().nonnegative(),
  text: z.string(),
  inputText: z.string().max(16000),
  tokenCount: z.int().nonnegative(),
  readerSpans: z.array(span),
  contextSpans: z.array(span),
  inputHash: hash,
  rowContinuation: z
    .strictObject({ start: z.int().nonnegative(), end: z.int().nonnegative(), longColumn: z.int().nonnegative() })
    .nullable()
})
export const legalTransferRowSchema = z.object({
  id: hash,
  ordinal: z.int().nonnegative(),
  body: z.string(),
  input_text: z.string(),
  data: passage
})
export const legalTransferGenerationSchema = z.object({
  id: hash,
  provision_version_id: z.uuid().nullable(),
  document_version_id: z.uuid().nullable(),
  contract: z.string(),
  body_hash: hash,
  tokenizer_id: z.string(),
  context: z.string(),
  manifest_hash: hash,
  passage_count: z.int().nonnegative().max(10000),
  eligibility: z.enum(["eligible", "empty_text"])
})
type Scope = Parameters<typeof materializeLegalPassages>[1]["scope"]

/** Atomic immutable-generation copy only. No head changes, outbox acknowledgements or public search exposure. */
export async function replicateLegalPassageGeneration(
  sourcePool: pg.Pool,
  targetPool: pg.Pool,
  input: { scope: Scope; generationId: string }
) {
  const deadline = Date.now() + 60_000
  const checkDeadline = () => invariant(Date.now() < deadline, "legal_search_copy_deadline")
  const id = hash.parse(input.generationId)
  const versionId = z.uuid().parse(input.scope.versionId)
  const kind = z.enum(["provision", "publication"]).parse(input.scope.kind)
  const scopeId = z.uuid().parse(input.scope.kind === "provision" ? input.scope.editionId : input.scope.observationId)
  invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
  const target = await targetPool.connect()
  try {
    invariant(
      (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_search_wrong_target"
    )
    await target.query("BEGIN")
    await target.query("SET LOCAL lock_timeout='5s'")
    await target.query("SET LOCAL statement_timeout='60s'")
    await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `legal-scope:${kind === "provision" ? "edition" : "publication"}:${scopeId}`
    ])
    await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [id])
    const source = await sourcePool.connect()
    try {
      invariant(
        (await source.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
        "legal_search_wrong_source"
      )
      await source.query("BEGIN")
      await source.query("SET LOCAL lock_timeout='5s'")
      await source.query("SET LOCAL statement_timeout='60s'")
      const membership =
        kind === "provision"
          ? await source.query(
              `SELECT e.rights_profile_id FROM legislation.legal_editions e
          JOIN legislation.legal_edition_provisions m ON m.edition_id=e.id
          WHERE e.id=$1 AND m.version_id=$2 AND e.published_at IS NOT NULL FOR SHARE OF e,m`,
              [scopeId, versionId]
            )
          : await source.query(
              `SELECT rights_profile_id FROM legislation.regulatory_document_observations
          WHERE id=$1 AND version_id=$2 FOR SHARE`,
              [scopeId, versionId]
            )
      invariant(membership.rows.length === 1, "legal_search_source_unavailable")
      const rightsId = z.string().parse(membership.rows[0].rights_profile_id)
      await requireRights(source, rightsId, "displayText")
      await requireRights(source, rightsId, "localSearch")
      const found = await source.query(
        `SELECT id,provision_version_id,document_version_id,contract,body_hash,
        tokenizer_id,context,manifest_hash,passage_count,eligibility FROM legislation.legal_passage_generations
        WHERE id=$1 FOR SHARE`,
        [id]
      )
      const metadata = legalTransferGenerationSchema.parse(found.rows[0])
      invariant(
        metadata.provision_version_id === (kind === "provision" ? versionId : null) &&
          metadata.document_version_id === (kind === "publication" ? versionId : null),
        "legal_search_scope_mismatch"
      )
      const rows: z.infer<typeof legalTransferRowSchema>[] = []
      let bytes = 0
      while (true) {
        checkDeadline()
        const page = z.array(legalTransferRowSchema).parse(
          (
            await source.query(
              `SELECT id,ordinal,body,input_text,data
          FROM legislation.legal_passages WHERE generation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 100 FOR SHARE`,
              [id, rows.length - 1]
            )
          ).rows
        )
        if (page.length === 0) {
          break
        }
        bytes += Buffer.byteLength(JSON.stringify(page))
        invariant(
          bytes <= 64 * 1024 * 1024 && rows.length + page.length <= metadata.passage_count,
          "legal_search_generation_limit"
        )
        for (const item of page) {
          invariant(
            item.ordinal === rows.length &&
              item.data.ordinal === item.ordinal &&
              item.data.versionId === versionId &&
              item.id === digest(JSON.stringify([id, item.ordinal])) &&
              item.body === item.data.text &&
              item.input_text === item.data.inputText &&
              digest(item.input_text) === item.data.inputHash,
            "legal_search_passage_mismatch"
          )
          rows.push(item)
        }
      }
      invariant(
        rows.length === metadata.passage_count &&
          digest(JSON.stringify(rows.map((item) => item.data))) === metadata.manifest_hash,
        "legal_search_manifest_mismatch"
      )
      const inserted = await target.query(
        `INSERT INTO legislation.legal_search_generations(id,metadata)
        VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id`,
        [id, JSON.stringify(metadata)]
      )
      if (inserted.rowCount === 0) {
        const prior = await target.query("SELECT metadata FROM legislation.legal_search_generations WHERE id=$1", [id])
        invariant(isDeepStrictEqual(prior.rows[0]?.metadata, metadata), "legal_search_generation_conflict")
      } else {
        for (let start = 0; start < rows.length; start += 100) {
          checkDeadline()
          const payload = JSON.stringify(rows.slice(start, start + 100))
          invariant(Buffer.byteLength(payload) <= 8 * 1024 * 1024, "legal_search_batch_limit")
          await target.query(
            `INSERT INTO legislation.legal_search_passages(id,generation_id,ordinal,body,input_text,data)
            SELECT x.id,$1,x.ordinal,x.body,x.input_text,x.data FROM jsonb_to_recordset($2::jsonb)
            AS x(id text,ordinal integer,body text,input_text text,data jsonb)`,
            [id, payload]
          )
        }
      }
      // Verify the retained target even on replay; a prior commit alone does not establish a complete copy.
      let checked = 0
      while (true) {
        checkDeadline()
        const page = z.array(legalTransferRowSchema).parse(
          (
            await target.query(
              `SELECT id,ordinal,body,input_text,data
          FROM legislation.legal_search_passages WHERE generation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 100 FOR SHARE`,
              [id, checked - 1]
            )
          ).rows
        )
        invariant(isDeepStrictEqual(page, rows.slice(checked, checked + 100)), "legal_search_copy_mismatch")
        checked += page.length
        if (page.length < 100) {
          break
        }
      }
      invariant(checked === rows.length, "legal_search_copy_mismatch")
      // Source rights and membership locks remain held through target commit.
      checkDeadline()
      await target.query(
        `INSERT INTO legislation.legal_search_memberships(scope_kind,scope_id,generation_id)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [kind === "provision" ? "edition" : "publication", scopeId, id]
      )
      await target.query("COMMIT")
      await source.query("COMMIT")
      return { generationId: id, passages: rows.length, reused: inserted.rowCount === 0 }
    } catch (error) {
      await source.query("ROLLBACK")
      throw error
    } finally {
      source.release()
    }
  } catch (error) {
    await target.query("ROLLBACK")
    throw error
  } finally {
    target.release()
  }
}
