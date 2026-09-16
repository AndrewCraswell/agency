import { propagateAttributes } from "@langfuse/tracing"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText } from "ai"
import { describe, expect, it, vi } from "vitest"
import { createResearchModel, researchAgentLimits, researchModelId, runResearchAgent } from "./agent"

const { chat } = vi.hoisted(() => ({ chat: vi.fn<() => string>(() => "test-model") }))
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn<() => { chat: typeof chat }>(() => ({ chat }))
}))

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
  it("preserves production model and reasoning defaults", () => {
    createResearchModel(undefined)
    expect(createOpenRouter).toHaveBeenLastCalledWith({ apiKey: undefined })
    expect(chat).toHaveBeenLastCalledWith(researchModelId, {
      reasoning: { effort: "low" },
      provider: { allow_fallbacks: false, data_collection: "deny" }
    })
  })

  it("pins candidate providers and configures or omits reasoning without enabling fallbacks", () => {
    createResearchModel(undefined, "candidate/model", {
      provider: { only: ["provider-a"] },
      reasoning: { max_tokens: 512, exclude: true }
    })
    expect(chat).toHaveBeenLastCalledWith("candidate/model", {
      reasoning: { max_tokens: 512, exclude: true },
      provider: { only: ["provider-a"], allow_fallbacks: false, data_collection: "deny" }
    })
    createResearchModel(undefined, "candidate/model", { reasoning: null })
    expect(chat).toHaveBeenLastCalledWith("candidate/model", {
      provider: { allow_fallbacks: false, data_collection: "deny" }
    })
    createResearchModel(undefined, "candidate/model", { reasoning: { effort: "none" } })
    expect(chat).toHaveBeenLastCalledWith("candidate/model", expect.objectContaining({ reasoning: { effort: "none" } }))
  })

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
