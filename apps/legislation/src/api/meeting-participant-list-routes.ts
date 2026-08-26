import type { IncomingMessage, ServerResponse } from "node:http"
import type { MeetingParticipantListInput, MeetingParticipantPage } from "../db/queries/meeting-participant-reads.js"
import { LegislationError } from "../legislation/errors.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import { projectMeetingParticipantRead } from "./meeting-participant-projection.js"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface MeetingParticipantListApi {
  assertMeetingExists: (meetingId: string) => Promise<void>
  listMeetingParticipants: (input: MeetingParticipantListInput) => Promise<MeetingParticipantPage>
}

export function createMeetingParticipantListApiHandler(
  service: MeetingParticipantListApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleMeetingParticipantListRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleMeetingParticipantListRequest(
  service: MeetingParticipantListApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const meetingId = routeMatch(request.method, url.pathname)
  if (meetingId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, ["cursor", "limit", "organizationId", "personId", "role"])
  const input: MeetingParticipantListInput = {
    cursor: optionalBoundedQuery(url, "cursor", 4096),
    limit: queryLimit(url),
    meetingId,
    organizationId: optionalBoundedQuery(url, "organizationId"),
    personId: optionalBoundedQuery(url, "personId"),
    role: optionalBoundedQuery(url, "role")
  }
  await service.assertMeetingExists(meetingId)
  const page = await service.listMeetingParticipants(input)
  sendApiJson(
    response,
    200,
    apiPage(
      request,
      { ...page, items: page.items.map((item) => projectMeetingParticipantRead(item, apiBaseUrl)) },
      input.limit ?? DEFAULT_LIMIT
    )
  )
  return true
}

function routeMatch(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/")
  if (
    segments.length !== 5 ||
    segments[0] !== "" ||
    segments[1] !== "api" ||
    segments[2] !== "meetings" ||
    segments[4] !== "participants"
  ) {
    return undefined
  }
  return canonicalPathId(decodePathSegment(segments[3]), "meetingId")
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function queryLimit(url: URL): number {
  const value = singleQueryValue(url, "limit")
  if (value === undefined) {
    return DEFAULT_LIMIT
  }
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function optionalBoundedQuery(url: URL, name: string, maximumLength = 256): string | undefined {
  const value = singleQueryValue(url, name)
  if (value === undefined || value.length < 1 || value.length > maximumLength) {
    if (value === undefined) {
      return undefined
    }
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximumLength} characters`)
  }
  return value
}

function singleQueryValue(url: URL, name: string): string | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("invalid_request", `${name} must appear once`)
  }
  return values[0]
}

function canonicalPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
