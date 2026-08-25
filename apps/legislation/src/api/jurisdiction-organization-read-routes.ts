import type { IncomingMessage, ServerResponse } from "node:http"
import type { OrganizationRow } from "../db/queries/organization-relationships.js"
import { LegislationError } from "../legislation/errors.js"
import { projectOrganizationSummary, type OrganizationSummary } from "./canonical-projection.js"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import type {
  JurisdictionOrganizationCollection,
  JurisdictionOrganizationListInput,
  JurisdictionOrganizationPage
} from "./jurisdiction-organization-read-repository.js"

const DEFAULT_LIMIT = 25
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

export interface JurisdictionOrganizationReadApi {
  assertJurisdictionExists(jurisdictionId: string): Promise<void>
  listOrganizations(input: JurisdictionOrganizationListInput): Promise<JurisdictionOrganizationPage>
}

export function createJurisdictionOrganizationReadApiHandler(
  service: JurisdictionOrganizationReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleJurisdictionOrganizationRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleJurisdictionOrganizationRequest(
  service: JurisdictionOrganizationReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, allowedQueryParameters(route.collection))
  const input = listInput(url, route)
  await service.assertJurisdictionExists(route.jurisdictionId)
  const page = await service.listOrganizations(input)
  sendApiJson(
    response,
    200,
    apiPage(request, projectPage(page, apiBaseUrl, route.jurisdictionId), input.limit ?? DEFAULT_LIMIT)
  )
  return true
}

function projectPage(
  page: JurisdictionOrganizationPage,
  apiBaseUrl: string,
  jurisdictionId: string
): { items: OrganizationSummary[]; nextCursor?: string; truncated: boolean } {
  return {
    ...page,
    items: page.items.map((item) => projectOrganization(item, apiBaseUrl, jurisdictionId))
  }
}

function projectOrganization(row: OrganizationRow, apiBaseUrl: string, jurisdictionId: string): OrganizationSummary {
  if (row.jurisdictionId !== jurisdictionId) {
    throw new LegislationError("unprocessable", "organization does not belong to its jurisdiction path")
  }
  const source = canonicalSource(row, "organization")
  return projectOrganizationSummary(
    {
      chamber: canonicalChamber(row.chamber),
      classification: canonicalOrganizationClassification(row.classification),
      id: requiredText(row.id, "organization ID"),
      isActive: requiredBoolean(row.isActive, "organization isActive"),
      jurisdictionId: requiredText(row.jurisdictionId, "organization jurisdictionId"),
      name: requiredText(row.name, "organization name"),
      parentOrganizationId: row.parentOrganizationId,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function canonicalSource(row: OrganizationRow, name: string) {
  if (
    !row.provenanceComplete ||
    row.sourceIsOfficial === null ||
    !isNonemptyString(row.sourceProvider) ||
    row.sourceRetrievedAt === null ||
    !isNonemptyString(row.sourceUrl)
  ) {
    throw new LegislationError("unprocessable", `${name} canonical provenance is incomplete`)
  }
  return {
    createdAt: row.createdAt,
    id: row.id,
    sourceUpdatedAt: row.sourceUpdatedAt,
    sourceUrl: row.sourceUrl,
    updatedAt: row.updatedAt,
    upstreamIds: row.upstreamIds
  }
}

function canonicalOrganizationClassification(value: string | null): OrganizationSummary["classification"] {
  switch (value) {
    case "agency":
    case "chamber":
    case "committee":
    case "commission":
    case "legislature":
    case "other":
    case "subcommittee":
      return value
    default:
      throw new LegislationError("unprocessable", "organization classification is not canonical")
  }
}

function canonicalChamber(value: string | null): OrganizationSummary["chamber"] {
  switch (value) {
    case "lower":
    case "upper":
    case "unicameral":
    case "legislature":
    case null:
      return value
    default:
      throw new LegislationError("unprocessable", "organization chamber is not canonical")
  }
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

function routeMatch(
  method: string | undefined,
  pathname: string
): Readonly<{ collection: JurisdictionOrganizationCollection; jurisdictionId: string }> | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/").filter(Boolean).map(decodePathSegment)
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "jurisdictions") {
    return undefined
  }
  const collection = segments[3]
  if (collection !== "organizations" && collection !== "commissions" && collection !== "committees") {
    return undefined
  }
  return { collection, jurisdictionId: canonicalPathId(segments[2], "jurisdictionId") }
}

function listInput(
  url: URL,
  route: Readonly<{ collection: JurisdictionOrganizationCollection; jurisdictionId: string }>
): JurisdictionOrganizationListInput {
  const common = {
    cursor: queryText(url, "cursor", MAX_CURSOR_LENGTH),
    isActive: queryBoolean(url, "isActive"),
    jurisdictionId: route.jurisdictionId,
    limit: queryLimit(url),
    query: queryText(url, "q", MAX_QUERY_LENGTH)
  }
  switch (route.collection) {
    case "organizations":
      return {
        ...common,
        classification: queryClassification(url, "classification"),
        collection: route.collection,
        parentOrganizationId: queryText(url, "parentOrganizationId", MAX_TEXT_LENGTH)
      }
    case "commissions":
      return { ...common, collection: route.collection }
    case "committees":
      return {
        ...common,
        chamber: queryChamber(url),
        collection: route.collection,
        parentOrganizationId: queryText(url, "parentOrganizationId", MAX_TEXT_LENGTH)
      }
  }
}

function allowedQueryParameters(collection: JurisdictionOrganizationCollection): readonly string[] {
  switch (collection) {
    case "organizations":
      return ["classification", "cursor", "isActive", "limit", "parentOrganizationId", "q"]
    case "commissions":
      return ["cursor", "isActive", "limit", "q"]
    case "committees":
      return ["chamber", "cursor", "isActive", "limit", "parentOrganizationId", "q"]
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

function queryClassification(url: URL, name: string): string | undefined {
  const value = queryText(url, name, MAX_TEXT_LENGTH)
  if (value === undefined) {
    return undefined
  }
  if (!(ORGANIZATION_CLASSIFICATIONS as readonly string[]).includes(value)) {
    throw new LegislationError("invalid_request", `${name} is not a supported organization classification`)
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

function canonicalPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > MAX_TEXT_LENGTH) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${MAX_TEXT_LENGTH} characters`)
  }
  return value
}

function isNonemptyString(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}
