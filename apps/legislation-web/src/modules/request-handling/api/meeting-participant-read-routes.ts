import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { MeetingParticipantRead } from "../../legislation/persistence/queries/meeting-participant-read.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiResource,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import { projectMeetingParticipantRead } from "./meeting-participant-projection.js"

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
