import { LangfuseSpanProcessor } from "@langfuse/otel"
import { startActiveObservation } from "@langfuse/tracing"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { sanitizeTelemetry } from "@repo/legislation-core/observability/sanitize-telemetry"
import type { Telemetry } from "@repo/legislation-core/observability/telemetry"
import type { LegislationConfig } from "../config/config.js"

export function createTelemetry(config: LegislationConfig): Telemetry {
  const publicKey = config.observability.langfusePublicKey
  const secretKey = config.observability.langfuseSecretKey
  if (publicKey === undefined || secretKey === undefined) {
    return {
      observe: async (_name, _metadata, operation) => operation(),
      shutdown: async () => undefined
    }
  }
  const processor = new LangfuseSpanProcessor({
    baseUrl: config.observability.langfuseBaseUrl,
    environment: config.environment,
    mask: ({ data }) => sanitizeTelemetry(data),
    mediaUploadEnabled: false,
    publicKey,
    secretKey
  })
  const sdk = new NodeSDK({ spanProcessors: [processor] })
  sdk.start()
  return {
    observe: async (name, metadata, operation) =>
      startActiveObservation(
        name,
        async (observation) => {
          observation.update({
            metadata: Object.fromEntries(
              Object.entries(metadata).map(([key, value]) => [key, sanitizeTelemetry(value, key)])
            )
          })
          try {
            const result = await operation()
            observation.update({ output: { resultCount: resultCount(result), status: "succeeded" } })
            return result
          } catch (error) {
            observation.update({
              level: "ERROR",
              output: { error: error instanceof Error ? error.name : "UnknownError", status: "failed" }
            })
            throw error
          }
        },
        { asType: "tool" }
      ),
    shutdown: async () => sdk.shutdown()
  }
}

function resultCount(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null || !("items" in value)) return undefined
  return Array.isArray(value.items) ? value.items.length : undefined
}
