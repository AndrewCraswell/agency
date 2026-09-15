import { describe, expect, it } from "vitest"
import { splitEmbeddingText } from "./embedding-preparation.js"
import { embeddingTokenizer, validateEmbeddingTokenBudget } from "./embedding-tokenizer.js"
import voyageReference from "./tokenizers/voyage-reference-counts.json" with { type: "json" }

describe("shared model-aware embedding preparation", () => {
  it("matches the pinned Rust reference tokenizer on Unicode, whitespace, literals and repetitive inputs", async () => {
    const tokenizer = await embeddingTokenizer("voyageai/voyage-4")
    for (const row of voyageReference.cases) {
      expect(tokenizer.count(row.text)).toBe(row.count)
    }
  }, 15000)
  it.each(["openai/text-embedding-3-small", "voyageai/voyage-4"] as const)(
    "preserves exact source and counts every prefixed passage with %s",
    async (model) => {
      const tokenizer = await embeddingTokenizer(model)
      expect(await embeddingTokenizer(model)).toBe(tokenizer)
      const text = "§ 1.1\tA duty applies.\nDéjà vu e\u0301 🧭 中文 1234567.\n".repeat(100)
      const prefix = "US / title 1 / exact version\n\n"
      const result = splitEmbeddingText({ text, prefix, tokenizer, targetTokens: 80, maximumCharacters: 500 })
      expect(result.passages.length).toBeGreaterThan(10)
      expect(result.passages.map((row) => row.text).join("")).toBe(text)
      let start = 0
      for (const passage of result.passages) {
        expect(passage.start).toBe(start)
        expect(passage.text).toBe(text.slice(passage.start, passage.end))
        expect(passage.text.isWellFormed()).toBe(true)
        expect(passage.tokenCount).toBe(tokenizer.count(passage.inputText))
        expect(passage.tokenCount).toBeLessThanOrEqual(80)
        expect(passage.inputText.length).toBeLessThanOrEqual(500)
        start = passage.end
      }
      expect(start).toBe(text.length)
    },
    15000
  )
  it("uses the model's vocabulary rather than a character ratio", async () => {
    const openai = await embeddingTokenizer("openai/text-embedding-3-small")
    const voyage = await embeddingTokenizer("voyageai/voyage-4")
    expect(openai.count("Hello World")).toBe(2)
    expect(voyage.count("Hello World")).toBe(2)
    expect(openai.count("1234567890")).not.toBe(voyage.count("1234567890"))
    await expect(validateEmbeddingTokenBudget("openai/text-embedding-3-small", ["🧭".repeat(3000)])).rejects.toThrow(
      "embedding_input_token_limit"
    )
  })
  it("rejects a batch that exceeds the combined token budget", async () => {
    await expect(
      validateEmbeddingTokenBudget(
        "openai/text-embedding-3-small",
        Array.from({ length: 40 }, () => "🧭".repeat(2500))
      )
    ).rejects.toThrow("embedding_batch_token_limit")
  }, 15000)
  it("rejects invalid Unicode and impossible prefix budgets without discarding text", async () => {
    const tokenizer = await embeddingTokenizer("openai/text-embedding-3-small")
    expect(() => splitEmbeddingText({ text: "\ud800", tokenizer, targetTokens: 10 })).toThrow(
      "embedding_invalid_unicode"
    )
    expect(() => splitEmbeddingText({ text: "body", prefix: "prefix", tokenizer, targetTokens: 1 })).toThrow(
      "embedding_context_exhausts_budget"
    )
    expect(splitEmbeddingText({ text: "", tokenizer, targetTokens: 10 }).passages).toEqual([])
  })
})
