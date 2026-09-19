import type { Context, TextMapGetter, TextMapSetter } from "@opentelemetry/api"
import { SentryPropagator } from "@sentry/opentelemetry"
import { createCorrelationDiagnostics, readTelemetryHeaders } from "./telemetryCorrelation"

export class SafeTracePropagator extends SentryPropagator {
  private readonly report = createCorrelationDiagnostics()

  override extract(context: Context, carrier: unknown, getter: TextMapGetter): Context {
    const parsed = readTelemetryHeaders((name) => getter.get(carrier, name), this.report)
    const safe = new Map<string, string>()
    if (parsed.sentryTrace) {
      safe.set("sentry-trace", parsed.sentryTrace)
    }
    return super.extract(context, safe, {
      keys: () => [...safe.keys()],
      get: (_carrier, name) => safe.get(name)
    })
  }

  override inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
    const collected = new Map<string, string>()
    super.inject(context, carrier, {
      set: (_carrier, name, value) => {
        collected.set(name, String(value))
      }
    })
    const parsed = readTelemetryHeaders((name) => collected.get(name), this.report, true)
    if (parsed.sentryTrace) {
      setter.set(carrier, "sentry-trace", parsed.sentryTrace)
    }
    if (parsed.traceparent) {
      setter.set(carrier, "traceparent", parsed.traceparent)
    }
  }

  override fields() {
    return ["sentry-trace", "traceparent"]
  }
}
