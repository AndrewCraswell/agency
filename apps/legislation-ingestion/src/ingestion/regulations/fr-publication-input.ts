import { digest } from "@repo/legislation-core/legal-text/contracts"
import { buildLegalTextProjection } from "@repo/legislation-core/legal-text/reader-text"
import invariant from "tiny-invariant"
import { z } from "zod"
import { parseFrHtml } from "./fr-html.js"
import { frMetadataRecordSchema, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { validateFrPdfEvidence } from "./fr-pdf-validation.js"
import { pdfReceiptSchema } from "./fr-pdf.js"
import { frPdfLocation } from "./fr-reconciliation.js"

const contract = "fr-publication-input-2026-09-14"

/** Source-specific adapter to a format-aware publication input. Keys here are staging keys, not public API IDs. */
export function normalizeFrHtmlPublication(input: {
  metadataRecord: unknown
  metadataManifestId: string
  htmlBytes: Uint8Array
  htmlSourceUrl: string
  pdfBytes: Uint8Array
  pdfReceipt: unknown
  pdfInspection: unknown
}) {
  const metadata = frMetadataRecordSchema.parse(input.metadataRecord)
  const manifestId = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.metadataManifestId)
  const number = normalizeFrDocumentNumber(metadata.document_number)
  invariant(metadata.pdf_url, "fr_publication_pdf_missing")
  const pdfUrl = frPdfLocation(metadata.pdf_url, number, metadata.publication_date)
  const htmlUrl = pdfUrl.replace(`/pdf/${number}.pdf`, `/html/${number}.htm`)
  invariant(input.htmlSourceUrl === htmlUrl, "fr_publication_html_location_mismatch")
  invariant(
    input.htmlBytes.byteLength > 0 && input.htmlBytes.byteLength <= 8 * 1024 * 1024,
    "fr_publication_html_size_limit"
  )
  const parsed = parseFrHtml(new TextDecoder("utf-8", { fatal: true }).decode(input.htmlBytes), metadata)
  const pdfReceipt = pdfReceiptSchema.parse(input.pdfReceipt)
  invariant(
    pdfReceipt.unit.metadataManifestId === manifestId &&
      pdfReceipt.unit.documentNumber === number &&
      pdfReceipt.unit.publicationDate === metadata.publication_date &&
      pdfReceipt.unit.sourceUrl === pdfUrl,
    "fr_publication_pdf_scope_mismatch"
  )
  invariant(
    input.pdfBytes.byteLength === pdfReceipt.bytes && digest(input.pdfBytes) === pdfReceipt.sha256,
    "fr_publication_pdf_hash_mismatch"
  )
  const pdfInspection = validateFrPdfEvidence({
    inspection: input.pdfInspection,
    expectedHash: pdfReceipt.sha256,
    expectedBytes: pdfReceipt.bytes,
    expectedPages: metadata.end_page - metadata.start_page + 1
  })
  const publicationKind = {
    Rule: "final_rule",
    "Proposed Rule": "proposed_rule",
    Notice: "notice",
    "Presidential Document": null
  }[metadata.type]
  invariant(publicationKind !== null, "fr_publication_kind_outside_scope")
  const versionKey = digest(JSON.stringify([contract, "html_preformatted", parsed.textHash]))
  // Empty structural blocks intentionally use the existing reader's lossless plain-text fallback.
  const projection = buildLegalTextProjection({ versionId: versionKey, body: parsed.text, blocks: [] })
  invariant(
    projection.blocks.map((block) => block.text).join("") === parsed.text,
    "fr_publication_text_reconstruction_failed"
  )
  const htmlHash = digest(input.htmlBytes)
  const metadataHash = digest(JSON.stringify(metadata))
  const observationKey = digest(
    JSON.stringify([contract, "federal-register", number, manifestId, metadataHash, htmlHash, pdfReceipt.sha256])
  )
  return {
    contract,
    identityNamespace: "federal-register",
    nativeNumber: number,
    jurisdictionKey: "us",
    sourceId: "govinfo-fr",
    rightsProfileId: "official-federal-text",
    publicationDate: metadata.publication_date,
    publicationKind,
    legalStatus: "unknown",
    observationKey,
    metadataManifestId: manifestId,
    metadataHash,
    metadata,
    textVersion: {
      key: versionKey,
      sourceFormat: "html_preformatted",
      text: parsed.text,
      textHash: parsed.textHash,
      blocks: projection.blocks,
      blockGeneration: projection.blockGeneration,
      readerContract: projection.readerContract,
      semanticStructure: "not_inferred",
      sourceLocator: "css:pre",
      artifactHash: htmlHash,
      sourceUrl: htmlUrl
    },
    supportingPdf: { receipt: pdfReceipt, inspection: pdfInspection },
    canonicalWrites: false,
    publicationReady: false,
    identityStatus: "source_identity_verified"
  }
}
