import { LangfuseSpanProcessor } from "@langfuse/otel"
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { registerTelemetry } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { expect, it } from "vitest"
import { runResearchAgent } from "./agent"

it("groups streamed model calls by conversation without leaking across concurrent runs", async () => {
  const spans: { sessionId: unknown; traceId: string }[] = []
  const processor = new LangfuseSpanProcessor({
    publicKey: "test-public",
    secretKey: "test-secret",
    mediaUploadEnabled: false,
    exporter: {
      export(batch, callback) {
        for (const span of batch) {
          spans.push({ sessionId: span.attributes["session.id"], traceId: span.spanContext().traceId })
        }
        callback({ code: 0 })
      },
      async shutdown() {
        return undefined
      }
    }
  })
  const sdk = new NodeSDK({ spanProcessors: [processor] })
  sdk.start()
  registerTelemetry(new LangfuseVercelAiSdkIntegration())
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
      const result = runResearchAgent({
        sessionId,
        model,
        instructions: "Test instructions",
        messages: [{ role: "user", content: "Hello" }],
        tools: {},
        signal: new AbortController().signal
      })
      for await (const chunk of result.stream) {
        expect(chunk.type).not.toBe("error")
      }
    }
    await Promise.all([turn("conversation-a"), turn("conversation-b")])
    await turn("conversation-a")
    await processor.forceFlush()
    expect(spans.length).toBeGreaterThanOrEqual(6)
    expect(spans.every((span) => ["conversation-a", "conversation-b"].includes(String(span.sessionId)))).toBe(true)
    const first = new Set(spans.filter((span) => span.sessionId === "conversation-a").map((span) => span.traceId))
    const second = new Set(spans.filter((span) => span.sessionId === "conversation-b").map((span) => span.traceId))
    expect(first.size).toBe(2)
    expect(second.size).toBe(1)
    expect([...first].some((traceId) => second.has(traceId))).toBe(false)
  } finally {
    await sdk.shutdown()
  }
})
