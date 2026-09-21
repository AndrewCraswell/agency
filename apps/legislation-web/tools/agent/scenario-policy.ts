import { z } from "zod"
import { responseOutcomeSchema } from "../../src/modules/conversations/responseOutcome"

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
const text = z.string().trim().min(1)
const jurisdictions = z
  .array(text)
  .min(1)
  .refine((items) => new Set(items).size === items.length)

export const scenarioSchema = z
  .strictObject({
    id: identifier,
    objective: text,
    jurisdictions,
    acceptedNarrowing: z.strictObject({ jurisdictions, reason: text }).optional(),
    adaptive: z.strictObject({ persona: text, constraints: z.array(text).default([]) }).optional(),
    steps: z.array(z.strictObject({ id: identifier, prompt: text })).min(1)
  })
  .superRefine((scenario, context) => {
    if (scenario.acceptedNarrowing?.jurisdictions.some((name) => !scenario.jurisdictions.includes(name))) {
      context.addIssue({
        code: "custom",
        path: ["acceptedNarrowing"],
        message: "Narrowing must use authored jurisdictions."
      })
    }
    if (new Set(scenario.steps.map((step) => step.id)).size !== scenario.steps.length) {
      context.addIssue({ code: "custom", path: ["steps"], message: "Goal IDs must be unique." })
    }
  })
export type Scenario = z.infer<typeof scenarioSchema>

export const snapshotSchema = z
  .object({
    format: z.literal("rostra-conversation"),
    schemaVersion: z.literal(1),
    conversationId: z.string(),
    interactionStatus: z.string(),
    messages: z.array(
      z.object({ id: z.string(), role: z.string(), parts: z.array(z.record(z.string(), z.unknown())) }).passthrough()
    ),
    responseOutcomes: z.array(responseOutcomeSchema.extend({ messageId: z.string() })),
    toolCalls: z.array(
      z
        .object({
          messageId: z.string(),
          toolCallId: z.string(),
          toolName: z.string(),
          state: z.string(),
          output: z.unknown().optional(),
          error: z.unknown().optional()
        })
        .passthrough()
    )
  })
  .passthrough()
export type Snapshot = z.infer<typeof snapshotSchema>

export function approvedJurisdictions(scenario: Scenario) {
  return scenario.acceptedNarrowing?.jurisdictions ?? scenario.jurisdictions
}

export const adaptiveDecisionSchema = z.strictObject({
  action: z.enum(["follow-up", "clarify", "finish", "pause"]),
  text: z.string().trim(),
  optionLabels: z.array(text),
  reason: text
})
export type AdaptiveDecision = z.infer<typeof adaptiveDecisionSchema>
export type VisibleConversation = {
  transcript: string
  clarification: { question: string; optionLabels: string[]; allowsText: boolean; multiple: boolean } | null
  hasFailure: boolean
}

export function validateAdaptiveDecision(visible: VisibleConversation, decision: AdaptiveDecision) {
  if (decision.action === "pause" || decision.action === "finish") {
    if (decision.text || decision.optionLabels.length) {
      throw new Error("A finish or pause decision must not submit a question.")
    }
    if (decision.action === "finish" && visible.clarification) {
      throw new Error("Answer or explicitly pause the pending clarification before finishing.")
    }
    return decision
  }
  if (decision.action === "clarify") {
    const clarification = visible.clarification
    if (
      !clarification ||
      (!clarification.allowsText && decision.text) ||
      (!clarification.multiple && decision.optionLabels.length > 1) ||
      new Set(decision.optionLabels).size !== decision.optionLabels.length ||
      decision.optionLabels.some(
        (label) => clarification.optionLabels.filter((option) => option === label).length !== 1
      ) ||
      (!decision.text && !decision.optionLabels.length)
    ) {
      throw new Error("Adaptive answer does not match the visible clarification controls.")
    }
  } else if (visible.clarification || !decision.text || decision.optionLabels.length) {
    throw new Error("A follow-up requires text and no pending clarification or selected options.")
  }
  const submitted =
    decision.action === "clarify" ? [...decision.optionLabels, decision.text].filter(Boolean).join("\n") : decision.text
  if (submitted.length > 24_000) {
    throw new Error("The application accepts at most 24000 characters per message; shorten this question.")
  }
  return decision
}

export function applicationUrl(value: string) {
  const url = new URL(value)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Use an explicitly authorized HTTP(S) application URL without credentials, query, or fragment.")
  }
  return url
}
