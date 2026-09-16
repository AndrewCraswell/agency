import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  eventAgendaItemAmendments,
  eventAgendaItemBills,
  eventAgendaItems,
  eventAgendaItemSupportingMaterials,
  legislativeEvents
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface MeetingAgendaListInput {
  cursor?: string
  limit?: number
  meetingId: string
}

export interface MeetingAgendaItemLookup {
  agendaItemId: string
  meetingId: string
}

export interface MeetingAgendaPage {
  items: MeetingAgendaItemRead[]
  nextCursor?: string
  truncated: boolean
}

export interface MeetingAgendaItemRead {
  amendmentIds: string[] | null
  billIds: string[] | null
  description: string | null
  id: string
  materialIds: string[] | null
  meetingId: string
  ordinal: number
  source: {
    createdAt: Date
    id: string
    sourceUpdatedAt: Date | null
    sourceUrl: string
    updatedAt: Date
    upstreamIds: Record<string, string>
  }
  status: string | null
  title: string
}

type MeetingAgendaPersistenceRead = {
  agendaItem: Pick<
    typeof eventAgendaItems.$inferSelect,
    | "amendmentRelationsComplete"
    | "billRelationsComplete"
    | "canonicalFactsComplete"
    | "description"
    | "eventId"
    | "id"
    | "materialRelationsComplete"
    | "ordinal"
    | "status"
    | "title"
  >
  source: Pick<
    typeof legislativeEvents.$inferSelect,
    "createdAt" | "id" | "sourceUpdatedAt" | "sourceUrl" | "updatedAt" | "upstreamIds"
  >
}

type AgendaCursor = {
  id: string
  ordinal: number
  scope: { meetingId: string }
  version: 1
}

type AgendaRelationIds = {
  amendmentIds: string[]
  billIds: string[]
  materialIds: string[]
}

/** Publish source-described agenda items, preserving unknown relationships as null. */
export function buildMeetingAgendaListQuery(database: LegislationDatabase, input: MeetingAgendaListInput) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  return agendaBaseQuery(database)
    .where(and(...agendaVisibility(scope.meetingId), cursorPredicate(cursor)))
    .orderBy(asc(eventAgendaItems.ordinal), asc(eventAgendaItems.id))
    .limit(limit + 1)
}

/** The compound predicate prevents a valid agenda ID from being exposed below a different meeting. */
export function buildMeetingAgendaItemReadQuery(database: LegislationDatabase, input: MeetingAgendaItemLookup) {
  return agendaBaseQuery(database)
    .where(
      and(
        ...agendaVisibility(requiredInputText(input.meetingId, "meetingId")),
        eq(eventAgendaItems.id, requiredInputText(input.agendaItemId, "agendaItemId"))
      )
    )
    .limit(1)
}

export function buildMeetingAgendaExistenceQuery(database: LegislationDatabase, meetingId: string) {
  return database
    .select({ id: legislativeEvents.id })
    .from(legislativeEvents)
    .where(
      and(eq(legislativeEvents.id, requiredInputText(meetingId, "meetingId")), eq(legislativeEvents.isDeleted, false))
    )
    .limit(1)
}

export async function assertMeetingExists(database: LegislationDatabase, meetingId: string): Promise<void> {
  if ((await buildMeetingAgendaExistenceQuery(database, meetingId))[0] === undefined) {
    throw new LegislationError("not_found", `Meeting ${meetingId} was not found`)
  }
}

export async function listMeetingAgenda(
  database: LegislationDatabase,
  input: MeetingAgendaListInput
): Promise<MeetingAgendaPage> {
  const limit = parseLimit(input.limit)
  const rows = await buildMeetingAgendaListQuery(database, input)
  const items = rows.slice(0, limit)
  const relations = await agendaRelationIds(
    database,
    items.map((item) => item.agendaItem.id)
  )
  const last = items.at(-1)
  return {
    items: items.map((item) => meetingAgendaReadFromPersistence(item, relations.get(item.agendaItem.id))),
    nextCursor:
      rows.length > limit && last !== undefined ? encodeCursor(last.agendaItem, cursorScope(input)) : undefined,
    truncated: rows.length > limit
  }
}

