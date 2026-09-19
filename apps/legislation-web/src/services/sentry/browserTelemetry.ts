import { getClient, metrics } from "@sentry/nextjs"
import { createBrowserWebVitals } from "./browserWebVitals"
import { readPayloadField, sentryPayloadFields } from "./sentryPayloadFields"
import { telemetryFields } from "./telemetryFields"
import { resolveTelemetryRoute } from "./telemetryRoutes"

let reporter: ReturnType<typeof createBrowserWebVitals> | undefined
let dispose: (() => void) | undefined

export function initializeBrowserWebVitals() {
  if (reporter || typeof window === "undefined") {
    return dispose
  }
  const instance = createBrowserWebVitals({
    isEnabled: () => {
      const options = getClient()?.getOptions()
      return options?.enabled !== false && options?.enableMetrics === true && Boolean(options.dsn)
    },
    enqueue: (metric) => {
      metrics.distribution(metric.name, metric.value, { unit: metric.unit, attributes: { ...metric.attributes } })
    },
    onDiagnostic: (reason) => console.warn("Browser Web Vital was not recorded", { reason })
  })
  function startPage(isBackForwardRestore = false) {
    const options = getClient()?.getOptions()
    const environment = readPayloadField(telemetryFields.environment, options?.environment)
    if (!environment) {
      instance.discard()
      console.warn("Browser telemetry requires a recognized environment")
      return
    }
    const width = window.innerWidth
    let device: Parameters<typeof instance.startPage>[1] = "unknown"
    if (Number.isFinite(width) && width > 0) {
      if (width <= 640) {
        device = "mobile"
      } else if (width <= 1024) {
        device = "tablet"
      } else {
        device = "desktop"
      }
    }
    instance.startPage(
      {
        environment,
        release: readPayloadField(sentryPayloadFields.release, options?.release) ?? "unversioned",
        runtime: "browser",
        content_mode: "live",
        ...resolveTelemetryRoute(window.location.pathname)
      },
      device,
      isBackForwardRestore
    )
  }
  startPage()
  function handlePageShow(event: PageTransitionEvent) {
    if (event.persisted) {
      startPage(true)
    }
  }
  window.addEventListener("pageshow", handlePageShow)
  reporter = instance
  dispose = () => {
    window.removeEventListener("pageshow", handlePageShow)
    instance.discard()
    if (reporter === instance) {
      reporter = undefined
      dispose = undefined
    }
  }
  return dispose
}

export function reportBrowserWebVital(metric: unknown) {
  reporter?.receive(metric)
}
