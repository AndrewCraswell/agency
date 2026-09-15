import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import * as cheerio from "cheerio"
import { XMLValidator } from "fast-xml-parser"
import { unzipSync } from "fflate"
import iconv from "iconv-lite"
import { documentSectionId } from "../../legislation/identifiers.js"
import { runPdfTask } from "./pdf-task.js"

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024
export const MAX_PDF_TEXT_EXTRACTION_PAGES = 750
export const MIN_USABLE_PDF_PAGE_TEXT_CHARACTERS = 40
const MAX_OFFICE_ARCHIVE_ENTRIES = 5_000
const MAX_OFFICE_UNCOMPRESSED_BYTES = 4 * MAX_DOCUMENT_BYTES

export type DocumentExtractionFailureCategory =
  | "malformed-document"
  | "ocr-required"
  | "oversized"
  | "unsupported-format"

export class DocumentExtractionError extends Error {
  readonly category: DocumentExtractionFailureCategory

  constructor(category: DocumentExtractionFailureCategory, message: string) {
    super(message)
    this.category = category
    this.name = "DocumentExtractionError"
  }
}

export interface ExtractedSection {
  contentHash: string
  endOffset: number
  heading?: string
  id: string
  identifier?: string
  ordinal: number
  startOffset: number
  text: string
}

export interface DocumentExtraction {
  contentHash: string
  sections: ExtractedSection[]
  text: string
}

function hash(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

export function sanitizeDatabaseText(value: string): string {
  let sanitized = ""
  for (const character of value) {
    const code = character.charCodeAt(0)
    sanitized += code <= 8 || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) || code === 127 ? " " : character
  }
  return sanitized
}

export function normalizeLegalText(value: string): string {
  return sanitizeDatabaseText(value)
    .normalize("NFC")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll(/[\t\f\v ]+/g, " ")
    .replaceAll(/ *\n */g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim()
}

function assertUsefulDocumentText(text: string): void {
  if (text.length < 20) {
    throw new DocumentExtractionError("malformed-document", "Document produced too little usable text")
  }
  const normalized = text.toLowerCase()
  if (
    normalized === "download bill pdf" ||
    (normalized.includes("for full functionality of this site it is necessary to enable javascript") &&
      normalized.includes("california legislative information"))
  ) {
    throw new DocumentExtractionError(
      "malformed-document",
      "Document contains publisher navigation instead of legislative text"
    )
  }
}

function extractXmlText(bytes: Uint8Array): string {
  let xml: string
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    // Processing-instruction data is not an attribute list. In particular,
    // Congress xm-replace_text instructions can contain an unmatched quote.
    // Validate the XML directly; Cheerio below performs the text extraction.
    const validation = XMLValidator.validate(xml)
    if (validation !== true) {
      throw new Error(validation.err.msg)
    }
  } catch (error) {
    throw new DocumentExtractionError(
      "malformed-document",
      `XML document could not be parsed: ${error instanceof Error ? error.message : "invalid XML"}`
    )
  }
  const $ = cheerio.load(xml, { xml: true })
  $("script,style").remove()
  $("section,level,subsection,p,heading,header").each((_index, element) => {
    $(element).after("\n")
  })
  return $.root().text()
}

