import { createHash } from "node:crypto"
import { z } from "zod"
import type { EmbeddingTokenizer } from "./embedding-tokenizer.js"

/** Lossless contiguous UTF-16 source spans. Call separately for prose regions around atomic tables/sections. */
export function splitEmbeddingText(input: {
  text: string
  prefix?: string
  tokenizer: EmbeddingTokenizer
  targetTokens: number
  maximumCharacters?: number
}) {
  const text = z
    .string()
    .max(64 * 1024 * 1024)
    .parse(input.text)
  const prefix = z
    .string()
    .max(16000)
    .parse(input.prefix ?? "")
  if (!text.isWellFormed() || !prefix.isWellFormed()) {
    throw new Error("embedding_invalid_unicode")
  }
  const target = z.int().positive().max(31000).parse(input.targetTokens)
  const maximumCharacters = z
    .int()
    .positive()
    .max(16000)
    .parse(input.maximumCharacters ?? 16000)
  const count = (value: string) => z.int().nonnegative().parse(input.tokenizer.count(value))
  if (prefix.length >= maximumCharacters || count(prefix) >= target) {
    throw new Error("embedding_context_exhausts_budget")
  }
  const passages: {
    start: number
    end: number
    text: string
    inputText: string
    inputHash: string
    tokenCount: number
  }[] = []
  const boundary = (offset: number) =>
    offset < text.length && /[\uDC00-\uDFFF]/.test(text[offset] ?? "") && /[\uD800-\uDBFF]/.test(text[offset - 1] ?? "")
      ? offset - 1
      : offset
  let start = 0
  while (start < text.length) {
    let end = boundary(Math.min(text.length, start + maximumCharacters - prefix.length))
    while (count(prefix + text.slice(start, end)) > target) {
      if (end - start <= 1) {
        throw new Error("embedding_codepoint_exceeds_budget")
      }
      end = boundary(start + Math.ceil((end - start) / 2))
      if (end <= start) {
        throw new Error("embedding_codepoint_exceeds_budget")
      }
    }
    if (end <= start) {
      throw new Error("embedding_codepoint_exceeds_budget")
    }
    if (end < text.length) {
      const newline = text.lastIndexOf("\n", end - 1)
      if (newline >= start + (end - start) / 2 && count(prefix + text.slice(start, newline + 1)) <= target) {
        end = newline + 1
      }
    }
    const body = text.slice(start, end)
    const inputText = prefix + body
    passages.push({
      start,
      end,
      text: body,
      inputText,
      tokenCount: count(inputText),
      inputHash: createHash("sha256").update(inputText).digest("hex")
    })
    start = end
  }
  return { tokenizerId: input.tokenizer.id, passages }
}
