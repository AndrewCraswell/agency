import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "../legislation/errors.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  assertAllowedQueryParameters,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import { projectMeetingRead } from "./meeting-read-projection.js"
import type { MeetingCollectionInput, MeetingCollectionPage } from "./meeting-read-repository.js"

const JURISDICTION_AND_SESSION_PARAMETERS = [
  "classification",
  "cursor",
  "from",
  "limit",
  "organizationId",
  "status",
  "to"
] as const
const ORGANIZATION_PARAMETERS = ["classification", "cursor", "from", "limit", "sort", "status", "to"] as const

export interface MeetingReadApi {
  assertJurisdictionExists(jurisdictionId: string): Promise<void>
  assertOrganizationExists(organizationId: string): Promise<void>
  assertSessionExists(sessionId: string): Promise<void>
  listMeetings(input: MeetingCollectionInput): Promise<MeetingCollectionPage>
}

export function createMeetingReadApiHandler(
  service: MeetingReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleMeetingRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleMeetingRequest(
  service: MeetingReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }
  assertAllowedQueryParameters(
    url,
    route.name === "organization" ? ORGANIZATION_PARAMETERS : JURISDICTION_AND_SESSION_PARAMETERS
  )
  const input = inputFromQuery(url, route)
  if (route.name === "jurisdiction") {
    await service.assertJurisdictionExists(route.id)
  }
  if (route.name === "organization") {
    await service.assertOrganizationExists(route.id)
  }
  if (route.name === "session") {
    await service.assertSessionExists(route.id)
  }
  const page = await service.listMeetings(input)
  sendApiJson(
    response,
    200,
    apiPage(
      request,
      { ...page, items: page.items.map((item) => projectMeetingRead(item, apiBaseUrl)) },
      input.limit ?? 25
    )
  )
  return true
}

function inputFromQuery(url: URL, route: MeetingRoute): MeetingCollectionInput {
  const input: MeetingCollectionInput = {
    classification: enumQuery(url, "classification", ["hearing", "meeting", "other", "session"]),
    cursor: boundedQuery(url, "cursor", 4096),
    from: boundedQuery(url, "from", 64),
    jurisdictionId: route.name === "jurisdiction" ? route.id : undefined,
    limit: queryInteger(url, "limit", 25, 100),
    organizationId: route.name === "organization" ? route.id : boundedQuery(url, "organizationId", 256),
    sessionId: route.name === "session" ? route.id : undefined,
    sort: enumQuery(url, "sort", ["starts-asc", "starts-desc", "updated-desc"]),
    status: enumQuery(url, "status", ["cancelled", "completed", "other", "postponed", "scheduled"]),
    to: boundedQuery(url, "to", 64)
  }
  return input
}

type MeetingRoute = { id: string; name: "jurisdiction" | "organization" | "session" }

function routeMatch(method: string | undefined, pathname: string): MeetingRoute | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/").filter(Boolean).map(decodePathSegment)
  if (segments.length !== 4 || segments[0] !== "api" || segments[3] !== "meetings") {
    return undefined
  }
  if (segments[1] === "jurisdictions") {
    return { id: pathId(segments[2], "jurisdictionId"), name: "jurisdiction" }
  }
  if (segments[1] === "organizations") {
    return { id: pathId(segments[2], "organizationId"), name: "organization" }
  }
  if (segments[1] === "sessions") {
    return { id: pathId(segments[2], "sessionId"), name: "session" }
  }
  return undefined
}

function enumQuery<const T extends readonly string[]>(url: URL, name: string, values: T): T[number] | undefined {
  const value = boundedQuery(url, name, 64)
  if (value === undefined) {
    return undefined
  }
  if (!(values as readonly string[]).includes(value)) {
    throw new LegislationError("invalid_request", `${name} is not supported`)
  }
  return value as T[number]
}

function boundedQuery(url: URL, name: string, maximum: number): string | undefined {
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

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function pathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
