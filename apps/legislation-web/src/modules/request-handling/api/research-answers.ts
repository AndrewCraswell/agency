import { randomUUID } from "node:crypto"
import { getRequestContext, type RequestIdentity } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import type { ResearchAnswerModelClient } from "../../../services/openrouter/openrouter-retrieval"
import { documentSectionReadFromPersistence } from "../../legislation/persistence/queries/document-reads"
import type { AmendmentSearchInput } from "../../legislation/query-service"
import { projectSupportingMaterialSearchHits } from "./canonical-material-search"
import { isRfc3339Timestamp } from "./canonical-projection"
import { projectDocumentSectionRead, sourceProjectionContext, type SourceDocument } from "./canonical-read"
import { projectBillSearchHits } from "./canonical-search"
import type { CivicSearchApi } from "./civic-search"
import {
  apiResource,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import type { PassageSearchApi } from "./passage-search"
import { searchExecution, type SearchExecution } from "./search-execution"
import { normalizeSearchTemporalRange, validateSearchTemporalRange } from "./search-temporal-range"

type SearchMode = "hybrid" | "lexical" | "semantic"
type ResearchRecordType = "amendment" | "bill" | "passage" | "supporting-material"
const MAXIMUM_RESEARCH_RESPONSE_BYTES = 256 * 1024

export type ResearchScope = Readonly<{
  billIds?: readonly string[]
  from?: string
  jurisdictionIds?: readonly string[]
  meetingIds?: readonly string[]
  organizationIds?: readonly string[]
  personIds?: readonly string[]
  sessionIds?: readonly string[]
  to?: string
}>

export type ModelUsage = Readonly<{
  dimensions: number | null
  model: string
  provider: "cohere" | "openai" | "voyageai"
  purpose: "embedding" | "generation" | "reranking"
}>

export type ResearchCitation = Readonly<{
  billId: string | null
  documentId: string | null
  id: string
  recordId: string
  recordType: ResearchRecordType
  sectionId: string | null
  snippet: string
  sourceUpdatedAt: string | null
  sourceUrl: string
  sources: readonly unknown[]
  title: string
}>

export type ResearchClaim = Readonly<{
  citationIds: readonly string[]
  confidence: "insufficient" | "mixed" | "supported"
  text: string
}>

export type ResearchRetrieval = Readonly<{
  candidateCount: number
  evidenceCount: number
  maxEvidence: number
  mode: SearchMode
  models: readonly ModelUsage[]
  recordTypes: readonly ResearchRecordType[]
  rerankedProducts: readonly ("bill" | "passage")[]
  rrfK: 60
}>

export type ResearchAnswer = Readonly<{
  answer: string
  citations: readonly ResearchCitation[]
  claims: readonly ResearchClaim[]
  generatedAt: string
  id: string
  question: string
  retrieval: ResearchRetrieval
  warnings: readonly string[]
}>

export type ResearchAnswerRequest = Readonly<{
  answerFormat: "concise" | "detailed" | "timeline"
  question: string
  retrieval: Readonly<{
    maxEvidence: number
    mode: SearchMode
    recordTypes: readonly ResearchRecordType[]
  }>
  scope: ResearchScope
}>

export interface ResearchAnswerApi {
  answer(input: ResearchAnswerRequest): Promise<ResearchAnswer>
}

export interface ResearchEvidenceRetriever {
  retrieve(input: ResearchAnswerRequest): Promise<
    Readonly<{
      candidateCount: number
      citations: readonly ResearchCitation[]
      models: readonly ModelUsage[]
      rerankedProducts: readonly ("bill" | "passage")[]
      warnings?: readonly string[]
    }>
  >
}

export interface ResearchAnswerGenerator {
  generate(
    input: Readonly<{
      answerFormat: ResearchAnswerRequest["answerFormat"]
      citations: readonly ResearchCitation[]
      question: string
    }>
  ): Promise<Readonly<{ answer: string; claims: readonly ResearchClaim[]; model: ModelUsage }>>
}

export type ResearchSearchApi = CivicSearchApi &
  PassageSearchApi &
  Readonly<{
    searchAmendments: (
      input: AmendmentSearchInput
    ) => Promise<Readonly<{ items: readonly unknown[]; search?: SearchExecution }>>
  }>

/**
 * Adapts the canonical ranked searches into compact evidence citations. A
 * record type is never searched when its canonical search surface cannot
 * apply every requested scope constraint, so scope is fail-closed.
 */
export function createCanonicalResearchEvidenceRetriever(
  search: ResearchSearchApi,
  apiBaseUrl: string
): ResearchEvidenceRetriever {
  return {
    async retrieve(input) {
      const evidenceByProduct: ResearchCitation[][] = []
      const models: ModelUsage[] = []
      const rerankedProducts: Array<"bill" | "passage"> = []
      const warnings: string[] = []
      let candidateCount = 0
      const candidateLimit = Math.min(input.retrieval.maxEvidence, 25)
      for (const recordType of input.retrieval.recordTypes) {
        switch (recordType) {
          case "bill": {
            if (!supportsScope(input.scope, ["billIds", "from", "jurisdictionIds", "sessionIds", "to"])) {
              warnings.push("Bills were excluded because the requested scope has unsupported bill constraints.")
              break
            }
            const page = await search.searchBills({
              ...searchScope(input.scope),
              limit: candidateLimit,
              mode: input.retrieval.mode,
              query: input.question
            })
            candidateCount += page.items.length
            const projected = projectBillSearchHits(page.items, input.retrieval.mode, apiBaseUrl)
            evidenceByProduct.push(
              projected
                .filter((hit) => billMatchesScope(hit.record, input.scope))
                .map((hit) => citationFromBillHit(hit))
            )
            recordSearchModels(page.search, models, rerankedProducts, "bill", input.retrieval.mode)
            break
          }
          case "passage": {
            if (!supportsScope(input.scope, ["billIds", "from", "jurisdictionIds", "sessionIds", "to"])) {
              warnings.push("Passages were excluded because the requested scope has unsupported passage constraints.")
              break
            }
            const page = await search.searchBillText({
              ...searchScope(input.scope),
              billIds: input.scope.billIds === undefined ? undefined : [...input.scope.billIds],
              limit: candidateLimit,
              mode: input.retrieval.mode,
              query: input.question
            })
            candidateCount += page.items.length
            evidenceByProduct.push(
              page.items.filter((item) => billMatchesScope(item.bill, input.scope)).map(citationFromPassage)
            )
            recordSearchModels(page.search, models, rerankedProducts, "passage", input.retrieval.mode)
            break
          }
          case "supporting-material": {
            if (
              !supportsScope(input.scope, [
                "billIds",
                "from",
                "jurisdictionIds",
                "meetingIds",
                "organizationIds",
                "sessionIds",
                "to"
              ])
            ) {
              warnings.push(
                "Supporting materials were excluded because the requested scope has unsupported material constraints."
              )
              break
            }
            const page = await search.searchSupportingMaterialHits({
              ...searchScope(input.scope),
              billIds: input.scope.billIds === undefined ? undefined : [...input.scope.billIds],
              eventIds: input.scope.meetingIds === undefined ? undefined : [...input.scope.meetingIds],
              limit: candidateLimit,
              mode: input.retrieval.mode,
              organizationIds: input.scope.organizationIds === undefined ? undefined : [...input.scope.organizationIds],
              query: input.question
            })
            candidateCount += page.items.length
            evidenceByProduct.push(
              projectSupportingMaterialSearchHits(page.items, input.retrieval.mode, apiBaseUrl).map(
                citationFromMaterialHit
              )
            )
            recordSearchModels(page.search, models, rerankedProducts, "supporting-material", input.retrieval.mode)
            break
          }
          case "amendment": {
            if (
              !supportsScope(input.scope, ["billIds", "jurisdictionIds", "personIds"]) ||
              (input.scope.billIds?.length ?? 0) > 1 ||
              (input.scope.jurisdictionIds?.length ?? 0) > 1 ||
              (input.scope.personIds?.length ?? 0) > 1
            ) {
              warnings.push("Amendments were excluded because the requested scope is not canonical-search compatible.")
              break
            }
            const page = await search.searchAmendments({
              billId: input.scope.billIds?.[0],
              jurisdictionId: input.scope.jurisdictionIds?.[0],
              limit: candidateLimit,
              mode: input.retrieval.mode,
              query: input.question,
              sponsorPersonId: input.scope.personIds?.[0]
            })
            candidateCount += page.items.length
            evidenceByProduct.push(page.items.map((item) => citationFromAmendment(item, apiBaseUrl)))
            recordSearchModels(page.search, models, rerankedProducts, "amendment", input.retrieval.mode)
            break
          }
        }
      }
      return {
        candidateCount,
        citations: fuseResearchEvidence(evidenceByProduct, input.retrieval.maxEvidence),
        models: uniqueModels(models),
        rerankedProducts,
        warnings
      }
    }
  }
}

export function createOpenRouterResearchAnswerGenerator(
  client: ResearchAnswerModelClient,
  configuredModel: string | undefined
): ResearchAnswerGenerator | undefined {
  if (configuredModel === undefined) {
    return undefined
  }
  return {
    async generate(input) {
      const result = await client.generateResearchAnswer({
        evidence: input.citations
          .map((citation) => `[${citation.id}] ${citation.title}\n${citation.snippet}\n${citation.sourceUrl}`)
          .join("\n\n"),
        model: configuredModel,
        question: `${input.question}\nRequested format: ${input.answerFormat}`
      })
      const parsed = generatedContentSchema.parse(JSON.parse(result.content))
      return {
        answer: parsed.answer,
        claims: parsed.claims,
        model: generationModelUsage(result.model)
      }
    }
  }
}

const identifierSchema = z.string().trim().min(1).max(256)
const identifierArraySchema = z
  .array(identifierSchema)
  .min(1)
  .max(25)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "ID arrays must contain unique values" })
    }
  })
