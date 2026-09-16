import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  documentReadFromPersistence,
  documentSectionReadFromPersistence
} from "../../legislation/persistence/queries/document-reads"
import { decodePassageSearchCursor, type PassageSearchInput, type PassageSearchResultPage } from "../../search/search"
import { projectBillSummaryRead, projectDocumentSectionRead } from "./canonical-read"
import { projectDocumentSummaryRead } from "./document-read-routes"
import {
  apiSearchPage,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"

type SearchMode = "hybrid" | "lexical" | "semantic"

export interface PassageSearchApi {
  searchBillText: (input: PassageSearchInput & { mode: SearchMode }) => Promise<PassageSearchResultPage>
}

const identifier = z.string().trim().min(1).max(256)
const identifierArray = z
  .array(identifier)
  .min(1)
  .max(25)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "ID arrays must contain unique values" })
    }
  })
  .optional()
const valueArray = z
  .array(z.string().trim().min(1).max(256))
  .min(1)
  .max(25)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "Filter arrays must contain unique values" })
    }
  })
  .optional()
const temporalBound = z.union([z.string().date(), z.string().datetime({ offset: true })])

const requestSchema = z
  .object({
    billIds: identifierArray,
    cursor: z.string().trim().min(1).max(2048).nullable().optional(),
    documentClassifications: valueArray,
    documentIds: identifierArray,
    explain: z.boolean().optional(),
    from: temporalBound.nullable().optional(),
    headings: valueArray,
    jurisdictionIds: identifierArray,
    limit: z.number().int().min(1).max(100).optional(),
    mode: z.enum(["hybrid", "lexical", "semantic"]).optional(),
    pageFrom: z.number().int().positive().optional(),
    pageTo: z.number().int().positive().optional(),
    query: z.string().trim().min(1).max(500),
    sessionIds: identifierArray,
    to: temporalBound.nullable().optional(),
    versionCodes: valueArray
  })
  .strict()

/**
 * Exact source offsets are returned rather than markup-derived guesses. The
 * lexical matcher is deliberately conservative: ranges identify casefolded
 * literal query terms that exist in the persisted section text.
 */
function lexicalHighlightRanges(text: string, query: string) {
  const terms = [...new Set(query.match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [])]
    .map((term) => term.toLocaleLowerCase())
    .slice(0, 16)
  const ranges: Array<{ end: number; kind: "exact"; start: number }> = []
  const haystack = text.toLocaleLowerCase()
  for (const term of terms) {
    let start = 0
    while (ranges.length < 32) {
      const found = haystack.indexOf(term, start)
      if (found < 0) {
        break
      }
      ranges.push({ end: found + term.length, kind: "exact", start: found })
      start = found + term.length
    }
    if (ranges.length === 32) {
      break
    }
  }
  return ranges.sort((left, right) => left.start - right.start || left.end - right.end)
}

function highlightRanges(text: string, query: string, mode: SearchMode) {
  if (mode === "semantic") {
    return text.length === 0 ? [] : [{ end: text.length, kind: "semantic" as const, start: 0 }]
  }
  const lexical = lexicalHighlightRanges(text, query)
  if (mode === "lexical" || lexical.length > 0) {
    return lexical
  }
  return text.length === 0 ? [] : [{ end: text.length, kind: "semantic" as const, start: 0 }]
}

