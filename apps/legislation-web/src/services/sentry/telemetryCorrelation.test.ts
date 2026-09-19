import { describe, expect, it, vi } from "vitest"
import {
  createOpaqueTelemetryIds,
  readTelemetryHeaders,
  sanitizeTelemetryHeaders,
  type CorrelationDiagnostic
} from "./telemetryCorrelation"

const trace = "a".repeat(32)
const span = "b".repeat(16)
const uuid = "00000000-0000-4000-8000-000000000001"
const diagnostic = () => vi.fn<(reason: CorrelationDiagnostic) => void>()

describe("bounded trace headers", () => {
  it("continues valid identity without accepting an external sampling decision or baggage", () => {
    const report = diagnostic()
    const input = new Headers({
      "sentry-trace": `${trace}-${span}-1`,
      traceparent: `00-${trace}-${span}-01`,
      baggage: "private=PRIVATE",
      tracestate: "vendor=PRIVATE",
      "x-rostra-request-id": uuid,
      authorization: "untouched application credential"
    })
    const safe = sanitizeTelemetryHeaders(input, report)
    expect(safe.sentryTrace).toBe(`${trace}-${span}-0`)
    expect(safe.traceparent).toBe(`00-${trace}-${span}-00`)
    expect(safe.browserRequestId).toBe(uuid)
    expect(safe.headers.get("baggage")).toBeNull()
    expect(safe.headers.get("tracestate")).toBeNull()
    expect(safe.headers.get("authorization")).toBe("untouched application credential")
    expect(input.get("baggage")).toBe("private=PRIVATE")
    expect(report).toHaveBeenCalledWith("baggage_removed")
    expect(JSON.stringify(report.mock.calls)).not.toContain("PRIVATE")
  })

  it("converts W3C context and preserves only a locally chosen outbound sampling flag", () => {
    const input = new Headers({ traceparent: `00-${trace}-${span}-01` })
    const report = diagnostic()
    expect(readTelemetryHeaders((name) => input.get(name), report).sentryTrace).toBe(`${trace}-${span}-0`)
    expect(readTelemetryHeaders((name) => input.get(name), report, true).sentryTrace).toBe(`${trace}-${span}-1`)
  })

  it.each([
    { "sentry-trace": `${"0".repeat(32)}-${span}-1` },
    { "sentry-trace": `${trace}-${"0".repeat(16)}-1` },
    { "sentry-trace": "PRIVATE".repeat(1000) },
    { "sentry-trace": [`${trace}-${span}-1`, `${trace}-${span}-0`] },
    { traceparent: `01-${trace}-${span}-01` },
    { traceparent: `00-${trace}-${span}-ff` },
    { traceparent: `00-${trace}-${span}-01-extra` },
    { "sentry-trace": `${trace}-${span}-1`, traceparent: `00-${"c".repeat(32)}-${span}-01` },
    { "sentry-trace": `${trace}-${span}-1`, traceparent: `00-${trace}-${span}-00` }
  ])("rejects malformed, duplicate, zero or conflicting trace context", (headers) => {
    const source: Record<string, unknown> = headers
    const report = diagnostic()
    const safe = readTelemetryHeaders((name) => source[name], report)
    expect(safe.sentryTrace).toBeUndefined()
    expect(safe.traceparent).toBeUndefined()
    expect(report).toHaveBeenCalled()
    expect(JSON.stringify(report.mock.calls)).not.toContain("PRIVATE")
  })

  it("does not treat invalid correlation IDs as identities", () => {
    const report = diagnostic()
    expect(readTelemetryHeaders(() => undefined, report).browserRequestId).toBeUndefined()
    expect(report).not.toHaveBeenCalled()
    const input = new Headers({ "x-rostra-request-id": "PRIVATE@example.test" })
    expect(sanitizeTelemetryHeaders(input, report).headers.get("x-rostra-request-id")).toBeNull()
    expect(report).toHaveBeenCalledWith("invalid_request_id")
  })
})

describe("opaque provider identifiers", () => {
  it("retains valid UUIDs and gives repeated provider identifiers a stable opaque mapping", () => {
    const report = diagnostic()
    const random = vi.fn<() => string>(() => uuid)
    const ids = createOpaqueTelemetryIds(report, random)
    expect(ids.get(uuid)).toBe(uuid)
    expect(random).not.toHaveBeenCalled()
    expect(ids.get("provider-" + "PRIVATE".repeat(50))).toBe(uuid)
    expect(ids.get("provider-" + "PRIVATE".repeat(50))).toBe(uuid)
    expect(random).toHaveBeenCalledTimes(1)
    ids.clear()
    ids.get("provider-" + "PRIVATE".repeat(50))
    expect(random).toHaveBeenCalledTimes(2)
  })

  it("bounds retained identifiers and reports failure instead of truncating", () => {
    const report = diagnostic()
    const ids = createOpaqueTelemetryIds(report)
    for (let index = 0; index < 512; index++) {
      expect(ids.get(`provider-${index}`)).toMatch(/^[a-f0-9-]{36}$/u)
    }
    expect(ids.get("overflow")).toBeUndefined()
    expect(ids.get("x".repeat(4097))).toBeUndefined()
    expect(report.mock.calls).toEqual([["id_limit"], ["invalid_provider_id"]])
    expect(createOpaqueTelemetryIds(report, () => "invalid").get("provider")).toBeUndefined()
  })
})