const temporalBoundSchema = z.union([z.string().date(), z.string().datetime({ offset: true })])
const scopeSchema = z
  .object({
    billIds: identifierArraySchema.optional(),
    from: temporalBoundSchema.optional(),
    jurisdictionIds: identifierArraySchema.optional(),
    meetingIds: identifierArraySchema.optional(),
    organizationIds: identifierArraySchema.optional(),
    personIds: identifierArraySchema.optional(),
    sessionIds: identifierArraySchema.optional(),
    to: temporalBoundSchema.optional()
  })
  .strict()
const requestSchema = z
  .object({
    answerFormat: z.enum(["concise", "detailed", "timeline"]).optional(),
    question: z.string().trim().min(1).max(2_000),
    retrieval: z
      .object({
        maxEvidence: z.number().int().min(1).max(50).optional(),
        mode: z.enum(["hybrid", "lexical", "semantic"]),
        recordTypes: z
          .array(z.enum(["bill", "amendment", "passage", "supporting-material"]))
          .min(1)
          .max(4)
          .superRefine((values, context) => {
            if (new Set(values).size !== values.length) {
              context.addIssue({ code: "custom", message: "recordTypes must contain unique values" })
            }
          })
      })
      .strict(),
    scope: scopeSchema
  })
  .strict()
