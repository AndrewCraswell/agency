import type pg from "pg"
import { z } from "zod"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const frPublicationRecoveryInputSchema = z.strictObject({
  scopeKey: hashSchema,
  afterUnitKey: hashSchema.nullable().default(null),
  afterDocumentNumber: z.string().nullable().default(null),
  limit: z.int().min(1).max(25).default(10)
})
const candidateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rendition"),
    manifestId: hashSchema,
    scopeKey: hashSchema,
    unitKey: hashSchema,
    documentNumber: z.string().min(1),
    updatedAt: z.iso.datetime()
  }),
  z.object({
    kind: z.literal("finalization"),
    manifestId: hashSchema,
    scopeKey: hashSchema,
    unitKey: hashSchema,
    documentNumber: z.literal(""),
    updatedAt: z.iso.datetime()
  })
])

/** Lists a bounded, stable keyset of resumable FR child work without changing canonical state. */
export async function planFrPublicationRecoveryPage(pool: pg.Pool, value: unknown) {
  const input = frPublicationRecoveryInputSchema.parse(value)
  const selected = await pool.query(
    `SELECT * FROM (
       SELECT 'rendition' kind,preparation.manifest_id,rendition.scope_key,rendition.unit_key,
         rendition.document_number,rendition.updated_at
       FROM legislation.legal_fr_issue_renditions rendition
       JOIN legislation.legal_fr_issue_preparations preparation USING(source_id,scope_key,unit_key)
       WHERE rendition.source_id='govinfo-fr' AND rendition.scope_key=$1
         AND preparation.state='renditions_pending' AND rendition.state IN ('pending','acquired')
         AND (rendition.lease_token IS NULL OR rendition.lease_expires_at<clock_timestamp())
       UNION ALL
       SELECT 'finalization' kind,manifest_id,scope_key,unit_key,'' document_number,updated_at
       FROM legislation.legal_fr_issue_preparations
       WHERE source_id='govinfo-fr' AND scope_key=$1 AND state='ready'
     ) candidate
     WHERE (candidate.unit_key,candidate.document_number)>(COALESCE($2,''),COALESCE($3,''))
     ORDER BY candidate.unit_key,candidate.document_number LIMIT $4`,
    [input.scopeKey, input.afterUnitKey, input.afterDocumentNumber, input.limit]
  )
  const items = selected.rows.map((row) =>
    candidateSchema.parse({
      kind: row.kind,
      manifestId: row.manifest_id,
      scopeKey: row.scope_key,
      unitKey: row.unit_key,
      documentNumber: row.document_number,
      updatedAt: new Date(row.updated_at).toISOString()
    })
  )
  const last = items.at(-1)
  return {
    items,
    selected: items.length,
    afterUnitKey: last?.unitKey ?? input.afterUnitKey,
    afterDocumentNumber: last?.documentNumber ?? input.afterDocumentNumber,
    exhausted: items.length < input.limit
  }
}

export async function recordFrFinalizationFailure(pool: pg.Pool, value: unknown, error: unknown) {
  const input = z.strictObject({ manifestId: hashSchema, unitKey: hashSchema }).parse(value)
  const message = (error instanceof Error ? error.message : "fr_publication_finalization_failed").slice(0, 256)
  await pool.query(
    `UPDATE legislation.legal_fr_issue_preparations
     SET last_error=$3,updated_at=clock_timestamp()
     WHERE source_id='govinfo-fr' AND manifest_id=$1 AND unit_key=$2 AND state='ready'`,
    [input.manifestId, input.unitKey, message]
  )
}
