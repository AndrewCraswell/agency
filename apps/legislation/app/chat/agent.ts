import { propagateAttributes } from "@langfuse/tracing"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { hasToolCall, isStepCount, streamText, type LanguageModel, type ModelMessage, type ToolSet } from "ai"

export const researchAgentLimits = { steps: 8, calls: 24, timeoutMs: 120000, outputTokens: 4096 }
export const researchModelId = "openai/gpt-5.6-luna-20260709"

export function createResearchModel(apiKey: string | undefined, modelId = researchModelId): LanguageModel {
  return createOpenRouter({ apiKey }).chat(modelId, {
    reasoning: { effort: "low" },
    provider: { allow_fallbacks: false, data_collection: "deny" }
  })
}

export function runResearchAgent(options: {
  sessionId: string
  captureId?: string
  model: LanguageModel
  instructions: string
  messages: ModelMessage[]
  tools: ToolSet
  signal: AbortSignal
  onChunk?: Parameters<typeof streamText>[0]["onChunk"]
  prepareStep?: Parameters<typeof streamText>[0]["prepareStep"]
}): ReturnType<typeof streamText<ToolSet>> {
  return propagateAttributes(
    { sessionId: options.sessionId, ...(options.captureId ? { metadata: { captureId: options.captureId } } : {}) },
    () =>
      streamText({
        model: options.model,
        instructions: options.instructions,
        messages: options.messages,
        tools: options.tools,
        stopWhen: [isStepCount(researchAgentLimits.steps), hasToolCall("ask_clarification")],
        maxOutputTokens: researchAgentLimits.outputTokens,
        maxRetries: 0,
        onChunk: options.onChunk,
        prepareStep: options.prepareStep,
        abortSignal: options.signal
      })
  )
}
