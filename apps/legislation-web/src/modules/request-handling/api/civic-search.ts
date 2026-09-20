import type { IncomingMessage } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  decodeSupportingMaterialSearchCursor,
  type SupportingMaterialSearchHitResult,
  type SupportingMaterialSearchInput
} from "../../legislation/query-service"
import { decodeSearchCursor, type SearchInput } from "../../search/search"
import { projectSupportingMaterialSearchHits } from "./canonical-material-search"
import { CanonicalProjectionError } from "./canonical-projection"
import { projectBillSearchHits, type BillSearchCandidateRead } from "./canonical-search"
import {
  apiSearchPage,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import { searchExecution, type SearchExecution, type SearchMode, type SearchProduct } from "./search-execution"
import { normalizeSearchTemporalRange, validateSearchTemporalRange } from "./search-temporal-range"

type QueryPage<T> = Readonly<{
  items: readonly T[]
  nextCursor?: string
  search?: SearchExecution
  truncated: boolean
  warnings?: readonly string[]
}>

export type CivicSearchApi = Readonly<{
  searchBills: (
    input: SearchInput & { mode?: "hybrid" | "lexical" | "semantic" }
  ) => Promise<QueryPage<BillSearchCandidateRead>>
  searchSupportingMaterialHits: (input: SupportingMaterialSearchInput) => Promise<SupportingMaterialSearchHitResult>
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

function validateSearchModeLimit(mode: SearchMode, limit: number | undefined): number {
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
  mode: SearchMode,
  product: SearchProduct
) {
  return apiSearchPage(request, page, limit, {
    ...searchExecution(page.search, mode, product),
    mode
  })
}

function searchInput(
  value: z.infer<typeof billSearchRequestSchema>,
  mode: SearchMode
): Readonly<{ input: SearchInput & { mode: SearchMode }; offset: number }> {
  validateSearchTemporalRange(value.introducedFrom, value.introducedTo, ["introducedFrom", "introducedTo"])
  const updatedRange = normalizeSearchTemporalRange(value.from, value.to, ["from", "to"])
  const input = {
    classifications: value.classifications,
    cursor: value.cursor ?? undefined,
    introducedFrom: value.introducedFrom,
    introducedTo: value.introducedTo,
    jurisdictionIds: value.jurisdictionIds,
    limit: validateSearchModeLimit(mode, value.limit),
    mode,
    query: value.query,
    sessionIds: value.sessionIds,
    sponsorIds: value.sponsorIds,
    statuses: value.statuses,
    subjects: value.subjects,
    ...updatedRange
  }
  return { input, offset: searchCursorOffset(input.cursor, input) }
}

function searchCursorOffset(cursor: string | null | undefined, input?: SearchInput): number {
  try {
    return decodeSearchCursor(cursor ?? undefined, input)
  } catch {
    throw new LegislationError("invalid_request", "cursor must be a valid search cursor")
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
        assertAllowedQueryParameters(url, [])
        const body = billSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        const { input, offset } = searchInput(body, mode)
        const result = await service.searchBills(input)
        sendApiJson(
          response,
          200,
          searchPage(
            request,
            {
              ...result,
              items: projectBillSearchHits(result.items, mode, options.apiBaseUrl, body.explain === true, offset)
            },
            limit,
            mode,
            "bill"
          )
        )
        return true
      }

      if (request.method === "POST" && url.pathname === "/api/search/supporting-materials") {
        assertAllowedQueryParameters(url, [])
        const body = materialSearchRequestSchema.parse(await readJsonBody(request))
        const mode = body.mode ?? "lexical"
        const limit = validateSearchModeLimit(mode, body.limit)
        const updatedRange = normalizeSearchTemporalRange(body.from, body.to, ["from", "to"])
        validateSearchTemporalRange(body.documentFrom, body.documentTo, ["documentFrom", "documentTo"])
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
        const offset = decodeSupportingMaterialSearchCursor(input.cursor, input)
        const result = await service.searchSupportingMaterialHits(input)
        sendApiJson(
          response,
          200,
          searchPage(
            request,
            {
              ...result,
              items: projectSupportingMaterialSearchHits(
                result.items,
                mode,
                options.apiBaseUrl,
                body.explain === true,
                offset
              )
            },
            limit,
            mode,
            "supporting-material"
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
