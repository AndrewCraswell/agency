import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import * as cheerio from "cheerio"
import { XMLParser } from "fast-xml-parser"
import iconv from "iconv-lite"
import { documentSectionId } from "../../legislation/identifiers.js"

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

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
    throw new Error("Document produced too little usable text")
  }
  const normalized = text.toLowerCase()
  if (
    normalized === "download bill pdf" ||
    (normalized.includes("for full functionality of this site it is necessary to enable javascript") &&
      normalized.includes("california legislative information"))
  ) {
    throw new Error("Document contains publisher navigation instead of legislative text")
  }
}

function extractXmlText(bytes: Uint8Array): string {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  const parser = new XMLParser({ preserveOrder: true, processEntities: false, trimValues: false })
  parser.parse(xml)
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
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const standardFontDataUrl = fileURLToPath(
    new URL("standard_fonts/", import.meta.resolve("pdfjs-dist/package.json"))
  ).replaceAll("\\", "/")
  const loadingTask = getDocument({ data: Uint8Array.from(bytes), standardFontDataUrl })
  const document = await loadingTask.promise
  const pages: string[] = []
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" "))
    }
  } finally {
    await loadingTask.destroy()
  }
  const text = pages.join("\n\n")
  if (text.trim().length < 20) {
    throw new Error("PDF is image-only or contains too little usable text")
  }
  return text
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
    throw new Error("Document is empty")
  }
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error(`Document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`)
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
  } else if (mediaType?.startsWith("image/") === true) {
    throw new Error(`Document is image-only (${mediaType}) and requires OCR`)
  } else {
    throw new Error(`Unsupported document content type: ${contentType}`)
  }

  const text = normalizeLegalText(extracted)
  assertUsefulDocumentText(text)
  return { contentHash: hash(bytes), sections: segmentLegalText(documentId, text), text }
}
