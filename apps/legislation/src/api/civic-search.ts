import type { IncomingMessage } from "node:http"
import { z } from "zod"
import { LegislationError } from "../legislation/errors.js"
import type {
  AmendmentSearchInput,
  EntityLookup,
  EventSearchInput,
  OrganizationSearchInput,
  PersonSearchInput,
  SupportingMaterialSearchInput,
  VersionComparisonInput
} from "../legislation/query-service.js"
import type { PassageSearchInput, SearchInput } from "../search/search.js"
import {
  apiPage,
  apiResource,
  apiSearchPage,
  queryOptionalDateOrTimestamp,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

type QueryPage<T> = Readonly<{
  items: readonly T[]
  nextCursor?: string
  search?: Readonly<{ isReranked: boolean; models: readonly unknown[] }>
  truncated: boolean
  warnings?: readonly string[]
}>

export type CivicSearchApi = Readonly<{
  compareBillVersions: (input: VersionComparisonInput) => Promise<unknown>
  getEvent: (lookup: EntityLookup) => Promise<unknown>
  getOrganization: (lookup: EntityLookup) => Promise<unknown>
  getPerson: (lookup: EntityLookup) => Promise<unknown>
  searchAmendments: (input: AmendmentSearchInput) => Promise<QueryPage<unknown>>
  searchBillText: (
    input: PassageSearchInput & { mode?: "hybrid" | "lexical" | "semantic" }
  ) => Promise<QueryPage<unknown>>
  searchBills: (input: SearchInput & { mode?: "hybrid" | "lexical" | "semantic" }) => Promise<QueryPage<unknown>>
  searchEvents: (input: EventSearchInput) => Promise<QueryPage<unknown>>
  searchOrganizations: (input: OrganizationSearchInput) => Promise<QueryPage<unknown>>
  searchPeople: (input: PersonSearchInput) => Promise<QueryPage<unknown>>
  searchSupportingMaterials: (input: SupportingMaterialSearchInput) => Promise<QueryPage<unknown>>
}>

const identifierSchema = z.string().trim().min(1).max(256)
const modeSchema = z.enum(["hybrid", "lexical", "semantic"])
const optionalIdentifierArraySchema = z
  .array(identifierSchema)
  .min(1)
  .max(25)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "ID arrays must contain unique values" })
    }
  })
  .optional()
const optionalStringArraySchema = z
  .array(z.string().trim().min(1).max(256))
  .min(1)
  .max(25)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "Array values must be unique" })
    }
  })
  .optional()
const temporalBoundSchema = z.union([z.string().date(), z.string().datetime({ offset: true })])

const searchRequestSchema = z
  .object({
    cursor: z.string().trim().min(1).max(2048).nullable().optional(),
    explain: z.boolean().optional(),
    from: temporalBoundSchema.nullable().optional(),
    jurisdictionIds: optionalIdentifierArraySchema,
    limit: z.number().int().min(1).max(100).optional(),
    mode: modeSchema.optional(),
    query: z.string().trim().min(1).max(500),
    sessionIds: optionalIdentifierArraySchema,
    to: temporalBoundSchema.nullable().optional()
  })
  .strict()

const billSearchRequestSchema = searchRequestSchema
  .extend({
    classifications: optionalStringArraySchema,
    introducedFrom: z.string().date().optional(),
    introducedTo: z.string().date().optional(),
    jurisdictionIds: optionalIdentifierArraySchema,
    sessionIds: optionalIdentifierArraySchema,
    sponsorIds: optionalIdentifierArraySchema,
    statuses: optionalStringArraySchema,
    subjects: optionalStringArraySchema
  })
  .strict()

const amendmentSearchRequestSchema = searchRequestSchema
  .extend({
    billIds: optionalIdentifierArraySchema,
    recordTypes: z
      .array(z.enum(["document", "structured"]))
      .min(1)
      .max(2)
      .superRefine((values, context) => {
        if (new Set(values).size !== values.length) {
          context.addIssue({ code: "custom", message: "recordTypes must contain unique values" })
        }
      })
      .optional(),
    sponsorPersonIds: optionalIdentifierArraySchema,
    statuses: optionalStringArraySchema,
    submittedFrom: z.string().date().optional(),
    submittedTo: z.string().date().optional()
  })
  .strict()

