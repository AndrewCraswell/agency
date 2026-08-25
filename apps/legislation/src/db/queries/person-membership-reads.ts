import { and, asc, desc, eq, gt, isNotNull, lt, or, sql, type SQL } from "drizzle-orm"
import { isIsoDate, isRfc3339Timestamp } from "../../api/canonical-projection.js"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { organizationMemberships, organizations, people } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface PersonMembershipListInput {
  cursor?: string
  from?: string
  isCurrent?: boolean
  limit?: number
  organizationId?: string
  personId: string
  to?: string
}

export type PersonMembershipRow = {
  membership: typeof organizationMemberships.$inferSelect
  organization: typeof organizations.$inferSelect
  person: typeof people.$inferSelect
}

export interface PersonMembershipPage {
  items: PersonMembershipRow[]
  nextCursor?: string
  truncated: boolean
}

export type PersonMembershipCursorScope = {
  from: string | null
  isCurrent: boolean | null
  organizationId: string | null
  personId: string
  to: string | null
}

type PersonMembershipCursor = {
  id: string
  scope: PersonMembershipCursorScope
  startDate: string
  version: 1
}

/** Returns only complete canonical membership links for the requested person. */
export function buildPersonMembershipListQuery(database: LegislationDatabase, input: PersonMembershipListInput) {
  const limit = parseLimit(input.limit)
  validateDateRange(input.from, input.to)
  const scope = personMembershipCursorScope(input)
  const cursor = decodePersonMembershipCursor(input.cursor, scope)
  const startDateSort = membershipStartDateSort()
  const cursorPredicate =
    cursor === undefined
      ? undefined
      : or(
          lt(startDateSort, cursor.startDate),
          and(eq(startDateSort, cursor.startDate), gt(organizationMemberships.id, cursor.id))
        )

  return database
    .select({ membership: organizationMemberships, organization: organizations, person: people })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .innerJoin(people, eq(people.id, organizationMemberships.personId))
    .where(
      and(
        eq(organizationMemberships.personId, requiredInputText(input.personId, "personId")),
        eq(organizationMemberships.provenanceComplete, true),
        eq(organizations.provenanceComplete, true),
        eq(people.provenanceComplete, true),
        isNotNull(organizationMemberships.role),
        input.organizationId === undefined
          ? undefined
          : eq(organizationMemberships.organizationId, requiredInputText(input.organizationId, "organizationId")),
        input.isCurrent === undefined ? undefined : eq(organizationMemberships.isActive, input.isCurrent),
        membershipDateBounds(input.from, input.to),
        cursorPredicate
      )
    )
    .orderBy(desc(startDateSort), asc(organizationMemberships.id))
    .limit(limit + 1)
}

export async function listPersonMemberships(
  database: LegislationDatabase,
  input: PersonMembershipListInput
): Promise<PersonMembershipPage> {
  const limit = parseLimit(input.limit)
  const rows = await buildPersonMembershipListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      truncated && last !== undefined
        ? encodePersonMembershipCursor({
            id: last.membership.id,
            scope: personMembershipCursorScope(input),
            startDate: last.membership.startDate ?? "0001-01-01"
          })
        : undefined,
    truncated
  }
}

export function encodePersonMembershipCursor(cursor: Omit<PersonMembershipCursor, "version">): string {
  return Buffer.from(JSON.stringify({ ...cursor, version: 1 }), "utf8").toString("base64url")
}

function membershipStartDateSort(): SQL<string> {
  return sql<string>`coalesce(${organizationMemberships.startDate}, '0001-01-01'::date)`
}

function personMembershipCursorScope(input: PersonMembershipListInput): PersonMembershipCursorScope {
  return {
    from: input.from ?? null,
    isCurrent: input.isCurrent ?? null,
    organizationId: input.organizationId ?? null,
    personId: input.personId,
    to: input.to ?? null
  }
}

function membershipDateBounds(from: string | undefined, to: string | undefined): SQL | undefined {
  return and(
    from === undefined ? undefined : sql`coalesce(${organizationMemberships.endDate}, '9999-12-31'::date) >= ${from}`,
    to === undefined ? undefined : sql`coalesce(${organizationMemberships.startDate}, '0001-01-01'::date) <= ${to}`
  )
}

function decodePersonMembershipCursor(
  cursor: string | undefined,
  expectedScope: PersonMembershipCursorScope
): PersonMembershipCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const parsed = decodeCursor(cursor)
  if (
    parsed === undefined ||
    parsed.version !== 1 ||
    !isString(parsed.id) ||
    !isString(parsed.startDate) ||
    !isIsoDate(parsed.startDate) ||
    !sameScope(parsed.scope, expectedScope)
  ) {
    throw new LegislationError("invalid_request", "Invalid person membership pagination cursor")
  }
  return { id: parsed.id, scope: expectedScope, startDate: parsed.startDate, version: 1 }
}

function decodeCursor(cursor: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function parseLimit(limit: number | undefined): number {
  const value = limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be an integer between 1 and ${MAX_LIMIT}`)
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

function sameScope(value: unknown, expected: PersonMembershipCursorScope): boolean {
  return isRecord(value) && JSON.stringify(value) === JSON.stringify(expected)
}

function validateDateRange(from: string | undefined, to: string | undefined): void {
  if (from !== undefined && !validDateBound(from)) {
    throw new LegislationError("invalid_request", "from must be an ISO date or RFC3339 timestamp")
  }
  if (to !== undefined && !validDateBound(to)) {
    throw new LegislationError("invalid_request", "to must be an ISO date or RFC3339 timestamp")
  }
  if (from !== undefined && to !== undefined) {
    const fromTimestamp = Date.parse(from)
    const toTimestamp = Date.parse(to)
    const inverted = isDateOnly(to) ? fromTimestamp >= toTimestamp + 86_400_000 : fromTimestamp > toTimestamp
    if (inverted) {
      throw new LegislationError("invalid_request", "from must be less than or equal to to")
    }
  }
}

function validDateBound(value: string): boolean {
  return isIsoDate(value) || isRfc3339Timestamp(value)
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
