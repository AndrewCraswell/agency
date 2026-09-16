import { buildLegalTextProjection } from "@repo/legislation-core/legal-text/reader-text"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { buildLegalPassages } from "./passages.js"

// Explicit test tokenizer, not an estimate of any model tokenizer.
const tokenizer = { id: "fixture-codepoints", count: (text: string) => [...text].length }
const project = (body: string, versionId = "version-a") => buildLegalTextProjection({ versionId, body, blocks: [] })
const table = (body: string) =>
  buildLegalTextProjection({
    versionId: "table-version",
    body,
    blocks: [{ ordinal: 0, kind: "table", tag: "GPOTABLE", text: body, xml: "<GPOTABLE/>" }]
  })

describe("legal retrieval passage foundation", () => {
  it("preserves exact text and source-reader spans while counting the context in every budget", () => {
    const body = "First requirement.\nSecond requirement.\n".repeat(12) + "§ 7 — 🧭 final clause"
    const projection = project(body)
    const result = buildLegalPassages({
      projection,
      context: "US / 7 CFR",
      tokenizer,
      targetTokens: 70,
      maximumTokens: 90
    })
    expect(result.passages.map((passage) => passage.text).join("")).toBe(body)
    let after = 0
    for (const passage of result.passages) {
      expect(passage.start).toBe(after)
      expect(passage.text).toBe(body.slice(passage.start, passage.end))
      expect(passage.tokenCount).toBe(tokenizer.count(passage.inputText))
      expect(passage.tokenCount).toBeLessThanOrEqual(70)
      expect(passage.readerSpans.map((span) => body.slice(span.start, span.end)).join("")).toBe(passage.text)
      expect(passage.text.isWellFormed()).toBe(true)
      after = passage.end
    }
    expect(after).toBe(body.length)
    expect(
      buildLegalPassages({ projection, context: "US / 7 CFR", tokenizer, targetTokens: 70, maximumTokens: 90 })
    ).toEqual(result)
  })

  it("binds identities to version, context, tokenizer and budget", () => {
    const base = { projection: project("requirement"), context: "US", tokenizer }
    const original = buildLegalPassages(base)
    for (const change of [
      { ...base, projection: project("requirement", "version-b") },
      { ...base, context: "State" },
      { ...base, tokenizer: { ...tokenizer, id: "another-tokenizer" } },
      { ...base, targetTokens: 700 }
    ]) {
      const changed = buildLegalPassages(change)
      expect(changed.generation).not.toBe(original.generation)
      expect(changed.passages[0]?.id).not.toBe(original.passages[0]?.id)
    }
  })

  it("keeps a table intact up to the hard limit and blocks oversized tables rather than losing headers", () => {
    const body = "Item\tValue\nA\t1\nB\t2\n"
    const result = buildLegalPassages({
      projection: table(body),
      context: "",
      tokenizer,
      targetTokens: 8,
      maximumTokens: 30
    })
    expect(result.passages).toHaveLength(1)
    expect(result.passages[0]?.text).toBe(body)
    expect(() =>
      buildLegalPassages({ projection: table(body), context: "", tokenizer, targetTokens: 8, maximumTokens: 10 })
    ).toThrow("passage_table_source_required")
    expect(() =>
      buildLegalPassages({ projection: table("row\tvalue\n".repeat(2000)), context: "", tokenizer })
    ).toThrow("passage_table_source_required")
  })

  it("rejects corrupted reader data, invalid token counts and exhausted context", () => {
    const projection = project("required text")
    expect(() =>
      buildLegalPassages({ projection: { ...projection, bodyHash: "0".repeat(64) }, context: "", tokenizer })
    ).toThrow("passage_body_hash_mismatch")
    expect(() =>
      buildLegalPassages({ projection: { ...projection, blockGeneration: "0".repeat(64) }, context: "", tokenizer })
    ).toThrow("passage_reader_generation_mismatch")
    expect(() =>
      buildLegalPassages({ projection, context: "", tokenizer: { id: "invalid", count: () => Number.NaN } })
    ).toThrow(z.ZodError)
    expect(() => buildLegalPassages({ projection, context: "oversized", tokenizer, targetTokens: 5 })).toThrow(
      "passage_context_exhausts_budget"
    )
  })

  it("classifies empty bodies without embedding their context and retains substantive repeal text", () => {
    expect(buildLegalPassages({ projection: project(" \n"), context: "US", tokenizer })).toMatchObject({
      eligibility: "empty_text",
      passages: []
    })
    expect(
      buildLegalPassages({
        projection: project("This provision is repealed effective tomorrow."),
        context: "US",
        tokenizer
      }).eligibility
    ).toBe("eligible")
  })

  it("handles astral characters at tiny boundaries and refuses an unsplittable budget", () => {
    const result = buildLegalPassages({
      projection: project("🧭🧭🧭"),
      context: "",
      tokenizer,
      targetTokens: 1,
      maximumTokens: 2
    })
    expect(result.passages.map((passage) => passage.text)).toEqual(["🧭", "🧭", "🧭"])
    expect(() =>
      buildLegalPassages({
        projection: project("x"),
        context: "",
        tokenizer: { id: "expensive", count: (text) => text.length * 2 },
        targetTokens: 1
      })
    ).toThrow("embedding_codepoint_exceeds_budget")
  })
})
