import type { TelemetryEventName } from "./telemetryEvents"
import type { TelemetryMetricName } from "./telemetryMetrics"
import { resolveTelemetryRoute, telemetryRouteTemplates } from "./telemetryRoutes"

type Coverage = Readonly<{
  owner: "web" | "platform" | "research"
  privacy: "operational" | "optional_usage"
  events: readonly TelemetryEventName[]
  metrics: readonly TelemetryMetricName[]
  query: Readonly<{ event: TelemetryEventName; aggregate: "count"; groupBy: readonly string[] }>
  acceptance: "pending"
  implementationIssue: string
  exception?: "demo_separate" | "legal_acceptance_separate" | "excluded_from_product_usage" | "bounded_unknown_route"
}>

const coverage = {
  home: {
    owner: "web",
    privacy: "optional_usage",
    events: ["page.viewed", "page.ready", "suggestion.shown", "suggestion.selected", "integration.instructions_used"],
    metrics: ["rostra.page.view", "rostra.route.ready", "rostra.feature.action"],
    query: { event: "page.viewed", aggregate: "count", groupBy: ["content_mode", "navigation"] },
    acceptance: "pending",
    implementationIssue: "LEG-43",
    exception: "demo_separate"
  },
  conversation: {
    owner: "web",
    privacy: "optional_usage",
    events: [
      "conversation.submitted",
      "conversation.accepted",
      "conversation.finished",
      "conversation.rendered",
      "conversation.milestone",
      "composer.draft_ended",
      "research.tool_finished"
    ],
    metrics: [
      "rostra.chat.outcome",
      "rostra.chat.first_content",
      "rostra.chat.duration",
      "rostra.composer.ready",
      "rostra.tool.duration"
    ],
    query: { event: "conversation.finished", aggregate: "count", groupBy: ["outcome", "origin"] },
    acceptance: "pending",
    implementationIssue: "LEG-46"
  },
  record: {
    owner: "web",
    privacy: "optional_usage",
    events: ["page.viewed", "evidence.opened", "evidence.loaded", "search.results_rendered"],
    metrics: ["rostra.route.ready", "rostra.search.duration"],
    query: { event: "evidence.loaded", aggregate: "count", groupBy: ["state", "origin"] },
    acceptance: "pending",
    implementationIssue: "LEG-42"
  },
  api: {
    owner: "platform",
    privacy: "operational",
    events: ["api.request_finished"],
    metrics: ["rostra.api.request", "rostra.api.duration", "rostra.dependency.duration"],
    query: { event: "api.request_finished", aggregate: "count", groupBy: ["operation", "status_class", "caller"] },
    acceptance: "pending",
    implementationIssue: "LEG-40"
  },
  search: {
    owner: "research",
    privacy: "operational",
    events: ["api.request_finished", "search.finished", "research.tool_finished"],
    metrics: ["rostra.api.duration", "rostra.search.duration", "rostra.search.results"],
    query: { event: "search.finished", aggregate: "count", groupBy: ["search_kind", "outcome"] },
    acceptance: "pending",
    implementationIssue: "LEG-39"
  },
  monitoring: {
    owner: "platform",
    privacy: "operational",
    events: ["api.request_finished", "monitoring.action_finished"],
    metrics: ["rostra.api.request", "rostra.api.duration", "rostra.operation.outcome"],
    query: { event: "monitoring.action_finished", aggregate: "count", groupBy: ["action", "channel", "outcome"] },
    acceptance: "pending",
    implementationIssue: "LEG-41"
  },
  legal: {
    owner: "research",
    privacy: "operational",
    events: ["api.request_finished", "evidence.loaded"],
    metrics: ["rostra.api.request", "rostra.api.duration"],
    query: { event: "api.request_finished", aggregate: "count", groupBy: ["operation", "status_class"] },
    acceptance: "pending",
    implementationIssue: "LEG-40",
    exception: "legal_acceptance_separate"
  },
  probe: {
    owner: "platform",
    privacy: "operational",
    events: ["api.request_finished"],
    metrics: ["rostra.api.request", "rostra.api.duration"],
    query: { event: "api.request_finished", aggregate: "count", groupBy: ["status_class"] },
    acceptance: "pending",
    implementationIssue: "LEG-40",
    exception: "excluded_from_product_usage"
  },
  unmatched: {
    owner: "platform",
    privacy: "operational",
    events: ["api.request_finished", "navigation.failed"],
    metrics: ["rostra.api.request"],
    query: { event: "api.request_finished", aggregate: "count", groupBy: ["method", "status_class"] },
    acceptance: "pending",
    implementationIssue: "LEG-40",
    exception: "bounded_unknown_route"
  }
} as const satisfies Record<string, Coverage>

export function telemetryCoverageForRoute(pathname: string) {
  const route = resolveTelemetryRoute(pathname)
  const { route_template: template, surface } = route
  let group: keyof typeof coverage
  if (surface === "not_found") {
    group = "unmatched"
  } else if (surface === "health" || surface === "readiness") {
    group = "probe"
  } else if (surface !== "api") {
    group = surface
  } else if (template.startsWith("/api/webhooks") || template.startsWith("/api/subscriptions")) {
    group = "monitoring"
  } else if (template.startsWith("/api/legal") || template === "/api/search/legal") {
    group = "legal"
  } else if (template.startsWith("/api/search") || template === "/api/analytics") {
    group = "search"
  } else {
    group = "api"
  }
  return Object.freeze({ ...route, group, ...coverage[group] })
}

export const telemetryCoverageRegistry = telemetryRouteTemplates.map(telemetryCoverageForRoute)
