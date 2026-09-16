import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { SessionRead } from "../../legislation/persistence/queries/session-read"
import type { Session } from "./canonical-projection"
import { projectSession } from "./canonical-projection"
import { toProjectionLegislationError } from "./canonical-read"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  queryInteger,
  queryOptionalBoolean,
  queryOptionalIsoDate,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import type { SessionListInput, SessionListPage } from "./session-read-repository"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_CURSOR_LENGTH = 4_096

export interface SessionReadApi {
  assertJurisdictionExists(jurisdictionId: string): Promise<void>
  getSession(sessionId: string): Promise<SessionRead>
  listJurisdictionSessions(input: SessionListInput): Promise<SessionListPage>
}

export function createSessionReadApiHandler(
  service: SessionReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleSessionRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleSessionRequest(
  service: SessionReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }

  if (route.name === "getSession") {
    assertAllowedQueryParameters(url, [])
    const session = await service.getSession(route.sessionId)
    sendApiJson(response, 200, apiResource(request, projectSessionRead(session, apiBaseUrl)))
    return true
  }

  assertAllowedQueryParameters(url, ["cursor", "from", "isActive", "limit", "to"])
  const limit = queryInteger(url, "limit", DEFAULT_LIMIT, MAX_LIMIT)
  const input: SessionListInput = {
    cursor: queryText(url, "cursor", MAX_CURSOR_LENGTH),
    from: queryOptionalIsoDate(url, "from"),
    isActive: queryOptionalBoolean(url, "isActive"),
    jurisdictionId: route.jurisdictionId,
    limit,
    to: queryOptionalIsoDate(url, "to")
  }
  await service.assertJurisdictionExists(route.jurisdictionId)
  const page = await service.listJurisdictionSessions(input)
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl, route.jurisdictionId), limit))
  return true
}

function projectPage(
  page: SessionListPage,
  apiBaseUrl: string,
  jurisdictionId: string
): Omit<SessionListPage, "items"> & { items: Session[] } {
  return {
    ...page,
    items: page.items.map((item) => projectSessionRead(item, apiBaseUrl, jurisdictionId))
  }
}

export function projectSessionRead(row: SessionRead, apiBaseUrl: string, expectedJurisdictionId?: string): Session {
  const source = completeSessionSource(row)
  const jurisdictionId = requiredText(row.jurisdictionId, "session jurisdictionId")
  if (expectedJurisdictionId !== undefined && jurisdictionId !== expectedJurisdictionId) {
    throw new LegislationError("unprocessable", "session does not belong to its jurisdiction path")
  }
  return projectSession(
    {
      classification: requiredText(row.classification, "session classification"),
      endDate: row.endDate,
      id: requiredText(row.id, "session ID"),
      isActive: requiredBoolean(row.isActive, "session isActive"),
      jurisdictionId,
      name: requiredText(row.name, "session name"),
      sourceUrl: source.sourceUrl,
      startDate: row.startDate
    },
    {
      apiBaseUrl,
      sources: [
        {
          isOfficial: source.sourceIsOfficial,
          provider: source.sourceProvider,
          retrievedAt: source.sourceRetrievedAt,
          sourceUpdatedAt: source.sourceUpdatedAt,
          sourceUrl: source.sourceUrl
        }
      ],
      updatedAt: row.updatedAt
    }
  )
}

function completeSessionSource(row: SessionRead) {
  if (
    !row.provenanceComplete ||
    !isNonemptyString(row.sourceProvider) ||
    !isNonemptyString(row.sourceUrl) ||
    !row.sourceUrl.startsWith("https://") ||
    row.sourceRetrievedAt === null ||
    row.sourceIsOfficial === null
  ) {
    throw new LegislationError("unprocessable", "session canonical provenance is incomplete")
  }
  return {
    sourceIsOfficial: row.sourceIsOfficial,
    sourceProvider: row.sourceProvider,
    sourceRetrievedAt: row.sourceRetrievedAt,
    sourceUpdatedAt: row.sourceUpdatedAt,
    sourceUrl: row.sourceUrl
  }
}

function routeMatch(
  method: string | undefined,
  pathname: string
):
  | { name: "getSession"; sessionId: string }
  | { jurisdictionId: string; name: "listJurisdictionSessions" }
  | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/").filter(Boolean).map(decodePathSegment)
  if (segments.length === 3 && segments[0] === "api" && segments[1] === "sessions") {
    return { name: "getSession", sessionId: canonicalPathId(segments[2], "sessionId") }
  }
  if (segments.length === 4 && segments[0] === "api" && segments[1] === "jurisdictions" && segments[3] === "sessions") {
    return { jurisdictionId: canonicalPathId(segments[2], "jurisdictionId"), name: "listJurisdictionSessions" }
  }
  return undefined
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

function canonicalPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
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

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}
