import { startActiveObservation } from "@langfuse/tracing"
import { captureException } from "@sentry/nextjs"
import { generateText, Output } from "ai"
import { z } from "zod"
import { createLangfuseClient } from "../../services/langfuse/client"
import { createResearchModel, researchModelId } from "./agent"
import { researchSuggestionsSchema, type ResearchSuggestion } from "./suggestions"

const promptName = "legislative-research-suggestions"
const promptSchema = z.object({
  name: z.literal(promptName),
  type: z.literal("text"),
  version: z.number().int().positive(),
  labels: z.array(z.string()).refine((labels) => labels.includes("production")),
  prompt: z.string().trim().min(1)
})

async function generateSuggestions() {
  return startActiveObservation(
    promptName,
    async (observation) => {
      const signal = AbortSignal.timeout(45000)
      const response = await createLangfuseClient(process.env).request(`v2/prompts/${promptName}?label=production`, {
        cache: "no-store",
        signal,
        timeoutMs: 10000
      })
      if (!response.ok) {
        throw new Error("The managed suggestions prompt is unavailable.")
      }
      const prompt = promptSchema.parse(await response.json())
      const currentDate = new Date().toISOString().slice(0, 10)
      const instructions = prompt.prompt.replaceAll("{{current_date}}", currentDate)
      if (instructions.includes("{{")) {
        throw new Error("The suggestions prompt contains an unsupported variable.")
      }
      observation.update({
        model: researchModelId,
        prompt: { name: prompt.name, version: prompt.version, isFallback: false },
        input: { instructions, currentDate },
        modelParameters: { maxOutputTokens: 2000, reasoning: "low" }
      })
      const result = await generateText({
        model: createResearchModel(process.env.OPENROUTER_API_KEY, researchModelId, { reasoning: { effort: "low" } }),
        instructions,
        prompt: "Generate exactly six fresh, distinct research ideas covering all four research approaches.",
        output: Output.object({ schema: researchSuggestionsSchema }),
        maxOutputTokens: 2000,
        maxRetries: 0,
        abortSignal: signal
      })
      const { suggestions } = researchSuggestionsSchema.parse(result.output)
      observation.update({
        output: suggestions,
        usageDetails: {
          ...(result.totalUsage.inputTokens === undefined ? {} : { input: result.totalUsage.inputTokens }),
          ...(result.totalUsage.outputTokens === undefined ? {} : { output: result.totalUsage.outputTokens })
        }
      })
      return suggestions
    },
    { asType: "generation" }
  )
}

export function getResearchSuggestions(): Promise<ResearchSuggestion[]> {
  if (
    !process.env.OPENROUTER_API_KEY?.trim() ||
    !process.env.LANGFUSE_PUBLIC_KEY?.trim() ||
    !process.env.LANGFUSE_SECRET_KEY?.trim()
  ) {
    return Promise.resolve([])
  }
  return generateSuggestions().catch(() => {
    captureException(new Error("Research suggestions could not be generated."), {
      tags: { operation: "research_suggestions" }
    })
    return []
  })
}
