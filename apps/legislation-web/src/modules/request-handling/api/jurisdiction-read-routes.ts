import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { projectJurisdiction, type Jurisdiction, type ProjectionContext } from "./canonical-projection.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiResource,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import type { JurisdictionRead } from "./jurisdiction-read-repository.js"

const MAX_ID_LENGTH = 256

export interface JurisdictionReadApi {
  getJurisdiction(jurisdictionId: string): Promise<JurisdictionRead>
}

export function createJurisdictionReadApiHandler(
  service: JurisdictionReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleJurisdictionRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleJurisdictionRequest(
  service: JurisdictionReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const jurisdictionId = routeMatch(request.method, url.pathname)
  if (jurisdictionId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, [])
  const jurisdiction = await service.getJurisdiction(jurisdictionId)
  sendApiJson(response, 200, apiResource(request, projectJurisdictionRead(jurisdiction, apiBaseUrl)))
  return true
}

export function projectJurisdictionRead(row: JurisdictionRead, apiBaseUrl: string): Jurisdiction {
  return projectJurisdiction(
    {
      classification: canonicalClassification(row.classification),
      id: requiredText(row.id, "jurisdiction ID"),
      isActive: requiredBoolean(row.isActive, "jurisdiction isActive"),
      name: requiredText(row.name, "jurisdiction name"),
      sourceUrl: requiredText(row.sourceUrl, "jurisdiction sourceUrl"),
      timezone: row.timezone === null ? null : requiredText(row.timezone, "jurisdiction timezone")
    },
    canonicalProjectionContext(row, apiBaseUrl)
  )
}

function canonicalProjectionContext(row: JurisdictionRead, apiBaseUrl: string): ProjectionContext {
  if (!row.provenanceComplete) {
    throw new LegislationError("unprocessable", "jurisdiction canonical provenance is incomplete")
  }
  const sourceUrl = requiredText(row.sourceUrl, "jurisdiction sourceUrl")
  return {
    apiBaseUrl,
    sources: [
      {
        isOfficial: requiredBoolean(row.sourceIsOfficial, "jurisdiction sourceIsOfficial"),
        provider: requiredText(row.sourceProvider, "jurisdiction sourceProvider"),
        retrievedAt: requiredDate(row.sourceRetrievedAt, "jurisdiction sourceRetrievedAt"),
        sourceUpdatedAt: row.sourceUpdatedAt,
        sourceUrl
      }
    ],
    updatedAt: requiredDate(row.updatedAt, "jurisdiction updatedAt")
  }
}

function canonicalClassification(value: string): Jurisdiction["classification"] {
  switch (value) {
    case "country":
    case "state":
    case "district":
    case "territory":
      return value
    default:
      throw new LegislationError("unprocessable", "jurisdiction classification is not canonical")
  }
}

function routeMatch(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/").filter(Boolean).map(decodePathSegment)
  if (segments.length !== 3 || segments[0] !== "api" || segments[1] !== "jurisdictions") {
    return undefined
  }
  return canonicalPathId(segments[2], "jurisdictionId")
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function canonicalPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > MAX_ID_LENGTH) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${MAX_ID_LENGTH} characters`)
  }
  return value
}

function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}

function requiredDate(value: Date | null, name: string): Date {
  if (value === null || Number.isNaN(value.getTime())) {
    throw new LegislationError("unprocessable", `${name} must be a timestamp`)
  }
  return value
}

function requiredText(value: string | null, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LegislationError("unprocessable", `${name} must be non-empty`)
  }
  return value
}
