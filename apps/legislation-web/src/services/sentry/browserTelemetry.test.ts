// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import * as runtime from "./browserTelemetry"

const sdk = vi.hoisted(() => {
  const options = { enabled: true, enableMetrics: false, dsn: "synthetic", environment: "test", release: "fixture" }
  return {
    options,
    distribution: vi.fn<(name: string, value: number, options: unknown) => void>(),
    getClient: () => ({ getOptions: () => options })
  }
})
vi.mock("@sentry/nextjs", () => ({ getClient: sdk.getClient, metrics: { distribution: sdk.distribution } }))

let listeners: EventListener[] = []
let dispose: (() => void) | undefined
function pageShow(persisted: boolean) {
  const event = new Event("pageshow")
  Object.defineProperty(event, "persisted", { value: persisted })
  listeners.forEach((listener) => listener(event))
}
beforeEach(() => {
  sdk.options.enabled = true
  sdk.options.enableMetrics = false
  sdk.options.environment = "test"
  sdk.distribution.mockClear()
  listeners = []
  vi.spyOn(window, "addEventListener").mockImplementation((name, listener) => {
    if (name === "pageshow" && typeof listener === "function") {
      listeners.push(listener)
    }
  })
  window.history.replaceState(null, "", "/")
})
afterEach(() => {
  dispose?.()
  vi.restoreAllMocks()
})

it("keeps the runtime reporter singleton and emits no metrics while the SDK switch is off", async () => {
  dispose = runtime.initializeBrowserWebVitals()
  runtime.initializeBrowserWebVitals()
  runtime.reportBrowserWebVital({ name: "LCP", id: "first", value: 12, navigationType: "navigate" })
  await Promise.resolve()
  expect(listeners).toHaveLength(1)
  expect(sdk.distribution).not.toHaveBeenCalled()
})

it("attributes native vitals to the document entry rather than a later SPA location", async () => {
  sdk.options.enableMetrics = true
  dispose = runtime.initializeBrowserWebVitals()
  window.history.replaceState(null, "", "/conversations/private-id")
  runtime.reportBrowserWebVital({
    name: "CLS",
    id: "first",
    value: 0.1,
    navigationType: "navigate",
    entries: [{ text: "PRIVATE" }]
  })
  await Promise.resolve()
  expect(sdk.distribution).toHaveBeenCalledWith(
    "rostra.web_vital.cls",
    0.1,
    expect.objectContaining({
      unit: "none",
      attributes: expect.objectContaining({ route_template: "/", runtime: "browser", navigation: "hard" })
    })
  )
  expect(JSON.stringify(sdk.distribution.mock.calls)).not.toMatch(/PRIVATE|private-id/)
})

it("starts a separate native lifecycle on persisted pageshow without resetting on ordinary pageshow", async () => {
  sdk.options.enableMetrics = true
  dispose = runtime.initializeBrowserWebVitals()
  runtime.reportBrowserWebVital({ name: "LCP", id: "first", value: 10, navigationType: "navigate" })
  await Promise.resolve()
  pageShow(false)
  runtime.reportBrowserWebVital({ name: "LCP", id: "duplicate", value: 10, navigationType: "navigate" })
  await Promise.resolve()
  expect(sdk.distribution).toHaveBeenCalledTimes(1)
  window.history.replaceState(null, "", "/records/person/private")
  pageShow(true)
  runtime.reportBrowserWebVital({ name: "LCP", id: "restored", value: 5, navigationType: "back-forward-cache" })
  await Promise.resolve()
  expect(sdk.distribution).toHaveBeenLastCalledWith(
    "rostra.web_vital.lcp",
    5,
    expect.objectContaining({
      attributes: expect.objectContaining({ route_template: "/records/[kind]/[recordId]", navigation: "back_forward" })
    })
  )
  expect(sdk.distribution).toHaveBeenCalledTimes(2)
})

it("reports invalid runtime metadata without inventing a development cohort", async () => {
  sdk.options.enableMetrics = true
  sdk.options.environment = "PRIVATE"
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  dispose = runtime.initializeBrowserWebVitals()
  runtime.reportBrowserWebVital({ name: "LCP", id: "first", value: 10, navigationType: "navigate" })
  await Promise.resolve()
  expect(warning).toHaveBeenCalledWith("Browser telemetry requires a recognized environment")
  expect(sdk.distribution).not.toHaveBeenCalled()
})
