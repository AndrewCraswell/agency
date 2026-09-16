import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { organizationMemberships, people, personAliases } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, desc, eq, exists, gt, gte, ilike, inArray, isNotNull, lt, lte, or, type SQL } from "drizzle-orm"
import { isRfc3339Timestamp } from "../../../request-handling/api/canonical-projection.js"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export type PersonSort = "name-asc" | "updated-desc"

export interface PersonListInput {
  cursor?: string
  isActive?: boolean
  jurisdictionId?: string
  jurisdictionIds?: readonly string[]
  limit?: number
  organizationId?: string
  organizationIds?: readonly string[]
  party?: string
  parties?: readonly string[]
  q?: string
  sort?: PersonSort
  updatedFrom?: Date
  updatedTo?: Date
  updatedToExclusive?: Date
}

export interface PersonPage<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

export type PersonCollectionRead = typeof people.$inferSelect

type PersonCursorScope = {
  isActive: boolean | null
  jurisdictionId: string | null
  organizationId: string | null
  party: string | null
  q: string | null
  sort: PersonSort
  jurisdictionIds?: readonly string[]
  organizationIds?: readonly string[]
  parties?: readonly string[]
  updatedFrom?: string | null
  updatedTo?: string | null
  updatedToExclusive?: string | null
}

type PersonCursor =
  | { id: string; name: string; scope: PersonCursorScope; sort: "name-asc"; version: 1 }
  | { id: string; scope: PersonCursorScope; sort: "updated-desc"; updatedAt: string; version: 1 }

export function buildPeopleListQuery(database: LegislationDatabase, input: PersonListInput = {}) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const partyPredicate = personPartyPredicate(scope)
  const organizationMembership = personOrganizationMembershipPredicate(database, scope)
  const aliasMatch =
    scope.q === null
      ? undefined
      : exists(
          database
            .select({ personId: personAliases.personId })
            .from(personAliases)
            .where(
              and(
                eq(personAliases.personId, people.id),
                eq(personAliases.provenanceComplete, true),
                ilike(personAliases.name, `%${scope.q}%`)
              )
            )
        )

  return database
    .select()
    .from(people)
    .where(
      and(
        eq(people.provenanceComplete, true),
        isNotNull(people.isActive),
        isNotNull(people.jurisdictionId),
        personJurisdictionPredicate(scope),
        organizationMembership,
        partyPredicate,
        scope.isActive === null ? undefined : eq(people.isActive, scope.isActive),
        scope.q === null ? undefined : or(ilike(people.name, `%${scope.q}%`), aliasMatch),
        updatedFromPredicate(scope),
        updatedToPredicate(scope),
        updatedToExclusivePredicate(scope),
        cursorPredicate(cursor)
      )
    )
    .orderBy(
      ...(scope.sort === "name-asc" ? [asc(people.name), asc(people.id)] : [desc(people.updatedAt), asc(people.id)])
    )
    .limit(limit + 1)
}

export async function listPeople(
  database: LegislationDatabase,
  input: PersonListInput = {}
): Promise<PersonPage<PersonCollectionRead>> {
  const limit = parseLimit(input.limit)
  const rows = await buildPeopleListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: truncated && last !== undefined ? encodeCursor(last, cursorScope(input)) : undefined,
    truncated
  }
}

function cursorScope(input: PersonListInput): PersonCursorScope {
  const scope: PersonCursorScope = {
    isActive: input.isActive ?? null,
    jurisdictionId:
      input.jurisdictionId === undefined ? null : requiredInputText(input.jurisdictionId, "jurisdictionId"),
    organizationId:
      input.organizationId === undefined ? null : requiredInputText(input.organizationId, "organizationId"),
    party: input.party === undefined ? null : requiredInputText(input.party, "party"),
    q: input.q === undefined ? null : requiredInputText(input.q, "q", 500),
    sort: input.sort ?? "name-asc",
    ...(input.jurisdictionIds === undefined
      ? {}
      : { jurisdictionIds: inputTexts(input.jurisdictionIds, "jurisdictionIds") }),
    ...(input.organizationIds === undefined
      ? {}
      : { organizationIds: inputTexts(input.organizationIds, "organizationIds") }),
    ...(input.parties === undefined ? {} : { parties: inputTexts(input.parties, "parties") })
  }
  return { ...scope, ...updatedScope(input) }
}

function cursorPredicate(cursor: PersonCursor | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  if (cursor.sort === "name-asc") {
    return or(gt(people.name, cursor.name), and(eq(people.name, cursor.name), gt(people.id, cursor.id)))
  }
  const updatedAt = new Date(cursor.updatedAt)
  return or(lt(people.updatedAt, updatedAt), and(eq(people.updatedAt, updatedAt), gt(people.id, cursor.id)))
}

