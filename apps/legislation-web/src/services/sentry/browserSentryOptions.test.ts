import type { browserTracingIntegration } from "@sentry/nextjs"
import { describe, expect, it, vi } from "vitest"
import { createBrowserSentryOptions } from "./browserSentryOptions"

function fixture(dsn = "https://synthetic@o0.ingest.sentry.io/1") {
  const tracing = vi.fn<typeof browserTracingIntegration>(() => ({ name: "BrowserTracing" }))
  const options = createBrowserSentryOptions(
    { NODE_ENV: "test", NEXT_PUBLIC_SENTRY_DSN: dsn },
    "http://127.0.0.1:3017",
    tracing
  )
  const integrations =
    typeof options.integrations === "function"
      ? options.integrations([
          { name: "GlobalHandlers" },
          { name: "BrowserApiErrors" },
          { name: "Dedupe" },
          { name: "LinkedErrors" },
          { name: "Breadcrumbs" },
          { name: "Console" },
          { name: "Replay" },
          { name: "BrowserSession" }
        ])
      : []
  return { options, integrations, tracingOptions: tracing.mock.calls[0]?.[0] }
}

describe("browser SDK configuration", () => {
  it("enables diagnostic traces with audited integrations while logs, metrics and replay stay off", () => {
    const test = fixture()
    expect(test.integrations.map((integration) => integration.name)).toEqual([
      "GlobalHandlers",
      "BrowserApiErrors",
      "Dedupe",
      "LinkedErrors",
      "BrowserTracing",
      "RostraPrivacy"
    ])
    expect(test.options).toMatchObject({
      enabled: true,
      enableLogs: false,
      enableMetrics: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      maxBreadcrumbs: 20,
      transportOptions: { bufferSize: 32 }
    })
    expect(
      test.options.tracesSampler?.({ name: "/", attributes: {}, parentSampled: false, inheritOrSampleWith: () => 0 })
    ).toBe(1)
    expect(test.tracingOptions).toMatchObject({
      instrumentPageLoad: true,
      instrumentNavigation: true,
      enableInp: false,
      enableLongTask: false,
      traceXHR: false,
      linkPreviousTrace: "off"
    })
  })

  it("normalizes route names before navigation spans start without carrying arbitrary attributes", () => {
    const beforeStart = fixture().tracingOptions?.beforeStartSpan
    expect(
      beforeStart?.({
        name: "/conversations/private-conversation?query=PRIVATE",
        op: "pageload",
        attributes: { url: "PRIVATE", "sentry.source": "url" }
      })
    ).toMatchObject({
      name: "/conversations/[conversationId]",
      attributes: { "sentry.source": "route", "rostra.navigation.kind": "hard" }
    })
    const soft = beforeStart?.({ name: "/records/person/private", op: "navigation" })
    expect(soft?.attributes?.["rostra.navigation.kind"]).toBe("soft")
    const traversal = beforeStart?.({
      name: "/",
      op: "navigation",
      attributes: { "navigation.type": "browser.popstate" }
    })
    expect(traversal?.attributes?.["rostra.navigation.kind"]).toBe("back_forward")
    expect(JSON.stringify(soft)).not.toContain("private")
  })

  it("limits fetch spans and trace headers to same-origin absolute and relative URLs", () => {
    const test = fixture()
    const permits = (url: string) =>
      test.options.tracePropagationTargets?.some((target) => target instanceof RegExp && target.test(url))
    for (const url of ["/chat", "http://127.0.0.1:3017/api/bills"]) {
      expect(permits(url)).toBe(true)
      expect(test.tracingOptions?.shouldCreateSpanForRequest?.(url)).toBe(true)
    }
    for (const url of [
      "//evil.test",
      "/\\evil.test",
      "http://127.0.0.1:30170/api",
      "https://evil.test/?url=http://127.0.0.1:3017/"
    ]) {
      expect(permits(url)).toBe(false)
      expect(test.tracingOptions?.shouldCreateSpanForRequest?.(url)).toBe(false)
    }
  })

  it("does not initialize collection without a DSN or create undocumented span categories", () => {
    const test = fixture(" ")
    expect(test.options.enabled).toBe(false)
    expect(test.options.tracePropagationTargets).toEqual([])
    expect(test.tracingOptions?.shouldCreateSpanForRequest?.("/chat")).toBe(false)
    expect(
      test.tracingOptions?.ignorePerformanceApiSpans?.some(
        (pattern) => pattern instanceof RegExp && pattern.test("PRIVATE")
      )
    ).toBe(true)
  })

  it("supports a production-built loopback preview without permitting external HTTP origins", () => {
    const tracing = vi.fn<typeof browserTracingIntegration>(() => ({ name: "BrowserTracing" }))
    const environment = { NODE_ENV: "production", NEXT_PUBLIC_SENTRY_DSN: "http://synthetic@127.0.0.1:43990/1" }
    expect(createBrowserSentryOptions(environment, "http://127.0.0.1:3027", tracing).enabled).toBe(true)
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    try {
      const options = createBrowserSentryOptions(environment, "http://external.example.test", tracing)
      expect(options.enabled).toBe(true)
      expect(options.tracePropagationTargets).toEqual([])
      expect(warning).toHaveBeenCalledWith(
        "Browser telemetry trace propagation is disabled: page origin is not eligible"
      )
    } finally {
      warning.mockRestore()
    }
  })
})
