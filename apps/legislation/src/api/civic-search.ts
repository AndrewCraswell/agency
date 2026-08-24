import type { IncomingMessage } from "node:http"
import { z } from "zod"
import { LegislationError } from "../legislation/errors.js"
import type {
  AmendmentSearchInput,
  SupportingMaterialSearchInput,
  VersionComparisonInput
} from "../legislation/query-service.js"
import type { PassageSearchInput, SearchInput } from "../search/search.js"
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
