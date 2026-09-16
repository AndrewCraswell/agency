import { createHash } from "node:crypto"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  apiSearchPage,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

const RECORD_TYPES = [
  "bill",
  "amendment",
  "passage",
  "supporting-material",
  "person",
  "organization",
  "meeting"
] as const
const LEXICAL_ONLY_TYPES = new Set<UniversalRecordType>(["person", "organization", "meeting"])
const modes = ["lexical", "semantic", "hybrid"] as const

export type UniversalRecordType = (typeof RECORD_TYPES)[number]
export type UniversalSearchMode = (typeof modes)[number]

export type SearchModel = Readonly<{
  dimensions: 1_024 | 1_536 | null
  model: "cohere/rerank-v3.5" | "openai/text-embedding-3-small" | "voyageai/voyage-4"
  provider: "cohere" | "openai" | "voyageai"
  purpose: "embedding" | "reranking"
}>

export type UniversalSearchCandidate = Readonly<{
  lexicalScore: number | null
  matchedFields: readonly string[]
  record: unknown
  recordId: string
  recordType: UniversalRecordType
  rerankScore: number | null
  semanticScore: number | null
  snippet: string | null
  sources: readonly unknown[]
}>

export type UniversalProductPage = Readonly<{
  items: readonly UniversalSearchCandidate[]
  models: readonly SearchModel[]
  truncated: boolean
}>

export type UniversalSearchApi = Readonly<{
  search: (input: UniversalProductSearchInput) => Promise<UniversalProductPage>
}>

export type UniversalProductSearchInput = Readonly<{
  filters: Record<string, unknown> | undefined
  mode: UniversalSearchMode
  perTypeLimit: number
  query: string
  recordType: UniversalRecordType
  shared: Record<string, unknown>
}>

const identifier = z.string().trim().min(1).max(256)
const identifierArray = z
  .array(identifier)
  .min(1)
  .max(25)
  .superRefine(uniqueValues("ID arrays must contain unique values"))
const textArray = z
  .array(z.string().trim().min(1).max(256))
  .min(1)
  .max(25)
  .superRefine(uniqueValues("Filter arrays must contain unique values"))
const temporalBound = z.union([z.string().date(), z.string().datetime({ offset: true })])
const base = {
  from: temporalBound.nullable().optional(),
  jurisdictionIds: identifierArray.optional(),
  sessionIds: identifierArray.optional(),
  to: temporalBound.nullable().optional()
}
const billFilters = z
  .object({
    classifications: textArray.optional(),
    introducedFrom: z.string().date().optional(),
    introducedTo: z.string().date().optional(),
    sponsorIds: identifierArray.optional(),
    statuses: textArray.optional(),
    subjects: textArray.optional()
  })
  .strict()
const amendmentFilters = z
  .object({
    billIds: identifierArray.optional(),
    recordTypes: z
      .array(z.enum(["structured", "document"]))
      .min(1)
      .max(25)
      .superRefine(uniqueValues("recordTypes must contain unique values"))
      .optional(),
    sponsorPersonIds: identifierArray.optional(),
    statuses: textArray.optional(),
    submittedFrom: z.string().date().optional(),
    submittedTo: z.string().date().optional()
  })
  .strict()
const passageFilters = z
  .object({
    billIds: identifierArray.optional(),
    documentClassifications: textArray.optional(),
    documentIds: identifierArray.optional(),
    headings: textArray.optional(),
    pageFrom: z.number().int().positive().optional(),
    pageTo: z.number().int().positive().optional(),
    versionCodes: textArray.optional()
  })
  .strict()
const materialFilters = z
  .object({
    amendmentIds: identifierArray.optional(),
    billIds: identifierArray.optional(),
    classifications: textArray.optional(),
    documentFrom: z.string().date().optional(),
    documentTo: z.string().date().optional(),
    meetingIds: identifierArray.optional(),
    organizationIds: identifierArray.optional()
  })
  .strict()
const personFilters = z
  .object({
    isActive: z.boolean().optional(),
    jurisdictionIds: identifierArray.optional(),
    organizationIds: identifierArray.optional(),
    parties: textArray.optional()
  })
  .strict()
