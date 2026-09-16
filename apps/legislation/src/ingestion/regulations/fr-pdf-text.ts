import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readFile, stat, mkdir, writeFile, link, rm } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { DocumentExtractionError, extractDocument, MAX_DOCUMENT_BYTES } from "../documents/extract.js"
import { digest } from "./contracts.js"
import { inspectFrPdf, validateFrPdfEvidence, frPdfInspectionSchema } from "./fr-pdf-validation.js"
import { pdfReceiptSchema } from "./fr-pdf.js"

const execute = promisify(execFile)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const textResult = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("extracted"),
    text: z
      .string()
      .min(20)
      .max(16 * 1024 * 1024),
    textHash: hash
  }),
  z.strictObject({ status: z.literal("ocr_required"), reason: z.string().min(1).max(2000) })
])
const workerResult = z.strictObject({ inspection: frPdfInspectionSchema, result: textResult })
const artifactSchema = z.strictObject({
  contract: z.literal("fr-pdf-text-2026-09-14"),
  generation: hash,
  extractorHash: hash,
  receipt: pdfReceiptSchema,
  expectedPages: z.int().positive().max(750),
  evidence: workerResult,
  canonicalWrites: z.literal(false),
  publicationReady: z.literal(false),
  textReconciliation: z.literal("pending")
})

/** Isolated worker: reuse the existing document extractor and its OCR assessment, without submitting OCR jobs. */
export async function extractFrPdfText(path: string, documentNumber: string) {
  const size = await stat(path)
  invariant(size.isFile() && size.size > 0 && size.size <= MAX_DOCUMENT_BYTES, "fr_pdf_extraction_byte_limit")
  const inspection = await inspectFrPdf(path, documentNumber)
  const bytes = await readFile(path)
  invariant(bytes.length === size.size && digest(bytes) === inspection.artifactHash, "fr_pdf_changed_during_extraction")
  try {
    const extraction = await extractDocument(`federal-register:${documentNumber}`, bytes, "application/pdf")
    return workerResult.parse({
      inspection,
      result: { status: "extracted", text: extraction.text, textHash: digest(extraction.text) }
    })
  } catch (error) {
    if (error instanceof DocumentExtractionError && error.category === "ocr-required") {
      return workerResult.parse({ inspection, result: { status: "ocr_required", reason: error.message } })
    }
    throw error
  }
}

export async function frPdfTextExtractorHash() {
  const paths = [
    import.meta.url,
    new URL("../documents/extract.ts", import.meta.url).href,
    new URL("../../legislation/identifiers.ts", import.meta.url).href,
    new URL("./fr-pdf-validation.ts", import.meta.url).href,
    new URL("./workers/extract-fr-pdf-text.ts", import.meta.url).href,
    import.meta.resolve("pdfjs-dist/package.json"),
    import.meta.resolve("@napi-rs/canvas/package.json")
  ]
  return digest(JSON.stringify(await Promise.all(paths.map(async (path) => digest(await readFile(new URL(path)))))))
}

/** Offline, content-addressed staging only. A generation cannot release a canonical publication. */
export async function stageFrPdfText(input: {
  receipt: unknown
  expectedPages: number
  directory: string
  output: string
  extractorHash: string
}) {
  const receipt = pdfReceiptSchema.parse(input.receipt)
  const extractorHash = hash.parse(input.extractorHash)
  const expectedPages = z.int().min(1).max(750).parse(input.expectedPages)
  const source = join(input.directory, "blobs", `${receipt.sha256}.pdf`)
  const sourceStat = await stat(source)
  invariant(sourceStat.size === receipt.bytes && sourceStat.size <= MAX_DOCUMENT_BYTES, "fr_pdf_extraction_byte_limit")
  invariant(digest(await readFile(source)) === receipt.sha256, "fr_pdf_extraction_source_hash_mismatch")
  const generation = digest(
    JSON.stringify(["fr-pdf-text-2026-09-14", receipt.unit, receipt.sha256, extractorHash, expectedPages])
  )
  const target = join(input.output, `${generation}.json`)
  function validate(value: unknown) {
    const artifact = artifactSchema.parse(value)
    invariant(
      artifact.generation === generation &&
        artifact.extractorHash === extractorHash &&
        artifact.expectedPages === expectedPages &&
        JSON.stringify(artifact.receipt) === JSON.stringify(receipt),
      "fr_pdf_text_generation_mismatch"
    )
    if (artifact.evidence.result.status === "extracted") {
      validateFrPdfEvidence({
        inspection: artifact.evidence.inspection,
        expectedHash: receipt.sha256,
        expectedBytes: receipt.bytes,
        expectedPages
      })
      invariant(
        digest(artifact.evidence.result.text) === artifact.evidence.result.textHash,
        "fr_pdf_extracted_text_hash_mismatch"
      )
    } else {
      // Scans may have no machine-readable document number. Preserve that uncertainty for OCR review.
      const inspection = artifact.evidence.inspection
      invariant(
        inspection.artifactHash === receipt.sha256 &&
          inspection.bytes === receipt.bytes &&
          inspection.pages === expectedPages,
        "fr_pdf_ocr_source_evidence_mismatch"
      )
    }
    return artifact
  }
  try {
    invariant((await stat(target)).size <= 64 * 1024 * 1024, "fr_pdf_text_artifact_size_limit")
    return { artifact: validate(JSON.parse(await readFile(target, "utf8"))), reused: true }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
  }
  const worker = fileURLToPath(new URL("./workers/extract-fr-pdf-text.ts", import.meta.url))
  const result = await execute(
    process.execPath,
    ["--max-old-space-size=512", "--import", "tsx", worker, source, receipt.unit.documentNumber],
    {
      timeout: 90_000,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE"].includes(key.toUpperCase())
        )
      )
    }
  )
  const artifact = validate({
    contract: "fr-pdf-text-2026-09-14",
    generation,
    extractorHash,
    receipt,
    expectedPages,
    evidence: workerResult.parse(JSON.parse(result.stdout)),
    canonicalWrites: false,
    publicationReady: false,
    textReconciliation: "pending"
  })
  await mkdir(input.output, { recursive: true })
  const temporary = join(input.output, `${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, JSON.stringify(artifact), { flag: "wx", flush: true })
    try {
      await link(temporary, target)
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error
      }
      invariant(
        JSON.stringify(validate(JSON.parse(await readFile(target, "utf8")))) === JSON.stringify(artifact),
        "fr_pdf_text_immutable_conflict"
      )
    }
  } finally {
    await rm(temporary, { force: true })
  }
  return { artifact, reused: false }
}
