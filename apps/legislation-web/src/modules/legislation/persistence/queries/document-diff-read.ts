import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { billDocuments, documentSections } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { asc, inArray } from "drizzle-orm"
import { documentReadFromPersistence, type CanonicalDocumentRead } from "./document-reads"

export interface DocumentDiffRead {
  left: { document: CanonicalDocumentRead; sections: Array<typeof documentSections.$inferSelect> }
  right: { document: CanonicalDocumentRead; sections: Array<typeof documentSections.$inferSelect> }
}

export async function readDocumentDiff(
  database: LegislationDatabase,
  input: Readonly<{ billId: string; leftDocumentId: string; rightDocumentId: string }>
): Promise<DocumentDiffRead> {
  const documents = await database
    .select()
    .from(billDocuments)
    .where(inArray(billDocuments.id, [input.leftDocumentId, input.rightDocumentId]))
  if (documents.length !== 2) {
    throw new LegislationError("not_found", "One or both documents were not found")
  }
  const byId = new Map(documents.map((document) => [document.id, document]))
  const left = byId.get(input.leftDocumentId)
  const right = byId.get(input.rightDocumentId)
  if (left === undefined || right === undefined) {
    throw new LegislationError("not_found", "One or both documents were not found")
  }
  if (left.billId !== input.billId || right.billId !== input.billId) {
    throw new LegislationError("conflict", "Both documents must belong to the requested bill")
  }
  if (left.processingStatus !== "processed" || right.processingStatus !== "processed") {
    throw new LegislationError("conflict", "Both documents must have processed text before they can be compared")
  }
  const sections = await database
    .select()
    .from(documentSections)
    .where(inArray(documentSections.documentId, [left.id, right.id]))
    .orderBy(asc(documentSections.documentId), asc(documentSections.ordinal), asc(documentSections.id))
  return {
    left: {
      document: documentReadFromPersistence(left),
      sections: sections.filter((section) => section.documentId === left.id)
    },
    right: {
      document: documentReadFromPersistence(right),
      sections: sections.filter((section) => section.documentId === right.id)
    }
  }
}
