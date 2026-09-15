import invariant from "tiny-invariant"
import { z } from "zod"
import { acquisitionUnitSchema, digest } from "./contracts.js"
import { frMetadataRecordSchema, normalizeFrDocumentNumber, type FrMetadataRecord } from "./fr-metadata-contract.js"
import { regulatoryParseSummarySchema, regulatoryRecordSchema } from "./parser-contract.js"

const expectedKind = {
  Rule: "final_rule",
  "Proposed Rule": "proposed_rule",
  Notice: "notice",
  "Presidential Document": null
} as const

export function frPdfLocation(value: string, documentNumber: string, date: string) {
  const url = new URL(value)
  invariant(
    url.protocol === "https:" &&
      url.hostname === "www.govinfo.gov" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === `/content/pkg/FR-${date}/pdf/${documentNumber}.pdf`,
    "untrusted_fr_pdf_location"
  )
  return url.href
}

function correctionTarget(value: string) {
  const url = new URL(value)
  invariant(
    url.protocol === "https:" &&
      url.hostname === "www.federalregister.gov" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash,
    "unsupported_correction_reference"
  )
  const match = /^\/api\/v1\/documents\/([A-Za-z0-9-]+)(?:\.json)?$/.exec(url.pathname)
  invariant(match?.[1], "unsupported_correction_reference")
  return normalizeFrDocumentNumber(match[1])
}

/** Pure union reconciliation. The caller supplies a replay-validated metadata snapshot and verified parser output. */
export function reconcileFrIssue(input: {
  unit: unknown
  summary: unknown
  records: unknown[]
  metadata: unknown[]
  metadataManifestId: string
}) {
  const unit = acquisitionUnitSchema.parse(input.unit)
  const summary = regulatoryParseSummarySchema.parse(input.summary)
  const records = input.records.map((record) => regulatoryRecordSchema.parse(record))
  const metadata = input.metadata.map((record) => frMetadataRecordSchema.parse(record))
  invariant(unit.sourceId === "govinfo-fr" && unit.issueDate !== null, "not_a_dated_fr_issue")
  invariant(records.length === summary.records && summary.records === summary.sourceRecords, "fr_parser_count_mismatch")
  invariant(
    records.every(
      (record) =>
        record.recordType === "publication" &&
        record.provenance.acquisitionUnitId === unit.key &&
        record.provenance.artifactHash === summary.inputHash
    ),
    "fr_parser_provenance_mismatch"
  )
  const textByNumber = new Map(records.map((record) => [normalizeFrDocumentNumber(record.nativeId), record]))
  invariant(textByNumber.size === records.length, "duplicate_fr_text_identity")
  const metadataByNumber = new Map<string, FrMetadataRecord[]>()
  for (const record of metadata.filter((record) => record.publication_date === unit.issueDate)) {
    const number = normalizeFrDocumentNumber(record.document_number)
    const existing = metadataByNumber.get(number) ?? []
    existing.push(record)
    metadataByNumber.set(number, existing)
  }
  const numbers = [...new Set([...textByNumber.keys(), ...metadataByNumber.keys()])].sort()
  const matches = []
  const gaps: { documentNumber: string; reason: string }[] = []
  const outsideScope: { documentNumber: string; reason: string }[] = []
  const corrections: {
    from: string
    to: string | null
    basis: "publisher_link"
    sourceUrl: string
    targetInSlice: boolean
    status: string
  }[] = []
  for (const documentNumber of numbers) {
    const text = textByNumber.get(documentNumber)
    const candidates = metadataByNumber.get(documentNumber) ?? []
    if (candidates.length === 0) {
      gaps.push({ documentNumber, reason: "missing_metadata" })
      continue
    }
    if (candidates.length > 1) {
      gaps.push({ documentNumber, reason: "ambiguous_metadata_match" })
      continue
    }
    const record = candidates[0]
    invariant(record, "metadata_record_missing")
    if (!text && record.type === "Presidential Document") {
      outsideScope.push({ documentNumber, reason: "presidential_document_outside_initial_scope" })
      continue
    }
    if (!text) {
      gaps.push({ documentNumber, reason: "missing_text" })
      continue
    }
    if (text.publicationKind !== expectedKind[record.type]) {
      gaps.push({ documentNumber, reason: "publication_kind_mismatch" })
      continue
    }
    let pdfStatus = "not_listed"
    if (record.pdf_url !== null) {
      try {
        frPdfLocation(record.pdf_url, documentNumber, unit.issueDate)
        pdfStatus = "listed_not_acquired"
      } catch {
        pdfStatus = "untrusted_location"
        gaps.push({ documentNumber, reason: "untrusted_pdf_location" })
      }
    }
    matches.push({
      documentNumber,
      recordKey: text.recordKey,
      kind: text.publicationKind,
      metadataUrl: record.json_url,
      publicationDate: record.publication_date,
      effectiveOn: record.effective_on,
      commentsCloseOn: record.comments_close_on,
      dateWording: record.dates,
      legalStatus: "unknown",
      pdfUrl: record.pdf_url,
      pdfStatus
    })
    if (record.correction_of !== null) {
      try {
        const target = correctionTarget(record.correction_of)
        corrections.push({
          from: documentNumber,
          to: target,
          basis: "publisher_link",
          sourceUrl: record.correction_of,
          targetInSlice: textByNumber.has(target),
          status: textByNumber.has(target) ? "target_in_slice" : "unresolved_target"
        })
      } catch {
        corrections.push({
          from: documentNumber,
          to: null,
          basis: "publisher_link",
          sourceUrl: record.correction_of,
          targetInSlice: false,
          status: "unsupported_reference"
        })
      }
    }
  }
  const presidentialSourceCount = summary.sourceTagCounts.PRESDOCU ?? 0
  if (presidentialSourceCount !== outsideScope.length) {
    gaps.push({ documentNumber: "", reason: "outside_scope_count_mismatch" })
  }
  const metadataComplete = gaps.length === 0 && matches.length === records.length
  const result = {
    unitKey: unit.key,
    sourceUrl: unit.sourceUrl,
    issueDate: unit.issueDate,
    artifactHash: summary.inputHash,
    parserCodeHash: summary.parserCodeHash,
    metadataManifestId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.metadataManifestId),
    parsedPublications: records.length,
    metadataPublications: metadataByNumber.size,
    matchedPublications: matches.length,
    presidentialSourceCount,
    matches,
    gaps,
    outsideScope,
    corrections,
    metadataComplete,
    listedPdfsNotAcquired: matches.filter((match) => match.pdfStatus === "listed_not_acquired").length,
    artifactsComplete: false,
    publicationReady: false,
    canonicalWrites: false,
    status: metadataComplete ? "reconciled" : "incomplete"
  }
  return { id: digest(JSON.stringify(result)), ...result }
}
