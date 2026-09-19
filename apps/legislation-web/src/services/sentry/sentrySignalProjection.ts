import type { Breadcrumb, ErrorEvent, Event, SpanJSON, TransactionEvent } from "@sentry/core"
import { z } from "zod"
import { researchToolMeasurementSchema } from "../../modules/conversations/researchMeasurement"
import {
  payloadRecord,
  projectSentryMetadata,
  projectStackFrame,
  readPayloadField,
  safeCodeLocation,
  sentryPayloadFields as p,
  type SentryPayloadPolicy
} from "./sentryPayloadFields"
import { TelemetryContractError } from "./telemetryContracts"
import { isTelemetryEventName } from "./telemetryEvents"
import { telemetryFields as f } from "./telemetryFields"
import { resolveTelemetryRoute } from "./telemetryRoutes"

const nativeError = z.enum([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "AggregateError",
  "AbortError",
  "ResearchFailure",
  "LegislationError",
  "ZodError"
])
const list = (value: unknown, maximum: number) => (Array.isArray(value) ? value.slice(-maximum) : [])

export function projectSentryBreadcrumb(value: unknown, policy: SentryPayloadPolicy): Breadcrumb | null {
  const crumb = payloadRecord(value)
  if (typeof crumb.message !== "string" || !isTelemetryEventName(crumb.message)) {
    return null
  }
  return {
    type: "default",
    category: "rostra",
    message: crumb.message,
    level: "info",
    timestamp: readPayloadField(p.timestamp, crumb.timestamp),
    data: projectSentryMetadata(crumb.data, policy)
  }
}

export function projectSentrySpan(value: unknown, policy: SentryPayloadPolicy): SpanJSON | null {
  const input = payloadRecord(value)
  const identity = z
    .object({
      trace_id: p.eventId,
      span_id: p.spanId,
      parent_span_id: p.spanId.optional(),
      start_timestamp: p.timestamp,
      timestamp: p.timestamp.optional()
    })
    .safeParse(input)
  if (
    !identity.success ||
    (identity.data.timestamp !== undefined && identity.data.timestamp < identity.data.start_timestamp)
  ) {
    return null
  }
  const op = readPayloadField(p.spanOperation, input.op) ?? "app.operation"
  return {
    ...identity.data,
    op,
    description: op,
    status: readPayloadField(p.status, input.status),
    data: projectSentryMetadata(input.data, policy)
  }
}

function traceContext(value: unknown, policy: SentryPayloadPolicy) {
  const input = payloadRecord(value)
  const identity = z
    .object({
      trace_id: p.eventId,
      span_id: p.spanId,
      parent_span_id: p.spanId.optional()
    })
    .safeParse(input)
  if (!identity.success) {
    return undefined
  }
  return {
    ...identity.data,
    op: readPayloadField(p.spanOperation, input.op) ?? "app.operation",
    status: readPayloadField(p.status, input.status),
    data: projectSentryMetadata(input.data, policy)
  }
}

export function projectSentryEvent(input: unknown, policy: SentryPayloadPolicy): ErrorEvent | TransactionEvent {
  const event = readPayloadField(z.record(z.string(), z.unknown()), input)
  if (!event) {
    throw new TelemetryContractError("invalid_schema")
  }
  const context = payloadRecord(event.contexts)
  const trace = traceContext(context.trace, policy)
  const extra = payloadRecord(event.extra)
  const safeExtra: Record<string, unknown> = projectSentryMetadata(extra, policy)
  if (extra.measurement !== undefined) {
    const measurement = payloadRecord(extra.measurement)
    safeExtra.measurement = {
      ...projectSentryMetadata(measurement, policy),
      toolName: readPayloadField(f.tool, measurement.toolName),
      failureCode: readPayloadField(f.toolFailure, measurement.failureCode),
      outcome: readPayloadField(researchToolMeasurementSchema.shape.outcome, measurement.outcome)
    }
  }
  const base: Event = {
    event_id: readPayloadField(p.eventId, event.event_id),
    timestamp: readPayloadField(p.timestamp, event.timestamp),
    environment: readPayloadField(f.environment, event.environment),
    release: readPayloadField(p.release, policy.release),
    level: readPayloadField(p.level, event.level),
    platform: "javascript",
    tags: projectSentryMetadata(event.tags, policy),
    extra: safeExtra,
    contexts: trace ? { trace } : {},
    breadcrumbs: list(event.breadcrumbs, 20).flatMap((crumb) => {
      const projected = projectSentryBreadcrumb(crumb, policy)
      return projected ? [projected] : []
    })
  }
  if (event.type === "transaction") {
    const spans = list(event.spans, 200).flatMap((span) => {
      const projected = projectSentrySpan(span, policy)
      return projected ? [projected] : []
    })
    return {
      ...base,
      type: "transaction",
      transaction:
        typeof event.transaction === "string"
          ? resolveTelemetryRoute(event.transaction.replace(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /u, ""))
              .route_template
          : "/_unmatched",
      transaction_info: { source: "route" },
      start_timestamp: readPayloadField(p.timestamp, event.start_timestamp),
      spans
    }
  }
  const exception = payloadRecord(event.exception)
  const values = list(exception.values, 8).map((item) => {
    const entry = payloadRecord(item)
    const mechanism = payloadRecord(entry.mechanism)
    const stack = payloadRecord(entry.stacktrace)
    return {
      type: readPayloadField(nativeError, entry.type) ?? "Error",
      value: "Application exception (message omitted)",
      mechanism: { type: "generic", handled: readPayloadField(f.boolean, mechanism.handled) },
      stacktrace: { frames: list(stack.frames, 50).map(projectStackFrame) }
    }
  })
  const debug = payloadRecord(event.debug_meta)
  const images = list(debug.images, 50).flatMap((image) => {
    const entry = payloadRecord(image)
    const debugId = readPayloadField(f.id, entry.debug_id)
    const filename = safeCodeLocation(entry.code_file)
    return entry.type === "sourcemap" && debugId && filename
      ? [{ type: "sourcemap" as const, code_file: filename, debug_id: debugId }]
      : []
  })
  const fingerprint = z
    .tuple([z.literal("citation_resolution"), z.literal("unmatched_reference")])
    .safeParse(event.fingerprint)
  return {
    ...base,
    type: undefined,
    message: values.length ? undefined : "Application error (message omitted)",
    exception: values.length ? { values } : undefined,
    fingerprint: fingerprint.success ? fingerprint.data : undefined,
    debug_meta: images.length ? { images } : undefined
  }
}
