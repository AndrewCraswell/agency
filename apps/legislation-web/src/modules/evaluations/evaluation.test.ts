import type { LanguageModelV4 } from "@openrouter/ai-sdk-provider"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { MockLanguageModelV4 } from "ai/test"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { checkRun } from "./checks"
import {
  assertSafeArtifact,
  canonicalJson,
  caseSchema,
  datasetSchema,
  digest,
  experimentSchema,
  type EvalCase,
  type EvalEvent,
  type EvalTurn
} from "./contracts"
import { createFixtureService } from "./fixtures"
import { caseResultSchema, createCallBudget, executeCase } from "./runner"
import { smokeDataset } from "./smoke"

const { observations } = vi.hoisted(() => {
  const observations: { name: string; type: unknown; update: ReturnType<typeof vi.fn> }[] = []
  return { observations }
})
vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, operation: () => unknown) => operation(),
  startActiveObservation: (
    name: string,
    operation: (observation: { id: string; traceId: string; update: ReturnType<typeof vi.fn> }) => unknown,
    options: unknown
  ) => {
    const update = vi.fn<(attributes: unknown) => void>()
    observations.push({ name, type: options, update })
    return operation({ id: `turn-${observations.length}`, traceId: "trace-test", update })
  }
}))
beforeEach(() => {
  observations.length = 0
})

function sample(id = "greeting") {
  const item = smokeDataset.cases.find((candidate) => candidate.id === id)
  if (!item) {
    throw new Error("Missing test case")
  }
  return item
}

const capturedTextFailure = {
  method: "getBillText",
  input: { id: "bill:tn:113:sb:1903", documentId: "document:4fcc42927bb7547a76a40a2c" },
  error: { category: "not_found", message: "No matching bill text document was found" }
} satisfies EvalCase["fixtures"][number]
const capturedBillFailure = {
  method: "getBill",
  input: { id: "bill:us:119:hr:9001" },
  error: { category: "not_found", message: "No matching bill was found" }
} satisfies EvalCase["fixtures"][number]

function streamStep(
  options: {
    id?: string
    text?: string
    costUsd?: number | null
    tool?: { name: string; input: unknown }
    usage?: Awaited<ReturnType<LanguageModelV4["doGenerate"]>>["usage"]
    isInterrupted?: boolean
    finishReason?: "length" | "other"
    providerMetadata?: Awaited<ReturnType<LanguageModelV4["doGenerate"]>>["providerMetadata"]
  } = {}
): Awaited<ReturnType<LanguageModelV4["doStream"]>> {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] })
        controller.enqueue({ type: "response-metadata", id: options.id ?? "gen-test", modelId: "test/model" })
        if (options.tool) {
          controller.enqueue({
            type: "tool-call",
            toolCallId: "test-call",
            toolName: options.tool.name,
            input: JSON.stringify(options.tool.input)
          })
        } else {
          controller.enqueue({ type: "text-start", id: "text" })
          controller.enqueue({ type: "text-delta", id: "text", delta: options.text ?? "Scoped answer." })
          controller.enqueue({ type: "text-end", id: "text" })
        }
        if (options.isInterrupted) {
          controller.error(new Error("Interrupted generation"))
          return
        }
        controller.enqueue({
          type: "finish",
          finishReason: {
            unified: options.finishReason ?? (options.tool ? "tool-calls" : "stop"),
            raw: options.finishReason ?? (options.tool ? "tool_calls" : "stop")
          },
          usage: options.usage ?? {
            inputTokens: { total: 12, noCache: 7, cacheRead: 3, cacheWrite: 2 },
            outputTokens: { total: 6, text: 4, reasoning: 2 }
          },
          providerMetadata: options.providerMetadata ?? {
            openrouter: {
              provider: "test-provider",
              usage: {
                promptTokens: 12,
                completionTokens: 6,
                totalTokens: 18,
                ...(options.costUsd === null ? {} : { cost: options.costUsd ?? 0.125 }),
                costDetails: { upstreamInferenceCost: 100 }
              }
            }
          }
        })
        controller.close()
      }
    })
  }
}

