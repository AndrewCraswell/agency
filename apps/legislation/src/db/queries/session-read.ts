import { and, asc, desc, eq, gt, gte, lt, lte, or, sql, type SQL } from "drizzle-orm"
import { isIsoDate } from "../../api/canonical-projection.js"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { legislativeSessions } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface JurisdictionSessionListInput {
  cursor?: string
  from?: string
  isActive?: boolean
  jurisdictionId: string
  limit?: number
  to?: string
}

export type SessionRead = typeof legislativeSessions.$inferSelect

export interface SessionPage {
  items: SessionRead[]
  nextCursor?: string
  truncated: boolean
}

type SessionCursorScope = {
  from: string | null
  isActive: boolean | null
  jurisdictionId: string
  to: string | null
}

type SessionCursor = {
  id: string
  name: string
  scope: SessionCursorScope
  startDate: string
  version: 1
}

/** Lists sessions in the documented jurisdiction scope using complete keyset state. */
export function buildJurisdictionSessionListQuery(database: LegislationDatabase, input: JurisdictionSessionListInput) {
  const limit = parseLimit(input.limit)
  validateDateRange(input.from, input.to)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const startDate = sessionStartDateSort()

  return database
    .select()
    .from(legislativeSessions)
    .where(
      and(
        eq(legislativeSessions.jurisdictionId, scope.jurisdictionId),
        input.isActive === undefined ? undefined : eq(legislativeSessions.isActive, input.isActive),
        input.from === undefined ? undefined : gte(sessionEndDateSort(), input.from),
        input.to === undefined ? undefined : lte(sessionStartDateSort(), input.to),
        cursorPredicate(cursor, startDate)
      )
    )
    .orderBy(desc(startDate), asc(legislativeSessions.name), asc(legislativeSessions.id))
    .limit(limit + 1)
}

export async function listJurisdictionSessions(
  database: LegislationDatabase,
  input: JurisdictionSessionListInput
): Promise<SessionPage> {
  const limit = parseLimit(input.limit)
  const rows = await buildJurisdictionSessionListQuery(database, input)
  const items = rows.slice(0, limit)
  const truncated = rows.length > limit
  const last = items.at(-1)
  return {
    items,
    nextCursor: truncated && last !== undefined ? encodeCursor(last, cursorScope(input)) : undefined,
    truncated
  }
}

export function buildSessionLookupQuery(database: LegislationDatabase, sessionId: string) {
  return database
    .select()
    .from(legislativeSessions)
    .where(eq(legislativeSessions.id, requiredInputText(sessionId, "sessionId")))
    .limit(1)
}

export async function getSession(database: LegislationDatabase, sessionId: string): Promise<SessionRead | undefined> {
  return (await buildSessionLookupQuery(database, sessionId))[0]
}

function sessionStartDateSort(): SQL<string> {
  return sql<string>`coalesce(${legislativeSessions.startDate}, '0001-01-01'::date)`
}

function sessionEndDateSort(): SQL<string> {
  return sql<string>`coalesce(${legislativeSessions.endDate}, '9999-12-31'::date)`
}

function cursorPredicate(cursor: SessionCursor | undefined, startDate: SQL<string>): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  return or(
    lt(startDate, cursor.startDate),
    and(eq(startDate, cursor.startDate), gt(legislativeSessions.name, cursor.name)),
    and(
      eq(startDate, cursor.startDate),
      eq(legislativeSessions.name, cursor.name),
      gt(legislativeSessions.id, cursor.id)
    )
  )
}

function cursorScope(input: JurisdictionSessionListInput): SessionCursorScope {
  return {
    from: input.from === undefined ? null : requiredDate(input.from, "from"),
    isActive: input.isActive ?? null,
    jurisdictionId: requiredInputText(input.jurisdictionId, "jurisdictionId"),
    to: input.to === undefined ? null : requiredDate(input.to, "to")
  }
}

function encodeCursor(row: SessionRead, scope: SessionCursorScope): string {
  return Buffer.from(
    JSON.stringify({
      id: requiredText(row.id, "session ID"),
      name: requiredText(row.name, "session name"),
      scope,
      startDate: sessionStartDateValue(row.startDate),
      version: 1
    } satisfies SessionCursor)
  ).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: SessionCursorScope): SessionCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4_096) {
    throw invalidCursor()
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      !isCursor(parsed) ||
      parsed.scope.jurisdictionId !== scope.jurisdictionId ||
      parsed.scope.from !== scope.from ||
      parsed.scope.to !== scope.to ||
      parsed.scope.isActive !== scope.isActive
    ) {
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

function isCursor(value: unknown): value is SessionCursor {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.scope)) {
    return false
  }
  return (
    isNonemptyString(value.id) &&
    isNonemptyString(value.name) &&
    isIsoDate(value.startDate) &&
    isNonemptyString(value.scope.jurisdictionId) &&
    (value.scope.from === null || isIsoDate(value.scope.from)) &&
    (value.scope.to === null || isIsoDate(value.scope.to)) &&
    (value.scope.isActive === null || typeof value.scope.isActive === "boolean")
  )
}

function sessionStartDateValue(value: string | null): string {
  return value === null ? "0001-01-01" : requiredDate(value, "session startDate")
}

function validateDateRange(from: string | undefined, to: string | undefined): void {
  const normalizedFrom = from === undefined ? undefined : requiredDate(from, "from")
  const normalizedTo = to === undefined ? undefined : requiredDate(to, "to")
  if (normalizedFrom !== undefined && normalizedTo !== undefined && normalizedFrom > normalizedTo) {
    throw new LegislationError("invalid_request", "from must not be after to")
  }
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredDate(value: string, name: string): string {
  if (!isIsoDate(value)) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date`)
  }
  return value
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
    throw new LegislationError("unprocessable", `${name} must be non-empty`)
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
  return new LegislationError("invalid_request", "Invalid session pagination cursor")
}
