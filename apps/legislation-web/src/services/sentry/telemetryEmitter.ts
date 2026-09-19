import {
  checkTelemetryWireSize,
  parseTelemetryContext,
  prepareTelemetryEvent,
  prepareTelemetryMetric,
  TelemetryContractError,
  telemetryLimits,
  type TelemetryEventRecord,
  type TelemetryMetricRecord,
  type TelemetryRejection,
  type TelemetrySignal
} from "./telemetryContracts"
import { telemetryEvents, type TelemetryEventInput } from "./telemetryEvents"
import type { TelemetryContext } from "./telemetryFields"
import type { TelemetryMetricInput } from "./telemetryMetrics"

type Category = "operational" | "usage" | "metrics"
type Diagnostic = Readonly<{ signal: TelemetrySignal; reason: TelemetryRejection; count: number }>
type Emission = Readonly<
  | { status: "enqueued"; event_id?: string }
  | { status: "duplicate"; event_id: string }
  | { status: "disabled" }
  | { status: "dropped"; reason: TelemetryRejection }
>
type TelemetryEmitterOptions = Readonly<{
  context: TelemetryContext
  mode: "strict" | "production"
  onDiagnostic: (diagnostic: Diagnostic) => void
  enqueueEvent: (event: TelemetryEventRecord) => void | Promise<void>
  enqueueMetric: (metric: TelemetryMetricRecord) => void | Promise<void>
  isEnabled?: (category: Category) => boolean
  clock?: () => Date
  randomId?: () => string
}>

const usageMetrics = new Set(["rostra.page.view", "rostra.feature.action", "rostra.composer.draft_duration"])

export function createTelemetryEmitter(options: TelemetryEmitterOptions) {
  const counts = new Map<string, Diagnostic>()
  let isReporting = false
  let isSending = false

  function report(signal: TelemetrySignal, reason: TelemetryRejection) {
    const key = `${signal}:${reason}`
    const count = Math.min((counts.get(key)?.count ?? 0) + 1, Number.MAX_SAFE_INTEGER)
    const diagnostic = Object.freeze({ signal, reason, count })
    counts.set(key, diagnostic)
    if (isReporting || count > telemetryLimits.diagnosticNotifications) {
      return
    }
    isReporting = true
    try {
      options.onDiagnostic(diagnostic)
    } catch {
      console.warn("Telemetry diagnostic callback failed", { signal, reason })
    } finally {
      isReporting = false
    }
  }

  function reject(signal: TelemetrySignal, error: unknown): Emission {
    const reason = error instanceof TelemetryContractError ? error.reason : "context_failure"
    report(signal, reason)
    if (options.mode === "strict") {
      throw new TelemetryContractError(reason)
    }
    return { status: "dropped", reason }
  }

  let context: TelemetryContext
  try {
    context = parseTelemetryContext(options.context)
  } catch (error) {
    report("event", "context_failure")
    throw error
  }
  const clock = options.clock ?? (() => new Date())
  const randomId = options.randomId ?? (() => crypto.randomUUID())
  const isEnabled = options.isEnabled ?? (() => false)
  const eventIds = new Map<string, string>()
  const transitions = new Map<string, string>()
  const series = new Map<string, Set<string>>()
  let seriesDay: string | undefined

  function enqueue(signal: TelemetrySignal, send: () => void | Promise<void>) {
    isSending = true
    try {
      const pending = send()
      if (pending) {
        void pending.catch(() => report(signal, "sink_failure"))
      }
    } catch {
      throw new TelemetryContractError("sink_failure")
    } finally {
      isSending = false
    }
  }

  function emitEvent(input: TelemetryEventInput): Emission {
    if (isReporting || isSending) {
      return reject("event", new TelemetryContractError("reentrant"))
    }
    try {
      const event = prepareTelemetryEvent(input, context, clock, randomId)
      const definition = telemetryEvents[event.event_name]
      if (!isEnabled(definition.category)) {
        return { status: "disabled" }
      }
      const key = definition.once
        ? JSON.stringify([
            event.event_name,
            event.operation_id,
            event.attempt,
            event.origin,
            ...definition.dimensions.map((dimension) => event.attributes[dimension])
          ])
        : event.event_id
      const previous = eventIds.get(event.event_id) ?? transitions.get(key)
      if (previous) {
        return { status: "duplicate", event_id: previous }
      }
      if (transitions.size >= telemetryLimits.dedupeEntries) {
        throw new TelemetryContractError("dedupe_limit")
      }
      enqueue("event", () => options.enqueueEvent(event))
      transitions.set(key, event.event_id)
      eventIds.set(event.event_id, event.event_id)
      return { status: "enqueued", event_id: event.event_id }
    } catch (error) {
      return reject("event", error)
    }
  }

  function emitMetric(input: TelemetryMetricInput): Emission {
    if (isReporting || isSending) {
      return reject("metric", new TelemetryContractError("reentrant"))
    }
    try {
      const metric = prepareTelemetryMetric(input, context)
      if (!isEnabled("metrics") || (usageMetrics.has(metric.name) && !isEnabled("usage"))) {
        return { status: "disabled" }
      }
      const day = clock().toISOString().slice(0, 10)
      if (day !== seriesDay) {
        series.clear()
        seriesDay = day
      }
      const key = JSON.stringify(
        Object.entries(metric.attributes).toSorted(([left], [right]) => left.localeCompare(right))
      )
      const values = series.get(metric.name) ?? new Set<string>()
      if (!values.has(key) && values.size >= telemetryLimits.seriesPerMetric) {
        throw new TelemetryContractError("cardinality_limit")
      }
      enqueue("metric", () => options.enqueueMetric(metric))
      values.add(key)
      series.set(metric.name, values)
      return { status: "enqueued" }
    } catch (error) {
      return reject("metric", error)
    }
  }

  return {
    emitEvent,
    emitMetric,
    guardWireRecord(signal: TelemetrySignal, record: unknown) {
      try {
        checkTelemetryWireSize(signal, record)
        return true
      } catch (error) {
        reject(signal, error)
        return false
      }
    },
    diagnostics: () => [...counts.values()],
    clearSession() {
      eventIds.clear()
      transitions.clear()
    }
  }
}