const generatedContentSchema = z.object({
  answer: z.string().trim().min(1).max(100_000),
  claims: z
    .array(
      z
        .object({
          citationIds: z.array(z.string().trim().min(1)).max(50),
          confidence: z.enum(["supported", "mixed", "insufficient"]),
          text: z.string().trim().min(1).max(20_000)
        })
        .strict()
    )
    .min(1)
    .max(100)
})

/**
 * Keeps provider output outside the HTTP handler. The boundary accepts only
 * persisted evidence citations, then verifies that generated claims cite that
 * exact set before anything is returned to a caller.
 */
export function createResearchAnswerService(
  retriever: ResearchEvidenceRetriever,
  generator: ResearchAnswerGenerator | undefined,
  options: Readonly<{ now?: () => Date; newId?: () => string }> = {}
): ResearchAnswerApi {
  const now = options.now ?? (() => new Date())
  const newId = options.newId ?? randomUUID
  return {
    async answer(input) {
      let retrieved: Awaited<ReturnType<ResearchEvidenceRetriever["retrieve"]>>
      try {
        retrieved = await retriever.retrieve(input)
      } catch (error) {
        if (error instanceof LegislationError) {
          throw error
        }
        throw new LegislationError("dependency_unavailable", "Research evidence retrieval is unavailable", {
          cause: error
        })
      }
      validateRetrievedEvidence(retrieved, input)
      const citations = [...retrieved.citations].slice(0, input.retrieval.maxEvidence)
      const retrieval: ResearchRetrieval = {
        candidateCount: retrieved.candidateCount,
        evidenceCount: citations.length,
        maxEvidence: input.retrieval.maxEvidence,
        mode: input.retrieval.mode,
        models: [...retrieved.models],
        recordTypes: [...input.retrieval.recordTypes],
        rerankedProducts: [...retrieved.rerankedProducts],
        rrfK: RESEARCH_RRF_K
      }
      const warnings = [...(retrieved.warnings ?? [])]
      if (citations.length === 0) {
        return {
          answer: "Insufficient evidence was found within the requested scope to answer this question.",
          citations: [],
          claims: [
            {
              citationIds: [],
              confidence: "insufficient",
              text: "The requested scope did not return supporting evidence."
            }
          ],
          generatedAt: now().toISOString(),
          id: newId(),
          question: input.question,
          retrieval,
          warnings: [...warnings, "No evidence matched the requested scope."]
        }
      }
      if (generator === undefined) {
        throw new LegislationError("dependency_unavailable", "Research answer generation is not configured")
      }
      let generated: Awaited<ReturnType<ResearchAnswerGenerator["generate"]>>
      try {
        generated = await generator.generate({
          answerFormat: input.answerFormat,
          citations,
          question: input.question
        })
      } catch (error) {
        if (error instanceof LegislationError) {
          throw error
        }
        throw new LegislationError("dependency_unavailable", "Research answer generation is unavailable", {
          cause: error
        })
      }
      validateGeneratedAnswer(generated, citations)
      return {
        answer: generated.answer.trim(),
        citations,
        claims: generated.claims.map((claim) => ({ ...claim, citationIds: [...claim.citationIds] })),
        generatedAt: now().toISOString(),
        id: newId(),
        question: input.question,
        retrieval: { ...retrieval, models: [...retrieval.models, generated.model] },
        warnings
      }
    }
  }
}

