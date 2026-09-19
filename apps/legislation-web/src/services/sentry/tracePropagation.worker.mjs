import assert from "node:assert/strict"
import { createServer } from "node:http"
import { context, propagation, ROOT_CONTEXT, trace } from "@opentelemetry/api"
import { default as Sentry } from "@sentry/nextjs"
import { createCorrelatedFetch } from "./correlatedFetch.ts"
import { startNodeTelemetry } from "./nodeTelemetry.ts"

const received = []
async function server() {
  const instance = createServer((request, response) => {
    received.push({ host: request.headers.host, headers: { ...request.headers } })
    if (request.url === "/redirect" && redirectTarget) {
      response.writeHead(302, { location: redirectTarget })
    }
    response.end("fixture")
  })
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve))
  const address = instance.address()
  assert.ok(address && typeof address === "object")
  return { instance, origin: `http://127.0.0.1:${address.port}` }
}
const first = await server()
const second = await server()
const redirectTarget = `${second.origin}/redirected-source`
const runtime = startNodeTelemetry({
  sentry: {
    dsn: "http://synthetic@127.0.0.1:1/1",
    registerEsmLoaderHooks: false,
    tracesSampler: () => 0,
    tracePropagationTargets: [new RegExp(`^${first.origin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/`, "u")],
    integrations: [Sentry.nativeNodeFetchIntegration({ breadcrumbs: false })],
    transport: () => ({ send: async () => ({ statusCode: 200 }), flush: async () => true })
  }
})
try {
  const inbound = {
    "sentry-trace": `${"a".repeat(32)}-${"b".repeat(16)}-1`,
    baggage: "private=PRIVATE_BAG,sentry-transaction=PRIVATE_BAG"
  }
  const extracted = propagation.extract(ROOT_CONTEXT, inbound, {
    keys: (carrier) => Object.keys(carrier),
    get: (carrier, key) => carrier[key]
  })
  assert.equal(trace.getSpanContext(extracted).traceId, "a".repeat(32))
  assert.equal(trace.getSpanContext(extracted).traceFlags, 0)
  assert.equal(propagation.getBaggage(extracted), undefined)
  const withBaggage = propagation.setBaggage(
    extracted,
    propagation.createBaggage({ private: { value: "PRIVATE_BAG" } })
  )
  const fetcher = createCorrelatedFetch(fetch, () => first.origin)
  await context.with(withBaggage, async () => {
    await Sentry.startSpan({ name: "/chat", op: "http.server" }, async () => {
      await fetcher(`${first.origin}/chat`)
      await fetcher(`${second.origin}/model`, {
        headers: {
          "sentry-trace": inbound["sentry-trace"],
          baggage: "private=PRIVATE_BAG",
          "x-rostra-request-id": crypto.randomUUID()
        }
      })
      await assert.rejects(fetcher(`${first.origin}/redirect`), TypeError)
    })
  })
  const trusted = received[0].headers
  const untrusted = received[1].headers
  assert.match(trusted["x-rostra-request-id"], /^[a-f0-9-]{36}$/u)
  assert.ok(trusted["sentry-trace"]?.startsWith("a".repeat(32)))
  assert.ok(trusted["sentry-trace"]?.endsWith("-0"))
  assert.ok(Buffer.byteLength(trusted.baggage ?? "", "utf8") <= 8192)
  assert.ok(
    (trusted.baggage ?? "")
      .split(",")
      .every(
        (entry) =>
          !entry ||
          /^sentry-(environment|release|public_key|trace_id|sampled|sample_rand|sample_rate|org_id)=/u.test(entry)
      )
  )
  assert.equal(untrusted["sentry-trace"], undefined)
  assert.equal(untrusted.traceparent, undefined)
  assert.equal(untrusted.baggage, undefined)
  assert.equal(untrusted["x-rostra-request-id"], undefined)
  assert.equal(received.filter(({ host }) => host === new URL(second.origin).host).length, 1)
  assert.ok(!JSON.stringify(received).includes("PRIVATE_BAG"))
  process.stdout.write(
    `${JSON.stringify({ propagated: true, privateBaggageRemoved: true, untrustedOriginClean: true })}\n`
  )
} finally {
  await runtime.shutdown()
  await Promise.all([first, second].map(({ instance }) => new Promise((resolve) => instance.close(resolve))))
}
