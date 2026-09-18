import { isToolUIPart, getToolName, type UIMessage } from "ai"
import { redactCredentials } from "./redactCredentials"

export function createConversationExport(options: {
  conversationId: string
  messages: readonly UIMessage[]
  status: string
  interruptedMessageId?: string
  replayId?: string
  clarificationAnswers?: unknown
}) {
  const toolCalls = options.messages.flatMap((message, messageIndex) =>
    message.parts.filter(isToolUIPart).map((part, callIndex) => ({
      messageId: message.id,
      messageIndex,
      callIndex,
      toolCallId: part.toolCallId,
      toolName: getToolName(part),
      state: part.state,
      input: part.input ?? null,
      output: "output" in part ? part.output : null,
      error: "errorText" in part ? part.errorText : null,
      durationMs: null,
      resultBytes: null
    }))
  )
  return redactCredentials({
    format: "rostra-conversation",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    conversationId: options.conversationId,
    sessionId: options.conversationId,
    status: options.status,
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
        "Tool calls are message snapshots, not a complete server execution ledger. Internal provider retries and timings are not captured.",
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
