import { z } from "zod"
import { prepareTelemetryMetric, type TelemetryMetricRecord } from "./telemetryContracts"
import { parseTelemetryContext } from "./telemetryContracts"
import type { TelemetryContext } from "./telemetryFields"

const vital = z.object({
  id: z.string().min(1).max(128),
  name: z.enum(["LCP", "INP", "CLS"]),
  value: z.number().finite().nonnegative(),
  navigationType: z.enum(["navigate", "reload", "prerender", "back-forward", "back-forward-cache", "restore"])
})
const metricNames = {
  LCP: "rostra.web_vital.lcp",
  INP: "rostra.web_vital.inp",
  CLS: "rostra.web_vital.cls"
} as const
type Device = "mobile" | "tablet" | "desktop" | "unknown"

export function createBrowserWebVitals(
  options: Readonly<{
    isEnabled: () => boolean
    enqueue: (metric: TelemetryMetricRecord) => void
    onDiagnostic: (reason: "invalid_vital" | "send_failure") => void
    schedule?: (callback: () => void) => void
  }>
) {
  let page: { context: TelemetryContext; device: Device; isBackForwardRestore: boolean } | undefined
  let generation = 0
  let isScheduled = false
  let diagnosticCount = 0
  const pending = new Map<z.infer<typeof vital>["name"], z.infer<typeof vital>>()
  const finalized = new Set<z.infer<typeof vital>["name"]>()
  const schedule = options.schedule ?? queueMicrotask

  function diagnostic(reason: "invalid_vital" | "send_failure") {
    diagnosticCount++
    if (diagnosticCount <= 10) {
      try {
        options.onDiagnostic(reason)
      } catch {
        console.warn("Browser Web Vital diagnostic failed", { reason })
      }
    }
  }

  function flush() {
    isScheduled = false
    const current = page
    if (!current || !options.isEnabled()) {
      pending.clear()
      return
    }
    const batch = [...pending.values()]
    pending.clear()
    for (const measurement of batch) {
      if (finalized.has(measurement.name)) {
        continue
      }
      const record = prepareTelemetryMetric(
        {
          name: metricNames[measurement.name],
          value: measurement.value,
          attributes: {
            route_template: current.context.route_template,
            device: current.device,
            navigation: measurement.navigationType.startsWith("back-forward") ? "back_forward" : "hard"
          }
        },
        current.context
      )
      try {
        options.enqueue(record)
        finalized.add(measurement.name)
      } catch {
        diagnostic("send_failure")
      }
    }
  }

  return {
    startPage(context: TelemetryContext, device: Device, isBackForwardRestore = false) {
      page = { context: parseTelemetryContext(context), device, isBackForwardRestore }
      generation++
      pending.clear()
      finalized.clear()
      isScheduled = false
    },
    receive(input: unknown) {
      if (!page || !options.isEnabled()) {
        return
      }
      const name = z.object({ name: z.string() }).safeParse(input)
      if (name.success && !Object.hasOwn(metricNames, name.data.name)) {
        return
      }
      const parsed = vital.safeParse(input)
      if (!parsed.success) {
        diagnostic("invalid_vital")
        return
      }
      if (page.isBackForwardRestore && parsed.data.navigationType !== "back-forward-cache") {
        diagnostic("invalid_vital")
        return
      }
      if (finalized.has(parsed.data.name)) {
        return
      }
      pending.set(parsed.data.name, parsed.data)
      if (!isScheduled) {
        isScheduled = true
        const scheduledGeneration = generation
        schedule(() => {
          if (scheduledGeneration === generation) {
            flush()
          }
        })
      }
    },
    discard() {
      page = undefined
      generation++
      pending.clear()
      isScheduled = false
    }
  }
}
