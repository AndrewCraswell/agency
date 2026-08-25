import { and, asc, eq, gt, or, type SQL } from "drizzle-orm"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { billActions, eventOutcomes, legislativeEvents, votes } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type MeetingOutcomeClassification = "action" | "disposition" | "note" | "vote"
export type MeetingOutcomeLinkMethod = "deterministic-id" | "explicit"

export interface MeetingOutcomeListInput {
  billId?: string
  classification?: string
  cursor?: string
  limit?: number
  meetingId: string
}

export interface MeetingOutcomeLookup {
  meetingId: string
  outcomeId: string
}

export interface MeetingOutcomePage {
  items: MeetingOutcomeRead[]
  nextCursor?: string
  truncated: boolean
}

export interface MeetingOutcomeRead {
  agendaItemId: string | null
  billActionId: string | null
  classification: MeetingOutcomeClassification
  description: string
  id: string
  linkMethod: MeetingOutcomeLinkMethod
  meetingId: string
  source: {
    isOfficial: boolean
    provider: string
    retrievedAt: Date
    sourceUpdatedAt: Date | null
    sourceUrl: string
    updatedAt: Date
  }
  voteId: string | null
}

type MeetingOutcomePersistenceRead = Pick<
  typeof eventOutcomes.$inferSelect,
  | "actionId"
  | "agendaAssociation"
  | "agendaItemId"
  | "classification"
  | "description"
  | "eventId"
  | "id"
  | "linkMethod"
  | "sourceIsOfficial"
  | "sourceProvider"
  | "sourceRetrievedAt"
  | "sourceSequence"
  | "sourceUpdatedAt"
  | "sourceUrl"
  | "updatedAt"
  | "voteId"
>

type MeetingOutcomeCursorScope = {
  billId: string | null
  classification: MeetingOutcomeClassification | null
  meetingId: string
}

type MeetingOutcomeCursor = {
  id: string
  scope: MeetingOutcomeCursorScope
  sourceSequence: number
  version: 1
}

/** Only canonical outcome rows from a visible parent participate in public reads. */
export function buildMeetingOutcomeExistenceQuery(database: LegislationDatabase, meetingId: string) {
  return database
    .select({ id: legislativeEvents.id })
    .from(legislativeEvents)
    .where(
      and(eq(legislativeEvents.id, requiredInputText(meetingId, "meetingId")), eq(legislativeEvents.isDeleted, false))
    )
    .limit(1)
}

export async function assertMeetingOutcomeParentExists(
  database: LegislationDatabase,
  meetingId: string
): Promise<void> {
  if ((await buildMeetingOutcomeExistenceQuery(database, meetingId))[0] === undefined) {
    throw new LegislationError("not_found", `Meeting ${meetingId} was not found`)
  }
}

/**
 * `billId` intentionally resolves only through a persisted action or vote
 * target. Agenda links, event links, descriptions, and temporal proximity are
 * not evidence that an outcome belongs to a bill.
 */
export function buildMeetingOutcomeListQuery(database: LegislationDatabase, input: MeetingOutcomeListInput) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  return outcomeBaseQuery(database)
    .where(
      and(
        eq(eventOutcomes.eventId, scope.meetingId),
        eq(legislativeEvents.isDeleted, false),
        scope.classification === null ? undefined : eq(eventOutcomes.classification, scope.classification),
        scope.billId === null ? undefined : or(eq(billActions.billId, scope.billId), eq(votes.billId, scope.billId)),
        cursorPredicate(cursor)
      )
    )
    .orderBy(asc(eventOutcomes.sourceSequence), asc(eventOutcomes.id))
    .limit(limit + 1)
}

/** A child ID is always constrained by its path meeting and visible parent. */
export function buildMeetingOutcomeReadQuery(database: LegislationDatabase, input: MeetingOutcomeLookup) {
  return outcomeBaseQuery(database)
    .where(
      and(
        eq(eventOutcomes.eventId, requiredInputText(input.meetingId, "meetingId")),
        eq(eventOutcomes.id, requiredInputText(input.outcomeId, "outcomeId")),
        eq(legislativeEvents.isDeleted, false)
      )
    )
    .limit(1)
}

