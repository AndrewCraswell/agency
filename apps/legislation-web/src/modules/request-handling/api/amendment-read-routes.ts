import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { AmendmentReadRepository } from "./amendment-read-repository"
import type { AmendmentDetail } from "./canonical-projection"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  correlationId,
  queryInteger,
  queryOptionalIsoDate,
  queryOptionalString,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler,
  type JsonRecord
} from "./http"

const MAX_BATCH_BYTES = 5 * 1024 * 1024
const MAX_BATCH_ITEMS = 25
const MAX_BATCH_CONCURRENCY = 4

type BatchItem =
  | Readonly<{ data: AmendmentDetail; id: string; status: "ok" }>
  | Readonly<{ error: ItemError; id: string; status: "error" }>

type BillBatchItem =
  | Readonly<{ billId: string; page: JsonRecord; status: "ok" }>
  | Readonly<{ billId: string; error: ItemError; status: "error" }>

type ItemError = Readonly<{
  category: "dependency_unavailable" | "forbidden" | "not_found"
  message: string
  retryable: boolean
}>

export function createAmendmentReadApiHandler(repository: AmendmentReadRepository): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      if (request.method === "GET") {
        const billId = billAmendmentPath(url.pathname)
        if (billId !== undefined) {
          assertAllowedQueryParameters(url, BILL_AMENDMENT_QUERY_PARAMETERS)
          const input = parseBillAmendmentCollectionInput(url, billId)
          await repository.assertBill(billId)
          const page = await repository.listAmendments(input)
          sendApiJson(response, 200, apiPage(request, page, input.limit ?? 25))
          return true
        }
        const amendmentId = amendmentPath(url.pathname)
        if (amendmentId !== undefined) {
          assertAllowedQueryParameters(url, [])
          sendApiJson(response, 200, apiResource(request, await repository.getAmendment(amendmentId)))
          return true
        }
        if (url.pathname !== "/api/amendments") {
          return false
        }
        assertAllowedQueryParameters(url, AMENDMENT_QUERY_PARAMETERS)
        const input = parseAmendmentCollectionInput(url)
        const page = await repository.listAmendments(input)
        sendApiJson(response, 200, apiPage(request, page, input.limit ?? 25))
        return true
      }
      if (request.method !== "POST") {
        return false
      }
      if (url.pathname === "/api/amendments/batch") {
        assertAllowedQueryParameters(url, [])
        const ids = parseIdsBody(await readJsonBody(request, MAX_BATCH_BYTES), "ids")
        const data = await mapConcurrent(ids, MAX_BATCH_CONCURRENCY, async (id) => await resolveDetail(repository, id))
        sendBatch(response, request, url, data)
        return true
      }
      if (url.pathname !== "/api/bills/amendments/batch") {
        return false
      }
      assertAllowedQueryParameters(url, [])
      const requestBody = parseBillBatchBody(await readJsonBody(request, MAX_BATCH_BYTES))
      const data = await mapConcurrent(requestBody.billIds, MAX_BATCH_CONCURRENCY, async (billId) => {
        try {
          await repository.assertBill(billId)
          const page = await repository.listAmendments({
            ...requestBody.filters,
            billId,
            limit: requestBody.limitPerBill
          })
          return {
            billId,
            page: billAmendmentPage(request, billId, page, requestBody.filters, requestBody.limitPerBill),
            status: "ok"
          } as const
        } catch (error) {
          return { billId, error: batchError(error), status: "error" } as const
        }
      })
      sendBatch(response, request, url, data)
      return true
    } catch (error) {
      sendApiError(request, response, error)
      return true
    }
  }
}

const AMENDMENT_QUERY_PARAMETERS = [
  "billId",
  "cursor",
  "jurisdictionId",
  "limit",
  "recordType",
  "sponsorPersonId",
  "status",
  "submittedFrom",
  "submittedTo",
  "sort"
] as const

const BILL_AMENDMENT_QUERY_PARAMETERS = [
  "cursor",
  "limit",
  "recordType",
  "status",
  "submittedFrom",
  "submittedTo"
] as const

function parseAmendmentCollectionInput(url: URL) {
  assertSingleNonBlankQueryValues(url, AMENDMENT_QUERY_PARAMETERS)
  const submittedFrom = queryOptionalIsoDate(url, "submittedFrom")
  const submittedTo = queryOptionalIsoDate(url, "submittedTo")
  if (submittedFrom !== undefined && submittedTo !== undefined && submittedFrom > submittedTo) {
    throw new LegislationError("invalid_request", "submittedFrom must not be after submittedTo")
  }
  const sort = amendmentSort(queryOptionalString(url, "sort") ?? "submitted-desc")
  return {
    billId: queryOptionalString(url, "billId"),
    cursor: queryOptionalString(url, "cursor"),
    jurisdictionId: queryOptionalString(url, "jurisdictionId"),
    limit: queryInteger(url, "limit", 25),
    recordType: amendmentRecordType(queryOptionalString(url, "recordType")),
    sponsorPersonId: queryOptionalString(url, "sponsorPersonId"),
    status: queryOptionalString(url, "status"),
    submittedFrom,
    submittedTo,
    sort
  } as const
}

