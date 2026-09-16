import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  billActions,
  eventAgendaItemBills,
  eventOutcomes,
  organizations,
  votes
} from "@repo/legislation-core/database/schema/schema"
import { billActionTimestamp } from "@repo/legislation-core/domain/bill-action-timestamp"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, eq, gt, gte, lt, lte, or, sql, type SQL, type SQLWrapper } from "drizzle-orm"
import { isIsoDate, isRfc3339Timestamp } from "../../../request-handling/api/canonical-projection"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type BillTimelineType = "action" | "meeting-outcome" | "vote"
export interface BillTimelineListInput {
  billId: string
  cursor?: string
  from?: string
  limit?: number
  to?: string
  types?: readonly BillTimelineType[]
}
export type BillTimelinePersistenceRead =
  | Readonly<{
      action: typeof billActions.$inferSelect
      kind: "action"
      organization: typeof organizations.$inferSelect | null
    }>
  | Readonly<{ kind: "vote"; vote: typeof votes.$inferSelect }>
  | Readonly<{
      action: typeof billActions.$inferSelect | null
      kind: "meeting-outcome"
      outcome: typeof eventOutcomes.$inferSelect
      vote: typeof votes.$inferSelect | null
    }>
export interface BillTimelinePage {
  items: BillTimelinePersistenceRead[]
  nextCursor?: string
  truncated: boolean
}
type CursorScope = { billId: string; from: string | null; to: string | null; types: readonly BillTimelineType[] }
type TimelineCursor = {
  id: string
  scope: CursorScope
  sequence: number
  sortAt: string
  type: BillTimelineType
  version: 1
}
type OrderedRow = {
  id: string
  item: BillTimelinePersistenceRead
  sequence: number
  sortAt: Date
  type: BillTimelineType
}
const actionSortAt = billActionTimestamp()

/** Merges only completeness-gated source facts into the public timeline union. */
export async function listBillTimeline(
  database: LegislationDatabase,
  input: BillTimelineListInput
): Promise<BillTimelinePage> {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const branchLimit = limit + 1
  const [actions, timelineVotes, outcomes] = await Promise.all([
    includesType(scope, "action") ? listActions(database, scope, cursor, branchLimit) : [],
    includesType(scope, "vote") ? listVotes(database, scope, cursor, branchLimit) : [],
    includesType(scope, "meeting-outcome") ? listOutcomes(database, scope, cursor, branchLimit) : []
  ])
  const ordered = [...actions, ...timelineVotes, ...outcomes].sort(compareRows)
  const truncated = ordered.length > limit
  const page = ordered.slice(0, limit)
  const last = page.at(-1)
  return {
    items: page.map((row) => row.item),
    nextCursor: truncated && last !== undefined ? encodeCursor(last, scope) : undefined,
    truncated
  }
}

