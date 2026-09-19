import type { ErrorEvent, Log, SpanJSON, TransactionEvent } from "@sentry/core"
import { describe, expect, it, vi } from "vitest"
import { safeCodeLocation } from "./sentryPayloadFields"
import { createSentryPrivacy } from "./sentryPrivacy"
import { projectSentrySpan } from "./sentrySignalProjection"

const privateText = "PRIVATE_RESEARCH alice@example.com Bearer synthetic-token 123 Private Street"
const id = "d2bbbc76-7cf3-42f0-b566-644db71c86af"
const traceId = "a".repeat(32)
const spanId = "b".repeat(16)
const policy = { models: ["approved/model"], providers: ["approved"], release: "release-123" }
const spy = () => vi.fn<NonNullable<NonNullable<Parameters<typeof createSentryPrivacy>[0]>["onDiagnostic"]>>()

function errorFixture(): ErrorEvent {
  return {
    type: undefined,
    event_id: traceId,
    timestamp: 123,
    level: "error",
    release: privateText,
    environment: "production",
    message: privateText,
    logentry: { message: privateText, params: [privateText] },
    server_name: privateText,
    transaction: `/conversations/${privateText}`,
    user: { id: id, email: "alice@example.com", ip_address: "192.0.2.1" },
    request: {
      url: `https://example.com/private/${privateText}`,
      headers: { authorization: privateText },
      data: privateText
    },
    contexts: {
      trace: {
        trace_id: traceId,
        span_id: spanId,
        op: "http.server",
        data: { "http.request.method": "POST", request: privateText }
      },
      browser: { userAgent: privateText },
      replay: { replay_id: id },
      custom: { data: privateText }
    },
    fingerprint: [privateText],
    tags: {
      operation: "tool_call",
      tool: "get_bill",
      category: "result_limit",
      runId: id,
      model: "approved/model",
      provider: "approved",
      user_id: id,
      secret: privateText
    },
    extra: {
      unresolvedCitationCount: 1,
      evidenceCount: 2,
      prompt: privateText,
      measurement: {
        runId: id,
        toolCallId: privateText,
        toolName: "get_bill",
        startedAt: "2026-09-19T01:00:00Z",
        finishedAt: "2026-09-19T01:00:01Z",
        durationMs: 1000,
        dependencyDurationMs: 900,
        rawResultBytes: 50,
        enrichedResultBytes: 60,
        modelResultBytes: 70,
        resultCount: 1,
        hasNextPage: true,
        outcome: "error",
        failureCode: "result_limit",
        attemptCount: 1,
        internalRetryCount: null,
        retryOfToolCallId: null,
        input: privateText,
        output: privateText
      }
    },
    exception: {
      values: [
        {
          type: "TypeError",
          value: privateText,
          module: privateText,
          mechanism: { type: privateText, handled: false, data: { original: privateText } },
          stacktrace: {
            frames: [
              {
                filename:
                  "https://user:password@example.com/_next/static/chunks/a123beef.js?token=PRIVATE_RESEARCH#private",
                abs_path: privateText,
                function: privateText,
                module: privateText,
                lineno: 12,
                colno: 3,
                in_app: true,
                debug_id: id,
                context_line: privateText,
                pre_context: [privateText],
                post_context: [privateText],
                vars: { token: privateText },
                module_metadata: { text: privateText }
              },
              { filename: `https://private.example/${privateText}.js`, function: privateText }
            ]
          }
        },
        { type: privateText, value: privateText }
      ]
    },
    breadcrumbs: [
      { category: "console", message: privateText, data: { text: privateText } },
      {
        message: "research.tool_finished",
        data: { tool_name: "get_bill", durationMs: 5, args: privateText, url: privateText }
      }
    ],
    debug_meta: {
      images: [
        {
          type: "sourcemap",
          debug_id: id,
          code_file: "https://secret:secret@example.com/_next/static/chunks/a123beef.js?secret=PRIVATE_RESEARCH"
        }
      ]
    },
    threads: { values: [{ id: privateText, name: privateText }] },
    sdkProcessingMetadata: { privateText }
  }
}

function logFixture(): Log {
  return {
    level: "info",
    message: "conversation.submitted",
    attributes: {
      schema_version: 1,
      event_id: id,
      operation_id: id,
      attempt: 1,
      occurred_at: "2026-09-19T00:00:00Z",
      environment: "production",
      release: "release-123",
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
      prompt: privateText,
      user_id: id,
      "sentry.user.email": "alice@example.com",
      "sentry.request.url": privateText
    }
  }
}

