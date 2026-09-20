import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { z } from "zod"
import { clarificationRequestSchema } from "./clarification"
import { presentationBlockSchema } from "./composition"

export const incompleteAnswerText = "Research ended before an answer was completed. Narrow the question and try again."

export const responseOutcomeSchema = z.object({
  status: z.enum(["completed", "clarification", "partial", "cancelled", "exhausted", "failed", "unknown"]),
  finishReason: z.string().nullable(),
  hasAnswer: z.boolean(),
  pendingToolCalls: z.array(z.string()),
  failedToolCalls: z.array(z.string())
})
export type ResponseOutcome = z.infer<typeof responseOutcomeSchema>

const observationSchema = z.object({
  finishReason: z.string().nullable().default(null),
  isAbort: z.boolean().default(false),
  isError: z.boolean().default(false),
  isDisconnect: z.boolean().default(false),
  isCancelled: z.boolean().default(false)
})

export function classifyResponse(options: {
  hasAnswer: boolean
  hasClarification?: boolean
  finishReason?: string | null
  pendingToolCalls?: string[]
  failedToolCalls?: string[]
  isCancelled?: boolean
  isError?: boolean
  isInterrupted?: boolean
}): ResponseOutcome {
  const pendingToolCalls = options.pendingToolCalls ?? []
  const failedToolCalls = options.failedToolCalls ?? []
  const finishReason = options.finishReason ?? null
  let status: ResponseOutcome["status"] = "unknown"
  if (options.isCancelled) {
    status = "cancelled"
  } else if (finishReason === "length") {
    status = "exhausted"
  } else if (
    options.hasClarification &&
    pendingToolCalls.length === 0 &&
    finishReason !== "error" &&
    finishReason !== "content-filter" &&
    !options.isError &&
    !options.isInterrupted
  ) {
    status = "clarification"
  } else if (
    options.hasAnswer &&
    finishReason === "stop" &&
    pendingToolCalls.length === 0 &&
    !options.isInterrupted &&
    !options.isError
  ) {
    status = "completed"
  } else if (options.hasAnswer) {
    status = "partial"
  } else if (
    options.isError ||
    finishReason === "error" ||
    finishReason === "content-filter" ||
    failedToolCalls.length
  ) {
    status = "failed"
  } else if (finishReason === "stop") {
    status = "partial"
  }
  return { status, finishReason, hasAnswer: options.hasAnswer, pendingToolCalls, failedToolCalls }
}

export function messageResponseOutcome(message: UIMessage): ResponseOutcome {
  const recorded = message.parts
    .flatMap((part) => {
      if (part.type !== "data-response-outcome") {
        return []
      }
      const parsed = responseOutcomeSchema.safeParse(part.data)
      return parsed.success ? [parsed.data] : []
    })
    .at(-1)
  const metadata = z.object({ responseObservation: observationSchema }).safeParse(message.metadata)
  const observation = metadata.success ? metadata.data.responseObservation : undefined
  // A delivered terminal answer is not undone by an ambiguous late transport failure.
  if (recorded && (!observation?.isCancelled || recorded.status === "completed")) {
    return recorded
  }
  const tools = message.parts.filter(isToolUIPart)
  const hasAnswer =
    message.role === "assistant" &&
    message.parts.some((part) => {
      if (part.type === "text") {
        return Boolean(part.text.replace(incompleteAnswerText, "").trim())
      }
      const block = part.type === "data-presentation" ? presentationBlockSchema.safeParse(part.data) : undefined
      return block?.success && block.data.state === "ready"
    })
  const hasClarification =
    message.role === "assistant" &&
    tools.some((part) => {
      if (getToolName(part) !== "ask_clarification" || part.state !== "output-available") {
        return false
      }
      return z.object({ clarification: clarificationRequestSchema }).safeParse(part.output).success
    })
  const hasFailedPresentation = message.parts.some((part) => {
    const block = part.type === "data-presentation" ? presentationBlockSchema.safeParse(part.data) : undefined
    return block?.success && block.data.state === "error"
  })
  return classifyResponse({
    hasAnswer: recorded?.hasAnswer ?? hasAnswer,
    hasClarification,
    finishReason: recorded?.finishReason ?? observation?.finishReason,
    pendingToolCalls: tools
      .filter(
        (part) => part.state !== "output-available" && part.state !== "output-error" && part.state !== "output-denied"
      )
      .map((part) => part.toolCallId),
    failedToolCalls: tools.filter((part) => part.state === "output-error").map((part) => part.toolCallId),
    isCancelled: observation?.isCancelled,
    isError: observation?.isError || hasFailedPresentation,
    isInterrupted: observation?.isAbort || observation?.isDisconnect
  })
}

export function responseIsIncomplete(outcome: ResponseOutcome) {
  return outcome.status !== "completed" && outcome.status !== "clarification"
}
