import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  embeddingQueryRouteFor,
  embeddingRouteFor,
  type EmbeddingRoute,
  type EmbeddingSearchTool,
  type RerankRoute
} from "@repo/legislation-core/embeddings/embedding-routing"

const searchTools = {
  amendment: "search_amendments",
  bill: "search_bills",
  passage: "search_bill_text",
  "supporting-material": "search_supporting_materials"
} as const satisfies Record<string, EmbeddingSearchTool>

export type SearchProduct = keyof typeof searchTools
export type SearchMode = "hybrid" | "lexical" | "semantic"
export type SearchExecution = Readonly<{ isReranked: boolean; models: readonly unknown[] }>
export type SearchModel = Readonly<{
  dimensions: EmbeddingRoute["dimensions"] | null
  model: EmbeddingRoute["model"] | RerankRoute["model"]
  provider: EmbeddingRoute["provider"] | RerankRoute["provider"]
  purpose: "embedding" | "reranking"
}>

/** Expand actual execution facts, never configured-but-unused models. */
export function searchExecution(
  execution: SearchExecution | undefined,
  mode: SearchMode,
  product: SearchProduct
): Readonly<{ isReranked: boolean; models: readonly SearchModel[] }> {
  const rawModels = execution?.models ?? []
  const isReranked = execution?.isReranked ?? false
  if (mode === "lexical") {
    if (isReranked || rawModels.length > 0) {
      throw new LegislationError("unprocessable", "Lexical search must not report model use or reranking")
    }
    return { isReranked: false, models: [] }
  }

  const route = embeddingQueryRouteFor(searchTools[product])
  const embedding = embeddingRouteFor(route.queryEmbeddingProduct)
  const models = rawModels.map((value): SearchModel => {
    if (typeof value !== "object" || value === null || !("model" in value) || !("purpose" in value)) {
      throw new LegislationError("unprocessable", "Search model metadata is invalid")
    }
    let model: SearchModel
    if (value.model === embedding.model && value.purpose === "embedding") {
      model = {
        dimensions: embedding.dimensions,
        model: embedding.model,
        provider: embedding.provider,
        purpose: "embedding"
      }
    } else if (route.rerank !== undefined && value.model === route.rerank.model && value.purpose === "reranking") {
      model = {
        dimensions: null,
        model: route.rerank.model,
        provider: route.rerank.provider,
        purpose: "reranking"
      }
    } else {
      throw new LegislationError(
        "unprocessable",
        `${product} search model metadata does not match the configured route`
      )
    }
    if (
      ("dimensions" in value && value.dimensions !== model.dimensions) ||
      ("provider" in value && value.provider !== model.provider)
    ) {
      throw new LegislationError("unprocessable", "Search model metadata contradicts the configured route")
    }
    return model
  })
  const embeddings = models.filter((model) => model.purpose === "embedding")
  const rerankers = models.filter((model) => model.purpose === "reranking")
  if (embeddings.length !== 1 || rerankers.length > 1 || isReranked !== (rerankers.length === 1)) {
    throw new LegislationError("unprocessable", `${product} ${mode} search model execution metadata is incomplete`)
  }
  return { isReranked, models }
}
