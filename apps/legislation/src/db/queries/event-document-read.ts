import { and, eq } from "drizzle-orm"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { eventDocuments, legislativeEvents } from "../schema/schema.js"

export interface EventDocumentLookup {
  eventDocumentId: string
  meetingId: string
}

export interface EventDocumentRead {
  classification: string
  createdAt: Date
  documentId: null
  id: string
  materialId: null
  meetingId: string
  sourceUrl: string
  title: string
  updatedAt: Date
}

type EventDocumentPersistenceRead = Pick<
  typeof eventDocuments.$inferSelect,
  "classification" | "createdAt" | "eventId" | "id" | "sourceUrl" | "title"
>

/**
 * Reads one event document through its persisted meeting parent. The compound
 * predicate keeps a valid event-document ID from being exposed below another
 * meeting URL.
 */
export function buildEventDocumentReadQuery(database: LegislationDatabase, input: EventDocumentLookup) {
  return database
    .select({
      classification: eventDocuments.classification,
      createdAt: eventDocuments.createdAt,
      eventId: eventDocuments.eventId,
      id: eventDocuments.id,
      sourceUrl: eventDocuments.sourceUrl,
      title: eventDocuments.title
    })
    .from(eventDocuments)
    .innerJoin(legislativeEvents, eq(legislativeEvents.id, eventDocuments.eventId))
    .where(
      and(
        eq(eventDocuments.eventId, requiredId(input.meetingId, "meetingId")),
        eq(eventDocuments.id, requiredId(input.eventDocumentId, "eventDocumentId")),
        eq(legislativeEvents.isDeleted, false)
      )
    )
    .limit(1)
}

export async function getEventDocumentRead(
  database: LegislationDatabase,
  input: EventDocumentLookup
): Promise<EventDocumentRead> {
  const rows = await buildEventDocumentReadQuery(database, input)
  const row = rows[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Event document ${input.eventDocumentId} was not found`)
  }
  return eventDocumentReadFromPersistence(row)
}

export function eventDocumentReadFromPersistence(value: EventDocumentPersistenceRead): EventDocumentRead {
  return {
    classification: requiredText(value.classification, "event document classification"),
    createdAt: value.createdAt,
    documentId: null,
    id: requiredId(value.id, "event document ID"),
    materialId: null,
    meetingId: requiredId(value.eventId, "event document meetingId"),
    sourceUrl: requiredText(value.sourceUrl, "event document sourceUrl"),
    title: requiredText(value.title, "event document title"),
    updatedAt: value.createdAt
  }
}

function requiredId(value: string, field: string): string {
  return requiredText(value, field)
}

function requiredText(value: string | null, field: string): string {
  if (value === null || value.trim().length === 0) {
    throw new LegislationError("unprocessable", `${field} must not be empty`)
  }
  return value
}
