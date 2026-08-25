import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  MeetingDocumentListInput,
  MeetingDocumentPage,
  MeetingDocumentRead
} from "../db/queries/meeting-document-read.js"
import { LegislationError } from "../legislation/errors.js"
import { projectEventDocument } from "./canonical-projection.js"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface MeetingDocumentReadApi {
  assertMeetingExists: (meetingId: string) => Promise<void>
  listMeetingDocuments: (input: MeetingDocumentListInput) => Promise<MeetingDocumentPage<MeetingDocumentRead>>
}

export function createMeetingDocumentReadApiHandler(
  service: MeetingDocumentReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleMeetingDocumentRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleMeetingDocumentRequest(
  service: MeetingDocumentReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const meetingId = routeMatch(request.method, url.pathname)
  if (meetingId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, ["classification", "cursor", "limit"])
  const limit = queryLimit(url)
  const classification = queryText(url, "classification", 256)
  const cursor = queryText(url, "cursor", 4096)
  await service.assertMeetingExists(meetingId)
  const page = await service.listMeetingDocuments({ classification, cursor, limit, meetingId })
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), limit))
  return true
}

function projectPage(page: MeetingDocumentPage<MeetingDocumentRead>, apiBaseUrl: string) {
  return {
    ...page,
    items: page.items.map((item) =>
      projectEventDocument(
        {
          classification: item.classification,
          documentId: item.documentId,
          id: item.id,
          materialId: item.materialId,
          meetingId: item.meetingId,
          sourceUrl: item.sourceUrl,
          title: item.title
        },
        sourceProjectionContext(item, apiBaseUrl)
      )
    )
  }
}

function routeMatch(method: string | undefined, pathname: string): string | undefined {
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
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "meetings" || segments[3] !== "documents") {
    return undefined
  }
  const meetingId = segments[2]
  if (meetingId === undefined || meetingId.length < 1 || meetingId.length > 256) {
    throw new LegislationError("invalid_request", "meetingId must be between 1 and 256 characters")
  }
  return meetingId
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
