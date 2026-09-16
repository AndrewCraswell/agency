import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  eventParticipants,
  legislativeEvents,
  organizations,
  people
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, eq, gt, or, type SQL } from "drizzle-orm"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface MeetingParticipantListInput {
  cursor?: string
  limit?: number
  meetingId: string
  organizationId?: string
  personId?: string
  role?: string
}

export interface MeetingParticipantPage {
  items: MeetingParticipantRead[]
  nextCursor?: string
  truncated: boolean
}

export interface MeetingParticipantRead {
  meeting: Pick<
    typeof legislativeEvents.$inferSelect,
    "createdAt" | "id" | "sourceUpdatedAt" | "sourceUrl" | "updatedAt"
  >
  organization: LinkedOrganization | null
  participant: Pick<typeof eventParticipants.$inferSelect, "eventId" | "id" | "name" | "role">
  person: LinkedPerson | null
}

type LinkedPerson = Pick<
  typeof people.$inferSelect,
  | "createdAt"
  | "familyName"
  | "givenName"
  | "id"
  | "isActive"
  | "jurisdictionId"
  | "name"
  | "party"
  | "provenanceComplete"
  | "sourceIsOfficial"
  | "sourceProvider"
  | "sourceRetrievedAt"
  | "sourceUpdatedAt"
  | "sourceUrl"
  | "updatedAt"
>

type LinkedOrganization = Pick<
  typeof organizations.$inferSelect,
  | "chamber"
  | "classification"
  | "createdAt"
  | "id"
  | "isActive"
  | "jurisdictionId"
  | "name"
  | "parentOrganizationId"
  | "provenanceComplete"
  | "sourceIsOfficial"
  | "sourceProvider"
  | "sourceRetrievedAt"
  | "sourceUpdatedAt"
  | "sourceUrl"
  | "updatedAt"
>

type ParticipantCursorScope = {
  meetingId: string
  organizationId: string | null
  personId: string | null
  role: string | null
}

type ParticipantCursor = {
  id: string
  name: string
  scope: ParticipantCursorScope
  version: 1
}

/** Checks that the parent remains an addressable, non-deleted meeting before an empty child page is returned. */
export function buildMeetingExistenceQuery(database: LegislationDatabase, meetingId: string) {
  return database
    .select({ id: legislativeEvents.id })
    .from(legislativeEvents)
    .where(
      and(eq(legislativeEvents.id, requiredInputText(meetingId, "meetingId")), eq(legislativeEvents.isDeleted, false))
    )
    .limit(1)
}

export async function assertMeetingExists(database: LegislationDatabase, meetingId: string): Promise<void> {
  if ((await buildMeetingExistenceQuery(database, meetingId))[0] === undefined) {
    throw new LegislationError("not_found", `Meeting ${meetingId} was not found`)
  }
}

