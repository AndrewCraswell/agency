import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "../legislation/errors.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  queryInteger,
  queryOptionalBoolean,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import { projectOrganizationMembershipRead } from "./membership-read-projection.js"
import type { OrganizationMembersListInput, OrganizationMembersPage } from "./organization-members-read-repository.js"

const allowedQueryParameters = ["cursor", "from", "isCurrent", "limit", "role", "to"] as const
const MAX_CURSOR_LENGTH = 2_048
const MAX_ROLE_LENGTH = 256
const MAX_DATE_BOUND_LENGTH = 64

export interface OrganizationMembersReadApi {
  listOrganizationMembers(input: OrganizationMembersListInput): Promise<OrganizationMembersPage>
}

export function createOrganizationMembersReadApiHandler(
  service: OrganizationMembersReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      return await handleOrganizationMembersRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleOrganizationMembersRequest(
  service: OrganizationMembersReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const organizationId = routeOrganizationId(request.method, url.pathname)
  if (organizationId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, allowedQueryParameters)
  assertSingleQueryParameters(url, allowedQueryParameters)
  const input: OrganizationMembersListInput = {
    cursor: optionalBoundedQuery(url, "cursor", MAX_CURSOR_LENGTH),
    from: optionalBoundedQuery(url, "from", MAX_DATE_BOUND_LENGTH),
    isCurrent: queryOptionalBoolean(url, "isCurrent"),
    limit: queryInteger(url, "limit", 25, 100),
    organizationId,
    role: optionalBoundedQuery(url, "role", MAX_ROLE_LENGTH),
    to: optionalBoundedQuery(url, "to", MAX_DATE_BOUND_LENGTH)
  }
  const page = await service.listOrganizationMembers(input)
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), input.limit ?? 25))
  return true
}

function projectPage(page: OrganizationMembersPage, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectOrganizationMembershipRead(item, apiBaseUrl)) }
}

function routeOrganizationId(method: string | undefined, pathname: string): string | undefined {
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
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "organizations" || segments[3] !== "members") {
    return undefined
  }
  return requiredPathId(segments[2], "organizationId")
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

function requiredPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
