import { expect, it } from "vitest"
import { z } from "zod"
import { embeddingTokenizer } from "../../models/embedding-tokenizer.js"
import { inspectLegalPassagePreparation } from "./passage-inspection.js"

const base = {
  versionId: "canonical-version",
  body: "Exact canonical source text. ".repeat(100),
  blocks: [],
  inputContract: "xml",
  context: "United States\nCode\nSection",
  model: "fixture",
  tokenizer: { id: "fixture-character-count", count: (text: string) => text.length }
}

it.each(["openai/text-embedding-3-small", "voyageai/voyage-4"] as const)(
  "inspects canonical inputs offline with %s and freezes replayable hashes",
  async (model) => {
    const input = { ...base, model, tokenizer: await embeddingTokenizer(model) }
    const result = inspectLegalPassagePreparation(input)
    expect(result.status).toBe("prepared")
    if (result.status !== "prepared") {
      throw new Error("expected_prepared")
    }
    expect(result.passages).toBeGreaterThan(0)
    expect(result.tokens).toBeGreaterThan(0)
    expect(result.maximumTokens).toBeLessThanOrEqual(1200)
    expect(result.maximumInputCharacters).toBeLessThanOrEqual(16000)
    expect(inspectLegalPassagePreparation(input)).toEqual(result)
    expect(JSON.stringify(result)).not.toContain(base.body)
    expect(inspectLegalPassagePreparation({ ...input, context: "Different context" })).not.toMatchObject({
      generation: result.generation,
      contextHash: result.contextHash
    })
    expect(inspectLegalPassagePreparation({ ...input, versionId: "other-version" })).not.toMatchObject({
      generation: result.generation
    })
  }
)

it("separates an intact small table from a large unresolved source reference", () => {
  function table(label: string) {
    const text = `${label}\tDo.`
    return {
      ...base,
      body: text,
      blocks: [
        { ordinal: 0, kind: "table", tag: "TABLE", text, xml: `<TABLE><TR><TD>${label}</TD><TD>Do.</TD></TR></TABLE>` }
      ]
    }
  }
  expect(inspectLegalPassagePreparation(table("Short"))).toMatchObject({ status: "prepared", passages: 1 })
  expect(inspectLegalPassagePreparation(table("Long label ".repeat(200).trim()))).toMatchObject({
    status: "blocked",
    reason: "passage_table_unresolved_ditto"
  })
})

it("records source and context blockers without returning source strings", () => {
  expect(inspectLegalPassagePreparation({ ...base, blocks: [{ bad: "sensitive source" }] })).toMatchObject({
    status: "blocked",
    reason: "invalid_source_blocks"
  })
  expect(
    inspectLegalPassagePreparation({
      ...base,
      body: "different",
      blocks: [{ ordinal: 0, kind: "text", tag: "P", text: "sensitive source", xml: "<P>sensitive source</P>" }]
    })
  ).toMatchObject({ status: "blocked", reason: "legal_reader_source_text_mismatch" })
  expect(inspectLegalPassagePreparation({ ...base, context: "C".repeat(801) })).toMatchObject({
    status: "blocked",
    reason: "passage_context_exhausts_budget"
  })
  expect(() => inspectLegalPassagePreparation({ ...base, context: "C".repeat(16001) })).toThrow(z.ZodError)
})

it("records empty structural versions without pretending passages exist", () => {
  expect(inspectLegalPassagePreparation({ ...base, body: "" })).toMatchObject({
    status: "prepared",
    eligibility: "empty_text",
    passages: 0,
    tokens: 0,
    maximumTokens: 0,
    maximumInputCharacters: 0,
    continuations: 0
  })
})

it("does not turn tokenizer failures or invalid counts into ordinary source dispositions", () => {
  expect(() =>
    inspectLegalPassagePreparation({
      ...base,
      tokenizer: {
        id: "broken",
        count: () => {
          throw new Error("tokenizer_broken")
        }
      }
    })
  ).toThrow("tokenizer_broken")
  expect(() =>
    inspectLegalPassagePreparation({ ...base, tokenizer: { id: "invalid-count", count: () => NaN } })
  ).toThrow(z.ZodError)
})

it("recounts prepared inputs independently and stops on a changing tokenizer", () => {
  const seen = new Map<string, number>()
  expect(() =>
    inspectLegalPassagePreparation({
      ...base,
      body: "A short text",
      tokenizer: {
        id: "unstable",
        count: (text) => {
          const n = (seen.get(text) ?? 0) + 1
          seen.set(text, n)
          return text.length + n
        }
      }
    })
  ).toThrow("preparation_inspection_token_recount")
})
