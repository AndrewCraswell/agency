import { propagateAttributes } from "@langfuse/tracing"
import { hasToolCall, isStepCount, streamText, type LanguageModel, type ModelMessage, type ToolSet } from "ai"
import { createChatModel, type ChatModelOptions } from "../../services/openrouter/chat-model"

export const researchAgentLimits = { steps: 8, calls: 24, timeoutMs: 120000, outputTokens: 4096 }
export const researchModelId = "openai/gpt-5.6-luna-20260709"
export const researchReasoningEffort = "high"

export type ResearchModelConfig = {
  provider?: { only: string[] }
  reasoning?: ChatModelOptions["reasoning"]
}

export function createResearchModel(
  apiKey: string | undefined,
  modelId = researchModelId,
  config: ResearchModelConfig = {}
): LanguageModel {
  const reasoning: ChatModelOptions["reasoning"] =
    config.reasoning === undefined ? { effort: researchReasoningEffort } : config.reasoning
  return createChatModel(apiKey, modelId, { ...config, reasoning })
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
    {
      traceName: "legislative-research-conversation",
      sessionId: options.sessionId,
      ...(options.captureId ? { metadata: { captureId: options.captureId } } : {})
    },
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
