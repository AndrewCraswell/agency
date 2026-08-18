import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments, documentSections } from "../../db/schema/schema.js"
import { extractDocument, sanitizeDatabaseText } from "./extract.js"

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

const KNOWN_INACCESSIBLE_DOCUMENT_HOSTS = new Set(["alisondb.legislature.state.al.us"])

export function classifyDocumentFailure(error: unknown, sourceUrl?: string): DocumentFailureClassification {
  let failureMessage = "Unknown document processing failure"
  if (error instanceof Error) {
    failureMessage = error.message
  } else if (typeof error === "string") {
    failureMessage = error
  }
  const message = boundedProcessingError(failureMessage)
  const normalized = message.toLowerCase()
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
  if (normalized.includes("document response contains html instead of advertised pdf")) {
    return { category: "download-transient", message, retryable: true }
  }
  if (normalized.includes("image-only")) {
    return { category: "ocr-required", message, retryable: false }
  }
  if (
    normalized.includes("invalid pdf structure") ||
    normalized.includes("invalid root reference") ||
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

  await database.transaction(async (transaction) => {
    await transaction
      .update(billDocuments)
      .set({
        ...(input.blobPath === undefined ? {} : { blobPath: input.blobPath }),
        contentHash: extraction.contentHash,
        contentType: input.contentType,
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
          sectionIdentifier: section.identifier,
          sourceEndOffset: section.endOffset,
          sourceStartOffset: section.startOffset,
          text: section.text
        }))
      )
    }
  })
  return "processed"
}

export async function markDocumentProcessingFailure(
  database: LegislationDatabase,
  documentId: string,
  input: Readonly<{
    category: DocumentFailureCategory
    blobPath?: string
    contentType?: string
    nextAttemptAt?: Date
    processingError: string
    status: "failed" | "unsupported"
  }>
): Promise<void> {
  await database
    .update(billDocuments)
    .set({
      ...(input.blobPath === undefined ? {} : { blobPath: input.blobPath }),
      ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
      nextAttemptAt: input.nextAttemptAt ?? null,
      processingError: boundedProcessingError(input.processingError),
      processingErrorCategory: input.category,
      processingStatus: input.status,
      updatedAt: new Date()
    })
    .where(eq(billDocuments.id, documentId))
}
