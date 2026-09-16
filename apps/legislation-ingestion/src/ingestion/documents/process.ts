import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { billDocuments, documentSections } from "@repo/legislation-core/database/schema/schema"
import { and, eq, sql } from "drizzle-orm"
import { DocumentExtractionError, extractDocument, sanitizeDatabaseText } from "./extract.js"
import { mapOcrPagesToDocumentSections, type OcrPageSpan } from "./ocr-page-mapping.js"

export const DOCUMENT_FAILURE_CATEGORIES = [
  "download-permanent",
  "download-transient",
  "malformed-document",
  "not-found",
  "ocr-required",
  "oversized",
  "processing-transient",
  "source-inaccessible",
  "unsafe-url",
  "unsupported-format"
] as const

export type DocumentFailureCategory = (typeof DOCUMENT_FAILURE_CATEGORIES)[number]

export interface DocumentFailureClassification {
  category: DocumentFailureCategory
  message: string
  retryable: boolean
}

const KNOWN_INACCESSIBLE_DOCUMENT_HOSTS = new Set(["alisondb.legislature.state.al.us", "www.lrc.ky.gov"])

export function classifyDocumentFailure(error: unknown, sourceUrl?: string): DocumentFailureClassification {
  let failureMessage = "Unknown document processing failure"
  if (error instanceof Error) {
    failureMessage = error.message
  } else if (typeof error === "string") {
    failureMessage = error
  }
  const message = boundedProcessingError(failureMessage)
  const normalized = message.toLowerCase()
  if (error instanceof DocumentExtractionError) {
    return { category: error.category, message, retryable: false }
  }
  const errorName = error instanceof Error ? error.name.toLowerCase() : ""
  const status = /document download failed with http (\d{3})/i.exec(message)?.[1]
  const statusCode = status === undefined ? undefined : Number(status)
  let sourceHost: string | undefined
  try {
    sourceHost = sourceUrl === undefined ? undefined : new URL(sourceUrl).hostname.toLowerCase()
  } catch {
    sourceHost = undefined
  }

  if (statusCode === 404 || statusCode === 410) {
    return { category: "not-found", message, retryable: false }
  }
  if (normalized.includes("california bill pdf is not available from publisher")) {
    return { category: "not-found", message, retryable: false }
  }
  if (normalized.includes("congress committee repository reports document not found")) {
    return { category: "not-found", message, retryable: false }
  }
  if (statusCode !== undefined) {
    const retryable = statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500
    return { category: retryable ? "download-transient" : "download-permanent", message, retryable }
  }
  if (
    normalized.includes("document url must use https") ||
    normalized.includes("document redirect changed to an unsupported protocol")
  ) {
    return { category: "unsafe-url", message, retryable: false }
  }
  if (normalized.includes("document exceeds the")) {
    return { category: "oversized", message, retryable: false }
  }
  if (normalized.includes("unsupported document content type")) {
    return { category: "unsupported-format", message, retryable: false }
  }
  if (
    errorName === "passwordexception" ||
    normalized.includes("no password given") ||
    normalized.includes("incorrect password") ||
    normalized.includes("password required") ||
    normalized.includes("encrypted pdf")
  ) {
    return { category: "unsupported-format", message, retryable: false }
  }
  if (normalized.includes("document source is inaccessible")) {
    return { category: "source-inaccessible", message, retryable: false }
  }
  if (normalized.includes("document response contains html instead of advertised pdf")) {
    return { category: "download-transient", message, retryable: true }
  }
  if (normalized.includes("document host limiter timed out")) {
    return { category: "download-transient", message, retryable: true }
  }
  if (normalized.includes("image-only") || normalized.includes("requires ocr")) {
    return { category: "ocr-required", message, retryable: false }
  }
  if (
    errorName === "invalidpdfexception" ||
    normalized.includes("invalid pdf structure") ||
    normalized.includes("invalid root reference") ||
    normalized.includes("bad uncompressed block length in flate stream") ||
    normalized.includes("bad (uncompressed) xref entry") ||
    normalized.includes("invalid zip data") ||
    normalized.includes("reading 'addchild'") ||
    normalized.includes("document is empty") ||
    normalized.includes("document produced no usable text") ||
    normalized.includes("document produced too little usable text") ||
    normalized.includes("document contains publisher navigation instead of legislative text")
  ) {
    return { category: "malformed-document", message, retryable: false }
  }
  if (
    sourceHost !== undefined &&
    KNOWN_INACCESSIBLE_DOCUMENT_HOSTS.has(sourceHost) &&
    (normalized.includes("fetch failed") ||
      normalized.includes("enotfound") ||
      normalized.includes("eai_again") ||
      normalized.includes("timeout"))
  ) {
    return { category: "source-inaccessible", message, retryable: false }
  }
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("terminated") ||
    normalized.includes("econn") ||
    normalized.includes("enotfound") ||
    normalized.includes("eai_again")
  ) {
    return { category: "download-transient", message, retryable: true }
  }
  if (normalized.includes("california bill pdf download form is incomplete")) {
    return { category: "download-permanent", message, retryable: false }
  }
  return { category: "processing-transient", message, retryable: true }
}

