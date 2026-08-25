import type { JurisdictionClassification, JurisdictionListInput } from "../db/queries/jurisdictions-read.js"
import { JURISDICTION_CLASSIFICATIONS } from "../db/queries/jurisdictions-read.js"
import { LegislationError } from "../legislation/errors.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import type { JurisdictionCollectionPage } from "./jurisdiction-collection-read-repository.js"
import { projectJurisdictionRead } from "./jurisdiction-read-routes.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100
const MAX_CURSOR_LENGTH = 4_096
const MAX_QUERY_LENGTH = 500

export interface JurisdictionCollectionReadApi {
  listJurisdictions(input: JurisdictionListInput): Promise<JurisdictionCollectionPage>
}

/**
 * Handles the collection slice independently so it can only be composed after
 * the canonical-foundation audit has supplied a complete authoritative snapshot.
 */
export function createJurisdictionCollectionReadApiHandler(
  service: JurisdictionCollectionReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      if (!isCollectionRoute(request.method, url.pathname)) {
        return false
      }
      assertAllowedQueryParameters(url, ["classification", "cursor", "isActive", "limit", "q"])
      const limit = queryLimit(url)
      const page = await service.listJurisdictions({
        classification: queryClassification(url),
        cursor: queryText(url, "cursor", MAX_CURSOR_LENGTH),
        isActive: queryBoolean(url, "isActive"),
        limit,
        q: queryText(url, "q", MAX_QUERY_LENGTH)
      })
      sendApiJson(response, 200, apiPage(request, projectPage(page, options.apiBaseUrl), limit))
      return true
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

function projectPage(page: JurisdictionCollectionPage, apiBaseUrl: string) {
  return {
    ...page,
    items: page.items.map((item) => projectJurisdictionRead(item, apiBaseUrl))
  }
}

function isCollectionRoute(method: string | undefined, pathname: string): boolean {
  return method === "GET" && pathname === "/api/jurisdictions"
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

function queryClassification(url: URL): readonly JurisdictionClassification[] | undefined {
  const values = url.searchParams.getAll("classification").map((value) => value.trim())
  if (values.length === 0) {
    return undefined
  }
  if (values.length > 25 || values.some((value) => value.length === 0)) {
    throw new LegislationError("invalid_request", "classification must contain between 1 and 25 non-empty values")
  }
  if (new Set(values).size !== values.length) {
    throw new LegislationError("invalid_request", "classification values must be unique")
  }
  if (values.some((value) => !(JURISDICTION_CLASSIFICATIONS as readonly string[]).includes(value))) {
    throw new LegislationError("invalid_request", "classification is not a supported jurisdiction classification")
  }
  return values.filter(isJurisdictionClassification)
}

function isJurisdictionClassification(value: string): value is JurisdictionClassification {
  return (JURISDICTION_CLASSIFICATIONS as readonly string[]).includes(value)
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
