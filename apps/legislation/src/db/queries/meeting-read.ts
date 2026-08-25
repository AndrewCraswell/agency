import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm"
import { isIsoDate, isRfc3339Timestamp } from "../../api/canonical-projection.js"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import {
  calendarEvents,
  eventBills,
  eventOrganizations,
  eventSessions,
  legislativeEvents,
  organizations
} from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type MeetingSort = "starts-asc" | "starts-desc" | "updated-desc"

export interface MeetingListInput {
  billId?: string
  calendarId?: string
  classification?: "hearing" | "meeting" | "other" | "session"
  classifications?: readonly ("hearing" | "meeting" | "other" | "session")[]
  cursor?: string
  from?: string
  jurisdictionId?: string
  jurisdictionIds?: readonly string[]
  isRemote?: boolean
  limit?: number
  /** Internal singular lookup constraint; public callers use the path route. */
  meetingId?: string
  organizationId?: string
  organizationIds?: readonly string[]
  /** Internal lexical name constraint used by universal search. */
  query?: string
  /** Internal calendar-local date boundary timezone; public callers use the calendar route. */
  dateTimezone?: string | null
  sessionId?: string
  sessionIds?: readonly string[]
  sort?: MeetingSort
  status?: "cancelled" | "completed" | "other" | "postponed" | "scheduled"
  statuses?: readonly ("cancelled" | "completed" | "other" | "postponed" | "scheduled")[]
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

export type MeetingOrganizationRead = typeof organizations.$inferSelect

export interface MeetingPage {
  items: MeetingRead[]
  nextCursor?: string
  truncated: boolean
}

type MeetingCursorScope = {
  billId: string | null
  calendarId: string | null
  classification: MeetingListInput["classification"] | null
  dateTimezone: string | null
  from: string | null
  jurisdictionId: string | null
  isRemote: boolean | null
  meetingId: string | null
  organizationId: string | null
  query: string | null
  sessionId: string | null
  sort: MeetingSort
  status: MeetingListInput["status"] | null
  to: string | null
  classifications?: readonly NonNullable<MeetingListInput["classifications"]>[number][]
  jurisdictionIds?: readonly string[]
  organizationIds?: readonly string[]
  sessionIds?: readonly string[]
  statuses?: readonly NonNullable<MeetingListInput["statuses"]>[number][]
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

/**
 * A singular meeting uses precisely the same visibility boundary as the
 * collection. Incomplete legacy snapshots are therefore indistinguishable
 * from a missing public resource rather than being projected with invented
 * facts.
 */
export async function getMeetingRead(database: LegislationDatabase, meetingId: string): Promise<MeetingRead> {
  const id = optionalId(meetingId, "meetingId")
  if (id === null) {
    throw new LegislationError("invalid_request", "meetingId must be between 1 and 256 characters")
  }
  const rows = await buildMeetingListQuery(database, { limit: 1, meetingId: id })
  const row = rows[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Meeting ${id} was not found`)
  }
  const relations = await relationIds(database, [row.id])
  return {
    ...row,
    organizationIds: relations.organizations.get(row.id) ?? [],
    sessionIds: relations.sessions.get(row.id) ?? []
  }
}

/** Meeting organizations are a bounded, source-complete relationship set. */
export async function listMeetingOrganizations(
  database: LegislationDatabase,
  meetingId: string
): Promise<MeetingOrganizationRead[]> {
  const id = optionalId(meetingId, "meetingId")
  if (id === null) {
    throw new LegislationError("invalid_request", "meetingId must be between 1 and 256 characters")
  }
  const rows = await database
    .select()
    .from(eventOrganizations)
    .innerJoin(organizations, eq(eventOrganizations.organizationId, organizations.id))
    .where(eq(eventOrganizations.eventId, id))
    .orderBy(asc(organizations.name), asc(organizations.id))
    .limit(51)
  if (rows.length > 50) {
    throw new LegislationError("unprocessable", "meeting organization set exceeds the public maximum of 50")
  }
  return rows.map((row) => row.organizations)
}

function meetingVisibility(scope: MeetingCursorScope): [SQL, ...SQL[]] {
  return [
    eq(legislativeEvents.isDeleted, false),
    eq(legislativeEvents.canonicalFactsComplete, true),
    eq(legislativeEvents.sessionRelationsComplete, true),
    eq(legislativeEvents.organizationRelationsComplete, true),
    eq(legislativeEvents.provenanceComplete, true),
    scope.meetingId === null ? undefined : eq(legislativeEvents.id, scope.meetingId),
    scope.calendarId === null
      ? undefined
      : sql`exists (select 1 from ${calendarEvents} where ${calendarEvents.eventId} = ${legislativeEvents.id} and ${calendarEvents.calendarId} = ${scope.calendarId})`,
    meetingJurisdictionPredicate(scope),
    meetingClassificationPredicate(scope),
    meetingStatusPredicate(scope),
    scope.from === null ? undefined : lowerDateBound(scope.from, scope.dateTimezone),
    scope.to === null ? undefined : upperDateBound(scope.to, scope.dateTimezone),
    scope.isRemote === null ? undefined : eq(legislativeEvents.isRemote, scope.isRemote),
    scope.billId === null
      ? undefined
      : sql`exists (select 1 from ${eventBills} where ${eventBills.eventId} = ${legislativeEvents.id} and ${eventBills.billId} = ${scope.billId})`,
    meetingOrganizationPredicate(scope),
    scope.query === null ? undefined : ilike(legislativeEvents.name, `%${scope.query}%`),
    meetingSessionPredicate(scope)
  ].filter((value): value is SQL => value !== undefined) as [SQL, ...SQL[]]
}

function lowerDateBound(value: string, dateTimezone: string | null): SQL {
  if (!isIsoDate(value)) {
    return gte(legislativeEvents.startAt, new Date(value))
  }
  if (dateTimezone === null) {
    return gte(legislativeEvents.publisherLocalDate, value)
  }
  return sql`${legislativeEvents.startAt} >= ${localDateAtTimezone(value, dateTimezone)}`
}

function meetingJurisdictionPredicate(scope: MeetingCursorScope): SQL | undefined {
  if (scope.jurisdictionIds !== undefined) {
    return inArray(legislativeEvents.jurisdictionId, scope.jurisdictionIds)
  }
  return scope.jurisdictionId === null ? undefined : eq(legislativeEvents.jurisdictionId, scope.jurisdictionId)
}

function meetingClassificationPredicate(scope: MeetingCursorScope): SQL | undefined {
  if (scope.classifications !== undefined) {
    return inArray(legislativeEvents.classification, scope.classifications)
  }
  return scope.classification === null ? undefined : sql`${legislativeEvents.classification} = ${scope.classification}`
}

function meetingStatusPredicate(scope: MeetingCursorScope): SQL | undefined {
  if (scope.statuses !== undefined) {
    return inArray(legislativeEvents.status, scope.statuses)
  }
  return scope.status === null ? undefined : sql`${legislativeEvents.status} = ${scope.status}`
}

function meetingOrganizationPredicate(scope: MeetingCursorScope): SQL | undefined {
  if (scope.organizationIds !== undefined) {
    return sql`exists (select 1 from ${eventOrganizations} where ${eventOrganizations.eventId} = ${legislativeEvents.id} and ${inArray(eventOrganizations.organizationId, scope.organizationIds)})`
  }
  return scope.organizationId === null
    ? undefined
    : sql`exists (select 1 from ${eventOrganizations} where ${eventOrganizations.eventId} = ${legislativeEvents.id} and ${eventOrganizations.organizationId} = ${scope.organizationId})`
}

function meetingSessionPredicate(scope: MeetingCursorScope): SQL | undefined {
  if (scope.sessionIds !== undefined) {
    return sql`exists (select 1 from ${eventSessions} where ${eventSessions.eventId} = ${legislativeEvents.id} and ${inArray(eventSessions.sessionId, scope.sessionIds)})`
  }
  return scope.sessionId === null
    ? undefined
    : sql`exists (select 1 from ${eventSessions} where ${eventSessions.eventId} = ${legislativeEvents.id} and ${eventSessions.sessionId} = ${scope.sessionId})`
}

function upperDateBound(value: string, dateTimezone: string | null): SQL {
  if (!isIsoDate(value)) {
    return lte(legislativeEvents.startAt, new Date(value))
  }
  if (dateTimezone === null) {
    return lte(legislativeEvents.publisherLocalDate, value)
  }
  return sql`${legislativeEvents.startAt} < ${localDateAtTimezone(nextIsoDate(value), dateTimezone)}`
}

function localDateAtTimezone(value: string, dateTimezone: string): SQL {
  return sql`${value}::date at time zone ${dateTimezone}`
}

function nextIsoDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
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
  const from = input.from === undefined ? null : dateOrTimestamp(input.from, "from")
  const to = input.to === undefined ? null : dateOrTimestamp(input.to, "to")
  if (from !== null && to !== null && comparableDateValue(from) > comparableDateValue(to)) {
    throw new LegislationError("invalid_request", "from must not be after to")
  }
  return {
    billId: optionalId(input.billId, "billId"),
    calendarId: optionalId(input.calendarId, "calendarId"),
    classification: input.classification ?? null,
    dateTimezone:
      input.dateTimezone === undefined || input.dateTimezone === null
        ? null
        : optionalText(input.dateTimezone, "dateTimezone", 256),
    from,
    jurisdictionId: optionalId(input.jurisdictionId, "jurisdictionId"),
    isRemote: input.isRemote ?? null,
    meetingId: optionalId(input.meetingId, "meetingId"),
    organizationId: optionalId(input.organizationId, "organizationId"),
    query: optionalText(input.query, "query", 500),
    sessionId: optionalId(input.sessionId, "sessionId"),
    sort: input.sort ?? "starts-asc",
    status: input.status ?? null,
    to,
    ...(input.classifications === undefined
      ? {}
      : { classifications: enumValues(input.classifications, "classifications") }),
    ...(input.jurisdictionIds === undefined
      ? {}
      : { jurisdictionIds: textValues(input.jurisdictionIds, "jurisdictionIds") }),
    ...(input.organizationIds === undefined
      ? {}
      : { organizationIds: textValues(input.organizationIds, "organizationIds") }),
    ...(input.sessionIds === undefined ? {} : { sessionIds: textValues(input.sessionIds, "sessionIds") }),
    ...(input.statuses === undefined ? {} : { statuses: enumValues(input.statuses, "statuses") })
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

function textValues(values: readonly string[], name: string): readonly string[] {
  const normalized = values.map((value) => value.trim())
  if (normalized.length === 0 || normalized.length > 25 || normalized.some((value) => value.length === 0)) {
    throw new LegislationError("invalid_request", `${name} must contain between 1 and 25 non-empty values`)
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new LegislationError("invalid_request", `${name} must contain unique values`)
  }
  return normalized
}

function enumValues<T extends string>(values: readonly T[], name: string): readonly T[] {
  if (values.length === 0 || values.length > 25 || new Set(values).size !== values.length) {
    throw new LegislationError("invalid_request", `${name} must contain between 1 and 25 values`)
  }
  return [...values]
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

function dateOrTimestamp(value: string, name: string): string {
  if (isIsoDate(value) || isRfc3339Timestamp(value)) {
    return value
  }
  throw new LegislationError("invalid_request", `${name} must be an ISO date or RFC 3339 timestamp`)
}

function comparableDateValue(value: string): number {
  return isIsoDate(value) ? Date.parse(`${value}T00:00:00.000Z`) : new Date(value).valueOf()
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid meeting pagination cursor")
}
