import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "../legislation/errors.js"
import type {
  CalendarListInput,
  CalendarMeetingListInput,
  CalendarPage,
  CalendarRead,
  CalendarReadRepository
} from "./calendar-read-repository.js"
import { isIsoDate, isRfc3339Timestamp, projectCalendarDetail, projectCalendarSummary } from "./canonical-projection.js"
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
import { projectMeetingRead } from "./meeting-read-projection.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

const CALENDAR_PARAMETERS = ["classification", "cursor", "isActive", "jurisdictionId", "limit", "organizationId", "q"]
const ORGANIZATION_CALENDAR_PARAMETERS = ["classification", "cursor", "isActive", "limit"]
const MEETING_PARAMETERS = ["cursor", "from", "limit", "sort", "status", "to"]

export type CalendarReadApi = CalendarReadRepository

export function createCalendarReadApiHandler(
  service: CalendarReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleCalendarRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleCalendarRequest(
  service: CalendarReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }
  if (route.name === "detail") {
    assertAllowedQueryParameters(url, [])
    const calendar = await service.getCalendarRead(route.calendarId)
    sendApiJson(response, 200, apiResource(request, projectDetail(calendar, apiBaseUrl)))
    return true
  }
  if (route.name === "meetings") {
    assertAllowedQueryParameters(url, MEETING_PARAMETERS)
    const input = calendarMeetingInput(url, route.calendarId)
    await service.assertCalendarExists(route.calendarId)
    const page = await service.listCalendarMeetings(input)
    sendApiJson(
      response,
      200,
      apiPage(
        request,
        { ...page, items: page.items.map((item) => projectMeetingRead(item, apiBaseUrl, route.calendarId)) },
        input.limit
      )
    )
    return true
  }
  assertAllowedQueryParameters(
    url,
    route.name === "organization" ? ORGANIZATION_CALENDAR_PARAMETERS : CALENDAR_PARAMETERS
  )
  const input = calendarInput(url, route.name === "organization" ? route.organizationId : undefined)
  if (route.name === "organization") {
    await service.assertOrganizationExists(route.organizationId)
  }
  const page = await service.listCalendars(input)
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), input.limit))
  return true
}

function projectPage(page: CalendarPage, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectSummary(item, apiBaseUrl)) }
}

function projectSummary(calendar: CalendarRead, apiBaseUrl: string) {
  return projectCalendarSummary(
    {
      classification: calendar.classification,
      id: calendar.id,
      isActive: calendar.isActive,
      jurisdictionId: calendar.jurisdictionId,
      name: calendar.name,
      organizationId: calendar.organizationId,
      sourceUrl: calendar.sourceUrl,
      timezone: calendar.timezone
    },
    { apiBaseUrl, sources: calendar.sources, updatedAt: calendar.updatedAt }
  )
}

function projectDetail(calendar: CalendarRead, apiBaseUrl: string) {
  return projectCalendarDetail(
    {
      calendar: {
        classification: calendar.classification,
        id: calendar.id,
        isActive: calendar.isActive,
        jurisdictionId: calendar.jurisdictionId,
        name: calendar.name,
        organizationId: calendar.organizationId,
        sourceUrl: calendar.sourceUrl,
        timezone: calendar.timezone
      },
      coverageFrom: calendar.coverageFrom,
      coverageTo: calendar.coverageTo,
      description: calendar.description
    },
    { apiBaseUrl, sources: calendar.sources, updatedAt: calendar.updatedAt }
  )
}

function calendarInput(url: URL, organizationId: string | undefined): CalendarListInput {
  return {
    classification: queryText(url, "classification", 256),
    cursor: queryText(url, "cursor", 4_096),
    isActive: queryBoolean(url, "isActive"),
    jurisdictionId: organizationId === undefined ? queryText(url, "jurisdictionId", 256) : undefined,
    limit: queryLimit(url),
    organizationId: organizationId ?? queryText(url, "organizationId", 256),
    query: organizationId === undefined ? queryText(url, "q", 500) : undefined
  }
}

function calendarMeetingInput(url: URL, calendarId: string): CalendarMeetingListInput {
  const from = queryDateBound(url, "from")
  const to = queryDateBound(url, "to")
  validateDateRange(from, to)
  return {
    calendarId,
    cursor: queryText(url, "cursor", 4_096),
    from,
    limit: queryLimit(url),
    sort: querySort(url),
    status: queryStatus(url),
    to
  }
}

function routeMatch(method: string | undefined, pathname: string): CalendarRoute | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/")
  if (segments[0] !== "" || segments[1] !== "api") {
    return undefined
  }
  if (segments.length === 3 && segments[2] === "calendars") {
    return { name: "collection" }
  }
  if (segments.length === 4 && segments[2] === "calendars") {
    return { calendarId: pathId(decodePathSegment(segments[3]), "calendarId"), name: "detail" }
  }
  if (segments.length === 5 && segments[2] === "calendars" && segments[4] === "meetings") {
    return { calendarId: pathId(decodePathSegment(segments[3]), "calendarId"), name: "meetings" }
  }
  if (segments.length === 5 && segments[2] === "organizations" && segments[4] === "calendars") {
    return { organizationId: pathId(decodePathSegment(segments[3]), "organizationId"), name: "organization" }
  }
  return undefined
}

type CalendarRoute =
  | { name: "collection" }
  | { calendarId: string; name: "detail" | "meetings" }
  | { name: "organization"; organizationId: string }

function queryLimit(url: URL): number {
  const value = queryText(url, "limit", 16)
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

function queryBoolean(url: URL, name: string): boolean | undefined {
  const value = queryText(url, name, 5)
  if (value === undefined) {
    return undefined
  }
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  throw new LegislationError("invalid_request", `${name} must be true or false`)
}

function queryDateBound(url: URL, name: "from" | "to"): string | undefined {
  const value = queryText(url, name, 64)
  if (value === undefined) {
    return undefined
  }
  if (!isIsoDate(value) && !isRfc3339Timestamp(value)) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date or RFC 3339 timestamp`)
  }
  return value
}

function validateDateRange(from: string | undefined, to: string | undefined): void {
  if (from === undefined || to === undefined) {
    return
  }
  if (isIsoDate(from) !== isIsoDate(to)) {
    throw new LegislationError("invalid_request", "from and to must use the same format")
  }
  const fromValue = isIsoDate(from) ? from : new Date(from).valueOf()
  const toValue = isIsoDate(to) ? to : new Date(to).valueOf()
  if (fromValue > toValue) {
    throw new LegislationError("invalid_request", "from must not be after to")
  }
}

function querySort(url: URL): CalendarMeetingListInput["sort"] {
  const value = queryText(url, "sort", 64)
  if (value === undefined || value === "starts-asc") {
    return value
  }
  if (value === "starts-desc") {
    return value
  }
  throw new LegislationError("invalid_request", "sort is not supported")
}

function queryStatus(url: URL): CalendarMeetingListInput["status"] {
  const value = queryText(url, "status", 64)
  if (value === undefined) {
    return undefined
  }
  switch (value) {
    case "cancelled":
    case "completed":
    case "other":
    case "postponed":
    case "scheduled":
      return value
    default:
      throw new LegislationError("invalid_request", "status is not supported")
  }
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

function pathId(value: string, name: string): string {
  if (value.trim().length === 0 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
