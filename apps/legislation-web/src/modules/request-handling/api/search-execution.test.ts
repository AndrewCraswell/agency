import { LegislationError } from "@repo/legislation-core/domain/errors"
import * as routing from "@repo/legislation-core/embeddings/embedding-routing"
import { afterEach, describe, expect, it, vi } from "vitest"
import { searchExecution, type SearchProduct } from "./search-execution"

const products = [
  { product: "bill", model: "voyageai/voyage-4", dimensions: 1024, provider: "voyageai", mayRerank: true },
  { product: "passage", model: "openai/text-embedding-3-small", dimensions: 1536, provider: "openai", mayRerank: true },
  {
    product: "amendment",
    model: "openai/text-embedding-3-small",
    dimensions: 1536,
    provider: "openai",
    mayRerank: false
  },
  {
    product: "supporting-material",
    model: "voyageai/voyage-4",
    dimensions: 1024,
    provider: "voyageai",
    mayRerank: false
  }
] as const satisfies readonly {
  product: SearchProduct
  model: string
  dimensions: number
  provider: string
  mayRerank: boolean
}[]
const reranker = { model: "cohere/rerank-v3.5", purpose: "reranking" } as const

afterEach(() => {
  vi.restoreAllMocks()
})

describe.each(products)("$product search execution", ({ product, model, dimensions, provider }) => {
  const embedding = { model, purpose: "embedding" } as const

  it.each(["semantic", "hybrid"] as const)("expands only actual %s execution", (mode) => {
    const execution = { isReranked: false, models: [embedding] }
    const expanded = { isReranked: false, models: [{ ...embedding, dimensions, provider }] }
    expect(searchExecution(execution, mode, product)).toEqual(expanded)
    expect(searchExecution(expanded, mode, product)).toEqual(expanded)
  })

  it("keeps lexical execution empty, including absent optional execution facts", () => {
    expect(searchExecution(undefined, "lexical", product)).toEqual({ isReranked: false, models: [] })
    expect(searchExecution({ isReranked: false, models: [] }, "lexical", product)).toEqual({
      isReranked: false,
      models: []
    })
    expect(() => searchExecution({ isReranked: false, models: [embedding] }, "lexical", product)).toThrow(
      LegislationError
    )
    expect(() => searchExecution({ isReranked: true, models: [] }, "lexical", product)).toThrow(LegislationError)
  })

  it("rejects missing, duplicate or contradictory execution facts", () => {
    const invalid = [
      undefined,
      { isReranked: false, models: [] },
      { isReranked: false, models: [embedding, embedding] },
      { isReranked: true, models: [embedding] },
      { isReranked: false, models: [embedding, reranker] },
      { isReranked: true, models: [embedding, reranker, reranker] },
      { isReranked: true, models: [reranker] }
    ]
    for (const execution of invalid) {
      expect(() => searchExecution(execution, "semantic", product)).toThrow(LegislationError)
    }
  })

  it.each([
    null,
    "voyageai/voyage-4",
    {},
    { purpose: "embedding" },
    { model: "openai/unapproved-embedding", purpose: "embedding" },
    { model: "openai/text-embedding-3-large", purpose: "embedding" }
  ])("rejects malformed or unapproved metadata: %j", (value) => {
    expect(() => searchExecution({ isReranked: false, models: [value] }, "hybrid", product)).toThrow(LegislationError)
  })

  it("rejects the other model space, wrong purpose, provider and dimensions", () => {
    const invalid = [
      { ...embedding, model: model === "voyageai/voyage-4" ? "openai/text-embedding-3-small" : "voyageai/voyage-4" },
      { ...embedding, purpose: "generation" },
      { ...embedding, purpose: "reranking" },
      { ...embedding, provider: "cohere" },
      { ...embedding, dimensions: null },
      { ...embedding, dimensions: dimensions === 1024 ? 1536 : 1024 }
    ]
    for (const value of invalid) {
      expect(() => searchExecution({ isReranked: false, models: [value] }, "semantic", product)).toThrow(
        LegislationError
      )
    }
  })
})

describe("product-specific reranking", () => {
  it.each(products.filter((product) => product.mayRerank))(
    "reports executed $product reranking",
    ({ product, model }) => {
      const execution = { isReranked: true, models: [{ model, purpose: "embedding" as const }, reranker] }
      const result = searchExecution(execution, "hybrid", product)
      expect(result.isReranked).toBe(true)
      expect(result.models[1]).toEqual({ ...reranker, dimensions: null, provider: "cohere" })
      expect(() =>
        searchExecution(
          { ...execution, models: [execution.models[0], { ...reranker, dimensions: 1024 }] },
          "hybrid",
          product
        )
      ).toThrow(LegislationError)
    }
  )

  it.each(products.filter((product) => !product.mayRerank))("rejects $product reranking", ({ product, model }) => {
    expect(() =>
      searchExecution({ isReranked: true, models: [{ model, purpose: "embedding" }, reranker] }, "hybrid", product)
    ).toThrow(LegislationError)
  })

  it("follows canonical route changes rather than a second product/model allowlist", () => {
    vi.spyOn(routing, "embeddingQueryRouteFor").mockReturnValue({
      ...routing.embeddingQueryRouteFor("search_bills"),
      queryEmbeddingProduct: "structured-amendment",
      rerank: undefined
    })
    const execution = {
      isReranked: false,
      models: [{ model: "openai/text-embedding-3-small", purpose: "embedding" }]
    }
    expect(searchExecution(execution, "semantic", "bill")).toEqual({
      isReranked: false,
      models: [{ dimensions: 1536, model: "openai/text-embedding-3-small", provider: "openai", purpose: "embedding" }]
    })
    expect(() =>
      searchExecution({ isReranked: true, models: [...execution.models, reranker] }, "semantic", "bill")
    ).toThrow(LegislationError)
  })
})