function extractHtmlText(bytes: Uint8Array, contentType: string): string {
  const charset = /charset=([^;\s]+)/i.exec(contentType)?.[1]?.replaceAll(/["']/g, "") ?? "utf-8"
  const html = iconv.decode(Buffer.from(bytes), iconv.encodingExists(charset) ? charset : "utf-8")
  const $ = cheerio.load(html)
  $("script,style,noscript,nav,header,footer,aside,form").remove()
  $("h1,h2,h3,h4,h5,h6,p,li,section,article,br").each((_index, element) => {
    $(element).after("\n")
  })
  return $("main").text() || $("article").text() || $("body").text()
}

function extractPlainText(bytes: Uint8Array, contentType: string): string {
  const charset = /charset=([^;\s]+)/i.exec(contentType)?.[1]?.replaceAll(/["']/g, "") ?? "utf-8"
  return iconv.decode(Buffer.from(bytes), iconv.encodingExists(charset) ? charset : "utf-8")
}

function officeXmlText(bytes: Uint8Array, mediaType: string): string {
  let entries = 0
  let uncompressedBytes = 0
  const selected = (name: string): boolean => {
    if (mediaType.endsWith("wordprocessingml.document")) {
      return /^word\/(?:document|footnotes|endnotes|header\d+|footer\d+)\.xml$/i.test(name)
    }
    if (mediaType.endsWith("presentationml.presentation")) {
      return /^ppt\/slides\/slide\d+\.xml$/i.test(name)
    }
    return name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
  }
  const archive = unzipSync(bytes, {
    filter: (entry) => {
      entries += 1
      uncompressedBytes += entry.originalSize
      if (entries > MAX_OFFICE_ARCHIVE_ENTRIES || uncompressedBytes > MAX_OFFICE_UNCOMPRESSED_BYTES) {
        throw new DocumentExtractionError("oversized", "Office document archive exceeds safe expansion limits")
      }
      return selected(entry.name)
    }
  })
  const decoder = new TextDecoder("utf-8", { fatal: true })
  if (mediaType.endsWith("spreadsheetml.sheet")) {
    const sharedStringsBytes = archive["xl/sharedStrings.xml"]
    const sharedStrings =
      sharedStringsBytes === undefined
        ? []
        : cheerio
            .load(decoder.decode(sharedStringsBytes), { xml: true })("si")
            .toArray()
            .map((element) => cheerio.load(element, { xml: true }).root().text())
    return Object.entries(archive)
      .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
      .map(([, value]) => {
        const $ = cheerio.load(decoder.decode(value), { xml: true })
        return $("row")
          .toArray()
          .map((row) =>
            $(row)
              .find("c")
              .toArray()
              .map((cell) => {
                const raw = $(cell).find("v").first().text() || $(cell).find("is").text()
                return $(cell).attr("t") === "s" ? (sharedStrings[Number(raw)] ?? raw) : raw
              })
              .join("\t")
          )
          .join("\n")
      })
      .join("\n\n")
  }
  return Object.entries(archive)
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => {
      const $ = cheerio.load(decoder.decode(value), { xml: true })
      $("w\\:p,a\\:p").each((_index, element) => {
        $(element).after("\n")
      })
      return $.root().text()
    })
    .join("\n\n")
}

export interface PdfPageExtractionEvidence {
  hasRasterImage: boolean
  hasVectorGraphics?: boolean
  text: string
}

export interface PdfOcrAssessment {
  kind: "digital-text" | "image-only" | "mixed-scan" | "unusable"
  scannedPageCount: number
}

export function assessPdfOcrEligibility(pages: readonly PdfPageExtractionEvidence[]): PdfOcrAssessment {
  const pageEvidence = pages.map((page) => ({
    hasVisualContent: page.hasRasterImage || page.hasVectorGraphics === true,
    textLength: normalizeLegalText(page.text).length
  }))
  const scannedPageCount = pageEvidence.filter(
    (page) => page.hasVisualContent && page.textLength < MIN_USABLE_PDF_PAGE_TEXT_CHARACTERS
  ).length
  const totalTextLength = pageEvidence.reduce((total, page) => total + page.textLength, 0)

  if (totalTextLength < 20) {
    return {
      kind: scannedPageCount > 0 ? "image-only" : "unusable",
      scannedPageCount
    }
  }
  if (scannedPageCount > 0) {
    return { kind: "mixed-scan", scannedPageCount }
  }
  return { kind: "digital-text", scannedPageCount }
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // PDF.js loads optional canvas bindings at module initialization. Keep that
  // initialization off the server and CLI startup path so deployments that do
  // not process PDFs are not coupled to the native canvas package.
  const { DOMMatrix, ImageData, Path2D } = await import("@napi-rs/canvas")
  Object.defineProperties(globalThis, {
    DOMMatrix: { configurable: true, value: DOMMatrix, writable: true },
    ImageData: { configurable: true, value: ImageData, writable: true },
    Path2D: { configurable: true, value: Path2D, writable: true }
  })
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const standardFontDataUrl = fileURLToPath(
    new URL("standard_fonts/", import.meta.resolve("pdfjs-dist/package.json"))
  ).replaceAll("\\", "/")
  // Image decoding is also required for OCR eligibility: an omitted JBIG2
  // decoder can make a scanned page appear to contain no raster operators.
  const wasmUrl = fileURLToPath(new URL("wasm/", import.meta.resolve("pdfjs-dist/package.json"))).replaceAll("\\", "/")
  const loadingTask = getDocument({ data: Uint8Array.from(bytes), standardFontDataUrl, wasmUrl })
  const rasterImageOperators = new Set([
    OPS.paintImageMaskXObject,
    OPS.paintImageMaskXObjectGroup,
    OPS.paintImageXObject,
    OPS.paintImageXObjectRepeat,
    OPS.paintInlineImageXObject,
    OPS.paintInlineImageXObjectGroup,
    OPS.paintSolidColorImageMask
  ])
  const pages: PdfPageExtractionEvidence[] = []
  await runPdfTask(
    async (signal) => {
      const document = await loadingTask.promise
      signal.throwIfAborted()
      assertPdfTextExtractionPageCount(document.numPages)
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        signal.throwIfAborted()
        const page = await document.getPage(pageNumber)
        signal.throwIfAborted()
        const content = await page.getTextContent()
        signal.throwIfAborted()
        const text = content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")
        if (normalizeLegalText(text).length >= MIN_USABLE_PDF_PAGE_TEXT_CHARACTERS) {
          pages.push({ hasRasterImage: false, text })
          continue
        }
        const operators = await page.getOperatorList()
        signal.throwIfAborted()
        pages.push({
          hasRasterImage: operators.fnArray.some((operator) => rasterImageOperators.has(operator)),
          // Printed PDFs can outline every glyph instead of exposing text or images.
          // Sparse pages with drawing paths need OCR too; an empty OCR result remains a failure.
          hasVectorGraphics: operators.fnArray.includes(OPS.constructPath),
          text
        })
      }
    },
    () => loadingTask.destroy(),
    new DocumentExtractionError(
      "ocr-required",
      "PDF exceeded the 120-second local extraction budget and requires provider extraction"
    )
  )
  const assessment = assessPdfOcrEligibility(pages)
  if (assessment.kind === "image-only") {
    throw new DocumentExtractionError(
      "ocr-required",
      `PDF is image-only; ${assessment.scannedPageCount} of ${pages.length} pages require OCR`
    )
  }
  if (assessment.kind === "mixed-scan") {
    throw new DocumentExtractionError(
      "ocr-required",
      `PDF materially mixes scanned and digital content; ${assessment.scannedPageCount} of ${pages.length} pages require OCR`
    )
  }
  if (assessment.kind === "unusable") {
    throw new DocumentExtractionError(
      "malformed-document",
      "PDF produced too little usable text and contains no raster or vector content"
    )
  }
  return pages.map((page) => page.text).join("\n\n")
}

export function assertPdfTextExtractionPageCount(pageCount: number): void {
  if (pageCount > MAX_PDF_TEXT_EXTRACTION_PAGES) {
    throw new DocumentExtractionError(
      "ocr-required",
      `PDF has ${pageCount} pages, exceeding the ${MAX_PDF_TEXT_EXTRACTION_PAGES}-page local extraction limit, and requires OCR`
    )
  }
}

function headingMatch(line: string): { heading: string; identifier?: string } | undefined {
  const section = /^((?:SEC(?:TION)?\.?|§)\s*([0-9][0-9A-Za-z.-]*)\.?)(?:\s+|$)/i.exec(line)
  if (section?.[1] !== undefined) {
    return { heading: line, identifier: section[2] }
  }
  const hierarchy = /^((?:ARTICLE|CHAPTER|SUBCHAPTER|PART|TITLE)\s+([0-9A-ZIVXLC.-]+)\.?)(?:\s+|$)/i.exec(line)
  if (hierarchy?.[1] !== undefined) {
    const identifier = hierarchy[2]
    const core = identifier?.replace(/[.-]+$/, "") ?? ""
    if (/^\d/.test(core) || /^[IVXLC]+$/.test(core) || /^[A-Z]$/.test(core)) {
      return { heading: line, identifier }
    }
  }
  const provision = /^(DEFINITIONS|AMENDMENTS?|EFFECTIVE DATE|REPEALERS?)\.?$/i.exec(line)
  return provision?.[1] === undefined
    ? undefined
    : { heading: line, identifier: provision[1].toLowerCase().replaceAll(" ", "-") }
}

interface TextSpan {
  endOffset: number
  startOffset: number
  text: string
}

function trimmedSpan(text: string, startOffset: number, endOffset: number): TextSpan {
  const raw = text.slice(startOffset, endOffset)
  const normalized = raw.trim()
  const leadingLength = raw.length - raw.trimStart().length
  const normalizedStart = startOffset + leadingLength
  return { endOffset: normalizedStart + normalized.length, startOffset: normalizedStart, text: normalized }
}

function fallbackChunks(text: string, maximum = 4_000, overlap = 400): TextSpan[] {
  if (text.length <= maximum) {
    return [trimmedSpan(text, 0, text.length)]
  }
  const chunks: TextSpan[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + maximum, text.length)
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end)
      if (boundary > start + maximum / 2) {
        end = boundary
      }
    }
    chunks.push(trimmedSpan(text, start, end))
    if (end === text.length) {
      break
    }
    start = Math.max(end - overlap, start + 1)
  }
  return chunks.filter((chunk) => chunk.text.length > 0)
}

