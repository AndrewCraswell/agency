import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { acquireFrHtmlEvidence, FrHtmlSubjectMismatch } from "./fr-html.js"
import { isSupportedFrMetadataType, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { replayFrMetadata } from "./fr-metadata.js"
import { frPdfInspectionSchema } from "./fr-pdf-validation.js"
import { pdfReceiptSchema } from "./fr-pdf.js"
import { normalizeFrHtmlPublication } from "./fr-publication-input.js"
import { RegulatorySourceClient } from "./source-client.js"

export async function loadFrHtmlPublications(input: {
  metadata: string
  date: string
  html: string
  pdf: string
  validation: string
}) {
  const path = (value: unknown) => resolve(z.string().min(1).parse(value))
  const metadata = await replayFrMetadata(JSON.parse(await readFile(path(input.metadata), "utf8")))
  const date = z.iso.date().parse(input.date)
  invariant(date >= metadata.scope.start && date <= metadata.scope.end, "fr_publication_date_outside_manifest")
  const proof = z
    .object({
      metadataManifestId: z.string(),
      date: z.string(),
      complete: z.literal(true),
      validatorCodeHash: z.string(),
      results: z.array(
        z.object({
          documentNumber: z.string(),
          status: z.literal("parsed"),
          receipt: pdfReceiptSchema,
          inspection: frPdfInspectionSchema
        })
      )
    })
    .parse(JSON.parse(await readFile(path(input.validation), "utf8")))
  invariant(proof.metadataManifestId === metadata.id && proof.date === date, "fr_publication_pdf_proof_scope_mismatch")
  invariant(
    proof.validatorCodeHash === digest(await readFile(new URL("./fr-pdf-validation.ts", import.meta.url))),
    "fr_publication_pdf_validator_changed"
  )
  const selected = metadata.records.filter(
    (record) => record.publication_date === date && isSupportedFrMetadataType(record.type)
  )
  invariant(selected.length > 0 && selected.length <= 1000, "fr_publication_batch_size_limit")
  const byNumber = new Map(proof.results.map((result) => [result.documentNumber, result]))
  invariant(
    byNumber.size === proof.results.length && selected.length === byNumber.size,
    "fr_publication_pdf_proof_count_mismatch"
  )
  const client = new RegulatorySourceClient({
    fetch: async () => {
      throw new Error("fr_publication_offline_source_missing")
    }
  })
  const publications = []
  const quarantine: {
    documentNumber: string
    reason: string
    metadataHash: string
    htmlHash: string
    pdfHash: string
    sourceUrl: string
  }[] = []
  const artifacts: { hash: string; bytes: number; locator: string; acquiredAt: string }[] = []
  let bytes = 0
  for (const record of selected) {
    const html = await acquireFrHtmlEvidence(
      { record, metadataManifestId: metadata.id, directory: path(input.html) },
      client
    )
    const number = normalizeFrDocumentNumber(record.document_number)
    const pdf = byNumber.get(number)
    invariant(pdf, "fr_publication_pdf_proof_missing")
    const pdfBytes = await readFile(join(path(input.pdf), "blobs", `${pdf.receipt.sha256}.pdf`))
    invariant(
      pdfBytes.length === pdf.receipt.bytes && digest(pdfBytes) === pdf.receipt.sha256,
      "fr_publication_pdf_hash_mismatch"
    )
    try {
      const publication = normalizeFrHtmlPublication({
        metadataRecord: record,
        metadataManifestId: metadata.id,
        htmlBytes: html.bytes,
        htmlSourceUrl: html.receipt.sourceUrl,
        pdfBytes,
        pdfReceipt: pdf.receipt,
        pdfInspection: pdf.inspection
      })
      bytes += Buffer.byteLength(JSON.stringify(publication))
      invariant(bytes <= 64 * 1024 * 1024, "fr_publication_batch_bytes_limit")
      publications.push(publication)
    } catch (error) {
      // Only this independently identified content conflict is quarantinable. Corrupt bytes, missing evidence,
      // unexpected parser errors and operational failures still abort the batch.
      if (!(error instanceof FrHtmlSubjectMismatch)) {
        throw error
      }
      quarantine.push({
        documentNumber: number,
        reason: "fr_html_subject_mismatch",
        metadataHash: html.metadataRecordHash,
        htmlHash: html.receipt.sha256,
        pdfHash: pdf.receipt.sha256,
        sourceUrl: html.receipt.sourceUrl
      })
    }
    artifacts.push(
      {
        hash: html.receipt.sha256,
        bytes: html.receipt.bytes,
        locator: join(path(input.html), "blobs", `${html.receipt.sha256}.htm`),
        acquiredAt: html.receipt.acquiredAt
      },
      {
        hash: pdf.receipt.sha256,
        bytes: pdf.receipt.bytes,
        locator: join(path(input.pdf), "blobs", `${pdf.receipt.sha256}.pdf`),
        acquiredAt: pdf.receipt.acquiredAt
      }
    )
  }
  return {
    metadata,
    artifacts,
    date,
    publications,
    quarantine,
    coverage: {
      metadataExpected: selected.length,
      verified: publications.length,
      quarantined: quarantine.length,
      issueInventoryVerified: false
    },
    bytes,
    normalizerHash: digest(
      Buffer.concat(
        await Promise.all(
          ["./fr-publication-input.ts", "./fr-html.ts", "./fr-subject.ts", "./fr-publication-files.ts"].map((file) =>
            readFile(new URL(file, import.meta.url))
          )
        )
      )
    )
  }
}
