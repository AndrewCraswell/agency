import { and, asc, desc, eq, gt, gte, ilike, lt, lte, or, sql, type SQL } from "drizzle-orm"
import { isIsoDate, isRfc3339Timestamp } from "../../api/canonical-projection.js"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import {
  billActions,
  billOrganizations,
  bills,
  organizationMemberships,
  organizations,
  people
} from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type OrganizationSort = "name-asc" | "updated-desc"

export interface OrganizationListInput {
  chamber?: string
  classification?: string
  cursor?: string
  isActive?: boolean
  jurisdictionId?: string
  limit?: number
  parentOrganizationId?: string
  query?: string
  sort?: OrganizationSort
}

export interface OrganizationMembershipListInput {
  cursor?: string
  from?: string
  isCurrent?: boolean
  limit?: number
  organizationId: string
  role?: string
  to?: string
}

export interface OrganizationBillListInput {
  cursor?: string
  from?: string
  limit?: number
  organizationId: string
  relationship?: string
  sessionId?: string
  status?: string
  to?: string
}

export interface OrganizationPage<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

export type OrganizationRow = typeof organizations.$inferSelect
export type OrganizationMembershipRow = {
  membership: typeof organizationMemberships.$inferSelect
  organization: OrganizationRow
  person: typeof people.$inferSelect
}
export type OrganizationBillRow = {
  bill: typeof bills.$inferSelect
  latestActionAt: Date | null
}

export type OrganizationCursorScope = {
  chamber: string | null
  classification: string | null
  isActive: boolean | null
  jurisdictionId: string | null
  parentOrganizationId: string | null
  query: string | null
  sort: OrganizationSort
}

type OrganizationCursor =
  | { id: string; name: string; scope: OrganizationCursorScope; sort: "name-asc"; version: 1 }
  | { id: string; scope: OrganizationCursorScope; sort: "updated-desc"; updatedAt: string; version: 1 }

export type MembershipCursorScope = {
  from: string | null
  isCurrent: boolean | null
  organizationId: string
  role: string | null
  to: string | null
}
type MembershipCursor = { id: string; personName: string; role: string; scope: MembershipCursorScope; version: 1 }
export type BillCursorScope = {
  from: string | null
  organizationId: string
  relationship: string | null
  sessionId: string | null
  status: string | null
  to: string | null
}
type BillCursor = { id: string; scope: BillCursorScope; sortAt: string; version: 1 }

export function buildOrganizationListQuery(database: LegislationDatabase, input: OrganizationListInput = {}) {
  const limit = parseLimit(input.limit)
  const sort = input.sort ?? "name-asc"
  const scope = organizationCursorScope(input)
  const cursor = decodeOrganizationCursor(input.cursor, scope)
  const cursorPredicate = organizationCursorPredicate(cursor)

  return database
    .select()
    .from(organizations)
    .where(
      and(
        input.jurisdictionId === undefined ? undefined : eq(organizations.jurisdictionId, input.jurisdictionId),
        input.classification === undefined ? undefined : eq(organizations.classification, input.classification),
        input.parentOrganizationId === undefined
          ? undefined
          : eq(organizations.parentOrganizationId, input.parentOrganizationId),
        input.chamber === undefined ? undefined : eq(organizations.chamber, input.chamber),
        input.isActive === undefined ? undefined : eq(organizations.isActive, input.isActive),
        input.query === undefined ? undefined : ilike(organizations.name, `%${input.query}%`),
        cursorPredicate
      )
    )
    .orderBy(
      ...(sort === "name-asc"
        ? [asc(organizations.name), asc(organizations.id)]
        : [desc(organizations.updatedAt), asc(organizations.id)])
    )
    .limit(limit + 1)
}

export async function listOrganizations(
  database: LegislationDatabase,
  input: OrganizationListInput = {}
): Promise<OrganizationPage<OrganizationRow>> {
  const limit = parseLimit(input.limit)
  const rows = await buildOrganizationListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      truncated && last !== undefined
        ? encodeOrganizationCursor(last, input.sort ?? "name-asc", organizationCursorScope(input))
        : undefined,
    truncated
  }
}

export function buildJurisdictionOrganizationListQuery(
  database: LegislationDatabase,
  jurisdictionId: string,
  input: Omit<OrganizationListInput, "jurisdictionId"> = {}
) {
  return buildOrganizationListQuery(database, { ...input, jurisdictionId })
}

