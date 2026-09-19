import assert from "node:assert/strict"
import { AsyncLocalStorage } from "node:async_hooks"
import { registerHooks } from "node:module"

globalThis.AsyncLocalStorage = AsyncLocalStorage
const mode = process.argv[2]
assert.ok(["enabled", "disabled", "offline"].includes(mode))
registerHooks({
  resolve(specifier, context, nextResolve) {
    assert.ok(
      !/^@(?:sentry\/node(?:-core)?|opentelemetry\/sdk-node|langfuse\/otel)(?:\/|$)/u.test(specifier),
      `Node-only telemetry import: ${specifier}`
    )
    return nextResolve(specifier, context)
  }
})
const requests = []
globalThis.fetch = async (input, init) => {
  let url
  if (typeof input === "string") {
    url = input
  } else if (input instanceof URL) {
    url = input.href
  } else {
    url = input.url
  }
  requests.push({
    url,
    headers: new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  })
  return new Response("fixture", { status: 200 })
}
const Sentry = await import("@sentry/nextjs")
const { assertEdgeTelemetryRuntime, createEdgeSentryOptions } = await import("./edgeSentryOptions.ts")
assertEdgeTelemetryRuntime()
const envelopes = []
let sendFailures = 0
const clientOptions = createEdgeSentryOptions(
  {
    NODE_ENV: "test",
    NEXT_PUBLIC_SENTRY_DSN: mode === "disabled" ? undefined : "https://synthetic@o0.ingest.sentry.io/1",
    LEGISLATION_PUBLIC_API_BASE_URL: "https://trusted.example.test"
  },
  Sentry.winterCGFetchIntegration
)
Sentry.init({
  ...clientOptions,
  tracesSampleRate: mode === "disabled" ? 0 : 1,
  tracesSampler: () => (mode === "disabled" ? 0 : 1),
  sendClientReports: false,
  transport: () => ({
    async send(envelope) {
      if (mode === "offline") {
        sendFailures++
        throw new Error("synthetic transport offline")
      }
      envelopes.push(structuredClone(envelope))
      return { statusCode: 200 }
    },
    async flush() {
      return true
    }
  })
})
const client = Sentry.getClient()
assert.ok(client)
assert.equal(client.constructor.name, "VercelEdgeClient")
const completed = []
async function request(operation, traceId) {
  await Sentry.withIsolationScope(async (scope) => {
    scope.setTag("operation", operation)
    scope.setUser({ email: `PRIVATE-${operation}@example.test` })
    await Sentry.continueTrace({ sentryTrace: `${traceId}-${"c".repeat(16)}-1` }, async () => {
      await Sentry.startSpan({ name: "/api/bills/[billId]", op: "http.server" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, operation === "record_inspection" ? 5 : 1))
        assert.equal(Sentry.getIsolationScope().getScopeData().tags.operation, operation)
        await fetch(`https://trusted.example.test/${operation}`)
        await fetch(`https://untrusted.example.test/?redirect=https://trusted.example.test/${operation}`)
        Sentry.captureRequestError(
          new Error(`PRIVATE-${operation}`),
          {
            path: `/api/bills/PRIVATE-${operation}`,
            method: "GET",
            headers: { authorization: "synthetic-private" }
          },
          { routerKind: "App Router", routePath: "/api/bills/[billId]", routeType: "route" }
        )
        completed.push(operation)
      })
    })
  })
}
try {
  await Promise.all([request("record_inspection", "a".repeat(32)), request("reference_search", "b".repeat(32))])
  assert.equal(await client.flush(2000), true)
  assert.equal(completed.length, 2)
  assert.equal(requests.length, 4)
  assert.ok(
    requests
      .filter((entry) => entry.url.startsWith("https://untrusted."))
      .every((entry) => !entry.headers.has("sentry-trace") && !entry.headers.has("baggage"))
  )
  const items = envelopes.flatMap((envelope) => envelope[1])
  const errors = items.filter(([header]) => header.type === "event").map(([, payload]) => payload)
  const transactions = items.filter(([header]) => header.type === "transaction").map(([, payload]) => payload)
  if (mode === "enabled") {
    assert.equal(errors.length, 2)
    assert.equal(transactions.length, 2)
    assert.equal(new Set(errors.map((event) => event.contexts.trace.trace_id)).size, 2)
    assert.ok(
      errors.every(
        (event) => event.tags.operation === "record_inspection" || event.tags.operation === "reference_search"
      )
    )
    assert.ok(
      requests
        .filter((entry) => entry.url.startsWith("https://trusted."))
        .every((entry) => entry.headers.has("sentry-trace"))
    )
    assert.ok(!JSON.stringify(envelopes).includes("PRIVATE-"))
    assert.ok(!JSON.stringify(envelopes).includes("synthetic-private"))
  } else {
    assert.equal(envelopes.length, 0)
    assert.equal(sendFailures > 0, mode === "offline")
  }
  process.stdout.write(
    `${JSON.stringify({
      mode,
      runtime: client.constructor.name,
      requestsCompleted: completed.length,
      errors: errors.length,
      transactions: transactions.length,
      isolated: true,
      propagationRestricted: true
    })}\n`
  )
} finally {
  await client.close(2000)
}
