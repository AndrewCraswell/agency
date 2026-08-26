import type { IncomingMessage, ServerResponse } from "node:http"
import type { MeetingAgendaPage } from "../db/queries/meeting-agenda-read.js"
import type { MeetingDocumentPage, MeetingDocumentRead } from "../db/queries/meeting-document-read.js"
import type { MeetingOutcomePage } from "../db/queries/meeting-outcome-read.js"
import type { MeetingParticipantPage } from "../db/queries/meeting-participant-reads.js"
import type { MeetingOrganizationRead, MeetingRead } from "../db/queries/meeting-read.js"
import { LegislationError } from "../legislation/errors.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  apiResource,
  assertTemporalRange,
  assertAllowedQueryParameters,
  queryInteger,
  queryOptionalIsoDateOrRfc3339,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import { projectMeetingAgendaItemRead } from "./meeting-agenda-read-routes.js"
import { projectMeetingDocumentRead } from "./meeting-document-read-routes.js"
import { projectMeetingOutcomeRead } from "./meeting-outcome-read-routes.js"
import { projectMeetingParticipantRead } from "./meeting-participant-projection.js"
import { projectMeetingRead } from "./meeting-read-projection.js"
import type { MeetingCollectionInput, MeetingReadRepository } from "./meeting-read-repository.js"
import { projectOrganizationRow } from "./organization-summary-read-projection.js"

const DEFAULT_LIMIT = 20
const DEFAULT_CHILD_LIMIT = 25
const MAX_CHILD_LIMIT = 25

const GLOBAL_PARAMETERS = [
  "billId",
  "calendarId",
  "classification",
  "cursor",
  "from",
  "isRemote",
  "jurisdictionId",
  "limit",
  "organizationId",
  "sort",
  "status",
  "to"
] as const
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

export interface MeetingReadApi extends MeetingReadRepository {
  listMeetingAgenda(input: { limit: number; meetingId: string }): Promise<MeetingAgendaPage>
  listMeetingDocuments(input: { limit: number; meetingId: string }): Promise<MeetingDocumentPage<MeetingDocumentRead>>
  listMeetingOutcomes(input: { limit: number; meetingId: string }): Promise<MeetingOutcomePage>
  listMeetingParticipants(input: { limit: number; meetingId: string }): Promise<MeetingParticipantPage>
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
  if (route.name === "detail") {
    await handleDetail(service, request, response, url, route.id, apiBaseUrl)
    return true
  }
  assertAllowedQueryParameters(url, route.name === "global" ? GLOBAL_PARAMETERS : parametersForScope(route.name))
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
      input.limit ?? DEFAULT_LIMIT
    )
  )
  return true
}

async function handleDetail(
  service: MeetingReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  meetingId: string,
  apiBaseUrl: string
): Promise<void> {
  assertAllowedQueryParameters(url, ["childLimit"])
  const childLimit = queryInteger(url, "childLimit", DEFAULT_CHILD_LIMIT, MAX_CHILD_LIMIT)
  const [meeting, organizations, agenda, documents, outcomes, participants] = await Promise.all([
    service.getMeetingRead(meetingId),
    service.listMeetingOrganizations(meetingId),
    service.listMeetingAgenda({ limit: childLimit, meetingId }),
    service.listMeetingDocuments({ limit: childLimit, meetingId }),
    service.listMeetingOutcomes({ limit: childLimit, meetingId }),
    service.listMeetingParticipants({ limit: childLimit, meetingId })
  ])
  sendApiJson(
    response,
    200,
    apiResource(
      request,
      projectMeetingDetailRead(
        meeting,
        organizations,
        agenda,
        documents,
        outcomes,
        participants,
        apiBaseUrl,
        childLimit
      )
    )
  )
}

export function projectMeetingDetailRead(
  meeting: MeetingRead,
  organizations: readonly MeetingOrganizationRead[],
  agenda: MeetingAgendaPage,
  documents: MeetingDocumentPage<MeetingDocumentRead>,
  outcomes: MeetingOutcomePage,
  participants: MeetingParticipantPage,
  apiBaseUrl: string,
  childLimit: number
) {
  const summary = projectMeetingRead(meeting, apiBaseUrl)
  return {
    ...summary,
    agenda: agenda.items.map((item) => projectMeetingAgendaItemRead(item, apiBaseUrl)),
    childPageInfo: {
      agenda: pageInfo(agenda, childLimit),
      documents: pageInfo(documents, childLimit),
      outcomes: pageInfo(outcomes, childLimit),
      participants: pageInfo(participants, childLimit)
    },
    documents: documents.items.map((item) => projectMeetingDocumentRead(item, apiBaseUrl)),
    organizations: organizations.map((item) => projectOrganizationRow(item, apiBaseUrl)),
    outcomes: outcomes.items.map((item) => projectMeetingOutcomeRead(item, apiBaseUrl)),
    participants: participants.items.map((item) => projectMeetingParticipantRead(item, apiBaseUrl))
  }
}