export function buildMeetingParticipantListQuery(database: LegislationDatabase, input: MeetingParticipantListInput) {
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  return database
    .select({
      meeting: {
        createdAt: legislativeEvents.createdAt,
        id: legislativeEvents.id,
        sourceUpdatedAt: legislativeEvents.sourceUpdatedAt,
        sourceUrl: legislativeEvents.sourceUrl,
        updatedAt: legislativeEvents.updatedAt
      },
      organization: {
        chamber: organizations.chamber,
        classification: organizations.classification,
        createdAt: organizations.createdAt,
        id: organizations.id,
        isActive: organizations.isActive,
        jurisdictionId: organizations.jurisdictionId,
        name: organizations.name,
        parentOrganizationId: organizations.parentOrganizationId,
        provenanceComplete: organizations.provenanceComplete,
        sourceIsOfficial: organizations.sourceIsOfficial,
        sourceProvider: organizations.sourceProvider,
        sourceRetrievedAt: organizations.sourceRetrievedAt,
        sourceUpdatedAt: organizations.sourceUpdatedAt,
        sourceUrl: organizations.sourceUrl,
        updatedAt: organizations.updatedAt
      },
      participant: {
        eventId: eventParticipants.eventId,
        id: eventParticipants.id,
        name: eventParticipants.name,
        role: eventParticipants.role
      },
      person: {
        createdAt: people.createdAt,
        familyName: people.familyName,
        givenName: people.givenName,
        id: people.id,
        isActive: people.isActive,
        jurisdictionId: people.jurisdictionId,
        name: people.name,
        party: people.party,
        provenanceComplete: people.provenanceComplete,
        sourceIsOfficial: people.sourceIsOfficial,
        sourceProvider: people.sourceProvider,
        sourceRetrievedAt: people.sourceRetrievedAt,
        sourceUpdatedAt: people.sourceUpdatedAt,
        sourceUrl: people.sourceUrl,
        updatedAt: people.updatedAt
      }
    })
    .from(eventParticipants)
    .innerJoin(legislativeEvents, eq(eventParticipants.eventId, legislativeEvents.id))
    .leftJoin(people, eq(eventParticipants.personId, people.id))
    .leftJoin(organizations, eq(eventParticipants.organizationId, organizations.id))
    .where(
      and(
        eq(eventParticipants.eventId, scope.meetingId),
        eq(legislativeEvents.isDeleted, false),
        scope.role === null ? undefined : eq(eventParticipants.role, scope.role),
        scope.personId === null ? undefined : eq(eventParticipants.personId, scope.personId),
        scope.organizationId === null ? undefined : eq(eventParticipants.organizationId, scope.organizationId),
        cursorPredicate(cursor)
      )
    )
    .orderBy(asc(eventParticipants.name), asc(eventParticipants.id))
    .limit(parseLimit(input.limit) + 1)
}

export async function listMeetingParticipants(
  database: LegislationDatabase,
  input: MeetingParticipantListInput
): Promise<MeetingParticipantPage> {
  const limit = parseLimit(input.limit)
  const rows = await buildMeetingParticipantListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: truncated && last !== undefined ? encodeCursor(last.participant, cursorScope(input)) : undefined,
    truncated
  }
}

function cursorScope(input: MeetingParticipantListInput): ParticipantCursorScope {
  return {
    meetingId: requiredInputText(input.meetingId, "meetingId"),
    organizationId: optionalInputText(input.organizationId, "organizationId") ?? null,
    personId: optionalInputText(input.personId, "personId") ?? null,
    role: optionalInputText(input.role, "role") ?? null
  }
}

function cursorPredicate(cursor: ParticipantCursor | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  return or(
    gt(eventParticipants.name, cursor.name),
    and(eq(eventParticipants.name, cursor.name), gt(eventParticipants.id, cursor.id))
  )
}

function encodeCursor(
  participant: Pick<typeof eventParticipants.$inferSelect, "id" | "name">,
  scope: ParticipantCursorScope
): string {
  return Buffer.from(JSON.stringify({ id: participant.id, name: participant.name, scope, version: 1 })).toString(
    "base64url"
  )
}

function decodeCursor(cursor: string | undefined, scope: ParticipantCursorScope): ParticipantCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !isNonemptyString(value.id) ||
      !isNonemptyString(value.name) ||
      !sameScope(value.scope, scope)
    ) {
      throw new Error("Invalid cursor")
    }
    return { id: value.id, name: value.name, scope, version: 1 }
  } catch {
    throw new LegislationError("invalid_request", "Invalid meeting participant pagination cursor")
  }
}

function sameScope(value: unknown, scope: ParticipantCursorScope): boolean {
  return (
    isRecord(value) &&
    value.meetingId === scope.meetingId &&
    value.organizationId === scope.organizationId &&
    value.personId === scope.personId &&
    value.role === scope.role
  )
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function optionalInputText(value: string | undefined, name: string): string | undefined {
  return value === undefined ? undefined : requiredInputText(value, name)
}

function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}
