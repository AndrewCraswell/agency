import { describe, expect, it, vi } from "vitest"
import { createBrowserWebVitals } from "./browserWebVitals"
import type { TelemetryMetricRecord } from "./telemetryContracts"
import type { TelemetryContext } from "./telemetryFields"

const context: TelemetryContext = {
  environment: "test",
  release: "fixture",
  runtime: "browser",
  route_template: "/",
  surface: "home",
  content_mode: "live"
}
const measurement = (name = "LCP", value = 10, id = "vital-a") => ({
  name,
  value,
  id,
  navigationType: "navigate",
  entries: [{ text: "PRIVATE" }]
})

function fixture() {
  const callbacks: Array<() => void> = []
  const records: TelemetryMetricRecord[] = []
  const isEnabled = vi.fn<() => boolean>(() => true)
  const enqueue = vi.fn<(record: TelemetryMetricRecord) => void>((record) => {
    records.push(record)
  })
  const onDiagnostic = vi.fn<Parameters<typeof createBrowserWebVitals>[0]["onDiagnostic"]>()
  const reporter = createBrowserWebVitals({
    isEnabled,
    enqueue,
    onDiagnostic,
    schedule: (callback) => {
      callbacks.push(callback)
    }
  })
  reporter.startPage(context, "desktop")
  return {
    reporter,
    records,
    enqueue,
    isEnabled,
    onDiagnostic,
    flush: () => {
      callbacks.splice(0).forEach((callback) => callback())
    }
  }
}

describe("native Web Vital reporting", () => {
  it("coalesces callbacks and finalizes each metric once per native page lifecycle", () => {
    const test = fixture()
    test.reporter.receive(measurement("LCP", 12))
    test.reporter.receive(measurement("LCP", 15))
    test.reporter.receive(measurement("LCP", 15, "strict-mode-observer"))
    test.flush()
    test.reporter.receive(measurement("LCP", 20, "remounted-observer"))
    test.flush()
    expect(test.records).toHaveLength(1)
    expect(test.records[0]).toMatchObject({
      name: "rostra.web_vital.lcp",
      value: 15,
      unit: "millisecond",
      attributes: { navigation: "hard", route_template: "/", device: "desktop" }
    })
    expect(JSON.stringify(test.records)).not.toMatch(/PRIVATE|vital-a|observer/)
  })

  it("reports supported metrics with correct units without manufacturing unsupported zeros", () => {
    const test = fixture()
    test.reporter.receive(measurement("CLS", 0))
    test.reporter.receive(measurement("INP", 20))
    test.reporter.receive(measurement("TTFB", 1))
    test.flush()
    expect(test.records.map((record) => [record.name, record.unit, record.value])).toEqual([
      ["rostra.web_vital.cls", "none", 0],
      ["rostra.web_vital.inp", "millisecond", 20]
    ])
    expect(test.records.some((record) => record.name === "rostra.web_vital.lcp")).toBe(false)
    expect(test.onDiagnostic).not.toHaveBeenCalled()
  })

  it("does not keep or send measurements while disabled or after withdrawal before the flush", () => {
    const test = fixture()
    test.isEnabled.mockReturnValue(false)
    test.reporter.receive(measurement())
    test.flush()
    expect(test.records).toEqual([])
    test.isEnabled.mockReturnValue(true)
    test.reporter.receive(measurement())
    test.isEnabled.mockReturnValue(false)
    test.flush()
    expect(test.records).toEqual([])
    test.isEnabled.mockReturnValue(true)
    test.flush()
    expect(test.records).toEqual([])
  })

  it("resets only on a native BFCache lifecycle and rejects late callbacks from the previous page", () => {
    const test = fixture()
    test.reporter.receive(measurement())
    test.reporter.startPage(
      { ...context, route_template: "/conversations/[conversationId]", surface: "conversation" },
      "mobile",
      true
    )
    test.flush()
    expect(test.records).toEqual([])
    test.reporter.receive(measurement())
    test.reporter.receive({ ...measurement("LCP", 3, "restored"), navigationType: "back-forward-cache" })
    test.flush()
    expect(test.records).toHaveLength(1)
    expect(test.records[0]).toMatchObject({
      value: 3,
      attributes: { navigation: "back_forward", route_template: "/conversations/[conversationId]", device: "mobile" }
    })
    expect(test.onDiagnostic).toHaveBeenCalledWith("invalid_vital")
  })

  it("clears queued measurements when the lifecycle is discarded", () => {
    const test = fixture()
    test.reporter.receive(measurement())
    test.reporter.discard()
    test.flush()
    test.reporter.receive(measurement())
    test.flush()
    expect(test.records).toEqual([])
  })

  it.each([Number.NaN, Infinity, -1, "PRIVATE"])("rejects invalid values without exporting raw details", (value) => {
    const test = fixture()
    test.reporter.receive({ ...measurement(), value })
    test.flush()
    expect(test.records).toEqual([])
    expect(test.onDiagnostic).toHaveBeenCalledWith("invalid_vital")
  })

  it("reports sink failures and permits a subsequent valid attempt", () => {
    const test = fixture()
    test.enqueue.mockImplementationOnce(() => {
      throw new Error("PRIVATE")
    })
    test.reporter.receive(measurement())
    test.flush()
    test.reporter.receive(measurement())
    test.flush()
    expect(test.records).toHaveLength(1)
    expect(test.onDiagnostic).toHaveBeenCalledWith("send_failure")
  })

  it("bounds diagnostics during repeated invalid observer callbacks", () => {
    const test = fixture()
    for (let index = 0; index < 30; index++) {
      test.reporter.receive({ ...measurement(), id: "" })
    }
    expect(test.onDiagnostic).toHaveBeenCalledTimes(10)
    expect(test.records).toEqual([])
  })
})
