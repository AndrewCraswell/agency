import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { isIsoDate, isRfc3339Timestamp } from "./canonical-projection"
import { toProjectionLegislationError } from "./canonical-read"
import {
  apiPage,
  assertAllowedQueryParameters,
  queryInteger,
  queryOptionalBoolean,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import { projectOrganizationMembershipRead } from "./membership-read-projection"
import type { PersonMembershipsListInput, PersonMembershipsPage } from "./person-membership-read-repository"

const allowedQueryParameters = ["cursor", "from", "isCurrent", "limit", "organizationId", "to"] as const
const MAX_CURSOR_LENGTH = 2_048
const MAX_DATE_BOUND_LENGTH = 64
const MAX_ORGANIZATION_ID_LENGTH = 256

export interface PersonMembershipReadApi {
  listPersonMemberships(input: PersonMembershipsListInput): Promise<PersonMembershipsPage>
}

export function createPersonMembershipReadApiHandler(
  service: PersonMembershipReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      return await handlePersonMembershipRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handlePersonMembershipRequest(
  service: PersonMembershipReadApi,
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
  const input: PersonMembershipsListInput = {
    cursor: optionalBoundedQuery(url, "cursor", MAX_CURSOR_LENGTH),
    from,
    isCurrent: queryOptionalBoolean(url, "isCurrent"),
    limit: queryInteger(url, "limit", 20, 100),
    organizationId: optionalBoundedQuery(url, "organizationId", MAX_ORGANIZATION_ID_LENGTH),
    personId,
    to
  }
  const page = await service.listPersonMemberships(input)
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), input.limit ?? 20))
  return true
}

function projectPage(page: PersonMembershipsPage, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectOrganizationMembershipRead(item, apiBaseUrl)) }
}

function routePersonId(method: string | undefined, pathname: string): string | undefined {
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
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "people" || segments[3] !== "memberships") {
    return undefined
  }
  return requiredPathId(segments[2], "personId")
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

function requiredPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