export function buildJurisdictionClassificationOrganizationListQuery(
  database: LegislationDatabase,
  jurisdictionId: string,
  classification: "commission" | "committee",
  input: Omit<OrganizationListInput, "classification" | "jurisdictionId"> = {}
) {
  return buildOrganizationListQuery(database, { ...input, classification, jurisdictionId })
}

export async function listJurisdictionOrganizations(
  database: LegislationDatabase,
  jurisdictionId: string,
  input: Omit<OrganizationListInput, "jurisdictionId"> = {}
): Promise<OrganizationPage<OrganizationRow>> {
  return listOrganizations(database, { ...input, jurisdictionId })
}

export async function listJurisdictionOrganizationsByClassification(
  database: LegislationDatabase,
  jurisdictionId: string,
  classification: "commission" | "committee",
  input: Omit<OrganizationListInput, "classification" | "jurisdictionId"> = {}
): Promise<OrganizationPage<OrganizationRow>> {
  return listOrganizations(database, { ...input, classification, jurisdictionId })
}

export function buildOrganizationMembershipListQuery(
  database: LegislationDatabase,
  input: OrganizationMembershipListInput
) {
  const limit = parseLimit(input.limit)
  validateDateRange(input.from, input.to)
  const scope = membershipCursorScope(input)
  const cursor = decodeMembershipCursor(input.cursor, scope)
  const role = membershipRoleExpression()
  const cursorPredicate =
    cursor === undefined
      ? undefined
      : or(
          gt(role, cursor.role),
          and(eq(role, cursor.role), gt(people.name, cursor.personName)),
          and(eq(role, cursor.role), eq(people.name, cursor.personName), gt(organizationMemberships.id, cursor.id))
        )
  const dateBounds = membershipDateBounds(input.from, input.to)

  return database
    .select({ membership: organizationMemberships, organization: organizations, person: people })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .innerJoin(people, eq(people.id, organizationMemberships.personId))
    .where(
      and(
        eq(organizationMemberships.organizationId, input.organizationId),
        input.role === undefined
          ? undefined
          : or(eq(organizationMemberships.classification, input.role), eq(organizationMemberships.title, input.role)),
        input.isCurrent === undefined ? undefined : eq(organizationMemberships.isActive, input.isCurrent),
        dateBounds,
        cursorPredicate
      )
    )
    .orderBy(asc(role), asc(people.name), asc(organizationMemberships.id))
    .limit(limit + 1)
}

export async function listOrganizationMemberships(
  database: LegislationDatabase,
  input: OrganizationMembershipListInput
): Promise<OrganizationPage<OrganizationMembershipRow>> {
  const limit = parseLimit(input.limit)
  const rows = await buildOrganizationMembershipListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      truncated && last !== undefined
        ? encodeMembershipCursor({
            id: last.membership.id,
            personName: last.person.name,
            role: last.membership.classification ?? last.membership.title ?? "",
            scope: membershipCursorScope(input)
          })
        : undefined,
    truncated
  }
}

export async function findOrganizationMembership(
  database: LegislationDatabase,
  organizationId: string,
  membershipId: string
): Promise<OrganizationMembershipRow | undefined> {
  const rows = await buildOrganizationMembershipLookupQuery(database, organizationId, membershipId)
  return rows[0]
}

export function buildOrganizationMembershipLookupQuery(
  database: LegislationDatabase,
  organizationId: string,
  membershipId: string
) {
  return database
    .select({ membership: organizationMemberships, organization: organizations, person: people })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .innerJoin(people, eq(people.id, organizationMemberships.personId))
    .where(
      and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.id, membershipId))
    )
    .limit(1)
}

