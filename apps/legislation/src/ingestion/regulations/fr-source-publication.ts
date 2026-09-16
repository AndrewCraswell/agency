import { stat } from "node:fs/promises"
import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { digest } from "./contracts.js"
import { normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { stageReviewedFrPdfRegions, validateReviewedFrRegionText } from "./fr-pdf-regions.js"
import { loadFrHtmlPublications } from "./fr-publication-files.js"
import { writeFrPublication } from "./fr-publication-write.js"
import { registerFrSourceInventory } from "./fr-source-inventory.js"
import { registerFrSourceReviews } from "./fr-source-review.js"
import { regulatoryRecordSchema } from "./parser-contract.js"
import type { RegulatoryLease } from "./storage-contract.js"
import { requireRights, withLease } from "./storage.js"

const contract = "fr-source-publication-2026-09-15"

/** Offline preparation revalidates every retained HTML/PDF and the reviewed whole-issue PDF regions. */
export async function loadReviewedFrSourceIssue(
  input: Parameters<typeof loadFrHtmlPublications>[0] & {
    issuePdf: string
    regions: string
  }
) {
  const html = await loadFrHtmlPublications(input)
  const regions = await stageReviewedFrPdfRegions(input.issuePdf, input.regions)
  const file = await stat(input.issuePdf)
  return {
    html,
    regions: regions.artifact,
    issuePdf: input.issuePdf,
    // This is local artifact retention time, not a publisher date or a claim about the remote download time.
    issueRetainedAt: file.birthtime.toISOString()
  }
}

/** Publish a fully reconciled XML source inventory, including reviewed citation identities, in one transaction. */
export async function publishReviewedFrSourceIssue(
  pool: pg.Pool,
  lease: RegulatoryLease,
  data: Awaited<ReturnType<typeof loadReviewedFrSourceIssue>>
) {
  const inventory = await registerFrSourceInventory(pool, lease, data.html.metadata)
  const reviews = await registerFrSourceReviews(pool, lease, {
    metadata: data.html.metadata,
    issuePdfPath: data.issuePdf
  })
  const publications = new Map(data.html.publications.map((row) => [row.nativeNumber, row]))
  const pdfArtifacts = new Map(data.html.artifacts.map((row) => [row.hash, row]))
  invariant(publications.size === data.html.publications.length, "fr_source_duplicate_html")
  return withLease(pool, lease, async (client, generation) => {
    await requireRights(client, generation.rights_profile_id, "displayText")
    await requireRights(client, generation.rights_profile_id, "localSearch")
    invariant(
      generation.unit.issueDate === data.html.date && generation.summary.warnings.length === 0,
      "fr_source_publication_scope_mismatch"
    )
    const staged = await client.query<{ payload: unknown; record_hash: string; document_id: string }>(
      `SELECT r.payload,r.record_hash,s.document_id FROM legislation.legal_import_records r
      JOIN legislation.regulatory_source_documents s USING(generation_id,record_key)
      WHERE r.generation_id=$1 ORDER BY r.ordinal`,
      [lease.generationId]
    )
    invariant(
      staged.rows.length === inventory.sourceRecords &&
        staged.rows.length <= 1000 &&
        Buffer.byteLength(JSON.stringify(staged.rows)) <= 64 * 1024 * 1024,
      "fr_source_publication_inventory_incomplete"
    )
    const prepared = staged.rows.map((stagedRow) => {
      const record = regulatoryRecordSchema.parse(stagedRow.payload)
      const source = inventory.observations.find((row) => row.recordKey === record.recordKey)
      invariant(
        source &&
          source.recordHash === stagedRow.record_hash &&
          digest(JSON.stringify(record)) === stagedRow.record_hash &&
          record.textHash === digest(record.text),
        "fr_source_publication_record_changed"
      )
      const review = reviews.reviews.find((row) => row.recordKey === record.recordKey)
      const html = publications.get(source.publisherNumber)
      let metadata: Record<string, unknown> & { document_number: string; publication_date: string }
      let rendition
      let evidence
      if (review) {
        const region = data.regions.result.documents.find((row) => row.nativeIdentity === source.nativeIdentity)
        invariant(
          region &&
            region.publisherNumber === source.publisherNumber &&
            region.textHash === digest(region.text) &&
            isDeepStrictEqual(validateReviewedFrRegionText(region.nativeIdentity, region.text), region) &&
            data.regions.result.inspection.pages === 321 &&
            data.regions.result.inspection.artifactHash === review.evidence.issuePdf.artifactHash &&
            data.regions.result.inspection.bytes === review.evidence.issuePdf.bytes &&
            isDeepStrictEqual([...new Set(region.regions.map((row) => row.page))], review.evidence.issuePdf.pages),
          "fr_source_reviewed_rendition_mismatch"
        )
        const fields = review.evidence.reviewedFields
        invariant(
          fields.publicationKind === record.publicationKind && fields.publicationDate === source.publicationDate,
          "fr_source_reviewed_metadata_mismatch"
        )
        metadata = {
          document_number: source.publisherNumber,
          publication_date: fields.publicationDate,
          title: fields.title,
          type: fields.publicationKind === "final_rule" ? "Rule" : "Notice",
          start_page: fields.startPage,
          end_page: fields.endPage,
          metadata_basis: "reviewed_fields",
          source_review_hash: review.reviewHash,
          original_candidates: source.metadataCandidates
        }
        rendition = {
          receipt: {
            unit: {
              metadataManifestId: data.html.metadata.id,
              documentNumber: source.publisherNumber,
              publicationDate: source.publicationDate,
              sourceUrl: review.evidence.issuePdf.sourceUrl
            },
            sha256: review.evidence.issuePdf.artifactHash,
            bytes: review.evidence.issuePdf.bytes,
            acquiredAt: data.issueRetainedAt,
            contentType: "application/pdf",
            etag: null,
            lastModified: null,
            status: "acquired" as const,
            structuralValidation: "pending" as const
          },
          inspection: data.regions.result.inspection,
          storageLocator: data.issuePdf
        }
        evidence = {
          xml: "verified_source_record",
          metadata: "reviewed_fields",
          pdf: "reviewed_issue_regions",
          html:
            review.evidence.individualHtml === "rejected_mixed_identity"
              ? "rejected_mixed_identity"
              : "verified_subject",
          reviewHash: review.reviewHash,
          regionGeneration: data.regions.generation,
          region,
          individualPdf: "not_used",
          wholeIssueInspection: data.regions.result.inspection
        }
        invariant(html || review.evidence.individualHtml === "rejected_mixed_identity", "fr_source_review_html_missing")
      } else {
        invariant(
          source.metadataStatus === "candidate" &&
            html &&
            source.metadataCandidates.length === 1 &&
            isDeepStrictEqual(html.metadata, source.metadataCandidates[0]) &&
            normalizeFrDocumentNumber(html.metadata.document_number) === source.publisherNumber,
          "fr_source_metadata_or_rendition_unresolved"
        )
        const pdf = pdfArtifacts.get(html.supportingPdf.receipt.sha256)
        invariant(pdf, "fr_source_pdf_artifact_missing")
        metadata = html.metadata
        rendition = { ...html.supportingPdf, storageLocator: pdf.locator }
        evidence = {
          xml: "verified_source_record",
          metadata: "matched",
          pdf: "verified_document_pdf",
          html: "verified_subject",
          htmlArtifactHash: html.textVersion.artifactHash,
          pdfArtifactHash: html.supportingPdf.receipt.sha256
        }
      }
      return {
        recordKey: record.recordKey,
        documentId: stagedRow.document_id,
        number: source.publisherNumber,
        record,
        source: metadata,
        rendition,
        evidence,
        contentHash: digest(
          JSON.stringify([record.contract, record.heading, record.text, record.blocks, record.publicationKind])
        )
      }
    })
    const coverage = {
      sourceRecords: inventory.sourceRecords,
      publications: prepared.length,
      documentPdfs: prepared.filter((row) => row.evidence.pdf === "verified_document_pdf").length,
      reviewedIssuePdfs: prepared.filter((row) => row.evidence.pdf === "reviewed_issue_regions").length,
      ambiguousAliases: inventory.ambiguousAliases,
      unresolved: 0,
      canonicalTextSource: "xml"
    }
    const snapshotHash = digest(
      JSON.stringify([
        contract,
        data.html.metadata.id,
        data.html.normalizerHash,
        prepared.map((row) => [
          row.recordKey,
          row.documentId,
          row.contentHash,
          row.source,
          row.rendition.receipt,
          row.rendition.inspection,
          row.evidence
        ])
      ])
    )
    const existing = (
      await client.query<{ snapshot_hash: string; metadata_manifest: unknown; reconciliation: unknown }>(
        "SELECT snapshot_hash,metadata_manifest,reconciliation FROM legislation.regulatory_publication_batches WHERE generation_id=$1",
        [lease.generationId]
      )
    ).rows[0]
    if (existing) {
      invariant(
        existing.snapshot_hash === snapshotHash &&
          generation.state === "published" &&
          isDeepStrictEqual(existing.metadata_manifest, data.html.metadata) &&
          isDeepStrictEqual(existing.reconciliation, coverage),
        "fr_source_snapshot_conflict"
      )
    } else {
      invariant(generation.state !== "published", "fr_source_published_snapshot_missing")
      await client.query(
        `INSERT INTO legislation.regulatory_publication_batches
        (generation_id,metadata_manifest_id,metadata_manifest,snapshot_hash,reconciliation) VALUES($1,$2,$3,$4,$5)`,
        [lease.generationId, data.html.metadata.id, data.html.metadata, snapshotHash, coverage]
      )
      for (const artifact of data.html.artifacts) {
        await client.query(
          "INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [artifact.hash, artifact.bytes, artifact.locator, artifact.acquiredAt]
        )
      }
      for (const row of prepared) {
        await client.query(
          `INSERT INTO legislation.regulatory_source_renditions(generation_id,record_key,evidence_hash,evidence)
          VALUES($1,$2,$3,$4)`,
          [lease.generationId, row.recordKey, digest(JSON.stringify(row.evidence)), row.evidence]
        )
        await writeFrPublication(client, {
          generationId: lease.generationId,
          rightsProfileId: generation.rights_profile_id,
          contract,
          identity: { kind: "source_record", recordKey: row.recordKey },
          row
        })
      }
      await client.query(
        "UPDATE legislation.legal_import_generations SET state='published',blocked_reason=NULL WHERE id=$1",
        [lease.generationId]
      )
    }
    // Validate canonical rows even on the initial write: a content-key collision cannot preserve corrupted text.
    const stored = await client.query<{
      document_id: string
      body: string
      heading: string
      blocks: unknown
      publication_kind: string
      content_hash: string
      input_contract: string
      pdf_hash: string
      metadata: unknown
      source_locator: string
      pdf_receipt: unknown
      pdf_inspection: unknown
      evidence: unknown
      evidence_hash: string
      has_event: boolean
    }>(
      `SELECT o.document_id,v.body,v.heading,v.blocks,v.publication_kind,v.content_hash,v.input_contract,v.pdf_hash,
      o.metadata,o.source_locator,o.pdf_receipt,o.pdf_inspection,r.evidence,r.evidence_hash,
      EXISTS(SELECT 1 FROM legislation.regulatory_publication_outbox x WHERE x.observation_id=o.id AND x.operation='lexical') AS has_event
      FROM legislation.regulatory_document_observations o
      JOIN legislation.regulatory_document_versions v ON v.id=o.version_id
      JOIN legislation.regulatory_source_documents s ON s.generation_id=o.generation_id AND s.document_id=o.document_id
      JOIN legislation.regulatory_source_renditions r ON r.generation_id=o.generation_id AND r.record_key=s.record_key
      WHERE o.generation_id=$1 AND o.rights_profile_id=$2 AND o.publication_date=$3`,
      [lease.generationId, generation.rights_profile_id, generation.unit.issueDate]
    )
    invariant(
      stored.rows.length === prepared.length &&
        stored.rows.every((row) => {
          const expected = prepared.find((candidate) => candidate.documentId === row.document_id)
          return (
            expected &&
            row.body === expected.record.text &&
            row.heading === expected.record.heading &&
            isDeepStrictEqual(row.blocks, expected.record.blocks) &&
            row.publication_kind === expected.record.publicationKind &&
            row.content_hash === expected.contentHash &&
            row.input_contract === contract &&
            row.pdf_hash === expected.rendition.receipt.sha256 &&
            isDeepStrictEqual(row.metadata, expected.source) &&
            row.source_locator === expected.record.sourceLocator &&
            isDeepStrictEqual(row.pdf_receipt, expected.rendition.receipt) &&
            isDeepStrictEqual(row.pdf_inspection, expected.rendition.inspection) &&
            isDeepStrictEqual(row.evidence, expected.evidence) &&
            row.evidence_hash === digest(JSON.stringify(expected.evidence)) &&
            row.has_event
          )
        }),
      "fr_source_publication_replay_incomplete"
    )
    return { generationId: lease.generationId, coverage, reused: !!existing }
  })
}