export async function getMeetingAgendaItemRead(
  database: LegislationDatabase,
  input: MeetingAgendaItemLookup
): Promise<MeetingAgendaItemRead> {
  const row = (await buildMeetingAgendaItemReadQuery(database, input))[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Agenda item ${input.agendaItemId} was not found`)
  }
  const relations = await agendaRelationIds(database, [row.agendaItem.id])
  return meetingAgendaReadFromPersistence(row, relations.get(row.agendaItem.id))
}

export function meetingAgendaReadFromPersistence(
  value: MeetingAgendaPersistenceRead,
  relations: AgendaRelationIds | undefined
): MeetingAgendaItemRead {
  if (relations === undefined) {
    throw new LegislationError("not_found", `Agenda item ${value.agendaItem.id} was not found`)
  }
  return {
    amendmentIds: value.agendaItem.amendmentRelationsComplete ? relations.amendmentIds : null,
    billIds: value.agendaItem.billRelationsComplete ? relations.billIds : null,
    description: nullableText(value.agendaItem.description, "agenda item description"),
    id: requiredText(value.agendaItem.id, "agenda item ID"),
    materialIds: value.agendaItem.materialRelationsComplete ? relations.materialIds : null,
    meetingId: requiredText(value.agendaItem.eventId, "agenda item meetingId"),
    ordinal: nonnegativeInteger(value.agendaItem.ordinal, "agenda item ordinal"),
    source: {
      createdAt: value.source.createdAt,
      id: requiredText(value.source.id, "meeting ID"),
      sourceUpdatedAt: value.source.sourceUpdatedAt,
      sourceUrl: requiredText(value.source.sourceUrl, "meeting source URL"),
      updatedAt: value.source.updatedAt,
      upstreamIds: value.source.upstreamIds
    },
    status: nullableText(value.agendaItem.status, "agenda item status"),
    title: requiredText(value.agendaItem.title?.trim() || value.agendaItem.description, "agenda item title")
  }
}

function agendaBaseQuery(database: LegislationDatabase) {
  return database
    .select({
      agendaItem: {
        amendmentRelationsComplete: eventAgendaItems.amendmentRelationsComplete,
        billRelationsComplete: eventAgendaItems.billRelationsComplete,
        canonicalFactsComplete: eventAgendaItems.canonicalFactsComplete,
        description: eventAgendaItems.description,
        eventId: eventAgendaItems.eventId,
        id: eventAgendaItems.id,
        materialRelationsComplete: eventAgendaItems.materialRelationsComplete,
        ordinal: eventAgendaItems.ordinal,
        status: eventAgendaItems.status,
        title: eventAgendaItems.title
      },
      source: {
        createdAt: legislativeEvents.createdAt,
        id: legislativeEvents.id,
        sourceUpdatedAt: legislativeEvents.sourceUpdatedAt,
        sourceUrl: legislativeEvents.sourceUrl,
        updatedAt: legislativeEvents.updatedAt,
        upstreamIds: legislativeEvents.upstreamIds
      }
    })
    .from(eventAgendaItems)
    .innerJoin(legislativeEvents, eq(legislativeEvents.id, eventAgendaItems.eventId))
}

function agendaVisibility(meetingId: string): [SQL, ...SQL[]] {
  return [
    eq(eventAgendaItems.eventId, meetingId),
    eq(legislativeEvents.isDeleted, false),
    sql`${legislativeEvents.sourceUrl} ~ '^https?://'`,
    sql`length(trim(coalesce(nullif(${eventAgendaItems.title}, ''), ${eventAgendaItems.description}, ''))) > 0`
  ]
}

async function agendaRelationIds(database: LegislationDatabase, agendaItemIds: readonly string[]) {
  const relations = new Map<string, AgendaRelationIds>(
    agendaItemIds.map((agendaItemId) => [agendaItemId, { amendmentIds: [], billIds: [], materialIds: [] }])
  )
  if (agendaItemIds.length === 0) {
    return relations
  }
  const [billRows, amendmentRows, materialRows] = await Promise.all([
    database
      .select({ agendaItemId: eventAgendaItemBills.agendaItemId, id: eventAgendaItemBills.billId })
      .from(eventAgendaItemBills)
      .where(inArray(eventAgendaItemBills.agendaItemId, agendaItemIds))
      .orderBy(asc(eventAgendaItemBills.billId)),
    database
      .select({ agendaItemId: eventAgendaItemAmendments.agendaItemId, id: eventAgendaItemAmendments.amendmentId })
      .from(eventAgendaItemAmendments)
      .where(inArray(eventAgendaItemAmendments.agendaItemId, agendaItemIds))
      .orderBy(asc(eventAgendaItemAmendments.amendmentId)),
    database
      .select({
        agendaItemId: eventAgendaItemSupportingMaterials.agendaItemId,
        id: eventAgendaItemSupportingMaterials.materialId
      })
      .from(eventAgendaItemSupportingMaterials)
      .where(inArray(eventAgendaItemSupportingMaterials.agendaItemId, agendaItemIds))
      .orderBy(asc(eventAgendaItemSupportingMaterials.materialId))
  ])
  for (const row of billRows) {
    relations.get(row.agendaItemId)?.billIds.push(row.id)
  }
  for (const row of amendmentRows) {
    relations.get(row.agendaItemId)?.amendmentIds.push(row.id)
  }
  for (const row of materialRows) {
    relations.get(row.agendaItemId)?.materialIds.push(row.id)
  }
  return relations
}

function cursorScope(input: MeetingAgendaListInput): AgendaCursor["scope"] {
  return { meetingId: requiredInputText(input.meetingId, "meetingId") }
}

function cursorPredicate(cursor: AgendaCursor | undefined): SQL | undefined {
  return cursor === undefined
    ? undefined
    : or(
        gt(eventAgendaItems.ordinal, cursor.ordinal),
        and(eq(eventAgendaItems.ordinal, cursor.ordinal), gt(eventAgendaItems.id, cursor.id))
      )
}

function encodeCursor(
  agendaItem: Pick<typeof eventAgendaItems.$inferSelect, "id" | "ordinal">,
  scope: AgendaCursor["scope"]
): string {
  return Buffer.from(
    JSON.stringify({
      id: requiredText(agendaItem.id, "agenda item ID"),
      ordinal: nonnegativeInteger(agendaItem.ordinal, "agenda item ordinal"),
      scope,
      version: 1
    } satisfies AgendaCursor)
  ).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: AgendaCursor["scope"]): AgendaCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4096) {
    throw invalidCursor()
  }
  try {
    const candidate: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      !isRecord(candidate) ||
      candidate.version !== 1 ||
      !isNonemptyString(candidate.id) ||
      !isNonnegativeInteger(candidate.ordinal) ||
      !isRecord(candidate.scope) ||
      candidate.scope.meetingId !== scope.meetingId
    ) {
      throw invalidCursor()
    }
    return { id: candidate.id, ordinal: candidate.ordinal, scope, version: 1 }
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw invalidCursor()
  }
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
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
    throw new LegislationError("unprocessable", `${name} must not be empty`)
  }
  return value
}

function nullableText(value: string | null, name: string): string | null {
  return value === null ? null : requiredText(value, name)
}

function nonnegativeInteger(value: number, name: string): number {
  if (!isNonnegativeInteger(value)) {
    throw new LegislationError("unprocessable", `${name} must be a nonnegative integer`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid meeting agenda pagination cursor")
}
