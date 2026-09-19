import assert from "node:assert/strict"
import { context, createContextKey, trace, TraceFlags } from "@opentelemetry/api"
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base"
// oxlint-disable-next-line import/default -- Exercise the SDK's actual CommonJS node export through native ESM.
import Sentry from "@sentry/nextjs"
import { SentryAsyncLocalStorageContextManager } from "@sentry/opentelemetry"
import { startNodeTelemetry, registerNodeTelemetry } from "./nodeTelemetry.ts"

const mode = process.argv[2]
const envelopes = []
const spans = []
const originals = []
const sentryEnabled = !["langfuse", "disabled"].includes(mode)
const langfuseEnabled = ["both", "recording", "langfuse"].includes(mode)
const rate = ["both", "sentry"].includes(mode) ? 1 : 0

if (mode === "registration") {
  assert.equal(registerNodeTelemetry({ NEXT_PHASE: "phase-production-build" }, undefined), undefined)
  assert.throws(() => registerNodeTelemetry({ LANGFUSE_PUBLIC_KEY: "incomplete" }, undefined), /both public and secret/)
  const runtime = registerNodeTelemetry({ NODE_ENV: "test" }, undefined)
  assert.ok(runtime)
  assert.equal(registerNodeTelemetry({ NODE_ENV: "test" }, undefined), runtime)
  assert.throws(() => registerNodeTelemetry({ NODE_ENV: "production" }, undefined), /configuration changed/)
  assert.throws(() => startNodeTelemetry({}), /already has an owner/)
  const firstShutdown = runtime.shutdown()
  assert.equal(runtime.shutdown(), firstShutdown)
  await firstShutdown
  assert.equal(globalThis.__rostraNodeTelemetryOwner, undefined)
  process.stdout.write(`${JSON.stringify({ mode, passed: true })}\n`)
} else if (mode === "conflict") {
  const foreign = new BasicTracerProvider()
  assert.equal(trace.setGlobalTracerProvider(foreign), true)
  assert.throws(() => startNodeTelemetry({}), /conflicting OpenTelemetry tracer/)
  assert.equal(globalThis.__rostraNodeTelemetryOwner, undefined)
  const remaining = trace.getTracer("foreign-owner").startSpan("still-active")
  assert.equal(remaining.isRecording(), true)
  remaining.end()
  trace.disable()
  context.disable()
  await foreign.shutdown()
  process.stdout.write(`${JSON.stringify({ mode, passed: true })}\n`)
} else if (mode === "context_conflict") {
  const foreign = new SentryAsyncLocalStorageContextManager().enable()
  assert.equal(context.setGlobalContextManager(foreign), true)
  const marker = createContextKey("foreign-runtime-test")
  const active = context.active().setValue(marker, "retained")
  await context.with(active, async () => {
    assert.throws(() => startNodeTelemetry({}), /conflicting OpenTelemetry context manager/)
    await Promise.resolve()
    assert.equal(context.active().getValue(marker), "retained")
  })
  context.disable()
  process.stdout.write(`${JSON.stringify({ mode, passed: true })}\n`)
} else if (mode === "timeout") {
  const runtime = startNodeTelemetry({
    lifecycleTimeoutMs: 25,
    sentry: {
      dsn: "https://synthetic@o0.ingest.sentry.io/1",
      registerEsmLoaderHooks: false,
      transport: () => ({
        send: async () => ({ statusCode: 200 }),
        flush: () => new Promise(() => undefined)
      })
    }
  })
  await assert.rejects(runtime.flush(), /timed out/)
  process.stdout.write(`${JSON.stringify({ mode, passed: true })}\n`)
  process.exit(0)
} else {
  const runtime = startNodeTelemetry({
    sentry: {
      dsn: sentryEnabled ? "https://synthetic@o0.ingest.sentry.io/1" : undefined,
      enabled: sentryEnabled,
      environment: "test",
      release: "node-fixture",
      registerEsmLoaderHooks: false,
      tracesSampler: () => rate,
      transport: () => ({
        async send(envelope) {
          if (mode === "offline") {
            throw new Error("synthetic collector unavailable")
          }
          envelopes.push(structuredClone(envelope))
          return { statusCode: 200 }
        },
        async flush() {
          return mode !== "offline"
        }
      })
    },
    langfuse: langfuseEnabled
      ? {
          publicKey: "synthetic-public",
          secretKey: "synthetic-secret",
          mediaUploadEnabled: false,
          shouldExportSpan: ({ otelSpan }) => otelSpan.attributes["probe.eligible"] === true,
          mask: () => "[MASKED]",
          exporter: {
            export(batch, callback) {
              spans.push(
                ...batch.map((span) => ({
                  traceId: span.spanContext().traceId,
                  spanId: span.spanContext().spanId,
                  parentId: span.parentSpanContext?.spanId,
                  attributes: structuredClone(span.attributes)
                }))
              )
              callback({ code: 0 })
            },
            shutdown: async () => undefined
          }
        }
      : undefined
  })
  const tracer = trace.getTracer("rostra-runtime-test")
  const run = (operation) =>
    Sentry.withIsolationScope(async (scope) => {
      scope.setTag("operation", operation)
      scope.setUser({ email: "PRIVATE@example.test" })
      await tracer.startActiveSpan(
        "/api/bills",
        { attributes: { "probe.eligible": true, "sentry.op": "http.server" } },
        async (root) => {
          await new Promise((resolve) => setTimeout(resolve, operation === "record_inspection" ? 5 : 1))
          assert.equal(Sentry.getIsolationScope().getScopeData().tags.operation, operation)
          const child = tracer.startSpan("get_bill", {
            attributes: {
              "probe.eligible": true,
              "langfuse.observation.input": JSON.stringify({ text: "PRIVATE_MODEL" }),
              "sentry.op": "gen_ai.chat",
              "gen_ai.usage.input_tokens": 3
            }
          })
          originals.push({ span: child, traceId: child.spanContext().traceId, flags: child.spanContext().traceFlags })
          Sentry.captureException(new Error("PRIVATE_MODEL"))
          child.end()
          root.end()
        }
      )
    })
  try {
    await Promise.all([run("record_inspection"), run("reference_search")])
    if (mode === "offline") {
      await assert.rejects(runtime.flush(), /did not flush/)
    } else {
      await runtime.flush()
    }
    const items = envelopes.flatMap((envelope) => envelope[1])
    const transactions = items.filter(([header]) => header.type === "transaction")
    const errors = items.filter(([header]) => header.type === "event")
    assert.equal(transactions.length, sentryEnabled && rate === 1 ? 2 : 0)
    assert.equal(errors.length, sentryEnabled && mode !== "offline" ? 2 : 0)
    for (const [, event] of errors) {
      assert.ok(originals.some((original) => original.traceId === event.contexts.trace.trace_id))
    }
    for (const [, transaction] of transactions) {
      assert.equal(transaction.spans.length, 1)
      assert.equal(new Set(transaction.spans.map((span) => span.span_id)).size, transaction.spans.length)
    }
    assert.equal(spans.length, langfuseEnabled ? 4 : 0)
    assert.ok(!JSON.stringify(envelopes).includes("PRIVATE"))
    assert.ok(!JSON.stringify(spans).includes("PRIVATE"))
    assert.ok(originals.every((entry) => entry.flags === (rate === 1 ? TraceFlags.SAMPLED : TraceFlags.NONE)))
    if (langfuseEnabled) {
      assert.equal(new Set(spans.map((span) => span.traceId)).size, 2)
      for (const root of spans.filter((span) => !span.parentId)) {
        assert.ok(spans.some((child) => child.parentId === root.spanId && child.traceId === root.traceId))
      }
      assert.ok(
        originals.every((entry) => entry.span.attributes["langfuse.observation.input"].includes("PRIVATE_MODEL"))
      )
    }
    process.stdout.write(
      `${JSON.stringify({ mode, passed: true, transactions: transactions.length, observations: spans.length })}\n`
    )
  } finally {
    if (mode === "offline") {
      await assert.rejects(runtime.shutdown(), /did not flush/)
    } else {
      await runtime.shutdown()
    }
  }
}