export function createUnavailableResearchAnswerApi(): ResearchAnswerApi {
  return {
    async answer() {
      throw new LegislationError("dependency_unavailable", "Research answer retrieval is not configured")
    }
  }
}

export function createResearchAnswerApiHandler(
  service: ResearchAnswerApi,
  options: Readonly<{ hasGlobalResearchPermission?: (identity: RequestIdentity | undefined) => boolean }> = {}
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/research/answers") {
      return false
    }
    try {
      assertAllowedQueryParameters(url, [])
      const body = requestSchema.parse(await readJsonBody(request))
      validateScope(body.scope, options.hasGlobalResearchPermission?.(getRequestContext()?.identity) === true)
      const answer = await service.answer({
        answerFormat: body.answerFormat ?? "concise",
        question: body.question,
        retrieval: {
          maxEvidence: body.retrieval.maxEvidence ?? 20,
          mode: body.retrieval.mode,
          recordTypes: body.retrieval.recordTypes
        },
        scope: body.scope
      })
      const payload = apiResource(request, answer)
      if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAXIMUM_RESEARCH_RESPONSE_BYTES) {
        throw new LegislationError(
          "payload_too_large",
          "Research response exceeds the allowed size; narrow the scope or evidence limit"
        )
      }
      sendApiJson(response, 200, payload)
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendApiError(
          request,
          response,
          new LegislationError("invalid_request", error.issues[0]?.message ?? "Invalid research answer request")
        )
      } else {
        sendApiError(request, response, error)
      }
    }
    return true
  }
}

function validateScope(scope: ResearchScope, hasGlobalPermission: boolean): void {
  if (!hasGlobalPermission && Object.values(scope).every((value) => value === undefined)) {
    throw new LegislationError("unprocessable", "Research scope requires at least one explicit constraint")
  }
  validateSearchTemporalRange(scope.from, scope.to, ["scope.from", "scope.to"])
}

function supportsScope(scope: ResearchScope, supported: readonly (keyof ResearchScope)[]): boolean {
  return Object.entries(scope).every(
    ([key, value]) => value === undefined || supported.includes(key as keyof ResearchScope)
  )
}

function searchScope(scope: ResearchScope) {
  const updatedRange = normalizeSearchTemporalRange(scope.from, scope.to, ["scope.from", "scope.to"])
  return {
    jurisdictionIds: scope.jurisdictionIds === undefined ? undefined : [...scope.jurisdictionIds],
    sessionIds: scope.sessionIds === undefined ? undefined : [...scope.sessionIds],
    ...updatedRange
  }
}

