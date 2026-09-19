import type { Log, Metric } from "@sentry/core"
import { z } from "zod"
import {
  payloadRecord,
  projectPayloadFields,
  projectSafeModelFields,
  readPayloadField,
  sentryPayloadFields as p,
  type SentryPayloadPolicy
} from "./sentryPayloadFields"
import {
  checkTelemetryWireSize,
  parseTelemetryContext,
  prepareTelemetryEvent,
  prepareTelemetryMetric,
  TelemetryContractError
} from "./telemetryContracts"
import { telemetryCorrelationSchema } from "./telemetryCorrelation"
import { isTelemetryEventName, telemetryEvents } from "./telemetryEvents"
import { telemetryContextSchema, telemetryFields as f } from "./telemetryFields"
import { isTelemetryMetricName, telemetryMetrics } from "./telemetryMetrics"
import { resolveTelemetryRoute } from "./telemetryRoutes"

const eventIdentity = z.object({
  event_id: f.id,
  operation_id: f.id,
  attempt: f.count.min(1),
  occurred_at: z.iso.datetime(),
  schema_version: z.literal(1)
})

export function projectSentryLog(input: Log, policy: SentryPayloadPolicy): Log {
  if (typeof input.message !== "string" || !isTelemetryEventName(input.message)) {
    throw new TelemetryContractError("invalid_schema")
  }
  const raw = payloadRecord(input.attributes)
  const identity = eventIdentity.safeParse(raw)
  // SDK attributes are flattened; validate context separately from event fields.
  const contextFields = projectPayloadFields(telemetryContextSchema.shape, raw)
  const parsedContext = telemetryContextSchema.safeParse({
    ...contextFields,
    release: readPayloadField(p.release, policy.release) ?? "unversioned"
  })
  if (!identity.success || !parsedContext.success) {
    throw new TelemetryContractError("invalid_schema")
  }
  const definition = telemetryEvents[input.message]
  const attributes = projectSafeModelFields(projectPayloadFields(definition.attributes.shape, raw), policy)
  const event = prepareTelemetryEvent(
    {
      event_name: input.message,
      operation_id: identity.data.operation_id,
      attempt: identity.data.attempt,
      event_id: identity.data.event_id,
      attributes
    },
    parseTelemetryContext(parsedContext.data),
    () => new Date(identity.data.occurred_at),
    () => identity.data.event_id
  )
  const { attributes: eventAttributes, ...metadata } = event
  const output: Log = {
    level: "info",
    message: event.event_name,
    attributes: {
      ...metadata,
      ...eventAttributes,
      ...projectPayloadFields(telemetryCorrelationSchema.shape, raw)
    }
  }
  checkTelemetryWireSize("event", output)
  return output
}

export function projectSentryMetric(input: Metric, policy: SentryPayloadPolicy): Metric {
  if (!isTelemetryMetricName(input.name)) {
    throw new TelemetryContractError("invalid_schema")
  }
  const definition = telemetryMetrics[input.name]
  if (input.type !== definition.type || (input.unit !== undefined && input.unit !== definition.unit)) {
    throw new TelemetryContractError("invalid_schema")
  }
  const raw = payloadRecord(input.attributes)
  const context = telemetryContextSchema.safeParse({
    environment: raw.environment,
    runtime: raw.runtime,
    content_mode: raw.content_mode,
    release: readPayloadField(p.release, policy.release) ?? "unversioned",
    ...resolveTelemetryRoute("/")
  })
  if (!context.success) {
    throw new TelemetryContractError("invalid_schema")
  }
  return prepareTelemetryMetric(
    {
      name: input.name,
      value: input.value,
      attributes: projectSafeModelFields(projectPayloadFields(definition.attributes.shape, raw), policy)
    },
    context.data
  )
}

export function decodeSentryAttributes(input: unknown): Record<string, unknown> {
  const values = payloadRecord(input)
  const scalar = z.discriminatedUnion("type", [
    z.object({ type: z.literal("string"), value: z.string() }),
    z.object({ type: z.literal("boolean"), value: z.boolean() }),
    z.object({ type: z.literal("integer"), value: z.number().int() }),
    z.object({ type: z.literal("double"), value: z.number().finite() })
  ])
  return Object.fromEntries(
    Object.entries(values)
      .slice(0, 100)
      .flatMap(([key, value]) => {
        const attribute = scalar.safeParse(value)
        return attribute.success ? [[key, attribute.data.value]] : []
      })
  )
}

export function encodeSentryAttributes(input: unknown) {
  const attributes: Record<
    string,
    | { type: "string"; value: string }
    | { type: "boolean"; value: boolean }
    | { type: "integer" | "double"; value: number }
  > = {}
  for (const [key, value] of Object.entries(payloadRecord(input))) {
    if (typeof value === "string") {
      attributes[key] = { type: "string", value }
    } else if (typeof value === "boolean") {
      attributes[key] = { type: "boolean", value }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      attributes[key] = { type: Number.isInteger(value) ? "integer" : "double", value }
    }
  }
  return attributes
}
