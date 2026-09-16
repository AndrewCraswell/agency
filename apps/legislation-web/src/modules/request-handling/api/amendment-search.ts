import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  decodeAmendmentSearchCursor,
  type AmendmentSearchInput,
  type AmendmentSearchMode,
  type AmendmentSearchPage
} from "../../search/amendment-search.js"
import { projectAmendmentSearchHits } from "./canonical-amendment-search.js"
import {
  apiSearchPage,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

export interface AmendmentSearchApi {
  searchAmendmentHits: (
    input: AmendmentSearchInput
  ) => Promise<AmendmentSearchPage<import("../../search/amendment-search.js").AmendmentSearchCandidate>>
}

const identifier = z.string().trim().min(1).max(256)
const identifiers = uniqueArray(identifier, "ID arrays must contain unique values")
const values = uniqueArray(z.string().trim().min(1).max(256), "Filter arrays must contain unique values")
const recordTypes = uniqueArray(z.enum(["document", "structured"]), "recordTypes must contain unique values")
const temporalBound = z.union([z.string().date(), z.string().datetime({ offset: true })])
const requestSchema = z
  .object({
    billIds: identifiers,
    cursor: z.string().trim().min(1).max(2048).nullable().optional(),
    explain: z.boolean().optional(),
    from: temporalBound.nullable().optional(),
    jurisdictionIds: identifiers,
    limit: z.number().int().min(1).max(100).optional(),
    mode: z.enum(["hybrid", "lexical", "semantic"]).optional(),
    query: z.string().trim().min(1).max(500),
    recordTypes,
    sessionIds: identifiers,
    sponsorPersonIds: identifiers,
    statuses: values,
    submittedFrom: z.string().date().optional(),
    submittedTo: z.string().date().optional(),
    to: temporalBound.nullable().optional()
  })
  .strict()

function uniqueArray<T extends z.ZodType>(schema: T, message: string) {
  return z
    .array(schema)
    .min(1)
    .max(25)
    .superRefine((items, context) => {
      if (new Set(items).size !== items.length) {
        context.addIssue({ code: "custom", message })
      }
    })
    .optional()
}

export function createAmendmentSearchApiHandler(
  service: AmendmentSearchApi,
  options: Readonly<{ apiBaseUrl: string }>
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/search/amendments") {
      return false
    }
    try {
      assertAllowedQueryParameters(url, [])
      const body = requestSchema.parse(await readJsonBody(request))
      validateOrder(body.from ?? undefined, body.to ?? undefined, "from", "to")
      validateOrder(body.submittedFrom, body.submittedTo, "submittedFrom", "submittedTo")
      const mode = body.mode ?? "lexical"
      const limit = limitFor(mode, body.limit)
      const input: AmendmentSearchInput = {
        billIds: body.billIds,
        cursor: body.cursor ?? undefined,
        jurisdictionIds: body.jurisdictionIds,
        limit,
        mode,
        query: body.query,
        recordTypes: body.recordTypes,
        sessionIds: body.sessionIds,
        sponsorPersonIds: body.sponsorPersonIds,
        statuses: body.statuses,
        submittedFrom: body.submittedFrom,
        submittedTo: body.submittedTo,
        ...updatedRange(body.from ?? undefined, body.to ?? undefined)
      }
      let offset: number
      try {
        offset = decodeAmendmentSearchCursor(input.cursor, input)
      } catch {
        throw new LegislationError("invalid_request", "cursor must be a valid amendment search cursor")
      }
      const page = await service.searchAmendmentHits(input)
      const search = responseSearchExecution(page, mode)
      sendApiJson(
        response,
        200,
        apiSearchPage(
          request,
          {
            ...page,
            items: projectAmendmentSearchHits(page.items, mode, options.apiBaseUrl, body.explain === true, offset)
          },
          limit,
          { ...search, mode }
        )
      )
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendApiError(
          request,
          response,
          new LegislationError("invalid_request", error.issues[0]?.message ?? "Invalid request")
        )
      } else {
        sendApiError(request, response, error)
      }
    }
    return true
  }
}

function limitFor(mode: AmendmentSearchMode, requested: number | undefined): number {
  const limit = requested ?? 20
  if (mode !== "lexical" && limit > 25) {
    throw new LegislationError("invalid_request", "limit must be between 1 and 25 for semantic or hybrid search")
  }
  return limit
}

function responseSearchExecution(page: AmendmentSearchPage<unknown>, mode: AmendmentSearchMode) {
  if (page.search.isReranked) {
    throw new LegislationError("unprocessable", "Amendment search must not report reranking")
  }
  if (mode === "lexical") {
    if (page.search.models.length !== 0) {
      throw new LegislationError("unprocessable", "Lexical amendment search must not report model use")
    }
    return { isReranked: false, models: [] as const }
  }
  const embedding = page.search.models[0]
  if (
    page.search.models.length !== 1 ||
    embedding?.model !== "openai/text-embedding-3-small" ||
    embedding.purpose !== "embedding"
  ) {
    throw new LegislationError("unprocessable", "Amendment search model execution metadata is incomplete")
  }
  return {
    isReranked: false,
    models: [{ dimensions: 1_536, model: embedding.model, provider: "openai", purpose: "embedding" as const }]
  }
}

function validateOrder(from: string | undefined, to: string | undefined, fromName: string, toName: string): void {
  if (from !== undefined && to !== undefined && from.includes("T") !== to.includes("T")) {
    throw new LegislationError("invalid_request", `${fromName} and ${toName} must use the same temporal format`)
  }
  if (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to)) {
    throw new LegislationError("invalid_request", `${fromName} must not be after ${toName}`)
  }
}

function updatedRange(from: string | undefined, to: string | undefined) {
  const dateOnly = (from ?? to ?? "").length === 10
  const updatedFrom = from === undefined ? undefined : new Date(dateOnly ? `${from}T00:00:00.000Z` : from)
  if (to === undefined) {
    return { updatedFrom, updatedTo: undefined, updatedToExclusive: undefined }
  }
  if (!dateOnly) {
    return { updatedFrom, updatedTo: new Date(to), updatedToExclusive: undefined }
  }
  const updatedToExclusive = new Date(`${to}T00:00:00.000Z`)
  updatedToExclusive.setUTCDate(updatedToExclusive.getUTCDate() + 1)
  return { updatedFrom, updatedTo: undefined, updatedToExclusive }
}