function billMatchesScope(value: unknown, scope: ResearchScope): boolean {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id : undefined
  const jurisdictionId = typeof record.jurisdictionId === "string" ? record.jurisdictionId : undefined
  const sessionId = typeof record.sessionId === "string" ? record.sessionId : undefined
  const updatedAt = record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt
  return (
    (scope.billIds === undefined || (id !== undefined && scope.billIds.includes(id))) &&
    (scope.jurisdictionIds === undefined ||
      (jurisdictionId !== undefined && scope.jurisdictionIds.includes(jurisdictionId))) &&
    (scope.sessionIds === undefined || (sessionId !== undefined && scope.sessionIds.includes(sessionId))) &&
    matchesTimeRange(updatedAt, scope.from, scope.to)
  )
}

function matchesTimeRange(value: unknown, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return false
  }
  const time = Date.parse(value)
  const { updatedFrom, updatedTo, updatedToExclusive } = normalizeSearchTemporalRange(from, to, [
    "scope.from",
    "scope.to"
  ])
  return (
    (updatedFrom === undefined || time >= updatedFrom.getTime()) &&
    (updatedTo === undefined || time <= updatedTo.getTime()) &&
    (updatedToExclusive === undefined || time < updatedToExclusive.getTime())
  )
}

function citationFromBillHit(hit: ReturnType<typeof projectBillSearchHits>[number]): ResearchCitation {
  const source = hit.sources[0]
  return {
    billId: hit.record.id,
    documentId: null,
    id: `evidence:bill:${hit.record.id}`,
    recordId: hit.record.id,
    recordType: "bill",
    sectionId: null,
    snippet: hit.match.snippet ?? hit.record.title,
    sourceUpdatedAt: researchTimestamp(source.sourceUpdatedAt),
    sourceUrl: source.sourceUrl,
    sources: hit.sources,
    title: hit.record.title
  }
}

function citationFromPassage(
  item: Awaited<ReturnType<PassageSearchApi["searchBillText"]>>["items"][number]
): ResearchCitation {
  const section = projectDocumentSectionRead(
    documentSectionReadFromPersistence(item.document, item.section),
    "http://unused"
  )
  const source = section.sources[0]
  return {
    billId: item.bill?.id ?? null,
    documentId: item.document.id,
    id: `evidence:passage:${section.id}`,
    recordId: section.id,
    recordType: "passage",
    sectionId: section.id,
    snippet: item.snippet ?? section.text.slice(0, 1_200),
    sourceUpdatedAt: researchTimestamp(source.sourceUpdatedAt),
    sourceUrl: source.sourceUrl,
    sources: section.sources,
    title: item.section.heading ?? item.document.title
  }
}

function citationFromMaterialHit(
  hit: ReturnType<typeof projectSupportingMaterialSearchHits>[number]
): ResearchCitation {
  const source = hit.sources[0]
  return {
    billId: hit.record.material.billIds[0] ?? null,
    documentId: null,
    id: `evidence:supporting-material:${hit.record.section.id}`,
    recordId: hit.recordId,
    recordType: "supporting-material",
    sectionId: hit.record.section.id,
    snippet: hit.match.snippet ?? hit.record.section.text.slice(0, 1_200),
    sourceUpdatedAt: researchTimestamp(source.sourceUpdatedAt),
    sourceUrl: source.sourceUrl,
    sources: hit.sources,
    title: hit.record.material.title
  }
}

