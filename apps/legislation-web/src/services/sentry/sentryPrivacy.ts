import type { ErrorEvent, init } from "@sentry/nextjs"
import { researchFailureCode } from "../../modules/conversations/researchFailure"
import { isResearchTool } from "../../modules/conversations/researchTools"

const errorTypes = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AbortError",
  "TimeoutError"
])
const invalidUrlMessages = new Set([
  "Invalid URL",
  "Failed to construct 'URL': Invalid URL",
  "URL constructor: / is not a valid URL."
])

function safeFrameFilename(filename: string | undefined) {
  const path = filename?.split(/[?#]/)[0]?.replaceAll("\\", "/")
  return path?.match(/(?:^|\/)(?:_next\/static|app|src)\/[a-zA-Z0-9_./[\]()-]+\.(?:js|mjs|ts|tsx)$/)?.[0]
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const category = event.tags?.category
  const reference = event.tags?.reference
  const tool = event.tags?.tool
  const tags: Record<string, string> = {}
  if (typeof category === "string" && researchFailureCode(category) === category) {
    tags.category = category
  }
  if (
    typeof reference === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)
  ) {
    tags.reference = reference
  }
  if (typeof tool === "string" && (isResearchTool(tool) || tool === "ask_clarification")) {
    tags.tool = tool
  } else if (typeof tool === "string") {
    tags.tool = "unknown_tool"
  }
  const operation = event.tags?.operation
  if (
    typeof operation === "string" &&
    [
      "tool_call",
      "chat_transport",
      "clarification_submit",
      "http_api",
      "chat_stream",
      "react_boundary",
      "citation_resolution"
    ].includes(operation)
  ) {
    tags.operation = operation
  }
  const runId = event.tags?.runId
  if (typeof runId === "string" && /^[0-9a-f-]{36}$/i.test(runId)) {
    tags.runId = runId
  }
  const toolCallId = event.tags?.toolCallId
  if (typeof toolCallId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(toolCallId)) {
    tags.toolCallId = toolCallId
  }
  let message = tags.category ? `Research operation: ${tags.category}` : "Application error"
  if (tags.operation === "citation_resolution") {
    message = "Citation does not match retrieved evidence."
    const hash = event.tags?.citationReferenceHash
    if (typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash)) {
      tags.citationReferenceHash = hash
    }
    const model = event.tags?.model
    if (typeof model === "string" && /^[a-zA-Z0-9_.:/-]{1,128}$/.test(model)) {
      tags.model = model
    }
    const promptVersion = event.tags?.promptVersion
    if (typeof promptVersion === "string" && /^[1-9][0-9]{0,8}$/.test(promptVersion)) {
      tags.promptVersion = promptVersion
    }
  }
  if (
    !tags.category &&
    event.exception?.values?.some(
      (exception) => exception.type === "TypeError" && invalidUrlMessages.has(exception.value ?? "")
    )
  ) {
    message = "Invalid URL"
  }
  const exceptions = event.exception?.values?.map((exception) => ({
    type: exception.type && errorTypes.has(exception.type) ? exception.type : "Error",
    value: message,
    stacktrace: {
      frames: exception.stacktrace?.frames?.map((frame) => ({
        filename: safeFrameFilename(frame.filename),
        lineno: frame.lineno,
        colno: frame.colno,
        in_app: frame.in_app
      }))
    }
  }))
  const scrubbed: ErrorEvent = {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    message,
    tags,
    exception: { values: exceptions }
  }
  if (tags.category) {
    scrubbed.fingerprint = [tags.tool ?? "research", tags.category]
  }
  if (tags.operation === "citation_resolution") {
    scrubbed.fingerprint = ["citation_resolution", "unmatched_reference"]
  }
  const replayId = event.contexts?.replay?.replay_id
  if (typeof replayId === "string" && /^[a-f0-9]{32}$/i.test(replayId)) {
    scrubbed.contexts = { replay: { replay_id: replayId } }
  }
  const extra: Record<string, number> = {}
  const allowedExtra = ["durationMs", "resultBytes"]
  if (tags.operation === "citation_resolution") {
    allowedExtra.push("unresolvedCitationCount", "evidenceCount")
  }
  for (const key of allowedExtra) {
    const value = event.extra?.[key]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      extra[key] = value
    }
  }
  if (Object.keys(extra).length > 0) {
    scrubbed.extra = extra
  }
  return scrubbed
}

export const privateSentryOptions = {
  sendDefaultPii: false,
  defaultIntegrations: [],
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableLogs: false,
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: scrubSentryEvent
} satisfies Parameters<typeof init>[0]
