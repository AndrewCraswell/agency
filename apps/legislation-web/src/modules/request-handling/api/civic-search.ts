import type { IncomingMessage } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  decodeSupportingMaterialSearchCursor,
  type AmendmentSearchInput,
  type SupportingMaterialSearchHitResult,
  type SupportingMaterialSearchInput,
  type VersionComparisonInput
} from "../../legislation/query-service.js"
import {
  decodeSearchCursor,
  type PassageSearchInput,
  type PassageSearchResultPage,
  type SearchInput
} from "../../search/search.js"
import { projectSupportingMaterialSearchHits } from "./canonical-material-search.js"
import { CanonicalProjectionError } from "./canonical-projection.js"
import { projectBillSearchHits, type BillSearchCandidateRead } from "./canonical-search.js"
import {
  apiSearchPage,
  assertAllowedQueryParameters,
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

type SearchMode = "hybrid" | "lexical" | "semantic"
type SearchProduct = "bill" | "supporting-material"
type SearchModelPurpose = "embedding" | "reranking"

type ModelUsage = Readonly<{
  dimensions: 1_024 | 1_536 | null
  model: "cohere/rerank-v3.5" | "voyageai/voyage-4"
  provider: "cohere" | "voyageai"
  purpose: SearchModelPurpose
}>

export type CivicSearchApi = Readonly<{
  compareBillVersions: (input: VersionComparisonInput) => Promise<unknown>
  searchAmendments: (input: AmendmentSearchInput) => Promise<QueryPage<unknown>>
  searchBillText: (
    input: PassageSearchInput & { mode?: "hybrid" | "lexical" | "semantic" }
  ) => Promise<PassageSearchResultPage>
  searchBills: (
    input: SearchInput & { mode?: "hybrid" | "lexical" | "semantic" }
  ) => Promise<QueryPage<BillSearchCandidateRead>>
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

/**
 * Query services retain the compact execution facts needed for ranking. The
 * HTTP boundary expands and validates them against the public ModelUsage
 * contract, so a lexical result cannot accidentally claim an AI model and an
 * embedded result cannot omit its model provenance.
 */
function searchExecution(
  execution: QueryPage<unknown>["search"],
  mode: SearchMode,
  product: SearchProduct
): Readonly<{ isReranked: boolean; models: readonly ModelUsage[] }> {
  const rawModels = execution?.models ?? []
  const isReranked = execution?.isReranked ?? false
  if (mode === "lexical") {
    if (isReranked || rawModels.length > 0) {
      throw new CanonicalProjectionError("lexical search must not report model use or reranking")
    }
    return { isReranked: false, models: [] }
  }

  const models = rawModels.map(modelUsage)
  const embeddingModels = models.filter((model) => model.purpose === "embedding")
  const rerankingModels = models.filter((model) => model.purpose === "reranking")
  if (
    embeddingModels.length !== 1 ||
    embeddingModels[0]?.model !== "voyageai/voyage-4" ||
    embeddingModels[0].dimensions !== 1_024
  ) {
    throw new CanonicalProjectionError(`${product} ${mode} search must report its Voyage embedding model`)
  }

  if (product === "supporting-material") {
    if (isReranked || rerankingModels.length > 0) {
      throw new CanonicalProjectionError("supporting material search must not report reranking")
    }
    return { isReranked: false, models }
  }

  if (isReranked !== (rerankingModels.length === 1) || rerankingModels.length > 1) {
    throw new CanonicalProjectionError("bill search reranking metadata does not match execution")
  }
  return { isReranked, models }
}

function modelUsage(value: unknown): ModelUsage {
  if (typeof value !== "object" || value === null || !("model" in value) || !("purpose" in value)) {
    throw new CanonicalProjectionError("search model metadata is invalid")
  }
  const { model, purpose } = value
  if (model === "voyageai/voyage-4" && purpose === "embedding") {
    return { dimensions: 1_024, model, provider: "voyageai", purpose }
  }
  if (model === "cohere/rerank-v3.5" && purpose === "reranking") {
    return { dimensions: null, model, provider: "cohere", purpose }
  }
  throw new CanonicalProjectionError("search model metadata does not match the configured route")
}

function searchInput(
  value: z.infer<typeof billSearchRequestSchema>,
  mode: SearchMode
): Readonly<{ input: SearchInput & { mode: SearchMode }; offset: number }> {
  validateDateOrder(value.introducedFrom, value.introducedTo, ["introducedFrom", "introducedTo"])
  validateDateOrder(value.from ?? undefined, value.to ?? undefined, ["from", "to"])
  const updatedRange = materialUpdatedRange(value.from ?? undefined, value.to ?? undefined)
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