function pageInfo(page: { nextCursor?: string; truncated: boolean }, limit: number) {
  return { limit, nextCursor: page.nextCursor ?? null, truncated: page.truncated }
}

function parametersForScope(name: "jurisdiction" | "organization" | "session") {
  return name === "organization" ? ORGANIZATION_PARAMETERS : JURISDICTION_AND_SESSION_PARAMETERS
}

function inputFromQuery(url: URL, route: MeetingCollectionRoute): MeetingCollectionInput {
  const from = queryOptionalIsoDateOrRfc3339(url, "from")
  const to = queryOptionalIsoDateOrRfc3339(url, "to")
  assertTemporalRange(from, to)
  const classifications =
    route.name === "global" ? enumQueryValues(url, "classification", MEETING_CLASSIFICATIONS) : undefined
  const statuses = route.name === "global" ? enumQueryValues(url, "status", MEETING_STATUSES) : undefined
  return {
    billId: route.name === "global" ? boundedQuery(url, "billId", 256) : undefined,
    calendarId: route.name === "global" ? boundedQuery(url, "calendarId", 256) : undefined,
    cursor: boundedQuery(url, "cursor", 4096),
    from,
    isRemote: route.name === "global" ? booleanQuery(url, "isRemote") : undefined,
    jurisdictionId: jurisdictionIdForRoute(url, route),
    limit: queryInteger(url, "limit", DEFAULT_LIMIT, 100),
    organizationId: route.name === "organization" ? route.id : boundedQuery(url, "organizationId", 256),
    sessionId: route.name === "session" ? route.id : undefined,
    sort:
      route.name === "jurisdiction" || route.name === "session"
        ? "starts-asc"
        : enumQuery(url, "sort", ["starts-asc", "starts-desc", "updated-desc"]),
    to,
    ...(route.name === "global"
      ? enumFilterInput("classification", "classifications", classifications)
      : { classification: enumQuery(url, "classification", MEETING_CLASSIFICATIONS) }),
    ...(route.name === "global"
      ? enumFilterInput("status", "statuses", statuses)
      : { status: enumQuery(url, "status", MEETING_STATUSES) })
  }
}

function jurisdictionIdForRoute(url: URL, route: MeetingCollectionRoute): string | undefined {
  if (route.name === "jurisdiction") {
    return route.id
  }
  if (route.name === "global") {
    return boundedQuery(url, "jurisdictionId", 256)
  }
  return undefined
}

type MeetingCollectionRoute = { name: "global" } | { id: string; name: "jurisdiction" | "organization" | "session" }
type MeetingRoute = MeetingCollectionRoute | { id: string; name: "detail" }

function routeMatch(method: string | undefined, pathname: string): MeetingRoute | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/")
  if (segments[0] !== "" || segments[1] !== "api") {
    return undefined
  }
  if (segments.length === 3 && segments[2] === "meetings") {
    return { name: "global" }
  }
  if (segments.length === 4 && segments[2] === "meetings") {
    return { id: pathId(decodePathSegment(segments[3]), "meetingId"), name: "detail" }
  }
  if (segments.length !== 5 || segments[4] !== "meetings") {
    return undefined
  }
  if (segments[2] === "jurisdictions") {
    return { id: pathId(decodePathSegment(segments[3]), "jurisdictionId"), name: "jurisdiction" }
  }
  if (segments[2] === "organizations") {
    return { id: pathId(decodePathSegment(segments[3]), "organizationId"), name: "organization" }
  }
  if (segments[2] === "sessions") {
    return { id: pathId(decodePathSegment(segments[3]), "sessionId"), name: "session" }
  }
  return undefined
}

const MEETING_CLASSIFICATIONS = ["hearing", "meeting", "other", "session"] as const
const MEETING_STATUSES = ["cancelled", "completed", "other", "postponed", "scheduled"] as const
const MAXIMUM_ENUM_VALUES = 25

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

function enumQueryValues<const T extends readonly string[]>(
  url: URL,
  name: string,
  values: T
): readonly T[number][] | undefined {
  const received = url.searchParams.getAll(name)
  if (received.length === 0) {
    return undefined
  }
  const selected = new Set<string>()
  for (const raw of received) {
    const value = raw.trim()
    if (value.length === 0 || value.length > 64 || !(values as readonly string[]).includes(value)) {
      throw new LegislationError("invalid_request", `${name} is not supported`)
    }
    selected.add(value)
    if (selected.size > MAXIMUM_ENUM_VALUES) {
      throw new LegislationError("invalid_request", `${name} supports at most ${MAXIMUM_ENUM_VALUES} unique values`)
    }
  }
  return values.filter((value): value is T[number] => selected.has(value))
}

function enumFilterInput<const T extends string>(
  singular: string,
  plural: string,
  values: readonly T[] | undefined
): Readonly<Record<string, T | readonly T[] | undefined>> {
  if (values === undefined) {
    return { [singular]: undefined }
  }
  if (values.length === 1) {
    return { [singular]: values[0] }
  }
  return { [plural]: values }
}

function booleanQuery(url: URL, name: string): boolean | undefined {
  const value = boundedQuery(url, name, 5)
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
