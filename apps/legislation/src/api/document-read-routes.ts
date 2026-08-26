import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  CanonicalDocumentDetailRead,
  CanonicalDocumentRead,
  CanonicalDocumentSectionRead,
  DocumentPage
} from "../db/queries/document-reads.js"
import type {
  BillDocumentListInput,
  DocumentClassification,
  DocumentSectionListInput,
  ProcessingStatus
} from "../db/queries/document-reads.js"
import { LegislationError } from "../legislation/errors.js"
import { projectDocumentDetail, projectDocumentSection, projectDocumentSummary } from "./canonical-projection.js"
import { projectDocumentSectionRead, sourceProjectionContext, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  apiResource,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

/** The bounded database reads used by the public document HTTP slice. */
export interface DocumentReadApi {
  assertBillExists: (billId: string) => Promise<void>
  getDocumentDetail: (documentId: string) => Promise<CanonicalDocumentDetailRead>
  getDocumentSection: (
    input: Readonly<{ documentId: string; sectionId: string }>
  ) => Promise<CanonicalDocumentSectionRead>
  listBillDocuments: (input: BillDocumentListInput) => Promise<DocumentPage<CanonicalDocumentRead>>
  listDocumentSections: (input: DocumentSectionListInput) => Promise<DocumentPage<CanonicalDocumentSectionRead>>
}

export function createDocumentReadApiHandler(
  service: DocumentReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleDocumentReadRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleDocumentReadRequest(
  service: DocumentReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, allowedQueryParameters(route.name))

  switch (route.name) {
    case "listBillDocuments": {
      const limit = queryInteger(url, "limit", 20)
      await service.assertBillExists(route.billId)
      const page = await service.listBillDocuments({
        billId: route.billId,
        classification: documentClassification(singleQueryString(url, "classification")),
        cursor: singleQueryString(url, "cursor"),
        limit,
        processingStatus: processingStatus(singleQueryString(url, "processingStatus")),
        versionCode: singleQueryString(url, "versionCode")
      })
      sendApiJson(response, 200, apiPage(request, projectDocumentPage(page, apiBaseUrl), limit))
      return true
    }
    case "getDocument": {
      const document = await service.getDocumentDetail(route.documentId)
      sendApiJson(response, 200, apiResource(request, projectDocumentDetailRead(document, apiBaseUrl)))
      return true
    }
    case "getDocumentSection": {
      const section = await service.getDocumentSection({ documentId: route.documentId, sectionId: route.sectionId })
      sendApiJson(response, 200, apiResource(request, projectDocumentSectionRead(section, apiBaseUrl)))
      return true
    }
    case "listDocumentSections": {
      const limit = queryInteger(url, "limit", 20)
      const pageFrom = optionalPositiveInteger(url, "pageFrom")
      const pageTo = optionalPositiveInteger(url, "pageTo")
      if (pageFrom !== undefined && pageTo !== undefined && pageFrom > pageTo) {
        throw new LegislationError("invalid_request", "pageFrom must not be greater than pageTo")
      }
      // Establish that the parent exists before treating an empty child page
      // as a valid collection response. The detail read also keeps historical
      // rows without canonical OCR/provenance facts fail-closed.
      await service.getDocumentDetail(route.documentId)
      const page = await service.listDocumentSections({
        cursor: singleQueryString(url, "cursor"),
        documentId: route.documentId,
        heading: singleQueryString(url, "heading"),
        limit,
        pageFrom,
        pageTo
      })
      sendApiJson(response, 200, apiPage(request, projectDocumentSectionPage(page, apiBaseUrl), limit))
      return true
    }
  }
}

function projectDocumentPage(page: DocumentPage<CanonicalDocumentRead>, apiBaseUrl: string) {
  return {
    ...page,
    items: page.items.map((item) => projectDocumentSummaryRead(item, apiBaseUrl))
  }
}

function projectDocumentSectionPage(page: DocumentPage<CanonicalDocumentSectionRead>, apiBaseUrl: string) {
  return {
    ...page,
    items: page.items.map((item) =>
      projectDocumentSection(
        {
          ...item.section,
          billId: item.document.billId,
          documentId: item.document.id,
          endOffset: item.section.sourceEndOffset,
          sourceUrl: item.document.sourceUrl,
          startOffset: item.section.sourceStartOffset
        },
        sourceProjectionContext(item.document, apiBaseUrl)
      )
    )
  }
}

export function projectDocumentSummaryRead(value: CanonicalDocumentRead, apiBaseUrl: string) {
  assertCanonicalDocumentStatuses(value)
  return projectDocumentSummary(
    {
      ...value,
      mimeType: value.mimeType
    },
    sourceProjectionContext(value, apiBaseUrl)
  )
}

export function projectDocumentDetailRead(value: CanonicalDocumentDetailRead, apiBaseUrl: string) {
  assertCanonicalDocumentStatuses(value)
  return projectDocumentDetail(
    {
      ...value,
      mimeType: value.mimeType
    },
    sourceProjectionContext(value, apiBaseUrl)
  )
}

type DocumentReadRoute =
  | { billId: string; name: "listBillDocuments" }
  | { documentId: string; name: "getDocument" | "listDocumentSections" }
  | { documentId: string; name: "getDocumentSection"; sectionId: string }

function routeMatch(method: string | undefined, pathname: string): DocumentReadRoute | undefined {
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
  if (segments[0] !== "api") {
    return undefined
  }
  if (
    segments[1] === "bills" &&
    segments.length === 4 &&
    typeof segments[2] === "string" &&
    segments[3] === "documents"
  ) {
    return { billId: segments[2], name: "listBillDocuments" }
  }
  if (segments[1] !== "documents" || typeof segments[2] !== "string") {
    return undefined
  }
  if (segments.length === 3) {
    return { documentId: segments[2], name: "getDocument" }
  }
  if (segments.length === 4 && segments[3] === "sections") {
    return { documentId: segments[2], name: "listDocumentSections" }
  }
  return segments.length === 5 && segments[3] === "sections" && typeof segments[4] === "string"
    ? {
        documentId: canonicalPathId(segments[2], "documentId"),
        name: "getDocumentSection",
        sectionId: canonicalPathId(segments[4], "sectionId")
      }
    : undefined
}

function allowedQueryParameters(name: DocumentReadRoute["name"]): readonly string[] {
  switch (name) {
    case "listBillDocuments":
      return ["classification", "cursor", "limit", "processingStatus", "versionCode"]
    case "listDocumentSections":
      return ["cursor", "heading", "limit", "pageFrom", "pageTo"]
    case "getDocument":
    case "getDocumentSection":
      return []
  }
}

function canonicalPathId(value: string, name: string): string {
  if (value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}

function singleQueryString(url: URL, name: string): string | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("invalid_request", `${name} must appear once`)
  }
  const value = values[0]?.trim() ?? ""
  if (value.length === 0) {
    throw new LegislationError("invalid_request", `${name} must not be empty`)
  }
  return value
}