function clarificationInput(kind: "single" | "multiple" | "text", allowSkip = true) {
  return {
    kind,
    question: "Which jurisdiction?",
    description: null,
    allowSkip,
    allowFreeText: false,
    options:
      kind === "text"
        ? null
        : [
            { id: "ca", label: "California", description: null },
            { id: "ny", label: "New York", description: null }
          ],
    minSelections: kind === "multiple" ? 2 : null,
    maxSelections: kind === "multiple" ? 2 : null
  }
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
  it("accepts sixteen candidates and supported reasoning settings", () => {
    const config = {
      candidates: Array.from({ length: 16 }, (_, index) => ({
        id: `candidate-${index}`,
        model: "test/model",
        promptVersion: 1,
        provider: { only: ["test-provider"] },
        reasoning: { effort: "low" }
      })),
      repeats: 1,
      maximumModelCalls: 100,
      maximumInputCharacters: 1000,
      evaluatorModel: "test/evaluator",
      evaluate: false
    }
    expect(experimentSchema.parse(config).candidates).toHaveLength(16)
    expect(
      experimentSchema.safeParse({
        ...config,
        candidates: [...config.candidates, { ...config.candidates[0], id: "extra" }]
      }).success
    ).toBe(false)
    for (const reasoning of [
      null,
      { max_tokens: 512, enabled: true },
      { effort: "none", exclude: true },
      { effort: "max" }
    ]) {
      expect(
        experimentSchema.safeParse({ ...config, candidates: [{ ...config.candidates[0], reasoning }] }).success
      ).toBe(true)
    }
    for (const reasoning of [
      { effort: "unsupported" },
      { effort: "low", max_tokens: 512 },
      { enabled: false },
      { max_tokens: 0 }
    ]) {
      expect(
        experimentSchema.safeParse({ ...config, candidates: [{ ...config.candidates[0], reasoning }] }).success
      ).toBe(false)
    }
  })

  it("validates runnable criteria and canonical clarification responses rather than arbitrary metadata", () => {
    const item = {
      ...sample(),
      followUps: [{ status: "answered", selectedIds: ["ca"], text: "" }],
      turnCriteria: [{ turn: 1, criteria: ["Use the selected jurisdiction."] }]
    }
    expect(caseSchema.parse(item).followUps).toEqual(item.followUps)
    expect(caseSchema.safeParse({ ...item, turnCriteria: [{ turn: 2, criteria: ["Unreachable"] }] }).success).toBe(
      false
    )
    expect(
      caseSchema.safeParse({
        ...item,
        turnCriteria: [
          { turn: 0, criteria: ["A"] },
          { turn: 0, criteria: ["B"] }
        ]
      }).success
    ).toBe(false)
    expect(caseSchema.safeParse({ ...item, followUps: [{ kind: "single", value: "ca" }] }).success).toBe(false)
    expect(caseSchema.safeParse({ ...item, metadata: { expanded: true } }).success).toBe(false)
  })

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

  it("accepts strict success or captured failure fixtures but rejects contradictory and invalid records", () => {
    const { method, input, error } = capturedTextFailure
    for (const fixture of [capturedTextFailure, { method, input, output: null }]) {
      expect(caseSchema.parse({ ...sample(), fixtures: [fixture] }).fixtures).toEqual([fixture])
    }
    for (const fixture of [
      { method, input },
      { ...capturedTextFailure, output: null },
      { ...capturedTextFailure, output: undefined },
      { method, input, output: null, error: undefined },
      { method, input, output: null, extra: true },
      { ...capturedTextFailure, extra: true },
      { method, input, error: { ...error, category: "not-found" } },
      { method, input, error: { ...error, message: "" } },
      { method, input, error: { category: error.category } },
      { method, input, error: { ...error, name: "LegislationError" } }
    ]) {
      expect(caseSchema.safeParse({ ...sample(), fixtures: [fixture] }).success).toBe(false)
    }
  })

  it("replays a captured not-found error without a gap or a document ID alias", async () => {
    const fixture = createFixtureService(caseSchema.parse({ ...sample(), fixtures: [capturedTextFailure] }))
    const { input, error } = capturedTextFailure
    await expect(fixture.service.getBillText(input)).rejects.toBeInstanceOf(LegislationError)
    await expect(fixture.service.getBillText({ documentId: input.documentId, id: input.id })).rejects.toMatchObject(
      error
    )
    expect(fixture.missing).toEqual([])
    const uncaptured = { ...input, documentId: `${input.id}:${input.documentId}` }
    await expect(fixture.service.getBillText(uncaptured)).rejects.toThrow("coverage gap")
    expect(fixture.missing).toEqual([{ method: "getBillText", input: uncaptured }])
  })

  it("preserves null and cloned success outputs and rejects duplicate success/failure arguments", async () => {
    const { method, input } = capturedTextFailure
    const fixture = createFixtureService(
      caseSchema.parse({
        ...sample(),
        fixtures: [{ method, input, output: null }, ...sample("bill-identity").fixtures]
      })
    )
    await expect(fixture.service.getBillText(input)).resolves.toBeNull()
    const billInput = { id: "bill:us:119:hr:9001" }
    const first = await fixture.service.getBill(billInput)
    const second = await fixture.service.getBill(billInput)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(fixture.missing).toEqual([])
    expect(() =>
      createFixtureService(
        caseSchema.parse({ ...sample(), fixtures: [capturedTextFailure, { method, input, output: null }] })
      )
    ).toThrow("Duplicate fixture arguments")
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
  it.each(["length", "other"] as const)(
    "does not report %s termination as a completed answer or continue its follow-ups",
    async (finishReason) => {
      const model = new MockLanguageModelV4({
        doStream: [streamStep({ text: "An unfinished answer", finishReason })]
      })
      const result = await executeCase({
        item: caseSchema.parse({ ...sample(), followUps: ["Summarize the answer."] }),
        model,
        instructions: "Pinned",
        budget: createCallBudget(3, 180000),
        signal: new AbortController().signal
      })
      expect(result.status).toBe("agent-failure")
      expect(result.turns).toHaveLength(1)
      expect(result.turns[0]?.termination).toBe(finishReason)
      expect(model.doStreamCalls).toHaveLength(1)
      expect(result.scores.find((score) => score.name === "terminal-contract")?.value).toBe(0)
    }
  )

  it.each(["conflict", "precondition_failed"] as const)(
    "records the public %s tool message actually sent to the model without inventing processing facts",
    async (category) => {
      const model = new MockLanguageModelV4({
        doStream: [
          streamStep({
            tool: {
              name: "get_bill_text",
              input: { ...capturedTextFailure.input, cursor: null, limit: null, versionCode: null }
            }
          }),
          streamStep({ text: "The requested text could not be read." })
        ]
      })
      const result = await executeCase({
        item: caseSchema.parse({
          ...sample(),
          fixtures: [
            {
              ...capturedTextFailure,
              error: { category, message: "The captured operation could not be completed." }
            }
          ]
        }),
        model,
        instructions: "Pinned",
        budget: createCallBudget(3, 180000),
        signal: new AbortController().signal
      })
      const failure = z
        .object({
          message: z.string(),
          code: z.literal("precondition_failed"),
          reference: z.uuid()
        })
        .parse(result.events.find((event) => event.type === "error")?.value)
      expect(result.status).toBe("completed")
      expect(result.fixtureGaps).toEqual([])
      expect(failure.message).toContain("The conditions required for this operation were not met.")
      expect(failure.message).not.toMatch(/exists|not ready|not processed/i)
      expect(model.doStreamCalls[1]?.prompt).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "tool-result",
                output: { type: "error-text", value: failure.message }
              })
            ])
          })
        ])
      )
    }
  )

  it("marks an unavailable SDK error message unknown instead of exposing an untrusted diagnostic", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamStep({ tool: { name: "unregistered_tool", input: {} } }),
        streamStep({ text: "That tool is unavailable." })
      ]
    })
    const result = await executeCase({
      item: sample(),
      model,
      instructions: "Pinned",
      budget: createCallBudget(3, 180000),
      signal: new AbortController().signal
    })
    expect(result.events.find((event) => event.type === "error")?.value).toEqual({
      message: null,
      code: null,
      reference: null
    })
  })

  it("excludes provider reasoning and credentials from retained results and telemetry while preserving usage", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamStep({
          providerMetadata: {
            openrouter: {
              provider: "test-provider",
              reasoning_details: [{ type: "reasoning.encrypted", data: "private-reasoning-fixture" }],
              headers: { authorization: "private-credential-fixture" },
              usage: { cost: 0.125, completionTokensDetails: { reasoningTokens: 2 } }
            }
          }
        })
      ]
    })
    const result = await executeCase({
      item: sample(),
      model,
      instructions: "Pinned",
      budget: createCallBudget(1, 180000),
      signal: new AbortController().signal
    })
    expect(result.turns[0]?.responses[0]?.providerMetadata).toEqual({
      openrouter: {
        provider: "test-provider",
        usage: { cost: 0.125, completionTokensDetails: { reasoningTokens: 2 } }
      }
    })
    expect(result.costUsd).toBe(0.125)
    expect(result.turns[0]?.outputTokenDetails.reasoningTokens).toBe(2)
    expect(JSON.stringify(result)).not.toMatch(/private-reasoning-fixture|private-credential-fixture|reasoning_details/)
    expect(JSON.stringify(observations.map((observation) => observation.update.mock.calls))).not.toMatch(
      /private-reasoning-fixture|private-credential-fixture|reasoning_details/
    )
  })

  it.each([true, false])(
    "distinguishes a captured tool error from a coverage gap (captured: %s)",
    async (isCaptured) => {
      const model = new MockLanguageModelV4({
        doStream: [
          streamStep({
            tool: {
              name: "get_bill",
              input: { ...capturedBillFailure.input, childLimit: null, cursor: null }
            }
          }),
          streamStep({ text: "The requested document ID was not found." })
        ]
      })
      const outcome = await executeCase({
        item: caseSchema.parse({ ...sample(), fixtures: isCaptured ? [capturedBillFailure] : [] }),
        model,
        instructions: "Pinned",
        budget: createCallBudget(3, 180000),
        signal: new AbortController().signal
      })
      expect(outcome.status).toBe(isCaptured ? "completed" : "ungradable")
      expect(outcome.fixtureGaps).toEqual(
        isCaptured ? [] : [{ method: capturedBillFailure.method, input: capturedBillFailure.input }]
      )
      expect(caseResultSchema.safeParse(outcome).success).toBe(true)
    }
  )

  it.each([
    { name: "all supplied", costUsd: 0.25, total: 0.375 },
    { name: "one unknown", costUsd: null, total: null },
    { name: "explicit zero", costUsd: 0, total: 0.125 }
  ])("accounts for multiple steps once when costs are $name", async ({ costUsd, total }) => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamStep({
          id: "gen-research",
          tool: { name: "get_bill", input: { id: "bill:us:119:hr:9001", childLimit: null, cursor: null } }
        }),
        streamStep({ id: "gen-answer", costUsd })
      ]
    })
    const outcome = await executeCase({
      item: sample("bill-identity"),
      model,
      instructions: "Pinned",
      budget: createCallBudget(3, 180000),
      signal: new AbortController().signal
    })
    expect(outcome.status).toBe("completed")
    expect(model.doStreamCalls).toHaveLength(2)
    expect(outcome.costUsd).toBe(total)
    expect(outcome.turns[0]).toMatchObject({
      inputTokens: 24,
      outputTokens: 12,
      totalTokens: 36,
      inputTokenDetails: { noCacheTokens: 14, cacheReadTokens: 6, cacheWriteTokens: 4 },
      outputTokenDetails: { textTokens: 8, reasoningTokens: 4 },
      responses: [
        {
          step: 1,
          id: "gen-research",
          generationId: "gen-research",
          modelId: "test/model",
          costUsd: 0.125,
          providerMetadata: { openrouter: { provider: "test-provider" } }
        },
        { step: 2, id: "gen-answer", generationId: "gen-answer", costUsd }
      ]
    })
    expect(observations).toHaveLength(1)
    expect(observations[0]?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          events: outcome.events,
          inputTokens: 24,
          responses: outcome.turns[0]?.responses
        })
      })
    )
    expect(outcome.events.some((event) => event.type === "result" && event.tool === "get_bill")).toBe(true)
    expect(caseResultSchema.parse(outcome)).toEqual(outcome)
  })

  it("does not turn missing counters, cost or provider generation IDs into zero or synthetic IDs", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamStep({
          id: "sdk-generated-id",
          costUsd: null,
          usage: {
            inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: undefined, text: undefined, reasoning: undefined }
          }
        })
      ]
    })
    const outcome = await executeCase({
      item: sample(),
      model,
      instructions: "Pinned",
      budget: createCallBudget(1, 180000),
      signal: new AbortController().signal
    })
    expect(outcome.costUsd).toBeNull()
    expect(outcome.turns[0]).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      inputTokenDetails: { noCacheTokens: null, cacheReadTokens: null, cacheWriteTokens: null },
      outputTokenDetails: { textTokens: null, reasoningTokens: null },
      responses: [{ generationId: null, costUsd: null }]
    })
  })

  it("keeps a case cost unknown if a later billed attempt fails before finish-step", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamStep({ tool: { name: "get_bill", input: { id: "bill:us:119:hr:9001", childLimit: null } } }),
        streamStep({ isInterrupted: true })
      ]
    })
    const budget = createCallBudget(3, 180000)
    const outcome = await executeCase({
      item: sample("bill-identity"),
      model,
      instructions: "Pinned",
      budget,
      signal: new AbortController().signal
    })
    expect(outcome.status).toBe("agent-failure")
    expect(budget.used).toBe(2)
    expect(outcome.costUsd).toBeNull()
    expect(outcome.turns[0]?.responses).toMatchObject([
      { costUsd: 0.125 },
      { step: 2, costUsd: null, generationId: null }
    ])
    expect(outcome.turns[0]?.inputTokens).toBeNull()
    expect(observations).toHaveLength(1)
    expect(observations[0]?.update).toHaveBeenCalledWith(expect.objectContaining({ level: "ERROR" }))
  })

  it.each([
    { kind: "single", response: { status: "answered", selectedIds: ["ca"], text: "" }, resumed: "California" },
    {
      kind: "multiple",
      response: { status: "answered", selectedIds: ["ca", "ny"], text: "" },
      resumed: "California\nNew York"
    },
    { kind: "text", response: { status: "answered", selectedIds: [], text: "California" }, resumed: "California" },
    {
      kind: "single",
      response: { status: "skipped" },
      resumed: "I skipped this clarification. Do not assume an option was selected."
    }
  ] as const)(
    "resumes a $kind question with $response.status using the actual store",
    async ({ kind, response, resumed }) => {
      const item = caseSchema.parse({
        ...sample(),
        followUps: [response],
        turnCriteria: [
          { turn: 0, criteria: ["Ask for jurisdiction."] },
          { turn: 1, criteria: ["Respect the clarification response."] }
        ]
      })
      const model = new MockLanguageModelV4({
        doStream: [
          streamStep({ id: "gen-question", tool: { name: "ask_clarification", input: clarificationInput(kind) } }),
          streamStep({ id: "gen-resumed" })
        ]
      })
      const outcome = await executeCase({
        item,
        model,
        instructions: "Pinned",
        budget: createCallBudget(3, 180000),
        signal: new AbortController().signal
      })
      expect(outcome.status).toBe("completed")
      expect(outcome.followUpFailures).toEqual([])
      expect(outcome.turns).toHaveLength(2)
      expect(outcome.turns.map((entry) => entry.termination)).toEqual(["clarification", "stop"])
      expect(outcome.costUsd).toBe(0.25)
      expect(model.doStreamCalls[1]?.prompt.at(-1)).toMatchObject({
        role: "user",
        content: [{ type: "text", text: `Clarification question: Which jurisdiction?\n${resumed}` }]
      })
      expect(observations).toHaveLength(2)
      expect(observations[0]?.update).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ messages: item.messages, turnCriteria: ["Ask for jurisdiction."] })
        })
      )
      expect(observations[1]?.update).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            turnCriteria: ["Respect the clarification response."],
            messages: expect.arrayContaining([
              { role: "user", content: `Clarification question: Which jurisdiction?\n${resumed}` }
            ])
          })
        })
      )
      expect(observations[0]?.update).toHaveBeenCalledWith(
        expect.objectContaining({ output: expect.objectContaining({ events: outcome.events }) })
      )
      expect(observations[1]?.update).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            events: [],
            text: "Scoped answer.",
            firstTextMs: expect.any(Number),
            durationMs: expect.any(Number),
            inputTokens: 12
          })
        })
      )
      expect(caseResultSchema.parse(outcome)).toEqual(outcome)
    }
  )

  it.each([
    { kind: "single", response: { status: "answered", selectedIds: ["unknown"], text: "" } },
    { kind: "single", response: { status: "answered", selectedIds: ["ca", "ny"], text: "" } },
    { kind: "multiple", response: { status: "answered", selectedIds: ["ca"], text: "" } },
    { kind: "multiple", response: { status: "answered", selectedIds: ["ca", "ca"], text: "" } },
    { kind: "text", response: { status: "answered", selectedIds: ["ca"], text: "California" } },
    { kind: "text", response: { status: "answered", selectedIds: [], text: "" } },
    { kind: "single", response: { status: "skipped" } }
  ] as const)(
    "marks invalid $kind clarification input ungradable without spending another call",
    async ({ kind, response }) => {
      const model = new MockLanguageModelV4({
        doStream: [streamStep({ tool: { name: "ask_clarification", input: clarificationInput(kind, false) } })]
      })
      const item = caseSchema.parse({ ...sample(), followUps: [response] })
      const outcome = await executeCase({
        item,
        model,
        instructions: "Pinned",
        budget: createCallBudget(3, 180000),
        signal: new AbortController().signal
      })
      expect(outcome.status).toBe("ungradable")
      expect(outcome.followUpFailures).toHaveLength(1)
      expect(outcome.followUpFailures[0]?.turn).toBe(1)
      expect(model.doStreamCalls).toHaveLength(1)
      expect(observations).toHaveLength(1)
    }
  )

  it("rejects structured answers without a pending question and retains normal string turns", async () => {
    const missingQuestion = await executeCase({
      item: caseSchema.parse({ ...sample(), followUps: [{ status: "skipped" }] }),
      model: new MockLanguageModelV4({ doStream: [streamStep()] }),
      instructions: "Pinned",
      budget: createCallBudget(3, 180000),
      signal: new AbortController().signal
    })
    expect(missingQuestion.status).toBe("ungradable")
    expect(missingQuestion.followUpFailures).toHaveLength(1)
    const model = new MockLanguageModelV4({ doStream: [streamStep(), streamStep()] })
    const outcome = await executeCase({
      item: { ...sample(), followUps: ["Explain further."] },
      model,
      instructions: "Pinned",
      budget: createCallBudget(3, 180000),
      signal: new AbortController().signal
    })
    expect(outcome.status).toBe("completed")
    expect(model.doStreamCalls[1]?.prompt.at(-1)).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "Explain further." }]
    })
  })

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
    expect(outcome.costUsd).toBeNull()
    expect(outcome.turns[0]).toMatchObject({
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
      inputTokenDetails: { noCacheTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokenDetails: { textTokens: 2, reasoningTokens: 0 }
    })
    expect(observations).toHaveLength(1)
    expect(observations[0]?.type).toEqual({ asType: "agent" })
    expect(observations[0]?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          messages: sample().messages,
          instructions: "Pinned instructions",
          turnCriteria: []
        }
      })
    )
    expect(observations[0]?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({ text: "Hello.", events: [], inputTokens: 3, durationMs: expect.any(Number) })
      })
    )
    expect(caseResultSchema.parse(outcome)).toEqual(outcome)
    expect(budget.used).toBe(1)
    expect(model.doStreamCalls[0]?.prompt[0]).toMatchObject({
      role: "system",
      content: expect.stringMatching(
        /^Pinned instructions\n\nCite supported findings and state what remains unresolved, including failed reads and incomplete coverage\./
      )
    })
  })
})
