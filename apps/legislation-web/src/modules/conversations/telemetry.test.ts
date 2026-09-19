import { MockLanguageModelV4 } from "ai/test"
import { expect, it } from "vitest"
import { startNodeTelemetry } from "../../services/sentry/nodeTelemetry"
import { runResearchAgent } from "./agent"
import { observeChatResponse } from "./capture"
import { redactCredentials } from "./redactCredentials"

it("groups streamed model calls by conversation and redacts credentials without changing public research", async () => {
  const research =
    "https://EXAMPLE.org:443/bill?id=AB%202\nBasic Grant rules. See [source](https://reader:synthetic@EXAMPLE.org:443/bill(2)?sessionKey=synthetic(secret)&id=AB%202#access_token=synthetic&section=Part%202). Path: https://example.org/sk-or-v1-synthetic-key"
  const expectedResearch =
    "https://EXAMPLE.org:443/bill?id=AB%202\nBasic Grant rules. See [source](https://EXAMPLE.org:443/bill(2)?id=AB%202#section=Part%202). Path: https://example.org/[REDACTED]"
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
    source: unknown
    attributes: unknown
  }[] = []
  const telemetry = startNodeTelemetry({
    langfuse: {
      publicKey: "test-public",
      secretKey: "test-secret",
      mediaUploadEnabled: false,
      mask: ({ data }) => redactCredentials(data),
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
              captureId: span.attributes["langfuse.trace.metadata.captureId"],
              source: span.attributes["langfuse.trace.metadata.source"],
              attributes: span.attributes
            })
          }
          callback({ code: 0 })
        },
        async shutdown() {
          return undefined
        }
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
            controller.enqueue({ type: "text-delta", id: "text", delta: research })
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
        input: { question: research, reasoning_details: [{ data: "synthetic-reasoning" }] },
        metadata: {
          captureId: sessionId,
          source: "https://EXAMPLE.org:443/bill?sessionKey=synthetic(secret)&id=AB%202"
        },
        start: () =>
          runResearchAgent({
            sessionId,
            model,
            instructions: "Test instructions",
            messages: [{ role: "user", content: research }],
            tools: {},
            signal: new AbortController().signal
          }).stream
      })
      for await (const chunk of await captured.stream) {
        expect(chunk.type).not.toBe("error")
      }
      expect(captured.getTraceId()).toMatch(/^[a-f0-9]{32}$/)
      await captured.completed
    }
    await Promise.all([turn("conversation-a"), turn("conversation-b")])
    await turn("conversation-a")
    await telemetry.flush()
    expect(JSON.stringify(spans)).not.toContain("synthetic")
    expect(spans.length).toBeGreaterThanOrEqual(6)
    expect(spans.every((span) => ["conversation-a", "conversation-b"].includes(String(span.sessionId)))).toBe(true)
    expect(spans.every((span) => span.traceName === "legislative-research-conversation")).toBe(true)
    expect(spans.filter((span) => span.observationType === "chat")).toHaveLength(3)
    expect(spans.every((span) => span.captureId === span.sessionId)).toBe(true)
    expect(spans.every((span) => span.source === "https://EXAMPLE.org:443/bill?id=AB%202")).toBe(true)
    const roots = spans.filter((span) => !span.parentId)
    expect(roots).toHaveLength(3)
    for (const root of roots) {
      expect(root.name).toBe("legislative-research-conversation")
      expect(JSON.parse(String(root.input))).toEqual({ question: expectedResearch })
      expect(JSON.parse(String(root.output))).toMatchObject({ output: { text: expectedResearch } })
    }
    const generations = spans.filter((span) => span.observationType === "chat")
    for (const generation of generations) {
      expect(generation.input).toBeUndefined()
      expect(generation.output).toBeUndefined()
      expect(generation.attributes).not.toHaveProperty("gen_ai.input.messages")
      expect(generation.attributes).not.toHaveProperty("gen_ai.output.messages")
      expect(JSON.stringify(generation)).not.toContain("synthetic")
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
