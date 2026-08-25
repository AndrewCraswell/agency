import { and, asc, eq, gt, ilike, or } from "drizzle-orm"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { calendars } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface CalendarListInput {
  classification?: string
  cursor?: string
  isActive?: boolean
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  query?: string
}

export interface CalendarPage<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

export type CalendarRow = typeof calendars.$inferSelect

type CalendarCursorScope = {
  classification: string | null
  isActive: boolean | null
  jurisdictionId: string | null
  organizationId: string | null
  query: string | null
}

type CalendarCursor = { id: string; name: string; scope: CalendarCursorScope; version: 1 }

export function buildCalendarListQuery(database: LegislationDatabase, input: CalendarListInput = {}) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const cursorPredicate =
    cursor === undefined
      ? undefined
      : or(gt(calendars.name, cursor.name), and(eq(calendars.name, cursor.name), gt(calendars.id, cursor.id)))
  return database
    .select()
    .from(calendars)
    .where(
      and(
        scope.jurisdictionId === null ? undefined : eq(calendars.jurisdictionId, scope.jurisdictionId),
        scope.organizationId === null ? undefined : eq(calendars.organizationId, scope.organizationId),
        scope.classification === null ? undefined : eq(calendars.classification, scope.classification),
        scope.isActive === null ? undefined : eq(calendars.isActive, scope.isActive),
        scope.query === null ? undefined : ilike(calendars.name, `%${scope.query}%`),
        cursorPredicate
      )
    )
    .orderBy(asc(calendars.name), asc(calendars.id))
    .limit(limit + 1)
}

export async function listCalendars(
  database: LegislationDatabase,
  input: CalendarListInput = {}
): Promise<CalendarPage<CalendarRow>> {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const rows = await buildCalendarListQuery(database, input)
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last, scope) : undefined,
    truncated: rows.length > limit
  }
}

export async function getCalendarRead(database: LegislationDatabase, calendarId: string): Promise<CalendarRow> {
  const id = requiredId(calendarId, "calendarId")
  const rows = await database.select().from(calendars).where(eq(calendars.id, id)).limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Calendar ${id} was not found`)
  }
  return row
}

export async function assertCalendarExists(database: LegislationDatabase, calendarId: string): Promise<void> {
  await getCalendarRead(database, calendarId)
}

function cursorScope(input: CalendarListInput): CalendarCursorScope {
  return {
    classification: optionalText(input.classification, "classification", 256),
    isActive: input.isActive ?? null,
    jurisdictionId: optionalId(input.jurisdictionId, "jurisdictionId"),
    organizationId: optionalId(input.organizationId, "organizationId"),
    query: optionalText(input.query, "q", 500)
  }
}

function encodeCursor(row: CalendarRow, scope: CalendarCursorScope): string {
  return Buffer.from(
    JSON.stringify({ id: row.id, name: row.name, scope, version: 1 } satisfies CalendarCursor)
  ).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: CalendarCursorScope): CalendarCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4_096) {
    throw invalidCursor()
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (!isCursor(parsed) || JSON.stringify(parsed.scope) !== JSON.stringify(scope)) {
      throw invalidCursor()
    }
    return parsed
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw invalidCursor()
  }
}

function isCursor(value: unknown): value is CalendarCursor {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.get(value, "version") === 1 &&
    typeof Reflect.get(value, "id") === "string" &&
    typeof Reflect.get(value, "name") === "string" &&
    typeof Reflect.get(value, "scope") === "object"
  )
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function optionalId(value: string | undefined, name: string): string | null {
  return value === undefined ? null : requiredId(value, name)
}

function requiredId(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}

function optionalText(value: string | undefined, name: string, maximum: number): string | null {
  if (value === undefined) {
    return null
  }
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximum} characters`)
  }
  return normalized
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid calendar pagination cursor")
}
