import { embeddingRouteFor } from "@repo/legislation-core/embeddings/embedding-routing"
import { describe, expect, it } from "vitest"
import { countEmbeddingIntegrity } from "./corpus.js"

describe("embedding corpus validation", () => {
  it("counts missing vectors separately from stale non-null embeddings", () => {
    const route = embeddingRouteFor("document-section")
    expect(
      countEmbeddingIntegrity(
        [
          {
            embedding: null,
            embeddingInputContract: route.embeddingInputContract,
            embeddingInputHash: "current",
            embeddingModel: route.model,
            inputHash: "current"
          },
          {
            embedding: "[0.1]",
            embeddingInputContract: route.embeddingInputContract,
            embeddingInputHash: "stale",
            embeddingModel: route.model,
            inputHash: "current"
          },
          {
            embedding: "[0.1]",
            embeddingInputContract: route.embeddingInputContract,
            embeddingInputHash: "current",
            embeddingModel: route.model,
            inputHash: "current"
          }
        ],
        route
      )
    ).toEqual({ missing: 1, stale: 1 })
  })
})
