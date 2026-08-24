import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "../legislation/errors.js"
import type {
  AmendmentSearchInput,
  BillBrowseInput,
  BillLookup,
  ChangeSearchInput,
  DocumentSectionLookup,
  EntityLookup,
  JurisdictionSearchInput,
  SessionSearchInput,
  SupportingMaterialSearchInput,
  VoteSearchInput
} from "../legislation/query-service.js"
import {
  projectBillSummaryRead,
  projectDocumentSectionRead,
  projectSupportingMaterialDetailRead,
  projectSupportingMaterialSectionRead,
  projectSupportingMaterialSummaryRead,
  toProjectionLegislationError
} from "./canonical-read.js"
import type {
  BillSummaryRead,
  DocumentSectionRead,
  SupportingMaterialDetailRead,
  SupportingMaterialRead,
  SupportingMaterialSectionRead
} from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  apiResource,
  correlationId,
  queryInteger,
  queryOptionalDate,
  queryOptionalIsoDate,
  queryOptionalString,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  stringArrayBody,
  type HttpApiHandler
} from "./http.js"

type ChangeType = ChangeSearchInput["changeType"]

export interface CoreReadQueryApi {
  findRelatedBills: (input: BillLookup & { includeSemantic?: boolean; limit?: number }) => Promise<CorePage>
  getAmendment: (input: EntityLookup) => Promise<unknown>
  getBill: (input: BillLookup) => Promise<unknown>
  getBillText: (
    input: BillLookup & { cursor?: string; documentId?: string; versionCode?: string }
  ) => Promise<SectionPage>
  getBillTimeline: (input: BillLookup) => Promise<TimelinePage>
  getBillVotes: (input: Readonly<{ billId: string; cursor?: string; limit?: number }>) => Promise<CorePage>
  getSupportingMaterial: (input: EntityLookup) => Promise<Readonly<{ material: unknown }>>
  getSupportingMaterialSection?: (
    input: Readonly<{ materialId: string; sectionId: string }>
  ) => Promise<SupportingMaterialSectionRead>
  getDocument: (input: EntityLookup) => Promise<unknown>
  getDocumentSection?: (input: Readonly<{ documentId: string; sectionId: string }>) => Promise<DocumentSectionRead>
  getDocumentSections: (input: DocumentSectionLookup) => Promise<CorePage>
  getJurisdiction: (id: string) => Promise<unknown>
  getSession: (id: string) => Promise<unknown>
  getVote: (input: EntityLookup) => Promise<unknown>
  browseBills: (input: BillBrowseInput) => Promise<CorePage>
  listJurisdictions: (input: JurisdictionSearchInput) => Promise<CorePage>
  listSessions: (input: SessionSearchInput) => Promise<CorePage>
  searchAmendments: (input: AmendmentSearchInput) => Promise<CorePage>
  searchChanges: (input: ChangeSearchInput) => Promise<CorePage>
  searchSupportingMaterials: (input: SupportingMaterialSearchInput) => Promise<CorePage>
  searchVotes: (input: VoteSearchInput) => Promise<CorePage>
}

interface CorePage<T = unknown> {
  items: readonly T[]
  nextCursor?: string
  truncated: boolean
  warnings?: readonly string[]
}

interface SectionPage {
  nextCursor?: string
  sections: readonly unknown[]
  truncated: boolean
  warnings?: readonly string[]
}

interface TimelinePage {
  events: readonly unknown[]
  nextChildCursor?: string
  truncated: boolean
  warnings?: readonly string[]
}

