import { readFile, stat } from "node:fs/promises"
import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { digest } from "./contracts.js"
import { registerFrSourceInventory } from "./fr-source-inventory.js"
import { frSubjectKey } from "./fr-subject.js"
import { regulatoryRecordSchema } from "./parser-contract.js"
import type { RegulatoryLease } from "./storage-contract.js"
import { withLease } from "./storage.js"

const contract = "fr-source-review-2026-09-15"
const xmlHash = "5c8fa553adc3c2c5b041ac8b1b1cc6cac1edd4945111037bd4f4fbf574566201"
const pdfHash = "2becceee78ccdac5369e37fa877be85a564ff01b103952082d545a748d97439a"
const pdfBytes = 5862981
const pdfUrl = "https://www.govinfo.gov/content/pkg/FR-2000-01-18/pdf/FR-2000-01-18.pdf"

// Reviewed against original XML and rendered official pages, documented in fr-source-identities.md.
// These are field-level corrections, never an approval of complete PDF parsing or alternate text extraction.
const corrections = [
  {
    nativeId: "fr:2000-01-18:65:2537:rule",
    sourceLocator: "/FEDREG[1]/RULES[1]/RULE[5]",
    sourceHeading: "Revision of Class D Airspace; Hobbs, NM",
    title: "Revision of Class D Airspace; Hobbs, NM",
    kind: "final_rule",
    startPage: 2537,
    endPage: 2538,
    pdfPages: [24, 25],
    anchors: ["99-ASW-32", "Hobbs"],
    boundary: "Starts on page 2537 after the preceding document; ends in page 2538 left column at the 00-113 footer.",
    reason: "mixed_api_identity",
    individualHtml: "rejected_mixed_identity"
  },
  {
    nativeId: "fr:2000-01-18:65:2639:notice",
    sourceLocator: "/FEDREG[1]/NOTICES[1]/NOTICE[62]",
    sourceHeading: "Notice of Filing of Plat of an Island; Minnesota",
    title: "Notice of Filing of Plat of an Island; Minnesota",
    kind: "notice",
    startPage: 2639,
    endPage: 2639,
    pdfPages: [126],
    anchors: ["ES-50581", "Seretha Lake"],
    boundary:
      "Starts near the bottom of page 2639 left column at ES-50581, continues through the middle column, and ends at the upper right 00-113 footer. Adjacent island notices are separate documents.",
    reason: "mixed_api_identity",
    individualHtml: "rejected_mixed_identity"
  },
  {
    nativeId: "00-1083",
    sourceLocator: "/FEDREG[1]/NOTICES[1]/NOTICE[36]",
    sourceHeading:
      "Ambient Air Monitoring Reference and Equivalent Methods: Designation of a New Equivalent Method for SO 2",
    title: "Ambient Air Monitoring Reference and Equivalent Methods: Designation of a New Equivalent Method for SO2",
    kind: "notice",
    startPage: 2610,
    endPage: 2611,
    pdfPages: [97, 98],
    anchors: ["FRL-6524-6", "EQSA-0100-133"],
    boundary:
      "Starts after the previous document in page 2610 left column; ends at the 00-1083 footer in page 2611 left column. The printed heading uses a subscript 2.",
    reason: "subscript_heading_spacing",
    individualHtml: "unreviewed"
  }
] as const

/** Retain reviewed fields separately from the original metadata, under the same fenced source lease. */
export async function registerFrSourceReviews(
  pool: pg.Pool,
  lease: RegulatoryLease,
  input: { metadata: unknown; issuePdfPath: string }
) {
  const file = await stat(input.issuePdfPath)
  invariant(file.isFile() && file.size === pdfBytes, "fr_review_pdf_unreviewed")
  const bytes = await readFile(input.issuePdfPath)
  invariant(bytes.length === pdfBytes && digest(bytes) === pdfHash, "fr_review_pdf_unreviewed")
  const inventory = await registerFrSourceInventory(pool, lease, input.metadata)
  return withLease(pool, lease, async (client, generation) => {
    invariant(
      generation.summary.inputHash === xmlHash &&
        generation.unit.nativeId === "FR-2000-01-18" &&
        generation.unit.issueDate === "2000-01-18" &&
        inventory.sourceRecords === 110,
      "fr_review_source_unreviewed"
    )
    const reviews = []
    for (const correction of corrections) {
      const source = inventory.observations.find((row) => row.sourceLocator === correction.sourceLocator)
      invariant(source && source.nativeIdentity === correction.nativeId, "fr_review_identity_mismatch")
      const row = (
        await client.query<{ payload: unknown; record_hash: string; evidence: unknown }>(
          `SELECT r.payload,r.record_hash,s.evidence FROM legislation.legal_import_records r
        JOIN legislation.regulatory_source_documents s USING(generation_id,record_key)
        WHERE r.generation_id=$1 AND r.record_key=$2`,
          [lease.generationId, source.recordKey]
        )
      ).rows[0]
      invariant(row && isDeepStrictEqual(row.evidence, source), "fr_review_source_changed")
      const record = regulatoryRecordSchema.parse(row.payload)
      invariant(
        digest(JSON.stringify(record)) === row.record_hash &&
          row.record_hash === source.recordHash &&
          record.textHash === digest(record.text) &&
          record.nativeId === correction.nativeId &&
          record.sourceLocator === correction.sourceLocator &&
          record.publicationKind === correction.kind &&
          frSubjectKey(record.heading) === frSubjectKey(correction.sourceHeading) &&
          correction.anchors.every((anchor) => record.text.includes(anchor)),
        "fr_review_record_changed"
      )
      const evidence = {
        contract,
        sourceObservationKey: source.sourceObservationKey,
        recordHash: source.recordHash,
        sourceMetadataStatus: source.metadataStatus,
        reason: correction.reason,
        reviewedFields: {
          title: correction.title,
          publicationKind: correction.kind,
          publicationDate: "2000-01-18",
          startPage: correction.startPage,
          endPage: correction.endPage
        },
        xml: { artifactHash: xmlHash, sourceLocator: correction.sourceLocator, status: "verified_source_record" },
        issuePdf: {
          artifactHash: pdfHash,
          bytes: pdfBytes,
          sourceUrl: pdfUrl,
          pages: correction.pdfPages,
          boundary: correction.boundary,
          status: "reviewed_shared_pages",
          wholeArtifactValidated: false,
          isolatedDocumentTextValidated: false
        },
        individualHtml: correction.individualHtml,
        individualPdf: "unreviewed",
        publicationReady: false
      }
      const reviewHash = digest(JSON.stringify(evidence))
      const existing = (
        await client.query<{ review_hash: string; evidence: unknown }>(
          "SELECT review_hash,evidence FROM legislation.regulatory_source_reviews WHERE generation_id=$1 AND record_key=$2",
          [lease.generationId, source.recordKey]
        )
      ).rows[0]
      if (existing) {
        invariant(
          existing.review_hash === reviewHash && isDeepStrictEqual(existing.evidence, evidence),
          "fr_review_replay_conflict"
        )
      } else {
        await client.query(
          "INSERT INTO legislation.regulatory_source_reviews(generation_id,record_key,review_hash,evidence) VALUES($1,$2,$3,$4)",
          [lease.generationId, source.recordKey, reviewHash, evidence]
        )
      }
      reviews.push({
        recordKey: source.recordKey,
        nativeIdentity: source.nativeIdentity,
        reviewHash,
        reused: !!existing,
        evidence
      })
    }
    return {
      generationId: lease.generationId,
      sourceRecords: inventory.sourceRecords,
      reviews,
      publicationReady: false
    }
  })
}
