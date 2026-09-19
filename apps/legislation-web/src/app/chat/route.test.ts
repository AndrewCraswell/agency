import { MockLanguageModelV4 } from "ai/test"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { researchToolMeasurementSchema } from "../../modules/conversations/researchMeasurement"
import { POST } from "./route"

const { stored, getBillText, capturedInputs } = vi.hoisted(() => ({
  stored: new Map<string, unknown>(),
  getBillText: vi.fn<() => Promise<unknown>>(async () => ({
    billId: "bill:us:119:s:2367",
    document: {
      id: "document:2367:is",
      billId: "bill:us:119:s:2367",
      versionCode: "is",
      title: "Introduced text",
      sourceUrl: "https://www.congress.gov/119/bills/s2367/BILLS-119s2367is.htm"
    },
    sections: [
      {
        id: "section:3",
        documentId: "document:2367:is",
        sectionIdentifier: "3",
        text: "A person may bring a civil action."
      }
    ],
    nextCursor: "stale-continuation"
  })),
  capturedInputs: [] as unknown[]
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn<(error: unknown) => void>(),
  setTag: vi.fn<(name: string, value: string) => void>(),
  withIsolationScope: (run: () => unknown) => run()
}))
vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, run: () => unknown) => run()
}))
vi.mock("next/server", () => ({ after: vi.fn<() => void>() }))
vi.mock("../../modules/conversations/telemetry", () => ({ flushChatTelemetry: vi.fn<() => Promise<void>>() }))
vi.mock("../../modules/conversations/prompt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/conversations/prompt")>()),
  getResearchPrompt: async () => ({ prompt: "Answer from evidence.", version: 1, name: "fixture" })
}))
vi.mock("../../modules/conversations/snapshotPersistence.server", () => ({
  researchSnapshotPersistence: {
    save: async (id: string, value: unknown) => {
      stored.set(id, structuredClone(value))
    },
    read: async (_sessionKey: string, id: string) => structuredClone(stored.get(id))
  }
}))
vi.mock("../../modules/legislation/runtime/runtime", () => ({
  getNextLegislationApplication: () => ({ queryService: { getBillText } })
}))
vi.mock("../../modules/search/research-runtime", () => ({
  getResearchRuntime: () => ({
    run: (callback: (service: { getBillText: typeof getBillText }) => unknown) => callback({ getBillText })
  })
}))
vi.mock("../../modules/conversations/capture", () => ({
  observeChatResponse: (options: { input: unknown; start: () => unknown }) => {
    capturedInputs.push(options.input)
    return { stream: Promise.resolve(options.start()), completed: Promise.resolve(), getCorrelation: () => ({}) }
  }
}))
let model: MockLanguageModelV4
vi.mock("../../modules/conversations/agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/conversations/agent")>()),
  createResearchModel: () => model
}))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  stored.clear()
  capturedInputs.length = 0
})

it("streams an explicit incomplete answer and persists its interruption without rewriting the finish reason", async () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("OPENROUTER_API_KEY", "fixture")
  model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] })
          controller.enqueue({
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 0, text: 0, reasoning: 0 }
            }
          })
          controller.close()
        }
      })
    })
  })
  const response = await POST(
    new Request("http://localhost:3000/chat", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({
        sessionKey: "11111111-1111-4111-8111-111111111111",
        sessionId: "empty-research",
        messages: [{ id: "question", role: "user", parts: [{ type: "text", text: "What must agencies disclose?" }] }]
      })
    })
  )
  expect(response.status).toBe(200)
  const stream = await response.text()
  expect(stream).toContain("Research ended before an answer was completed. Narrow the question and try again.")
  expect(stream).toContain('"finishReason":"stop"')
  expect(stream).toContain('"type":"data-response-outcome"')
  expect(stream).toContain('"status":"partial"')
  expect(stream).toContain('"hasAnswer":false')
  expect([...stored.values()]).toContainEqual(expect.objectContaining({ kind: "research-turn", interrupted: true }))
})

