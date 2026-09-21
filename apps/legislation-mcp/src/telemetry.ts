import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { normalizeLegislationError, postgresErrorCode } from "@repo/legislation-core/domain/errors"
import { deploymentSentryRelease } from "@repo/legislation-core/observability/deployment-identity"
import { sanitizeTelemetry } from "@repo/legislation-core/observability/sanitize-telemetry"
import type { Telemetry } from "@repo/legislation-core/observability/telemetry"
import * as Sentry from "@sentry/node"
import { z } from "zod"

function safeRecord(value: unknown) {
  return z.record(z.string(), z.unknown()).parse(sanitizeTelemetry(value))
}

function safeSpanAttributes(value: unknown) {
  const attributes: Record<string, string | number | boolean> = {}
  for (const [key, item] of Object.entries(safeRecord(value))) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") attributes[key] = item
  }
  return attributes
}

export function mcpSentryOptions(environment: NodeJS.ProcessEnv): Sentry.NodeOptions {
  return {
    dsn: environment.SENTRY_DSN,
    enabled: Boolean(environment.SENTRY_DSN),
    environment: environment.SENTRY_ENVIRONMENT ?? environment.NODE_ENV ?? "development",
    release: deploymentSentryRelease(environment),
    sendDefaultPii: false,
    tracesSampleRate: 1,
    maxValueLength: 2000,
    beforeSendTransaction(event) {
      return {
        ...event,
        request: undefined,
        user: undefined,
        extra: event.extra ? safeRecord(event.extra) : undefined,
        spans: event.spans?.map((span) => ({ ...span, data: safeSpanAttributes(span.data ?? {}) }))
      }
    },
    beforeSend(event) {
      return {
        ...event,
        request: undefined,
        user: undefined,
        extra: event.extra ? safeRecord(event.extra) : undefined,
        breadcrumbs: event.breadcrumbs?.map((crumb) => ({
          ...crumb,
          message: String(sanitizeTelemetry(crumb.message ?? "")),
          data: crumb.data ? safeRecord(crumb.data) : undefined
        })),
        exception: event.exception
          ? {
              ...event.exception,
              values: event.exception.values?.map((value) => ({
                ...value,
                value: String(sanitizeTelemetry(value.value ?? "")),
                stacktrace: value.stacktrace
                  ? {
                      ...value.stacktrace,
                      frames: value.stacktrace.frames?.map((frame) => ({ ...frame, vars: undefined }))
                    }
                  : undefined
              }))
            }
          : undefined
      }
    }
  }
}

export function initializeMcpTelemetry(environment: NodeJS.ProcessEnv) {
  Sentry.init(mcpSentryOptions(environment))
}

export async function emitStagingCanary(marker: string, environment: NodeJS.ProcessEnv) {
  if (environment.SENTRY_ENVIRONMENT !== "staging" || !/^legislation-staging-[0-9]+-[0-9]+$/u.test(marker)) {
    throw new Error("Invalid staging telemetry canary")
  }
  Sentry.withScope((scope) => {
    scope.setTag("service", "legislation-mcp")
    scope.setTag("tool", "mcp.canary")
    scope.setTag("category", "controlled_canary")
    scope.setTag("stage", "canary")
    scope.setTag("canary", marker)
    scope.setContext(
      "deployment",
      safeRecord({
        projectId: environment.RAILWAY_PROJECT_ID,
        environmentId: environment.RAILWAY_ENVIRONMENT_ID,
        serviceId: environment.RAILWAY_SERVICE_ID,
        deploymentId: environment.RAILWAY_DEPLOYMENT_ID,
        commitSha: environment.RAILWAY_GIT_COMMIT_SHA
      })
    )
    Sentry.captureException(new Error("Controlled staging telemetry canary"))
  })
  if (!(await Sentry.flush(5000))) {
    throw new Error("Staging telemetry canary did not flush")
  }
}

export function createMcpTelemetry(): Telemetry {
  return {
    observe: async (name, metadata, operation) =>
      await Sentry.startSpan(
        {
          name,
          op: "mcp.tool",
          attributes: { "mcp.tool": name, "correlation.id": getRequestContext()?.correlationId ?? "" }
        },
        async (span) => {
          try {
            const result = await operation()
            if (name === "mcp.analyze_legislation" || name === "mcp.describe_analytics") {
              const summary = z
                .object({
                  receipt: z
                    .object({
                      queryHash: z.string(),
                      returned: z.number(),
                      durationMs: z.number(),
                      nextOffset: z.number().nullable()
                    })
                    .optional(),
                  datasets: z.array(z.string()).optional()
                })
                .safeParse(result)
              span.setAttribute("analytics.input", JSON.stringify(sanitizeTelemetry(metadata)))
              if (summary.success) {
                span.setAttribute("analytics.query_hash", summary.data.receipt?.queryHash ?? "")
                span.setAttribute("analytics.row_count", summary.data.receipt?.returned ?? 0)
                span.setAttribute("analytics.database_duration_ms", summary.data.receipt?.durationMs ?? 0)
                span.setAttribute("analytics.dataset_count", summary.data.datasets?.length ?? 0)
              }
            }
            span.setStatus({ code: 1 })
            return result
          } catch (error) {
            span.setStatus({ code: 2, message: normalizeLegislationError(error).category })
            throw error
          } finally {
            span.setAttribute("mcp.input_keys", Object.keys(metadata).join(","))
          }
        }
      ),
    reportFailure(name, metadata, error) {
      const failure = normalizeLegislationError(error)
      const context = getRequestContext()
      const canary = z
        .object({ canaryMarker: z.string().regex(/^legislation-staging-[0-9]+-[0-9]+$/u) })
        .safeParse(metadata)
      const canaryMarker = canary.success ? canary.data.canaryMarker : undefined
      Sentry.withScope((scope) => {
        scope.setTag("service", "legislation-mcp")
        scope.setTag("tool", name)
        scope.setTag("category", error instanceof z.ZodError ? "invalid_request" : failure.category)
        scope.setTag("stage", String(metadata.stage ?? "unknown"))
        const correlation = context?.correlationId ?? metadata.correlationId
        if (typeof correlation === "string") scope.setTag("correlationId", correlation)
        const code = postgresErrorCode(error)
        if (code) scope.setTag("database.code", code)
        if (canaryMarker) scope.setTag("canary", canaryMarker)
        scope.setContext(
          "mcp",
          safeRecord({ ...metadata, errorDetails: failure.details, correlationId: context?.correlationId })
        )
        Sentry.captureException(error instanceof Error ? error : failure)
      })
      if (canaryMarker) void Sentry.flush(5000)
    },
    shutdown: async () => {
      await Sentry.close(5000)
    }
  }
}