function personJurisdictionPredicate(scope: PersonCursorScope): SQL | undefined {
  if (scope.jurisdictionIds !== undefined) {
    return inArray(people.jurisdictionId, scope.jurisdictionIds)
  }
  return scope.jurisdictionId === null ? undefined : eq(people.jurisdictionId, scope.jurisdictionId)
}

function personPartyPredicate(scope: PersonCursorScope): SQL | undefined {
  if (scope.parties !== undefined) {
    return inArray(people.party, scope.parties)
  }
  return scope.party === null ? undefined : eq(people.party, scope.party)
}

function personOrganizationMembershipPredicate(
  database: LegislationDatabase,
  scope: PersonCursorScope
): SQL | undefined {
  if (scope.organizationIds === undefined && scope.organizationId === null) {
    return undefined
  }
  const organizationPredicate =
    scope.organizationIds === undefined
      ? eq(organizationMemberships.organizationId, scope.organizationId!)
      : inArray(organizationMemberships.organizationId, scope.organizationIds)
  return exists(
    database
      .select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.personId, people.id), organizationPredicate))
  )
}

function updatedScope(
  input: PersonListInput
): Pick<PersonCursorScope, "updatedFrom" | "updatedTo" | "updatedToExclusive"> {
  if (input.updatedFrom === undefined && input.updatedTo === undefined && input.updatedToExclusive === undefined) {
    return {}
  }
  return {
    updatedFrom: input.updatedFrom?.toISOString() ?? null,
    updatedTo: input.updatedTo?.toISOString() ?? null,
    updatedToExclusive: input.updatedToExclusive?.toISOString() ?? null
  }
}

function updatedFromPredicate(scope: PersonCursorScope): SQL | undefined {
  return scope.updatedFrom === undefined || scope.updatedFrom === null
    ? undefined
    : gte(people.updatedAt, new Date(scope.updatedFrom))
}

function updatedToPredicate(scope: PersonCursorScope): SQL | undefined {
  return scope.updatedTo === undefined || scope.updatedTo === null
    ? undefined
    : lte(people.updatedAt, new Date(scope.updatedTo))
}

function updatedToExclusivePredicate(scope: PersonCursorScope): SQL | undefined {
  return scope.updatedToExclusive === undefined || scope.updatedToExclusive === null
    ? undefined
    : lt(people.updatedAt, new Date(scope.updatedToExclusive))
}

function encodeCursor(row: PersonCollectionRead, scope: PersonCursorScope): string {
  const cursor: PersonCursor =
    scope.sort === "name-asc"
      ? { id: row.id, name: row.name, scope, sort: scope.sort, version: 1 }
      : { id: row.id, scope, sort: scope.sort, updatedAt: row.updatedAt.toISOString(), version: 1 }
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCursor(value: string | undefined, expectedScope: PersonCursorScope): PersonCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = parseCursor(value)
  if (
    parsed === undefined ||
    parsed.version !== 1 ||
    parsed.sort !== expectedScope.sort ||
    !isNonemptyString(parsed.id) ||
    !sameScope(parsed.scope, expectedScope)
  ) {
    throw invalidCursor()
  }
  if (parsed.sort === "name-asc" && isNonemptyString(parsed.name)) {
    return { id: parsed.id, name: parsed.name, scope: expectedScope, sort: parsed.sort, version: 1 }
  }
  if (parsed.sort === "updated-desc" && isRfc3339Timestamp(parsed.updatedAt)) {
    return { id: parsed.id, scope: expectedScope, sort: parsed.sort, updatedAt: parsed.updatedAt, version: 1 }
  }
  throw invalidCursor()
}

function parseCursor(value: string): Record<string, unknown> | undefined {
  if (value.length > 4096) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredInputText(value: string, name: string, maximumLength = 256): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximumLength} characters`)
  }
  return normalized
}

function inputTexts(values: readonly string[], name: string): readonly string[] {
  const normalized = values.map((value) => value.trim())
  if (normalized.length === 0 || normalized.length > 25 || normalized.some((value) => value.length === 0)) {
    throw new LegislationError("invalid_request", `${name} must contain between 1 and 25 values`)
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new LegislationError("invalid_request", `${name} must contain unique values`)
  }
  return normalized.map((value) => requiredInputText(value, name))
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sameScope(value: unknown, expected: PersonCursorScope): boolean {
  return isRecord(value) && JSON.stringify(value) === JSON.stringify(expected)
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid people pagination cursor")
}