const organizationFilters = z
  .object({
    classifications: textArray.optional(),
    isActive: z.boolean().optional(),
    jurisdictionIds: identifierArray.optional(),
    parentOrganizationIds: identifierArray.optional()
  })
  .strict()
const meetingFilters = z
  .object({
    classifications: textArray.optional(),
    from: temporalBound.optional(),
    jurisdictionIds: identifierArray.optional(),
    organizationIds: identifierArray.optional(),
    statuses: textArray.optional(),
    to: temporalBound.optional()
  })
  .strict()
const requestSchema = z
  .object({
    cursor: z.string().trim().min(1).max(4_096).nullable().optional(),
    explain: z.boolean().optional(),
    filters: z
      .object({
        amendment: amendmentFilters.optional(),
        bill: billFilters.optional(),
        meeting: meetingFilters.optional(),
        organization: organizationFilters.optional(),
        passage: passageFilters.optional(),
        person: personFilters.optional(),
        supportingMaterial: materialFilters.optional()
      })
      .strict()
      .optional(),
    limit: z.number().int().min(1).max(100).optional(),
    mode: z.enum(modes).optional(),
    perTypeLimit: z.number().int().min(1).max(25).optional(),
    query: z.string().trim().min(1).max(500),
    recordTypes: z
      .array(z.enum(RECORD_TYPES))
      .min(1)
      .max(RECORD_TYPES.length)
      .superRefine(uniqueValues("recordTypes must contain unique values"))
      .optional(),
    ...base
  })
  .strict()

type Request = z.infer<typeof requestSchema>
type Cursor = Readonly<{ offset: number; scope: string; version: 1 }>

export function createUniversalSearchApiHandler(service: UniversalSearchApi): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/search/all") {
      return false
    }
    try {
      assertAllowedQueryParameters(url, [])
      const body = requestSchema.parse(await readJsonBody(request))
      validateDateRanges(body)
      const mode = body.mode ?? "lexical"
      const limit = mode === "lexical" ? (body.limit ?? 20) : semanticLimit(body.limit)
      const perTypeLimit = body.perTypeLimit ?? 10
      const recordTypes = body.recordTypes ?? RECORD_TYPES
      if (mode === "semantic" && recordTypes.some((type) => LEXICAL_ONLY_TYPES.has(type))) {
        throw new LegislationError(
          "unprocessable",
          "semantic search is not available for people, organizations, or meetings"
        )
      }
      const scope = cursorScope(body, mode, recordTypes, limit, perTypeLimit)
      const offset = cursorOffset(body.cursor, scope)
      const pages = await Promise.all(
        recordTypes.map(
          async (recordType) =>
            [
              recordType,
              await service.search({
                filters: filtersForType(body.filters, recordType),
                mode: effectiveMode(mode, recordType),
                perTypeLimit,
                query: body.query,
                recordType,
                shared: sharedFilters(body)
              })
            ] as const
        )
      )
      const merged = merge(pages, mode, body.explain === true)
      const items = merged.slice(offset, offset + limit).map((item, index) => ({ ...item, rank: offset + index + 1 }))
      // Product adapters expose only one bounded candidate window. Never emit
      // a universal continuation that would re-run that same window and skip
      // records; a capped product is explicitly marked truncated instead.
      const nextCursor = offset + items.length < merged.length ? encodeCursor(offset + items.length, scope) : undefined
      const groups = recordTypes.map((recordType) => ({
        // Only the top-level cursor continues the merged request. A group
        // cursor would imply a single-product continuation, which this route
        // intentionally does not expose.
        nextCursor: null,
        recordType,
        returned: items.filter((item) => item.recordType === recordType).length
      }))
      const models = modelsUsed(pages, mode)
      const page = apiSearchPage(
        request,
        { items, nextCursor, truncated: pages.some(([, page]) => page.truncated) },
        limit,
        {
          isReranked: models.some((model) => model.purpose === "reranking"),
          mode,
          models
        }
      )
      sendApiJson(response, 200, {
        ...page,
        meta: { ...(page.meta as Record<string, unknown>), groups }
      })
    } catch (error) {
      sendApiError(
        request,
        response,
        error instanceof z.ZodError
          ? new LegislationError("invalid_request", error.issues[0]?.message ?? "Invalid request")
          : error
      )
    }
    return true
  }
}

