import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { billActions, billSponsors, bills, people } from "@repo/legislation-core/database/schema/schema"
import { billActionTimestamp } from "@repo/legislation-core/domain/bill-action-timestamp"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, desc, eq, gt, isNotNull, lt, or, sql, type SQL, type SQLWrapper } from "drizzle-orm"
import { isIsoDate, isRfc3339Timestamp } from "../../../request-handling/api/canonical-projection.js"
import type { BillSummaryRead } from "../../../request-handling/api/canonical-read.js"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export type BillActivityRole = "author" | "cosponsor" | "sponsor" | "subject"

export interface PersonBillActivityListInput {
  cursor?: string
  from?: string
  limit?: number
  personId: string
  role?: BillActivityRole
  sessionId?: string
  status?: string
  to?: string
}

export interface PersonBillActivity {
  bill: BillSummaryRead
  firstObservedAt: Date
  latestObservedAt: Date
  roles: BillActivityRole[]
}

export interface PersonBillActivityPage {
  items: PersonBillActivity[]
  nextCursor?: string
  truncated: boolean
}

type BillActivityCursorScope = {
  from: string | null
  personId: string
  role: BillActivityRole | null
  sessionId: string | null
  status: string | null
  to: string | null
}

type BillActivityCursor = {
  id: string
  latestObservedAt: string
  scope: BillActivityCursorScope
  version: 1
}

/** Distinguishes an absent person from a person with no bill activity. */
export function buildPersonExistenceQuery(database: LegislationDatabase, personId: string) {
  return database
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, requiredPersonId(personId)))
    .limit(1)
}

export async function assertPersonExists(database: LegislationDatabase, personId: string): Promise<void> {
  if ((await buildPersonExistenceQuery(database, personId))[0] === undefined) {
    throw new LegislationError("not_found", `Person ${personId} was not found`)
  }
}

export function buildPersonBillActivityListQuery(database: LegislationDatabase, input: PersonBillActivityListInput) {
  const limit = parseLimit(input.limit)
  validateDateRange(input.from, input.to)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const sponsorRole = normalizedSponsorRole()
  const activities = database
    .select({
      billId: billSponsors.billId,
      firstObservedAt: sql<Date>`min(${billSponsors.firstObservedAt})`
        .mapWith(billSponsors.firstObservedAt)
        .as("first_observed_at"),
      latestObservedAt: sql<Date>`max(${billSponsors.latestObservedAt})`
        .mapWith(billSponsors.latestObservedAt)
        .as("latest_observed_at"),
      roles: sql<BillActivityRole[]>`array_agg(distinct ${sponsorRole} order by ${sponsorRole})`.as("roles")
    })
    .from(billSponsors)
    .where(
      and(
        eq(billSponsors.personId, input.personId),
        isNotNull(billSponsors.firstObservedAt),
        isNotNull(billSponsors.latestObservedAt),
        sql`${sponsorRole} is not null`
      )
    )
    .groupBy(billSponsors.billId)
    .as("person_bill_activities")
  const latestActions = database
    .select({
      latestActionAt: sql<Date | null>`max(${billActionTimestamp()})`
        .mapWith(billActions.actionAt)
        .as("latest_action_at")
    })
    .from(billActions)
    .where(eq(billActions.billId, bills.id))
    .as("person_bill_activity_latest_actions")
  const cursorPredicate =
    cursor === undefined
      ? undefined
      : or(
          lt(activities.latestObservedAt, new Date(cursor.latestObservedAt)),
          and(eq(activities.latestObservedAt, new Date(cursor.latestObservedAt)), gt(bills.id, cursor.id))
        )

  return database
    .select({
      bill: bills,
      firstObservedAt: activities.firstObservedAt,
      latestActionAt: latestActions.latestActionAt,
      latestObservedAt: activities.latestObservedAt,
      roles: activities.roles
    })
    .from(activities)
    .innerJoin(bills, eq(bills.id, activities.billId))
    .leftJoinLateral(latestActions, sql`true`)
    .where(
      and(
        input.sessionId === undefined ? undefined : eq(bills.sessionId, input.sessionId),
        input.status === undefined ? undefined : eq(bills.status, input.status),
        input.role === undefined ? undefined : sql`${input.role} = any(${activities.roles})`,
        input.from === undefined ? undefined : dateBound(activities.latestObservedAt, input.from, "from"),
        input.to === undefined ? undefined : dateBound(activities.latestObservedAt, input.to, "to"),
        cursorPredicate
      )
    )
    .orderBy(desc(activities.latestObservedAt), asc(bills.id))
    .limit(limit + 1)
}