function parseBillAmendmentCollectionInput(url: URL, billId: string) {
  assertSingleNonBlankQueryValues(url, ["cursor", "limit", "submittedFrom", "submittedTo"])
  const submittedFrom = queryOptionalIsoDate(url, "submittedFrom")
  const submittedTo = queryOptionalIsoDate(url, "submittedTo")
  if (submittedFrom !== undefined && submittedTo !== undefined && submittedFrom > submittedTo) {
    throw new LegislationError("invalid_request", "submittedFrom must not be after submittedTo")
  }
  return {
    billId,
    cursor: queryOptionalString(url, "cursor"),
    limit: queryInteger(url, "limit", 25),
    recordTypes: repeatedRecordTypes(url, "recordType"),
    statuses: repeatedNonBlankStrings(url, "status"),
    submittedFrom,
    submittedTo
  } as const
}

function parseBillBatchBody(body: JsonRecord): Readonly<{
  billIds: readonly string[]
  filters: Readonly<{
    recordTypes?: readonly ("document" | "structured")[]
    statuses?: readonly string[]
    submittedFrom?: string
    submittedTo?: string
  }>
  limitPerBill: number
}> {
  const allowed = ["billIds", "limitPerBill", "recordType", "status", "submittedFrom", "submittedTo"]
  assertExactKeys(body, allowed, ["billIds"])
  const billIds = parseIdsValue(body.billIds, "billIds")
  const limitPerBill = optionalInteger(body.limitPerBill, "limitPerBill", 25)
  const recordTypes = optionalRecordTypes(body.recordType)
  const statuses = optionalNonBlankStrings(body.status, "status")
  const submittedFrom = optionalIsoDate(body.submittedFrom, "submittedFrom")
  const submittedTo = optionalIsoDate(body.submittedTo, "submittedTo")
  if (submittedFrom !== undefined && submittedTo !== undefined && submittedFrom > submittedTo) {
    throw new LegislationError("invalid_request", "submittedFrom must not be after submittedTo")
  }
  return { billIds, filters: { recordTypes, statuses, submittedFrom, submittedTo }, limitPerBill }
}

function parseIdsBody(body: JsonRecord, property: "billIds" | "ids"): string[] {
  assertExactKeys(body, [property], [property])
  return parseIdsValue(body[property], property)
}

function parseIdsValue(value: unknown, property: "billIds" | "ids"): string[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw new LegislationError("invalid_request", `${property} must contain between 1 and ${MAX_BATCH_ITEMS} IDs`)
  }
  const ids = value.map((item, index) => {
    if (typeof item !== "string") {
      throw new LegislationError("invalid_request", `${property}[${index}] must be a string`)
    }
    const id = item.trim()
    if (id.length < 1 || id.length > 256) {
      throw new LegislationError("invalid_request", `${property}[${index}] must be between 1 and 256 characters`)
    }
    return id
  })
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length > MAX_BATCH_ITEMS) {
    throw new LegislationError("invalid_request", `${property} must contain between 1 and ${MAX_BATCH_ITEMS} IDs`)
  }
  return uniqueIds
}

function assertExactKeys(body: JsonRecord, allowed: readonly string[], required: readonly string[]): void {
  const keys = Object.keys(body)
  if (keys.some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(body, key))) {
    throw new LegislationError("invalid_request", "Request body contains unsupported or missing properties")
  }
}

function optionalInteger(value: unknown, name: string, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new LegislationError("invalid_request", `${name} must be an integer between 1 and 100`)
  }
  return value
}

function optionalRecordTypes(value: unknown): readonly ("document" | "structured")[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) {
    throw new LegislationError("invalid_request", "recordType must contain one or two values")
  }
  if (value.some((item) => item !== "document" && item !== "structured") || new Set(value).size !== value.length) {
    throw new LegislationError("invalid_request", "recordType must contain unique document or structured values")
  }
  return value
}

function repeatedRecordTypes(url: URL, name: string): readonly ("document" | "structured")[] | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length > 2 || values.some((value) => value !== "document" && value !== "structured")) {
    throw new LegislationError("invalid_request", `${name} must contain unique document or structured values`)
  }
  if (new Set(values).size !== values.length) {
    throw new LegislationError("invalid_request", `${name} values must be unique`)
  }
  return values as readonly ("document" | "structured")[]
}

function optionalNonBlankStrings(value: unknown, name: string): readonly string[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BATCH_ITEMS) {
    throw new LegislationError("invalid_request", `${name} must contain between 1 and ${MAX_BATCH_ITEMS} values`)
  }
  const values = value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new LegislationError("invalid_request", `${name} must contain non-empty strings`)
    }
    return item.trim()
  })
  if (new Set(values).size !== values.length) {
    throw new LegislationError("invalid_request", `${name} values must be unique`)
  }
  return values
}

