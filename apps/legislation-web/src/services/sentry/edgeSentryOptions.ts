import type { EdgeOptions, winterCGFetchIntegration } from "@sentry/nextjs"
import { sentryOptions } from "./sentryOptions"

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
  const baseUrl = environment.LEGISLATION_PUBLIC_API_BASE_URL?.trim()
  let origin: string | undefined
  if (baseUrl) {
    let parsed: URL
    try {
      parsed = new URL(baseUrl)
    } catch {
      throw new Error("Edge telemetry requires a valid public API URL")
    }
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    if (
      (parsed.protocol !== "https:" &&
        !(parsed.protocol === "http:" && isLocal && environment.NODE_ENV !== "production")) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("Edge telemetry API URL must use HTTPS without credentials, query or fragment")
    }
    origin = parsed.origin
  }
  const target = origin ? new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:/|$)`, "iu") : undefined
  return {
    ...sentryOptions,
    dsn,
    enabled: Boolean(dsn),
    environment: environment.NODE_ENV,
    skipOpenTelemetrySetup: false,
    tracesSampler: () => 0,
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
