import { describe, expect, it } from "vitest"
import {
  EMBEDDING_ROUTES,
  EMBEDDING_ROUTE_MINIMUM_NDCG_IMPROVEMENT,
  EMBEDDING_ROUTE_PRODUCTS,
  embeddingRouteFor
} from "./embedding-routing.js"

describe("embedding routing contract", () => {
  it("pins every searchable product to one model space and storage table", () => {
    expect(Object.keys(EMBEDDING_ROUTES).toSorted()).toEqual([...EMBEDDING_ROUTE_PRODUCTS].toSorted())
    expect(embeddingRouteFor("bill")).toMatchObject({
      dimensions: 1024,
      documentInputType: "document",
      model: "voyageai/voyage-4",
      queryInputType: "query",
      storageTable: "bill_embeddings"
    })
    expect(embeddingRouteFor("document-section")).toMatchObject({
      dimensions: 1536,
      model: "openai/text-embedding-3-small",
      storageTable: "document_section_embeddings"
    })
    const amendment = embeddingRouteFor("structured-amendment")
    expect(amendment).toMatchObject({
      dimensions: 1536,
      model: "openai/text-embedding-3-small",
      storageTable: "amendment_embeddings"
    })
    expect(amendment.rerank).toBeUndefined()
    const supportingMaterial = embeddingRouteFor("supporting-material-section")
    expect(supportingMaterial).toMatchObject({
      dimensions: 1024,
      model: "voyageai/voyage-4",
      storageTable: "supporting_material_section_embeddings"
    })
    expect(supportingMaterial.rerank).toBeUndefined()
  })

  it("shares the tested document route with document-backed amendments", () => {
    const document = embeddingRouteFor("document-section")
    const amendmentDocument = embeddingRouteFor("document-backed-amendment-section")
    expect(amendmentDocument).toMatchObject({
      dimensions: document.dimensions,
      embeddingInput: document.embeddingInput,
      embeddingInputContract: document.embeddingInputContract,
      model: document.model,
      rerank: document.rerank,
      storageTable: document.storageTable
    })
  })

  it("pins the selective rerank boundary and promotion threshold", () => {
    expect(EMBEDDING_ROUTE_MINIMUM_NDCG_IMPROVEMENT).toBe(0.02)
    expect(embeddingRouteFor("bill").rerank).toEqual({
      candidateLimit: 25,
      inputMaximumCharacters: 4000,
      model: "cohere/rerank-v3.5"
    })
    expect(embeddingRouteFor("document-section").rerank).toEqual(embeddingRouteFor("bill").rerank)
  })
})