function optionalPositiveInteger(url: URL, name: string): number | undefined {
  const value = singleQueryString(url, name)
  if (value === undefined) {
    return undefined
  }
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", `${name} must be a positive integer`)
  }
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 1) {
    throw new LegislationError("invalid_request", `${name} must be a positive integer`)
  }
  return result
}

function documentClassification(value: string | undefined): DocumentClassification | undefined {
  if (value === undefined) {
    return undefined
  }
  switch (value) {
    case "amendment":
    case "analysis":
    case "fiscal-note":
    case "supplemental":
    case "version":
      return value
    default:
      throw new LegislationError("invalid_request", "classification must be a supported document classification")
  }
}

function processingStatus(value: string | undefined): ProcessingStatus | undefined {
  if (value === undefined) {
    return undefined
  }
  switch (value) {
    case "failed":
    case "pending":
    case "processed":
    case "processing":
    case "unsupported":
      return value
    default:
      throw new LegislationError("invalid_request", "processingStatus must be a supported processing status")
  }
}

function assertCanonicalDocumentStatuses(value: Pick<CanonicalDocumentRead, "ocrStatus" | "processingStatus">): void {
  if (
    value.ocrStatus !== "not-required" &&
    value.ocrStatus !== "pending" &&
    value.ocrStatus !== "processing" &&
    value.ocrStatus !== "processed" &&
    value.ocrStatus !== "failed" &&
    value.ocrStatus !== "unsupported"
  ) {
    throw new LegislationError("unprocessable", "Document OCR status is not canonical")
  }
  if (
    value.processingStatus !== "pending" &&
    value.processingStatus !== "processing" &&
    value.processingStatus !== "processed" &&
    value.processingStatus !== "failed" &&
    value.processingStatus !== "unsupported"
  ) {
    throw new LegislationError("unprocessable", "Document processing status is not canonical")
  }
}