export function isTerminalDocumentFailure(message: string): boolean {
  return !classifyDocumentFailure(message).retryable
}

export function boundedProcessingError(value: string): string {
  return sanitizeDatabaseText(value).replaceAll(/\s+/g, " ").trim().slice(0, 1000)
}

export async function persistProcessedDocument(
  database: LegislationDatabase,
  input: { blobPath?: string; bytes: Uint8Array; contentType: string; documentId: string },
  options: Readonly<{ skipUnchangedCheck?: boolean }> = {}
): Promise<"processed" | "unchanged"> {
  const extraction = await extractDocument(input.documentId, input.bytes, input.contentType)
  if (options.skipUnchangedCheck !== true) {
    const existing = await database
      .select({ contentHash: billDocuments.contentHash, processingStatus: billDocuments.processingStatus })
      .from(billDocuments)
      .where(eq(billDocuments.id, input.documentId))
      .limit(1)
    if (existing[0]?.contentHash === extraction.contentHash && existing[0].processingStatus === "processed") {
      return "unchanged"
    }
  }

  await persistDocumentExtraction(database, input, extraction)
  return "processed"
}

export async function persistOcrDocument(
  database: LegislationDatabase,
  input: {
    blobPath: string
    contentType: string
    documentId: string
    pageCount?: number
    pages?: readonly OcrPageSpan[]
    provider: string
    sourceBytes: Uint8Array
    text: string
  }
): Promise<void> {
  const textBytes = new TextEncoder().encode(input.text)
  const extractedText = await extractDocument(input.documentId, textBytes, "text/plain")
  const pageRanges =
    input.pages === undefined
      ? new Map()
      : mapOcrPagesToDocumentSections(input.text, extractedText.text, extractedText.sections, input.pages)
  await persistDocumentExtraction(
    database,
    {
      blobPath: input.blobPath,
      bytes: input.sourceBytes,
      contentType: input.contentType,
      documentId: input.documentId
    },
    {
      ...extractedText,
      contentHash: createHash("sha256").update(input.sourceBytes).digest("hex")
    },
    {
      completedAt: new Date(),
      pageCount: input.pageCount,
      pageRanges,
      provider: input.provider
    }
  )
}

