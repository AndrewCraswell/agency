import type { ChangeFeedListInput, ChangeFeedPage } from "../db/queries/change-feed-reads.js"
import { projectChangeEventRead } from "../db/queries/change-feed-reads.js"
import type { CanonicalChangeType } from "../db/queries/changes.js"
import { LegislationError } from "../legislation/errors.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiPage,
  assertAllowedQueryParameters,
  queryInteger,
  queryOptionalDate,
  queryOptionalString,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

const globalAllowedQueryParameters = [
  "classification",
  "cursor",
  "jurisdictionId",
  "limit",
  "organizationId",
  "personId",
  "recordId",
  "recordType",
  "observedFrom",
  "observedTo"
] as const
const billAllowedQueryParameters = ["classification", "cursor", "limit", "observedFrom", "observedTo"] as const

export interface ChangeFeedApi {
  assertBillExists: (billId: string) => Promise<void>
  listChanges: (input: ChangeFeedListInput) => Promise<ChangeFeedPage>
}

export function createChangeFeedApiHandler(
  service: ChangeFeedApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      const route = routeMatch(request.method, url.pathname)
      if (route === undefined) {
        return false
      }
      assertAllowedQueryParameters(
        url,
        route.name === "global" ? globalAllowedQueryParameters : billAllowedQueryParameters
      )
      assertSingleQueryParameters(
        url,
        route.name === "global" ? globalAllowedQueryParameters : billAllowedQueryParameters
      )
      const observedFrom = queryOptionalDate(url, "observedFrom")
      const observedTo = queryOptionalDate(url, "observedTo")
      if (observedFrom !== undefined && observedTo !== undefined && observedFrom > observedTo) {
        throw new LegislationError("invalid_request", "observedFrom must not be after observedTo")
      }
      if (route.name === "bill") {
        await service.assertBillExists(route.billId)
      }
      const limit = queryInteger(url, "limit", 25, 100)
      const page = await service.listChanges({
        billId: route.name === "bill" ? route.billId : undefined,
        classification: changeClassification(queryOptionalString(url, "classification")),
        cursor: queryOptionalString(url, "cursor"),
        jurisdictionId: queryOptionalString(url, "jurisdictionId"),
        limit,
        organizationId: queryOptionalString(url, "organizationId"),
        personId: queryOptionalString(url, "personId"),
        recordId: queryOptionalString(url, "recordId"),
        recordType: queryOptionalString(url, "recordType"),
        observedFrom,
        observedTo
      })
      sendApiJson(
        response,
        200,
        apiPage(
          request,
          { ...page, items: page.items.map((item) => projectChangeEventRead(item, options.apiBaseUrl)) },
          limit
        )
      )
      return true
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

type ChangeFeedRoute = Readonly<{ name: "bill"; billId: string } | { name: "global" }>

function routeMatch(method: string | undefined, pathname: string): ChangeFeedRoute | undefined {
  if (method !== "GET") {
    return undefined
  }
  if (pathname === "/api/changes") {
    return { name: "global" }
  }
  const match = /^\/api\/bills\/([^/]+)\/changes$/u.exec(pathname)
  if (match === null) {
    return undefined
  }
  let billId: string
  try {
    billId = decodeURIComponent(match[1] ?? "")
  } catch {
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
  if (billId.length < 1 || billId.length > 256) {
    throw new LegislationError("invalid_request", "billId must be between 1 and 256 characters")
  }
  return { billId, name: "bill" }
}

function changeClassification(value: string | undefined): CanonicalChangeType | undefined {
  if (value === undefined) {
    return undefined
  }
  if (
    value === "cancel" ||
    value === "create" ||
    value === "delete" ||
    value === "relationship-change" ||
    value === "reschedule" ||
    value === "update"
  ) {
    return value
  }
  throw new LegislationError("invalid_request", "classification is not supported")
}

function assertSingleQueryParameters(url: URL, names: readonly string[]): void {
  for (const name of names) {
    const values = url.searchParams.getAll(name)
    if (values.length > 1) {
      throw new LegislationError("invalid_request", `${name} must appear once`)
    }
    if (values.length === 1 && values[0]?.trim().length === 0) {
      throw new LegislationError("invalid_request", `${name} must not be blank`)
    }
  }
}
