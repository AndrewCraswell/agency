import { and, asc, desc, eq, exists, gt, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm"
import { isIsoDate, isRfc3339Timestamp } from "../../api/canonical-projection.js"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { bills, legislativeSessions, people, votePositions, votes } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type VoteOption = "absent" | "abstain" | "no" | "not-voting" | "other" | "paired" | "present" | "proxy" | "yes"
export type VoteResult = "failed" | "other" | "passed"
export type VoteSort = "held-asc" | "held-desc"

export interface VoteListInput {
  billId?: string
  classification?: string
  cursor?: string
  from?: string
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  personId?: string
  result?: VoteResult
  sort?: VoteSort
  to?: string
}

export interface VotePositionListInput {
  cursor?: string
  limit?: number
  options?: readonly VoteOption[]
  personId?: string
  voteId: string
}

export interface PersonVoteListInput {
  cursor?: string
  from?: string
  limit?: number
  option?: VoteOption
  organizationId?: string
  personId: string
  to?: string
}

export type VoteRead = typeof votes.$inferSelect
export type VotePositionRead = Readonly<{
  person: typeof people.$inferSelect | null
  position: typeof votePositions.$inferSelect
  vote: VoteRead
}>
export type PersonVotePositionRead = VotePositionRead & Readonly<{ bill: typeof bills.$inferSelect | null }>

export interface Page<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

type VoteCursorScope = Readonly<{
  billId: string | null
  classification: string | null
  from: string | null
  jurisdictionId: string | null
  organizationId: string | null
  personId: string | null
  result: VoteResult | null
  sort: VoteSort
  to: string | null
}>

type VoteCursor = Readonly<{ heldAt: string; id: string; scope: VoteCursorScope; version: 1 }>
type PositionCursorScope = Readonly<{ options: VoteOption[]; personId: string | null; voteId: string }>
type PositionCursor = Readonly<{
  sourceIdentity: string
  sourceSequence: number
  scope: PositionCursorScope
  version: 1
}>
type PersonVoteCursorScope = Readonly<{
  from: string | null
  option: VoteOption | null
  organizationId: string | null
  personId: string
  to: string | null
}>
type PersonVoteCursor = Readonly<{
  heldAt: string
  sourceIdentity: string
  sourceSequence: number
  voteId: string
  scope: PersonVoteCursorScope
  version: 1
}>

export async function listVoteReads(database: LegislationDatabase, input: VoteListInput): Promise<Page<VoteRead>> {
  const limit = limitOf(input.limit)
  validateDateRange(input.from, input.to)
  const scope = voteScope(input)
  const cursor = decodeVoteCursor(input.cursor, scope)
  const heldPredicate = cursor === undefined ? undefined : voteAfter(cursor, scope.sort)
  const personPredicate =
    input.personId === undefined
      ? undefined
      : exists(
          database
            .select({ value: sql`1` })
            .from(votePositions)
            .where(
              and(eq(votePositions.voteId, votes.id), eq(votePositions.personId, nonblank(input.personId, "personId")))
            )
        )
  const rows = await database
    .select({ vote: votes })
    .from(votes)
    .leftJoin(bills, eq(votes.billId, bills.id))
    .leftJoin(legislativeSessions, eq(votes.sessionId, legislativeSessions.id))
    .where(
      and(
        eq(votes.timelineComplete, true),
        input.billId === undefined ? undefined : eq(votes.billId, nonblank(input.billId, "billId")),
        input.classification === undefined
          ? undefined
          : eq(votes.classification, nonblank(input.classification, "classification")),
        input.organizationId === undefined
          ? undefined
          : eq(votes.organizationId, nonblank(input.organizationId, "organizationId")),
        input.result === undefined ? undefined : eq(votes.result, input.result),
        input.jurisdictionId === undefined
          ? undefined
          : or(
              eq(bills.jurisdictionId, nonblank(input.jurisdictionId, "jurisdictionId")),
              eq(legislativeSessions.jurisdictionId, nonblank(input.jurisdictionId, "jurisdictionId"))
            ),
        input.from === undefined ? undefined : dateBound(votes.heldAt, input.from, "from"),
        input.to === undefined ? undefined : dateBound(votes.heldAt, input.to, "to"),
        personPredicate,
        heldPredicate
      )
    )
    .orderBy(...voteOrder(scope.sort))
    .limit(limit + 1)
  const items = rows.slice(0, limit).map((row) => row.vote)
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined
        ? encodeVoteCursor({ heldAt: requiredHeldAt(last), id: last.id, scope })
        : undefined,
    truncated: rows.length > limit
  }
}