async function persistDocumentExtraction(
  database: LegislationDatabase,
  input: { blobPath?: string; bytes: Uint8Array; contentType: string; documentId: string },
  extraction: Awaited<ReturnType<typeof extractDocument>>,
  ocr?: Readonly<{
    completedAt: Date
    pageCount?: number
    pageRanges: ReadonlyMap<string, Readonly<{ pageEnd: number; pageStart: number }>>
    provider: string
  }>
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction
      .update(billDocuments)
      .set({
        ...(input.blobPath === undefined ? {} : { blobPath: input.blobPath }),
        contentHash: extraction.contentHash,
        contentType: input.contentType,
        ...(ocr === undefined
          ? {
              ocrCompletedAt: null,
              ocrPageCount: null,
              ocrProvider: null,
              ocrStatus: "not-required"
            }
          : {
              ocrCompletedAt: ocr.completedAt,
              ocrPageCount: ocr.pageCount ?? null,
              ocrProvider: ocr.provider,
              ocrStatus: "processed"
            }),
        nextAttemptAt: null,
        processingError: null,
        processingErrorCategory: null,
        processingStatus: "processed",
        text: extraction.text,
        updatedAt: new Date()
      })
      .where(eq(billDocuments.id, input.documentId))
    await transaction.delete(documentSections).where(eq(documentSections.documentId, input.documentId))
    if (extraction.sections.length > 0) {
      await transaction.insert(documentSections).values(
        extraction.sections.map((section) => ({
          contentHash: section.contentHash,
          documentId: input.documentId,
          heading: section.heading,
          id: section.id,
          ordinal: section.ordinal,
          ...(ocr === undefined ? undefined : ocr.pageRanges.get(section.id)),
          sectionIdentifier: section.identifier,
          sourceEndOffset: section.endOffset,
          sourceStartOffset: section.startOffset,
          text: section.text
        }))
      )
    }
  })
}

export async function markDocumentProcessingFailure(
  database: LegislationDatabase,
  documentId: string,
  input: Readonly<{
    category: DocumentFailureCategory
    blobPath?: string
    contentType?: string
    nextAttemptAt?: Date
    ocrStatus?: "failed" | "pending" | "unsupported"
    processingError: string
    status: "failed" | "pending" | "unsupported"
  }>
): Promise<void> {
  const ocrStatus = ocrStatusForDocumentFailure(input)
  await database
    .update(billDocuments)
    .set({
      ...(input.blobPath === undefined ? {} : { blobPath: input.blobPath }),
      ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
      ocrStatus: ocrStatus ?? null,
      ocrCompletedAt: null,
      ocrPageCount: null,
      ocrProvider: null,
      nextAttemptAt: input.nextAttemptAt ?? null,
      processingError: boundedProcessingError(input.processingError),
      processingErrorCategory: input.category,
      processingStatus: input.status,
      updatedAt: new Date()
    })
    .where(eq(billDocuments.id, documentId))
}

/**
 * The generic ingestion worker must not turn download/extraction failures into
 * OCR failures. OCR lifecycle states become known only when extraction detects
 * image-only content, or when the dedicated OCR worker reports its own result.
 */
export function ocrStatusForDocumentFailure(
  input: Readonly<{
    category: DocumentFailureCategory
    ocrStatus?: "failed" | "pending" | "unsupported"
    status: "failed" | "pending" | "unsupported"
  }>
): "failed" | "pending" | "unsupported" | undefined {
  if (input.ocrStatus !== undefined) {
    return input.ocrStatus
  }
  if (input.category === "ocr-required") {
    return "pending"
  }
  return input.status === "unsupported" ? "unsupported" : undefined
}

/**
 * Return a row claimed by a worker to the durable queue when host backpressure
 * prevents a download. This is not an HTTP attempt, so it must not consume a
 * publisher retry or produce a failed ingestion run.
 */
export async function deferDocumentProcessing(
  database: LegislationDatabase,
  documentId: string,
  nextAttemptAt: Date
): Promise<void> {
  await database
    .update(billDocuments)
    .set({
      lastAttemptAt: null,
      nextAttemptAt,
      processingAttempts: sql`greatest(${billDocuments.processingAttempts} - 1, 0)`,
      processingError: null,
      processingErrorCategory: null,
      ocrCompletedAt: null,
      ocrPageCount: null,
      ocrProvider: null,
      ocrStatus: null,
      processingStatus: "pending",
      updatedAt: new Date()
    })
    .where(and(eq(billDocuments.id, documentId), eq(billDocuments.processingStatus, "processing")))
}
