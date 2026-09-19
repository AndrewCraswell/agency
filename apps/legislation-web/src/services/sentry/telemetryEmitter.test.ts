import { describe, expect, it, vi } from "vitest"
import { telemetryLimits, type TelemetryEventRecord, type TelemetryMetricRecord } from "./telemetryContracts"
import { createTelemetryEmitter } from "./telemetryEmitter"
import type { TelemetryEventInput } from "./telemetryEvents"

type EmitterOptions = Parameters<typeof createTelemetryEmitter>[0]

const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
const milestone = (operation = id(1), attempt = 1): TelemetryEventInput => ({
  event_name: "conversation.milestone",
  operation_id: operation,
  attempt,
  attributes: { milestone: "request_dispatched", elapsed_ms: 0 }
})

function fixture(overrides: Partial<EmitterOptions> = {}) {
  const events: TelemetryEventRecord[] = []
  const metrics: TelemetryMetricRecord[] = []
  const clock = vi.fn<() => Date>(() => new Date("2026-09-18T12:00:00Z"))
  const onDiagnostic = vi.fn<EmitterOptions["onDiagnostic"]>()
  const enqueueEvent = vi.fn<EmitterOptions["enqueueEvent"]>((event) => {
    events.push(event)
  })
  const enqueueMetric = vi.fn<EmitterOptions["enqueueMetric"]>((metric) => {
    metrics.push(metric)
  })
  let sequence = 0
  const emitter = createTelemetryEmitter({
    context: {
      environment: "test",
      release: "fixture",
      runtime: "browser",
      route_template: "/chat",
      surface: "conversation",
      content_mode: "live"
    },
    mode: "production",
    onDiagnostic,
    enqueueEvent,
    enqueueMetric,
    clock,
    isEnabled: () => true,
    randomId: () => id(++sequence + 100),
    ...overrides
  })
  return { emitter, events, metrics, clock, onDiagnostic, enqueueEvent, enqueueMetric }
}

describe("event emission", () => {
  it("does not collect unless a caller explicitly enables a category", () => {
    const test = fixture({ isEnabled: undefined })
    expect(test.emitter.emitEvent(milestone())).toEqual({ status: "disabled" })
    expect(test.emitter.emitMetric({ name: "rostra.chat.acknowledgement", value: 2, attributes: {} })).toEqual({
      status: "disabled"
    })
    expect(test.events).toEqual([])
    expect(test.metrics).toEqual([])
  })

  it("keeps usage permission separate from operational events and metrics", () => {
    const test = fixture({ isEnabled: (category) => category !== "usage" })
    expect(
      test.emitter.emitEvent({
        event_name: "page.viewed",
        operation_id: id(1),
        attempt: 1,
        attributes: { navigation: "hard", device: "desktop", entry: "direct" }
      })
    ).toEqual({ status: "disabled" })
    expect(
      test.emitter.emitMetric({
        name: "rostra.page.view",
        value: 1,
        attributes: { route_template: "/", navigation: "hard", device: "desktop" }
      })
    ).toEqual({ status: "disabled" })
    expect(test.emitter.emitEvent(milestone()).status).toBe("enqueued")
    expect(test.emitter.emitMetric({ name: "rostra.chat.acknowledgement", value: 2, attributes: {} }).status).toBe(
      "enqueued"
    )
  })

  it("deduplicates each milestone but preserves different stages and retries", () => {
    const test = fixture()
    const first = test.emitter.emitEvent(milestone())
    expect(first).toEqual({ status: "enqueued", event_id: id(101) })
    expect(test.emitter.emitEvent(milestone())).toEqual({ status: "duplicate", event_id: id(101) })
    expect(
      test.emitter.emitEvent({
        event_name: "conversation.milestone",
        operation_id: id(1),
        attempt: 1,
        attributes: { milestone: "first_content_rendered", elapsed_ms: 100 }
      }).status
    ).toBe("enqueued")
    expect(test.emitter.emitEvent(milestone(id(1), 2)).status).toBe("enqueued")
    expect(test.events).toHaveLength(3)
  })

  it("retains the caller's event ID and deduplicates an exact transport retry", () => {
    const test = fixture()
    const event = { ...milestone(), event_id: id(50) }
    expect(test.emitter.emitEvent(event)).toEqual({ status: "enqueued", event_id: id(50) })
    expect(test.emitter.emitEvent(event)).toEqual({ status: "duplicate", event_id: id(50) })
    expect(test.events[0]?.event_id).toBe(id(50))
  })

  it("does not replace a terminal rendered completion with a late failure", () => {
    const test = fixture()
    const event = {
      event_name: "conversation.rendered",
      operation_id: id(1),
      attempt: 1,
      attributes: {
        outcome: "completed",
        duration_ms: 20,
        citation_count: 1,
        unresolved_citations: 0,
        pending_blocks: 0,
        failed_blocks: 0
      }
    } as const satisfies TelemetryEventInput
    expect(test.emitter.emitEvent(event).status).toBe("enqueued")
    expect(test.emitter.emitEvent({ ...event, attributes: { ...event.attributes, outcome: "failed" } }).status).toBe(
      "duplicate"
    )
    expect(test.events[0]?.attributes.outcome).toBe("completed")
  })

  it("allows distinct user actions while deduplicating their stable event IDs", () => {
    const test = fixture()
    const event = {
      event_name: "conversation.activity_toggled",
      operation_id: id(1),
      attempt: 1,
      attributes: { tool_name: "get_bill", expanded: true, state: "succeeded" }
    } as const satisfies TelemetryEventInput
    test.emitter.emitEvent(event)
    test.emitter.emitEvent({ ...event, attributes: { ...event.attributes, expanded: false } })
    expect(test.events).toHaveLength(2)
  })

  it("keeps tool terminals separate within one turn", () => {
    const test = fixture({
      context: {
        environment: "test",
        release: "fixture",
        runtime: "node",
        route_template: "/chat",
        surface: "conversation",
        content_mode: "live"
      }
    })
    const event = {
      event_name: "research.tool_finished",
      operation_id: id(1),
      attempt: 1,
      attributes: { tool_name: "get_bill", tool_call_id: id(2), outcome: "success", duration_ms: 1 }
    } as const satisfies TelemetryEventInput
    test.emitter.emitEvent(event)
    test.emitter.emitEvent({ ...event, attributes: { ...event.attributes, tool_call_id: id(3) } })
    expect(test.emitter.emitEvent(event).status).toBe("duplicate")
    expect(test.events).toHaveLength(2)
  })

  it("bounds deduplication state without silently evicting known terminals", () => {
    const test = fixture()
    for (let index = 0; index < telemetryLimits.dedupeEntries; index++) {
      test.emitter.emitEvent(milestone(id(index)))
    }
    expect(test.emitter.emitEvent(milestone(id(9000)))).toEqual({ status: "dropped", reason: "dedupe_limit" })
    expect(test.emitter.emitEvent(milestone(id(0))).status).toBe("duplicate")
    expect(test.onDiagnostic).toHaveBeenCalledWith({ signal: "event", reason: "dedupe_limit", count: 1 })
    test.emitter.clearSession()
    expect(test.emitter.emitEvent(milestone(id(9000))).status).toBe("enqueued")
  })
})

