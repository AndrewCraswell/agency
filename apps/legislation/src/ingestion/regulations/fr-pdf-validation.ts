import { execFile } from "node:child_process"
import { readFile, stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"

const execute = promisify(execFile)
export const frPdfValidationContract = "fr-pdf-parse-2026-09-14"
export const frPdfInspectionSchema = z.strictObject({
  contract: z.literal(frPdfValidationContract),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.int().positive(),
  parserVersion: z.string().min(1),
  pages: z.int().min(1).max(750),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  textCharacters: z.int().nonnegative(),
  emptyTextPages: z.array(z.int().positive()).max(750),
  documentNumberFound: z.boolean(),
  parserChecks: z.literal("all_pages_text_and_operators"),
  renderingChecked: z.literal(false)
})

/** Runs only in the bounded child process. PDF text is evidence, never a replacement for canonical XML. */
export async function inspectFrPdf(path: string, documentNumber: string) {
  const file = await stat(path)
  invariant(file.isFile() && file.size > 0 && file.size <= 32 * 1024 * 1024, "fr_pdf_validation_byte_limit")
  const bytes = await readFile(path)
  invariant(bytes.length === file.size, "fr_pdf_changed_during_validation")
  const { DOMMatrix, ImageData, Path2D } = await import("@napi-rs/canvas")
  Object.defineProperties(globalThis, {
    DOMMatrix: { configurable: true, value: DOMMatrix, writable: true },
    ImageData: { configurable: true, value: ImageData, writable: true },
    Path2D: { configurable: true, value: Path2D, writable: true }
  })
  const { getDocument, version } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loading = getDocument({
    data: Uint8Array.from(bytes),
    stopAtErrors: true,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
    standardFontDataUrl: fileURLToPath(
      new URL("standard_fonts/", import.meta.resolve("pdfjs-dist/package.json"))
    ).replaceAll("\\", "/")
  })
  try {
    const document = await loading.promise
    invariant(document.numPages >= 1 && document.numPages <= 750, "fr_pdf_validation_page_limit")
    const texts: string[] = []
    const emptyTextPages: number[] = []
    let characters = 0
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      await page.getOperatorList()
      const text = content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")
      characters += text.length
      invariant(characters <= 32 * 1024 * 1024, "fr_pdf_validation_text_limit")
      texts.push(text)
      if (text.trim().length === 0) {
        emptyTextPages.push(number)
      }
      page.cleanup()
    }
    const text = texts.join("\n")
    const normalized = text
      .replaceAll(/[\u2010-\u2015]/g, "-")
      .replaceAll(/\s/g, "")
      .toUpperCase()
    return frPdfInspectionSchema.parse({
      contract: frPdfValidationContract,
      artifactHash: digest(bytes),
      bytes: bytes.length,
      parserVersion: version,
      pages: document.numPages,
      textHash: digest(text),
      textCharacters: text.length,
      emptyTextPages,
      documentNumberFound: new RegExp(`(?<![0-9-])${documentNumber.toUpperCase()}(?![0-9-])`).test(normalized),
      parserChecks: "all_pages_text_and_operators",
      renderingChecked: false
    })
  } finally {
    await loading.destroy()
  }
}

/** Hard process timeout and heap ceiling keep malformed local artifacts out of the orchestration process. */
export async function validateFrPdfInWorker(path: string, documentNumber: string) {
  const worker = fileURLToPath(new URL("./workers/inspect-fr-pdf.ts", import.meta.url))
  const result = await execute(
    process.execPath,
    ["--max-old-space-size=512", "--import", "tsx", worker, path, documentNumber],
    {
      timeout: 90_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE"].includes(key.toUpperCase())
        )
      )
    }
  )
  return frPdfInspectionSchema.parse(JSON.parse(result.stdout))
}

export function validateFrPdfEvidence(input: {
  inspection: unknown
  expectedHash: string
  expectedBytes: number
  expectedPages: number
}) {
  const inspection = frPdfInspectionSchema.parse(input.inspection)
  invariant(
    inspection.artifactHash === input.expectedHash && inspection.bytes === input.expectedBytes,
    "fr_pdf_receipt_hash_mismatch"
  )
  invariant(inspection.pages === input.expectedPages, "fr_pdf_publisher_page_count_mismatch")
  invariant(inspection.documentNumberFound, "fr_pdf_document_identity_unconfirmed")
  return inspection
}