export function buildOrganizationBillListQuery(database: LegislationDatabase, input: OrganizationBillListInput) {
  const limit = parseLimit(input.limit)
  validateDateRange(input.from, input.to)
  const scope = billCursorScope(input)
  const cursor = decodeBillCursor(input.cursor, scope)
  const latestActions = database
    .select({
      latestActionAt: sql<Date | null>`max(coalesce(${billActions.actionAt}, ${billActions.actionDate}::timestamp))`
        .mapWith(billActions.actionAt)
        .as("latest_action_at")
    })
    .from(billActions)
    .where(eq(billActions.billId, bills.id))
    .as("organization_bill_latest_actions")
  const latestActivity = sql<Date>`coalesce(${latestActions.latestActionAt}, ${bills.sourceUpdatedAt}, ${bills.updatedAt})`
  const cursorPredicate =
    cursor === undefined
      ? undefined
      : or(
          lt(latestActivity, new Date(cursor.sortAt)),
          and(eq(latestActivity, new Date(cursor.sortAt)), gt(bills.id, cursor.id))
        )
  const relationshipPredicate =
    input.relationship === undefined ? undefined : eq(billOrganizations.classification, input.relationship)
  const organizationLink = sql`exists (select 1 from ${billOrganizations} where ${billOrganizations.billId} = ${bills.id} and ${billOrganizations.organizationId} = ${input.organizationId}${relationshipPredicate === undefined ? sql`` : sql` and ${relationshipPredicate}`})`

  return database
    .select({ bill: bills, latestActionAt: latestActions.latestActionAt })
    .from(bills)
    .innerJoin(organizations, eq(organizations.id, input.organizationId))
    .leftJoinLateral(latestActions, sql`true`)
    .where(
      and(
        organizationLink,
        eq(bills.jurisdictionId, organizations.jurisdictionId),
        input.sessionId === undefined ? undefined : eq(bills.sessionId, input.sessionId),
        input.status === undefined ? undefined : eq(bills.status, input.status),
        input.from === undefined ? undefined : billDateBound(latestActivity, input.from, "from"),
        input.to === undefined ? undefined : billDateBound(latestActivity, input.to, "to"),
        cursorPredicate
      )
    )
    .orderBy(desc(latestActivity), asc(bills.id))
    .limit(limit + 1)
}

export async function listOrganizationBills(
  database: LegislationDatabase,
  input: OrganizationBillListInput
): Promise<OrganizationPage<OrganizationBillRow>> {
  const limit = parseLimit(input.limit)
  const rows = await buildOrganizationBillListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      truncated && last !== undefined
        ? encodeBillCursor({
            id: last.bill.id,
            scope: billCursorScope(input),
            sortAt: (last.latestActionAt ?? last.bill.sourceUpdatedAt ?? last.bill.updatedAt).toISOString()
          })
        : undefined,
    truncated
  }
}

export function encodeOrganizationCursor(
  row: OrganizationRow,
  sort: OrganizationSort,
  scope: OrganizationCursorScope
): string {
  const cursor: OrganizationCursor =
    sort === "name-asc"
      ? { id: row.id, name: row.name, scope, sort, version: 1 }
      : { id: row.id, scope, sort, updatedAt: row.updatedAt.toISOString(), version: 1 }
  return encodeCursor(cursor)
}

export function encodeMembershipCursor(cursor: Omit<MembershipCursor, "version">): string {
  return encodeCursor({ ...cursor, version: 1 })
}

export function encodeBillCursor(cursor: Omit<BillCursor, "version">): string {
  return encodeCursor({ ...cursor, version: 1 })
}

function membershipRoleExpression(): SQL<string> {
  return sql<string>`coalesce(${organizationMemberships.classification}, ${organizationMemberships.title}, '')`
}

function organizationCursorScope(input: OrganizationListInput): OrganizationCursorScope {
  return {
    chamber: input.chamber ?? null,
    classification: input.classification ?? null,
    isActive: input.isActive ?? null,
    jurisdictionId: input.jurisdictionId ?? null,
    parentOrganizationId: input.parentOrganizationId ?? null,
    query: input.query ?? null,
    sort: input.sort ?? "name-asc"
  }
}

function membershipCursorScope(input: OrganizationMembershipListInput): MembershipCursorScope {
  return {
    from: input.from ?? null,
    isCurrent: input.isCurrent ?? null,
    organizationId: input.organizationId,
    role: input.role ?? null,
    to: input.to ?? null
  }
}

function billCursorScope(input: OrganizationBillListInput): BillCursorScope {
  return {
    from: input.from ?? null,
    organizationId: input.organizationId,
    relationship: input.relationship ?? null,
    sessionId: input.sessionId ?? null,
    status: input.status ?? null,
    to: input.to ?? null
  }
}

function organizationCursorPredicate(cursor: OrganizationCursor | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  if (cursor.sort === "name-asc") {
    return or(
      gt(organizations.name, cursor.name),
      and(eq(organizations.name, cursor.name), gt(organizations.id, cursor.id))
    )
  }
  const updatedAt = new Date(cursor.updatedAt)
  return or(
    lt(organizations.updatedAt, updatedAt),
    and(eq(organizations.updatedAt, updatedAt), gt(organizations.id, cursor.id))
  )
}

function membershipDateBounds(from: string | undefined, to: string | undefined): SQL | undefined {
  validateDateRange(from, to)
  return and(
    from === undefined ? undefined : sql`coalesce(${organizationMemberships.endDate}, '9999-12-31'::date) >= ${from}`,
    to === undefined ? undefined : sql`coalesce(${organizationMemberships.startDate}, '0001-01-01'::date) <= ${to}`
  )
}

