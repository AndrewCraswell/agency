import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { BillDetailReadRepository } from "./bill-detail-read-repository.js"
import type { BillDetail } from "./canonical-projection.js"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  correlationId,
  queryInteger,
  queryOptionalDate,
  queryOptionalString,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler,
  type JsonRecord
} from "./http.js"

const MAX_BATCH_BYTES = 5 * 1024 * 1024
const MAX_BATCH_ITEMS = 25
const MAX_BATCH_CONCURRENCY = 4

type BatchItem =
  | Readonly<{ data: BillDetail; id: string; status: "ok" }>
  | Readonly<{ error: ItemError; id: string; status: "error" }>

type ItemError = Readonly<{
  category: "dependency_unavailable" | "forbidden" | "not_found"
  message: string
  retryable: boolean
}>

export function createBillDetailReadApiHandler(repository: BillDetailReadRepository): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      if (request.method === "GET") {
        const relationship = billRelationshipPath(url.pathname)
        if (relationship !== undefined) {
          return await serveRelationshipPage(repository, relationship, request, response, url)
        }
        const billId = billDetailPath(url.pathname)
        if (billId === undefined) {
          return false
        }
        assertAllowedQueryParameters(url, ["childLimit"])
        const data = await repository.getBillDetail({ childLimit: childLimit(url), id: billId })
        sendApiJson(response, 200, apiResource(request, data))
        return true
      }
      if (request.method !== "POST" || url.pathname !== "/api/bills/batch") {
        return false
      }
      assertAllowedQueryParameters(url, [])
      const ids = deduplicateIds(parseBatchBody(await readJsonBody(request, MAX_BATCH_BYTES)))
      const data = await mapConcurrent(ids, MAX_BATCH_CONCURRENCY, async (id) => await resolveBatchItem(repository, id))
      sendApiJson(response, 200, {
        data,
        links: { self: `${url.pathname}${url.search}` },
        meta: { correlationId: correlationId(request), requested: ids.length, returned: data.length, warnings: [] }
      })
      return true
    } catch (error) {
      sendApiError(request, response, error)
      return true
    }
  }
}

async function serveRelationshipPage(
  repository: BillDetailReadRepository,
  relationship: Readonly<{ billId: string; collection: "votes" }>,
  request: Parameters<HttpApiHandler>[0],
  response: Parameters<HttpApiHandler>[1],
  url: URL
): Promise<boolean> {
  assertAllowedQueryParameters(url, ["cursor", "limit", "from", "to", "organizationId", "classification", "result"])
  assertSingleNonBlankQueryValues(url, ["cursor", "limit", "from", "to", "organizationId", "classification", "result"])
  // Vote details contain positions, so this relationship intentionally does
  // not inherit the broader 100-item collection maximum.
  const limit = queryInteger(url, "limit", MAX_BATCH_ITEMS, MAX_BATCH_ITEMS)
  const from = queryOptionalDate(url, "from")
  const to = queryOptionalDate(url, "to")
  assertOrderedRange(from, to, "from", "to")
  const page = await repository.listBillVotes({
    billId: relationship.billId,
    classification: queryOptionalString(url, "classification"),
    cursor: queryOptionalString(url, "cursor"),
    from,
    limit,
    organizationId: queryOptionalString(url, "organizationId"),
    result: voteResult(queryOptionalString(url, "result")),
    to
  })
  sendApiJson(response, 200, apiPage(request, page, limit))
  return true
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

function assertOrderedRange(
  from: Date | string | undefined,
  to: Date | string | undefined,
  fromName: string,
  toName: string
): void {
  const fromValue = from instanceof Date ? from.getTime() : from
  const toValue = to instanceof Date ? to.getTime() : to
  const inverted =
    typeof fromValue === "number" && typeof toValue === "number"
      ? fromValue > toValue
      : typeof fromValue === "string" && typeof toValue === "string" && fromValue > toValue
  if (inverted) {
    throw new LegislationError("invalid_request", `${fromName} must not be after ${toName}`)
  }
}

async function resolveBatchItem(repository: BillDetailReadRepository, id: string): Promise<BatchItem> {
  try {
    return { data: await repository.getBillDetail({ childLimit: MAX_BATCH_ITEMS, id }), id, status: "ok" }
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
  // BatchResponse cannot encode `unprocessable`. Preserve per-item isolation
  // and make the deterministic canonical-persistence defect explicit rather
  // than representing it as a provider outage or retryable operation.
  return {
    category: "dependency_unavailable",
    message: "The bill is incomplete in canonical persistence",
    retryable: false
  }
}

function billDetailPath(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length !== 3 || segments[0] !== "api" || segments[1] !== "bills") {
    return undefined
  }
  try {
    const id = decodeURIComponent(segments[2] ?? "").trim()
    if (id.length < 1 || id.length > 256) {
      throw new LegislationError("invalid_request", "billId must be between 1 and 256 characters")
    }
    return id
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function billRelationshipPath(pathname: string): Readonly<{ billId: string; collection: "votes" }> | undefined {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "bills" || segments[3] !== "votes") {
    return undefined
  }
  const billId = billDetailPath(`/api/bills/${segments[2] ?? ""}`)
  return billId === undefined ? undefined : { billId, collection: segments[3] }
}

function voteResult(value: string | undefined): "failed" | "other" | "passed" | undefined {
  if (value === undefined || value === "failed" || value === "other" || value === "passed") {
    return value
  }
  throw new LegislationError("invalid_request", "result must be passed, failed, or other")
}

function childLimit(url: URL): number | undefined {
  const values = url.searchParams.getAll("childLimit")
  if (values.length === 0) {
    return undefined
  }
  if (values.length !== 1 || !/^\d+$/.test(values[0] ?? "")) {
    throw new LegislationError("invalid_request", "childLimit must be an integer between 1 and 25")
  }
  const value = Number(values[0])
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_BATCH_ITEMS) {
    throw new LegislationError("invalid_request", "childLimit must be an integer between 1 and 25")
  }
  return value
}

function parseBatchBody(body: JsonRecord): string[] {
  if (Object.keys(body).length !== 1 || !Object.hasOwn(body, "ids") || !Array.isArray(body.ids)) {
    throw new LegislationError("invalid_request", "Request body must contain only an ids array")
  }
  if (body.ids.length < 1 || body.ids.length > MAX_BATCH_ITEMS) {
    throw new LegislationError("invalid_request", "ids must contain between 1 and 25 values")
  }
  return body.ids.map((value, index) => {
    if (typeof value !== "string") {
      throw new LegislationError("invalid_request", `ids[${index}] must be a string`)
    }
    const id = value.trim()
    if (id.length < 1 || id.length > 256) {
      throw new LegislationError("invalid_request", `ids[${index}] must be between 1 and 256 characters`)
    }
    return id
  })
}

function deduplicateIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}
