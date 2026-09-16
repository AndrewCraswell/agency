import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { supportingMaterials, supportingMaterialSections } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, eq } from "drizzle-orm"
import type { SupportingMaterialSectionRead } from "../../../request-handling/api/canonical-read.js"

export interface SupportingMaterialSectionLookup {
  materialId: string
  sectionId: string
}

type SupportingMaterialPersistenceRead = Pick<
  typeof supportingMaterials.$inferSelect,
  "createdAt" | "id" | "sourceUpdatedAt" | "sourceUrl" | "updatedAt"
>

type SupportingMaterialSectionPersistenceRead = Pick<
  typeof supportingMaterialSections.$inferSelect,
  "contentHash" | "heading" | "id" | "ordinal" | "pageEnd" | "pageStart" | "text"
>

/**
 * Reads one section only through its persisted material parent. The compound
 * predicate keeps a valid section ID from becoming visible under another
 * material URL.
 */
export function buildSupportingMaterialSectionReadQuery(
  database: LegislationDatabase,
  input: SupportingMaterialSectionLookup
) {
  return database
    .select({
      material: {
        createdAt: supportingMaterials.createdAt,
        id: supportingMaterials.id,
        sourceUpdatedAt: supportingMaterials.sourceUpdatedAt,
        sourceUrl: supportingMaterials.sourceUrl,
        updatedAt: supportingMaterials.updatedAt
      },
      section: {
        contentHash: supportingMaterialSections.contentHash,
        heading: supportingMaterialSections.heading,
        id: supportingMaterialSections.id,
        ordinal: supportingMaterialSections.ordinal,
        pageEnd: supportingMaterialSections.pageEnd,
        pageStart: supportingMaterialSections.pageStart,
        text: supportingMaterialSections.text
      }
    })
    .from(supportingMaterialSections)
    .innerJoin(supportingMaterials, eq(supportingMaterials.id, supportingMaterialSections.materialId))
    .where(
      and(
        eq(supportingMaterialSections.materialId, requiredId(input.materialId, "materialId")),
        eq(supportingMaterialSections.id, requiredId(input.sectionId, "sectionId"))
      )
    )
    .limit(1)
}

export async function getSupportingMaterialSectionRead(
  database: LegislationDatabase,
  input: SupportingMaterialSectionLookup
): Promise<SupportingMaterialSectionRead> {
  const rows = await buildSupportingMaterialSectionReadQuery(database, input)
  const row = rows[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Supporting material section ${input.sectionId} was not found`)
  }
  return supportingMaterialSectionReadFromPersistence(row.material, row.section)
}

export function supportingMaterialSectionReadFromPersistence(
  material: SupportingMaterialPersistenceRead,
  section: SupportingMaterialSectionPersistenceRead
): SupportingMaterialSectionRead {
  validateSectionPages(section.pageStart, section.pageEnd)
  return {
    material: {
      createdAt: material.createdAt,
      id: requiredId(material.id, "supporting material ID"),
      sourceUpdatedAt: material.sourceUpdatedAt,
      sourceUrl: requiredText(material.sourceUrl, "supporting material section sourceUrl"),
      updatedAt: material.updatedAt
    },
    section: {
      contentHash: requiredHash(section.contentHash, "supporting material section contentHash"),
      heading: section.heading,
      id: requiredId(section.id, "supporting material section ID"),
      ordinal: nonnegativeInteger(section.ordinal, "supporting material section ordinal"),
      pageEnd: section.pageEnd,
      pageStart: section.pageStart,
      text: requiredText(section.text, "supporting material section text")
    }
  }
}

function requiredId(value: string, field: string): string {
  return requiredText(value, field)
}

function requiredText(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new LegislationError("unprocessable", `${field} must not be empty`)
  }
  return value
}

function requiredHash(value: string, field: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new LegislationError("unprocessable", `${field} must be a SHA-256 hash`)
  }
  return value
}

function nonnegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new LegislationError("unprocessable", `${field} must be a non-negative integer`)
  }
  return value
}

function validateSectionPages(pageStart: number | null, pageEnd: number | null): void {
  if (pageStart === null && pageEnd === null) {
    return
  }
  if (
    pageStart === null ||
    pageEnd === null ||
    !Number.isSafeInteger(pageStart) ||
    !Number.isSafeInteger(pageEnd) ||
    pageStart < 1 ||
    pageEnd < pageStart
  ) {
    throw new LegislationError("unprocessable", "Supporting material section pages are invalid")
  }
}