function billDateBound(expression: SQL, value: string, direction: "from" | "to"): SQL {
  if (isDateOnly(value)) {
    return direction === "from"
      ? sql`${expression} >= ${value}::date`
      : sql`${expression} < (${value}::date + interval '1 day')`
  }
  return direction === "from" ? gte(expression, value) : lte(expression, value)
}

function parseLimit(limit: number | undefined): number {
  const value = limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be an integer between 1 and ${MAX_LIMIT}`)
  }
  return value
}

function validateDateRange(from: string | undefined, to: string | undefined): void {
  if (from !== undefined && !validDateBound(from)) {
    throw new LegislationError("invalid_request", "from must be an ISO date or RFC3339 timestamp")
  }
  if (to !== undefined && !validDateBound(to)) {
    throw new LegislationError("invalid_request", "to must be an ISO date or RFC3339 timestamp")
  }
  if (from !== undefined && to !== undefined) {
    const fromTimestamp = normalizedDateBound(from, "from")
    const toTimestamp = normalizedDateBound(to, "to")
    const inverted = isDateOnly(to) ? fromTimestamp >= toTimestamp : fromTimestamp > toTimestamp
    if (inverted) {
      throw new LegislationError("invalid_request", "from must be less than or equal to to")
    }
  }
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validDateBound(value: string): boolean {
  return isIsoDate(value) || isRfc3339Timestamp(value)
}

function normalizedDateBound(value: string, direction: "from" | "to"): number {
  const timestamp = Date.parse(value)
  return direction === "to" && isDateOnly(value) ? timestamp + 86_400_000 : timestamp
}

function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function decodeOrganizationCursor(
  cursor: string | undefined,
  expectedScope: OrganizationCursorScope
): OrganizationCursor | undefined {
  const parsed = decodeCursor(cursor)
  if (
    parsed === undefined ||
    parsed.version !== 1 ||
    parsed.sort !== expectedScope.sort ||
    typeof parsed.id !== "string" ||
    !sameScope(parsed.scope, expectedScope)
  ) {
    if (cursor === undefined) {
      return undefined
    }
    throw new LegislationError("invalid_request", "Invalid organization pagination cursor")
  }
  if (expectedScope.sort === "name-asc" && typeof parsed.name === "string") {
    return { id: parsed.id, name: parsed.name, scope: expectedScope, sort: expectedScope.sort, version: 1 }
  }
  if (
    expectedScope.sort === "updated-desc" &&
    typeof parsed.updatedAt === "string" &&
    validTimestamp(parsed.updatedAt)
  ) {
    return { id: parsed.id, scope: expectedScope, sort: expectedScope.sort, updatedAt: parsed.updatedAt, version: 1 }
  }
  throw new LegislationError("invalid_request", "Invalid organization pagination cursor")
}

function decodeMembershipCursor(
  cursor: string | undefined,
  expectedScope: MembershipCursorScope
): MembershipCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const parsed = decodeCursor(cursor)
  if (
    parsed === undefined ||
    parsed.version !== 1 ||
    !isString(parsed.id) ||
    !isString(parsed.personName) ||
    !isString(parsed.role) ||
    !sameScope(parsed.scope, expectedScope)
  ) {
    throw new LegislationError("invalid_request", "Invalid organization membership pagination cursor")
  }
  return { id: parsed.id, personName: parsed.personName, role: parsed.role, scope: expectedScope, version: 1 }
}

function decodeBillCursor(cursor: string | undefined, expectedScope: BillCursorScope): BillCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const parsed = decodeCursor(cursor)
  if (
    parsed === undefined ||
    parsed.version !== 1 ||
    !isString(parsed.id) ||
    !isString(parsed.sortAt) ||
    !validTimestamp(parsed.sortAt) ||
    !sameScope(parsed.scope, expectedScope)
  ) {
    throw new LegislationError("invalid_request", "Invalid organization bill pagination cursor")
  }
  return { id: parsed.id, scope: expectedScope, sortAt: parsed.sortAt, version: 1 }
}

function decodeCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (cursor === undefined) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("invalid")
    }
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function validTimestamp(value: string): boolean {
  return isRfc3339Timestamp(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sameScope(value: unknown, expected: object): boolean {
  return isRecord(value) && JSON.stringify(value) === JSON.stringify(expected)
}