async function listActions(
  database: LegislationDatabase,
  scope: CursorScope,
  cursor: TimelineCursor | undefined,
  limit: number
) {
  const rows = await database
    .select({ action: billActions, organization: organizations, sortAt: actionSortAt.as("sort_at") })
    .from(billActions)
    .leftJoin(organizations, eq(organizations.id, billActions.organizationId))
    .where(
      and(
        eq(billActions.billId, scope.billId),
        sql`${actionSortAt} is not null`,
        fromPredicate(actionSortAt, scope.from),
        toPredicate(actionSortAt, scope.to),
        afterCursorPredicate(cursor, actionSortAt, billActions.ordinal, "action", billActions.id)
      )
    )
    .orderBy(asc(actionSortAt), asc(billActions.ordinal), asc(billActions.id))
    .limit(limit)
  return rows.map((row) =>
    orderedRow({ action: row.action, kind: "action", organization: row.organization }, row.sortAt, row.action.ordinal)
  )
}
async function listVotes(
  database: LegislationDatabase,
  scope: CursorScope,
  cursor: TimelineCursor | undefined,
  limit: number
) {
  const rows = await database
    .select({ vote: votes })
    .from(votes)
    .where(
      and(
        eq(votes.billId, scope.billId),
        eq(votes.timelineComplete, true),
        sql`${votes.heldAt} is not null`,
        fromPredicate(votes.heldAt, scope.from),
        toPredicate(votes.heldAt, scope.to),
        afterCursorPredicate(cursor, votes.heldAt, votes.sourceSequence, "vote", votes.id)
      )
    )
    .orderBy(asc(votes.heldAt), asc(votes.sourceSequence), asc(votes.id))
    .limit(limit)
  return rows.map(({ vote }) => orderedRow({ kind: "vote", vote }, vote.heldAt, vote.sourceSequence))
}
async function listOutcomes(
  database: LegislationDatabase,
  scope: CursorScope,
  cursor: TimelineCursor | undefined,
  limit: number
) {
  const rows = await buildOutcomeQuery(database, scope, cursor, limit)
  return rows.map(({ action, outcome, vote }) =>
    orderedRow({ action, kind: "meeting-outcome", outcome, vote }, outcome.occurredAt, outcome.sourceSequence)
  )
}
export function buildBillTimelineOutcomeQuery(database: LegislationDatabase, input: BillTimelineListInput) {
  const scope = cursorScope(input)
  return buildOutcomeQuery(database, scope, decodeCursor(input.cursor, scope), parseLimit(input.limit) + 1)
}
function buildOutcomeQuery(
  database: LegislationDatabase,
  scope: CursorScope,
  cursor: TimelineCursor | undefined,
  limit: number
) {
  return database
    .selectDistinct({ action: billActions, outcome: eventOutcomes, vote: votes })
    .from(eventOutcomes)
    .leftJoin(billActions, eq(billActions.id, eventOutcomes.actionId))
    .leftJoin(votes, eq(votes.id, eventOutcomes.voteId))
    .leftJoin(eventAgendaItemBills, eq(eventAgendaItemBills.agendaItemId, eventOutcomes.agendaItemId))
    .where(
      and(
        eq(eventOutcomes.timelineComplete, true),
        or(
          eq(billActions.billId, scope.billId),
          eq(votes.billId, scope.billId),
          eq(eventAgendaItemBills.billId, scope.billId)
        ),
        sql`${eventOutcomes.occurredAt} is not null`,
        fromPredicate(eventOutcomes.occurredAt, scope.from),
        toPredicate(eventOutcomes.occurredAt, scope.to),
        afterCursorPredicate(
          cursor,
          eventOutcomes.occurredAt,
          eventOutcomes.sourceSequence,
          "meeting-outcome",
          eventOutcomes.id
        )
      )
    )
    .orderBy(asc(eventOutcomes.occurredAt), asc(eventOutcomes.sourceSequence), asc(eventOutcomes.id))
    .limit(limit)
}
function orderedRow(item: BillTimelinePersistenceRead, sortAt: Date | null, sequence: number | null): OrderedRow {
  if (!(sortAt instanceof Date) || Number.isNaN(sortAt.valueOf()) || !isNonnegativeInteger(sequence)) {
    throw new LegislationError("unprocessable", "timeline-complete row has incomplete ordering facts")
  }
  const id = timelineItemId(item)
  return { id, item, sequence, sortAt, type: item.kind }
}
function timelineItemId(item: BillTimelinePersistenceRead): string {
  switch (item.kind) {
    case "action":
      return item.action.id
    case "meeting-outcome":
      return item.outcome.id
    case "vote":
      return item.vote.id
  }
}
function compareRows(left: OrderedRow, right: OrderedRow): number {
  return (
    left.sortAt.valueOf() - right.sortAt.valueOf() ||
    left.sequence - right.sequence ||
    left.type.localeCompare(right.type) ||
    left.id.localeCompare(right.id)
  )
}
function includesType(scope: CursorScope, type: BillTimelineType): boolean {
  return scope.types.length === 0 || scope.types.includes(type)
}
function cursorScope(input: BillTimelineListInput): CursorScope {
  const scope = {
    billId: requiredInputText(input.billId, "billId"),
    from: input.from ?? null,
    to: input.to ?? null,
    types: canonicalTypes(input.types)
  }
  validateDateRange(scope.from, scope.to)
  return scope
}
function canonicalTypes(value: readonly BillTimelineType[] | undefined): readonly BillTimelineType[] {
  if (value === undefined) {
    return []
  }
  const types = [...new Set(value)].sort()
  if (!types.every(isTimelineType)) {
    throw new LegislationError("invalid_request", "type must be a supported timeline type")
  }
  return types
}
function fromPredicate(column: SQLWrapper, value: string | null): SQL | undefined {
  return value === null ? undefined : gte(column, dateBoundary(value, "from"))
}
function toPredicate(column: SQLWrapper, value: string | null): SQL | undefined {
  if (value === null) {
    return undefined
  }
  return isIsoDate(value) ? lt(column, endOfIsoDate(value)) : lte(column, dateBoundary(value, "to"))
}
function afterCursorPredicate(
  cursor: TimelineCursor | undefined,
  timestamp: SQLWrapper,
  sequence: SQLWrapper,
  type: BillTimelineType,
  id: SQLWrapper
): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const sortAt = new Date(cursor.sortAt)
  const typeComparison = type.localeCompare(cursor.type)
  const sameMoment = and(eq(timestamp, sortAt), eq(sequence, cursor.sequence))
  return or(
    gt(timestamp, sortAt),
    and(eq(timestamp, sortAt), gt(sequence, cursor.sequence)),
    typeComparison > 0 ? sameMoment : undefined,
    typeComparison === 0 ? and(sameMoment, gt(id, cursor.id)) : undefined
  )
}
function encodeCursor(row: OrderedRow, scope: CursorScope): string {
  return Buffer.from(
    JSON.stringify({
      id: row.id,
      scope,
      sequence: row.sequence,
      sortAt: row.sortAt.toISOString(),
      type: row.type,
      version: 1
    } satisfies TimelineCursor)
  ).toString("base64url")
}
function decodeCursor(value: string | undefined, scope: CursorScope): TimelineCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4096) {
    throw invalidCursor()
  }
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (!isCursor(decoded) || !sameScope(decoded.scope, scope)) {
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
function sameScope(left: CursorScope, right: CursorScope): boolean {
  return (
    left.billId === right.billId &&
    left.from === right.from &&
    left.to === right.to &&
    left.types.length === right.types.length &&
    left.types.every((type, index) => type === right.types[index])
  )
}
function isCursor(value: unknown): value is TimelineCursor {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isNonemptyString(value.id) &&
    isNonnegativeInteger(value.sequence) &&
    typeof value.sortAt === "string" &&
    isRfc3339Timestamp(value.sortAt) &&
    isTimelineType(value.type) &&
    isCursorScope(value.scope)
  )
}
function isCursorScope(value: unknown): value is CursorScope {
  return (
    isRecord(value) &&
    isNonemptyString(value.billId) &&
    (value.from === null || (typeof value.from === "string" && isDateBound(value.from))) &&
    (value.to === null || (typeof value.to === "string" && isDateBound(value.to))) &&
    Array.isArray(value.types) &&
    value.types.every(isTimelineType)
  )
}
function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}
function validateDateRange(from: string | null, to: string | null): void {
  if (
    from !== null &&
    to !== null &&
    (isIsoDate(to)
      ? dateBoundary(from, "from").valueOf() >= endOfIsoDate(to).valueOf()
      : dateBoundary(from, "from").valueOf() > dateBoundary(to, "to").valueOf())
  ) {
    throw new LegislationError("invalid_request", "from must be less than or equal to to")
  }
}
function dateBoundary(value: string, name: "from" | "to"): Date {
  if (!isDateBound(value)) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date or RFC3339 timestamp`)
  }
  return new Date(isIsoDate(value) ? `${value}T00:00:00.000Z` : value)
}
function endOfIsoDate(value: string): Date {
  return new Date(dateBoundary(value, "to").valueOf() + 86_400_000)
}
function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}
function isTimelineType(value: unknown): value is BillTimelineType {
  return value === "action" || value === "meeting-outcome" || value === "vote"
}
function isDateBound(value: string): boolean {
  return isIsoDate(value) || isRfc3339Timestamp(value)
}
function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}
function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid bill timeline pagination cursor")
}