const passageSearchRequestSchema = searchRequestSchema
  .extend({
    billIds: optionalIdentifierArraySchema,
    documentClassifications: optionalStringArraySchema,
    documentIds: optionalIdentifierArraySchema,
    headings: optionalStringArraySchema,
    pageFrom: z.number().int().positive().optional(),
    pageTo: z.number().int().positive().optional(),
    versionCodes: optionalStringArraySchema
  })
  .strict()

const materialSearchRequestSchema = searchRequestSchema
  .extend({
    amendmentIds: optionalIdentifierArraySchema,
    billIds: optionalIdentifierArraySchema,
    classifications: optionalStringArraySchema,
    documentFrom: z.string().date().optional(),
    documentTo: z.string().date().optional(),
    jurisdictionIds: optionalIdentifierArraySchema,
    meetingIds: optionalIdentifierArraySchema,
    organizationIds: optionalIdentifierArraySchema
  })
  .strict()

const documentDiffRequestSchema = z
  .object({
    billId: identifierSchema,
    leftDocumentId: identifierSchema,
    rightDocumentId: identifierSchema
  })
  .strict()
  .superRefine((value, context) => {
    if (value.leftDocumentId === value.rightDocumentId) {
      context.addIssue({
        code: "custom",
        message: "leftDocumentId and rightDocumentId must differ",
        path: ["rightDocumentId"]
      })
    }
  })

function optionalSingle(values: readonly string[] | undefined, name: string): string | undefined {
  if (values === undefined) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("invalid_request", `${name} currently accepts exactly one value`)
  }
  return values[0]
}

function rejectUnsupportedFilter(value: unknown, name: string): void {
  if (value !== undefined) {
    throw new LegislationError("invalid_request", `${name} is not implemented by the current query service`)
  }
}

function validateDateOrder(from: string | undefined, to: string | undefined, names: readonly [string, string]): void {
  if (from !== undefined && to !== undefined && from.includes("T") !== to.includes("T")) {
    throw new LegislationError("invalid_request", `${names[0]} and ${names[1]} must use the same temporal format`)
  }
  if (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to)) {
    throw new LegislationError("invalid_request", `${names[0]} must not be after ${names[1]}`)
  }
}

function validateSearchModeLimit(mode: "hybrid" | "lexical" | "semantic", limit: number | undefined): number {
  const effectiveLimit = limit ?? 20
  if (mode !== "lexical" && effectiveLimit > 25) {
    throw new LegislationError("invalid_request", "limit must be between 1 and 25 for semantic or hybrid search")
  }
  return effectiveLimit
}

function optionalQueryString(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim()
  return value === undefined || value.length === 0 ? undefined : value
}

function optionalQueryBoolean(url: URL, name: string): boolean | undefined {
  const value = url.searchParams.get(name)
  if (value === null) {
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

function queryLimit(url: URL): number | undefined {
  const value = url.searchParams.get("limit")
  if (value === null) {
    return undefined
  }
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", "limit must be an integer")
  }
  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new LegislationError("invalid_request", "limit must be between 1 and 100")
  }
  return limit
}

function assertKnownQuery(url: URL, allowed: readonly string[]): void {
  const allowedNames = new Set(allowed)
  for (const name of url.searchParams.keys()) {
    if (!allowedNames.has(name)) {
      throw new LegislationError("invalid_request", `Unsupported query parameter: ${name}`)
    }
  }
}

function routeIdentifier(pathname: string, resource: "meetings" | "organizations" | "people"): string | undefined {
  const prefix = `/api/${resource}/`
  if (!pathname.startsWith(prefix)) {
    return undefined
  }
  const suffix = pathname.slice(prefix.length)
  if (suffix.length === 0 || suffix.includes("/")) {
    return undefined
  }
  try {
    return decodeURIComponent(suffix)
  } catch {
    throw new LegislationError("invalid_request", `Invalid ${resource} ID encoding`)
  }
}

