import { isToolUIPart, getToolName, type UIMessage } from "ai"
import { z } from "zod"
import { evidenceSnapshotSchema } from "./evidence"
import { redactCredentials } from "./redactCredentials"
import { researchToolMeasurementSchema } from "./researchMeasurement"
import { messageResponseOutcome } from "./responseOutcome"

const diagnosticOutputSchema = z.object({
  success: z.boolean().optional(),
  ok: z.boolean().optional(),
  isError: z.boolean().optional(),
  error: z.union([z.string(), z.object({ code: z.string().optional(), message: z.string().optional() })]).nullish(),
  evidence: z.array(z.object({ id: z.string() })).optional(),
  resultSet: z
    .object({
      id: z.string().optional(),
      kind: z.string().optional(),
      items: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string() })).optional(),
      warnings: z.array(z.string()).optional(),
      hasNextPage: z.boolean().optional(),
      totalCount: z.number().nullable().optional()
    })
    .optional(),
  warnings: z.array(z.string()).optional()
})

const diagnosticEvidenceSchema = evidenceSnapshotSchema
  .omit({ content: true })
  .extend({
    sourceUrl: z.string().nullable(),
    readableUrl: z.string().optional(),
    content: z.object({ state: z.string(), truncated: z.boolean().optional(), totalCharacters: z.number().optional() })
  })
  .strip()

const presentationDiagnosticSchema = z.object({
  blockId: z.string().optional(),
  state: z.string().optional(),
  reason: z.string().optional(),
  component: z.string().optional()
})

export function createConversationExport(options: {
  conversationId: string
  messages: readonly UIMessage[]
  status: string
  interruptedMessageId?: string
  replayId?: string
  clarificationAnswers?: unknown
}) {
  const lastMessage = options.messages.at(-1)
  const evidence = options.messages.flatMap((message) => {
    const references = new Map<string, z.infer<typeof diagnosticEvidenceSchema>>()
    for (const part of message.parts) {
      let value: unknown
      if (part.type === "data-research-context") {
        value = part.data
      } else if (isToolUIPart(part) && "output" in part) {
        value = part.output
      }
      const parsed = z.object({ evidence: z.array(z.unknown()) }).safeParse(value)
      if (!parsed.success) {
        continue
      }
      for (const source of parsed.data.evidence) {
        const reference = diagnosticEvidenceSchema.safeParse(source)
        if (reference.success) {
          references.set(reference.data.id, reference.data)
        }
      }
    }
    return [...references.values()].map((reference) => ({ messageId: message.id, ...reference }))
  })
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
      const output = "output" in part ? diagnosticOutputSchema.safeParse(part.output) : undefined
      return {
        messageId: message.id,
        messageIndex,
        callIndex,
        toolCallId: part.toolCallId,
        toolName: getToolName(part),
        state: part.state,
        input: part.input ?? null,
        output: output?.success ? output.data : null,
        outputOmitted: "output" in part,
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
      parts: message.parts.flatMap<UIMessage["parts"][number]>((part) => {
        if (part.type === "data-presentation") {
          const parsed = presentationDiagnosticSchema.safeParse(part.data)
          return parsed.success ? [{ type: part.type, data: parsed.data }] : []
        }
        if (part.type === "text" || part.type === "source-url" || part.type === "source-document") {
          return [part]
        }
        if (isToolUIPart(part) && getToolName(part) === "ask_clarification") {
          return [part]
        }
        return []
      })
    })),
    clarificationAnswers: options.clarificationAnswers ?? {},
    evidence,
    toolCalls,
    capture: {
      source: "browser-conversation-snapshot",
      toolCallCount: toolCalls.length,
      detail: "diagnostic-summary",
      limitations: [
        "Tool result bodies and presentation payloads are omitted. Output summaries retain record identities, status flags and warnings when available. Evidence lists source pointers once per message, without passages. Use run/trace IDs to investigate source-level details.",
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
