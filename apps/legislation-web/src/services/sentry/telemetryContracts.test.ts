import { describe, expect, it } from "vitest"
import {
  checkTelemetryWireSize,
  parseTelemetryContext,
  prepareTelemetryEvent,
  prepareTelemetryMetric,
  telemetryLimits
} from "./telemetryContracts"
import { telemetryEvents, type TelemetryEventInput } from "./telemetryEvents"
import { telemetryMetrics } from "./telemetryMetrics"

const id = "d2bbbc76-7cf3-42f0-b566-644db71c86af"
const clock = () => new Date("2026-09-18T12:00:00.000Z")
const context = parseTelemetryContext({
  environment: "test",
  release: "fixture",
  runtime: "browser",
  route_template: "/conversations/[conversationId]",
  surface: "conversation",
  content_mode: "live"
})
const submitted = {
  event_name: "conversation.submitted",
  operation_id: id,
  attempt: 1,
  attributes: {
    draft_id: id,
    draft_origin: "typed",
    size_bucket: "1-80",
    reference_count: 0,
    turn_kind: "new",
    submit_method: "keyboard"
  }
} as const satisfies TelemetryEventInput

describe("telemetry event contracts", () => {
  it("creates a complete immutable event without an SDK or network", () => {
    const event = prepareTelemetryEvent(submitted, context, clock, () => id)
    expect(event).toMatchObject({
      ...submitted,
      schema_version: 1,
      origin: "browser",
      phase: "intent",
      event_id: id,
      occurred_at: "2026-09-18T12:00:00.000Z",
      ...context
    })
    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(event.attributes)).toBe(true)
    expect(submitted).not.toHaveProperty("event_id")
  })

  it.each([
    { ...submitted, event_name: "__proto__" },
    { ...submitted, event_name: "not.registered" },
    { ...submitted, extra: "private content" },
    { ...submitted, operation_id: "access-token" },
    { ...submitted, event_id: "invalid" },
    { ...submitted, attempt: 0 },
    { ...submitted, attempt: Number.NaN },
    { ...submitted, attributes: { ...submitted.attributes, prompt: "private content" } },
    { ...submitted, attributes: { ...submitted.attributes, reference_count: 13 } },
    { ...submitted, attributes: { ...submitted.attributes, draft_origin: "private content" } }
  ])("rejects malformed or unapproved fields", (input) => {
    expect(() => prepareTelemetryEvent(input, context, clock, () => id)).toThrow("invalid_schema")
  })

  it("enforces attribute count separately from field validation", () => {
    const input = {
      ...submitted,
      attributes: Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`field_${index}`, index]))
    }
    expect(() => prepareTelemetryEvent(input, context, clock, () => id)).toThrow("attribute_limit")
  })

  it("does not allow a browser to claim a server-owned execution outcome", () => {
    expect(() =>
      prepareTelemetryEvent(
        {
          event_name: "conversation.accepted",
          operation_id: id,
          attempt: 1,
          attributes: { model: "provider/model", provider: "provider" }
        },
        context,
        clock,
        () => id
      )
    ).toThrow("invalid_schema")
  })

  it("preserves distinct conversation terminal outcomes and omits missing measurements", () => {
    const server = { ...context, runtime: "node" } as const
    for (const outcome of ["completed", "clarification", "partial", "cancelled", "exhausted", "failed", "unknown"]) {
      const event = prepareTelemetryEvent(
        {
          event_name: "conversation.finished",
          operation_id: id,
          attempt: 1,
          attributes: { outcome, finish_reason: "unknown", duration_ms: 10, tool_count: 0 }
        },
        server,
        clock,
        () => id
      )
      expect(event.attributes.outcome).toBe(outcome)
      expect(event.attributes).not.toHaveProperty("first_content_ms")
      expect(event.origin).toBe("server")
    }
  })

  it("never turns failed or unknown search counts into successful zero results", () => {
    const base = { event_name: "search.results_rendered", operation_id: id, attempt: 1 }
    expect(() =>
      prepareTelemetryEvent(
        {
          ...base,
          attributes: { search_kind: "mention", outcome: "failed", result_count: 0 }
        },
        context,
        clock,
        () => id
      )
    ).toThrow("invalid_schema")
    expect(() =>
      prepareTelemetryEvent(
        {
          ...base,
          attributes: { search_kind: "mention", outcome: "succeeded" }
        },
        context,
        clock,
        () => id
      )
    ).toThrow("invalid_schema")
    const empty = prepareTelemetryEvent(
      {
        ...base,
        attributes: { search_kind: "mention", outcome: "succeeded", result_count: 0 }
      },
      context,
      clock,
      () => id
    )
    expect(empty.attributes.result_count).toBe(0)
  })

  it("requires a tool failure code exactly when the wrapper failed", () => {
    const base = {
      event_name: "research.tool_finished",
      operation_id: id,
      attempt: 1,
      attributes: { tool_call_id: id, tool_name: "get_bill", outcome: "error", duration_ms: 0 }
    }
    const server = { ...context, runtime: "node" } as const
    expect(() => prepareTelemetryEvent(base, server, clock, () => id)).toThrow("invalid_schema")
    const event = prepareTelemetryEvent(
      {
        ...base,
        attributes: { ...base.attributes, failure_code: "result_limit" }
      },
      server,
      clock,
      () => id
    )
    expect(event.attributes.failure_code).toBe("result_limit")
    expect(event.attributes).not.toHaveProperty("dependency_duration_ms")
  })

  it("rejects invalid metadata rather than truncating IDs or accepting route/surface mismatch", () => {
    expect(() => parseTelemetryContext({ ...context, release: "a".repeat(129) })).toThrow("context_failure")
    expect(() => parseTelemetryContext({ ...context, route_template: "/private/raw-id" })).toThrow("context_failure")
    expect(() => parseTelemetryContext({ ...context, surface: "home" })).toThrow("context_failure")
    expect(() => prepareTelemetryEvent(submitted, context, clock, () => "bad-id")).toThrow("context_failure")
  })

  it("uses only finite registered event schemas", () => {
    expect(Object.keys(telemetryEvents).length).toBeGreaterThan(50)
    for (const definition of Object.values(telemetryEvents)) {
      expect(definition.attributes.safeParse({ privateText: "private content" }).success).toBe(false)
    }
  })
})

