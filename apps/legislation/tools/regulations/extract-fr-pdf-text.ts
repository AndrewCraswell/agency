import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "../../src/ingestion/regulations/contracts.js"
import { normalizeFrDocumentNumber } from "../../src/ingestion/regulations/fr-metadata-contract.js"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import { auditFrPdfBoundaries } from "../../src/ingestion/regulations/fr-pdf-boundaries.js"
import { frPdfTextExtractorHash, stageFrPdfText } from "../../src/ingestion/regulations/fr-pdf-text.js"
import { pdfReceiptSchema } from "../../src/ingestion/regulations/fr-pdf.js"
import { frPdfLocation } from "../../src/ingestion/regulations/fr-reconciliation.js"

const { values } = parseArgs({
  options: {
    metadata: { type: "string" },
    date: { type: "string" },
    directory: { type: "string" },
    output: { type: "string" },
    report: { type: "string" },
    limit: { type: "string", default: "100" }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const metadata = await replayFrMetadata(JSON.parse(await readFile(path(values.metadata), "utf8")))
const date = z.iso.date().parse(values.date)
invariant(date >= metadata.scope.start && date <= metadata.scope.end, "fr_pdf_date_outside_manifest")
const selected = metadata.records.filter(
  (record) => record.publication_date === date && record.type !== "Presidential Document"
)
const limit = z.coerce.number().int().min(1).max(1000).parse(values.limit)
const extractorHash = await frPdfTextExtractorHash()
const results = []
for (const record of selected.slice(0, limit)) {
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
      JSON.parse(
        await readFile(join(path(values.directory), "receipts", `${digest(JSON.stringify(unit))}.json`), "utf8")
      )
    )
    invariant(JSON.stringify(receipt.unit) === JSON.stringify(unit), "fr_pdf_receipt_scope_mismatch")
    const result = await stageFrPdfText({
      receipt,
      expectedPages: record.end_page - record.start_page + 1,
      directory: path(values.directory),
      output: path(values.output),
      extractorHash
    })
    const row = {
      documentNumber,
      generation: result.artifact.generation,
      status: result.artifact.evidence.result.status,
      reused: result.reused,
      boundaries:
        result.artifact.evidence.result.status === "extracted"
          ? auditFrPdfBoundaries(result.artifact.evidence.result.text, documentNumber)
          : null
    }
    results.push(row)
    process.stdout.write(`${JSON.stringify(row)}\n`)
  } catch (error) {
    const row = {
      documentNumber,
      status: "failed",
      reason: error instanceof Error ? error.message : "Extraction failed"
    }
    results.push(row)
    process.stdout.write(`${JSON.stringify(row)}\n`)
  }
}
invariant((await frPdfTextExtractorHash()) === extractorHash, "fr_pdf_extractor_changed_during_batch")
const complete =
  selected.length > 0 && results.length === selected.length && results.every((row) => row.status === "extracted")
await writeFile(
  path(values.report),
  JSON.stringify(
    {
      metadataManifestId: metadata.id,
      date,
      extractorHash,
      expected: selected.length,
      complete,
      results,
      canonicalWrites: false,
      publicationReady: false
    },
    null,
    2
  ),
  { flag: "wx" }
)
if (!complete) {
  process.exitCode = 1
}
