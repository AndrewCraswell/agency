import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { APICallError } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { digest } from "./contracts"
import { buildEvaluationInput } from "./evaluationInput"
import { evaluateResult } from "./evaluators"
import { createCallBudget, type CaseResult } from "./runner"
import { smokeDataset } from "./smoke"

const { generate } = vi.hoisted(() => ({
  generate: vi.fn<(options: { abortSignal?: AbortSignal }) => Promise<{ output: unknown; totalUsage: unknown }>>()
}))
vi.mock("ai", async (original) => ({ ...(await original<typeof import("ai")>()), generateText: generate }))
const directories: string[] = []
afterEach(async () => {
  vi.resetAllMocks()
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})
const item = smokeDataset.cases[0]
if (!item) {
  throw new Error("Missing smoke case")
}
const result: CaseResult = {
  caseId: item.id,
  family: item.family,
  caseHash: digest(item),
  toolSchemaHash: "test",
  status: "completed",
  turns: [
    {
      text: "Hello",
      termination: "stop",
      durationMs: 1,
      firstTextMs: 1,
      inputTokens: 1,
      outputTokens: 1,
      responses: []
    }
  ],
  events: [],
  fixtureGaps: [],
  providerFailures: [],
  scores: [],
  costUsd: null,
  humanOutcome: "pending"
}
const judgeOutput = {
  applicability: "gradable",
  correctness: 4,
  grounding: null,
  completeness: 4,
  usefulness: 4,
  criticalFailure: false,
  rationale: "Appropriate greeting",
  evidenceIds: []
}
const prompts = { judge: { prompt: "Judge", version: 1 }, critic: { prompt: "Critic", version: 1 } }

describe("checkpointed evaluation", () => {
  it("resumes critic without repeating a successful judge and rejects changed inputs", async () => {
    const checkpointDirectory = await mkdtemp(path.join(os.tmpdir(), "eval-grade-"))
    directories.push(checkpointDirectory)
    generate.mockResolvedValueOnce({ output: judgeOutput, totalUsage: {} })
    generate.mockRejectedValueOnce(
      new APICallError({
        message: "No credits",
        url: "https://example.org",
        requestBodyValues: {},
        statusCode: 402,
        isRetryable: false
      })
    )
    const options = {
      item,
      result,
      prompts,
      checkpointDirectory,
      modelId: "test-model",
      apiKey: "test",
      signal: new AbortController().signal
    }
    const first = await evaluateResult({ ...options, budget: createCallBudget(10, 180000) })
    expect(first).toMatchObject({ status: "ungradable", stage: "critic", httpStatus: 402 })
    generate.mockResolvedValueOnce({ output: { issues: [], summary: "No issues" }, totalUsage: {} })
    const budget = createCallBudget(10, 180000)
    const recovered = await evaluateResult({ ...options, budget })
    expect(recovered.status).toBe("scored")
    expect(budget.used).toBe(1)
    expect(generate).toHaveBeenCalledTimes(3)
    const reused = await evaluateResult({ ...options, budget: createCallBudget(10, 180000) })
    expect(reused.status).toBe("scored")
    expect(generate).toHaveBeenCalledTimes(3)
    await expect(
      evaluateResult({
        ...options,
        item: { ...item, reference: "Different reference" },
        budget: createCallBudget(10, 180000)
      })
    ).rejects.toThrow("inputs changed")
    expect(generate).toHaveBeenCalledTimes(3)
  })

  it("gives the critic a fresh request deadline, not the judge's elapsed deadline", async () => {
    generate.mockResolvedValueOnce({ output: judgeOutput, totalUsage: {} })
    generate.mockResolvedValueOnce({ output: { issues: [], summary: "Fine" }, totalUsage: {} })
    await evaluateResult({
      item,
      result,
      prompts,
      modelId: "test",
      apiKey: "test",
      signal: new AbortController().signal,
      budget: createCallBudget(3, 180000)
    })
    expect(generate.mock.calls[0]?.[0].abortSignal).not.toBe(generate.mock.calls[1]?.[0].abortSignal)
  })
})

describe("evaluator evidence input", () => {
  it("replaces only exact duplicate reference JSON and keeps complete evidence", () => {
    const data = { person: { name: "Public source", biography: "Complete evidence ".repeat(100) } }
    const events: CaseResult["events"] = [
      { turn: 0, step: 1, type: "result", tool: "get_person", callId: "source-call", value: { data } }
    ]
    const reference = `Expected facts: ${JSON.stringify(data)}`
    const built = buildEvaluationInput({ ...item, reference }, { ...result, events })
    expect(built.input.events).toEqual(events)
    expect(built.input.reference).not.toContain(data.person.biography)
    expect(built.input.referenceEvidence).toEqual([{ turn: 0, callId: "source-call", dataHash: digest(data) }])
    expect(built.input.reference).toContain("source-call")
    expect(buildEvaluationInput({ ...item, reference }, result).input.reference).toBe(reference)
    expect(
      buildEvaluationInput({ ...item, reference: "Independent expected facts" }, { ...result, events }).input.reference
    ).toBe("Independent expected facts")
  })
})
