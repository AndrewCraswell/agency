import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import { type RegulatoryLease, storageBatchBytes } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { replayFrMetadata } from "./fr-metadata.js"
import { frPdfInspectionSchema, validateFrPdfEvidence } from "./fr-pdf-validation.js"
import { pdfReceiptSchema } from "./fr-pdf.js"
import { writeFrPublication } from "./fr-publication-write.js"
import { frPdfLocation, reconcileFrIssue } from "./fr-reconciliation.js"
import { withLease } from "./storage.js"

export const frRenditionSchema = z.strictObject({
  receipt: pdfReceiptSchema,
  inspection: frPdfInspectionSchema,
  storageLocator: z.string().min(1)
})
const contract = "fr-publication-storage-2026-09-14"

/** Initial bounded issue writer. No source requests, model calls or external work inside the transaction. */
export async function publishFrIssue(
  pool: pg.Pool,
  lease: RegulatoryLease,
  input: {
    metadata: unknown
    renditions: unknown[]
  }
) {
  const metadata = await replayFrMetadata(input.metadata)
  const renditions = z.array(frRenditionSchema).max(1000).parse(input.renditions)
  const byNumber = new Map(renditions.map((rendition) => [rendition.receipt.unit.documentNumber, rendition]))
  invariant(byNumber.size === renditions.length, "fr_duplicate_rendition")
  return withLease(pool, lease, async (client, generation) => {
    invariant(generation.unit.sourceId === "govinfo-fr" && generation.unit.issueDate !== null, "fr_issue_required")
    invariant(generation.summary.warnings.length === 0, "fr_source_review_required")
    invariant(["blocked", "validated", "published"].includes(generation.state), "fr_staging_not_validated")
    await requireRights(client, generation.rights_profile_id, "displayText")
    await requireRights(client, generation.rights_profile_id, "localSearch")
    const count = await client.query<{ bytes: number; count: number }>(
      `SELECT coalesce(sum(payload_bytes),0)::float8 AS bytes,count(*)::int AS count
       FROM legislation.legal_import_records WHERE generation_id=$1`,
      [lease.generationId]
    )
    const totals = count.rows[0]
    invariant(
      totals && totals.bytes <= storageBatchBytes && totals.count <= 1000,
      "fr_issue_requires_partitioned_writer"
    )
    const staged = await client.query<{ payload: unknown }>(
      "SELECT payload FROM legislation.legal_import_records WHERE generation_id=$1 ORDER BY ordinal",
      [lease.generationId]
    )
    const records = staged.rows.map((row) => regulatoryRecordSchema.parse(row.payload))
    const reconciliation = reconcileFrIssue({
      unit: generation.unit,
      summary: generation.summary,
      records,
      metadata: metadata.records,
      metadataManifestId: metadata.id
    })
    invariant(reconciliation.metadataComplete, "fr_metadata_incomplete")
    invariant(renditions.length === records.length, "fr_rendition_count_mismatch")
    const selectedMetadata = new Map(
      metadata.records
        .filter((record) => record.publication_date === generation.unit.issueDate)
        .map((record) => [normalizeFrDocumentNumber(record.document_number), record])
    )
    const prepared = records.map((record) => {
      const number = normalizeFrDocumentNumber(record.nativeId)
      const source = selectedMetadata.get(number)
      const rendition = byNumber.get(number)
      invariant(source && rendition && source.pdf_url, "fr_required_rendition_missing")
      invariant(
        rendition.receipt.unit.metadataManifestId === metadata.id &&
          rendition.receipt.unit.publicationDate === generation.unit.issueDate &&
          rendition.receipt.unit.sourceUrl === frPdfLocation(source.pdf_url, number, source.publication_date),
        "fr_rendition_scope_mismatch"
      )
      validateFrPdfEvidence({
        inspection: rendition.inspection,
        expectedHash: rendition.receipt.sha256,
        expectedBytes: rendition.receipt.bytes,
        expectedPages: source.end_page - source.start_page + 1
      })
      invariant(record.textHash === digest(record.text), "fr_staged_text_hash_mismatch")
      return {
        number,
        record,
        source,
        rendition,
        contentHash: digest(
          JSON.stringify([record.contract, record.heading, record.text, record.blocks, record.publicationKind])
        )
      }
    })
    const snapshotHash = digest(
      JSON.stringify([
        contract,
        metadata.id,
        prepared.map((row) => [row.number, row.contentHash, row.rendition.receipt.sha256, row.rendition.inspection])
      ])
    )
    const existing = await client.query<{ snapshot_hash: string }>(
      "SELECT snapshot_hash FROM legislation.regulatory_publication_batches WHERE generation_id=$1",
      [lease.generationId]
    )
    if (existing.rows[0]) {
      invariant(
        existing.rows[0].snapshot_hash === snapshotHash && generation.state === "published",
        "fr_snapshot_conflict"
      )
      return { generationId: lease.generationId, publications: records.length, reused: true }
    }
    invariant(generation.state !== "published", "fr_published_snapshot_missing")
    await client.query(
      `INSERT INTO legislation.regulatory_publication_batches
      (generation_id,metadata_manifest_id,metadata_manifest,snapshot_hash,reconciliation) VALUES($1,$2,$3,$4,$5)`,
      [lease.generationId, metadata.id, metadata, snapshotHash, reconciliation]
    )
    for (const row of prepared) {
      await writeFrPublication(client, {
        identity: { kind: "publisher_number" },
        generationId: lease.generationId,
        rightsProfileId: generation.rights_profile_id,
        contract,
        row
      })
    }
    await client.query(
      "UPDATE legislation.legal_import_generations SET state='published',blocked_reason=NULL WHERE id=$1",
      [lease.generationId]
    )
    return { generationId: lease.generationId, publications: records.length, reused: false }
  })
}
