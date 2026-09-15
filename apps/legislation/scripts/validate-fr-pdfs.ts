import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "../src/ingestion/regulations/contracts.js"
import { normalizeFrDocumentNumber } from "../src/ingestion/regulations/fr-metadata-contract.js"
import { replayFrMetadata } from "../src/ingestion/regulations/fr-metadata.js"
import { validateFrPdfEvidence, validateFrPdfInWorker } from "../src/ingestion/regulations/fr-pdf-validation.js"
import { pdfReceiptSchema } from "../src/ingestion/regulations/fr-pdf.js"
import { frPdfLocation } from "../src/ingestion/regulations/fr-reconciliation.js"

const { values } = parseArgs({
  options: {
    metadata: { type: "string" },
    date: { type: "string" },
    directory: { type: "string" },
    output: { type: "string" }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const directory = path(values.directory)
const output = path(values.output)
const metadata = await replayFrMetadata(JSON.parse(await readFile(path(values.metadata), "utf8")))
const date = z.iso.date().parse(values.date)
invariant(date >= metadata.scope.start && date <= metadata.scope.end, "fr_pdf_date_outside_manifest")
const selected = metadata.records.filter(
  (record) => record.publication_date === date && record.type !== "Presidential Document"
)
const results = []
for (const record of selected) {
  const documentNumber = normalizeFrDocumentNumber(record.document_number)
  try {
    invariant(record.pdf_url, "fr_pdf_not_listed")
    const unit = {
      metadataManifestId: metadata.id,
      documentNumber,
      publicationDate: date,
      sourceUrl: frPdfLocation(record.pdf_url, documentNumber, date)
    }
    const receipt = pdfReceiptSchema.parse(
      JSON.parse(await readFile(join(directory, "receipts", `${digest(JSON.stringify(unit))}.json`), "utf8"))
    )
    invariant(JSON.stringify(receipt.unit) === JSON.stringify(unit), "fr_pdf_receipt_scope_mismatch")
    const inspection = validateFrPdfEvidence({
      inspection: await validateFrPdfInWorker(join(directory, "blobs", `${receipt.sha256}.pdf`), documentNumber),
      expectedHash: receipt.sha256,
      expectedBytes: receipt.bytes,
      expectedPages: record.end_page - record.start_page + 1
    })
    results.push({ documentNumber, status: "parsed" as const, receipt, inspection })
    process.stdout.write(`${JSON.stringify({ documentNumber, status: "parsed", pages: inspection.pages })}\n`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PDF inspection failed"
    results.push({ documentNumber, status: "failed" as const, reason })
    process.stdout.write(`${JSON.stringify({ documentNumber, status: "failed", reason })}\n`)
  }
}
const complete = results.length > 0 && results.every((result) => result.status === "parsed")
await writeFile(
  output,
  JSON.stringify(
    {
      metadataManifestId: metadata.id,
      date,
      observedAt: new Date().toISOString(),
      validatorCodeHash: digest(
        await readFile(new URL("../src/ingestion/regulations/fr-pdf-validation.ts", import.meta.url))
      ),
      complete,
      results,
      canonicalWrites: false,
      publicationReady: false,
      fullVisualReview: false
    },
    null,
    2
  ),
  { flag: "wx" }
)
if (!complete) {
  process.exitCode = 1
}
