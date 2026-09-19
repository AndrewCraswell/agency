import { getActiveSpan, spanToJSON } from "@sentry/core"
import type { TextStreamPart, ToolSet } from "ai"
import invariant from "tiny-invariant"
import { afterAll, beforeAll, expect, it } from "vitest"
import { observeChatResponse } from "../../modules/conversations/capture"
import { startNodeTelemetry } from "./nodeTelemetry"
import {
  associateTelemetryRun,
  currentTelemetryCorrelation,
  linkTelemetryTraces,
  withRequestTelemetry
} from "./requestTelemetry"

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
it("isolates concurrent requests, preserves application correlation and exposes only safe IDs", async () => {
  const calls = await Promise.all(
    ["a", "b"].map(async (name) => {
      const browserId = crypto.randomUUID()
      const request = new Request(`https://app.example.test/chat`, {
        method: "POST",
        headers: { "x-correlation-id": `public-${name}`, "x-rostra-request-id": browserId, baggage: `private=${name}` },
        body: JSON.stringify({ sessionKey: "PRIVATE" })
      })
      let requestId: string | undefined
      const response = await withRequestTelemetry(request, async (safe) => {
        const initial = currentTelemetryCorrelation()
        requestId = initial.request_id
        associateTelemetryRun(crypto.randomUUID())
        await new Promise((resolve) => setTimeout(resolve, name === "a" ? 5 : 1))
        expect(currentTelemetryCorrelation().request_id).toBe(requestId)
        expect(currentTelemetryCorrelation().browser_request_id).toBe(browserId)
        expect(safe.headers.get("x-correlation-id")).toBe(`public-${name}`)
        expect(safe.headers.get("baggage")).toBeNull()
        expect(await safe.json()).toEqual({ sessionKey: "PRIVATE" })
        return Response.json({ ok: true }, { status: 201 })
      })
      expect(response.status).toBe(201)
      expect(response.headers.get("x-rostra-request-id")).toBe(requestId)
      expect(await response.json()).toEqual({ ok: true })
      return requestId
    })
  )
  expect(new Set(calls).size).toBe(2)
  expect(currentTelemetryCorrelation()).toEqual({})
})

it("keeps one request identity through nested boundaries and does not consume streaming responses", async () => {
  const response = await withRequestTelemetry(new Request("https://app.example.test/chat"), async (request) => {
    const initial = currentTelemetryCorrelation().request_id
    return withRequestTelemetry(request, async () => {
      expect(currentTelemetryCorrelation().request_id).toBe(initial)
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("stream"))
            controller.close()
          }
        })
      )
    })
  })
  expect(await response.text()).toBe("stream")
})

it("links an asynchronous research run without keeping the response request span alive", async () => {
  let captured: ReturnType<typeof observeChatResponse> | undefined
  let streamController: ReadableStreamDefaultController<TextStreamPart<ToolSet>> | undefined
  let requestTrace: string | undefined
  let requestSpan: ReturnType<typeof getActiveSpan>
  let hasCompleted = false
  const response = await withRequestTelemetry(new Request("https://app.example.test/chat"), async () => {
    requestTrace = currentTelemetryCorrelation().sentry_trace_id
    requestSpan = getActiveSpan()
    associateTelemetryRun(crypto.randomUUID())
    captured = observeChatResponse({
      sessionId: crypto.randomUUID(),
      input: {},
      metadata: {},
      start: () =>
        new ReadableStream<TextStreamPart<ToolSet>>({
          start(controller) {
            streamController = controller
          }
        })
    })
    void captured.completed.then(() => {
      hasCompleted = true
    })
    await captured.stream
    return new Response("headers-ready")
  })
  expect(await response.text()).toBe("headers-ready")
  invariant(captured)
  invariant(streamController)
  try {
    invariant(requestSpan)
    expect(spanToJSON(requestSpan).timestamp).toBeDefined()
    expect(hasCompleted).toBe(false)
    const correlation = captured.getCorrelation()
    expect(correlation.request_id).toBe(response.headers.get("x-rostra-request-id"))
    expect(correlation.parent_request_trace_id).toBe(requestTrace)
    expect(correlation.langfuse_trace_id).toMatch(/^[a-f0-9]{32}$/u)
    expect(correlation.sentry_trace_id).toMatch(/^[a-f0-9]{32}$/u)
    expect(correlation.sentry_trace_id).not.toBe(requestTrace)
  } finally {
    streamController.close()
  }
  await captured.completed
  expect(currentTelemetryCorrelation()).toEqual({})
})

it("retains independently supplied vendor references and omits invalid references instead of reusing old ones", async () => {
  await withRequestTelemetry(new Request("https://app.example.test/chat"), async () => {
    const sentryTrace = currentTelemetryCorrelation().sentry_trace_id
    const linked = linkTelemetryTraces("c".repeat(32))
    expect(linked.sentry_trace_id).toBe(sentryTrace)
    expect(linked.langfuse_trace_id).toBe("c".repeat(32))
    expect(linked.langfuse_trace_id).not.toBe(linked.sentry_trace_id)
    const invalid = linkTelemetryTraces("PRIVATE")
    expect(invalid.langfuse_trace_id).toBeUndefined()
    expect(invalid.sentry_trace_id).toBe(sentryTrace)
    return new Response("ok")
  })
})

it("restores request isolation after application failures", async () => {
  const failure = new Error("application failure")
  await expect(
    withRequestTelemetry(new Request("https://app.example.test/chat"), async () => {
      associateTelemetryRun(crypto.randomUUID())
      throw failure
    })
  ).rejects.toBe(failure)
  expect(currentTelemetryCorrelation()).toEqual({})
})

it("accepts framework-proxied requests without losing body, abort or fetch options", async () => {
  const controller = new AbortController()
  const original = new Request("https://app.example.test/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"sessionKey":"PRIVATE"}',
    signal: controller.signal,
    credentials: "include",
    cache: "no-store",
    redirect: "manual"
  })
  const proxied = new Proxy(original, {
    get: (target, property) => Reflect.get(target, property, target)
  })
  const response = await withRequestTelemetry(proxied, async (request) => {
    expect(request.method).toBe("POST")
    expect(request.credentials).toBe("include")
    expect(request.cache).toBe("no-store")
    expect(request.redirect).toBe("manual")
    expect(request.headers.get("content-type")).toBe("application/json")
    expect(await request.json()).toEqual({ sessionKey: "PRIVATE" })
    controller.abort()
    expect(request.signal.aborted).toBe(true)
    return new Response("ok")
  })
  expect(response.headers.get("x-rostra-request-id")).toMatch(/^[a-f0-9-]{36}$/u)
})
