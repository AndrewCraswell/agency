import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  projectMeetingParticipant,
  projectOrganizationSummary,
  projectPersonSummary,
  type OrganizationSummary,
  type PersonSummary
} from "./canonical-projection"
import { sourceProjectionContext } from "./canonical-read"
import { persistedSourceProjectionContext } from "./persisted-source-projection"

export interface MeetingParticipantProjectionRead {
  meeting: Readonly<{
    createdAt: Date
    id: string
    sourceUpdatedAt: Date | null
    sourceUrl: string | null
    updatedAt: Date
  }>
  organization: OrganizationPersistenceRead | null
  participant: Readonly<{ eventId?: string; id: string; name: string; role: string | null }>
  person: PersonPersistenceRead | null
}

type PersonPersistenceRead = Readonly<{
  createdAt: Date
  familyName: string | null
  givenName: string | null
  id: string
  isActive: boolean | null
  jurisdictionId: string | null
  name: string
  party: string | null
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUpdatedAt: Date | null
  sourceUrl: string | null
  updatedAt: Date
}>

type OrganizationPersistenceRead = Readonly<{
  chamber: string | null
  classification: string | null
  createdAt: Date
  id: string
  isActive: boolean | null
  jurisdictionId: string | null
  name: string
  parentOrganizationId: string | null
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUpdatedAt: Date | null
  sourceUrl: string | null
  updatedAt: Date
}>

export function projectMeetingParticipantRead(read: MeetingParticipantProjectionRead, apiBaseUrl: string) {
  const meetingId = requiredText(read.participant.eventId ?? read.meeting.id, "meeting participant meetingId")
  if (read.participant.eventId !== undefined && read.participant.eventId !== read.meeting.id) {
    throw new LegislationError("unprocessable", "meeting participant does not belong to its projected meeting")
  }
  const source = meetingSource(read.meeting)
  return projectMeetingParticipant(
    {
      id: requiredText(read.participant.id, "meeting participant ID"),
      meetingId,
      name: requiredText(read.participant.name, "meeting participant name"),
      organization: read.organization === null ? null : projectOrganization(read.organization, apiBaseUrl),
      person: read.person === null ? null : projectPerson(read.person, apiBaseUrl),
      role: read.participant.role,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function projectPerson(read: PersonPersistenceRead, apiBaseUrl: string): PersonSummary {
  const context = persistedSourceProjectionContext([read], apiBaseUrl, "person")
  return projectPersonSummary(
    {
      familyName: read.familyName,
      givenName: read.givenName,
      id: requiredText(read.id, "person ID"),
      imageUrl: null,
      isActive: requiredBoolean(read.isActive, "person isActive"),
      jurisdictionIds: [requiredText(read.jurisdictionId, "person jurisdictionId")],
      name: requiredText(read.name, "person name"),
      party: read.party,
      sourceUrl: context.sources[0].sourceUrl
    },
    context
  )
}

function projectOrganization(read: OrganizationPersistenceRead, apiBaseUrl: string): OrganizationSummary {
  const context = persistedSourceProjectionContext([read], apiBaseUrl, "organization")
  return projectOrganizationSummary(
    {
      chamber: canonicalChamber(read.chamber),
      classification: canonicalOrganizationClassification(read.classification),
      id: requiredText(read.id, "organization ID"),
      isActive: requiredBoolean(read.isActive, "organization isActive"),
      jurisdictionId: requiredText(read.jurisdictionId, "organization jurisdictionId"),
      name: requiredText(read.name, "organization name"),
      parentOrganizationId: read.parentOrganizationId,
      sourceUrl: context.sources[0].sourceUrl
    },
    context
  )
}

function meetingSource(read: MeetingParticipantProjectionRead["meeting"]) {
  return {
    createdAt: read.createdAt,
    id: requiredText(read.id, "meeting ID"),
    sourceUpdatedAt: read.sourceUpdatedAt,
    sourceUrl: requiredText(read.sourceUrl, "meeting sourceUrl"),
    updatedAt: read.updatedAt
  }
}

function canonicalChamber(value: string | null): OrganizationSummary["chamber"] {
  switch (value) {
    case "lower":
    case "upper":
    case "unicameral":
    case "legislature":
    case null:
      return value
    default:
      throw new LegislationError("unprocessable", "organization chamber is not canonical")
  }
}

function canonicalOrganizationClassification(value: string | null): OrganizationSummary["classification"] {
  switch (value) {
    case "legislature":
    case "chamber":
    case "committee":
    case "subcommittee":
    case "commission":
    case "agency":
    case "other":
      return value
    default:
      throw new LegislationError("unprocessable", "organization classification is not canonical")
  }
}

function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}

function requiredText(value: string | null, name: string): string {
  if (!isNonemptyString(value)) {
    throw new LegislationError("unprocessable", `${name} must be non-empty`)
  }
  return value
}

function isNonemptyString(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}
