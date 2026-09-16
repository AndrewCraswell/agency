import { propagateAttributes } from "@langfuse/tracing"
import { streamText } from "ai"
import { describe, expect, it, vi } from "vitest"
import { researchAgentLimits, runResearchAgent } from "./agent"

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: vi.fn<(_attributes: unknown, operation: () => unknown) => unknown>((_attributes, operation) =>
    operation()
  )
}))

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText: vi.fn<() => { stream: string }>(() => ({ stream: "test-stream" }))
}))

describe("runResearchAgent", () => {
  it("shares the injected prompt, model, tools and production limits", () => {
    const signal = new AbortController().signal
    const onChunk = vi.fn<() => void>()
    const result = runResearchAgent({
      sessionId: "conversation-123",
      model: "test-model",
      instructions: "Pinned instructions",
      messages: [{ role: "user", content: "Research this bill" }],
      tools: {},
      signal,
      onChunk
    })

    expect(result).toEqual({ stream: "test-stream" })
    expect(propagateAttributes).toHaveBeenCalledWith({ sessionId: "conversation-123" }, expect.any(Function))
    expect(streamText).toHaveBeenCalledWith({
      model: "test-model",
      instructions: "Pinned instructions",
      messages: [{ role: "user", content: "Research this bill" }],
      tools: {},
      stopWhen: [expect.any(Function), expect.any(Function)],
      maxOutputTokens: researchAgentLimits.outputTokens,
      maxRetries: 0,
      onChunk,
      prepareStep: undefined,
      abortSignal: signal
    })
  })
})
