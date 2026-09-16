import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  PersonAmendmentsListInput,
  PersonAmendmentsPage
} from "../../legislation/persistence/queries/person-amendments"
import { projectPersonAmendmentRead } from "../../legislation/persistence/queries/person-amendments"
import { isIsoDate, isRfc3339Timestamp } from "./canonical-projection"
import { toProjectionLegislationError } from "./canonical-read"
import {
  apiPage,
  assertAllowedQueryParameters,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"

const allowedQueryParameters = ["cursor", "from", "limit", "sessionId", "status", "to"] as const
const MAX_CURSOR_LENGTH = 4_096
const MAX_DATE_BOUND_LENGTH = 64
const MAX_FILTER_LENGTH = 256

export interface PersonAmendmentsApi {
  assertPersonExists: (personId: string) => Promise<void>
  listPersonAmendments: (input: PersonAmendmentsListInput) => Promise<PersonAmendmentsPage>
}

export function createPersonAmendmentApiHandler(
  service: PersonAmendmentsApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      return await handlePersonAmendmentRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handlePersonAmendmentRequest(
  service: PersonAmendmentsApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const personId = routePersonId(request.method, url.pathname)
  if (personId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, allowedQueryParameters)
  assertSingleQueryParameters(url, allowedQueryParameters)
  const from = optionalBoundedQuery(url, "from", MAX_DATE_BOUND_LENGTH)
  const to = optionalBoundedQuery(url, "to", MAX_DATE_BOUND_LENGTH)
  validateDateBounds(from, to)
  const limit = queryInteger(url, "limit", 20, 100)
  await service.assertPersonExists(personId)
  const page = await service.listPersonAmendments({
    cursor: optionalBoundedQuery(url, "cursor", MAX_CURSOR_LENGTH),
    from,
    limit,
    personId,
    sessionId: optionalBoundedQuery(url, "sessionId", MAX_FILTER_LENGTH),
    status: optionalBoundedQuery(url, "status", MAX_FILTER_LENGTH),
    to
  })
  sendApiJson(
    response,
    200,
    apiPage(request, { ...page, items: page.items.map((item) => projectPersonAmendmentRead(item, apiBaseUrl)) }, limit)
  )
  return true
}

function routePersonId(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "people" || segments[3] !== "amendments") {
    return undefined
  }
  let personId: string
  try {
    personId = decodeURIComponent(segments[2] ?? "")
  } catch {
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
  if (personId === undefined || personId.length < 1 || personId.length > 256) {
    throw new LegislationError("invalid_request", "personId must be between 1 and 256 characters")
  }
  return personId
}

function assertSingleQueryParameters(url: URL, names: readonly string[]): void {
  for (const name of names) {
    if (url.searchParams.getAll(name).length > 1) {
      throw new LegislationError("invalid_request", `${name} must appear once`)
    }
  }
}

function optionalBoundedQuery(url: URL, name: string, maximumLength: number): string | undefined {
  const value = url.searchParams.get(name)
  if (value === null) {
    return undefined
  }
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximumLength} characters`)
  }
  return normalized
}

function validateDateBounds(from: string | undefined, to: string | undefined): void {
  if (from !== undefined && !isIsoDate(from) && !isRfc3339Timestamp(from)) {
    throw new LegislationError("invalid_request", "from must be an ISO date or RFC3339 timestamp")
  }
  if (to !== undefined && !isIsoDate(to) && !isRfc3339Timestamp(to)) {
    throw new LegislationError("invalid_request", "to must be an ISO date or RFC3339 timestamp")
  }
  if (from === undefined || to === undefined) {
    return
  }
  if (isIsoDate(from) !== isIsoDate(to)) {
    throw new LegislationError("invalid_request", "from and to must use the same format")
  }
  const fromTimestamp = Date.parse(from)
  const toTimestamp = Date.parse(to) + (isIsoDate(to) ? 86_400_000 : 0)
  if (isIsoDate(to) ? fromTimestamp >= toTimestamp : fromTimestamp > toTimestamp) {
    throw new LegislationError("invalid_request", "from must be less than or equal to to")
  }
}
