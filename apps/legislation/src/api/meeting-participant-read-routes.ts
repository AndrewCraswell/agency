import type { IncomingMessage, ServerResponse } from "node:http"
import type { MeetingParticipantRead } from "../db/queries/meeting-participant-read.js"
import { LegislationError } from "../legislation/errors.js"
import {
  projectMeetingParticipant,
  projectOrganizationSummary,
  projectPersonSummary,
  type OrganizationSummary,
  type PersonSummary
} from "./canonical-projection.js"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiResource,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

export interface MeetingParticipantReadApi {
  getMeetingParticipant: (
    input: Readonly<{ meetingId: string; participantId: string }>
  ) => Promise<MeetingParticipantRead>
}

export function createMeetingParticipantReadApiHandler(
  service: MeetingParticipantReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleMeetingParticipantRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleMeetingParticipantRequest(
  service: MeetingParticipantReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, [])
  const read = await service.getMeetingParticipant(route)
  sendApiJson(response, 200, apiResource(request, projectMeetingParticipantRead(read, apiBaseUrl)))
  return true
}

function projectMeetingParticipantRead(read: MeetingParticipantRead, apiBaseUrl: string) {
  const source = meetingSource(read.meeting)
  return projectMeetingParticipant(
    {
      id: requiredText(read.participant.id, "meeting participant ID"),
      meetingId: requiredText(read.meeting.id, "meeting participant meetingId"),
      name: requiredText(read.participant.name, "meeting participant name"),
      organization: read.organization === null ? null : projectOrganization(read.organization, apiBaseUrl),
      person: read.person === null ? null : projectPerson(read.person, apiBaseUrl),
      role: read.participant.role,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function projectPerson(read: NonNullable<MeetingParticipantRead["person"]>, apiBaseUrl: string): PersonSummary {
  const source = canonicalSource(read, "person")
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
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function projectOrganization(
  read: NonNullable<MeetingParticipantRead["organization"]>,
  apiBaseUrl: string
): OrganizationSummary {
  const source = canonicalSource(read, "organization")
  return projectOrganizationSummary(
    {
      chamber: canonicalChamber(read.chamber),
      classification: canonicalOrganizationClassification(read.classification),
      id: requiredText(read.id, "organization ID"),
      isActive: requiredBoolean(read.isActive, "organization isActive"),
      jurisdictionId: requiredText(read.jurisdictionId, "organization jurisdictionId"),
      name: requiredText(read.name, "organization name"),
      parentOrganizationId: read.parentOrganizationId,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function meetingSource(read: MeetingParticipantRead["meeting"]) {
  return {
    createdAt: read.createdAt,
    id: requiredText(read.id, "meeting ID"),
    sourceUpdatedAt: read.sourceUpdatedAt,
    sourceUrl: requiredText(read.sourceUrl, "meeting sourceUrl"),
    updatedAt: read.updatedAt
  }
}

function canonicalSource(
  record: Readonly<{
    createdAt: Date
    id: string
    provenanceComplete: boolean
    sourceIsOfficial: boolean | null
    sourceProvider: string | null
    sourceRetrievedAt: Date | null
    sourceUpdatedAt: Date | null
    sourceUrl: string | null
    updatedAt: Date
  }>,
  name: string
) {
  if (
    !record.provenanceComplete ||
    record.sourceIsOfficial === null ||
    !isNonemptyString(record.sourceProvider) ||
    record.sourceRetrievedAt === null ||
    !isNonemptyString(record.sourceUrl)
  ) {
    throw new LegislationError("unprocessable", `${name} canonical provenance is incomplete`)
  }
  return {
    createdAt: record.createdAt,
    id: record.id,
    sourceUpdatedAt: record.sourceUpdatedAt,
    sourceUrl: record.sourceUrl,
    updatedAt: record.updatedAt
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

function routeMatch(
  method: string | undefined,
  pathname: string
): Readonly<{ meetingId: string; participantId: string }> | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
      }
    })
  if (segments.length !== 5 || segments[0] !== "api" || segments[1] !== "meetings" || segments[3] !== "participants") {
    return undefined
  }
  return {
    meetingId: canonicalPathId(segments[2], "meetingId"),
    participantId: canonicalPathId(segments[4], "participantId")
  }
}

function canonicalPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
