import { MockLanguageModelV4 } from "ai/test"
import { describe, expect, it } from "vitest"
import { checkRun } from "./checks"
import { assertSafeArtifact, canonicalJson, datasetSchema, digest, type EvalEvent, type EvalTurn } from "./contracts"
import { createFixtureService } from "./fixtures"
import { createCallBudget, executeCase } from "./runner"
import { smokeDataset } from "./smoke"

function sample(id = "greeting") {
  const item = smokeDataset.cases.find((candidate) => candidate.id === id)
  if (!item) {
    throw new Error("Missing test case")
  }
  return item
}
const turn: EvalTurn = {
  text: "Answer [1](#citation-current)",
  termination: "stop",
  durationMs: 5,
  firstTextMs: 1,
  inputTokens: 1,
  outputTokens: 1,
  responses: []
}
const result: EvalEvent = {
  turn: 0,
  step: 1,
  type: "result",
  tool: "get_bill",
  callId: "call",
  value: {
    evidence: [
      {
        id: "current",
        title: "Bill",
        origin: "canonical",
        sourceUrl: "https://example.org/bill",
        content: { state: "not-collected" }
      }
    ]
  }
}

describe("evaluation contracts", () => {
  it("validates twelve draft cases without claiming reference review", () => {
    expect(smokeDataset.cases).toHaveLength(12)
    expect(smokeDataset.cases.every((item) => item.review === "draft")).toBe(true)
    expect(() => datasetSchema.parse({ ...smokeDataset, cases: [sample(), sample()] })).toThrow("unique")
  })

  it("hashes structured arguments independently of property order", () => {
    expect(digest({ query: "water", limit: 5 })).toBe(digest({ limit: 5, query: "water" }))
    expect(canonicalJson({ cursor: undefined })).toBe("{}")
    expect(digest({ query: "water" })).not.toBe(digest({ query: "air" }))
  })

  it("rejects credentials and unsafe source URLs before capture", () => {
    expect(() => assertSafeArtifact({ sourceUrl: "https://example.org/?token=private" })).toThrow("unsafe URL")
    expect(() => assertSafeArtifact({ authorization: "hidden" })).toThrow("Unsafe")
    expect(() => assertSafeArtifact({ text: "sk-or-v1-1234567890abcdef12345678" })).toThrow("credential")
  })

  it("returns matching fixtures and classifies missing arguments without a fallback", async () => {
    const fixture = createFixtureService(sample("bill-identity"))
    await expect(fixture.service.getBill({ id: "bill:us:119:hr:9001" })).resolves.toHaveProperty("bill")
    await expect(fixture.service.getBill({ id: "bill:us:119:hr:9999" })).rejects.toThrow("coverage gap")
    expect(fixture.missing).toEqual([{ method: "getBill", input: { id: "bill:us:119:hr:9999" } }])
  })

  it("does not treat absent citations as perfect grounding", () => {
    const scores = checkRun(sample("bill-identity"), [{ ...turn, text: "No citation" }], [])
    expect(scores.find((score) => score.name === "citation-validity")?.value).toBeNull()
    expect(scores.find((score) => score.name === "required-citation")?.value).toBe(0)
  })

  it("accepts current evidence and rejects citations from earlier turns", () => {
    expect(checkRun(sample(), [turn], [result]).find((score) => score.name === "citation-validity")?.value).toBe(1)
    expect(
      checkRun(sample(), [{ ...turn, text: "Earlier answer" }, turn], [result]).find(
        (score) => score.name === "citation-validity"
      )?.value
    ).toBe(0)
  })

  it("rejects a bare snapshot fragment rather than treating it as no citation", () => {
    const scores = checkRun(sample("zero-vote"), [{ ...turn, text: "Yes: 7 [1](#current)" }], [result])
    expect(scores.find((score) => score.name === "citation-validity")?.value).toBe(0)
    expect(scores.find((score) => score.name === "required-citation")?.value).toBe(0)
  })

  it("detects research in the same step as clarification", () => {
    const calls: EvalEvent[] = [
      { ...result, type: "call", tool: "ask_clarification", callId: "question" },
      { ...result, type: "call", tool: "get_bill", callId: "research" }
    ]
    expect(
      checkRun(sample("ask-scope"), [{ ...turn, termination: "clarification" }], calls).find(
        (score) => score.name === "clarification-isolation"
      )?.value
    ).toBe(0)
  })

  it("blocks before exceeding the shared call or input allowance", () => {
    const budget = createCallBudget(1, 100)
    budget.claim("first")
    expect(() => budget.claim("second")).toThrow("budget")
    expect(budget.used).toBe(1)
    expect(budget.blocked).toBe(true)
    const inputBudget = createCallBudget(2, 10)
    expect(() => inputBudget.claim("too many input characters")).toThrow("budget")
    expect(inputBudget.used).toBe(0)
  })
})

describe("shared SDK execution", () => {
  it("captures a real SDK stream without a network or database", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] })
            controller.enqueue({ type: "text-start", id: "text" })
            controller.enqueue({ type: "text-delta", id: "text", delta: "Hello." })
            controller.enqueue({ type: "text-end", id: "text" })
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: {
                inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 2, text: 2, reasoning: 0 }
              }
            })
            controller.close()
          }
        })
      })
    })
    const budget = createCallBudget(2, 180000)
    const outcome = await executeCase({
      item: sample(),
      model,
      instructions: "Pinned instructions",
      budget,
      signal: new AbortController().signal
    })
    expect(outcome.status).toBe("completed")
    expect(outcome.turns[0]?.text).toBe("Hello.")
    expect(outcome.turns[0]?.termination).toBe("stop")
    expect(outcome.humanOutcome).toBe("pending")
    expect(outcome.events).toEqual([])
    expect(budget.used).toBe(1)
    expect(model.doStreamCalls[0]?.prompt[0]).toMatchObject({ role: "system", content: "Pinned instructions" })
  })
})
