import { z } from "zod"
import { telemetryFields as f } from "./telemetryFields"

function metric<const Shape extends z.ZodRawShape>(
  type: "counter" | "gauge" | "distribution",
  unit: "none" | "millisecond" | "byte",
  owner: "web" | "platform" | "research",
  attributes: Shape,
  isInteger = type === "counter" || type === "gauge" || unit === "byte"
) {
  return { type, unit, owner, value: isInteger ? f.count : f.duration, attributes: z.strictObject(attributes) }
}

const route = { route_template: f.route }
const outcome = { outcome: f.outcome }
const chat = { origin: f.origin, outcome: f.responseOutcome }
const tool = { tool_name: f.tool }
const api = { ...route, method: f.method, status_class: f.statusClass, caller: f.caller }
const webVital = { ...route, device: f.device, navigation: z.enum(["hard", "back_forward"]) }

export const telemetryMetrics = {
  "rostra.page.view": metric("counter", "none", "web", { ...route, navigation: f.navigation, device: f.device }),
  "rostra.feature.action": metric("counter", "none", "web", {
    surface: f.surface,
    action: z.enum(["submit", "select", "open", "copy", "export", "stop", "retry", "apply", "dismiss"])
  }),
  "rostra.operation.outcome": metric("counter", "none", "platform", { operation: f.operation, ...outcome }),
  "rostra.api.request": metric("counter", "none", "platform", api),
  "rostra.api.duration": metric("distribution", "millisecond", "platform", api),
  "rostra.route.ready": metric("distribution", "millisecond", "web", {
    ...route,
    navigation: f.navigation,
    ...outcome,
    device: f.device
  }),
  "rostra.web_vital.lcp": metric("distribution", "millisecond", "web", webVital),
  "rostra.web_vital.inp": metric("distribution", "millisecond", "web", webVital),
  "rostra.web_vital.cls": metric("distribution", "none", "web", webVital),
  "rostra.search.duration": metric("distribution", "millisecond", "platform", {
    search_kind: f.searchKind,
    origin: f.origin,
    ...outcome
  }),
  "rostra.search.results": metric("distribution", "none", "research", { search_kind: f.searchKind }, true),
  "rostra.chat.first_content": metric("distribution", "millisecond", "web", chat),
  "rostra.chat.duration": metric("distribution", "millisecond", "web", chat),
  "rostra.chat.outcome": metric("counter", "none", "research", chat),
  "rostra.chat.stream_gap": metric("distribution", "millisecond", "web", { visibility: z.enum(["visible", "hidden"]) }),
  "rostra.tool.duration": metric("distribution", "millisecond", "research", {
    ...tool,
    outcome: z.enum(["success", "error"])
  }),
  "rostra.dependency.duration": metric("distribution", "millisecond", "platform", {
    dependency: f.dependency,
    ...outcome
  }),
  "rostra.tool.outcome": metric("counter", "none", "research", {
    ...tool,
    outcome: z.enum(["success", "error"]),
    failure_code: f.toolFailure.optional()
  }),
  "rostra.result.bytes": metric("distribution", "byte", "research", {
    boundary: f.metricBoundary,
    operation: f.operation
  }),
  "rostra.ai.tokens": metric("counter", "none", "research", {
    model: f.token,
    provider: f.token,
    kind: z.enum(["input", "output", "cache_read", "cache_write"])
  }),
  "rostra.ai.cost": metric("distribution", "none", "research", {
    model: f.token,
    provider: f.token,
    currency: z.literal("USD"),
    source: z.enum(["reported", "estimated"])
  }),
  "rostra.cache.lookup": metric("counter", "none", "platform", {
    cache: z.enum(["query", "result", "prompt", "auth"]),
    outcome: f.cache
  }),
  "rostra.pool.connections": metric("gauge", "none", "platform", { pool: z.enum(["application", "analytics"]) }),
  "rostra.pool.waiting": metric("gauge", "none", "platform", { pool: z.enum(["application", "analytics"]) }),
  "rostra.telemetry.dropped": metric("counter", "none", "platform", {
    signal: z.enum(["event", "metric"]),
    reason: f.diagnostic
  }),
  "rostra.composer.ready": metric("distribution", "millisecond", "web", { surface: z.enum(["home", "conversation"]) }),
  "rostra.composer.input_latency": metric("distribution", "millisecond", "web", { device: f.device }),
  "rostra.composer.draft_duration": metric("distribution", "millisecond", "web", {
    kind: z.enum(["elapsed", "visible_focused"]),
    draft_origin: f.draftOrigin
  }),
  "rostra.composer.submit_blocked": metric("counter", "none", "web", {
    reason: z.enum(["empty", "unavailable", "busy", "restoring", "session_mismatch", "navigating", "reference_limit"])
  }),
  "rostra.reference.lookup_duration": metric("distribution", "millisecond", "web", {
    kind: z.enum(["mention", "reference_picker"]),
    boundary: z.enum(["request", "visible"]),
    ...outcome
  }),
  "rostra.chat.acknowledgement": metric("distribution", "millisecond", "web", {}),
  "rostra.chat.render_lag": metric("distribution", "millisecond", "web", {
    kind: z.enum(["text", "presentation"]),
    visibility: z.enum(["visible", "hidden"])
  }),
  "rostra.chat.presentation_wait": metric("distribution", "millisecond", "web", {
    reason: z.enum(["animation", "deadline", "bypass"]),
    visibility: z.enum(["visible", "hidden"])
  }),
  "rostra.chat.stop_latency": metric("distribution", "millisecond", "web", {
    origin: f.origin,
    observed_phase: f.phase
  }),
  "rostra.chat.clarification_confirmation": metric("distribution", "millisecond", "web", outcome),
  "rostra.tool.requested": metric("counter", "none", "research", tool),
  "rostra.tool.rejected": metric("counter", "none", "research", {
    ...tool,
    reason: z.enum(["unknown_tool", "schema", "authorization", "budget", "cancelled"])
  }),
  "rostra.tool.dispatch_wait": metric("distribution", "millisecond", "research", tool),
  "rostra.tool.stage_duration": metric("distribution", "millisecond", "research", { ...tool, stage: f.stage }),
  "rostra.tool.retry": metric("counter", "none", "research", { ...tool, layer: f.retryLayer, reason: f.toolFailure }),
  "rostra.tool.retry_backoff": metric("distribution", "millisecond", "research", { ...tool, layer: f.retryLayer }),
  "rostra.tool.results": metric("distribution", "none", "research", { ...tool, state: f.evidenceState }, true),
  "rostra.tool.calls_per_turn": metric(
    "distribution",
    "none",
    "research",
    {
      kind: z.enum(["requested", "executed", "settled"])
    },
    true
  ),
  "rostra.tool.concurrent_peak": metric("distribution", "none", "research", {}, true),
  "rostra.tool.wall_time": metric("distribution", "millisecond", "research", {}),
  "rostra.tool.pending_at_close": metric("distribution", "none", "research", {}, true),
  "rostra.tool.measurement_missing": metric("counter", "none", "research", {
    kind: z.enum(["terminal", "dependency", "size", "count", "usage", "browser_observation"])
  })
} as const

export type TelemetryMetricName = keyof typeof telemetryMetrics
export type TelemetryMetricInput = {
  [Name in TelemetryMetricName]: Readonly<{
    name: Name
    value: number
    attributes: z.input<(typeof telemetryMetrics)[Name]["attributes"]>
  }>
}[TelemetryMetricName]

export function isTelemetryMetricName(name: string): name is TelemetryMetricName {
  return Object.hasOwn(telemetryMetrics, name)
}
