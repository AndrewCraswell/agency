import { describe, expect, it } from "vitest"
import {
  EMBEDDING_ROUTES,
  EMBEDDING_QUERY_ROUTES,
  EMBEDDING_ROUTE_MINIMUM_NDCG_IMPROVEMENT,
  EMBEDDING_ROUTE_PRODUCTS,
  REGULATORY_EMBEDDING_ROUTE_PRODUCTS,
  configuredRegulatoryEmbeddingRoute,
  embeddingQueryRouteFor,
  embeddingRouteFor,
  regulatoryEmbeddingRouteForModel
} from "./embedding-routing"

describe("embedding routing contract", () => {
  it("pins every searchable product to one model space and storage table", () => {
    expect(Object.keys(EMBEDDING_ROUTES).toSorted()).toEqual([...EMBEDDING_ROUTE_PRODUCTS].toSorted())
    expect(embeddingRouteFor("bill")).toMatchObject({
      dimensions: 1024,
      documentInputType: "document",
      model: "voyageai/voyage-4",
      provider: "voyageai",
      queryInputType: "query",
      storageTable: "bill_embeddings"
    })
    expect(embeddingRouteFor("document-section")).toMatchObject({
      dimensions: 1536,
      model: "openai/text-embedding-3-small",
      provider: "openai",
      storageTable: "document_section_embeddings"
    })
    const amendment = embeddingRouteFor("structured-amendment")
    expect(amendment).toMatchObject({
      dimensions: 1536,
      model: "openai/text-embedding-3-small",
      storageTable: "amendment_embeddings"
    })
    const supportingMaterial = embeddingRouteFor("supporting-material-section")
    expect(supportingMaterial).toMatchObject({
      dimensions: 1024,
      model: "voyageai/voyage-4",
      storageTable: "supporting_material_section_embeddings"
    })
  })

  it("shares the tested document route with document-backed amendments", () => {
    const document = embeddingRouteFor("document-section")
    const amendmentDocument = embeddingRouteFor("document-backed-amendment-section")
    expect(amendmentDocument).toMatchObject({
      dimensions: document.dimensions,
      embeddingInput: document.embeddingInput,
      embeddingInputContract: document.embeddingInputContract,
      model: document.model,
      storageTable: document.storageTable
    })
  })

  it("keeps both regulatory candidates explicit until trusted configuration selects one", () => {
    expect(REGULATORY_EMBEDDING_ROUTE_PRODUCTS).toEqual([
      "regulatory-passage-openai-small",
      "regulatory-passage-voyage-4"
    ])
    expect(regulatoryEmbeddingRouteForModel("openai/text-embedding-3-small")).toMatchObject({
      dimensions: 1536,
      embeddingInputContract: "legal-passage-context-text",
      storageTable: "legal_openai_small_embeddings"
    })
    expect(regulatoryEmbeddingRouteForModel("voyageai/voyage-4")).toMatchObject({
      dimensions: 1024,
      documentInputType: "document",
      queryInputType: "query",
      storageTable: "legal_voyage_4_embeddings"
    })
    expect(configuredRegulatoryEmbeddingRoute(undefined)).toBeNull()
    expect(configuredRegulatoryEmbeddingRoute(" ")).toBeNull()
    expect(configuredRegulatoryEmbeddingRoute("voyageai/voyage-4")).toMatchObject({ dimensions: 1024 })
    expect(() => configuredRegulatoryEmbeddingRoute("caller/model")).toThrow(
      "Unsupported configured regulatory embedding model"
    )
  })

  it("pins query dispatch, merge behavior, selective reranking, and the promotion threshold", () => {
    expect(EMBEDDING_ROUTE_MINIMUM_NDCG_IMPROVEMENT).toBe(0.02)
    expect(Object.keys(EMBEDDING_QUERY_ROUTES).toSorted()).toEqual([
      "search_amendments",
      "search_bill_text",
      "search_bills",
      "search_supporting_materials"
    ])
    expect(embeddingQueryRouteFor("search_bills").rerank).toEqual({
      candidateLimit: 25,
      inputMaximumCharacters: 4000,
      model: "cohere/rerank-v3.5",
      provider: "cohere"
    })
    expect(embeddingQueryRouteFor("search_bill_text").rerank).toEqual(embeddingQueryRouteFor("search_bills").rerank)
    expect(embeddingQueryRouteFor("search_amendments")).toEqual({
      candidateLimit: 25,
      candidateMerge: "reciprocal-rank-fusion",
      queryEmbeddingProduct: "structured-amendment",
      searchedProducts: ["structured-amendment", "document-backed-amendment-section"]
    })
    expect(embeddingQueryRouteFor("search_supporting_materials").rerank).toBeUndefined()
  })
})
