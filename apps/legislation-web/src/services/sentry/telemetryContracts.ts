import { z } from "zod"
import { isTelemetryEventName, telemetryEvents, type TelemetryEventName } from "./telemetryEvents"
import {
  telemetryContextSchema,
  telemetryFields as f,
  type TelemetryContext,
  type TelemetryScalar
} from "./telemetryFields"
import { isTelemetryMetricName, telemetryMetrics, type TelemetryMetricName } from "./telemetryMetrics"
import { resolveTelemetryRoute } from "./telemetryRoutes"

export const telemetryLimits = {
  attributeCount: 20,
  eventBytes: 4096,
  metricBytes: 2048,
  dedupeEntries: 1024,
  seriesPerMetric: 1000,
  diagnosticNotifications: 10
} as const

export type TelemetrySignal = "event" | "metric"
export type TelemetryRejection = z.infer<typeof f.diagnostic>

export class TelemetryContractError extends Error {
  constructor(readonly reason: TelemetryRejection) {
    super(`Telemetry rejected: ${reason}`)
    this.name = "TelemetryContractError"
  }
}

const scalarAttributes = z.record(z.string().max(128), z.union([z.string().max(128), z.number().finite(), z.boolean()]))
const inputEventSchema = z.strictObject({
  event_name: z.string().max(128),
  operation_id: f.id,
  attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  event_id: f.id.optional(),
  attributes: z.record(z.string(), z.unknown())
})
const inputMetricSchema = z.strictObject({
  name: z.string().max(128),
  value: f.duration,
  attributes: z.record(z.string(), z.unknown())
})

export type TelemetryEventRecord = Readonly<
  TelemetryContext & {
    event_name: TelemetryEventName
    event_id: string
    operation_id: string
    attempt: number
    occurred_at: string
    schema_version: 1
    origin: "browser" | "server"
    phase: (typeof telemetryEvents)[TelemetryEventName]["phase"]
    attributes: Readonly<Record<string, TelemetryScalar>>
  }
>

export type TelemetryMetricRecord = Readonly<{
  name: TelemetryMetricName
  type: "counter" | "gauge" | "distribution"
  unit: "none" | "millisecond" | "byte"
  value: number
  attributes: Readonly<Record<string, TelemetryScalar>>
}>

export function checkTelemetryWireSize(signal: TelemetrySignal, serializedRecord: unknown): void {
  let bytes: number
  try {
    const json = JSON.stringify(serializedRecord)
    if (json === undefined) {
      throw new TelemetryContractError("invalid_schema")
    }
    bytes = new TextEncoder().encode(json).byteLength
  } catch {
    throw new TelemetryContractError("invalid_schema")
  }
  if (signal === "event" ? bytes > telemetryLimits.eventBytes : bytes >= telemetryLimits.metricBytes) {
    throw new TelemetryContractError("payload_limit")
  }
}

export function parseTelemetryContext(value: unknown): TelemetryContext {
  const parsed = telemetryContextSchema.safeParse(value)
  if (!parsed.success || resolveTelemetryRoute(parsed.data.route_template).surface !== parsed.data.surface) {
    throw new TelemetryContractError("context_failure")
  }
  return Object.freeze(parsed.data)
}

function attributes(value: Record<string, unknown>, schema: z.ZodType): Readonly<Record<string, TelemetryScalar>> {
  if (Object.keys(value).length > telemetryLimits.attributeCount) {
    throw new TelemetryContractError("attribute_limit")
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new TelemetryContractError("invalid_schema")
  }
  const defined = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
  const scalars = scalarAttributes.safeParse(defined)
  if (!scalars.success) {
    throw new TelemetryContractError("invalid_schema")
  }
  return Object.freeze(scalars.data)
}

function checkOutcome(name: TelemetryEventName, values: Readonly<Record<string, TelemetryScalar>>) {
  if (name === "research.tool_finished") {
    if ((values.outcome === "error") !== (values.failure_code !== undefined)) {
      throw new TelemetryContractError("invalid_schema")
    }
  }
  if (name === "search.finished" || name === "search.results_rendered") {
    if (values.outcome !== "succeeded" && values.result_count !== undefined) {
      throw new TelemetryContractError("invalid_schema")
    }
    if (values.outcome === "succeeded" && values.result_count === undefined) {
      throw new TelemetryContractError("invalid_schema")
    }
  }
  if (values.outcome === "succeeded" && values.failure !== undefined) {
    throw new TelemetryContractError("invalid_schema")
  }
}

export function prepareTelemetryEvent(
  input: unknown,
  context: TelemetryContext,
  clock: () => Date,
  randomId: () => string
): TelemetryEventRecord {
  const parsed = inputEventSchema.safeParse(input)
  if (!parsed.success || !isTelemetryEventName(parsed.data.event_name)) {
    throw new TelemetryContractError("invalid_schema")
  }
  const definition = telemetryEvents[parsed.data.event_name]
  const origin = context.runtime === "browser" ? "browser" : "server"
  if (definition.origin !== "either" && definition.origin !== origin) {
    throw new TelemetryContractError("invalid_schema")
  }
  const values = attributes(parsed.data.attributes, definition.attributes)
  checkOutcome(parsed.data.event_name, values)
  const eventId = f.id.safeParse(parsed.data.event_id ?? randomId())
  const timestamp = z.iso.datetime().safeParse(clock().toISOString())
  if (!eventId.success || !timestamp.success) {
    throw new TelemetryContractError("context_failure")
  }
  const record: TelemetryEventRecord = Object.freeze({
    ...context,
    event_name: parsed.data.event_name,
    event_id: eventId.data,
    operation_id: parsed.data.operation_id,
    attempt: parsed.data.attempt,
    occurred_at: timestamp.data,
    schema_version: 1,
    origin,
    phase: definition.phase,
    attributes: values
  })
  checkTelemetryWireSize("event", record)
  return record
}

export function prepareTelemetryMetric(input: unknown, context: TelemetryContext): TelemetryMetricRecord {
  const parsed = inputMetricSchema.safeParse(input)
  if (!parsed.success || !isTelemetryMetricName(parsed.data.name)) {
    throw new TelemetryContractError("invalid_schema")
  }
  const definition = telemetryMetrics[parsed.data.name]
  if (!definition.value.safeParse(parsed.data.value).success) {
    throw new TelemetryContractError("invalid_schema")
  }
  const values = attributes(parsed.data.attributes, definition.attributes)
  if (parsed.data.name === "rostra.tool.outcome") {
    checkOutcome("research.tool_finished", values)
  }
  if (values.origin !== undefined && values.origin !== (context.runtime === "browser" ? "browser" : "server")) {
    throw new TelemetryContractError("invalid_schema")
  }
  const record: TelemetryMetricRecord = Object.freeze({
    name: parsed.data.name,
    type: definition.type,
    unit: definition.unit,
    value: parsed.data.value,
    attributes: Object.freeze({
      ...values,
      environment: context.environment,
      release: context.release,
      runtime: context.runtime,
      content_mode: context.content_mode
    })
  })
  checkTelemetryWireSize("metric", record)
  return record
}