function uniqueValues(message: string) {
  return (values: readonly string[], context: z.RefinementCtx) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message })
    }
  }
}

function semanticLimit(requested: number | undefined): number {
  const limit = requested ?? 20
  if (limit > 25) {
    throw new LegislationError("invalid_request", "limit must be between 1 and 25 for semantic or hybrid search")
  }
  return limit
}

function validateDateRanges(body: Request): void {
  validateRange(body.from ?? undefined, body.to ?? undefined, "from", "to")
  const filters = body.filters
  validateRange(filters?.bill?.introducedFrom, filters?.bill?.introducedTo, "introducedFrom", "introducedTo")
  validateRange(filters?.amendment?.submittedFrom, filters?.amendment?.submittedTo, "submittedFrom", "submittedTo")
  validateRange(
    filters?.supportingMaterial?.documentFrom,
    filters?.supportingMaterial?.documentTo,
    "documentFrom",
    "documentTo"
  )
  validateRange(filters?.meeting?.from, filters?.meeting?.to, "meeting.from", "meeting.to")
  if (
    filters?.passage?.pageFrom !== undefined &&
    filters.passage.pageTo !== undefined &&
    filters.passage.pageFrom > filters.passage.pageTo
  ) {
    throw new LegislationError("invalid_request", "pageFrom must not be greater than pageTo")
  }
}

function validateRange(from: string | undefined, to: string | undefined, fromName: string, toName: string): void {
  if (
    from !== undefined &&
    to !== undefined &&
    (from.includes("T") !== to.includes("T") || Date.parse(from) > Date.parse(to))
  ) {
    throw new LegislationError("invalid_request", `${fromName} must not be after ${toName}`)
  }
}

function effectiveMode(mode: UniversalSearchMode, type: UniversalRecordType): UniversalSearchMode {
  return mode === "hybrid" && LEXICAL_ONLY_TYPES.has(type) ? "lexical" : mode
}

function sharedFilters(body: Request): Record<string, unknown> {
  return {
    from: body.from ?? undefined,
    jurisdictionIds: body.jurisdictionIds,
    sessionIds: body.sessionIds,
    to: body.to ?? undefined
  }
}

function filtersForType(filters: Request["filters"], type: UniversalRecordType): Record<string, unknown> | undefined {
  switch (type) {
    case "supporting-material":
      return filters?.supportingMaterial
    default:
      return filters?.[type]
  }
}

function cursorScope(
  body: Request,
  mode: UniversalSearchMode,
  recordTypes: readonly UniversalRecordType[],
  limit: number,
  perTypeLimit: number
): string {
  const { cursor: _cursor, ...withoutCursor } = body
  return digest(JSON.stringify({ ...withoutCursor, limit, mode, perTypeLimit, recordTypes }))
}

function cursorOffset(value: string | null | undefined, scope: string): number {
  if (value === undefined || value === null) {
    return 0
  }
  try {
    const cursor: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (!isCursor(cursor) || cursor.scope !== scope) {
      throw new Error("invalid")
    }
    return cursor.offset
  } catch {
    throw new LegislationError("invalid_request", "cursor must be a valid universal search cursor")
  }
}

function encodeCursor(offset: number, scope: string): string {
  return Buffer.from(JSON.stringify({ offset, scope, version: 1 } satisfies Cursor), "utf8").toString("base64url")
}

function isCursor(value: unknown): value is Cursor {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.get(value, "version") === 1 &&
    typeof Reflect.get(value, "scope") === "string" &&
    Number.isSafeInteger(Reflect.get(value, "offset")) &&
    (Reflect.get(value, "offset") as number) >= 0
  )
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url")
}

