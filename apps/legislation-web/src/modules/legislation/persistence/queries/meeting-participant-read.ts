import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  eventParticipants,
  legislativeEvents,
  organizations,
  people
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, eq } from "drizzle-orm"

export interface MeetingParticipantLookup {
  meetingId: string
  participantId: string
}

export interface MeetingParticipantRead {
  meeting: Pick<
    typeof legislativeEvents.$inferSelect,
    "createdAt" | "id" | "sourceUpdatedAt" | "sourceUrl" | "updatedAt"
  >
  organization: OrganizationSummaryPersistenceRead | null
  participant: Pick<typeof eventParticipants.$inferSelect, "id" | "name" | "role">
  person: PersonSummaryPersistenceRead | null
}

type PersonSummaryPersistenceRead = Pick<
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

type OrganizationSummaryPersistenceRead = Pick<
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

/**
 * Looks up a participant through its public meeting parent. Soft-deleted
 * meetings remain invisible, and a valid participant ID cannot escape the
 * requested meeting path.
 */
export function buildMeetingParticipantReadQuery(database: LegislationDatabase, input: MeetingParticipantLookup) {
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
    .innerJoin(legislativeEvents, eq(legislativeEvents.id, eventParticipants.eventId))
    .leftJoin(people, eq(people.id, eventParticipants.personId))
    .leftJoin(organizations, eq(organizations.id, eventParticipants.organizationId))
    .where(
      and(
        eq(eventParticipants.eventId, requiredInputText(input.meetingId, "meetingId")),
        eq(eventParticipants.id, requiredInputText(input.participantId, "participantId")),
        eq(legislativeEvents.isDeleted, false)
      )
    )
    .limit(1)
}

export async function getMeetingParticipantRead(
  database: LegislationDatabase,
  input: MeetingParticipantLookup
): Promise<MeetingParticipantRead> {
  const row = (await buildMeetingParticipantReadQuery(database, input))[0]
  if (row === undefined) {
    throw new LegislationError(
      "not_found",
      `Participant ${input.participantId} was not found for meeting ${input.meetingId}`
    )
  }
  return row
}

function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new LegislationError("invalid_request", `${name} must not be empty`)
  }
  return normalized
}
