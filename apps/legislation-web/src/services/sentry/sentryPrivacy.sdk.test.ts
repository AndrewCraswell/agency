import type { Envelope, Integration } from "@sentry/core"
import { NodeClient, defaultStackParser, logger, metrics, startSpan, withScope } from "@sentry/nextjs"
import { expect, it, vi } from "vitest"
import { sentryOptions } from "./sentryOptions"
import { createSentryPrivacy } from "./sentryPrivacy"

const id = "d2bbbc76-7cf3-42f0-b566-644db71c86af"
const traceId = "a".repeat(32)
const spanId = "b".repeat(16)
const secret = "PRIVATE_RESEARCH alice@example.com Bearer secret-value"
type Diagnostic = NonNullable<NonNullable<Parameters<typeof createSentryPrivacy>[0]>["onDiagnostic"]>

function clientFixture() {
  const envelopes: Envelope[] = []
  const onDiagnostic = vi.fn<Diagnostic>()
  const { integration, ...hooks } = createSentryPrivacy({
    models: ["approved/model"],
    providers: ["approved"],
    release: "fixture-release",
    onDiagnostic
  })
  const sdkAddedFields: Integration = {
    name: "SyntheticSdkMetadata",
    setup(client) {
      client.on("beforeEnvelope", (envelope) => {
        envelope[0].trace = { transaction: secret, replay_id: id }
        envelope[0].secret = secret
      })
    }
  }
  const client = new NodeClient({
    ...sentryOptions,
    ...hooks,
    dsn: "https://synthetic@o0.ingest.sentry.io/1",
    release: "fixture-release",
    enableLogs: true,
    enableMetrics: true,
    sendClientReports: false,
    stackParser: defaultStackParser,
    integrations: [sdkAddedFields, integration],
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(structuredClone(envelope))
        return { statusCode: 200 }
      },
      flush: async () => true
    })
  })
  client.init()
  return { client, envelopes, onDiagnostic }
}

it("filters real SDK error, log and metric envelopes after SDK metadata is added", async () => {
  const { client, envelopes } = clientFixture()
  try {
    withScope((scope) => {
      scope.setClient(client)
      scope.setUser({ id, email: "alice@example.com" })
      scope.setContext("private", { prompt: secret })
      scope.setTag("private", secret)
      scope.captureException(new Error(secret))
      logger.info("conversation.submitted", {
        schema_version: 1,
        event_id: id,
        operation_id: id,
        attempt: 1,
        occurred_at: "2026-09-19T00:00:00Z",
        environment: "production",
        release: secret,
        runtime: "browser",
        route_template: "/conversations/[conversationId]",
        surface: "conversation",
        content_mode: "live",
        draft_id: id,
        draft_origin: "typed",
        size_bucket: "1-80",
        reference_count: 0,
        turn_kind: "new",
        submit_method: "button",
        prompt: secret
      })
      metrics.distribution("rostra.chat.duration", 20, {
        unit: "millisecond",
        attributes: {
          environment: "production",
          runtime: "node",
          content_mode: "live",
          origin: "server",
          outcome: "completed",
          private: secret
        }
      })
    })
    expect(await client.flush(2000)).toBe(true)
    const items = envelopes.flatMap<Envelope[1][number]>((envelope) => envelope[1])
    expect(items.map(([header]) => header.type)).toEqual(expect.arrayContaining(["event", "log", "trace_metric"]))
    expect(items.find(([header]) => header.type === "event")?.[1]).toMatchObject({
      platform: "node",
      user: { ip_address: null }
    })
    expect(JSON.stringify(envelopes)).not.toMatch(/PRIVATE_RESEARCH|alice@|Bearer|secret-value/)
    expect(JSON.stringify(envelopes)).toContain("fixture-release")
    expect(JSON.stringify(envelopes)).toContain("conversation.submitted")
    expect(JSON.stringify(envelopes)).toContain("rostra.chat.duration")
  } finally {
    await client.close(2000)
  }
})

it("retains allowlisted database attributes from a real SDK span envelope", async () => {
  const { client, envelopes } = clientFixture()
  try {
    await withScope(async (scope) => {
      scope.setClient(client)
      await startSpan(
        {
          name: "bill.timeline",
          op: "db.query",
          attributes: {
            "db.pool.name": "canonical",
            "db.query.name": "bill.timeline",
            "db.query.revision": 1
          }
        },
        async (span) => {
          span.setAttribute("db.connection_wait.canonical_ms", 12)
          span.setAttribute("db.duration_ms", 34)
          span.setAttribute("db.result_count", 5)
          span.setStatus({ code: 1 })
        }
      )
    })
    expect(await client.flush(2000)).toBe(true)
    const serialized = JSON.stringify(envelopes)
    expect(serialized).toContain("bill.timeline")
    expect(serialized).toContain("db.query.name")
    expect(serialized).toContain("db.query.revision")
    expect(serialized).toContain("db.connection_wait.canonical_ms")
    expect(serialized).toContain("db.duration_ms")
    expect(serialized).toContain("db.result_count")
  } finally {
    await client.close(2000)
  }
})

