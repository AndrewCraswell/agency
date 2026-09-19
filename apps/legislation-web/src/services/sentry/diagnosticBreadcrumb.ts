import { addBreadcrumb, getIsolationScope } from "@sentry/core"
import { projectSentryMetadata } from "./sentryPayloadFields"
import { telemetryCorrelationSchema } from "./telemetryCorrelation"
import type { TelemetryEventName } from "./telemetryEvents"

let failures = 0

export function diagnosticBreadcrumb(message: TelemetryEventName, data: Readonly<Record<string, unknown>>) {
  try {
    const correlation = telemetryCorrelationSchema.safeParse(getIsolationScope().getScopeData().contexts.correlation)
    addBreadcrumb({
      category: "rostra",
      level: "info",
      message,
      data: projectSentryMetadata({ ...(correlation.success ? correlation.data : {}), ...data }, {})
    })
  } catch {
    if (failures++ < 10) {
      console.warn("Telemetry breadcrumb could not be recorded")
    }
  }
}
