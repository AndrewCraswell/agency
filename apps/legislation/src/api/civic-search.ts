import type { IncomingMessage } from "node:http"
import { z } from "zod"
import { LegislationError } from "../legislation/errors.js"
import type {
  AmendmentSearchInput,
  SupportingMaterialSearchHitResult,
  SupportingMaterialSearchInput,
  VersionComparisonInput
} from "../legislation/query-service.js"
import type { PassageSearchInput, SearchInput } from "../search/search.js"
import { projectSupportingMaterialSearchHits } from "./canonical-material-search.js"
import { CanonicalProjectionError } from "./canonical-projection.js"
import { apiSearchPage, readJsonBody, requestUrl, sendApiError, sendApiJson, type HttpApiHandler } from "./http.js"

type QueryPage<T> = Readonly<{
  items: readonly T[]
  nextCursor?: string
  search?: Readonly<{ isReranked: boolean; models: readonly unknown[] }>
  truncated: boolean
  warnings?: readonly string[]
}>

export type CivicSearchApi = Readonly<{
  compareBillVersions: (input: VersionComparisonInput) => Promise<unknown>
  searchAmendments: (input: AmendmentSearchInput) => Promise<QueryPage<unknown>>
  searchBillText: (
    input: PassageSearchInput & { mode?: "hybrid" | "lexical" | "semantic" }
  ) => Promise<QueryPage<unknown>>
  searchBills: (input: SearchInput & { mode?: "hybrid" | "lexical" | "semantic" }) => Promise<QueryPage<unknown>>
  searchSupportingMaterialHits: (input: SupportingMaterialSearchInput) => Promise<SupportingMaterialSearchHitResult>
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

function materialUpdatedRange(
  from: string | undefined,
  to: string | undefined
): {
  updatedFrom: Date | undefined
  updatedTo: Date | undefined
  updatedToExclusive: Date | undefined
} {
  if (from === undefined && to === undefined) {
    return { updatedFrom: undefined, updatedTo: undefined, updatedToExclusive: undefined }
  }
  const dateOnly = (from ?? to ?? "").length === 10
  const updatedFrom = from === undefined ? undefined : new Date(dateOnly ? `${from}T00:00:00.000Z` : from)
  if (to === undefined) {
    return { updatedFrom, updatedTo: undefined, updatedToExclusive: undefined }
  }
  if (!dateOnly) {
    return { updatedFrom, updatedTo: new Date(to), updatedToExclusive: undefined }
  }
  const exclusive = new Date(`${to}T00:00:00.000Z`)
  exclusive.setUTCDate(exclusive.getUTCDate() + 1)
  return { updatedFrom, updatedTo: undefined, updatedToExclusive: exclusive }
}

function validateSearchModeLimit(mode: "hybrid" | "lexical" | "semantic", limit: number | undefined): number {
  const effectiveLimit = limit ?? 20
  if (mode !== "lexical" && effectiveLimit > 25) {
    throw new LegislationError("invalid_request", "limit must be between 1 and 25 for semantic or hybrid search")
  }
  return effectiveLimit
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

export function createCivicSearchApiHandler(
  service: CivicSearchApi,
  options: Readonly<{ apiBaseUrl: string }>
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      if (request.method === "POST" && url.pathname === "/api/search/bills") {
        const body = billSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        const result = await service.searchBills(searchInput(body, mode))
        sendApiJson(response, 200, searchPage(request, result, limit, mode))
        return true
      }

      if (request.method === "POST" && url.pathname === "/api/search/supporting-materials") {
        const body = materialSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        validateDateOrder(body.from ?? undefined, body.to ?? undefined, ["from", "to"])
        validateDateOrder(body.documentFrom, body.documentTo, ["documentFrom", "documentTo"])
        const updatedRange = materialUpdatedRange(body.from ?? undefined, body.to ?? undefined)
        const input: SupportingMaterialSearchInput = {
          amendmentIds: body.amendmentIds,
          billIds: body.billIds,
          classifications: body.classifications,
          cursor: body.cursor ?? undefined,
          documentFrom: body.documentFrom,
          documentTo: body.documentTo,
          eventIds: body.meetingIds,
          jurisdictionIds: body.jurisdictionIds,
          limit,
          mode,
          organizationIds: body.organizationIds,
          query: body.query,
          sessionIds: body.sessionIds,
          ...updatedRange
        }
        const result = await service.searchSupportingMaterialHits(input)
        sendApiJson(
          response,
          200,
          searchPage(
            request,
            {
              ...result,
              items: projectSupportingMaterialSearchHits(result.items, mode, options.apiBaseUrl, body.explain === true)
            },
            limit,
            mode
          )
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
        } else if (error instanceof CanonicalProjectionError) {
          sendApiError(request, response, new LegislationError("unprocessable", error.message))
        } else {
          sendApiError(request, response, error)
        }
        return true
      }
      throw error
    }
  }
}
