import { MockLanguageModelV4 } from "ai/test"
import { expect, it } from "vitest"
import { startLangfuseTelemetry } from "../../services/langfuse/telemetry"
import { runResearchAgent } from "./agent"
import { observeChatResponse } from "./capture"

it("groups streamed model calls by conversation without leaking across concurrent runs", async () => {
  const spans: {
    sessionId: unknown
    traceId: string
    traceName: unknown
    observationType: unknown
    parentId: string | undefined
    name: string
    input: unknown
    output: unknown
    captureId: unknown
  }[] = []
  const telemetry = startLangfuseTelemetry({
    publicKey: "test-public",
    secretKey: "test-secret",
    mediaUploadEnabled: false,
    exporter: {
      export(batch, callback) {
        for (const span of batch) {
          spans.push({
            sessionId: span.attributes["session.id"],
            traceId: span.spanContext().traceId,
            traceName: span.attributes["langfuse.trace.name"],
            observationType: span.attributes["gen_ai.operation.name"],
            parentId: span.parentSpanContext?.spanId,
            name: span.name,
            input: span.attributes["langfuse.observation.input"],
            output: span.attributes["langfuse.observation.output"],
            captureId: span.attributes["langfuse.trace.metadata.captureId"]
          })
        }
        callback({ code: 0 })
      },
      async shutdown() {
        return undefined
      }
    }
  })
  try {
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
    const turn = async (sessionId: string) => {
      const captured = observeChatResponse({
        sessionId,
        input: { question: "Hello" },
        metadata: { captureId: sessionId },
        start: () =>
          runResearchAgent({
            sessionId,
            model,
            instructions: "Test instructions",
            messages: [{ role: "user", content: "Hello" }],
            tools: {},
            signal: new AbortController().signal
          }).stream
      })
      for await (const chunk of await captured.stream) {
        expect(chunk.type).not.toBe("error")
      }
      await captured.completed
    }
    await Promise.all([turn("conversation-a"), turn("conversation-b")])
    await turn("conversation-a")
    await telemetry.flush()
    expect(spans.length).toBeGreaterThanOrEqual(6)
    expect(spans.every((span) => ["conversation-a", "conversation-b"].includes(String(span.sessionId)))).toBe(true)
    expect(spans.every((span) => span.traceName === "legislative-research-conversation")).toBe(true)
    expect(spans.filter((span) => span.observationType === "chat")).toHaveLength(3)
    expect(spans.every((span) => span.captureId === span.sessionId)).toBe(true)
    const roots = spans.filter((span) => !span.parentId)
    expect(roots).toHaveLength(3)
    for (const root of roots) {
      expect(root.name).toBe("legislative-research-conversation")
      expect(JSON.parse(String(root.input))).toEqual({ question: "Hello" })
      expect(JSON.parse(String(root.output))).toMatchObject({ output: { text: "Hello." } })
    }
    const first = new Set(spans.filter((span) => span.sessionId === "conversation-a").map((span) => span.traceId))
    const second = new Set(spans.filter((span) => span.sessionId === "conversation-b").map((span) => span.traceId))
    expect(first.size).toBe(2)
    expect(second.size).toBe(1)
    expect([...first].some((traceId) => second.has(traceId))).toBe(false)
  } finally {
    await telemetry.shutdown()
  }
})
