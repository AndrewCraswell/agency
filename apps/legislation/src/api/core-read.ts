import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "../legislation/errors.js"
import type {
  AmendmentSearchInput,
  BillBrowseInput,
  BillLookup,
  ChangeSearchInput,
  DocumentSectionLookup,
  EntityLookup,
  EventSearchInput,
  JurisdictionSearchInput,
  SessionSearchInput,
  SupportingMaterialSearchInput,
  VoteSearchInput
} from "../legislation/query-service.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  apiResource,
  correlationId,
  queryInteger,
  queryOptionalBoolean,
  queryOptionalDate,
  queryOptionalDateOrTimestamp,
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
  findRelatedBills: (input: BillLookup & { includeSemantic?: boolean; limit?: number }) => Promise<unknown>
  getAmendment: (input: EntityLookup) => Promise<unknown>
  getBill: (input: BillLookup) => Promise<unknown>
  getBillText: (
    input: BillLookup & { cursor?: string; documentId?: string; versionCode?: string }
  ) => Promise<SectionPage>
  getBillTimeline: (input: BillLookup) => Promise<TimelinePage>
  getBillVotes: (input: Readonly<{ billId: string; cursor?: string; limit?: number }>) => Promise<CorePage>
  getSupportingMaterial: (input: EntityLookup) => Promise<unknown>
  getDocument: (input: EntityLookup) => Promise<unknown>
  getDocumentSections: (input: DocumentSectionLookup) => Promise<CorePage>
  getJurisdiction: (id: string) => Promise<unknown>
  getSession: (id: string) => Promise<unknown>
  getVote: (input: EntityLookup) => Promise<unknown>
  browseBills: (input: BillBrowseInput) => Promise<CorePage>
  listJurisdictions: (input: JurisdictionSearchInput) => Promise<CorePage>
  listSessions: (input: SessionSearchInput) => Promise<CorePage>
  searchAmendments: (input: AmendmentSearchInput) => Promise<CorePage>
  searchChanges: (input: ChangeSearchInput) => Promise<CorePage>
  searchEvents: (input: EventSearchInput) => Promise<CorePage>
  searchSupportingMaterials: (input: SupportingMaterialSearchInput) => Promise<CorePage>
  searchVotes: (input: VoteSearchInput) => Promise<CorePage>
}

interface CorePage {
  items: readonly unknown[]
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

export function createCoreReadApiHandler(service: CoreReadQueryApi): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }

    try {
      const handled = await handleCoreRequest(service, request, response, url)
      return handled
    } catch (error) {
      sendApiError(request, response, error)
      return true
    }
  }
}

