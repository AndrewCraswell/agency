import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { BillTextSectionListInput } from "../../legislation/persistence/queries/bill-text-read"
import { normalizeBillTextSectionListInput } from "../../legislation/persistence/queries/bill-text-read"
import type { CanonicalDocumentSectionRead, DocumentPage } from "../../legislation/persistence/queries/document-reads"
import { projectDocumentSectionRead, toProjectionLegislationError } from "./canonical-read"
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

export interface BillTextReadApi {
  assertBillExists: (billId: string) => Promise<void>
  listBillTextSections: (input: BillTextSectionListInput) => Promise<DocumentPage<CanonicalDocumentSectionRead>>
}

export function createBillTextReadApiHandler(
  service: BillTextReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleBillTextReadRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleBillTextReadRequest(
  service: BillTextReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const billId = routeMatch(request.method, url.pathname)
  if (billId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, ["cursor", "documentId", "heading", "limit", "pageFrom", "pageTo", "versionCode"])
  const input = normalizeBillTextSectionListInput({
    billId,
    cursor: optionalSingleValue(url, "cursor", 4096),
    documentIds: repeatedValues(url, "documentId"),
    heading: optionalSingleValue(url, "heading", 256),
    limit: queryLimit(url),
    pageFrom: optionalPositiveInteger(url, "pageFrom"),
    pageTo: optionalPositiveInteger(url, "pageTo"),
    versionCodes: repeatedValues(url, "versionCode")
  })
  await service.assertBillExists(input.billId)
  const page = await service.listBillTextSections(input)
  sendApiJson(response, 200, apiPage(request, projectPage(page, apiBaseUrl), input.limit))
  return true
}

function projectPage(page: DocumentPage<CanonicalDocumentSectionRead>, apiBaseUrl: string) {
  return {
    ...page,
    items: page.items.map((item) => projectDocumentSectionRead(item, apiBaseUrl))
  }
}

function routeMatch(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.startsWith("/") ? pathname.slice(1).split("/") : []
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "bills" || segments[3] !== "sections") {
    return undefined
  }
  const billIdSegment = segments[2]
  if (billIdSegment === undefined) {
    return undefined
  }
  try {
    return requiredPathId(decodeURIComponent(billIdSegment), "billId")
  } catch (error) {
    if (error instanceof URIError) {
      throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
    }
    throw error
  }
}

function requiredPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}

function queryLimit(url: URL): number {
  const value = optionalSingleValue(url, "limit", 16)
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

function optionalPositiveInteger(url: URL, name: string): number | undefined {
  const value = optionalSingleValue(url, name, 16)
  if (value === undefined) {
    return undefined
  }
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", `${name} must be a positive integer`)
  }
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new LegislationError("invalid_request", `${name} must be a positive integer`)
  }
  return number
}

function optionalSingleValue(url: URL, name: string, maximum: number): string | undefined {
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

function repeatedValues(url: URL, name: string): readonly string[] | undefined {
  const values = url.searchParams.getAll(name).map((value) => value.trim())
  if (values.length === 0) {
    return undefined
  }
  if (values.length > 25 || values.some((value) => value.length === 0 || value.length > 256)) {
    throw new LegislationError("invalid_request", `${name} must contain between 1 and 25 values`)
  }
  if (new Set(values).size !== values.length) {
    throw new LegislationError("invalid_request", `${name} values must be unique`)
  }
  return values
}
