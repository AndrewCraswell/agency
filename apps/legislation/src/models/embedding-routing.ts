export const EMBEDDING_ROUTE_PRODUCTS = [
  "bill",
  "document-section",
  "structured-amendment",
  "document-backed-amendment-section",
  "supporting-material-section"
] as const

export type EmbeddingRouteProduct = (typeof EMBEDDING_ROUTE_PRODUCTS)[number]

interface RerankRoute {
  candidateLimit: 25
  inputMaximumCharacters: 4_000
  model: "cohere/rerank-v3.5"
}

export interface EmbeddingRoute {
  dimensions: 1_024 | 1_536
  documentInputType?: "document"
  embeddingInput: readonly string[]
  embeddingInputContract: string
  model: "openai/text-embedding-3-small" | "voyageai/voyage-4"
  product: EmbeddingRouteProduct
  queryInputType?: "query"
  rerank?: RerankRoute
  storageTable:
    | "amendment_embeddings"
    | "bill_embeddings"
    | "document_section_embeddings"
    | "supporting_material_section_embeddings"
}

const COHERE_RERANK = {
  candidateLimit: 25,
  inputMaximumCharacters: 4_000,
  model: "cohere/rerank-v3.5"
} as const

const OPENAI_SMALL = {
  dimensions: 1_536,
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
    rerank: COHERE_RERANK,
    storageTable: "bill_embeddings"
  },
  "document-backed-amendment-section": {
    ...OPENAI_SMALL,
    embeddingInput: ["heading", "text"],
    embeddingInputContract: "document-section-heading-text",
    product: "document-backed-amendment-section",
    rerank: COHERE_RERANK,
    storageTable: "document_section_embeddings"
  },
  "document-section": {
    ...OPENAI_SMALL,
    embeddingInput: ["heading", "text"],
    embeddingInputContract: "document-section-heading-text",
    product: "document-section",
    rerank: COHERE_RERANK,
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
  }
} as const satisfies Record<EmbeddingRouteProduct, EmbeddingRoute>

export const EMBEDDING_ROUTE_MINIMUM_NDCG_IMPROVEMENT = 0.02

export function embeddingRouteFor(product: EmbeddingRouteProduct): EmbeddingRoute {
  return EMBEDDING_ROUTES[product]
}