export function segmentLegalText(documentId: string, text: string): ExtractedSection[] {
  const lines = text.split("\n")
  const lineOffsets: number[] = []
  let lineOffset = 0
  for (const line of lines) {
    lineOffsets.push(lineOffset)
    lineOffset += line.length + 1
  }
  const starts = lines.flatMap((line, index) => (headingMatch(line) === undefined ? [] : [index]))
  const rawSections: Array<{
    endOffset: number
    heading?: string
    identifier?: string
    startOffset: number
    text: string
  }> =
    starts.length === 0
      ? fallbackChunks(text)
      : starts.map((start, index) => {
          const heading = headingMatch(lines[start] ?? "")
          const span = trimmedSpan(
            text,
            lineOffsets[start] ?? 0,
            lineOffsets[starts[index + 1] ?? lines.length] ?? text.length
          )
          return {
            endOffset: span.endOffset,
            heading: heading?.heading,
            identifier: heading?.identifier,
            startOffset: span.startOffset,
            text: span.text
          }
        })

  return rawSections.map((section, ordinal) => {
    const contentHash = hash(section.text)
    return {
      contentHash,
      endOffset: section.endOffset,
      heading: section.heading,
      id: documentSectionId(documentId, ordinal, contentHash),
      identifier: section.identifier,
      ordinal,
      startOffset: section.startOffset,
      text: section.text
    }
  })
}

