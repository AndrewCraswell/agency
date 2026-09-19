import type { billDocuments } from "@repo/legislation-core/database/schema/schema"

type DocumentInsert = typeof billDocuments.$inferInsert

/** Metadata refreshes do not own processing results or retry state. */
export function prepareBillDocument(input: DocumentInsert, existing?: DocumentInsert): DocumentInsert {
  const document = existing
    ? {
        ...input,
        id: existing.id,
        blobPath: existing.blobPath,
        contentHash: existing.contentHash,
        text: existing.text,
        pageCount: existing.pageCount,
        ocrStatus: existing.ocrStatus,
        ocrProvider: existing.ocrProvider,
        ocrCompletedAt: existing.ocrCompletedAt,
        ocrPageCount: existing.ocrPageCount,
        lastAttemptAt: existing.lastAttemptAt,
        nextAttemptAt: existing.nextAttemptAt,
        processingAttempts: existing.processingAttempts,
        processingError: existing.processingError,
        processingErrorCategory: existing.processingErrorCategory,
        processingStatus: existing.processingStatus
      }
    : { ...input }
  // Pending means not assessed yet, never evidence that OCR was unnecessary.
  if (document.ocrStatus == null && (document.processingStatus ?? "pending") === "pending") {
    document.ocrStatus = "pending"
  }
  return document
}
