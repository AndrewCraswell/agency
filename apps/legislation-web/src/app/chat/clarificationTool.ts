import { dynamicTool } from "ai"
import { z } from "zod"
import { clarificationInputSchema } from "../lib/clarification"
import { clarificationStore } from "./clarificationStore"

const inputSchema = z.object({
  kind: z.enum(["text", "single", "multiple"]),
  question: z.string().trim().min(1).max(500),
  description: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .nullable()
    .describe("Briefly explain why this detail changes the research, or use null when obvious."),
  allowSkip: z.boolean(),
  allowFreeText: z.boolean(),
  options: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(128),
        label: z.string().trim().min(1).max(240),
        description: z.string().trim().min(1).max(500).nullable()
      })
    )
    .min(2)
    .max(12)
    .nullable()
    .describe("Use null for a text question. Options are research preferences, not record identities."),
  minSelections: z.number().int().min(1).max(12).nullable().describe("Use null except for multiple choice."),
  maxSelections: z.number().int().min(1).max(12).nullable().describe("Use null except for multiple choice.")
})

export function createClarificationTool(
  sessionKey: string,
  signal: AbortSignal,
  onPending: () => void,
  store = clarificationStore
): ReturnType<typeof dynamicTool> {
  return dynamicTool({
    description:
      "Pause to ask one research-scope question when missing jurisdiction, period, or comparison preference materially changes the answer. Never request secrets, approvals, personal data, or fabricated record choices. Use text, single or multiple choice. This is not a mandatory onboarding step. Do not call other tools in the same step.",
    inputSchema,
    execute: async (input) => {
      signal.throwIfAborted()
      const parsed = inputSchema.parse(input)
      const question = clarificationInputSchema.parse({
        kind: parsed.kind,
        question: parsed.question,
        description: parsed.description ?? undefined,
        allowSkip: parsed.allowSkip,
        ...(parsed.kind !== "text" && {
          allowFreeText: parsed.allowFreeText,
          options: parsed.options?.map((option) => ({ ...option, description: option.description ?? undefined }))
        }),
        ...(parsed.kind === "multiple" && { minSelections: parsed.minSelections, maxSelections: parsed.maxSelections })
      })
      const clarification = store.create(sessionKey, question)
      onPending()
      return { clarification }
    }
  })
}