export async function extractDocument(
  documentId: string,
  bytes: Uint8Array,
  contentType: string
): Promise<DocumentExtraction> {
  if (bytes.byteLength === 0) {
    throw new DocumentExtractionError("malformed-document", "Document is empty")
  }
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new DocumentExtractionError("oversized", `Document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`)
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase()
  let extracted: string
  if (mediaType === "application/xml" || mediaType === "text/xml" || mediaType?.endsWith("+xml") === true) {
    extracted = extractXmlText(bytes)
  } else if (mediaType === "text/html" || mediaType === "application/xhtml+xml") {
    extracted = extractHtmlText(bytes, contentType)
  } else if (mediaType === "text/plain") {
    extracted = extractPlainText(bytes, contentType)
  } else if (mediaType === "application/pdf") {
    extracted = await extractPdfText(bytes)
  } else if (
    mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mediaType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    extracted = officeXmlText(bytes, mediaType)
  } else if (mediaType?.startsWith("image/") === true) {
    throw new DocumentExtractionError("ocr-required", `Document is image-only (${mediaType}) and requires OCR`)
  } else {
    throw new DocumentExtractionError("unsupported-format", `Unsupported document content type: ${contentType}`)
  }

  const text = normalizeLegalText(extracted)
  assertUsefulDocumentText(text)
  return { contentHash: hash(bytes), sections: segmentLegalText(documentId, text), text }
}
