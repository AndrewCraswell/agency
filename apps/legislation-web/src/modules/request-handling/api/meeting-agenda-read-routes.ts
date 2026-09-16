import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  MeetingAgendaItemLookup,
  MeetingAgendaItemRead,
  MeetingAgendaListInput,
  MeetingAgendaPage
} from "../../legislation/persistence/queries/meeting-agenda-read.js"
import { projectAgendaItem } from "./canonical-projection.js"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface MeetingAgendaReadApi {
  assertMeetingExists: (meetingId: string) => Promise<void>
  getMeetingAgendaItemRead: (input: MeetingAgendaItemLookup) => Promise<MeetingAgendaItemRead>
  listMeetingAgenda: (input: MeetingAgendaListInput) => Promise<MeetingAgendaPage>
}

export function createMeetingAgendaReadApiHandler(
  service: MeetingAgendaReadApi,
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
  service: MeetingAgendaReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  meetingId: string,
  apiBaseUrl: string
): Promise<void> {
  assertAllowedQueryParameters(url, ["cursor", "limit"])
  const limit = queryLimit(url)
  const cursor = queryText(url, "cursor", 4096)
  await service.assertMeetingExists(meetingId)
  const page = await service.listMeetingAgenda({ cursor, limit, meetingId })
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), limit))
}

async function handleItem(
  service: MeetingAgendaReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  route: Readonly<{ agendaItemId: string; kind: "item"; meetingId: string }>,
  apiBaseUrl: string
): Promise<void> {
  assertAllowedQueryParameters(url, [])
  const item = await service.getMeetingAgendaItemRead({
    agendaItemId: route.agendaItemId,
    meetingId: route.meetingId
  })
  sendApiJson(response, 200, apiResource(request, projectMeetingAgendaItemRead(item, apiBaseUrl)))
}

function projectPage(page: MeetingAgendaPage, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectMeetingAgendaItemRead(item, apiBaseUrl)) }
}

export function projectMeetingAgendaItemRead(item: MeetingAgendaItemRead, apiBaseUrl: string) {
  return projectAgendaItem(
    {
      amendmentIds: item.amendmentIds,
      billIds: item.billIds,
      description: item.description,
      id: item.id,
      materialIds: item.materialIds,
      meetingId: item.meetingId,
      ordinal: item.ordinal,
      sourceUrl: item.source.sourceUrl,
      status: item.status,
      title: item.title
    },
    sourceProjectionContext(item.source, apiBaseUrl)
  )
}

function routeMatch(
  method: string | undefined,
  pathname: string
):
  | Readonly<{ kind: "collection"; meetingId: string }>
  | Readonly<{
      agendaItemId: string
      kind: "item"
      meetingId: string
    }>
  | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/")
  if (segments[0] !== "" || segments[1] !== "api" || segments[2] !== "meetings" || segments[4] !== "agenda") {
    return undefined
  }
  if (segments.length === 5) {
    return { kind: "collection", meetingId: canonicalPathId(decodePathSegment(segments[3]), "meetingId") }
  }
  if (segments.length === 6 && segments[5] !== "") {
    return {
      agendaItemId: canonicalPathId(decodePathSegment(segments[5]), "agendaItemId"),
      kind: "item",
      meetingId: canonicalPathId(decodePathSegment(segments[3]), "meetingId")
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