function citationFromAmendment(value: unknown, apiBaseUrl: string): ResearchCitation {
  if (typeof value !== "object" || value === null) {
    throw new LegislationError("unprocessable", "Canonical amendment search returned an invalid record")
  }
  if (!isResearchSourceDocument(value)) {
    throw new LegislationError("unprocessable", "Canonical amendment search omitted source provenance")
  }
  const record = value
  const id = requiredResearchString(record, "id")
  const sourceUrl = requiredResearchString(record, "sourceUrl")
  const title =
    typeof record.title === "string" && record.title.trim().length > 0
      ? record.title
      : requiredResearchString(record, "printedIdentifier")
  let snippet = title
  if (typeof record.description === "string" && record.description.trim().length > 0) {
    snippet = record.description
  } else if (typeof record.purpose === "string" && record.purpose.trim().length > 0) {
    snippet = record.purpose
  }
  const sources = sourceProjectionContext(record, apiBaseUrl).sources
  const source = sources[0]
  return {
    billId: typeof record.billId === "string" ? record.billId : null,
    documentId: typeof record.documentId === "string" ? record.documentId : null,
    id: `evidence:amendment:${id}`,
    recordId: id,
    recordType: "amendment",
    sectionId: null,
    snippet: snippet.slice(0, 1_200),
    sourceUpdatedAt: researchTimestamp(source.sourceUpdatedAt),
    sourceUrl,
    sources,
    title
  }
}

function requiredResearchString(record: Readonly<Record<string, unknown>>, name: string): string {
  const value = record[name]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LegislationError("unprocessable", `Canonical amendment search omitted ${name}`)
  }
  return value
}

function researchTimestamp(value: Date | string | null): string | null {
  if (value === null) {
    return null
  }
  return value instanceof Date ? value.toISOString() : value
}

function isResearchSourceDocument(value: unknown): value is SourceDocument & Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.sourceUrl === "string" &&
    (record.createdAt instanceof Date || typeof record.createdAt === "string") &&
    (record.updatedAt instanceof Date || typeof record.updatedAt === "string") &&
    (record.sourceUpdatedAt === undefined ||
      record.sourceUpdatedAt === null ||
      record.sourceUpdatedAt instanceof Date ||
      typeof record.sourceUpdatedAt === "string") &&
    (record.upstreamIds === undefined || (typeof record.upstreamIds === "object" && record.upstreamIds !== null))
  )
}

function recordSearchModels(
  execution: SearchExecution | undefined,
  destination: ModelUsage[],
  rerankedProducts: Array<"bill" | "passage">,
  product: ResearchRecordType,
  mode: SearchMode
): void {
  const validated = searchExecution(execution, mode, product)
  destination.push(...validated.models)
  if (validated.isReranked && (product === "bill" || product === "passage")) {
    rerankedProducts.push(product)
  }
}

function generationModelUsage(model: string): ModelUsage {
  if (model.startsWith("openai/")) {
    return { dimensions: null, model, provider: "openai", purpose: "generation" }
  }
  if (model.startsWith("voyageai/")) {
    return { dimensions: null, model, provider: "voyageai", purpose: "generation" }
  }
  if (model.startsWith("cohere/")) {
    return { dimensions: null, model, provider: "cohere", purpose: "generation" }
  }
  throw new LegislationError("dependency_unavailable", "The configured model cannot be represented by the research API")
}

