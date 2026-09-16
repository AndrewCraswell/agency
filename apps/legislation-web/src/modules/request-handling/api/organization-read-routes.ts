import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { OrganizationListInput } from "../../legislation/persistence/queries/organization-relationships"
import { toProjectionLegislationError } from "./canonical-read"
import {
  apiPage,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import type { OrganizationCollectionPage } from "./organization-read-repository"
import { projectOrganizationRow } from "./organization-summary-read-projection"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_CURSOR_LENGTH = 4_096
const MAX_QUERY_LENGTH = 500
const MAX_TEXT_LENGTH = 256

const ORGANIZATION_CLASSIFICATIONS = [
  "agency",
  "chamber",
  "committee",
  "commission",
  "legislature",
  "other",
  "subcommittee"
] as const
const ORGANIZATION_CHAMBERS = ["lower", "upper", "unicameral", "legislature"] as const

export interface OrganizationReadApi {
  listOrganizations(input: OrganizationListInput): Promise<OrganizationCollectionPage>
}

export function createOrganizationReadApiHandler(
  service: OrganizationReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleOrganizationRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleOrganizationRequest(
  service: OrganizationReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  if (!isOrganizationCollectionRoute(request.method, url.pathname)) {
    return false
  }
  assertAllowedQueryParameters(url, [
    "chamber",
    "classification",
    "cursor",
    "isActive",
    "jurisdictionId",
    "limit",
    "parentOrganizationId",
    "q",
    "sort"
  ])
  const input = listInput(url)
  const page = await service.listOrganizations(input)
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), input.limit ?? DEFAULT_LIMIT))
  return true
}

function projectPage(page: OrganizationCollectionPage, apiBaseUrl: string) {
  return {
    ...page,
    items: page.items.map((item) => projectOrganizationRow(item, apiBaseUrl))
  }
}

function isOrganizationCollectionRoute(method: string | undefined, pathname: string): boolean {
  if (method !== "GET") {
    return false
  }
  const segments = pathname.split("/").filter(Boolean).map(decodePathSegment)
  return segments.length === 2 && segments[0] === "api" && segments[1] === "organizations"
}

function listInput(url: URL): OrganizationListInput {
  return {
    chamber: queryChamber(url),
    classification: queryClassification(url),
    cursor: queryText(url, "cursor", MAX_CURSOR_LENGTH),
    isActive: queryBoolean(url, "isActive"),
    jurisdictionId: queryText(url, "jurisdictionId", MAX_TEXT_LENGTH),
    limit: queryLimit(url),
    parentOrganizationId: queryText(url, "parentOrganizationId", MAX_TEXT_LENGTH),
    query: queryText(url, "q", MAX_QUERY_LENGTH),
    sort: querySort(url)
  }
}

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

function queryClassification(url: URL): string | undefined {
  const value = queryText(url, "classification", MAX_TEXT_LENGTH)
  if (value === undefined) {
    return undefined
  }
  if (!(ORGANIZATION_CLASSIFICATIONS as readonly string[]).includes(value)) {
    throw new LegislationError("invalid_request", "classification is not a supported organization classification")
  }
  return value
}

function queryChamber(url: URL): string | undefined {
  const value = queryText(url, "chamber", MAX_TEXT_LENGTH)
  if (value === undefined) {
    return undefined
  }
  if (!(ORGANIZATION_CHAMBERS as readonly string[]).includes(value)) {
    throw new LegislationError("invalid_request", "chamber is not a supported organization chamber")
  }
  return value
}

function querySort(url: URL): OrganizationListInput["sort"] {
  const value = queryText(url, "sort", MAX_TEXT_LENGTH)
  if (value === undefined || value === "name-asc") {
    return "name-asc"
  }
  if (value === "updated-desc") {
    return value
  }
  throw new LegislationError("invalid_request", "sort is not a supported organization sort")
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

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}
