import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { eventOrganizations, eventSessions, legislativeEvents } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type MeetingSort = "starts-asc" | "starts-desc" | "updated-desc"

export interface MeetingListInput {
  classification?: "hearing" | "meeting" | "other" | "session"
  cursor?: string
  from?: string
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  sessionId?: string
  sort?: MeetingSort
  status?: "cancelled" | "completed" | "other" | "postponed" | "scheduled"
  to?: string
}

export type MeetingPersistenceRead = Pick<
  typeof legislativeEvents.$inferSelect,
  | "classification"
  | "description"
  | "endAt"
  | "id"
  | "isRemote"
  | "jurisdictionId"
  | "location"
  | "name"
  | "publisherLocalDate"
  | "sourceIsOfficial"
  | "sourceProvider"
  | "sourceRetrievedAt"
  | "sourceSequence"
  | "sourceUpdatedAt"
  | "sourceUrl"
  | "startAt"
  | "status"
  | "updatedAt"
  | "virtualAccess"
>

export interface MeetingRead extends MeetingPersistenceRead {
  organizationIds: string[]
  sessionIds: string[]
}

export interface MeetingPage {
  items: MeetingRead[]
  nextCursor?: string
  truncated: boolean
}

type MeetingCursorScope = {
  classification: MeetingListInput["classification"] | null
  from: string | null
  jurisdictionId: string | null
  organizationId: string | null
  sessionId: string | null
  sort: MeetingSort
  status: MeetingListInput["status"] | null
  to: string | null
}

type MeetingCursor = { id: string; scope: MeetingCursorScope; sortValue: string; sourceSequence: number; version: 1 }

/** Returns only source-complete meetings. Legacy event JSON never satisfies this predicate. */
export function buildMeetingListQuery(database: LegislationDatabase, input: MeetingListInput) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const sortColumn = scope.sort === "updated-desc" ? legislativeEvents.updatedAt : legislativeEvents.startAt
  const sourceSequence = sourceSequenceSort()
  return database
    .select({
      classification: legislativeEvents.classification,
      description: legislativeEvents.description,
      endAt: legislativeEvents.endAt,
      id: legislativeEvents.id,
      isRemote: legislativeEvents.isRemote,
      jurisdictionId: legislativeEvents.jurisdictionId,
      location: legislativeEvents.location,
      name: legislativeEvents.name,
      publisherLocalDate: legislativeEvents.publisherLocalDate,
      sourceIsOfficial: legislativeEvents.sourceIsOfficial,
      sourceProvider: legislativeEvents.sourceProvider,
      sourceRetrievedAt: legislativeEvents.sourceRetrievedAt,
      sourceSequence: legislativeEvents.sourceSequence,
      sourceUpdatedAt: legislativeEvents.sourceUpdatedAt,
      sourceUrl: legislativeEvents.sourceUrl,
      startAt: legislativeEvents.startAt,
      status: legislativeEvents.status,
      updatedAt: legislativeEvents.updatedAt,
      virtualAccess: legislativeEvents.virtualAccess
    })
    .from(legislativeEvents)
    .where(and(...meetingVisibility(scope), cursorPredicate(cursor, scope, sortColumn, sourceSequence)))
    .orderBy(
      scope.sort === "starts-asc" ? asc(sortColumn) : desc(sortColumn),
      ...(scope.sort === "updated-desc" ? [] : [asc(sourceSequence)]),
      asc(legislativeEvents.id)
    )
    .limit(limit + 1)
}

export async function listMeetings(database: LegislationDatabase, input: MeetingListInput): Promise<MeetingPage> {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const rows = await buildMeetingListQuery(database, input)
  const visible = rows.slice(0, limit)
  const relations = await relationIds(
    database,
    visible.map((row) => row.id)
  )
  const items = visible.map((row) => ({
    ...row,
    organizationIds: relations.organizations.get(row.id) ?? [],
    sessionIds: relations.sessions.get(row.id) ?? []
  }))
  const last = visible.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last, scope) : undefined,
    truncated: rows.length > limit
  }
}

function meetingVisibility(scope: MeetingCursorScope): [SQL, ...SQL[]] {
  return [
    eq(legislativeEvents.isDeleted, false),
    eq(legislativeEvents.canonicalFactsComplete, true),
    eq(legislativeEvents.sessionRelationsComplete, true),
    eq(legislativeEvents.organizationRelationsComplete, true),
    eq(legislativeEvents.provenanceComplete, true),
    scope.jurisdictionId === null ? undefined : eq(legislativeEvents.jurisdictionId, scope.jurisdictionId),
    scope.classification === null ? undefined : sql`${legislativeEvents.classification} = ${scope.classification}`,
    scope.status === null ? undefined : sql`${legislativeEvents.status} = ${scope.status}`,
    scope.from === null ? undefined : gte(legislativeEvents.publisherLocalDate, scope.from),
    scope.to === null ? undefined : lte(legislativeEvents.publisherLocalDate, scope.to),
    scope.organizationId === null
      ? undefined
      : sql`exists (select 1 from ${eventOrganizations} where ${eventOrganizations.eventId} = ${legislativeEvents.id} and ${eventOrganizations.organizationId} = ${scope.organizationId})`,
    scope.sessionId === null
      ? undefined
      : sql`exists (select 1 from ${eventSessions} where ${eventSessions.eventId} = ${legislativeEvents.id} and ${eventSessions.sessionId} = ${scope.sessionId})`
  ].filter((value): value is SQL => value !== undefined) as [SQL, ...SQL[]]
}