function organizationMeetingIdentifier(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length !== 4 || segments[0] !== "api" || segments[1] !== "organizations" || segments[3] !== "meetings") {
    return undefined
  }
  try {
    return decodeURIComponent(segments[2] ?? "") || undefined
  } catch {
    throw new LegislationError("invalid_request", "Invalid organizations ID encoding")
  }
}

function meetingSort(url: URL): "starts-asc" | "starts-desc" | "updated-desc" {
  const value = optionalQueryString(url, "sort") ?? "starts-asc"
  switch (value) {
    case "starts-asc":
    case "starts-desc":
    case "updated-desc":
      return value
    default:
      throw new LegislationError("invalid_request", "sort is not supported for meeting collections")
  }
}

function searchPage<T>(
  request: IncomingMessage,
  page: QueryPage<T>,
  limit: number,
  mode: "hybrid" | "lexical" | "semantic"
) {
  return apiSearchPage(request, page, limit, {
    isReranked: page.search?.isReranked ?? false,
    mode,
    models: page.search?.models ?? []
  })
}

function searchInput(
  value: z.infer<typeof billSearchRequestSchema>,
  mode: "hybrid" | "lexical" | "semantic"
): SearchInput & { mode: "hybrid" | "lexical" | "semantic" } {
  validateDateOrder(value.introducedFrom, value.introducedTo, ["introducedFrom", "introducedTo"])
  validateDateOrder(value.from ?? undefined, value.to ?? undefined, ["from", "to"])
  rejectUnsupportedFilter(value.explain === true ? true : undefined, "explain")
  rejectUnsupportedFilter(value.from ?? undefined, "from")
  rejectUnsupportedFilter(value.to ?? undefined, "to")
  return {
    classifications: value.classifications,
    cursor: value.cursor ?? undefined,
    introducedFrom: value.introducedFrom,
    introducedTo: value.introducedTo,
    jurisdictionIds: value.jurisdictionIds,
    limit: value.limit,
    mode,
    query: value.query,
    sessionIds: value.sessionIds,
    sponsorIds: value.sponsorIds,
    statuses: value.statuses,
    subjects: value.subjects
  }
}