it("projects streamed AI child spans and drops recordings, attachments and unknown signal types", async () => {
  const { client, envelopes, onDiagnostic } = clientFixture()
  const span = {
    trace_id: traceId,
    span_id: spanId,
    start_timestamp: 1,
    end_timestamp: 2,
    status: "ok",
    is_segment: false,
    name: secret,
    attributes: {
      "sentry.op": { type: "string", value: "gen_ai.chat" },
      "gen_ai.request.model": { type: "string", value: "approved/model" },
      "gen_ai.usage.input_tokens": { type: "integer", value: 5 },
      "gen_ai.input.messages": { type: "string", value: secret },
      "sentry.user.email": { type: "string", value: "alice@example.com" }
    },
    links: [{ attributes: { secret } }]
  }
  try {
    await Reflect.apply(client.sendEnvelope, client, [
      [
        { sent_at: "2026-09-19T00:00:00Z", private: secret },
        [
          [
            { type: "span", content_type: "application/vnd.sentry.items.span.v2+json", item_count: 999 },
            { items: [span], private: secret }
          ],
          [{ type: "attachment", filename: secret, length: 3 }, new Uint8Array([1, 2, 3])],
          [{ type: "replay_event" }, { urls: [secret], user: { email: "alice@example.com" } }],
          [{ type: "replay_recording" }, { private: secret }],
          [{ type: "unknown_future_type" }, { private: secret }]
        ]
      ]
    ])
    const items = envelopes.flatMap<Envelope[1][number]>((envelope) => envelope[1])
    expect(items).toHaveLength(1)
    expect(items[0]?.[0]).toMatchObject({ type: "span", item_count: 1 })
    expect(items[0]?.[1]).toMatchObject({
      items: [
        {
          name: "gen_ai.chat",
          trace_id: traceId,
          attributes: { "gen_ai.usage.input_tokens": { type: "integer", value: 5 } }
        }
      ],
      ingest_settings: { infer_ip: "never", infer_user_agent: "never" }
    })
    expect(JSON.stringify(envelopes)).not.toMatch(/PRIVATE_RESEARCH|alice@|secret-value/)
    expect(span.attributes["gen_ai.input.messages"].value).toBe(secret)
    expect(onDiagnostic).toHaveBeenCalledWith({ signal: "envelope", reason: "unsupported_item", count: 4 })
  } finally {
    await client.close(2000)
  }
})

it("applies final typed-attribute byte limits and rejects malformed SDK containers", async () => {
  const { client, envelopes, onDiagnostic } = clientFixture()
  try {
    await Reflect.apply(client.sendEnvelope, client, [
      [
        {},
        [
          [
            { type: "trace_metric", item_count: 1 },
            {
              items: [
                {
                  trace_id: traceId,
                  timestamp: 1,
                  name: "rostra.chat.duration",
                  type: "distribution",
                  unit: "millisecond",
                  value: 1,
                  attributes: {
                    environment: { type: "string", value: "production" },
                    runtime: { type: "string", value: "node" },
                    content_mode: { type: "string", value: "live" },
                    origin: { type: "string", value: "server" },
                    outcome: { type: "string", value: "completed" },
                    private: { type: "string", value: secret.repeat(1000) }
                  }
                }
              ]
            }
          ],
          [{ type: "log", item_count: 1 }, { items: [{ body: secret }] }],
          [{ type: "span" }, { start_timestamp: 1, timestamp: 2, description: secret }],
          [{ type: "trace_metric" }, { items: secret }]
        ]
      ]
    ])
    const items = envelopes.flatMap<Envelope[1][number]>((envelope) => envelope[1])
    expect(items).toHaveLength(1)
    expect(new TextEncoder().encode(JSON.stringify(items[0]?.[1])).byteLength).toBeLessThan(2048)
    expect(JSON.stringify(envelopes)).not.toContain("PRIVATE_RESEARCH")
    expect(onDiagnostic).toHaveBeenCalledWith({ signal: "log", reason: "invalid_payload", count: 1 })
    expect(onDiagnostic).toHaveBeenCalledWith({ signal: "span", reason: "invalid_payload", count: 1 })
  } finally {
    await client.close(2000)
  }
})

it("keeps shared configuration fail-closed for replay, automatic AI and optional signals", () => {
  expect(sentryOptions).toMatchObject({
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    traceLifecycle: "static",
    streamGenAiSpans: false,
    enableLogs: false,
    enableMetrics: false,
    sendDefaultPii: false,
    maxBreadcrumbs: 20,
    transportOptions: { bufferSize: 32 }
  })
  expect(sentryOptions.integrations.map((integration) => integration.name)).toContain("RostraPrivacy")
  expect(sentryOptions.tracesSampler()).toBe(1)
})
