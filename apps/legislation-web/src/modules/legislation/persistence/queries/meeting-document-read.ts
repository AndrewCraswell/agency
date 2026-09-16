import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { eventDocuments, legislativeEvents } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, eq, gt, or, type SQL } from "drizzle-orm"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface MeetingDocumentListInput {
  classification?: string
  cursor?: string
  limit?: number
  meetingId: string
}

export interface MeetingDocumentPage<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

/**
 * Event-document rows have no persisted bill-document or supporting-material
 * relationship. Those nullable public fields remain null until a source model
 * supplies an explicit link.
 */
export interface MeetingDocumentRead {
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

type MeetingDocumentPersistenceRead = Pick<
  typeof eventDocuments.$inferSelect,
  "classification" | "createdAt" | "eventId" | "id" | "sourceUrl" | "title"
>

type MeetingDocumentCursorScope = {
  classification: string | null
  meetingId: string
}

type MeetingDocumentCursor = {
  classification: string
  id: string
  scope: MeetingDocumentCursorScope
  title: string
  version: 1
}

/** A deleted meeting is not a public parent, even if its child rows remain. */
export function buildMeetingExistenceQuery(database: LegislationDatabase, meetingId: string) {
  return database
    .select({ id: legislativeEvents.id })
    .from(legislativeEvents)
    .where(
      and(eq(legislativeEvents.id, requiredInputText(meetingId, "meetingId")), eq(legislativeEvents.isDeleted, false))
    )
    .limit(1)
}

export async function assertMeetingExists(database: LegislationDatabase, meetingId: string): Promise<void> {
  if ((await buildMeetingExistenceQuery(database, meetingId))[0] === undefined) {
    throw new LegislationError("not_found", `Meeting ${meetingId} was not found`)
  }
}

export function buildMeetingDocumentListQuery(database: LegislationDatabase, input: MeetingDocumentListInput) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)

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
        eq(eventDocuments.eventId, scope.meetingId),
        eq(legislativeEvents.isDeleted, false),
        scope.classification === null ? undefined : eq(eventDocuments.classification, scope.classification),
        cursorPredicate(cursor)
      )
    )
    .orderBy(asc(eventDocuments.classification), asc(eventDocuments.title), asc(eventDocuments.id))
    .limit(limit + 1)
}

export async function listMeetingDocuments(
  database: LegislationDatabase,
  input: MeetingDocumentListInput
): Promise<MeetingDocumentPage<MeetingDocumentRead>> {
  const limit = parseLimit(input.limit)
  const rows = await buildMeetingDocumentListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit).map(meetingDocumentReadFromPersistence)
  const last = rows.at(Math.min(rows.length, limit) - 1)
  return {
    items,
    nextCursor: truncated && last !== undefined ? encodeCursor(last, cursorScope(input)) : undefined,
    truncated
  }
}

export function meetingDocumentReadFromPersistence(value: MeetingDocumentPersistenceRead): MeetingDocumentRead {
  return {
    classification: requiredText(value.classification, "event document classification"),
    createdAt: value.createdAt,
    documentId: null,
    id: requiredText(value.id, "event document ID"),
    materialId: null,
    meetingId: requiredText(value.eventId, "event document meetingId"),
    sourceUrl: requiredText(value.sourceUrl, "event document sourceUrl"),
    title: requiredText(value.title, "event document title"),
    updatedAt: value.createdAt
  }
}

function cursorScope(input: MeetingDocumentListInput): MeetingDocumentCursorScope {
  return {
    classification:
      input.classification === undefined ? null : requiredInputText(input.classification, "classification"),
    meetingId: requiredInputText(input.meetingId, "meetingId")
  }
}

function cursorPredicate(cursor: MeetingDocumentCursor | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  return or(
    gt(eventDocuments.classification, cursor.classification),
    and(eq(eventDocuments.classification, cursor.classification), gt(eventDocuments.title, cursor.title)),
    and(
      eq(eventDocuments.classification, cursor.classification),
      eq(eventDocuments.title, cursor.title),
      gt(eventDocuments.id, cursor.id)
    )
  )
}

function encodeCursor(row: MeetingDocumentPersistenceRead, scope: MeetingDocumentCursorScope): string {
  return Buffer.from(
    JSON.stringify({
      classification: requiredText(row.classification, "event document classification"),
      id: requiredText(row.id, "event document ID"),
      scope,
      title: requiredText(row.title, "event document title"),
      version: 1
    } satisfies MeetingDocumentCursor)
  ).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: MeetingDocumentCursorScope): MeetingDocumentCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4096) {
    throw invalidCursor()
  }
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      !isCursor(decoded) ||
      decoded.scope.meetingId !== scope.meetingId ||
      decoded.scope.classification !== scope.classification
    ) {
      throw invalidCursor()
    }
    return decoded
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw invalidCursor()
  }
}

function isCursor(value: unknown): value is MeetingDocumentCursor {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.scope)) {
    return false
  }
  return (
    isNonemptyString(value.classification) &&
    isNonemptyString(value.id) &&
    isNonemptyString(value.title) &&
    isNonemptyString(value.scope.meetingId) &&
    (value.scope.classification === null || isNonemptyString(value.scope.classification))
  )
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}

function requiredText(value: string | null, name: string): string {
  if (!isNonemptyString(value)) {
    throw new LegislationError("unprocessable", `${name} must not be empty`)
  }
  return value
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid meeting document pagination cursor")
}
