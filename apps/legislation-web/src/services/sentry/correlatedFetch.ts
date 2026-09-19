import { createCorrelationDiagnostics, sanitizeTelemetryHeaders } from "./telemetryCorrelation"

const report = createCorrelationDiagnostics()
const contextHeaders = ["sentry-trace", "traceparent", "tracestate", "baggage", "x-rostra-request-id"] as const

export function createCorrelatedFetch(fetcher: typeof fetch, origin: () => string): typeof fetch {
  return (input, init) => {
    const base = origin()
    let rawUrl: string
    if (typeof input === "string") {
      rawUrl = input
    } else if (input instanceof URL) {
      rawUrl = input.href
    } else {
      rawUrl = input.url
    }
    const destination = new URL(rawUrl, base)
    let headers = new Headers(
      init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined)
    )
    const sameOrigin = destination.origin === new URL(base).origin && !destination.username && !destination.password
    if (sameOrigin) {
      const parsed = sanitizeTelemetryHeaders(headers, report)
      headers = parsed.headers
      headers.set("x-rostra-request-id", parsed.browserRequestId ?? crypto.randomUUID())
    } else {
      contextHeaders.forEach((name) => headers.delete(name))
    }
    return fetcher(input, { ...init, headers, ...(sameOrigin ? { redirect: "error" } : {}) })
  }
}

export const correlatedFetch: typeof fetch = (input, init) =>
  createCorrelatedFetch(globalThis.fetch, () => window.location.origin)(input, init)
