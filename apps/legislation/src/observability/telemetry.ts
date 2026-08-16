import { LangfuseSpanProcessor } from "@langfuse/otel"
import { startActiveObservation } from "@langfuse/tracing"
import { NodeSDK } from "@opentelemetry/sdk-node"
import type { LegislationConfig } from "../config/config.js"

export interface Telemetry {
  observe<T>(name: string, metadata: Readonly<Record<string, unknown>>, operation: () => Promise<T>): Promise<T>
  shutdown(): Promise<void>
}

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
          observation.update({ metadata: sanitizeTelemetry(metadata) as Record<string, unknown> })
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
  if (typeof value !== "object" || value === null || !("items" in value)) {
    return undefined
  }
  return Array.isArray(value.items) ? value.items.length : undefined
}

export function sanitizeTelemetry(value: unknown, key = ""): unknown {
  if (/token|secret|password|api[-_]?key|authorization/i.test(key)) {
    return "[REDACTED]"
  }
  if (typeof value === "string") {
    const redacted = value.replaceAll(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    return redacted.length > 2000 ? `${redacted.slice(0, 2000)}[TRUNCATED]` : redacted
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeTelemetry(item))
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [childKey, sanitizeTelemetry(child, childKey)])
    )
  }
  return value
}