function validateBoundOrder(from: string | undefined, to: string | undefined): void {
  if (from !== undefined && to !== undefined && from.includes("T") !== to.includes("T")) {
    throw new LegislationError("invalid_request", "from and to must use the same temporal format")
  }
  if (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to)) {
    throw new LegislationError("invalid_request", "from must not be after to")
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

function limitFor(mode: SearchMode, requested: number | undefined): number {
  const limit = requested ?? 20
  if (mode !== "lexical" && limit > 25) {
    throw new LegislationError("invalid_request", "limit must be between 1 and 25 for semantic or hybrid search")
  }
  return limit
}

function modelsFor(page: PassageSearchResultPage, mode: SearchMode) {
  if (mode === "lexical") {
    if (page.search.isReranked || page.search.models.length !== 0) {
      throw new LegislationError("unprocessable", "Lexical passage search must not report model use")
    }
    return { isReranked: false, models: [] as const }
  }
  const models = page.search.models.map((model) => {
    if (model.model === "openai/text-embedding-3-small" && model.purpose === "embedding") {
      return { dimensions: 1_536, model: model.model, provider: "openai", purpose: model.purpose } as const
    }
    if (model.model === "cohere/rerank-v3.5" && model.purpose === "reranking") {
      return { dimensions: null, model: model.model, provider: "cohere", purpose: model.purpose } as const
    }
    throw new LegislationError("unprocessable", "Passage search model metadata is not configured")
  })
  const embeddings = models.filter((model) => model.purpose === "embedding")
  const rerankers = models.filter((model) => model.purpose === "reranking")
  if (embeddings.length !== 1 || rerankers.length > 1 || page.search.isReranked !== (rerankers.length === 1)) {
    throw new LegislationError("unprocessable", "Passage search model execution metadata is incomplete")
  }
  return { isReranked: page.search.isReranked, models }
}

export function projectPassageSearchHit(
  candidate: PassageSearchResultPage["items"][number],
  rank: number,
  apiBaseUrl: string,
  mode: SearchMode,
  query: string,
  explain: boolean
) {
  if (
    !Number.isFinite(candidate.score) ||
    !nullableFinite(candidate.lexicalScore) ||
    !nullableFinite(candidate.semanticScore) ||
    !nullableFinite(candidate.rerankScore) ||
    !Number.isSafeInteger(rank) ||
    rank < 1
  ) {
    throw new LegislationError("unprocessable", "Passage search score or rank is invalid")
  }
  const section = projectDocumentSectionRead(
    documentSectionReadFromPersistence(candidate.document, candidate.section),
    apiBaseUrl
  )
  const document = projectDocumentSummaryRead(documentReadFromPersistence(candidate.document), apiBaseUrl)
  const bill = projectBillSummaryRead({ ...candidate.bill, latestActionAt: candidate.latestActionAt }, apiBaseUrl)
  return {
    match: {
      explanation: explain
        ? `${mode} search matched ${candidate.matchedFields.join(", ")}; lexical score ${scoreText(candidate.lexicalScore)}, semantic score ${scoreText(candidate.semanticScore)}, rerank score ${scoreText(candidate.rerankScore)}; response score ${candidate.score.toString()}.`
        : null,
      lexicalScore: candidate.lexicalScore,
      matchedFields: [...candidate.matchedFields],
      mode,
      rerankScore: candidate.rerankScore,
      semanticScore: candidate.semanticScore,
      snippet: candidate.snippet
    },
    rank,
    record: {
      ...section,
      bill,
      document,
      highlightRanges: highlightRanges(section.text, query, mode)
    },
    recordId: section.id,
    recordType: "passage" as const,
    score: candidate.score,
    sources: section.sources
  }
}

function nullableFinite(value: number | null): boolean {
  return value === null || Number.isFinite(value)
}

function scoreText(value: number | null): string {
  return value === null ? "null" : value.toString()
}

export function createPassageSearchApiHandler(
  service: PassageSearchApi,
  options: Readonly<{ apiBaseUrl: string; rankedPassageGeneration?: string }>
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/search/passages") {
      return false
    }
    try {
      assertAllowedQueryParameters(url, [])
      const body = requestSchema.parse(await readJsonBody(request))
      if (body.pageFrom !== undefined && body.pageTo !== undefined && body.pageFrom > body.pageTo) {
        throw new LegislationError("invalid_request", "pageFrom must not be greater than pageTo")
      }
      const mode = body.mode ?? "lexical"
      validateBoundOrder(body.from ?? undefined, body.to ?? undefined)
      const limit = limitFor(mode, body.limit)
      const input = {
        billIds: body.billIds,
        cursor: body.cursor ?? undefined,
        documentClassifications: body.documentClassifications,
        documentIds: body.documentIds,
        headings: body.headings,
        jurisdictionIds: body.jurisdictionIds,
        limit,
        mode,
        pageFrom: body.pageFrom,
        pageTo: body.pageTo,
        query: body.query,
        rankingGeneration: mode === "lexical" ? options.rankedPassageGeneration : undefined,
        sessionIds: body.sessionIds,
        versionCodes: body.versionCodes,
        ...updatedRange(body.from ?? undefined, body.to ?? undefined)
      }
      let offset: number
      try {
        offset = decodePassageSearchCursor(input.cursor, input)
      } catch {
        throw new LegislationError("invalid_request", "cursor must be a valid passage search cursor")
      }
      const page = await service.searchBillText(input)
      const execution = modelsFor(page, mode)
      sendApiJson(
        response,
        200,
        apiSearchPage(
          request,
          {
            ...page,
            items: page.items.map((item, index) =>
              projectPassageSearchHit(
                item,
                offset + index + 1,
                options.apiBaseUrl,
                mode,
                body.query,
                body.explain === true
              )
            )
          },
          limit,
          { ...execution, mode }
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
