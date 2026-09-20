import { createHash } from "node:crypto"
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm"
import { z } from "zod"
import type { LegislationDatabase } from "../database/database"
import {
  amendmentActions,
  amendments,
  billActions,
  billDocuments,
  billSponsors,
  bills,
  documentSections,
  eventAgendaItems,
  eventBills,
  eventDocuments,
  eventOutcomeLinks,
  eventParticipants,
  legislativeEvents,
  legislativeTerms,
  organizations,
  supportingMaterialLinks,
  supportingMaterials,
  supportingMaterialSections,
  votePositions,
  votes
} from "../database/schema/schema"
import { LegislationError } from "../domain/errors"
import { recordCollectionSchema, type RecordCollectionInput } from "./record-contracts"

const documentBillColumns = {
  id: bills.id,
  identifier: bills.identifier,
  title: bills.title,
  sessionId: bills.sessionId
}

export function readSupportingMaterialLinks(
  database: LegislationDatabase,
  materialId: string,
  limit: number,
  offset = 0
) {
  return database
    .select({
      ...getTableColumns(supportingMaterialLinks),
      billIdentifier: bills.identifier,
      amendmentIdentifier: amendments.printedIdentifier,
      meetingName: legislativeEvents.name,
      organizationName: organizations.name,
      sourceUrl: supportingMaterials.sourceUrl
    })
    .from(supportingMaterialLinks)
    .innerJoin(supportingMaterials, eq(supportingMaterials.id, supportingMaterialLinks.materialId))
    .leftJoin(bills, eq(bills.id, supportingMaterialLinks.billId))
    .leftJoin(amendments, eq(amendments.id, supportingMaterialLinks.amendmentId))
    .leftJoin(legislativeEvents, eq(legislativeEvents.id, supportingMaterialLinks.eventId))
    .leftJoin(organizations, eq(organizations.id, supportingMaterialLinks.organizationId))
    .where(eq(supportingMaterialLinks.materialId, materialId))
    .orderBy(
      asc(supportingMaterialLinks.billId),
      asc(supportingMaterialLinks.amendmentId),
      asc(supportingMaterialLinks.eventId),
      asc(supportingMaterialLinks.organizationId),
      asc(supportingMaterialLinks.classification),
      asc(supportingMaterialLinks.createdAt)
    )
    .limit(limit)
    .offset(offset)
}

