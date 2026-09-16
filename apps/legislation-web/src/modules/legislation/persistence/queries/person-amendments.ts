import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { amendments } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, eq, gt, isNull, lt, or, sql, type SQL } from "drizzle-orm"
import {
  isIsoDate,
  isRfc3339Timestamp,
  projectAmendmentSummary,
  type AmendmentSummary
} from "../../../request-handling/api/canonical-projection.js"
import { sourceProjectionContext } from "../../../request-handling/api/canonical-read.js"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface PersonAmendmentsListInput {
  cursor?: string
  from?: string
  limit?: number
  personId: string
  sessionId?: string
  status?: string
  to?: string
}

export interface PersonAmendmentRead {
  amendment: typeof amendments.$inferSelect
}

export interface PersonAmendmentsPage {
  items: PersonAmendmentRead[]
  nextCursor?: string
  truncated: boolean
}

export type PersonAmendmentsCursorScope = Readonly<{
  from: string | null
  personId: string
  sessionId: string | null
  status: string | null
  to: string | null
}>

type PersonAmendmentsCursor = Readonly<{
  id: string
  scope: PersonAmendmentsCursorScope
  submittedDate: string | null
  version: 1
}>

export function buildPersonAmendmentsListQuery(database: LegislationDatabase, input: PersonAmendmentsListInput) {
  const limit = parseLimit(input.limit)
  validateDateRange(input.from, input.to)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const cursorPredicate = cursor === undefined ? undefined : afterCursor(cursor)
  const submittedDate = amendments.submittedDate

  return database
    .select({ amendment: amendments })
    .from(amendments)
    .where(
      and(
        eq(amendments.sponsorPersonId, requiredPersonId(input.personId)),
        input.sessionId === undefined ? undefined : eq(amendments.sessionId, input.sessionId),
        input.status === undefined ? undefined : eq(amendments.status, input.status),
        input.from === undefined ? undefined : dateBound(submittedDate, input.from, "from"),
        input.to === undefined ? undefined : dateBound(submittedDate, input.to, "to"),
        cursorPredicate
      )
    )
    .orderBy(sql`${submittedDate} desc nulls last`, asc(amendments.id))
    .limit(limit + 1)
}

export async function listPersonAmendments(
  database: LegislationDatabase,
  input: PersonAmendmentsListInput
): Promise<PersonAmendmentsPage> {
  const limit = parseLimit(input.limit)
  const rows = await buildPersonAmendmentsListQuery(database, input)
  const items = rows.slice(0, limit)
  const last = items.at(-1)?.amendment
  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined
        ? encodePersonAmendmentsCursor({
            id: last.id,
            scope: cursorScope(input),
            submittedDate: last.submittedDate
          })
        : undefined,
    truncated: rows.length > limit
  }
}

export function projectPersonAmendmentRead(value: PersonAmendmentRead, apiBaseUrl: string): AmendmentSummary {
  const amendment = value.amendment
  const billId = amendment.billId
  if (billId === null) {
    throw new LegislationError("unprocessable", "Person amendment is no longer attached to a bill")
  }
  return projectAmendment(amendment, billId, apiBaseUrl)
}

function projectAmendment(
  amendment: typeof amendments.$inferSelect,
  billId: string,
  apiBaseUrl: string
): AmendmentSummary {
  return projectAmendmentSummary(
    {
      billId,
      documentId: null,
      id: amendment.id,
      identifier: amendment.printedIdentifier,
      jurisdictionId: amendment.jurisdictionId,
      recordType: "structured",
      sourceUrl: amendment.sourceUrl,
      status: amendment.status,
      submittedDate: amendment.submittedDate,
      title: amendment.purpose ?? amendment.printedIdentifier
    },
    sourceProjectionContext(amendment, apiBaseUrl)
  )
}

function afterCursor(cursor: PersonAmendmentsCursor): SQL {
  const date = amendments.submittedDate
  if (cursor.submittedDate === null) {
    return and(isNull(date), gt(amendments.id, cursor.id)) ?? sql`false`
  }
  return (
    or(
      isNull(date),
      lt(date, cursor.submittedDate),
      and(eq(date, cursor.submittedDate), gt(amendments.id, cursor.id))
    ) ?? sql`false`
  )
}

function cursorScope(input: PersonAmendmentsListInput): PersonAmendmentsCursorScope {
  return {
    from: input.from ?? null,
    personId: requiredPersonId(input.personId),
    sessionId: input.sessionId ?? null,
    status: input.status ?? null,
    to: input.to ?? null
  }
}

export function encodePersonAmendmentsCursor(cursor: Omit<PersonAmendmentsCursor, "version">): string {
  return Buffer.from(JSON.stringify({ ...cursor, version: 1 }), "utf8").toString("base64url")
}

function decodeCursor(
  value: string | undefined,
  scope: PersonAmendmentsCursorScope
): PersonAmendmentsCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !isNonEmptyString(parsed.id) ||
      !isNullableIsoDate(parsed.submittedDate) ||
      !isRecord(parsed.scope) ||
      JSON.stringify(parsed.scope) !== JSON.stringify(scope)
    ) {
      throw new Error("invalid")
    }
    return {
      id: parsed.id,
      scope,
      submittedDate: parsed.submittedDate,
      version: 1
    }
  } catch {
    throw new LegislationError("invalid_request", "Invalid person amendment pagination cursor")
  }
}

function dateBound(expression: typeof amendments.submittedDate, value: string, direction: "from" | "to"): SQL {
  if (isIsoDate(value)) {
    return direction === "from" ? sql`${expression} >= ${value}::date` : sql`${expression} <= ${value}::date`
  }
  return direction === "from" ? sql`${expression} >= ${value}::timestamp` : sql`${expression} <= ${value}::timestamp`
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

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