export function createCivicSearchApiHandler(service: CivicSearchApi): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      if (request.method === "GET" && url.pathname === "/api/people") {
        assertKnownQuery(url, ["cursor", "isActive", "jurisdictionId", "limit", "organizationId", "q"])
        const input: PersonSearchInput = {
          cursor: optionalQueryString(url, "cursor"),
          isActive: optionalQueryBoolean(url, "isActive"),
          jurisdictionId: optionalQueryString(url, "jurisdictionId"),
          limit: queryLimit(url),
          organizationId: optionalQueryString(url, "organizationId"),
          query: optionalQueryString(url, "q")
        }
        sendApiJson(response, 200, apiPage(request, await service.searchPeople(input), input.limit ?? 20))
        return true
      }

      const personId = routeIdentifier(url.pathname, "people")
      if (request.method === "GET" && personId !== undefined) {
        assertKnownQuery(url, ["cursor", "limit"])
        sendApiJson(
          response,
          200,
          apiResource(
            request,
            await service.getPerson({
              cursor: optionalQueryString(url, "cursor"),
              id: personId,
              limit: queryLimit(url)
            })
          )
        )
        return true
      }

      if (request.method === "GET" && url.pathname === "/api/organizations") {
        assertKnownQuery(url, [
          "classification",
          "cursor",
          "isActive",
          "jurisdictionId",
          "limit",
          "parentOrganizationId",
          "q"
        ])
        const input: OrganizationSearchInput = {
          classification: optionalQueryString(url, "classification"),
          cursor: optionalQueryString(url, "cursor"),
          isActive: optionalQueryBoolean(url, "isActive"),
          jurisdictionId: optionalQueryString(url, "jurisdictionId"),
          limit: queryLimit(url),
          parentOrganizationId: optionalQueryString(url, "parentOrganizationId"),
          query: optionalQueryString(url, "q")
        }
        sendApiJson(response, 200, apiPage(request, await service.searchOrganizations(input), input.limit ?? 20))
        return true
      }

      const organizationMeetingId = organizationMeetingIdentifier(url.pathname)
      if (request.method === "GET" && organizationMeetingId !== undefined) {
        assertKnownQuery(url, ["classification", "cursor", "from", "limit", "sort", "status", "to"])
        await service.getOrganization({ id: organizationMeetingId })
        const from = queryOptionalDateOrTimestamp(url, "from")
        const to = queryOptionalDateOrTimestamp(url, "to")
        if (from !== undefined && to !== undefined && from > to) {
          throw new LegislationError("invalid_request", "from must not be after to")
        }
        const limit = queryLimit(url) ?? 20
        const page = await service.searchEvents({
          classification: repeatedQueryValues(url, "classification"),
          cursor: optionalQueryString(url, "cursor"),
          from,
          limit,
          organizationId: organizationMeetingId,
          sort: meetingSort(url),
          status: repeatedQueryValues(url, "status"),
          to
        })
        sendApiJson(response, 200, apiPage(request, page, limit))
        return true
      }

      const organizationId = routeIdentifier(url.pathname, "organizations")
      if (request.method === "GET" && organizationId !== undefined) {
        assertKnownQuery(url, ["cursor", "limit"])
        sendApiJson(
          response,
          200,
          apiResource(
            request,
            await service.getOrganization({
              cursor: optionalQueryString(url, "cursor"),
              id: organizationId,
              limit: queryLimit(url)
            })
          )
        )
        return true
      }

      if (request.method === "GET" && url.pathname === "/api/meetings") {
        assertKnownQuery(url, ["cursor", "from", "jurisdictionId", "limit", "organizationId", "to"])
        const input: EventSearchInput = {
          cursor: optionalQueryString(url, "cursor"),
          from: queryOptionalDateOrTimestamp(url, "from"),
          jurisdictionId: optionalQueryString(url, "jurisdictionId"),
          limit: queryLimit(url),
          organizationId: optionalQueryString(url, "organizationId"),
          to: queryOptionalDateOrTimestamp(url, "to")
        }
        sendApiJson(response, 200, apiPage(request, await service.searchEvents(input), input.limit ?? 20))
        return true
      }

      const meetingId = routeIdentifier(url.pathname, "meetings")
      if (request.method === "GET" && meetingId !== undefined) {
        assertKnownQuery(url, [])
        sendApiJson(response, 200, apiResource(request, await service.getEvent({ id: meetingId })))
        return true
      }

      if (request.method === "POST" && url.pathname === "/api/search/bills") {
        const body = billSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        const result = await service.searchBills(searchInput(body, mode))
        sendApiJson(response, 200, searchPage(request, result, limit, mode))
        return true
      }

      if (request.method === "POST" && url.pathname === "/api/search/amendments") {
        const body = amendmentSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        validateDateOrder(body.from ?? undefined, body.to ?? undefined, ["from", "to"])
        validateDateOrder(body.submittedFrom, body.submittedTo, ["submittedFrom", "submittedTo"])
        rejectUnsupportedFilter(body.explain === true ? true : undefined, "explain")
        rejectUnsupportedFilter(body.from ?? undefined, "from")
        rejectUnsupportedFilter(body.to ?? undefined, "to")
        rejectUnsupportedFilter(body.sessionIds, "sessionIds")
        rejectUnsupportedFilter(body.recordTypes, "recordTypes")
        rejectUnsupportedFilter(body.statuses, "statuses")
        rejectUnsupportedFilter(body.submittedFrom, "submittedFrom")
        rejectUnsupportedFilter(body.submittedTo, "submittedTo")
        const input: AmendmentSearchInput = {
          billId: optionalSingle(body.billIds, "billIds"),
          cursor: body.cursor ?? undefined,
          jurisdictionId: optionalSingle(body.jurisdictionIds, "jurisdictionIds"),
          limit,
          mode,
          query: body.query,
          sponsorPersonId: optionalSingle(body.sponsorPersonIds, "sponsorPersonIds")
        }
        sendApiJson(response, 200, searchPage(request, await service.searchAmendments(input), limit, mode))
        return true
      }

      if (request.method === "POST" && url.pathname === "/api/search/passages") {
        const body = passageSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        validateDateOrder(body.from ?? undefined, body.to ?? undefined, ["from", "to"])
        if (body.pageFrom !== undefined && body.pageTo !== undefined && body.pageFrom > body.pageTo) {
          throw new LegislationError("invalid_request", "pageFrom must not be greater than pageTo")
        }
        rejectUnsupportedFilter(body.explain === true ? true : undefined, "explain")
        rejectUnsupportedFilter(body.from ?? undefined, "from")
        rejectUnsupportedFilter(body.to ?? undefined, "to")
        rejectUnsupportedFilter(body.sessionIds, "sessionIds")
        rejectUnsupportedFilter(body.documentClassifications, "documentClassifications")
        rejectUnsupportedFilter(body.headings, "headings")
        rejectUnsupportedFilter(body.pageFrom, "pageFrom")
        rejectUnsupportedFilter(body.pageTo, "pageTo")
        rejectUnsupportedFilter(body.versionCodes, "versionCodes")
        const input: PassageSearchInput & { mode: "hybrid" | "lexical" | "semantic" } = {
          billId: optionalSingle(body.billIds, "billIds"),
          cursor: body.cursor ?? undefined,
          documentIds: body.documentIds,
          jurisdictionIds: body.jurisdictionIds,
          limit,
          mode,
          query: body.query
        }
        sendApiJson(response, 200, searchPage(request, await service.searchBillText(input), limit, mode))
        return true
      }

      if (request.method === "POST" && url.pathname === "/api/search/supporting-materials") {
        const body = materialSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        validateDateOrder(body.from ?? undefined, body.to ?? undefined, ["from", "to"])
        validateDateOrder(body.documentFrom, body.documentTo, ["documentFrom", "documentTo"])
        rejectUnsupportedFilter(body.explain === true ? true : undefined, "explain")
        rejectUnsupportedFilter(body.from ?? undefined, "from")
        rejectUnsupportedFilter(body.to ?? undefined, "to")
        rejectUnsupportedFilter(body.sessionIds, "sessionIds")
        rejectUnsupportedFilter(body.organizationIds, "organizationIds")
        rejectUnsupportedFilter(body.documentFrom, "documentFrom")
        rejectUnsupportedFilter(body.documentTo, "documentTo")
        const input: SupportingMaterialSearchInput = {
          amendmentId: optionalSingle(body.amendmentIds, "amendmentIds"),
          billId: optionalSingle(body.billIds, "billIds"),
          classification: optionalSingle(body.classifications, "classifications"),
          cursor: body.cursor ?? undefined,
          eventId: optionalSingle(body.meetingIds, "meetingIds"),
          jurisdictionId: optionalSingle(body.jurisdictionIds, "jurisdictionIds"),
          limit,
          mode,
          query: body.query
        }
        sendApiJson(response, 200, searchPage(request, await service.searchSupportingMaterials(input), limit, mode))
        return true
      }

      if (request.method === "POST" && url.pathname === "/api/document-diffs") {
        const body = documentDiffRequestSchema.parse(await readJsonBody(request))
        const documentIds: [string, string] = [body.leftDocumentId, body.rightDocumentId]
        sendApiJson(
          response,
          200,
          apiResource(request, await service.compareBillVersions({ billId: body.billId, documentIds }))
        )
        return true
      }

      return false
    } catch (error) {
      if (url.pathname.startsWith("/api/")) {
        if (error instanceof z.ZodError) {
          sendApiError(
            request,
            response,
            new LegislationError("invalid_request", error.issues[0]?.message ?? "Invalid request")
          )
        } else {
          sendApiError(request, response, error)
        }
        return true
      }
      throw error
    }
  }
}