function merge(
  pages: readonly (readonly [UniversalRecordType, UniversalProductPage])[],
  mode: UniversalSearchMode,
  explain: boolean
) {
  const output = pages.flatMap(([type, page]) =>
    page.items.map((candidate, index) => {
      validateCandidate(candidate, type, mode)
      const appliedMode = effectiveMode(mode, type)
      const score = 1 / (60 + index + 1)
      return {
        match: {
          explanation: explain ? `${appliedMode} search matched ${candidate.matchedFields.join(", ")}.` : null,
          lexicalScore: candidate.lexicalScore,
          matchedFields: [...candidate.matchedFields],
          mode: appliedMode,
          rerankScore: candidate.rerankScore,
          semanticScore: candidate.semanticScore,
          snippet: candidate.snippet
        },
        record: candidate.record,
        recordId: candidate.recordId,
        recordType: candidate.recordType,
        score,
        sources: candidate.sources
      }
    })
  )
  return output.toSorted(
    (left, right) =>
      right.score - left.score ||
      left.recordType.localeCompare(right.recordType) ||
      left.recordId.localeCompare(right.recordId)
  )
}

function validateCandidate(
  candidate: UniversalSearchCandidate,
  type: UniversalRecordType,
  requestedMode: UniversalSearchMode
): void {
  if (
    candidate.recordType !== type ||
    candidate.recordId.trim().length === 0 ||
    candidate.matchedFields.length === 0 ||
    candidate.sources.length === 0
  ) {
    throw new LegislationError("unprocessable", "universal search candidate is incomplete")
  }
  const mode = effectiveMode(requestedMode, type)
  if (
    mode === "lexical" &&
    (candidate.lexicalScore === null || candidate.semanticScore !== null || candidate.rerankScore !== null)
  ) {
    throw new LegislationError("unprocessable", "lexical candidates must not claim semantic or reranking scores")
  }
  if (mode === "semantic" && (candidate.lexicalScore !== null || candidate.semanticScore === null)) {
    throw new LegislationError("unprocessable", "semantic candidates must not claim lexical scores")
  }
  if (mode === "hybrid" && candidate.lexicalScore === null && candidate.semanticScore === null) {
    throw new LegislationError("unprocessable", "hybrid candidates need a lexical or semantic score")
  }
}

function modelsUsed(
  pages: readonly (readonly [UniversalRecordType, UniversalProductPage])[],
  mode: UniversalSearchMode
): SearchModel[] {
  if (mode === "lexical") {
    if (pages.some(([, page]) => page.models.length > 0)) {
      throw new LegislationError("unprocessable", "lexical search must not report model use")
    }
    return []
  }
  for (const [type, page] of pages) {
    validateModels(type, page.models, mode)
  }
  const models = pages.flatMap(([, page]) => page.models)
  const unique = [
    ...new Map(models.map((model) => [`${model.provider}:${model.model}:${model.purpose}`, model])).values()
  ]
  if (unique.some((model) => model.purpose === "embedding" && model.dimensions === null)) {
    throw new LegislationError("unprocessable", "embedding model dimensions are required")
  }
  return unique
}

function validateModels(type: UniversalRecordType, models: readonly SearchModel[], mode: UniversalSearchMode): void {
  if (LEXICAL_ONLY_TYPES.has(type)) {
    if (models.length > 0) {
      throw new LegislationError("unprocessable", "lexical-only products must not report model use")
    }
    return
  }
  const expectedEmbedding =
    type === "bill" || type === "supporting-material" ? "voyageai/voyage-4" : "openai/text-embedding-3-small"
  const expectedDimensions = expectedEmbedding === "voyageai/voyage-4" ? 1_024 : 1_536
  const embeddings = models.filter((model) => model.purpose === "embedding")
  const rerankers = models.filter((model) => model.purpose === "reranking")
  if (
    embeddings.length !== 1 ||
    embeddings[0]?.model !== expectedEmbedding ||
    embeddings[0].dimensions !== expectedDimensions
  ) {
    throw new LegislationError("unprocessable", `${type} ${mode} search model metadata is incomplete`)
  }
  const mayRerank = type === "bill" || type === "passage"
  if (
    rerankers.length > 1 ||
    (!mayRerank && rerankers.length > 0) ||
    rerankers.some((model) => model.model !== "cohere/rerank-v3.5" || model.dimensions !== null)
  ) {
    throw new LegislationError("unprocessable", `${type} search reranking metadata is not configured`)
  }
}
