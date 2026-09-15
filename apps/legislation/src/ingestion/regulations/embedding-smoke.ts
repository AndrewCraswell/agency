import invariant from "tiny-invariant"
import { z } from "zod"
import { rankingMetrics } from "../../evaluation/embedding.js"
import { EMBEDDING_ROUTES, type EmbeddingRoute } from "../../models/embedding-routing.js"
import { MAX_EMBEDDING_INPUT_CHARACTERS, OpenRouterEmbeddingClient } from "../../models/openrouter-embeddings.js"
import { digest } from "./contracts.js"
import { embedCachedRegulatoryInputs } from "./embedding-cache.js"

const text = z
  .string()
  .min(1)
  .max(MAX_EMBEDDING_INPUT_CHARACTERS)
  .refine((value) => value.trim().length > 0)
export const regulatoryEmbeddingSmokeSchema = z.strictObject({
  records: z
    .array(z.strictObject({ id: z.string().min(1), versionId: z.string().min(1), input: text }))
    .min(2)
    .max(512),
  queries: z
    .array(z.strictObject({ id: z.string().min(1), input: text, relevantIds: z.array(z.string().min(1)).min(1) }))
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
  const results = []
  for (const route of configurations) {
    const client = new OpenRouterEmbeddingClient({
      apiKey: options.apiKey,
      fetch: options.fetch,
      route,
      maximumAttempts: 1
    })
    const started = performance.now()
    // Inputs were bounded before this client; one attempt forbids its oversized-input shortening retry.
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
        metrics: rankingMetrics(
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
    results,
    modelSelected: false,
    bulkEmbeddingAuthorized: false,
    heldOutEvaluationComplete: false,
    apiMcpCanaryComplete: false,
    canonicalWrites: false
  }
}