describe("allowlisted Sentry payloads", () => {
  it("keeps validated cross-vendor references in errors, spans and logs but never metric dimensions", () => {
    const privacy = createSentryPrivacy(policy)
    const correlation = {
      request_id: id,
      browser_request_id: id,
      run_id: id,
      sentry_trace_id: traceId,
      langfuse_trace_id: "c".repeat(32),
      parent_request_trace_id: "d".repeat(32)
    }
    const event = privacy.beforeSend({
      ...errorFixture(),
      contexts: { correlation: { ...correlation, sessionKey: privateText, raw_provider_id: privateText } }
    })
    expect(event?.contexts?.correlation).toEqual(correlation)
    const log = logFixture()
    const projected = privacy.beforeSendLog({ ...log, attributes: { ...log.attributes, ...correlation } })
    expect(projected?.attributes).toMatchObject(correlation)
    const span = projectSentrySpan(
      {
        trace_id: traceId,
        span_id: spanId,
        start_timestamp: 1,
        timestamp: 2,
        data: { ...correlation, sessionKey: privateText }
      },
      policy
    )
    expect(span?.data).toEqual(correlation)
    const metric = privacy.beforeSendMetric({
      name: "rostra.web_vital.cls",
      type: "distribution",
      value: 0.01,
      attributes: {
        environment: "production",
        runtime: "browser",
        content_mode: "live",
        route_template: "/",
        device: "desktop",
        navigation: "hard",
        ...correlation
      }
    })
    expect(metric).not.toBeNull()
    for (const key of Object.keys(correlation)) {
      expect(metric?.attributes).not.toHaveProperty(key)
    }
    expect(JSON.stringify([event, projected, span, metric])).not.toContain(privateText)
  })
  it("retains actual Turbopack chunk hashes without retaining arbitrary source paths", () => {
    expect(safeCodeLocation("D:\\private-user\\app\\.next\\server\\chunks\\_1udjw9f._.js")).toBe(
      "app:///.next/server/chunks/_1udjw9f._.js"
    )
    expect(safeCodeLocation("D:\\private-user\\app\\.next\\server\\chunks\\private-name.js")).toBeUndefined()
    expect(safeCodeLocation("http://user:secret@localhost/_next/static/chunks/293gsag4bq8qh.js?token=PRIVATE")).toBe(
      "/_next/static/chunks/293gsag4bq8qh.js"
    )
    expect(safeCodeLocation("http://localhost/_next/static/chunks/0-z3mje-s-poc.js")).toBe(
      "/_next/static/chunks/0-z3mje-s-poc.js"
    )
    expect(safeCodeLocation("http://localhost/_next/static/chunks/PRIVATE_RESEARCH.js")).toBeUndefined()
  })
  it("preserves only known diagnostic trace names", () => {
    const privacy = createSentryPrivacy()
    for (const [name, expected] of [
      ["legislative-research-conversation", "legislative-research-conversation"],
      ["research.tool", "research.tool"],
      ["execute_tool get_bill", "execute_tool get_bill"],
      ["execute_tool PRIVATE", "/_unmatched"]
    ] as const) {
      expect(
        privacy.beforeSendTransaction({ type: "transaction", transaction: name, start_timestamp: 1 })?.transaction
      ).toBe(expected)
    }
  })
  it("rejects malformed event roots instead of fabricating error events", () => {
    const onDiagnostic = spy()
    const privacy = createSentryPrivacy({ onDiagnostic })
    for (const value of [null, undefined, "invalid", 1, ["invalid"]]) {
      expect(Reflect.apply(privacy.beforeSend, undefined, [value])).toBeNull()
    }
    expect(onDiagnostic).toHaveBeenCalledTimes(5)
  })
  it("preserves error locations and operational context, not messages, causes or SDK-private data", () => {
    const input = errorFixture()
    const before = JSON.stringify(input)
    const privacy = createSentryPrivacy(policy)
    const output = privacy.beforeSend(input)
    expect(output).toMatchObject({
      event_id: traceId,
      environment: "production",
      release: "release-123",
      tags: { operation: "tool_call", tool: "get_bill", category: "result_limit", runId: id, model: "approved/model" },
      extra: {
        evidenceCount: 2,
        measurement: { toolName: "get_bill", durationMs: 1000, modelResultBytes: 70, failureCode: "result_limit" }
      },
      contexts: { trace: { trace_id: traceId, span_id: spanId } }
    })
    expect(output?.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: "/_next/static/chunks/a123beef.js",
      lineno: 12,
      colno: 3,
      in_app: true,
      debug_id: id
    })
    expect(output?.debug_meta?.images?.[0]).toEqual({
      type: "sourcemap",
      code_file: "/_next/static/chunks/a123beef.js",
      debug_id: id
    })
    expect(output?.exception?.values?.[1]?.type).toBe("Error")
    expect(output?.breadcrumbs).toHaveLength(1)
    expect(JSON.stringify(output)).not.toMatch(
      /PRIVATE_RESEARCH|alice@|synthetic-token|Private Street|password|private\.example/
    )
    expect(JSON.stringify(input)).toBe(before)
    expect(privacy.beforeSend(output ?? input)).toEqual(output)
  })

  it("keeps only the existing static citation fingerprint", () => {
    const privacy = createSentryPrivacy()
    expect(
      privacy.beforeSend({ type: undefined, fingerprint: ["citation_resolution", "unmatched_reference"] })?.fingerprint
    ).toEqual(["citation_resolution", "unmatched_reference"])
    const output = privacy.beforeSend({
      type: undefined,
      message: privateText,
      fingerprint: [privateText],
      tags: { model: "approved/model", provider: "approved" }
    })
    expect(output?.tags).toEqual({})
    expect(output?.message).toBe("Application error (message omitted)")
    expect(output?.fingerprint).toBeUndefined()
  })

  it("normalizes transactions and removes content from every child span", () => {
    const child: SpanJSON = {
      trace_id: traceId,
      span_id: spanId,
      start_timestamp: 10,
      timestamp: 11,
      description: privateText,
      op: "gen_ai.chat",
      data: {
        "gen_ai.request.model": "approved/model",
        "gen_ai.usage.input_tokens": 7,
        "gen_ai.input.messages": privateText,
        "db.statement": privateText
      },
      links: [{ trace_id: traceId, span_id: spanId, attributes: { secret: privateText } }]
    }
    const event: TransactionEvent = {
      type: "transaction",
      transaction: "POST /conversations/private-user-id?token=PRIVATE_RESEARCH",
      start_timestamp: 10,
      timestamp: 11,
      spans: [child],
      request: { data: privateText },
      measurements: { [privateText]: { value: 1, unit: "none" } }
    }
    const output = createSentryPrivacy(policy).beforeSendTransaction(event)
    expect(output?.transaction).toBe("/conversations/[conversationId]")
    expect(output?.spans?.[0]).toMatchObject({
      description: "gen_ai.chat",
      data: { "gen_ai.request.model": "approved/model", "gen_ai.usage.input_tokens": 7 }
    })
    expect(output?.spans?.[0]).not.toHaveProperty("links")
    expect(JSON.stringify(output)).not.toContain("PRIVATE_RESEARCH")
    expect(child.data["gen_ai.input.messages"]).toBe(privateText)
    expect(projectSentrySpan({ ...child, timestamp: 9 }, policy)).toBeNull()
  })

  it("retains registered semantic log fields and removes arbitrary SDK attributes", () => {
    const input = logFixture()
    const output = createSentryPrivacy(policy).beforeSendLog(input)
    expect(output?.attributes).toMatchObject({
      event_id: id,
      origin: "browser",
      release: "release-123",
      submit_method: "button"
    })
    expect(JSON.stringify(output)).not.toMatch(/PRIVATE_RESEARCH|alice@|user_id/)
    expect(output?.message).toBe(input.message)
    expect(input.attributes?.prompt).toBe(privateText)
  })

  it("drops free-text, malformed and unapproved model logs with bounded diagnostics", () => {
    const onDiagnostic = spy()
    const privacy = createSentryPrivacy({ onDiagnostic })
    expect(privacy.beforeSendLog({ level: "error", message: privateText })).toBeNull()
    expect(privacy.beforeSendLog({ level: "info", message: "page.viewed", attributes: {} })).toBeNull()
    for (let index = 0; index < 20; index++) {
      privacy.beforeSendLog({ level: "error", message: privateText })
    }
    expect(onDiagnostic).toHaveBeenCalledTimes(10)
    expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain("PRIVATE_RESEARCH")
  })

  it("projects registered metrics and rejects wrong type, unit, identity and model labels", () => {
    const onDiagnostic = spy()
    const privacy = createSentryPrivacy({ ...policy, onDiagnostic })
    const metric = {
      name: "rostra.ai.tokens",
      type: "counter" as const,
      value: 3,
      attributes: {
        environment: "production",
        runtime: "node",
        content_mode: "live",
        model: "approved/model",
        provider: "approved",
        kind: "input",
        "sentry.user.email": "alice@example.com",
        prompt: privateText
      }
    }
    const output = privacy.beforeSendMetric(metric)
    expect(output).toMatchObject({
      name: metric.name,
      value: 3,
      unit: "none",
      attributes: { model: "approved/model", kind: "input", release: "release-123" }
    })
    expect(JSON.stringify(output)).not.toMatch(/PRIVATE_RESEARCH|alice@/)
    expect(privacy.beforeSendMetric({ ...metric, type: "gauge" })).toBeNull()
    expect(privacy.beforeSendMetric({ ...metric, unit: "byte" })).toBeNull()
    expect(privacy.beforeSendMetric({ ...metric, attributes: { ...metric.attributes, model: privateText } })).toBeNull()
    expect(privacy.beforeSendMetric({ ...metric, name: privateText })).toBeNull()
    expect(onDiagnostic).toHaveBeenCalledTimes(4)
  })

  it("drops unknown breadcrumbs rather than retaining their text", () => {
    const onDiagnostic = spy()
    const privacy = createSentryPrivacy({ onDiagnostic })
    expect(privacy.beforeBreadcrumb({ message: privateText, data: { privateText } })).toBeNull()
    expect(
      privacy.beforeBreadcrumb({ message: "conversation.submitted", data: { operation: "research", privateText } })
    ).toMatchObject({
      message: "conversation.submitted",
      data: { operation: "research" }
    })
    expect(onDiagnostic).toHaveBeenCalledWith({ signal: "breadcrumb", reason: "invalid_payload", count: 1 })
  })
})