export async function getVoteRead(database: LegislationDatabase, voteId: string): Promise<VoteRead> {
  const id = nonblank(voteId, "voteId")
  const row = (await database.select().from(votes).where(eq(votes.id, id)).limit(1))[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Vote ${id} was not found`)
  }
  if (!row.timelineComplete) {
    throw new LegislationError("unprocessable", "Vote canonical persistence is incomplete")
  }
  return row
}

export async function listVotePositionReads(
  database: LegislationDatabase,
  input: VotePositionListInput
): Promise<Page<VotePositionRead>> {
  const vote = await getVoteRead(database, input.voteId)
  await assertVotePositionSequences(database, vote.id)
  const limit = limitOf(input.limit)
  const scope = positionScope(input)
  const cursor = decodePositionCursor(input.cursor, scope)
  const rows = await database
    .select({ person: people, position: votePositions, vote: votes })
    .from(votePositions)
    .innerJoin(votes, eq(votePositions.voteId, votes.id))
    .leftJoin(people, eq(votePositions.personId, people.id))
    .where(
      and(
        eq(votePositions.voteId, vote.id),
        input.personId === undefined ? undefined : eq(votePositions.personId, nonblank(input.personId, "personId")),
        input.options === undefined || input.options.length === 0
          ? undefined
          : inArray(votePositions.option, input.options),
        cursor === undefined
          ? undefined
          : or(
              gt(votePositions.sourceSequence, cursor.sourceSequence),
              and(
                eq(votePositions.sourceSequence, cursor.sourceSequence),
                gt(votePositions.sourceIdentity, cursor.sourceIdentity)
              )
            )
      )
    )
    .orderBy(asc(votePositions.sourceSequence), asc(votePositions.sourceIdentity))
    .limit(limit + 1)
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined
        ? encodePositionCursor({
            scope,
            sourceIdentity: last.position.sourceIdentity,
            sourceSequence: requiredPositionSequence(last.position)
          })
        : undefined,
    truncated: rows.length > limit
  }
}

export async function listPersonVotePositionReads(
  database: LegislationDatabase,
  input: PersonVoteListInput
): Promise<Page<PersonVotePositionRead>> {
  const personId = nonblank(input.personId, "personId")
  await assertPersonExists(database, personId)
  const limit = limitOf(input.limit)
  validateDateRange(input.from, input.to)
  const scope = personVoteScope(input)
  const cursor = decodePersonVoteCursor(input.cursor, scope)
  const rows = await database
    .select({ bill: bills, person: people, position: votePositions, vote: votes })
    .from(votePositions)
    .innerJoin(votes, eq(votePositions.voteId, votes.id))
    .innerJoin(people, eq(votePositions.personId, people.id))
    .leftJoin(bills, eq(votes.billId, bills.id))
    .where(
      and(
        eq(votes.timelineComplete, true),
        eq(votePositions.personId, personId),
        input.option === undefined ? undefined : eq(votePositions.option, input.option),
        input.organizationId === undefined
          ? undefined
          : eq(votes.organizationId, nonblank(input.organizationId, "organizationId")),
        input.from === undefined ? undefined : dateBound(votes.heldAt, input.from, "from"),
        input.to === undefined ? undefined : dateBound(votes.heldAt, input.to, "to"),
        cursor === undefined ? undefined : personVoteAfter(cursor)
      )
    )
    .orderBy(desc(votes.heldAt), asc(votes.id), asc(votePositions.sourceSequence), asc(votePositions.sourceIdentity))
    .limit(limit + 1)
  const items = rows.slice(0, limit)
  items.forEach((item) => requiredPositionSequence(item.position))
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined
        ? encodePersonVoteCursor({
            heldAt: requiredHeldAt(last.vote),
            scope,
            sourceIdentity: last.position.sourceIdentity,
            sourceSequence: requiredPositionSequence(last.position),
            voteId: last.vote.id
          })
        : undefined,
    truncated: rows.length > limit
  }
}

export async function assertPersonExists(database: LegislationDatabase, personId: string): Promise<void> {
  if (
    (
      await database
        .select({ id: people.id })
        .from(people)
        .where(eq(people.id, nonblank(personId, "personId")))
        .limit(1)
    )[0] === undefined
  ) {
    throw new LegislationError("not_found", `Person ${personId} was not found`)
  }
}

function voteOrder(sort: VoteSort) {
  return sort === "held-asc" ? [asc(votes.heldAt), asc(votes.id)] : [desc(votes.heldAt), asc(votes.id)]
}
function voteAfter(cursor: VoteCursor, sort: VoteSort): SQL {
  const heldAt = new Date(cursor.heldAt)
  return sort === "held-asc"
    ? (or(gt(votes.heldAt, heldAt), and(eq(votes.heldAt, heldAt), gt(votes.id, cursor.id))) ?? sql`false`)
    : (or(lt(votes.heldAt, heldAt), and(eq(votes.heldAt, heldAt), gt(votes.id, cursor.id))) ?? sql`false`)
}
function personVoteAfter(cursor: PersonVoteCursor): SQL {
  const heldAt = new Date(cursor.heldAt)
  return (
    or(
      lt(votes.heldAt, heldAt),
      and(eq(votes.heldAt, heldAt), gt(votes.id, cursor.voteId)),
      and(
        eq(votes.heldAt, heldAt),
        eq(votes.id, cursor.voteId),
        gt(votePositions.sourceSequence, cursor.sourceSequence)
      ),
      and(
        eq(votes.heldAt, heldAt),
        eq(votes.id, cursor.voteId),
        eq(votePositions.sourceSequence, cursor.sourceSequence),
        gt(votePositions.sourceIdentity, cursor.sourceIdentity)
      )
    ) ?? sql`false`
  )
}
function dateBound(expression: typeof votes.heldAt, value: string, direction: "from" | "to"): SQL {
  if (isIsoDate(value)) {
    return direction === "from"
      ? sql`${expression} >= ${value}::date`
      : sql`${expression} < (${value}::date + interval '1 day')`
  }
  return direction === "from" ? sql`${expression} >= ${value}` : sql`${expression} <= ${value}`
}
function validateDateRange(from: string | undefined, to: string | undefined): void {
  if (from !== undefined && !validBound(from)) {
    throw new LegislationError("invalid_request", "from must be an ISO date or RFC3339 timestamp")
  }
  if (to !== undefined && !validBound(to)) {
    throw new LegislationError("invalid_request", "to must be an ISO date or RFC3339 timestamp")
  }
  if (
    from !== undefined &&
    to !== undefined &&
    Date.parse(from) > Date.parse(to) + (isIsoDate(to) ? 86_400_000 - 1 : 0)
  ) {
    throw new LegislationError("invalid_request", "from must be less than or equal to to")
  }
}
function validBound(value: string) {
  return isIsoDate(value) || isRfc3339Timestamp(value)
}
function limitOf(value: number | undefined) {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}
function nonblank(value: string, name: string) {
  const normalized = value.trim()
  if (!normalized || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}
function requiredHeldAt(vote: VoteRead) {
  if (!(vote.heldAt instanceof Date) || Number.isNaN(vote.heldAt.valueOf())) {
    throw new LegislationError("unprocessable", "Vote heldAt is incomplete")
  }
  return vote.heldAt.toISOString()
}
function requiredPositionSequence(position: typeof votePositions.$inferSelect): number {
  if (
    typeof position.sourceSequence !== "number" ||
    !Number.isSafeInteger(position.sourceSequence) ||
    position.sourceSequence < 0
  ) {
    throw new LegislationError("unprocessable", "Vote position source sequence is incomplete")
  }
  return position.sourceSequence
}
function voteScope(input: VoteListInput): VoteCursorScope {
  return {
    billId: input.billId ?? null,
    classification: input.classification ?? null,
    from: input.from ?? null,
    jurisdictionId: input.jurisdictionId ?? null,
    organizationId: input.organizationId ?? null,
    personId: input.personId ?? null,
    result: input.result ?? null,
    sort: input.sort ?? "held-desc",
    to: input.to ?? null
  }
}
function positionScope(input: VotePositionListInput): PositionCursorScope {
  return {
    options: [...(input.options ?? [])].sort(),
    personId: input.personId ?? null,
    voteId: nonblank(input.voteId, "voteId")
  }
}
function personVoteScope(input: PersonVoteListInput): PersonVoteCursorScope {
  return {
    from: input.from ?? null,
    option: input.option ?? null,
    organizationId: input.organizationId ?? null,
    personId: nonblank(input.personId, "personId"),
    to: input.to ?? null
  }
}
function encodeVoteCursor(value: Omit<VoteCursor, "version">) {
  return encode({ ...value, version: 1 })
}
function encodePositionCursor(value: Omit<PositionCursor, "version">) {
  return encode({ ...value, version: 1 })
}
function encodePersonVoteCursor(value: Omit<PersonVoteCursor, "version">) {
  return encode({ ...value, version: 1 })
}
function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}
function decodeVoteCursor(value: string | undefined, scope: VoteCursorScope): VoteCursor | undefined {
  const parsed = decode(value, "vote pagination cursor")
  if (parsed === undefined) {
    return undefined
  }
  if (
    !record(parsed) ||
    parsed.version !== 1 ||
    !text(parsed.id) ||
    !isRfc3339Timestamp(parsed.heldAt) ||
    !sameScope(parsed.scope, scope)
  ) {
    throw invalid("vote pagination cursor")
  }
  return { heldAt: parsed.heldAt, id: parsed.id, scope, version: 1 }
}
function decodePositionCursor(value: string | undefined, scope: PositionCursorScope): PositionCursor | undefined {
  const parsed = decode(value, "vote position pagination cursor")
  if (parsed === undefined) {
    return undefined
  }
  if (
    !record(parsed) ||
    parsed.version !== 1 ||
    !text(parsed.sourceIdentity) ||
    !nonnegativeInteger(parsed.sourceSequence) ||
    !sameScope(parsed.scope, scope)
  ) {
    throw invalid("vote position pagination cursor")
  }
  return { scope, sourceIdentity: parsed.sourceIdentity, sourceSequence: parsed.sourceSequence, version: 1 }
}
function decodePersonVoteCursor(value: string | undefined, scope: PersonVoteCursorScope): PersonVoteCursor | undefined {
  const parsed = decode(value, "person vote pagination cursor")
  if (parsed === undefined) {
    return undefined
  }
  if (
    !record(parsed) ||
    parsed.version !== 1 ||
    !text(parsed.voteId) ||
    !text(parsed.sourceIdentity) ||
    !nonnegativeInteger(parsed.sourceSequence) ||
    !isRfc3339Timestamp(parsed.heldAt) ||
    !sameScope(parsed.scope, scope)
  ) {
    throw invalid("person vote pagination cursor")
  }
  return {
    heldAt: parsed.heldAt,
    scope,
    sourceIdentity: parsed.sourceIdentity,
    sourceSequence: parsed.sourceSequence,
    voteId: parsed.voteId,
    version: 1
  }
}
function decode(value: string | undefined, label: string): unknown | undefined {
  if (value === undefined) {
    return undefined
  }
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
  } catch {
    throw invalid(label)
  }
}
function invalid(label: string) {
  return new LegislationError("invalid_request", `Invalid ${label}`)
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}
function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}
function sameScope(value: unknown, expected: object) {
  return record(value) && JSON.stringify(value) === JSON.stringify(expected)
}
async function assertVotePositionSequences(database: LegislationDatabase, voteId: string): Promise<void> {
  if (
    (
      await database
        .select({ sourceIdentity: votePositions.sourceIdentity })
        .from(votePositions)
        .where(and(eq(votePositions.voteId, voteId), isNull(votePositions.sourceSequence)))
        .limit(1)
    )[0] !== undefined
  ) {
    throw new LegislationError("unprocessable", "Vote position source sequence is incomplete")
  }
}
