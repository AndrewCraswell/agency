import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  MeetingOutcomeListInput,
  MeetingOutcomePage,
  MeetingOutcomeRead
} from "../db/queries/meeting-outcome-read.js"
import { LegislationError } from "../legislation/errors.js"
import { projectMeetingOutcome, type ProjectionContext } from "./canonical-projection.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface MeetingOutcomeReadApi {
  assertMeetingOutcomeParentExists: (meetingId: string) => Promise<void>
  getMeetingOutcomeRead: (input: Readonly<{ meetingId: string; outcomeId: string }>) => Promise<MeetingOutcomeRead>
  listMeetingOutcomes: (input: MeetingOutcomeListInput) => Promise<MeetingOutcomePage>
}

export function createMeetingOutcomeReadApiHandler(
  service: MeetingOutcomeReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      const route = routeMatch(request.method, url.pathname)
      if (route === undefined) {
        return false
      }
      if (route.kind === "collection") {
        await handleCollection(service, request, response, url, route.meetingId, options.apiBaseUrl)
      } else {
        await handleItem(service, request, response, url, route, options.apiBaseUrl)
      }
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
    }
    return true
  }
}

async function handleCollection(
  service: MeetingOutcomeReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  meetingId: string,
  apiBaseUrl: string
): Promise<void> {
  assertAllowedQueryParameters(url, ["billId", "classification", "cursor", "limit"])
  const limit = queryLimit(url)
  await service.assertMeetingOutcomeParentExists(meetingId)
  const page = await service.listMeetingOutcomes({
    billId: queryText(url, "billId", 256),
    classification: queryClassification(url),
    cursor: queryText(url, "cursor", 4096),
    limit,
    meetingId
  })
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), limit))
}

async function handleItem(
  service: MeetingOutcomeReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  route: Readonly<{ kind: "item"; meetingId: string; outcomeId: string }>,
  apiBaseUrl: string
): Promise<void> {
  assertAllowedQueryParameters(url, [])
  const outcome = await service.getMeetingOutcomeRead({ meetingId: route.meetingId, outcomeId: route.outcomeId })
  sendApiJson(response, 200, apiResource(request, projectMeetingOutcomeRead(outcome, apiBaseUrl)))
}

function projectPage(page: MeetingOutcomePage, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectMeetingOutcomeRead(item, apiBaseUrl)) }
}

export function projectMeetingOutcomeRead(outcome: MeetingOutcomeRead, apiBaseUrl: string) {
  return projectMeetingOutcome(
    {
      agendaItemId: outcome.agendaItemId,
      billActionId: outcome.billActionId,
      classification: outcome.classification,
      description: outcome.description,
      id: outcome.id,
      linkMethod: outcome.linkMethod,
      meetingId: outcome.meetingId,
      sourceUrl: outcome.source.sourceUrl,
      voteId: outcome.voteId
    },
    outcomeProjectionContext(outcome, apiBaseUrl)
  )
}

/** Outcome provenance comes solely from its authoritative persisted source fields. */
function outcomeProjectionContext(outcome: MeetingOutcomeRead, apiBaseUrl: string): ProjectionContext {
  return {
    apiBaseUrl,
    sources: [
      {
        isOfficial: outcome.source.isOfficial,
        provider: outcome.source.provider,
        retrievedAt: outcome.source.retrievedAt,
        sourceUpdatedAt: outcome.source.sourceUpdatedAt,
        sourceUrl: outcome.source.sourceUrl
      }
    ],
    updatedAt: outcome.source.updatedAt
  }
}

function routeMatch(
  method: string | undefined,
  pathname: string
):
  | Readonly<{ kind: "collection"; meetingId: string }>
  | Readonly<{ kind: "item"; meetingId: string; outcomeId: string }>
  | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/")
  if (segments[0] !== "" || segments[1] !== "api" || segments[2] !== "meetings" || segments[4] !== "outcomes") {
    return undefined
  }
  if (segments.length === 5) {
    return { kind: "collection", meetingId: canonicalPathId(decodePathSegment(segments[3]), "meetingId") }
  }
  if (segments.length === 6 && segments[5] !== "") {
    return {
      kind: "item",
      meetingId: canonicalPathId(decodePathSegment(segments[3]), "meetingId"),
      outcomeId: canonicalPathId(decodePathSegment(segments[5]), "outcomeId")
    }
  }
  return undefined
}

function decodePathSegment(value: string | undefined): string {
  if (value === undefined) {
    throw new LegislationError("invalid_request", "Path is incomplete")
  }
  try {
    return decodeURIComponent(value)
  } catch {
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function canonicalPathId(value: string, name: string): string {
  if (value.trim().length === 0 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}

function queryLimit(url: URL): number {
  const value = queryText(url, "limit", 16)
  if (value === undefined) {
    return DEFAULT_LIMIT
  }
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", "limit must be a positive integer")
  }
  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function queryText(url: URL, name: string, maximum: number): string | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("invalid_request", `${name} must appear once`)
  }
  const value = values[0]?.trim() ?? ""
  if (value.length === 0 || value.length > maximum) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximum} characters`)
  }
  return value
}

function queryClassification(url: URL): string | undefined {
  const value = queryText(url, "classification", 256)
  if (value === undefined || value === "action" || value === "vote" || value === "disposition" || value === "note") {
    return value
  }
  throw new LegislationError("invalid_request", "classification must be a canonical outcome classification")
}
