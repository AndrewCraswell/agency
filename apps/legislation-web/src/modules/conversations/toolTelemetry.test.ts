import { getActiveSpan, startSpan, spanToJSON } from "@sentry/core"
import invariant from "tiny-invariant"
import { afterAll, beforeAll, expect, it } from "vitest"
import { startNodeTelemetry } from "../../services/sentry/nodeTelemetry"
import { observeTool, recordToolMeasurement } from "./toolTelemetry"

let runtime: ReturnType<typeof startNodeTelemetry>
beforeAll(() => {
  runtime = startNodeTelemetry({
    sentry: {
      dsn: "http://synthetic@127.0.0.1:1/1",
      registerEsmLoaderHooks: false,
      tracesSampler: () => 1,
      transport: () => ({ send: async () => ({ statusCode: 200 }), flush: async () => true })
    }
  })
})
afterAll(async () => {
  await runtime.shutdown()
})

it("reuses the AI SDK invocation span and projects canonical measurements without provider content", async () => {
  await startSpan(
    { name: "execute_tool get_bill", attributes: { "gen_ai.tool.name": "get_bill" } },
    async (existing) => {
      await observeTool("get_bill", async (span) => {
        expect(span.spanContext().spanId).toBe(existing.spanContext().spanId)
        const id = crypto.randomUUID()
        recordToolMeasurement(
          span,
          {
            runId: crypto.randomUUID(),
            toolCallId: "PRIVATE_PROVIDER_ID",
            toolName: "get_bill",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 20,
            dependencyDurationMs: 12,
            rawResultBytes: 40,
            enrichedResultBytes: 80,
            modelResultBytes: 60,
            resultCount: 1,
            hasNextPage: false,
            outcome: "error",
            failureCode: "result_limit",
            attemptCount: 1,
            internalRetryCount: null,
            retryOfToolCallId: null
          },
          id,
          "serialization"
        )
        expect(spanToJSON(span).data).toMatchObject({
          tool_call_id: id,
          stage: "serialization",
          durationMs: 20,
          failureCode: "result_limit"
        })
        expect(JSON.stringify(spanToJSON(span))).not.toContain("PRIVATE_PROVIDER_ID")
      })
    }
  )
})

it("creates an invocation span when the AI integration is disabled", async () => {
  await observeTool("get_bill", async (span) => {
    invariant(getActiveSpan())
    expect(getActiveSpan()?.spanContext().spanId).toBe(span.spanContext().spanId)
    expect(spanToJSON(span)).toMatchObject({ description: "research.tool", op: "gen_ai.execute_tool" })
  })
})
