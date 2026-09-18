import { MockLanguageModelV4 } from "ai/test"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
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
vi.mock("../../modules/conversations/prompt", () => ({
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
    return { stream: Promise.resolve(options.start()), completed: Promise.resolve(), getTraceId: () => null }
  }
}))
let model: MockLanguageModelV4
vi.mock("../../modules/conversations/agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/conversations/agent")>()),
  createResearchModel: () => model
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  stored.clear()
  capturedInputs.length = 0
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
  await send([question])
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