describe("telemetry metric contracts", () => {
  it("sets units, type and context from the registry rather than caller-supplied fields", () => {
    const metric = prepareTelemetryMetric(
      {
        name: "rostra.chat.duration",
        value: 123.5,
        attributes: { origin: "browser", outcome: "completed" }
      },
      context
    )
    expect(metric).toEqual({
      name: "rostra.chat.duration",
      type: "distribution",
      unit: "millisecond",
      value: 123.5,
      attributes: {
        origin: "browser",
        outcome: "completed",
        environment: "test",
        release: "fixture",
        runtime: "browser",
        content_mode: "live"
      }
    })
    expect(Object.isFrozen(metric.attributes)).toBe(true)
  })

  it.each([
    { name: "toString", value: 1, attributes: {} },
    { name: "rostra.chat.acknowledgement", value: Number.NaN, attributes: {} },
    { name: "rostra.chat.acknowledgement", value: Infinity, attributes: {} },
    { name: "rostra.chat.acknowledgement", value: -1, attributes: {} },
    { name: "rostra.chat.acknowledgement", value: null, attributes: {} },
    { name: "rostra.chat.acknowledgement", value: 1, attributes: { user_id: id } },
    { name: "rostra.chat.acknowledgement", value: 1, attributes: {}, unit: "second" },
    { name: "rostra.chat.outcome", value: 1.5, attributes: { origin: "browser", outcome: "completed" } },
    { name: "rostra.chat.outcome", value: 1, attributes: { origin: "server", outcome: "completed" } }
  ])("rejects unsafe metric values and dimensions", (input) => {
    expect(() => prepareTelemetryMetric(input, context)).toThrow("invalid_schema")
  })

  it("has a bounded attribute schema for every metric", () => {
    expect(Object.keys(telemetryMetrics).length).toBeGreaterThan(40)
    for (const definition of Object.values(telemetryMetrics)) {
      expect(definition.attributes.safeParse({ operation_id: id }).success).toBe(false)
    }
  })

  it.each([
    { name: "rostra.pool.waiting", value: 1.5, attributes: { pool: "application" } },
    { name: "rostra.search.results", value: 0.5, attributes: { search_kind: "discovery" } },
    { name: "rostra.tool.pending_at_close", value: 0.5, attributes: {} },
    { name: "rostra.tool.concurrent_peak", value: Number.MAX_SAFE_INTEGER + 1, attributes: {} },
    { name: "rostra.tool.calls_per_turn", value: 0.5, attributes: { kind: "executed" } },
    { name: "rostra.tool.results", value: 0.5, attributes: { tool_name: "get_bill", state: "available" } },
    { name: "rostra.result.bytes", value: 0.5, attributes: { boundary: "model", operation: "read" } },
    { name: "rostra.tool.outcome", value: 1, attributes: { tool_name: "get_bill", outcome: "error" } }
  ])("preserves integral counts and truthful tool outcomes", (input) => {
    expect(() => prepareTelemetryMetric(input, context)).toThrow("invalid_schema")
  })
})

describe("final wire budgets", () => {
  it("checks exact encoded bytes, including the final SDK metadata", () => {
    const base = {
      name: "rostra.chat.duration",
      value: 1,
      type: "distribution",
      trace_id: "a".repeat(32),
      timestamp: 1,
      attributes: { sdk: { type: "string", value: "" } }
    }
    const overhead = new TextEncoder().encode(JSON.stringify(base)).byteLength
    const at = (bytes: number) => ({
      ...base,
      attributes: { sdk: { type: "string", value: "x".repeat(bytes - overhead) } }
    })
    expect(() => checkTelemetryWireSize("metric", at(2047))).not.toThrow()
    expect(() => checkTelemetryWireSize("metric", at(2048))).toThrow("payload_limit")
    expect(() => checkTelemetryWireSize("event", at(4096))).not.toThrow()
    expect(() => checkTelemetryWireSize("event", at(4097))).toThrow("payload_limit")
    expect(() => checkTelemetryWireSize("metric", { text: "é".repeat(telemetryLimits.metricBytes / 2) })).toThrow(
      "payload_limit"
    )
  })

  it("rejects unserializable records without reporting their contents", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => checkTelemetryWireSize("metric", circular)).toThrow("invalid_schema")
    expect(() => checkTelemetryWireSize("event", { value: BigInt(1) })).toThrow("invalid_schema")
    expect(() => checkTelemetryWireSize("event", undefined)).toThrow("invalid_schema")
  })
})
