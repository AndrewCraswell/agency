import type { EdgeOptions, winterCGFetchIntegration } from "@sentry/nextjs"
import { diagnosticEnvironment, diagnosticTraceSampleRate } from "./diagnosticSettings"
import { sentryOptions } from "./sentryOptions"
import { telemetryPropagationTarget } from "./telemetryPropagation"

export function assertEdgeTelemetryRuntime() {
  if (typeof Reflect.get(globalThis, "AsyncLocalStorage") !== "function") {
    throw new Error("Edge telemetry requires platform AsyncLocalStorage for request isolation")
  }
}

export function createEdgeSentryOptions(
  environment: Readonly<Record<string, string | undefined>>,
  createFetchIntegration: typeof winterCGFetchIntegration
): EdgeOptions {
  const dsn = environment.NEXT_PUBLIC_SENTRY_DSN?.trim()
  const sampleRate = diagnosticTraceSampleRate(environment.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
  const target = telemetryPropagationTarget(environment.LEGISLATION_PUBLIC_API_BASE_URL, environment.NODE_ENV)
  return {
    ...sentryOptions,
    dsn,
    enabled: Boolean(dsn),
    initialScope: { tags: { runtime: "edge" } },
    environment: diagnosticEnvironment(environment.NEXT_PUBLIC_SENTRY_ENVIRONMENT, environment.NODE_ENV),
    skipOpenTelemetrySetup: false,
    tracesSampler: () => sampleRate,
    tracePropagationTargets: target ? [target] : [],
    integrations: [
      ...sentryOptions.integrations,
      createFetchIntegration({
        breadcrumbs: false,
        shouldCreateSpanForRequest: (url) => target?.test(url) ?? false
      })
    ]
  }
}
