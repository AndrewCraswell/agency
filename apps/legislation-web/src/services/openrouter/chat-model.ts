import { createOpenRouter, type OpenRouterChatSettings } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"

export type ChatModelOptions = {
  provider?: { only: string[] }
  reasoning?: OpenRouterChatSettings["reasoning"] | null
}

export function createChatModel(apiKey: string | undefined, modelId: string, options: ChatModelOptions): LanguageModel {
  return createOpenRouter({ apiKey }).chat(modelId, {
    ...(options.reasoning === null || options.reasoning === undefined ? {} : { reasoning: options.reasoning }),
    provider: { ...options.provider, allow_fallbacks: false, data_collection: "deny" }
  })
}