function cursorPredicate(
  cursor: MeetingCursor | undefined,
  scope: MeetingCursorScope,
  sortColumn: typeof legislativeEvents.startAt | typeof legislativeEvents.updatedAt,
  sourceSequence: SQL<number>
): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const value = new Date(cursor.sortValue)
  if (scope.sort === "starts-asc") {
    return or(
      gt(sortColumn, value),
      and(eq(sortColumn, value), gt(sourceSequence, cursor.sourceSequence)),
      and(eq(sortColumn, value), eq(sourceSequence, cursor.sourceSequence), gt(legislativeEvents.id, cursor.id))
    )
  }
  if (scope.sort === "starts-desc") {
    return or(
      lt(sortColumn, value),
      and(eq(sortColumn, value), gt(sourceSequence, cursor.sourceSequence)),
      and(eq(sortColumn, value), eq(sourceSequence, cursor.sourceSequence), gt(legislativeEvents.id, cursor.id))
    )
  }
  return or(lt(sortColumn, value), and(eq(sortColumn, value), gt(legislativeEvents.id, cursor.id)))
}

function sourceSequenceSort(): SQL<number> {
  return sql<number>`coalesce(${legislativeEvents.sourceSequence}, 2147483647)`
}

async function relationIds(database: LegislationDatabase, eventIds: readonly string[]) {
  const sessions = new Map<string, string[]>(eventIds.map((id) => [id, []]))
  const organizations = new Map<string, string[]>(eventIds.map((id) => [id, []]))
  if (eventIds.length === 0) {
    return { organizations, sessions }
  }
  const [sessionRows, organizationRows] = await Promise.all([
    database
      .select({ eventId: eventSessions.eventId, sessionId: eventSessions.sessionId })
      .from(eventSessions)
      .where(inArray(eventSessions.eventId, eventIds))
      .orderBy(asc(eventSessions.sessionId)),
    database
      .select({ eventId: eventOrganizations.eventId, organizationId: eventOrganizations.organizationId })
      .from(eventOrganizations)
      .where(inArray(eventOrganizations.eventId, eventIds))
      .orderBy(asc(eventOrganizations.organizationId))
  ])
  for (const row of sessionRows) {
    sessions.get(row.eventId)?.push(row.sessionId)
  }
  for (const row of organizationRows) {
    organizations.get(row.eventId)?.push(row.organizationId)
  }
  return { organizations, sessions }
}

function cursorScope(input: MeetingListInput): MeetingCursorScope {
  const from = input.from === undefined ? null : isoDate(input.from, "from")
  const to = input.to === undefined ? null : isoDate(input.to, "to")
  if (from !== null && to !== null && from > to) {
    throw new LegislationError("invalid_request", "from must not be after to")
  }
  return {
    classification: input.classification ?? null,
    from,
    jurisdictionId: optionalId(input.jurisdictionId, "jurisdictionId"),
    organizationId: optionalId(input.organizationId, "organizationId"),
    sessionId: optionalId(input.sessionId, "sessionId"),
    sort: input.sort ?? "starts-asc",
    status: input.status ?? null,
    to
  }
}

function encodeCursor(row: MeetingPersistenceRead, scope: MeetingCursorScope): string {
  const value = scope.sort === "updated-desc" ? row.updatedAt : row.startAt
  return Buffer.from(
    JSON.stringify({
      id: row.id,
      scope,
      sortValue: value.toISOString(),
      sourceSequence: row.sourceSequence ?? 2_147_483_647,
      version: 1
    } satisfies MeetingCursor)
  ).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: MeetingCursorScope): MeetingCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4096) {
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

function isCursor(value: unknown): value is MeetingCursor {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.get(value, "version") === 1 &&
    typeof Reflect.get(value, "id") === "string" &&
    typeof Reflect.get(value, "sortValue") === "string" &&
    Number.isSafeInteger(Reflect.get(value, "sourceSequence")) &&
    (Reflect.get(value, "sourceSequence") as number) >= 0 &&
    !Number.isNaN(new Date(Reflect.get(value, "sortValue") as string).valueOf()) &&
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
  if (value === undefined) {
    return null
  }
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}

function isoDate(value: string, name: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date`)
  }
  return value
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid meeting pagination cursor")
}