async function handleCoreRequest(
  service: CoreReadQueryApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, allowedQueryParameters(route.name))

  switch (route.name) {
    case "getBill": {
      const data = await service.getBill({
        childCursor: queryOptionalString(url, "childCursor"),
        childLimit: queryInteger(url, "childLimit", 25, 25),
        id: route.billId
      })
      sendApiJson(response, 200, apiResource(request, data))
      return true
    }
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
    case "listJurisdictions": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.listJurisdictions({
        classification: queryOptionalString(url, "classification"),
        cursor: queryOptionalString(url, "cursor"),
        limit,
        query: queryOptionalString(url, "q")
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getJurisdiction": {
      const data = await service.getJurisdiction(route.jurisdictionId)
      sendApiJson(response, 200, apiResource(request, data))
      return true
    }
    case "listJurisdictionSessions": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.listSessions({
        cursor: queryOptionalString(url, "cursor"),
        from: queryOptionalString(url, "from"),
        isActive: queryOptionalBoolean(url, "isActive"),
        jurisdictionId: route.jurisdictionId,
        limit,
        to: queryOptionalString(url, "to")
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "listJurisdictionBills": {
      await service.getJurisdiction(route.jurisdictionId)
      const limit = queryInteger(url, "limit", 20)
      const page = await service.browseBills(billBrowseInput(url, limit, { jurisdictionId: route.jurisdictionId }))
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "listJurisdictionMeetings": {
      await service.getJurisdiction(route.jurisdictionId)
      const limit = queryInteger(url, "limit", 20)
      const page = await service.searchEvents(meetingBrowseInput(url, limit, { jurisdictionId: route.jurisdictionId }))
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getSession": {
      const data = await service.getSession(route.sessionId)
      sendApiJson(response, 200, apiResource(request, data))
      return true
    }
    case "listSessionBills": {
      await service.getSession(route.sessionId)
      const limit = queryInteger(url, "limit", 20)
      const page = await service.browseBills(billBrowseInput(url, limit, { sessionId: route.sessionId }))
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getBillTimeline": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.getBillTimeline({
        childCursor: queryOptionalString(url, "cursor"),
        childLimit: limit,
        id: route.billId
      })
      sendApiJson(
        response,
        200,
        apiPage(
          request,
          { items: page.events, nextCursor: page.nextChildCursor, truncated: page.truncated, warnings: page.warnings },
          limit
        )
      )
      return true
    }
    case "getRelatedBills": {
      const limit = queryInteger(url, "limit", 20)
      const data = await service.findRelatedBills({
        id: route.billId,
        includeSemantic: queryOptionalString(url, "mode") !== "explicit",
        limit
      })
      sendApiJson(response, 200, apiResource(request, data))
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
    case "getBillVotes": {
      const limit = queryInteger(url, "limit", 20, 25)
      const page = await service.getBillVotes({
        billId: route.billId,
        cursor: queryOptionalString(url, "cursor"),
        limit
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
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
    case "batchBills": {
      const ids = stringArrayBody(await readJsonBody(request), "ids")
      const data = await batch(ids, async (id) => await service.getBill({ childLimit: 25, id }))
      sendApiJson(response, 200, { data, links: { self: url.pathname }, meta: batchMeta(request, ids, data) })
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
    case "listAmendments": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.searchAmendments({
        billId: queryOptionalString(url, "billId"),
        cursor: queryOptionalString(url, "cursor"),
        jurisdictionId: queryOptionalString(url, "jurisdictionId"),
        limit,
        mode: "lexical",
        query: queryOptionalString(url, "q"),
        sponsorPersonId: queryOptionalString(url, "sponsorPersonId")
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getAmendment": {
      const data = await service.getAmendment({ id: route.amendmentId })
      sendApiJson(response, 200, apiResource(request, data))
      return true
    }
    case "batchAmendments": {
      const ids = stringArrayBody(await readJsonBody(request), "ids")
      const data = await batch(ids, async (id) => await service.getAmendment({ id }))
      sendApiJson(response, 200, { data, links: { self: url.pathname }, meta: batchMeta(request, ids, data) })
      return true
    }
    case "listVotes": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.searchVotes({
        billId: queryOptionalString(url, "billId"),
        cursor: queryOptionalString(url, "cursor"),
        organizationId: queryOptionalString(url, "organizationId"),
        personId: queryOptionalString(url, "personId"),
        limit
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getVote": {
      const data = await service.getVote({ id: route.voteId })
      sendApiJson(response, 200, apiResource(request, data))
      return true
    }
    case "batchVotes": {
      const ids = stringArrayBody(await readJsonBody(request), "ids")
      const data = await batch(ids, async (id) => await service.getVote({ id }))
      sendApiJson(response, 200, { data, links: { self: url.pathname }, meta: batchMeta(request, ids, data) })
      return true
    }
    case "listSupportingMaterials": {
      const limit = queryInteger(url, "limit", 20)
      const page = await service.searchSupportingMaterials({
        amendmentId: queryOptionalString(url, "amendmentId"),
        billId: queryOptionalString(url, "billId"),
        classification: queryOptionalString(url, "classification"),
        cursor: queryOptionalString(url, "cursor"),
        eventId: queryOptionalString(url, "meetingId"),
        jurisdictionId: queryOptionalString(url, "jurisdictionId"),
        limit,
        mode: "lexical",
        query: queryOptionalString(url, "q")
      })
      sendApiJson(response, 200, apiPage(request, page, limit))
      return true
    }
    case "getSupportingMaterial": {
      const data = await service.getSupportingMaterial({
        cursor: queryOptionalString(url, "cursor"),
        id: route.materialId,
        limit: queryInteger(url, "limit", 20, 50)
      })
      sendApiJson(response, 200, apiResource(request, data))
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

function meetingBrowseInput(
  url: URL,
  limit: number,
  scope: Readonly<{ jurisdictionId?: string; organizationId?: string }>,
  allowSort = false
): EventSearchInput {
  const from = queryOptionalDateOrTimestamp(url, "from")
  const to = queryOptionalDateOrTimestamp(url, "to")
  if (from !== undefined && to !== undefined && from > to) {
    throw new LegislationError("invalid_request", "from must not be after to")
  }
  const sortValue = queryOptionalString(url, "sort") ?? "starts-asc"
  if (!allowSort && url.searchParams.has("sort")) {
    throw new LegislationError("invalid_request", "sort is not supported by this meeting collection")
  }
  const sort = meetingSort(sortValue)
  if (sort === undefined) {
    throw new LegislationError("invalid_request", "sort is not supported for meeting collections")
  }
  return {
    classification: repeatedQueryValues(url, "classification"),
    cursor: queryOptionalString(url, "cursor"),
    from,
    jurisdictionId: scope.jurisdictionId,
    limit,
    organizationId: scope.organizationId ?? queryOptionalString(url, "organizationId"),
    sort,
    status: repeatedQueryValues(url, "status"),
    to
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

function meetingSort(value: string): EventSearchInput["sort"] {
  switch (value) {
    case "starts-asc":
    case "starts-desc":
    case "updated-desc":
      return value
    default:
      return undefined
  }
}

type CoreRoute =
  | {
      name:
        | "batchAmendments"
        | "batchBillAmendments"
        | "batchBills"
        | "batchVotes"
        | "listAmendments"
        | "listBills"
        | "listChanges"
        | "listJurisdictions"
        | "listSupportingMaterials"
        | "listVotes"
    }
  | {
      billId: string
      name:
        | "getBill"
        | "getBillText"
        | "getBillTimeline"
        | "getBillVotes"
        | "getRelatedBills"
        | "getBillChanges"
        | "listBillAmendments"
    }
  | { amendmentId: string; name: "getAmendment" }
  | { documentId: string; name: "getDocument" | "getDocumentSections" }
  | {
      jurisdictionId: string
      name: "getJurisdiction" | "listJurisdictionBills" | "listJurisdictionMeetings" | "listJurisdictionSessions"
    }
  | { materialId: string; name: "getSupportingMaterial" }
  | { name: "getSession" | "listSessionBills"; sessionId: string }
  | { name: "getVote"; voteId: string }

function routeMatch(method: string | undefined, pathname: string): CoreRoute | undefined {
  if (method === "POST") {
    if (pathname === "/api/amendments/batch") {
      return { name: "batchAmendments" }
    }
    if (pathname === "/api/bills/amendments/batch") {
      return { name: "batchBillAmendments" }
    }
    if (pathname === "/api/bills/batch") {
      return { name: "batchBills" }
    }
    return pathname === "/api/votes/batch" ? { name: "batchVotes" } : undefined
  }
  if (method !== "GET") {
    return undefined
  }
  if (pathname === "/api/amendments") {
    return { name: "listAmendments" }
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
  if (pathname === "/api/votes") {
    return { name: "listVotes" }
  }
  if (pathname === "/api/jurisdictions") {
    return { name: "listJurisdictions" }
  }
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent)
  if (segments[0] !== "api") {
    return undefined
  }
  if (segments[1] === "bills" && typeof segments[2] === "string") {
    const billId = segments[2]
    if (segments.length === 3) {
      return { billId, name: "getBill" }
    }
    if (segments.length !== 4) {
      return undefined
    }
    switch (segments[3]) {
      case "timeline":
        return { billId, name: "getBillTimeline" }
      case "related":
        return { billId, name: "getRelatedBills" }
      case "sections":
        return { billId, name: "getBillText" }
      case "votes":
        return { billId, name: "getBillVotes" }
      case "amendments":
        return { billId, name: "listBillAmendments" }
      case "changes":
        return { billId, name: "getBillChanges" }
      default:
        return undefined
    }
  }
  if (segments[1] === "amendments" && typeof segments[2] === "string" && segments.length === 3) {
    return { amendmentId: segments[2], name: "getAmendment" }
  }
  if (segments[1] === "jurisdictions" && typeof segments[2] === "string") {
    if (segments.length === 3) {
      return { jurisdictionId: segments[2], name: "getJurisdiction" }
    }
    if (segments.length !== 4) {
      return undefined
    }
    switch (segments[3]) {
      case "sessions":
        return { jurisdictionId: segments[2], name: "listJurisdictionSessions" }
      case "bills":
        return { jurisdictionId: segments[2], name: "listJurisdictionBills" }
      case "meetings":
        return { jurisdictionId: segments[2], name: "listJurisdictionMeetings" }
      default:
        return undefined
    }
  }
  if (segments[1] === "sessions" && typeof segments[2] === "string") {
    if (segments.length === 3) {
      return { name: "getSession", sessionId: segments[2] }
    }
    if (segments.length !== 4) {
      return undefined
    }
    switch (segments[3]) {
      case "bills":
        return { name: "listSessionBills", sessionId: segments[2] }
      default:
        return undefined
    }
  }
  if (segments[1] === "documents" && typeof segments[2] === "string") {
    if (segments.length === 3) {
      return { documentId: segments[2], name: "getDocument" }
    }
    return segments[3] === "sections" && segments.length === 4
      ? { documentId: segments[2], name: "getDocumentSections" }
      : undefined
  }
  if (segments[1] === "votes" && typeof segments[2] === "string" && segments.length === 3) {
    return { name: "getVote", voteId: segments[2] }
  }
  if (segments[1] === "supporting-materials" && typeof segments[2] === "string" && segments.length === 3) {
    return { materialId: segments[2], name: "getSupportingMaterial" }
  }
  return undefined
}

async function batch<T>(ids: readonly string[], operation: (id: string) => Promise<T>) {
  return await Promise.all(
    ids.map(async (id) => {
      try {
        return { data: await operation(id), id, status: "ok" as const }
      } catch (error) {
        return { error: itemError(error), id, status: "error" as const }
      }
    })
  )
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
    case "getBill":
      return ["childCursor", "childLimit"]
    case "listBills":
      return ["cursor", "identifier", "jurisdictionId", "limit", "sessionId"]
    case "listJurisdictions":
      return ["classification", "cursor", "limit", "q"]
    case "getJurisdiction":
    case "getSession":
    case "getAmendment":
    case "getVote":
    case "batchBills":
    case "batchBillAmendments":
    case "batchAmendments":
    case "batchVotes":
      return []
    case "listJurisdictionSessions":
      return ["cursor", "from", "isActive", "limit", "to"]
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
    case "listJurisdictionMeetings":
      return ["classification", "cursor", "from", "limit", "organizationId", "status", "to"]
    case "getBillTimeline":
      return ["cursor", "limit"]
    case "getRelatedBills":
      return ["limit", "mode"]
    case "getBillText":
      return ["cursor", "documentId", "limit", "versionCode"]
    case "getBillVotes":
      return ["cursor", "limit"]
    case "listBillAmendments":
      return ["cursor", "limit", "q", "sponsorPersonId"]
    case "listAmendments":
      return ["billId", "cursor", "jurisdictionId", "limit", "q", "sponsorPersonId"]
    case "listVotes":
      return ["billId", "cursor", "limit", "organizationId", "personId"]
    case "listSupportingMaterials":
      return ["amendmentId", "billId", "classification", "cursor", "jurisdictionId", "limit", "meetingId", "q"]
    case "getSupportingMaterial":
    case "getDocument":
      return ["cursor", "limit"]
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