export function createCoreReadApiHandler(
  service: CoreReadQueryApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }

    try {
      const handled = await handleCoreRequest(service, request, response, url, options.apiBaseUrl)
      return handled
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleCoreRequest(
  service: CoreReadQueryApi,
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
    case "listBills": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.browseBills({
        cursor: queryOptionalString(url, "cursor"),
        identifier: queryOptionalString(url, "identifier"),
        jurisdictionId: queryOptionalString(url, "jurisdictionId"),
        limit,
        sessionId: queryOptionalString(url, "sessionId")
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "listJurisdictionBills": {
      await service.getJurisdiction(route.jurisdictionId)
      const limit = queryInteger(url, "limit", 20)
      const page = await service.browseBills(billBrowseInput(url, limit, { jurisdictionId: route.jurisdictionId }))
      sendApiJson(response, 200, apiPage(request, projectBillPage(page, apiBaseUrl), limit))
      return true
    }
    case "listSessionBills": {
      await service.getSession(route.sessionId)
      const limit = queryInteger(url, "limit", 20)
      const page = await service.browseBills(billBrowseInput(url, limit, { sessionId: route.sessionId }))
      sendApiJson(response, 200, apiPage(request, projectBillPage(page, apiBaseUrl), limit))
      return true
    }
    case "getRelatedBills": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.findRelatedBills({
        id: route.billId,
        includeSemantic: queryOptionalString(url, "mode") !== "explicit",
        limit
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getBillText": {
      const limit = queryInteger(url, "limit", 50, 50)
      const page = await service.getBillText({
        cursor: queryOptionalString(url, "cursor"),
        documentId: queryOptionalString(url, "documentId"),
        id: route.billId,
        versionCode: queryOptionalString(url, "versionCode")
      })
      sendApiJson(response, 200, apiPage(request, { items: page.sections, ...page }, limit))
      return true
    }
    case "listBillAmendments": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.searchAmendments({
        billId: route.billId,
        cursor: queryOptionalString(url, "cursor"),
        limit,
        query: queryOptionalString(url, "q"),
        sponsorPersonId: queryOptionalString(url, "sponsorPersonId")
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "batchBillAmendments": {
      const body = await readJsonBody(request)
      const billIds = stringArrayBody(body, "billIds")
      const limit = body.limitPerBill === undefined ? 25 : bodyInteger(body.limitPerBill, "limitPerBill", 1, 100)
      const data = await Promise.all(
        billIds.map(async (billId) => {
          try {
            const page = await service.searchAmendments({ billId, limit })
            return { billId, page: apiPage(request, page, limit), status: "ok" as const }
          } catch (error) {
            return { billId, error: itemError(error), status: "error" as const }
          }
        })
      )
      sendApiJson(response, 200, { data, links: { self: url.pathname }, meta: batchMeta(request, billIds, data) })
      return true
    }
    case "listSupportingMaterials": {
      const limit = queryInteger(url, "limit", 20)
      const { documentFrom, documentTo } = querySupportingMaterialDateRange(url)
      const page = await service.searchSupportingMaterials({
        amendmentId: queryOptionalString(url, "amendmentId"),
        billId: queryOptionalString(url, "billId"),
        classification: queryOptionalString(url, "classification"),
        cursor: queryOptionalString(url, "cursor"),
        documentFrom,
        documentTo,
        eventId: queryOptionalString(url, "meetingId"),
        jurisdictionId: queryOptionalString(url, "jurisdictionId"),
        limit,
        mode: "lexical",
        organizationId: queryOptionalString(url, "organizationId"),
        processingStatus: querySupportingMaterialProcessingStatus(url),
        sort: supportingMaterialSort(queryOptionalString(url, "sort") ?? "document-desc")
      })
      sendApiJson(response, 200, apiPage(request, projectSupportingMaterialPage(page, apiBaseUrl), limit))
      return true
    }
    case "getSupportingMaterial": {
      const result = await service.getSupportingMaterial({ id: route.materialId })
      sendApiJson(
        response,
        200,
        apiResource(
          request,
          projectSupportingMaterialDetailRead(supportingMaterialDetailRead(result.material), apiBaseUrl)
        )
      )
      return true
    }
    case "getDocument": {
      const data = await service.getDocument({
        cursor: queryOptionalString(url, "cursor"),
        id: route.documentId,
        limit: queryInteger(url, "limit", 20, 50)
      })
      sendApiJson(response, 200, apiResource(request, data))
      return true
    }
    case "getDocumentSections": {
      const limit = queryInteger(url, "limit", 20, 50)
      const page = await service.getDocumentSections({
        cursor: queryOptionalString(url, "cursor"),
        documentId: route.documentId,
        limit
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getDocumentSection": {
      if (service.getDocumentSection === undefined) {
        return false
      }
      const data = await service.getDocumentSection({ documentId: route.documentId, sectionId: route.sectionId })
      sendApiJson(response, 200, apiResource(request, projectDocumentSectionRead(data, apiBaseUrl)))
      return true
    }
    case "getSupportingMaterialSection": {
      if (service.getSupportingMaterialSection === undefined) {
        return false
      }
      const data = await service.getSupportingMaterialSection({
        materialId: route.materialId,
        sectionId: route.sectionId
      })
      sendApiJson(response, 200, apiResource(request, projectSupportingMaterialSectionRead(data, apiBaseUrl)))
      return true
    }
    case "listChanges": {
      const limit = queryInteger(url, "limit", 20)
      const { observedFrom, observedTo } = queryChangeDateRange(url)
      const page = await service.searchChanges({
        cursor: queryOptionalString(url, "cursor"),
        changeType: queryOptionalChangeType(url),
        jurisdictionId: queryOptionalString(url, "jurisdictionId"),
        limit,
        organizationId: queryOptionalString(url, "organizationId"),
        personId: queryOptionalString(url, "personId"),
        recordId: queryOptionalString(url, "recordId"),
        recordType: queryOptionalString(url, "recordType"),
        observedFrom,
        observedTo
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getBillChanges": {
      const limit = queryInteger(url, "limit", 20)
      const { observedFrom, observedTo } = queryChangeDateRange(url)
      const page = await service.searchChanges({
        billId: route.billId,
        changeType: queryOptionalChangeType(url),
        cursor: queryOptionalString(url, "cursor"),
        limit,
        observedFrom,
        observedTo
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
  }
}

function projectBillPage(page: CorePage, apiBaseUrl: string): CorePage {
  return { ...page, items: page.items.map((item) => projectBillSummaryRead(billSummaryRead(item), apiBaseUrl)) }
}

function projectSupportingMaterialPage(page: CorePage, apiBaseUrl: string): CorePage {
  return {
    ...page,
    items: page.items.map((item) => projectSupportingMaterialSummaryRead(supportingMaterialRead(item), apiBaseUrl))
  }
}

function billSummaryRead(value: unknown): BillSummaryRead {
  if (!isBillSummaryRead(value)) {
    throw new LegislationError(
      "unprocessable",
      "The record cannot be returned because its canonical provenance is incomplete"
    )
  }
  return value
}

function isBillSummaryRead(value: unknown): value is BillSummaryRead {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const read = (name: string) => Reflect.get(value, name)
  return (
    isStringArray(read("classification")) &&
    isDateValue(read("createdAt")) &&
    typeof read("id") === "string" &&
    typeof read("identifier") === "string" &&
    isNullableDateValue(read("introducedAt")) &&
    typeof read("jurisdictionId") === "string" &&
    isNullableDateValue(read("latestActionAt")) &&
    typeof read("sessionId") === "string" &&
    (typeof read("status") === "string" || read("status") === null) &&
    typeof read("sourceUrl") === "string" &&
    isStringArray(read("subjects")) &&
    typeof read("title") === "string" &&
    isDateValue(read("updatedAt")) &&
    (read("upstreamIds") === undefined || isStringRecord(read("upstreamIds")))
  )
}

function supportingMaterialRead(value: unknown): SupportingMaterialRead {
  if (!isSupportingMaterialRead(value)) {
    throw new LegislationError(
      "unprocessable",
      "The supporting material cannot be returned because its canonical facts are incomplete"
    )
  }
  return value
}

function supportingMaterialDetailRead(value: unknown): SupportingMaterialDetailRead {
  if (!isSupportingMaterialDetailRead(value)) {
    throw new LegislationError(
      "unprocessable",
      "The supporting material cannot be returned because its canonical detail facts are incomplete"
    )
  }
  return value
}

function isSupportingMaterialRead(value: unknown): value is SupportingMaterialRead {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const read = (name: string) => Reflect.get(value, name)
  return (
    isNonemptyUniqueStringArray(read("amendmentIds")) &&
    isNonemptyUniqueStringArray(read("billIds")) &&
    typeof read("classification") === "string" &&
    (typeof read("contentType") === "string" || read("contentType") === null) &&
    isNullableDateValue(read("documentDate")) &&
    isDateValue(read("createdAt")) &&
    typeof read("id") === "string" &&
    typeof read("jurisdictionId") === "string" &&
    isNonemptyUniqueStringArray(read("meetingIds")) &&
    isNonemptyUniqueStringArray(read("organizationIds")) &&
    typeof read("processingStatus") === "string" &&
    typeof read("sourceUrl") === "string" &&
    typeof read("title") === "string" &&
    isDateValue(read("updatedAt")) &&
    (read("sourceUpdatedAt") === undefined || isNullableDateValue(read("sourceUpdatedAt"))) &&
    (read("upstreamIds") === undefined || isStringRecord(read("upstreamIds")))
  )
}

function isSupportingMaterialDetailRead(value: unknown): value is SupportingMaterialDetailRead {
  if (!isSupportingMaterialRead(value)) {
    return false
  }
  const read = (name: string) => Reflect.get(value, name)
  return (
    read("byteSize") === null &&
    read("pageCount") === null &&
    read("storedUrl") === null &&
    isNonnegativeSafeInteger(read("sectionCount")) &&
    isNonnegativeSafeInteger(read("textCharacterCount"))
  )
}

function isDateValue(value: unknown): value is Date | string {
  return value instanceof Date || typeof value === "string"
}

function isNullableDateValue(value: unknown): value is Date | string | null {
  return value === null || isDateValue(value)
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isNonemptyUniqueStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0) &&
    new Set(value).size === value.length
  )
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && Object.values(value).every((item) => typeof item === "string")
}

function repeatedQueryValues(url: URL, name: string): string[] | undefined {
  const values = url.searchParams.getAll(name).map((value) => value.trim())
  if (values.length === 0) {
    return undefined
  }
  if (values.length > 25 || values.some((value) => value.length === 0)) {
    throw new LegislationError("invalid_request", `${name} must contain between 1 and 25 non-empty values`)
  }
  if (new Set(values).size !== values.length) {
    throw new LegislationError("invalid_request", `${name} values must be unique`)
  }
  return values
}

function billBrowseInput(
  url: URL,
  limit: number,
  scope: Readonly<{ jurisdictionId?: string; sessionId?: string }>
): BillBrowseInput {
  const introducedFrom = queryOptionalIsoDate(url, "introducedFrom")
  const introducedTo = queryOptionalIsoDate(url, "introducedTo")
  if (introducedFrom !== undefined && introducedTo !== undefined && introducedFrom > introducedTo) {
    throw new LegislationError("invalid_request", "introducedFrom must not be after introducedTo")
  }
  const sortValue = queryOptionalString(url, "sort") ?? "latest-action-desc"
  const sort = billSort(sortValue)
  if (sort === undefined) {
    throw new LegislationError("invalid_request", "sort is not supported for bill collections")
  }
  return {
    classification: repeatedQueryValues(url, "classification"),
    cursor: queryOptionalString(url, "cursor"),
    introducedFrom,
    introducedTo,
    jurisdictionId: scope.jurisdictionId,
    limit,
    sessionId: scope.sessionId ?? queryOptionalString(url, "sessionId"),
    sort,
    status: repeatedQueryValues(url, "status"),
    subject: repeatedQueryValues(url, "subject")
  }
}

function billSort(value: string): BillBrowseInput["sort"] {
  switch (value) {
    case "identifier-asc":
    case "introduced-desc":
    case "latest-action-desc":
    case "updated-desc":
      return value
    default:
      return undefined
  }
}

type CoreRoute =
  | { name: "batchBillAmendments" | "listBills" | "listChanges" | "listSupportingMaterials" }
  | {
      billId: string
      name: "getBillText" | "getRelatedBills" | "getBillChanges" | "listBillAmendments"
    }
  | { documentId: string; name: "getDocument" | "getDocumentSections" }
  | { documentId: string; name: "getDocumentSection"; sectionId: string }
  | { jurisdictionId: string; name: "listJurisdictionBills" }
  | { materialId: string; name: "getSupportingMaterial" }
  | { materialId: string; name: "getSupportingMaterialSection"; sectionId: string }
  | { name: "listSessionBills"; sessionId: string }

function routeMatch(method: string | undefined, pathname: string): CoreRoute | undefined {
  if (method === "POST") {
    if (pathname === "/api/bills/amendments/batch") {
      return { name: "batchBillAmendments" }
    }
    return undefined
  }
  if (method !== "GET") {
    return undefined
  }
  if (pathname === "/api/bills") {
    return { name: "listBills" }
  }
  if (pathname === "/api/changes") {
    return { name: "listChanges" }
  }
  if (pathname === "/api/supporting-materials") {
    return { name: "listSupportingMaterials" }
  }
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent)
  if (segments[0] !== "api") {
    return undefined
  }
  if (segments[1] === "bills" && typeof segments[2] === "string") {
    const billId = segments[2]
    if (segments.length === 3) {
      return undefined
    }
    if (segments.length !== 4) {
      return undefined
    }
    switch (segments[3]) {
      case "related":
        return { billId, name: "getRelatedBills" }
      case "sections":
        return { billId, name: "getBillText" }
      case "amendments":
        return { billId, name: "listBillAmendments" }
      case "changes":
        return { billId, name: "getBillChanges" }
      default:
        return undefined
    }
  }
  if (segments[1] === "jurisdictions" && typeof segments[2] === "string") {
    if (segments.length === 4 && segments[3] === "bills") {
      return { jurisdictionId: segments[2], name: "listJurisdictionBills" }
    }
    return undefined
  }
  if (segments[1] === "sessions" && typeof segments[2] === "string") {
    return segments.length === 4 && segments[3] === "bills"
      ? { name: "listSessionBills", sessionId: segments[2] }
      : undefined
  }
  if (segments[1] === "documents" && typeof segments[2] === "string") {
    if (segments.length === 3) {
      return { documentId: segments[2], name: "getDocument" }
    }
    if (segments[3] !== "sections") {
      return undefined
    }
    if (segments.length === 4) {
      return { documentId: segments[2], name: "getDocumentSections" }
    }
    return segments.length === 5 && typeof segments[4] === "string"
      ? { documentId: segments[2], name: "getDocumentSection", sectionId: segments[4] }
      : undefined
  }
  if (segments[1] === "supporting-materials" && typeof segments[2] === "string") {
    if (segments.length === 3) {
      return { materialId: segments[2], name: "getSupportingMaterial" }
    }
    return segments[3] === "sections" && segments.length === 5 && typeof segments[4] === "string"
      ? { materialId: segments[2], name: "getSupportingMaterialSection", sectionId: segments[4] }
      : undefined
  }
  return undefined
}

function batchMeta(request: IncomingMessage, ids: readonly string[], data: readonly unknown[]) {
  return {
    correlationId: correlationId(request),
    requested: ids.length,
    returned: data.length,
    warnings: []
  }
}

function itemError(error: unknown) {
  return {
    category: error instanceof Error && "category" in error ? error.category : "internal",
    message: error instanceof Error ? error.message : "The request could not be completed",
    retryable: false
  }
}

function bodyInteger(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new LegislationError("invalid_request", `${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return value
}

function allowedQueryParameters(name: CoreRoute["name"]): readonly string[] {
  switch (name) {
    case "listBills":
      return ["cursor", "identifier", "jurisdictionId", "limit", "sessionId"]
    case "batchBillAmendments":
      return []
    case "listJurisdictionBills":
      return [
        "classification",
        "cursor",
        "introducedFrom",
        "introducedTo",
        "limit",
        "sessionId",
        "sort",
        "status",
        "subject"
      ]
    case "listSessionBills":
      return ["classification", "cursor", "introducedFrom", "introducedTo", "limit", "sort", "status", "subject"]
    case "getRelatedBills":
      return ["limit", "mode"]
    case "getBillText":
      return ["cursor", "documentId", "limit", "versionCode"]
    case "listBillAmendments":
      return ["cursor", "limit", "q", "sponsorPersonId"]
    case "listSupportingMaterials":
      return [
        "amendmentId",
        "billId",
        "classification",
        "cursor",
        "documentFrom",
        "documentTo",
        "jurisdictionId",
        "limit",
        "meetingId",
        "organizationId",
        "processingStatus",
        "sort"
      ]
    case "getSupportingMaterial":
      return []
    case "getDocument":
      return ["cursor", "limit"]
    case "getDocumentSection":
    case "getSupportingMaterialSection":
      return []
    case "getDocumentSections":
      return ["cursor", "limit"]
    case "listChanges":
      return [
        "classification",
        "cursor",
        "jurisdictionId",
        "limit",
        "observedFrom",
        "observedTo",
        "organizationId",
        "personId",
        "recordId",
        "recordType"
      ]
    case "getBillChanges":
      return ["classification", "cursor", "limit", "observedFrom", "observedTo"]
  }
}

function queryOptionalChangeType(url: URL): ChangeType {
  const value = queryOptionalString(url, "classification")
  if (value === undefined) {
    return undefined
  }
  switch (value) {
    case "cancel":
    case "create":
    case "delete":
    case "relationship-change":
    case "reschedule":
    case "update":
      return value
    default:
      throw new LegislationError("invalid_request", "classification must be a supported change type")
  }
}

function queryChangeDateRange(url: URL): { observedFrom: Date | undefined; observedTo: Date | undefined } {
  const observedFrom = queryOptionalDate(url, "observedFrom")
  const observedTo = queryOptionalDate(url, "observedTo")
  if (observedFrom !== undefined && observedTo !== undefined && observedFrom > observedTo) {
    throw new LegislationError("invalid_request", "observedFrom must not be after observedTo")
  }
  return { observedFrom, observedTo }
}

function querySupportingMaterialDateRange(url: URL): {
  documentFrom: string | undefined
  documentTo: string | undefined
} {
  const documentFrom = queryOptionalIsoDate(url, "documentFrom")
  const documentTo = queryOptionalIsoDate(url, "documentTo")
  if (documentFrom !== undefined && documentTo !== undefined && documentFrom > documentTo) {
    throw new LegislationError("invalid_request", "documentFrom must not be after documentTo")
  }
  return { documentFrom, documentTo }
}

function querySupportingMaterialProcessingStatus(url: URL): SupportingMaterialSearchInput["processingStatus"] {
  const value = queryOptionalString(url, "processingStatus")
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

function supportingMaterialSort(value: string): NonNullable<SupportingMaterialSearchInput["sort"]> {
  switch (value) {
    case "document-desc":
    case "title-asc":
    case "updated-desc":
      return value
    default:
      throw new LegislationError("invalid_request", "sort is not supported for supporting-material collections")
  }
}
