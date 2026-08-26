import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { supportingMaterials, supportingMaterialSections } from "../../db/schema/schema.js"
import { extractDocument } from "./extract.js"
import { mapOcrPagesToDocumentSections, type OcrPageSpan } from "./ocr-page-mapping.js"
import { boundedProcessingError, type DocumentFailureCategory } from "./process.js"

export async function persistProcessedSupportingMaterial(
  database: LegislationDatabase,
  input: { bytes: Uint8Array; contentType: string; materialId: string }
): Promise<"processed" | "unchanged"> {
  const extraction = await extractDocument(input.materialId, input.bytes, input.contentType)
  const existing = await database
    .select({ contentHash: supportingMaterials.contentHash, processingStatus: supportingMaterials.processingStatus })
    .from(supportingMaterials)
    .where(eq(supportingMaterials.id, input.materialId))
    .limit(1)
  if (existing[0]?.contentHash === extraction.contentHash && existing[0].processingStatus === "processed") {
    return "unchanged"
  }

  await persistSupportingMaterialExtraction(database, {
    contentType: input.contentType,
    extraction,
    materialId: input.materialId
  })
  return "processed"
}

export async function persistOcrSupportingMaterial(
  database: LegislationDatabase,
  input: {
    blobPath: string
    contentType: string
    materialId: string
    pages?: readonly OcrPageSpan[]
    sourceBytes: Uint8Array
    text: string
  }
): Promise<void> {
  const extractedText = await extractDocument(input.materialId, new TextEncoder().encode(input.text), "text/plain")
  const pageRanges =
    input.pages === undefined
      ? new Map()
      : mapOcrPagesToDocumentSections(input.text, extractedText.text, extractedText.sections, input.pages)
  await persistSupportingMaterialExtraction(database, {
    blobPath: input.blobPath,
    contentType: input.contentType,
    extraction: {
      ...extractedText,
      contentHash: createHash("sha256").update(input.sourceBytes).digest("hex")
    },
    materialId: input.materialId,
    pageRanges
  })
}

async function persistSupportingMaterialExtraction(
  database: LegislationDatabase,
  input: {
    blobPath?: string
    contentType: string
    extraction: Awaited<ReturnType<typeof extractDocument>>
    materialId: string
    pageRanges?: ReadonlyMap<string, Readonly<{ pageEnd: number; pageStart: number }>>
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction
      .update(supportingMaterials)
      .set({
        ...(input.blobPath === undefined ? {} : { blobPath: input.blobPath }),
        contentHash: input.extraction.contentHash,
        contentType: input.contentType,
        nextAttemptAt: null,
        processingError: null,
        processingErrorCategory: null,
        processingStatus: "processed",
        text: input.extraction.text,
        updatedAt: new Date()
      })
      .where(eq(supportingMaterials.id, input.materialId))
    await transaction
      .delete(supportingMaterialSections)
      .where(eq(supportingMaterialSections.materialId, input.materialId))
    if (input.extraction.sections.length > 0) {
      await transaction.insert(supportingMaterialSections).values(
        input.extraction.sections.map((section) => ({
          contentHash: section.contentHash,
          heading: section.heading,
          id: section.id,
          materialId: input.materialId,
          ordinal: section.ordinal,
          ...input.pageRanges?.get(section.id),
          sectionIdentifier: section.identifier,
          sourceEndOffset: section.endOffset,
          sourceStartOffset: section.startOffset,
          text: section.text
        }))
      )
    }
  })
}

export async function markSupportingMaterialProcessingFailure(
  database: LegislationDatabase,
  materialId: string,
  input: Readonly<{
    category: DocumentFailureCategory
    nextAttemptAt?: Date
    processingError: string
    status: "failed" | "unsupported"
  }>
): Promise<void> {
  await database
    .update(supportingMaterials)
    .set({
      processingError: boundedProcessingError(input.processingError),
      processingErrorCategory: input.category,
      nextAttemptAt: input.nextAttemptAt ?? null,
      processingStatus: input.status,
      updatedAt: new Date()
    })
    .where(eq(supportingMaterials.id, materialId))
}
