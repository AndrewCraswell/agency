import { createOpenRouter, type OpenRouterChatSettings } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"

export type ChatModelOptions = {
  provider?: { only: string[] }
  reasoning?: OpenRouterChatSettings["reasoning"] | { effort: "max"; enabled?: boolean; exclude?: boolean } | null
}

export function createChatModel(apiKey: string | undefined, modelId: string, options: ChatModelOptions): LanguageModel {
  const reasoning = options.reasoning
  const settings: OpenRouterChatSettings = {
    provider: { ...options.provider, allow_fallbacks: false, data_collection: "deny" }
  }
  if (reasoning !== null && reasoning !== undefined) {
    if ("effort" in reasoning && reasoning.effort === "max") {
      settings.extraBody = { reasoning }
    } else {
      settings.reasoning = reasoning
    }
  }
  return createOpenRouter({ apiKey }).chat(modelId, settings)
}
