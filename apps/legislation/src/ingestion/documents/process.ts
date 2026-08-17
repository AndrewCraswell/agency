import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments, documentSections } from "../../db/schema/schema.js"
import { extractDocument, sanitizeDatabaseText } from "./extract.js"

export function isTerminalDocumentFailure(message: string): boolean {
  return [
    "Document download failed with HTTP 404",
    "Document exceeds the",
    "Document is empty",
    "Document produced no usable text",
    "Unsupported",
    "image-only"
  ].some((marker) => message.includes(marker))
}

export function boundedProcessingError(value: string): string {
  return sanitizeDatabaseText(value).replaceAll(/\s+/g, " ").trim().slice(0, 1000)
}

export async function persistProcessedDocument(
  database: LegislationDatabase,
  input: { bytes: Uint8Array; contentType: string; documentId: string }
): Promise<"processed" | "unchanged"> {
  const extraction = await extractDocument(input.documentId, input.bytes, input.contentType)
  const existing = await database
    .select({ contentHash: billDocuments.contentHash, processingStatus: billDocuments.processingStatus })
    .from(billDocuments)
    .where(eq(billDocuments.id, input.documentId))
    .limit(1)
  if (existing[0]?.contentHash === extraction.contentHash && existing[0].processingStatus === "processed") {
    return "unchanged"
  }

  await database.transaction(async (transaction) => {
    await transaction
      .update(billDocuments)
      .set({
        contentHash: extraction.contentHash,
        contentType: input.contentType,
        processingError: null,
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
  status: "failed" | "unsupported",
  processingError?: string
): Promise<void> {
  await database
    .update(billDocuments)
    .set({
      processingError: processingError === undefined ? undefined : boundedProcessingError(processingError),
      processingStatus: status,
      updatedAt: new Date()
    })
    .where(eq(billDocuments.id, documentId))
}