export async function listPersonBillActivity(
  database: LegislationDatabase,
  input: PersonBillActivityListInput
): Promise<PersonBillActivityPage> {
  const limit = parseLimit(input.limit)
  const rows = await buildPersonBillActivityListQuery(database, input)
  const items = rows.slice(0, limit).map((row) => ({
    bill: { ...row.bill, latestActionAt: row.latestActionAt },
    firstObservedAt: requiredObservationDate(row.firstObservedAt, "firstObservedAt"),
    latestObservedAt: requiredObservationDate(row.latestObservedAt, "latestObservedAt"),
    roles: row.roles
  }))
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined
        ? encodeCursor({
            id: last.bill.id,
            latestObservedAt: last.latestObservedAt.toISOString(),
            scope: cursorScope(input)
          })
        : undefined,
    truncated: rows.length > limit
  }
}

function requiredObservationDate(value: Date | null, name: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new LegislationError("unprocessable", `Person bill activity ${name} is incomplete`)
  }
  return value
}

export function encodePersonBillActivityCursor(cursor: Omit<BillActivityCursor, "version">): string {
  return encodeCursor(cursor)
}

function normalizedSponsorRole(): SQL<BillActivityRole | null> {
  return sql<BillActivityRole | null>`case
    when ${billSponsors.classification} in ('primary', 'sponsor') then 'sponsor'
    when ${billSponsors.classification} = 'cosponsor' then 'cosponsor'
    when ${billSponsors.classification} = 'author' then 'author'
    when ${billSponsors.classification} = 'subject' then 'subject'
    else null
  end`
}

function cursorScope(input: PersonBillActivityListInput): BillActivityCursorScope {
  return {
    from: input.from ?? null,
    personId: requiredPersonId(input.personId),
    role: input.role ?? null,
    sessionId: input.sessionId ?? null,
    status: input.status ?? null,
    to: input.to ?? null
  }
}

function dateBound(expression: SQLWrapper, value: string, direction: "from" | "to"): SQL {
  if (isIsoDate(value)) {
    return direction === "from"
      ? sql`${expression} >= ${value}::date`
      : sql`${expression} < (${value}::date + interval '1 day')`
  }
  return direction === "from" ? sql`${expression} >= ${value}` : sql`${expression} <= ${value}`
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredPersonId(value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", "personId must be between 1 and 256 characters")
  }
  return normalized
}

function validateDateRange(from: string | undefined, to: string | undefined): void {
  if (from !== undefined && !validDateBound(from)) {
    throw new LegislationError("invalid_request", "from must be an ISO date or RFC3339 timestamp")
  }
  if (to !== undefined && !validDateBound(to)) {
    throw new LegislationError("invalid_request", "to must be an ISO date or RFC3339 timestamp")
  }
  if (from !== undefined && to !== undefined) {
    if (isIsoDate(from) !== isIsoDate(to)) {
      throw new LegislationError("invalid_request", "from and to must use the same format")
    }
    const fromTimestamp = Date.parse(from)
    const toTimestamp = Date.parse(to) + (isIsoDate(to) ? 86_400_000 : 0)
    if (isIsoDate(to) ? fromTimestamp >= toTimestamp : fromTimestamp > toTimestamp) {
      throw new LegislationError("invalid_request", "from must be less than or equal to to")
    }
  }
}

function validDateBound(value: string): boolean {
  return isIsoDate(value) || isRfc3339Timestamp(value)
}

function encodeCursor(cursor: Omit<BillActivityCursor, "version">): string {
  return Buffer.from(JSON.stringify({ ...cursor, version: 1 })).toString("base64url")
}

function decodeCursor(
  cursor: string | undefined,
  expectedScope: BillActivityCursorScope
): BillActivityCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
  } catch {
    throw invalidCursor()
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isText(parsed.id) || !isText(parsed.latestObservedAt)) {
    throw invalidCursor()
  }
  if (!isRfc3339Timestamp(parsed.latestObservedAt) || !sameScope(parsed.scope, expectedScope)) {
    throw invalidCursor()
  }
  return { id: parsed.id, latestObservedAt: parsed.latestObservedAt, scope: expectedScope, version: 1 }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function sameScope(value: unknown, expected: BillActivityCursorScope): boolean {
  return isRecord(value) && JSON.stringify(value) === JSON.stringify(expected)
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid person bill activity pagination cursor")
}