describe("metric emission", () => {
  it("counts repeated measurements independently of event deduplication", () => {
    const test = fixture()
    const metric = { name: "rostra.chat.acknowledgement", value: 0, attributes: {} } as const
    test.emitter.emitMetric(metric)
    test.emitter.emitMetric(metric)
    expect(test.metrics).toHaveLength(2)
    expect(test.metrics[0]?.value).toBe(0)
  })

  it("enforces the exact local daily series ceiling without resetting it on sign-out", () => {
    const test = fixture()
    const metric = (index: number) =>
      ({
        name: "rostra.ai.cost",
        value: 0.01,
        attributes: { model: `model-${index}`, provider: "fixture", currency: "USD", source: "estimated" }
      }) as const
    for (let index = 0; index < telemetryLimits.seriesPerMetric; index++) {
      test.emitter.emitMetric(metric(index))
    }
    expect(test.metrics).toHaveLength(1000)
    expect(test.emitter.emitMetric(metric(999)).status).toBe("enqueued")
    expect(test.emitter.emitMetric(metric(1000))).toEqual({ status: "dropped", reason: "cardinality_limit" })
    test.emitter.clearSession()
    expect(test.emitter.emitMetric(metric(1000)).status).toBe("dropped")
    test.clock.mockReturnValue(new Date("2026-09-19T00:00:00Z"))
    expect(test.emitter.emitMetric(metric(1000)).status).toBe("enqueued")
  })

  it("supports a final SDK wire-record check instead of measuring only app attributes", () => {
    const test = fixture()
    expect(
      test.emitter.guardWireRecord("metric", {
        name: "rostra.chat.duration",
        value: 1,
        attributes: { "sentry.sdk.name": "x".repeat(2048) }
      })
    ).toBe(false)
    expect(test.emitter.diagnostics()).toContainEqual({ signal: "metric", reason: "payload_limit", count: 1 })
    expect(test.emitter.guardWireRecord("metric", { value: 1 })).toBe(true)
  })
})

