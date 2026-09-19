import { propagateAttributes } from "@langfuse/tracing"
import { expect, it, vi } from "vitest"
import { startNodeTelemetry } from "../../services/sentry/nodeTelemetry"
import { createAnalyticsTelemetry } from "./analytics-telemetry"

const sentry = vi.hoisted(() => ({
  captureException: vi.fn<(...parameters: unknown[]) => void>(),
  setStatus: vi.fn<(...parameters: unknown[]) => void>(),
  setAttribute: vi.fn<(...parameters: unknown[]) => void>(),
  setAttributes: vi.fn<(...parameters: unknown[]) => void>()
}))
vi.mock("@sentry/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/core")>()),
  captureException: sentry.captureException,
  startSpan: async (_options: unknown, operation: (span: typeof sentry) => Promise<unknown>) => await operation(sentry)
}))

it("exports correlated analytics stages and scrubbed failure metadata", async () => {
  const spans: { name: string; attributes: Readonly<Record<string, unknown>>; traceId: string }[] = []
  const exporter = startNodeTelemetry({
    langfuse: {
      publicKey: "test-public",
      secretKey: "test-secret",
      mediaUploadEnabled: false,
      exporter: {
        export(batch, callback) {
          for (const span of batch) {
            spans.push({ name: span.name, attributes: span.attributes, traceId: span.spanContext().traceId })
          }
          callback({ code: 0 })
        },
        shutdown: async () => undefined
      }
    }
  })
  const telemetry = createAnalyticsTelemetry()
  const metadata = {
    dataset: "bills",
    queryHash: "query-123",
    joinCount: 2,
    rowCount: 10,
    resultBytes: 320,
    input: { authorization: "Bearer private-token", dataset: "bills" }
  }
  try {
    await Promise.all(
      ["analytics-session-a", "analytics-session-b"].map(
        async (sessionId) =>
          await propagateAttributes(
            { sessionId },
            async () => await telemetry.observe("analytics.execute", metadata, async () => 1)
          )
      )
    )
    const error = Object.assign(new Error("private SQL diagnostic"), { code: "57014" })
    await expect(
      telemetry.observe("analytics.execute", metadata, async () => {
        throw error
      })
    ).rejects.toBe(error)
    telemetry.reportFailure?.("analytics", { ...metadata, stage: "execute" }, error)
    await exporter.flush()
    const first = spans.find((span) => span.attributes["session.id"] === "analytics-session-a")
    const second = spans.find((span) => span.attributes["session.id"] === "analytics-session-b")
    expect(first?.traceId).toBeDefined()
    expect(second?.traceId).toBeDefined()
    expect(first?.traceId).not.toBe(second?.traceId)
    const output = JSON.stringify(spans)
    expect(output).toContain("query-123")
    expect(output).toContain("resultBytes")
    expect(output).toContain("ERROR")
    expect(output).not.toContain("private")
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ stage: "execute", databaseCode: "57014", queryHash: "query-123" })
      })
    )
    expect(JSON.stringify(sentry.captureException.mock.calls)).not.toContain("private")
  } finally {
    await exporter.shutdown()
  }
})