function uniqueModels(models: readonly ModelUsage[]): ModelUsage[] {
  const seen = new Set<string>()
  return models.filter((model) => {
    const key = `${model.provider}\u0000${model.model}\u0000${model.purpose}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const RESEARCH_RRF_K = 60

/**
 * Every compatible product contributes its independently ranked candidate
 * window. Identical canonical evidence accumulates reciprocal-rank score
 * across products; ties are resolved by stable evidence ID.
 */
export function fuseResearchEvidence(
  evidenceByProduct: readonly (readonly ResearchCitation[])[],
  maxEvidence: number
): ResearchCitation[] {
  const fused = new Map<string, { citation: ResearchCitation; score: number }>()
  for (const productEvidence of evidenceByProduct) {
    const productIds = new Set<string>()
    for (const [index, citation] of productEvidence.entries()) {
      if (productIds.has(citation.id)) {
        continue
      }
      productIds.add(citation.id)
      const existing = fused.get(citation.id)
      fused.set(citation.id, {
        citation: existing?.citation ?? citation,
        score: (existing?.score ?? 0) + 1 / (RESEARCH_RRF_K + index + 1)
      })
    }
  }
  return [...fused.values()]
    .sort((left, right) => right.score - left.score || left.citation.id.localeCompare(right.citation.id))
    .slice(0, maxEvidence)
    .map(({ citation }) => citation)
}

function validateRetrievedEvidence(
  retrieved: Awaited<ReturnType<ResearchEvidenceRetriever["retrieve"]>>,
  input: ResearchAnswerRequest
): void {
  if (
    !Number.isSafeInteger(retrieved.candidateCount) ||
    retrieved.candidateCount < 0 ||
    retrieved.candidateCount > 100
  ) {
    throw new LegislationError("unprocessable", "Research retrieval returned an invalid candidate count")
  }
  if (retrieved.citations.length > input.retrieval.maxEvidence) {
    throw new LegislationError("unprocessable", "Research retrieval exceeded the requested evidence limit")
  }
  if (new Set(retrieved.rerankedProducts).size !== retrieved.rerankedProducts.length) {
    throw new LegislationError("unprocessable", "Research retrieval repeated a reranked product")
  }
  for (const product of retrieved.rerankedProducts) {
    if (!input.retrieval.recordTypes.includes(product)) {
      throw new LegislationError("unprocessable", "Research retrieval reported reranking for an unrequested product")
    }
  }
  for (const citation of retrieved.citations) {
    if (
      !input.retrieval.recordTypes.includes(citation.recordType) ||
      citation.id.trim().length === 0 ||
      citation.recordId.trim().length === 0 ||
      citation.title.trim().length === 0 ||
      citation.snippet.trim().length === 0 ||
      !isAbsoluteUrl(citation.sourceUrl) ||
      !Array.isArray(citation.sources) ||
      citation.sources.length === 0 ||
      !citation.sources.every(isResearchSourceReference) ||
      (citation.sourceUpdatedAt !== null && Number.isNaN(Date.parse(citation.sourceUpdatedAt)))
    ) {
      throw new LegislationError("unprocessable", "Research retrieval returned invalid evidence provenance")
    }
  }
  for (const model of retrieved.models) {
    if (
      model.model.trim().length === 0 ||
      (model.provider !== "cohere" && model.provider !== "openai" && model.provider !== "voyageai") ||
      !["embedding", "generation", "reranking"].includes(model.purpose) ||
      (model.dimensions !== null && (!Number.isSafeInteger(model.dimensions) || model.dimensions < 0))
    ) {
      throw new LegislationError("unprocessable", "Research retrieval returned invalid model metadata")
    }
  }
}

function isResearchSourceReference(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  const provider = Reflect.get(value, "provider")
  const sourceUrl = Reflect.get(value, "sourceUrl")
  const sourceUpdatedAt = Reflect.get(value, "sourceUpdatedAt")
  const retrievedAt = Reflect.get(value, "retrievedAt")
  const isOfficial = Reflect.get(value, "isOfficial")
  return (
    typeof provider === "string" &&
    provider.trim().length > 0 &&
    typeof sourceUrl === "string" &&
    isAbsoluteUrl(sourceUrl) &&
    (sourceUpdatedAt === null || isRfc3339Timestamp(sourceUpdatedAt)) &&
    isRfc3339Timestamp(retrievedAt) &&
    typeof isOfficial === "boolean"
  )
}

function validateGeneratedAnswer(
  generated: Awaited<ReturnType<ResearchAnswerGenerator["generate"]>>,
  citations: readonly ResearchCitation[]
): void {
  if (generated.answer.trim().length === 0 || generated.answer.length > 100_000 || generated.claims.length === 0) {
    throw new LegislationError("unprocessable", "Research generation returned an invalid answer")
  }
  const knownCitationIds = new Set(citations.map((citation) => citation.id))
  for (const claim of generated.claims) {
    if (
      claim.text.trim().length === 0 ||
      claim.citationIds.length === 0 ||
      new Set(claim.citationIds).size !== claim.citationIds.length ||
      claim.citationIds.some((citationId) => !knownCitationIds.has(citationId)) ||
      (claim.confidence !== "supported" && claim.confidence !== "mixed" && claim.confidence !== "insufficient")
    ) {
      throw new LegislationError(
        "unprocessable",
        "Research generation returned a claim without valid evidence citations"
      )
    }
  }
  const model = generated.model
  if (
    model.model.trim().length === 0 ||
    (model.provider !== "cohere" && model.provider !== "openai" && model.provider !== "voyageai") ||
    model.purpose !== "generation" ||
    model.dimensions !== null
  ) {
    throw new LegislationError("unprocessable", "Research generation returned invalid model metadata")
  }
}

function isAbsoluteUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "http:" || new URL(value).protocol === "https:"
  } catch {
    return false
  }
}