export async function readRecordCollection(database: LegislationDatabase, value: RecordCollectionInput) {
  const input = recordCollectionSchema.parse(value)
  const { text: _text, ...documentMetadata } = getTableColumns(billDocuments)
  const selection = Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => key !== "cursor" && value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  )
  const binding = createHash("sha256").update(JSON.stringify(selection)).digest("base64url")
  let offset = 0
  if (input.cursor) {
    try {
      const cursor = z
        .strictObject({ offset: z.number().int().min(0).max(1000000), binding: z.string() })
        .parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString()))
      if (cursor.binding !== binding) throw new Error("Selection mismatch")
      offset = cursor.offset
    } catch {
      throw new LegislationError("invalid_request", "Invalid collection cursor")
    }
  }
  const definitions = {
    "bill-actions": {
      table: billActions,
      parent: billActions.billId,
      order: billActions.ordinal,
      columns: getTableColumns(billActions)
    },
    "bill-sponsors": {
      table: billSponsors,
      parent: billSponsors.billId,
      order: billSponsors.id,
      columns: getTableColumns(billSponsors)
    },
    "person-terms": {
      table: legislativeTerms,
      parent: legislativeTerms.personId,
      order: legislativeTerms.id,
      columns: getTableColumns(legislativeTerms)
    },
    "organization-children": {
      table: organizations,
      parent: organizations.parentOrganizationId,
      order: organizations.id,
      columns: getTableColumns(organizations)
    },
    "meeting-agenda": {
      table: eventAgendaItems,
      parent: eventAgendaItems.eventId,
      order: eventAgendaItems.id,
      columns: getTableColumns(eventAgendaItems)
    },
    "meeting-documents": {
      table: eventDocuments,
      parent: eventDocuments.eventId,
      order: eventDocuments.id,
      columns: getTableColumns(eventDocuments)
    },
    "meeting-participants": {
      table: eventParticipants,
      parent: eventParticipants.eventId,
      order: eventParticipants.id,
      columns: getTableColumns(eventParticipants)
    },
    "meeting-bills": {
      table: eventBills,
      parent: eventBills.eventId,
      order: eventBills.billId,
      columns: getTableColumns(eventBills)
    },
    "meeting-outcomes": {
      table: eventOutcomeLinks,
      parent: eventOutcomeLinks.eventId,
      order: eventOutcomeLinks.id,
      columns: getTableColumns(eventOutcomeLinks)
    },
    "vote-positions": {
      table: votePositions,
      parent: votePositions.voteId,
      order: votePositions.sourceIdentity,
      columns: getTableColumns(votePositions)
    },
    "amendment-actions": {
      table: amendmentActions,
      parent: amendmentActions.amendmentId,
      order: amendmentActions.id,
      columns: getTableColumns(amendmentActions)
    },
    "amendment-votes": { table: votes, parent: votes.amendmentId, order: votes.id, columns: getTableColumns(votes) },
    "amendment-materials": {
      table: supportingMaterialLinks,
      parent: supportingMaterialLinks.amendmentId,
      order: supportingMaterialLinks.materialId,
      columns: getTableColumns(supportingMaterialLinks)
    }
  }
  const isSection = input.collection === "document-sections" || input.collection === "material-sections"
  const limit = input.limit ?? (isSection ? 1 : 25)
  let items: unknown[]
  if (input.collection === "document-sections" || input.collection === "material-sections") {
    const table = input.collection === "document-sections" ? documentSections : supportingMaterialSections
    const parent =
      input.collection === "document-sections" ? documentSections.documentId : supportingMaterialSections.materialId
    const parentTable = input.collection === "document-sections" ? billDocuments : supportingMaterials
    const textOffset = input.textOffset ?? 0
    const { text: _sectionText, searchVector: _searchVector, ...sectionMetadata } = getTableColumns(table)
    const sectionColumns = {
      ...sectionMetadata,
      recordId: parent,
      sectionId: table.id,
      title: parentTable.title,
      sourceUrl: parentTable.sourceUrl,
      documentDate: parentTable.documentDate,
      billId: input.collection === "document-sections" ? billDocuments.billId : sql<string | null>`null`,
      versionCode: input.collection === "document-sections" ? billDocuments.versionCode : sql<string | null>`null`,
      text: sql<string>`substring(${table.text} from ${textOffset + 1} for 10000)`,
      textOffset: sql<number>`${textOffset}::integer`,
      totalCharacters: sql<number>`length(${table.text})`,
      nextTextOffset: sql<
        number | null
      >`case when length(${table.text}) > ${textOffset + 10000} then ${textOffset + 10000}::integer else null end`
    }
    const query =
      input.collection === "document-sections"
        ? database
            .select({ ...sectionColumns, classification: billDocuments.classification, bill: documentBillColumns })
            .from(table)
            .innerJoin(parentTable, eq(parentTable.id, parent))
            .innerJoin(bills, eq(bills.id, billDocuments.billId))
        : database.select(sectionColumns).from(table).innerJoin(parentTable, eq(parentTable.id, parent))
    items = await query
      .where(and(eq(parent, input.recordId), input.sectionId ? eq(table.id, input.sectionId) : undefined))
      .orderBy(asc(table.ordinal), asc(table.id))
      .limit(limit + 1)
      .offset(offset)
  } else if (input.collection === "bill-documents") {
    items = await database
      .select({ ...documentMetadata, bill: documentBillColumns })
      .from(billDocuments)
      .innerJoin(bills, eq(bills.id, billDocuments.billId))
      .where(eq(billDocuments.billId, input.recordId))
      .orderBy(asc(billDocuments.id))
      .limit(limit + 1)
      .offset(offset)
  } else if (input.collection === "material-links") {
    items = await readSupportingMaterialLinks(database, input.recordId, limit + 1, offset)
  } else {
    const definition = definitions[input.collection]
    items = await database
      .select(definition.columns)
      .from(definition.table)
      .where(eq(definition.parent, input.recordId))
      .orderBy(asc(definition.order))
      .limit(limit + 1)
      .offset(offset)
  }
  return {
    collection: input.collection,
    recordId: input.recordId,
    items: items.slice(0, limit),
    nextCursor:
      items.length > limit
        ? Buffer.from(JSON.stringify({ offset: offset + limit, binding })).toString("base64url")
        : undefined,
    truncated: items.length > limit
  }
}
