import { EMBEDDING_ROUTES, type EmbeddingRoute } from "@repo/legislation-core/embeddings/embedding-routing"
import { validateEmbeddingTokenBudget } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import {
  MAX_EMBEDDING_INPUT_CHARACTERS,
  OpenRouterEmbeddingClient
} from "@repo/legislation-core/embeddings/openrouter-embeddings"
import { rankingMetrics } from "@repo/legislation-core/evaluation/embedding"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { embedCachedRegulatoryInputs } from "./embedding-cache.js"

const text = z
  .string()
  .min(1)
  .max(MAX_EMBEDDING_INPUT_CHARACTERS)
  .refine((value) => value.trim().length > 0 && value.isWellFormed())
export const regulatoryEmbeddingSmokeSchema = z.strictObject({
  records: z
    .array(z.strictObject({ id: z.string().min(1), versionId: z.string().min(1), input: text }))
    .min(2)
    .max(512),
  queries: z
    .array(
      z
        .strictObject({
          id: z.string().min(1),
          input: text,
          relevantIds: z.array(z.string().min(1)),
          answerability: z.literal("no_answer").optional()
        })
        .refine(
          (query) =>
            query.answerability === "no_answer" ? query.relevantIds.length === 0 : query.relevantIds.length > 0,
          "No-answer intent must be explicit and cannot include relevant passage IDs"
        )
    )
    .min(1)
    .max(64)
})

/** Bounded diagnostic only. It cannot promote a model or write production embeddings. */
export async function compareRegulatoryEmbeddingSmoke(
  input: unknown,
  options: { apiKey: string; fetch?: typeof fetch; cacheDirectory?: string }
) {
  const manifest = regulatoryEmbeddingSmokeSchema.parse(input)
  const ids = new Set(manifest.records.map((record) => record.id))
  invariant(ids.size === manifest.records.length, "embedding_smoke_duplicate_record")
  invariant(
    new Set(manifest.queries.map((query) => query.id)).size === manifest.queries.length,
    "embedding_smoke_duplicate_query"
  )
  invariant(
    manifest.queries.every(
      (query) =>
        new Set(query.relevantIds).size === query.relevantIds.length && query.relevantIds.every((id) => ids.has(id))
    ),
    "embedding_smoke_invalid_judgments"
  )
  const configurations: EmbeddingRoute[] = [EMBEDDING_ROUTES["document-section"], EMBEDDING_ROUTES.bill]
  const qualification = []
  // Qualify the same complete manifest for both routes before cache writes or any provider request.
  // Batching matches execution, so aggregate token limits are checked as well as individual inputs.
  for (const route of configurations) {
    const records = []
    let tokenizerId = ""
    for (let offset = 0; offset < manifest.records.length; offset += 64) {
      const batch = manifest.records.slice(offset, offset + 64)
      const checked = await validateEmbeddingTokenBudget(
        route.model,
        batch.map((record) => record.input)
      )
      tokenizerId = checked.tokenizerId
      records.push(
        ...batch.map((record, index) => ({
          id: record.id,
          versionId: record.versionId,
          inputHash: digest(record.input),
          tokenCount: checked.counts[index]
        }))
      )
    }
    const checkedQueries = await validateEmbeddingTokenBudget(
      route.model,
      manifest.queries.map((query) => query.input)
    )
    invariant(checkedQueries.tokenizerId === tokenizerId, "embedding_smoke_tokenizer_changed")
    qualification.push({
      model: route.model,
      tokenizerId,
      records,
      queries: manifest.queries.map((query, index) => ({
        id: query.id,
        inputHash: digest(query.input),
        tokenCount: checkedQueries.counts[index]
      }))
    })
  }
  const results = []
  for (const route of configurations) {
    const client = new OpenRouterEmbeddingClient({
      apiKey: options.apiKey,
      fetch: options.fetch,
      route,
      maximumAttempts: 1
    })
    const started = performance.now()
    // Shared-client validation remains in place; the single attempt keeps this diagnostic's retry cost bounded.
    const documents: { embeddings: number[][]; totalTokens: number | undefined } = { embeddings: [], totalTokens: 0 }
    let cacheHits = 0
    for (let offset = 0; offset < manifest.records.length; offset += 64) {
      const batch = await embedCachedRegulatoryInputs({
        client,
        route,
        directory: options.cacheDirectory,
        texts: manifest.records.slice(offset, offset + 64).map((record) => record.input),
        inputType: "document"
      })
      cacheHits += batch.cacheHits
      documents.embeddings.push(...batch.embeddings)
      documents.totalTokens =
        documents.totalTokens !== undefined && batch.totalTokens !== undefined
          ? documents.totalTokens + batch.totalTokens
          : undefined
    }
    const queries = await embedCachedRegulatoryInputs({
      client,
      route,
      directory: options.cacheDirectory,
      texts: manifest.queries.map((query) => query.input),
      inputType: "query"
    })
    cacheHits += queries.cacheHits
    const normalize = (vectors: number[][]) =>
      vectors.map((vector) => {
        invariant(vector.length === route.dimensions && vector.every(Number.isFinite), "embedding_smoke_invalid_vector")
        const norm = Math.hypot(...vector)
        invariant(Number.isFinite(norm) && norm > 0, "embedding_smoke_zero_vector")
        return vector.map((value) => value / norm)
      })
    const documentVectors = normalize(documents.embeddings)
    const queryVectors = normalize(queries.embeddings)
    const scores = manifest.queries.map((query, index) => {
      const vector = queryVectors[index]
      invariant(vector, "embedding_smoke_missing_query")
      const ranked = documentVectors
        .map((candidate, candidateIndex) => {
          const record = manifest.records[candidateIndex]
          invariant(record, "embedding_smoke_missing_document")
          return {
            id: record.id,
            versionId: record.versionId,
            score: candidate.reduce((sum, value, dimension) => sum + value * (vector[dimension] ?? 0), 0)
          }
        })
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      return {
        queryId: query.id,
        ranked,
        answerability: query.relevantIds.length === 0 ? "no_answer" : "answerable",
        metrics:
          query.relevantIds.length === 0
            ? null
            : rankingMetrics(
                ranked.map((row) => row.id),
                query.relevantIds.map((id) => ({ id, cohort: "control", relevance: 3 }))
              )
      }
    })
    results.push({
      model: route.model,
      dimensions: route.dimensions,
      cacheHits,
      elapsedMs: performance.now() - started,
      documentInputType: route.documentInputType ?? null,
      queryInputType: route.queryInputType ?? null,
      tokens:
        documents.totalTokens !== undefined && queries.totalTokens !== undefined
          ? documents.totalTokens + queries.totalTokens
          : null,
      metrics: client.metrics,
      queries: scores
    })
  }
  return {
    manifestHash: digest(JSON.stringify(manifest)),
    qualification,
    results,
    modelSelected: false,
    bulkEmbeddingAuthorized: false,
    heldOutEvaluationComplete: false,
    noAnswerEvaluationComplete: false,
    apiMcpCanaryComplete: false,
    canonicalWrites: false
  }
}
