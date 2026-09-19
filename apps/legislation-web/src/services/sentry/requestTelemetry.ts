import { continueTrace, getActiveSpan, getIsolationScope, startSpan, withIsolationScope } from "@sentry/core"
import { z } from "zod"
import {
  createCorrelationDiagnostics,
  sanitizeTelemetryHeaders,
  telemetryCorrelationSchema,
  type TelemetryCorrelation
} from "./telemetryCorrelation"
import { resolveTelemetryRoute } from "./telemetryRoutes"

const report = createCorrelationDiagnostics()
const requests = new WeakMap<Request, TelemetryCorrelation>()

export function currentTelemetryCorrelation(): TelemetryCorrelation {
  const parsed = telemetryCorrelationSchema.safeParse(getIsolationScope().getScopeData().contexts.correlation)
  return parsed.success ? parsed.data : {}
}

export function associateTelemetryRun(runId: string) {
  const current = currentTelemetryCorrelation()
  const run = z.uuid().safeParse(runId)
  if (!run.success) {
    report("invalid_provider_id")
    return current
  }
  const correlation = { ...current, run_id: run.data }
  getIsolationScope().setContext("correlation", correlation)
  return correlation
}

export function linkTelemetryTraces(langfuseTraceId: string | undefined) {
  const correlation: TelemetryCorrelation = {
    ...currentTelemetryCorrelation(),
    sentry_trace_id: undefined,
    langfuse_trace_id: undefined
  }
  const traces = {
    sentry_trace_id: getActiveSpan()?.spanContext().traceId,
    langfuse_trace_id: langfuseTraceId
  }
  const validated: { sentry_trace_id?: string; langfuse_trace_id?: string } = {}
  for (const key of ["sentry_trace_id", "langfuse_trace_id"] as const) {
    const parsed = telemetryCorrelationSchema.shape[key].safeParse(traces[key])
    if (parsed.success) {
      validated[key] = parsed.data
    } else {
      report("invalid_trace")
    }
  }
  const linked = { ...correlation, ...validated }
  getIsolationScope().setContext("correlation", linked)
  return linked
}

export async function withRequestTelemetry(
  original: Request,
  operation: (request: Request) => Promise<Response>
): Promise<Response> {
  const existing = requests.get(original)
  if (existing && currentTelemetryCorrelation().request_id === existing.request_id) {
    return operation(original)
  }
  const safe = sanitizeTelemetryHeaders(original.headers, report)
  // Next wraps requests in a Proxy, which fails native Request copy-constructor private-brand checks.
  const init: RequestInit & { duplex: "half" } = {
    method: original.method,
    headers: safe.headers,
    body: original.body,
    signal: original.signal,
    cache: original.cache,
    credentials: original.credentials,
    integrity: original.integrity,
    keepalive: original.keepalive,
    mode: original.mode,
    redirect: original.redirect,
    referrer: original.referrer,
    referrerPolicy: original.referrerPolicy,
    duplex: "half"
  }
  const request = new Request(original.url, init)
  const requestId = crypto.randomUUID()
  const correlation: TelemetryCorrelation = {
    request_id: requestId,
    browser_request_id: safe.browserRequestId
  }
  requests.set(original, correlation)
  requests.set(request, correlation)
  return withIsolationScope(async (scope) => {
    scope.setContext("correlation", correlation)
    return continueTrace({ sentryTrace: safe.sentryTrace, baggage: undefined }, async () => {
      return startSpan(
        {
          name: resolveTelemetryRoute(new URL(request.url).pathname).route_template,
          op: "http.server"
        },
        async () => {
          const traceId = getActiveSpan()?.spanContext().traceId
          const context = telemetryCorrelationSchema.safeParse({ ...correlation, sentry_trace_id: traceId })
          if (context.success) {
            scope.setContext("correlation", context.data)
          }
          const response = await operation(request)
          const headers = new Headers(response.headers)
          headers.set("x-rostra-request-id", requestId)
          return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
        }
      )
    })
  })
}
