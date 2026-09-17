export const EMBEDDING_ROUTE_PRODUCTS = [
  "bill",
  "document-section",
  "structured-amendment",
  "document-backed-amendment-section",
  "supporting-material-section",
  "regulatory-passage-openai-small",
  "regulatory-passage-voyage-4"
] as const

export type EmbeddingRouteProduct = (typeof EMBEDDING_ROUTE_PRODUCTS)[number]

export interface RerankRoute {
  candidateLimit: 25
  inputMaximumCharacters: 4_000
  model: "cohere/rerank-v3.5"
}

export interface EmbeddingRoute {
  dimensions: 1_024 | 1_536
  dimensionsParameter?: true
  documentInputType?: "document"
  embeddingInput: readonly string[]
  embeddingInputContract: string
  model: "openai/text-embedding-3-small" | "voyageai/voyage-4"
  product: EmbeddingRouteProduct
  queryInputType?: "query"
  storageTable:
    | "amendment_embeddings"
    | "bill_embeddings"
    | "document_section_embeddings"
    | "legal_openai_small_embeddings"
    | "legal_voyage_4_embeddings"
    | "supporting_material_section_embeddings"
}

export type EmbeddingSearchTool =
  | "search_amendments"
  | "search_bill_text"
  | "search_bills"
  | "search_supporting_materials"

export interface EmbeddingQueryRoute {
  candidateLimit: 25
  candidateMerge: "reciprocal-rank-fusion" | "single-index"
  queryEmbeddingProduct: EmbeddingRouteProduct
  rerank?: RerankRoute
  searchedProducts: readonly EmbeddingRouteProduct[]
}

const COHERE_RERANK = {
  candidateLimit: 25,
  inputMaximumCharacters: 4_000,
  model: "cohere/rerank-v3.5"
} as const

const OPENAI_SMALL = {
  dimensions: 1_536,
  dimensionsParameter: true,
  model: "openai/text-embedding-3-small"
} as const

const VOYAGE_4 = {
  dimensions: 1_024,
  documentInputType: "document",
  model: "voyageai/voyage-4",
  queryInputType: "query"
} as const

/**
 * Canonical canary routing contract for both indexing and query-time search.
 * Stored embedding rows must retain the model and input-contract values so a
 * query can never compare vectors created in different model spaces.
 */
export const EMBEDDING_ROUTES = {
  bill: {
    ...VOYAGE_4,
    embeddingInput: ["title", "summary", "subjects"],
    embeddingInputContract: "bill-title-summary-subjects",
    product: "bill",
    storageTable: "bill_embeddings"
  },
  "document-backed-amendment-section": {
    ...OPENAI_SMALL,
    embeddingInput: ["heading", "text"],
    embeddingInputContract: "document-section-heading-text",
    product: "document-backed-amendment-section",
    storageTable: "document_section_embeddings"
  },
  "document-section": {
    ...OPENAI_SMALL,
    embeddingInput: ["heading", "text"],
    embeddingInputContract: "document-section-heading-text",
    product: "document-section",
    storageTable: "document_section_embeddings"
  },
  "structured-amendment": {
    ...OPENAI_SMALL,
    embeddingInput: ["purpose", "description", "printedIdentifierFallback"],
    embeddingInputContract: "amendment-purpose-description-identifier-fallback",
    product: "structured-amendment",
    storageTable: "amendment_embeddings"
  },
  "supporting-material-section": {
    ...VOYAGE_4,
    embeddingInput: ["heading", "text"],
    embeddingInputContract: "supporting-material-section-heading-text",
    product: "supporting-material-section",
    storageTable: "supporting_material_section_embeddings"
  },
  "regulatory-passage-openai-small": {
    ...OPENAI_SMALL,
    embeddingInput: ["context", "passage"],
    embeddingInputContract: "legal-passage-context-text",
    product: "regulatory-passage-openai-small",
    storageTable: "legal_openai_small_embeddings"
  },
  "regulatory-passage-voyage-4": {
    ...VOYAGE_4,
    embeddingInput: ["context", "passage"],
    embeddingInputContract: "legal-passage-context-text",
    product: "regulatory-passage-voyage-4",
    storageTable: "legal_voyage_4_embeddings"
  }
} as const satisfies Record<EmbeddingRouteProduct, EmbeddingRoute>

export const REGULATORY_EMBEDDING_ROUTE_PRODUCTS = [
  "regulatory-passage-openai-small",
  "regulatory-passage-voyage-4"
] as const satisfies readonly EmbeddingRouteProduct[]

export type RegulatoryEmbeddingModel =
  (typeof EMBEDDING_ROUTES)[(typeof REGULATORY_EMBEDDING_ROUTE_PRODUCTS)[number]]["model"]

/** Internal candidate lookup. Public search requests never select an embedding model. */
export function regulatoryEmbeddingRouteForModel(model: RegulatoryEmbeddingModel): EmbeddingRoute {
  const product = REGULATORY_EMBEDDING_ROUTE_PRODUCTS.find((candidate) => EMBEDDING_ROUTES[candidate].model === model)
  if (!product) {
    throw new Error(`Unsupported regulatory embedding model: ${model}`)
  }
  return EMBEDDING_ROUTES[product]
}

/** Resolve only trusted server configuration; an absent selection keeps semantic serving disabled. */
export function configuredRegulatoryEmbeddingRoute(model: string | undefined): EmbeddingRoute | null {
  if (model === undefined || model.trim().length === 0) {
    return null
  }
  if (model !== "openai/text-embedding-3-small" && model !== "voyageai/voyage-4") {
    throw new Error(`Unsupported configured regulatory embedding model: ${model}`)
  }
  return regulatoryEmbeddingRouteForModel(model)
}

/**
 * Canonical query-time dispatch. Reranking belongs to the search surface, not
 * the stored vector, because the same document-backed amendment vectors are
 * reranked in passage search but rank-fused without reranking in amendment
 * search.
 */
export const EMBEDDING_QUERY_ROUTES = {
  search_amendments: {
    candidateLimit: 25,
    candidateMerge: "reciprocal-rank-fusion",
    queryEmbeddingProduct: "structured-amendment",
    searchedProducts: ["structured-amendment", "document-backed-amendment-section"]
  },
  search_bill_text: {
    candidateLimit: 25,
    candidateMerge: "single-index",
    queryEmbeddingProduct: "document-section",
    rerank: COHERE_RERANK,
    searchedProducts: ["document-section", "document-backed-amendment-section"]
  },
  search_bills: {
    candidateLimit: 25,
    candidateMerge: "single-index",
    queryEmbeddingProduct: "bill",
    rerank: COHERE_RERANK,
    searchedProducts: ["bill"]
  },
  search_supporting_materials: {
    candidateLimit: 25,
    candidateMerge: "single-index",
    queryEmbeddingProduct: "supporting-material-section",
    searchedProducts: ["supporting-material-section"]
  }
} as const satisfies Record<EmbeddingSearchTool, EmbeddingQueryRoute>

export const EMBEDDING_ROUTE_MINIMUM_NDCG_IMPROVEMENT = 0.02

export function embeddingRouteFor(product: EmbeddingRouteProduct): EmbeddingRoute {
  return EMBEDDING_ROUTES[product]
}

export function embeddingQueryRouteFor(tool: EmbeddingSearchTool): EmbeddingQueryRoute {
  return EMBEDDING_QUERY_ROUTES[tool]
}
