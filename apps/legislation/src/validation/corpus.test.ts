import { describe, expect, it } from "vitest"
import { countEmbeddingIntegrity } from "./corpus.js"

describe("embedding corpus validation", () => {
  it("counts missing vectors separately from stale non-null embeddings", () => {
    expect(
      countEmbeddingIntegrity([
        {
          embedding: null,
          embeddingInputHash: "current",
          embeddingModel: "openai/text-embedding-3-small",
          inputHash: "current"
        },
        {
          embedding: "[0.1]",
          embeddingInputHash: "stale",
          embeddingModel: "openai/text-embedding-3-small",
          inputHash: "current"
        },
        {
          embedding: "[0.1]",
          embeddingInputHash: "current",
          embeddingModel: "openai/text-embedding-3-small",
          inputHash: "current"
        }
      ])
    ).toEqual({ missing: 1, stale: 1 })
  })
})
