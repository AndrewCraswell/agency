import { isToolUIPart, getToolName, type UIMessage } from "ai"
import { z } from "zod"
import { redactCredentials } from "./redactCredentials"
import { researchToolMeasurementSchema } from "./researchMeasurement"
import { messageResponseOutcome } from "./responseOutcome"

export function createConversationExport(options: {
  conversationId: string
  messages: readonly UIMessage[]
  status: string
  interruptedMessageId?: string
  replayId?: string
  clarificationAnswers?: unknown
}) {
  const lastMessage = options.messages.at(-1)
  const toolCalls = options.messages.flatMap((message, messageIndex) => {
    const metadata = z.object({ runId: z.string() }).safeParse(message.metadata)
    const measurements = message.parts.flatMap((part) => {
      if (part.type !== "data-tool-measurement") {
        return []
      }
      const parsed = researchToolMeasurementSchema.safeParse(part.data)
      return parsed.success && (!metadata.success || parsed.data.runId === metadata.data.runId) ? [parsed.data] : []
    })
    return message.parts.filter(isToolUIPart).map((part, callIndex) => {
      const measurement =
        measurements.findLast(
          (entry) => entry.toolCallId === part.toolCallId && entry.toolName === getToolName(part)
        ) ?? null
      return {
        messageId: message.id,
        messageIndex,
        callIndex,
        toolCallId: part.toolCallId,
        toolName: getToolName(part),
        state: part.state,
        input: part.input ?? null,
        output: "output" in part ? part.output : null,
        error: "errorText" in part ? part.errorText : null,
        durationMs: measurement?.durationMs ?? null,
        resultBytes: measurement?.enrichedResultBytes ?? null,
        measurement
      }
    })
  })
  return redactCredentials({
    format: "rostra-conversation",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    conversationId: options.conversationId,
    sessionId: options.conversationId,
    interactionStatus: options.status,
    currentResponseOutcome: lastMessage ? messageResponseOutcome(lastMessage) : null,
    responseOutcomes: options.messages
      .filter((message) => message.role === "assistant")
      .map((message) => ({ messageId: message.id, ...messageResponseOutcome(message) })),
    interruptedMessageId: options.interruptedMessageId ?? null,
    replayId: options.replayId ?? null,
    messages: options.messages.map((message) => ({
      ...message,
      parts: message.parts.filter((part) => part.type !== "reasoning")
    })),
    clarificationAnswers: options.clarificationAnswers ?? {},
    toolCalls,
    capture: {
      source: "browser-conversation-snapshot",
      toolCallCount: toolCalls.length,
      limitations: [
        "Only messages retained in this browser conversation are included; replaced or regenerated responses may be absent.",
        "Tool calls are message snapshots, not a complete server execution ledger. Measurements cover observed wrapper attempts; internal dependency retries, model usage and cost are not inferred.",
        "durationMs covers the whole tool wrapper; dependencyDurationMs covers its dependency invocation, not pure database time. rawResultBytes measures prepared structuredContent, not full database rows. resultBytes measures the enriched JSON projection; modelResultBytes measures serialized model-facing text separately. Rejected projections can retain attempted byte counts, not proof of successful delivery.",
        "Interaction readiness is not answer completion. Response outcomes retain observed finish reasons; an absent reason is unknown, not evidence of a timeout or explicit Stop.",
        "Result payloads may be truncated by research limits or updated by pagination. Missing metrics are null, not zero.",
        "Replay ID identifies the current browser recording when available; earlier recordings may differ.",
        "Known credential fields and reasoning are removed. Research content may still contain sensitive information."
      ]
    }
  })
}

export function downloadConversationExport(conversationId: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `rostra-conversation-${conversationId.replace(/[^a-z0-9_-]/gi, "_")}.json`
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
