import type { winterCGFetchIntegration } from "@sentry/nextjs"
import { describe, expect, it, vi } from "vitest"
import { assertEdgeTelemetryRuntime, createEdgeSentryOptions } from "./edgeSentryOptions"

function fixture(environment: Record<string, string | undefined>) {
  const createFetch = vi.fn<typeof winterCGFetchIntegration>(() => ({ name: "WinterCGFetch" }))
  const options = createEdgeSentryOptions(environment, createFetch)
  return { options, fetchOptions: createFetch.mock.calls[0]?.[0] }
}

describe("edge-owned telemetry configuration", () => {
  it("fails explicitly rather than using an unsafe synchronous context fallback", () => {
    try {
      vi.stubGlobal("AsyncLocalStorage", undefined)
      expect(() => assertEdgeTelemetryRuntime()).toThrow("platform AsyncLocalStorage")
      vi.stubGlobal("AsyncLocalStorage", class {})
      expect(() => assertEdgeTelemetryRuntime()).not.toThrow()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it("uses the supported edge provider and preserves explicit privacy and collection defaults", () => {
    const { options, fetchOptions } = fixture({
      NEXT_PUBLIC_SENTRY_DSN: " https://synthetic@o0.ingest.sentry.io/1 ",
      NODE_ENV: "production"
    })
    expect(options).toMatchObject({
      dsn: "https://synthetic@o0.ingest.sentry.io/1",
      enabled: true,
      skipOpenTelemetrySetup: false,
      defaultIntegrations: [],
      enableLogs: false,
      enableMetrics: false,
      tracesSampleRate: 0,
      streamGenAiSpans: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      tracePropagationTargets: []
    })
    expect(fetchOptions?.breadcrumbs).toBe(false)
    expect(
      options.tracesSampler?.({ name: "/api/bills", attributes: {}, parentSampled: true, inheritOrSampleWith: () => 1 })
    ).toBe(0)
    expect(fetchOptions?.shouldCreateSpanForRequest?.("https://unknown.example")).toBe(false)
    expect(Array.isArray(options.integrations)).toBe(true)
  })

  it("does not implicitly enable tracing or export when the DSN is absent", () => {
    expect(fixture({ NEXT_PUBLIC_SENTRY_DSN: "   " }).options.enabled).toBe(false)
    expect(fixture({}).options.enabled).toBe(false)
  })

  it("matches only the exact trusted origin, never a substring or credential-bearing URL", () => {
    const { options, fetchOptions } = fixture({
      NODE_ENV: "production",
      LEGISLATION_PUBLIC_API_BASE_URL: "https://api.example.test/api"
    })
    const target = options.tracePropagationTargets?.[0]
    expect(target).toBeInstanceOf(RegExp)
    for (const url of [
      "https://api.example.test.evil.test/private",
      "https://evil.test/?redirect=https://api.example.test/api",
      "https://apiXexampleXtest/api",
      "https://user:secret@api.example.test/api",
      "http://api.example.test/api"
    ]) {
      expect(fetchOptions?.shouldCreateSpanForRequest?.(url)).toBe(false)
      expect(target instanceof RegExp && target.test(url)).toBe(false)
    }
    expect(fetchOptions?.shouldCreateSpanForRequest?.("https://api.example.test/api/bills")).toBe(true)
    expect(target instanceof RegExp && target.test("https://api.example.test/api/bills")).toBe(true)
  })

  it.each([
    "not a URL",
    "http://api.example.test",
    "ftp://api.example.test",
    "https://user:secret@api.example.test",
    "https://api.example.test/?secret=private",
    "https://api.example.test/#private"
  ])("rejects invalid propagation configuration without echoing it", (url) => {
    expect(() => fixture({ NODE_ENV: "production", LEGISLATION_PUBLIC_API_BASE_URL: url })).toThrow("Edge telemetry")
  })

  it("permits explicit loopback HTTP only outside production", () => {
    expect(
      fixture({
        NODE_ENV: "test",
        LEGISLATION_PUBLIC_API_BASE_URL: "http://127.0.0.1:3000"
      }).fetchOptions?.shouldCreateSpanForRequest?.("http://127.0.0.1:3000/chat")
    ).toBe(true)
    expect(() => fixture({ NODE_ENV: "production", LEGISLATION_PUBLIC_API_BASE_URL: "http://127.0.0.1:3000" })).toThrow(
      "HTTPS"
    )
  })
})