export async function listMeetingOutcomes(
  database: LegislationDatabase,
  input: MeetingOutcomeListInput
): Promise<MeetingOutcomePage> {
  const limit = parseLimit(input.limit)
  const rows = await buildMeetingOutcomeListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items: items.map(meetingOutcomeReadFromPersistence),
    nextCursor: truncated && last !== undefined ? encodeCursor(last, cursorScope(input)) : undefined,
    truncated
  }
}

export async function getMeetingOutcomeRead(
  database: LegislationDatabase,
  input: MeetingOutcomeLookup
): Promise<MeetingOutcomeRead> {
  const row = (await buildMeetingOutcomeReadQuery(database, input))[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Outcome ${input.outcomeId} was not found for meeting ${input.meetingId}`)
  }
  return meetingOutcomeReadFromPersistence(row)
}

/** Validates persisted canonical facts instead of filling missing fields from related records. */
export function meetingOutcomeReadFromPersistence(value: MeetingOutcomePersistenceRead): MeetingOutcomeRead {
  const classification = canonicalClassification(value.classification)
  const agendaItemId = canonicalAgendaItemId(value.agendaAssociation, value.agendaItemId)
  const billActionId = nullableId(value.actionId, "outcome billActionId")
  const voteId = nullableId(value.voteId, "outcome voteId")
  assertOutcomeTarget(classification, billActionId, voteId)
  return {
    agendaItemId,
    billActionId,
    classification,
    description: requiredText(value.description, "outcome description"),
    id: requiredText(value.id, "outcome ID"),
    linkMethod: canonicalLinkMethod(value.linkMethod),
    meetingId: requiredText(value.eventId, "outcome meetingId"),
    source: {
      isOfficial: requiredBoolean(value.sourceIsOfficial, "outcome sourceIsOfficial"),
      provider: requiredText(value.sourceProvider, "outcome sourceProvider"),
      retrievedAt: requiredDate(value.sourceRetrievedAt, "outcome sourceRetrievedAt"),
      sourceUpdatedAt: nullableDate(value.sourceUpdatedAt, "outcome sourceUpdatedAt"),
      sourceUrl: requiredText(value.sourceUrl, "outcome sourceUrl"),
      updatedAt: requiredDate(value.updatedAt, "outcome updatedAt")
    },
    voteId
  }
}

function outcomeBaseQuery(database: LegislationDatabase) {
  return database
    .select({
      actionId: eventOutcomes.actionId,
      agendaAssociation: eventOutcomes.agendaAssociation,
      agendaItemId: eventOutcomes.agendaItemId,
      classification: eventOutcomes.classification,
      description: eventOutcomes.description,
      eventId: eventOutcomes.eventId,
      id: eventOutcomes.id,
      linkMethod: eventOutcomes.linkMethod,
      sourceIsOfficial: eventOutcomes.sourceIsOfficial,
      sourceProvider: eventOutcomes.sourceProvider,
      sourceRetrievedAt: eventOutcomes.sourceRetrievedAt,
      sourceSequence: eventOutcomes.sourceSequence,
      sourceUpdatedAt: eventOutcomes.sourceUpdatedAt,
      sourceUrl: eventOutcomes.sourceUrl,
      updatedAt: eventOutcomes.updatedAt,
      voteId: eventOutcomes.voteId
    })
    .from(eventOutcomes)
    .innerJoin(legislativeEvents, eq(legislativeEvents.id, eventOutcomes.eventId))
    .leftJoin(billActions, eq(billActions.id, eventOutcomes.actionId))
    .leftJoin(votes, eq(votes.id, eventOutcomes.voteId))
}

function cursorScope(input: MeetingOutcomeListInput): MeetingOutcomeCursorScope {
  return {
    billId: input.billId === undefined ? null : requiredInputText(input.billId, "billId"),
    classification: input.classification === undefined ? null : canonicalClassification(input.classification),
    meetingId: requiredInputText(input.meetingId, "meetingId")
  }
}

function cursorPredicate(cursor: MeetingOutcomeCursor | undefined): SQL | undefined {
  return cursor === undefined
    ? undefined
    : or(
        gt(eventOutcomes.sourceSequence, cursor.sourceSequence),
        and(eq(eventOutcomes.sourceSequence, cursor.sourceSequence), gt(eventOutcomes.id, cursor.id))
      )
}

function encodeCursor(row: MeetingOutcomePersistenceRead, scope: MeetingOutcomeCursorScope): string {
  return Buffer.from(
    JSON.stringify({
      id: requiredText(row.id, "outcome ID"),
      scope,
      sourceSequence: nonnegativeInteger(row.sourceSequence, "outcome sourceSequence"),
      version: 1
    } satisfies MeetingOutcomeCursor)
  ).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: MeetingOutcomeCursorScope): MeetingOutcomeCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4096) {
    throw invalidCursor()
  }
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      !isCursor(decoded) ||
      decoded.scope.meetingId !== scope.meetingId ||
      decoded.scope.classification !== scope.classification ||
      decoded.scope.billId !== scope.billId
    ) {
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

function isCursor(value: unknown): value is MeetingOutcomeCursor {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isNonemptyString(value.id) &&
    isNonnegativeInteger(value.sourceSequence) &&
    isRecord(value.scope) &&
    isNonemptyString(value.scope.meetingId) &&
    (value.scope.classification === null || isClassification(value.scope.classification)) &&
    (value.scope.billId === null || isNonemptyString(value.scope.billId))
  )
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function canonicalAgendaItemId(association: string, agendaItemId: string | null): string | null {
  if (association === "none" && agendaItemId === null) {
    return null
  }
  if (association === "explicit" && agendaItemId !== null) {
    return requiredText(agendaItemId, "outcome agendaItemId")
  }
  throw new LegislationError("unprocessable", "outcome agenda association is incomplete")
}

function canonicalClassification(value: unknown): MeetingOutcomeClassification {
  if (isClassification(value)) {
    return value
  }
  throw new LegislationError("unprocessable", "outcome classification is not canonical")
}

function canonicalLinkMethod(value: string): MeetingOutcomeLinkMethod {
  if (value === "explicit" || value === "deterministic-id") {
    return value
  }
  throw new LegislationError("unprocessable", "outcome linkMethod is not canonical")
}

function assertOutcomeTarget(
  classification: MeetingOutcomeClassification,
  billActionId: string | null,
  voteId: string | null
): void {
  if (classification === "action" && billActionId !== null && voteId === null) {
    return
  }
  if (classification === "vote" && billActionId === null && voteId !== null) {
    return
  }
  if ((classification === "disposition" || classification === "note") && billActionId === null && voteId === null) {
    return
  }
  throw new LegislationError("unprocessable", "outcome target does not match classification")
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

function nullableId(value: string | null, name: string): string | null {
  return value === null ? null : requiredText(value, name)
}

function requiredBoolean(value: boolean, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}

function requiredDate(value: Date, name: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new LegislationError("unprocessable", `${name} must be a valid Date`)
  }
  return value
}

function nullableDate(value: Date | null, name: string): Date | null {
  return value === null ? null : requiredDate(value, name)
}

function nonnegativeInteger(value: number, name: string): number {
  if (!isNonnegativeInteger(value)) {
    throw new LegislationError("unprocessable", `${name} must be a nonnegative integer`)
  }
  return value
}

function isClassification(value: unknown): value is MeetingOutcomeClassification {
  return value === "action" || value === "vote" || value === "disposition" || value === "note"
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid meeting outcome pagination cursor")
}
