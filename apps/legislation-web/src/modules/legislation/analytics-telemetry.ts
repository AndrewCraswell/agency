import { startActiveObservation } from "@langfuse/tracing"
import { normalizeLegislationError, postgresErrorCode } from "@repo/legislation-core/domain/errors"
import { sanitizeTelemetry } from "@repo/legislation-core/observability/sanitize-telemetry"
import type { Telemetry } from "@repo/legislation-core/observability/telemetry"
import * as Sentry from "@sentry/core"
import { z } from "zod"
import { currentTelemetryCorrelation } from "../../services/sentry/requestTelemetry"

export function createAnalyticsTelemetry(): Telemetry {
  const safeMetadata = (metadata: unknown) => z.record(z.string(), z.unknown()).parse(sanitizeTelemetry(metadata))
  return {
    observe: async (name, metadata, operation) =>
      await startActiveObservation(
        name,
        async (observation) =>
          await Sentry.startSpan(
            {
              name,
              op: "db.analytics",
              attributes: {
                "analytics.dataset": String(metadata.dataset ?? ""),
                "analytics.query_hash": String(metadata.queryHash ?? ""),
                ...currentTelemetryCorrelation()
              }
            },
            async (span) => {
              const startedAt = performance.now()
              observation.update({ input: sanitizeTelemetry(metadata.input), metadata: safeMetadata(metadata) })
              try {
                const result = await operation()
                span.setStatus({ code: 1 })
                return result
              } catch (error) {
                const failure = normalizeLegislationError(error)
                const category = error instanceof z.ZodError ? "invalid_request" : failure.category
                span.setStatus({ code: 2, message: category })
                observation.update({
                  level: "ERROR",
                  statusMessage: category,
                  metadata: safeMetadata({ ...metadata, databaseCode: postgresErrorCode(error) })
                })
                throw error
              } finally {
                const durationMs = Math.round(performance.now() - startedAt)
                span.setAttributes({
                  "analytics.duration_ms": durationMs,
                  "analytics.query_hash": String(metadata.queryHash ?? "")
                })
                for (const [field, attribute] of Object.entries({
                  joinCount: "analytics.join_count",
                  databaseRows: "analytics.database_rows",
                  rowCount: "analytics.row_count",
                  resultBytes: "analytics.result_bytes"
                })) {
                  if (typeof metadata[field] === "number") {
                    span.setAttribute(attribute, metadata[field])
                  }
                }
                observation.update({
                  output: sanitizeTelemetry({
                    queryHash: metadata.queryHash,
                    rowCount: metadata.rowCount,
                    resultBytes: metadata.resultBytes
                  }),
                  metadata: safeMetadata({ ...metadata, durationMs, ...currentTelemetryCorrelation() })
                })
              }
            }
          )
      ),
    reportFailure(name, metadata, error) {
      const failure = normalizeLegislationError(error)
      const category = error instanceof z.ZodError ? "invalid_request" : failure.category
      Sentry.captureException(new Error(`Legislative analytics ${String(metadata.stage)} failed: ${category}`), {
        tags: {
          operation: name,
          stage: String(metadata.stage),
          category,
          queryHash: String(metadata.queryHash ?? ""),
          ...currentTelemetryCorrelation(),
          databaseCode: postgresErrorCode(error) ?? ""
        },
        extra: { analytics: sanitizeTelemetry(metadata) }
      })
    },
    shutdown: async () => undefined
  }
}
