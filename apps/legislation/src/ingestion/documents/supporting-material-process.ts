import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { supportingMaterials, supportingMaterialSections } from "../../db/schema/schema.js"
import { extractDocument } from "./extract.js"
import { boundedProcessingError } from "./process.js"

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

  await database.transaction(async (transaction) => {
    await transaction
      .update(supportingMaterials)
      .set({
        contentHash: extraction.contentHash,
        contentType: input.contentType,
        processingError: null,
        processingStatus: "processed",
        text: extraction.text,
        updatedAt: new Date()
      })
      .where(eq(supportingMaterials.id, input.materialId))
    await transaction
      .delete(supportingMaterialSections)
      .where(eq(supportingMaterialSections.materialId, input.materialId))
    if (extraction.sections.length > 0) {
      await transaction.insert(supportingMaterialSections).values(
        extraction.sections.map((section) => ({
          contentHash: section.contentHash,
          heading: section.heading,
          id: section.id,
          materialId: input.materialId,
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

export async function markSupportingMaterialProcessingFailure(
  database: LegislationDatabase,
  materialId: string,
  status: "failed" | "unsupported",
  processingError?: string
): Promise<void> {
  await database
    .update(supportingMaterials)
    .set({
      processingError: processingError === undefined ? undefined : boundedProcessingError(processingError),
      processingStatus: status,
      updatedAt: new Date()
    })
    .where(eq(supportingMaterials.id, materialId))
}