it("persists a turn and restores it through POST into the next model request and citation stream", async () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("OPENROUTER_API_KEY", "fixture")
  const owner = { sessionKey: "11111111-1111-4111-8111-111111111111", sessionId: "research-conversation" }
  let isFollowUp = false
  model = new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const hasResult = prompt.some((message) => message.role === "tool")
      const shouldRead = !isFollowUp && !hasResult
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] })
            if (shouldRead) {
              controller.enqueue({
                type: "tool-call",
                toolCallId: "read-text",
                toolName: "get_bill_text",
                input: JSON.stringify({
                  id: "bill:us:119:s:2367",
                  documentId: "document:2367:is",
                  versionCode: null,
                  cursor: null,
                  limit: null
                })
              })
            } else {
              controller.enqueue({ type: "text-start", id: "answer" })
              controller.enqueue({
                type: "text-delta",
                id: "answer",
                delta: "The proposed remedy permits civil actions."
              })
              controller.enqueue({ type: "text-end", id: "answer" })
            }
            controller.enqueue({
              type: "finish",
              finishReason: { unified: shouldRead ? "tool-calls" : "stop", raw: "stop" },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 }
              }
            })
            controller.close()
          }
        })
      }
    }
  })
  const question = { id: "first", role: "user", parts: [{ type: "text", text: "Read section 3." }] }
  async function send(messages: unknown[]) {
    const response = await POST(
      new Request("http://localhost:3000/chat", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ ...owner, messages })
      })
    )
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).not.toContain('"type":"error"')
    return text
  }
  const initialStream = await send([question])
  const measurementChunks = initialStream.split("\n").flatMap((line) => {
    if (!line.startsWith("data: ") || line === "data: [DONE]") {
      return []
    }
    const parsed = z
      .object({
        type: z.literal("data-tool-measurement"),
        data: researchToolMeasurementSchema
      })
      .safeParse(JSON.parse(line.slice(6)))
    return parsed.success ? [parsed.data.data] : []
  })
  expect(measurementChunks).toHaveLength(1)
  expect(measurementChunks[0]).toMatchObject({
    toolCallId: "read-text",
    toolName: "get_bill_text",
    outcome: "success",
    durationMs: expect.any(Number),
    rawResultBytes: expect.any(Number),
    enrichedResultBytes: expect.any(Number),
    modelResultBytes: expect.any(Number),
    attemptCount: 1
  })
  expect(getBillText).toHaveBeenCalledTimes(1)
  const runId = [...stored].find(
    ([, value]) => z.object({ kind: z.literal("research-turn") }).safeParse(value).success
  )?.[0]
  expect(runId).toBeDefined()
  expect(stored.size).toBe(2)
  isFollowUp = true
  const stream = await send([
    question,
    { id: "answer", role: "assistant", researchRunId: runId, parts: [{ type: "text", text: "Prior answer." }] },
    { id: "next", role: "user", parts: [{ type: "text", text: "What remains uncertain?" }] }
  ])
  expect(getBillText).toHaveBeenCalledTimes(1)
  const followUpInput = JSON.stringify(model.doStreamCalls.at(-1)?.prompt)
  expect(followUpInput).toContain("A person may bring a civil action.")
  expect(followUpInput).toContain("document:2367:is")
  expect(followUpInput).toContain("hasMore")
  expect(followUpInput).not.toContain("stale-continuation")
  expect(stream).toContain('"type":"data-research-context"')
  expect(stream).toContain("A person may bring a civil action.")
  expect(stream).not.toContain("stale-continuation")
  expect(stored.size).toBe(3)
  const captured = z.object({ messages: z.array(z.object({ content: z.string() })) }).parse(capturedInputs[1])
  expect(captured.messages.some((message) => message.content.includes("Server-retained research"))).toBe(true)
})

it.each([
  { now: "2026-09-18T18:08:54.999Z", date: "2026-09-18", cutoff: "2026-09-17" },
  { now: "2026-09-18T18:08:54.999Z", date: "2026-09-18", cutoff: "2026-09-18" },
  { now: "2026-09-18T18:08:54.999Z", date: "2026-09-18", cutoff: "2026-09-19" },
  { now: "2026-09-18T23:59:59.999Z", date: "2026-09-18", cutoff: "2026-09-18" },
  { now: "2026-09-19T00:00:00.000Z", date: "2026-09-19", cutoff: "2026-09-18" },
  { now: "2026-09-18T23:30:00-07:00", date: "2026-09-19", cutoff: "2026-09-18 in America/Los_Angeles" }
])("supplies trusted UTC context at $now without rewriting cutoff $cutoff", async ({ now, date, cutoff }) => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(now))
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("OPENROUTER_API_KEY", "fixture")
  const timestamp = new Date(now).toISOString()
  const question = `Compare proposals as of ${cutoff}.`
  const clarification = {
    kind: "single",
    question: "Which jurisdiction should the comparison cover?",
    description: "The jurisdiction determines which proposals are relevant.",
    allowSkip: false,
    allowFreeText: true,
    options: [
      { id: "federal", label: "Federal proposals", description: null },
      { id: "state", label: "State proposals", description: null }
    ],
    minSelections: null,
    maxSelections: null
  }
  for (const responseKind of ["prose", "clarification"]) {
    model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] })
            if (responseKind === "clarification") {
              controller.enqueue({
                type: "tool-call",
                toolCallId: "scope",
                toolName: "ask_clarification",
                input: JSON.stringify(clarification)
              })
            } else {
              controller.enqueue({ type: "text-start", id: "answer" })
              controller.enqueue({ type: "text-delta", id: "answer", delta: "Source coverage requires verification." })
              controller.enqueue({ type: "text-end", id: "answer" })
            }
            controller.enqueue({
              type: "finish",
              finishReason: { unified: responseKind === "clarification" ? "tool-calls" : "stop", raw: "stop" },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 }
              }
            })
            controller.close()
          }
        })
      })
    })
    const response = await POST(
      new Request("http://localhost:3000/chat", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({
          sessionKey: crypto.randomUUID(),
          sessionId: "date-context",
          currentDate: "2099-01-01",
          messages: [{ id: "question", role: "user", parts: [{ type: "text", text: question }] }]
        })
      })
    )
    expect(response.status).toBe(200)
    const stream = await response.text()
    expect(stream).not.toContain('"type":"error"')
    expect(stream).toContain(`"acceptedAt":"${timestamp}"`)
    const input = model.doStreamCalls[0]?.prompt
    const system = input
      ?.filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n")
    const captured = z.object({ dateContext: z.string() }).parse(capturedInputs.at(-1))
    expect(captured.dateContext).toContain(JSON.stringify({ timestamp, currentDate: date, timeZone: "UTC" }))
    expect(system).toContain(captured.dateContext)
    expect(system).not.toContain("2099-01-01")
    expect(input).toContainEqual({ role: "user", content: [{ type: "text", text: question }] })
    const expectedText =
      responseKind === "clarification"
        ? [clarification.question, clarification.description, ...clarification.options.map((option) => option.label)]
        : ["Source coverage requires verification."]
    for (const text of expectedText) {
      expect(stream).toContain(text)
    }
  }
})
