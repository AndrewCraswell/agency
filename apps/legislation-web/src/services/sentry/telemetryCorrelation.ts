import { z } from "zod"

const traceId = z.string().regex(/^(?!0{32}$)[a-f0-9]{32}$/u)
const spanId = z.string().regex(/^(?!0{16}$)[a-f0-9]{16}$/u)
const uuid = z.uuid()

export const telemetryCorrelationSchema = z.object({
  request_id: uuid.optional(),
  browser_request_id: uuid.optional(),
  run_id: uuid.optional(),
  sentry_trace_id: traceId.optional(),
  langfuse_trace_id: traceId.optional(),
  parent_request_trace_id: traceId.optional()
})
export type TelemetryCorrelation = Readonly<z.infer<typeof telemetryCorrelationSchema>>
export type CorrelationDiagnostic =
  | "invalid_trace"
  | "conflicting_trace"
  | "baggage_removed"
  | "invalid_request_id"
  | "id_limit"
  | "invalid_provider_id"
const propagatedHeaders = ["sentry-trace", "traceparent", "tracestate", "baggage", "x-rostra-request-id"] as const

export function readTelemetryHeaders(
  get: (name: string) => unknown,
  onDiagnostic: (reason: CorrelationDiagnostic) => void,
  allowSampled = false
) {
  const sentry = get("sentry-trace")
  const parent = get("traceparent")
  const baggage = get("baggage")
  const state = get("tracestate")
  const incomingId = get("x-rostra-request-id")
  if (baggage || state) {
    onDiagnostic("baggage_removed")
  }
  const browserId = uuid.safeParse(incomingId)
  if (incomingId && !browserId.success) {
    onDiagnostic("invalid_request_id")
  }
  const sentryMatch =
    typeof sentry === "string" && sentry.length <= 51
      ? /^([a-f0-9]{32})-([a-f0-9]{16})(?:-([01]))?$/u.exec(sentry)
      : null
  const parentMatch =
    typeof parent === "string" && parent.length === 55
      ? /^00-([a-f0-9]{32})-([a-f0-9]{16})-(00|01)$/u.exec(parent)
      : null
  let valid = true
  for (const [input, match] of [
    [sentry, sentryMatch],
    [parent, parentMatch]
  ] as const) {
    if (input && (!match || !traceId.safeParse(match[1]).success || !spanId.safeParse(match[2]).success)) {
      onDiagnostic("invalid_trace")
      valid = false
    }
  }
  if (
    sentryMatch &&
    parentMatch &&
    (sentryMatch[1] !== parentMatch[1] ||
      sentryMatch[2] !== parentMatch[2] ||
      (sentryMatch[3] !== undefined && (sentryMatch[3] === "1") !== (parentMatch[3] === "01")))
  ) {
    onDiagnostic("conflicting_trace")
    valid = false
  }
  const selected = valid ? (sentryMatch ?? parentMatch) : null
  const sampled = allowSampled && (sentryMatch ? sentryMatch[3] === "1" : parentMatch?.[3] === "01")
  return {
    sentryTrace: selected ? `${selected[1]}-${selected[2]}-${sampled ? "1" : "0"}` : undefined,
    traceparent: selected ? `00-${selected[1]}-${selected[2]}-${sampled ? "01" : "00"}` : undefined,
    browserRequestId: browserId.success ? browserId.data.toLowerCase() : undefined
  }
}

export function sanitizeTelemetryHeaders(input: Headers, onDiagnostic: (reason: CorrelationDiagnostic) => void) {
  const parsed = readTelemetryHeaders((name) => input.get(name), onDiagnostic)
  const headers = new Headers(input)
  propagatedHeaders.forEach((name) => headers.delete(name))
  if (parsed.sentryTrace) {
    headers.set("sentry-trace", parsed.sentryTrace)
  }
  if (parsed.traceparent) {
    headers.set("traceparent", parsed.traceparent)
  }
  if (parsed.browserRequestId) {
    headers.set("x-rostra-request-id", parsed.browserRequestId)
  }
  return { headers, ...parsed }
}

export function createOpaqueTelemetryIds(
  onDiagnostic: (reason: CorrelationDiagnostic) => void,
  randomId = () => crypto.randomUUID()
) {
  const ids = new Map<string, string>()
  return {
    get(source: unknown) {
      if (typeof source !== "string" || !source || source.length > 4096) {
        onDiagnostic("invalid_provider_id")
        return undefined
      }
      const parsed = uuid.safeParse(source)
      if (parsed.success) {
        return parsed.data.toLowerCase()
      }
      const existing = ids.get(source)
      if (existing) {
        return existing
      }
      if (ids.size >= 512) {
        onDiagnostic("id_limit")
        return undefined
      }
      const id = uuid.safeParse(randomId())
      if (!id.success) {
        onDiagnostic("invalid_provider_id")
        return undefined
      }
      ids.set(source, id.data)
      return id.data
    },
    clear: () => ids.clear()
  }
}

export function createCorrelationDiagnostics() {
  const counts = new Map<CorrelationDiagnostic, number>()
  return (reason: CorrelationDiagnostic) => {
    const count = (counts.get(reason) ?? 0) + 1
    counts.set(reason, Math.min(count, Number.MAX_SAFE_INTEGER))
    if (count <= 10) {
      console.warn("Telemetry correlation input filtered", { reason, count })
    }
  }
}
