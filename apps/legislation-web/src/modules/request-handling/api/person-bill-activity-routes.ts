import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  BillActivityRole,
  PersonBillActivity,
  PersonBillActivityListInput,
  PersonBillActivityPage
} from "../../legislation/persistence/queries/person-bill-activity.js"
import { isIsoDate, isRfc3339Timestamp } from "./canonical-projection.js"
import { projectBillSummaryRead, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface PersonBillActivityApi {
  assertPersonExists: (personId: string) => Promise<void>
  listPersonBillActivity: (input: PersonBillActivityListInput) => Promise<PersonBillActivityPage>
}

export function createPersonBillActivityApiHandler(
  service: PersonBillActivityApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handlePersonBillActivityRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handlePersonBillActivityRequest(
  service: PersonBillActivityApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const personId = routePersonId(request.method, url.pathname)
  if (personId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, ["cursor", "from", "limit", "role", "sessionId", "status", "to"])
  const from = queryDateBound(url, "from")
  const to = queryDateBound(url, "to")
  validateDateRange(from, to)
  const limit = queryLimit(url)
  await service.assertPersonExists(personId)
  const page = await service.listPersonBillActivity({
    cursor: queryText(url, "cursor", 4096),
    from,
    limit,
    personId,
    role: activityRole(queryText(url, "role", 32)),
    sessionId: queryText(url, "sessionId", 256),
    status: queryText(url, "status", 256),
    to
  })
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), limit))
  return true
}

function projectPage(page: PersonBillActivityPage, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectActivity(item, apiBaseUrl)) }
}

function projectActivity(activity: PersonBillActivity, apiBaseUrl: string) {
  if (!isActivity(activity)) {
    throw new LegislationError(
      "unprocessable",
      "The record cannot be returned because its activity provenance is incomplete"
    )
  }
  return {
    bill: projectBillSummaryRead(activity.bill, apiBaseUrl),
    firstObservedAt: activity.firstObservedAt.toISOString(),
    latestObservedAt: activity.latestObservedAt.toISOString(),
    roles: activity.roles
  }
}

function isActivity(value: unknown): value is PersonBillActivity {
  if (
    !isRecord(value) ||
    !isBillSummaryRead(value.bill) ||
    !isDate(value.firstObservedAt) ||
    !isDate(value.latestObservedAt)
  ) {
    return false
  }
  if (value.firstObservedAt.getTime() > value.latestObservedAt.getTime()) {
    return false
  }
  return (
    Array.isArray(value.roles) &&
    value.roles.length > 0 &&
    value.roles.every(isActivityRole) &&
    new Set(value.roles).size === value.roles.length
  )
}

function isBillSummaryRead(value: unknown): value is import("./canonical-read.js").BillSummaryRead {
  if (!isRecord(value)) {
    return false
  }
  return (
    isStringArray(value.classification) &&
    isDateValue(value.createdAt) &&
    typeof value.id === "string" &&
    typeof value.identifier === "string" &&
    isNullableDateValue(value.introducedAt) &&
    typeof value.jurisdictionId === "string" &&
    isNullableDateValue(value.latestActionAt) &&
    typeof value.sessionId === "string" &&
    (typeof value.status === "string" || value.status === null) &&
    typeof value.sourceUrl === "string" &&
    isStringArray(value.subjects) &&
    typeof value.title === "string" &&
    isDateValue(value.updatedAt) &&
    (value.upstreamIds === undefined || isStringRecord(value.upstreamIds))
  )
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
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "people" || segments[3] !== "bills") {
    return undefined
  }
  const personId = segments[2]
  if (personId === undefined || personId.length < 1 || personId.length > 256) {
    throw new LegislationError("invalid_request", "personId must be between 1 and 256 characters")
  }
  return personId
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

function queryDateBound(url: URL, name: "from" | "to"): string | undefined {
  const value = queryText(url, name, 64)
  if (value === undefined) {
    return undefined
  }
  if (!isIsoDate(value) && !isRfc3339Timestamp(value)) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date or RFC3339 timestamp`)
  }
  return value
}

function validateDateRange(from: string | undefined, to: string | undefined): void {
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

function activityRole(value: string | undefined): BillActivityRole | undefined {
  if (value === undefined) {
    return undefined
  }
  if (isActivityRole(value)) {
    return value
  }
  throw new LegislationError("invalid_request", "role must be sponsor, cosponsor, author, or subject")
}

function isActivityRole(value: unknown): value is BillActivityRole {
  return value === "sponsor" || value === "cosponsor" || value === "author" || value === "subject"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function isDateValue(value: unknown): value is Date | string {
  return value instanceof Date || typeof value === "string"
}

function isNullableDateValue(value: unknown): value is Date | string | null {
  return value === null || isDateValue(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string")
}
