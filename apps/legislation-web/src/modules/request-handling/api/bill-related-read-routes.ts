import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  BILL_RELATION_CLASSIFICATIONS,
  projectBillRelatedRead,
  type BillRelatedListInput,
  type BillRelatedMode,
  type BillRelatedPage,
  type BillRelationClassification
} from "../../legislation/persistence/queries/bill-related-read"
import { toProjectionLegislationError } from "./canonical-read"
import {
  assertAllowedQueryParameters,
  apiPage,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface BillRelatedReadApi {
  assertBillExists: (billId: string) => Promise<void>
  listBillRelatedBills: (input: BillRelatedListInput) => Promise<BillRelatedPage>
}

export function createBillRelatedReadApiHandler(
  service: BillRelatedReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      const billId = routeBillId(request.method, url.pathname)
      if (billId === undefined) {
        return false
      }
      assertAllowedQueryParameters(url, ["classification", "cursor", "limit", "mode"])
      const classifications = queryClassifications(url)
      const mode = queryMode(url)
      const limit = queryLimit(url)
      await service.assertBillExists(billId)
      const page = await service.listBillRelatedBills({
        billId,
        classifications,
        cursor: queryText(url, "cursor", 4096),
        limit,
        mode
      })
      sendApiJson(response, 200, apiPage(request, projectPage(page, options.apiBaseUrl), limit))
      return true
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

function projectPage(page: BillRelatedPage, apiBaseUrl: string) {
  return { ...page, items: page.items.map((item) => projectBillRelatedRead(item, apiBaseUrl)) }
}

function routeBillId(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/")
  if (
    segments.length !== 5 ||
    segments[0] !== "" ||
    segments[1] !== "api" ||
    segments[2] !== "bills" ||
    segments[3] === "" ||
    segments[4] !== "related"
  ) {
    return undefined
  }
  try {
    const value = decodeURIComponent(segments[3] ?? "").trim()
    if (value.length < 1 || value.length > 256) {
      throw new LegislationError("invalid_request", "billId must be between 1 and 256 characters")
    }
    return value
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function queryClassifications(url: URL): BillRelationClassification[] | undefined {
  const values = url.searchParams.getAll("classification")
  if (values.length === 0) {
    return undefined
  }
  const normalized = values.map((value) => value.trim())
  if (normalized.some((value) => value.length === 0 || value.length > 32)) {
    throw new LegislationError("invalid_request", "classification values must be between 1 and 32 characters")
  }
  const unsupported = normalized.find((value) => !(BILL_RELATION_CLASSIFICATIONS as readonly string[]).includes(value))
  if (unsupported !== undefined) {
    throw new LegislationError("invalid_request", "classification is not a supported bill relation classification")
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new LegislationError("invalid_request", "classification values must be unique")
  }
  return normalized as BillRelationClassification[]
}

function queryMode(url: URL): BillRelatedMode {
  const value = queryText(url, "mode", 16)
  if (value === undefined || value === "all") {
    return "all"
  }
  if (value === "explicit" || value === "similar") {
    return value
  }
  throw new LegislationError("invalid_request", "mode must be explicit, similar, or all")
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
