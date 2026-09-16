import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  PersonCollectionRead,
  PersonListInput,
  PersonPage,
  PersonSort
} from "../../legislation/persistence/queries/people-read"
import { projectPersonSummary } from "./canonical-projection"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read"
import {
  assertAllowedQueryParameters,
  apiPage,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface PeopleReadApi {
  listPeople: (input: PersonListInput) => Promise<PersonPage<PersonCollectionRead>>
}

export function createPeopleReadApiHandler(
  service: PeopleReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handlePeopleRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handlePeopleRequest(
  service: PeopleReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  if (!routeMatch(request.method, url.pathname)) {
    return false
  }
  assertAllowedQueryParameters(url, [
    "cursor",
    "isActive",
    "jurisdictionId",
    "limit",
    "organizationId",
    "party",
    "q",
    "sort"
  ])
  const limit = queryLimit(url)
  const page = await service.listPeople({
    cursor: queryText(url, "cursor", 4096),
    isActive: queryBoolean(url, "isActive"),
    jurisdictionId: queryText(url, "jurisdictionId", 256),
    limit,
    organizationId: queryText(url, "organizationId", 256),
    party: queryText(url, "party", 256),
    q: queryText(url, "q", 500),
    sort: personSort(queryText(url, "sort", 32))
  })
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), limit))
  return true
}

function projectPage(page: PersonPage<PersonCollectionRead>, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectPersonRead(item, apiBaseUrl)) }
}

export function projectPersonRead(read: PersonCollectionRead, apiBaseUrl: string) {
  const source = canonicalSource(read)
  return projectPersonSummary(
    {
      familyName: read.familyName,
      givenName: read.givenName,
      id: requiredText(read.id, "person ID"),
      imageUrl: null,
      isActive: requiredBoolean(read.isActive, "person isActive"),
      jurisdictionIds: [requiredText(read.jurisdictionId, "person jurisdictionId")],
      name: requiredText(read.name, "person name"),
      party: read.party,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function canonicalSource(read: PersonCollectionRead) {
  if (
    !read.provenanceComplete ||
    read.sourceIsOfficial === null ||
    !isNonemptyString(read.sourceProvider) ||
    read.sourceRetrievedAt === null ||
    !isNonemptyString(read.sourceUrl)
  ) {
    throw new LegislationError("unprocessable", "person canonical provenance is incomplete")
  }
  return {
    createdAt: read.createdAt,
    id: read.id,
    sourceUpdatedAt: read.sourceUpdatedAt,
    sourceUrl: read.sourceUrl,
    updatedAt: read.updatedAt,
    upstreamIds: read.upstreamIds
  }
}

function routeMatch(method: string | undefined, pathname: string): boolean {
  return method === "GET" && pathname === "/api/people"
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

function personSort(value: string | undefined): PersonSort | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === "name-asc" || value === "updated-desc") {
    return value
  }
  throw new LegislationError("invalid_request", "sort must be name-asc or updated-desc")
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

function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}

function requiredText(value: string | null, name: string): string {
  if (!isNonemptyString(value)) {
    throw new LegislationError("unprocessable", `${name} must be non-empty`)
  }
  return value
}

function isNonemptyString(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}