describe("explicit, bounded failure reporting", () => {
  it("reports invalid runtime inputs without echoing their values", () => {
    const test = fixture()
    const invalid = { ...milestone(), attributes: { prompt: "synthetic-private-value" } }
    expect(Reflect.apply(test.emitter.emitEvent, undefined, [invalid])).toEqual({
      status: "dropped",
      reason: "invalid_schema"
    })
    expect(test.onDiagnostic).toHaveBeenCalledWith({ signal: "event", reason: "invalid_schema", count: 1 })
    expect(JSON.stringify(test.emitter.diagnostics())).not.toContain("synthetic-private-value")
    expect(test.events).toHaveLength(0)
  })

  it("fails loudly in strict mode without raw validation data", () => {
    const test = fixture({ mode: "strict" })
    expect(() =>
      Reflect.apply(test.emitter.emitMetric, undefined, [
        {
          name: "rostra.chat.duration",
          value: 1,
          attributes: { privateText: "synthetic-private-value" }
        }
      ])
    ).toThrow("invalid_schema")
    expect(test.onDiagnostic).toHaveBeenCalledTimes(1)
  })

  it("reports synchronous and asynchronous sink failures without waiting for ingestion", async () => {
    const sync = fixture({
      enqueueEvent: () => {
        throw new Error("synthetic-private-value")
      }
    })
    expect(sync.emitter.emitEvent(milestone())).toEqual({ status: "dropped", reason: "sink_failure" })
    expect(sync.onDiagnostic).toHaveBeenCalledWith({ signal: "event", reason: "sink_failure", count: 1 })
    const asynchronous = fixture({
      enqueueEvent: async () => {
        throw new Error("synthetic-private-value")
      }
    })
    expect(asynchronous.emitter.emitEvent(milestone()).status).toBe("enqueued")
    await Promise.resolve()
    expect(asynchronous.onDiagnostic).toHaveBeenCalledWith({ signal: "event", reason: "sink_failure", count: 1 })
  })

  it("does not reserve a duplicate marker when the local sink rejects synchronously", () => {
    const enqueueEvent = vi
      .fn<EmitterOptions["enqueueEvent"]>()
      .mockImplementationOnce(() => {
        throw new Error("fixture")
      })
      .mockReturnValue(undefined)
    const test = fixture({ enqueueEvent })
    expect(test.emitter.emitEvent({ ...milestone(), event_id: id(99) }).status).toBe("dropped")
    expect(test.emitter.emitEvent({ ...milestone(), event_id: id(99) }).status).toBe("enqueued")
  })

  it("bounds diagnostic notifications while retaining aggregate drop counts", () => {
    const test = fixture()
    for (let index = 0; index < 30; index++) {
      Reflect.apply(test.emitter.emitEvent, undefined, [{ event_name: "invalid" }])
    }
    expect(test.onDiagnostic).toHaveBeenCalledTimes(telemetryLimits.diagnosticNotifications)
    expect(test.emitter.diagnostics()).toContainEqual({ signal: "event", reason: "invalid_schema", count: 30 })
  })

  it("blocks diagnostic and sink reentrancy without a recursive reporting loop", () => {
    let onDiagnostic = () => undefined
    const test = fixture({ onDiagnostic: () => onDiagnostic() })
    onDiagnostic = () => {
      test.emitter.emitEvent(milestone())
      return undefined
    }
    Reflect.apply(test.emitter.emitEvent, undefined, [{}])
    expect(test.emitter.diagnostics()).toContainEqual({ signal: "event", reason: "reentrant", count: 1 })
    expect(test.events).toHaveLength(0)
    let reenter = () => undefined
    const recursive = fixture({ enqueueEvent: () => reenter() })
    reenter = () => {
      recursive.emitter.emitEvent(milestone())
      return undefined
    }
    expect(recursive.emitter.emitEvent(milestone()).status).toBe("enqueued")
    expect(recursive.emitter.diagnostics()).toContainEqual({ signal: "event", reason: "reentrant", count: 1 })
  })

  it("has a bounded local fallback when the diagnostic callback itself fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    try {
      const test = fixture({
        onDiagnostic: () => {
          throw new Error("synthetic-private-value")
        }
      })
      Reflect.apply(test.emitter.emitEvent, undefined, [{}])
      expect(warn).toHaveBeenCalledWith("Telemetry diagnostic callback failed", {
        signal: "event",
        reason: "invalid_schema"
      })
    } finally {
      warn.mockRestore()
    }
  })

  it("reports invalid construction and clock/ID failures explicitly", () => {
    const onDiagnostic = vi.fn<EmitterOptions["onDiagnostic"]>()
    expect(() =>
      fixture({
        onDiagnostic,
        context: {
          environment: "test",
          release: "fixture",
          runtime: "browser",
          route_template: "/",
          surface: "conversation",
          content_mode: "live"
        }
      })
    ).toThrow("context_failure")
    expect(onDiagnostic).toHaveBeenCalledWith({ signal: "event", reason: "context_failure", count: 1 })
    const test = fixture({ clock: () => new Date(Number.NaN) })
    expect(test.emitter.emitEvent(milestone())).toEqual({ status: "dropped", reason: "context_failure" })
  })
})
