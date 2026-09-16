import { expect, it } from "vitest"
import { embeddingTokenizer, validateEmbeddingTokenBudget } from "./embedding-tokenizer"

it("loads the pinned external OpenAI vocabulary and preserves exact token counts", async () => {
  const tokenizer = await embeddingTokenizer("openai/text-embedding-3-small")
  expect(tokenizer.id).toBe("tiktoken:1.0.22:cl100k_base")
  expect(tokenizer.count("hello world")).toBe(2)
  expect(await embeddingTokenizer("openai/text-embedding-3-small")).toBe(tokenizer)
  expect(await validateEmbeddingTokenBudget("openai/text-embedding-3-small", ["hello world", ""])).toEqual({
    tokenizerId: tokenizer.id,
    counts: [2, 0]
  })
})