function repeatedNonBlankStrings(url: URL, name: string): readonly string[] | undefined {
  const values = url.searchParams.getAll(name).map((value) => value.trim())
  if (values.length === 0) {
    return undefined
  }
  if (values.length > MAX_BATCH_ITEMS || values.some((value) => value.length === 0)) {
    throw new LegislationError(
      "invalid_request",
      `${name} must contain between 1 and ${MAX_BATCH_ITEMS} non-empty values`
    )
  }
  if (new Set(values).size !== values.length) {
    throw new LegislationError("invalid_request", `${name} values must be unique`)
  }
  return values
}

function optionalIsoDate(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date`)
  }
  return value
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    return false
  }
  const [year, month, day] = match.slice(1).map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function amendmentSort(value: string): "identifier-asc" | "submitted-desc" | "updated-desc" {
  if (value === "identifier-asc" || value === "submitted-desc" || value === "updated-desc") {
    return value
  }
  throw new LegislationError("invalid_request", "sort is not supported for amendments")
}

function amendmentRecordType(value: string | undefined): "document" | "structured" | undefined {
  if (value === undefined || value === "document" || value === "structured") {
    return value
  }
  throw new LegislationError("invalid_request", "recordType must be document or structured")
}

function assertSingleNonBlankQueryValues(url: URL, names: readonly string[]): void {
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

function amendmentPath(pathname: string): string | undefined {
  const segments = pathname.split("/")
  if (segments.length !== 4 || segments[0] !== "" || segments[1] !== "api" || segments[2] !== "amendments") {
    return undefined
  }
  try {
    const amendmentId = decodeURIComponent(segments[3] ?? "").trim()
    if (amendmentId.length < 1 || amendmentId.length > 256) {
      throw new LegislationError("invalid_request", "amendmentId must be between 1 and 256 characters")
    }
    return amendmentId
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function billAmendmentPath(pathname: string): string | undefined {
  const segments = pathname.split("/")
  if (
    segments.length !== 5 ||
    segments[0] !== "" ||
    segments[1] !== "api" ||
    segments[2] !== "bills" ||
    segments[4] !== "amendments"
  ) {
    return undefined
  }
  try {
    const billId = decodeURIComponent(segments[3] ?? "").trim()
    if (billId.length < 1 || billId.length > 256) {
      throw new LegislationError("invalid_request", "billId must be between 1 and 256 characters")
    }
    return billId
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

async function resolveDetail(repository: AmendmentReadRepository, id: string): Promise<BatchItem> {
  try {
    return { data: await repository.getAmendment(id), id, status: "ok" }
  } catch (error) {
    return { error: batchError(error), id, status: "error" }
  }
}

function batchError(error: unknown): ItemError {
  if (error instanceof LegislationError) {
    if (error.category === "not_found" || error.category === "forbidden") {
      return { category: error.category, message: error.message, retryable: false }
    }
    if (error.category === "dependency_unavailable") {
      return { category: error.category, message: error.message, retryable: true }
    }
  }
  return {
    category: "dependency_unavailable",
    message: "The amendment is incomplete in canonical persistence",
    retryable: false
  }
}

function sendBatch(
  response: Parameters<HttpApiHandler>[1],
  request: Parameters<HttpApiHandler>[0],
  url: URL,
  data: readonly (BatchItem | BillBatchItem)[]
): void {
  sendApiJson(response, 200, {
    data,
    links: { self: `${url.pathname}${url.search}` },
    meta: { correlationId: correlationId(request), requested: data.length, returned: data.length, warnings: [] }
  })
}

function billAmendmentPage(
  request: Parameters<HttpApiHandler>[0],
  billId: string,
  page: Awaited<ReturnType<AmendmentReadRepository["listAmendments"]>>,
  filters: Readonly<{
    recordTypes?: readonly ("document" | "structured")[]
    statuses?: readonly string[]
    submittedFrom?: string
    submittedTo?: string
  }>,
  limit: number
): JsonRecord {
  const pathname = `/api/bills/${encodeURIComponent(billId)}/amendments`
  const parameters = new URLSearchParams()
  for (const recordType of filters.recordTypes ?? []) {
    parameters.append("recordType", recordType)
  }
  for (const status of filters.statuses ?? []) {
    parameters.append("status", status)
  }
  if (filters.submittedFrom !== undefined) {
    parameters.set("submittedFrom", filters.submittedFrom)
  }
  if (filters.submittedTo !== undefined) {
    parameters.set("submittedTo", filters.submittedTo)
  }
  parameters.set("limit", String(limit))
  const self = parameters.size === 0 ? pathname : `${pathname}?${parameters}`
  const nextCursor = page.nextCursor ?? null
  const next =
    nextCursor === null
      ? null
      : (() => {
          const nextParameters = new URLSearchParams(parameters)
          nextParameters.set("cursor", nextCursor)
          return `${pathname}?${nextParameters}`
        })()
  return {
    data: page.items,
    links: { next, self },
    meta: {
      correlationId: correlationId(request),
      limit,
      nextCursor,
      truncated: page.truncated,
      warnings: []
    }
  }
}
