import { propagateAttributes, startActiveObservation } from "@langfuse/tracing"
import type { TextStreamPart, ToolSet } from "ai"
import type { EvalEvent, EvalTurn } from "../evaluations/contracts"
import { createCitationFailureReporter, type CitationTelemetryContext } from "./citationFailures.server"
import type { ComposedAnswer } from "./compositionStream"
import type { EvidenceSnapshot } from "./evidence"
import { redactCredentials } from "./redactCredentials"

export async function collectChatStream(stream: ReadableStream<TextStreamPart<ToolSet>>) {
  const started = performance.now()
  let step = 0
  const events: EvalEvent[] = []
  const output: EvalTurn = {
    text: "",
    termination: "incomplete",
    durationMs: 0,
    firstTextMs: null,
    inputTokens: null,
    outputTokens: null,
    responses: []
  }
  const reader = stream.getReader()
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) {
        break
      }
      const chunk = next.value
      if (chunk.type.startsWith("reasoning") || chunk.type === "raw") {
        continue
      }
      if (chunk.type === "start-step") {
        step++
      }
      if (chunk.type === "text-delta") {
        output.text += chunk.text
        output.firstTextMs ??= Math.round(performance.now() - started)
      }
      if (chunk.type === "tool-call" || chunk.type === "tool-result" || chunk.type === "tool-error") {
        let type: EvalEvent["type"] = "error"
        let value: unknown = chunk.type === "tool-error" ? redactCredentials(chunk.error) : null
        if (chunk.type === "tool-call") {
          type = "call"
          value = chunk.input
        }
        if (chunk.type === "tool-result") {
          type = "result"
          value = chunk.output
        }
        events.push({ turn: 0, step, type, tool: chunk.toolName, callId: chunk.toolCallId, value })
      }
      if (chunk.type === "finish-step") {
        output.responses.push({ id: chunk.response.id, modelId: chunk.response.modelId })
      }
      if (chunk.type === "finish") {
        output.termination = chunk.finishReason
        output.inputTokens = chunk.totalUsage.inputTokens ?? null
        output.outputTokens = chunk.totalUsage.outputTokens ?? null
      }
      if (chunk.type === "abort" || chunk.type === "error") {
        output.termination = chunk.type
      }
      if (chunk.type === "error") {
        events.push({
          turn: 0,
          step,
          type: "error",
          tool: "generation",
          callId: "generation",
          value: redactCredentials(chunk.error)
        })
      }
    }
  } catch (error) {
    output.termination = "error"
    events.push({
      turn: 0,
      step,
      type: "error",
      tool: "generation",
      callId: "generation",
      value: redactCredentials(error)
    })
  } finally {
    reader.releaseLock()
    output.durationMs = Math.round(performance.now() - started)
  }
  if (
    output.termination !== "error" &&
    output.termination !== "abort" &&
    events.some((event) => event.tool === "ask_clarification" && event.type === "result")
  ) {
    output.termination = "clarification"
  }
  return { events, output }
}

export function observeChatResponse(options: {
  sessionId: string
  input: unknown
  metadata: Record<string, unknown>
  start: () => ReadableStream<TextStreamPart<ToolSet>>
  composed?: Promise<ComposedAnswer>
  retainedEvidence?: EvidenceSnapshot[]
  citationTelemetry?: CitationTelemetryContext
}) {
  const stream = Promise.withResolvers<ReadableStream<TextStreamPart<ToolSet>>>()
  let traceId: string | null = null
  const redacted = redactCredentials(options.metadata)
  const redactedMetadata = Object.fromEntries(
    Object.entries(typeof redacted === "object" && redacted !== null ? redacted : {})
  )
  const metadata = Object.fromEntries(
    Object.entries(redactedMetadata).flatMap(([key, value]) => {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        return []
      }
      const serialized = String(redactCredentials(value))
      return serialized.length <= 200 ? [[key, serialized]] : []
    })
  )
  const completed = propagateAttributes(
    { sessionId: options.sessionId, traceName: "legislative-research-conversation", metadata },
    () =>
      startActiveObservation(
        "legislative-research-conversation",
        async (observation) => {
          if (observation.traceId && !/^0+$/.test(observation.traceId)) {
            traceId = observation.traceId
          }
          observation.update({ input: redactCredentials(options.input), metadata: redactedMetadata })
          const [uiStream, captureStream] = options.start().tee()
          stream.resolve(uiStream)
          const raw = await collectChatStream(captureStream)
          const composition = await options.composed
          if (composition && options.citationTelemetry) {
            createCitationFailureReporter(options.citationTelemetry)({
              text: composition.text,
              events: raw.events,
              retainedEvidence: options.retainedEvidence,
              termination: raw.output.termination,
              isInterrupted: composition.isInterrupted
            })
          }
          observation.update({ output: redactCredentials({ ...raw, ...(composition ? { composition } : {}) }) })
        },
        { asType: "agent" }
      )
  )
  return {
    stream: stream.promise,
    getTraceId: () => traceId,
    completed: completed.catch((error: unknown) => {
      stream.reject(error)
      throw error
    })
  }
}
