import { z } from "zod"
import { researchToolLabels } from "../../modules/conversations/researchTools"
import { telemetryRouteSchema, telemetrySurfaceSchema } from "./telemetryRoutes"

export const telemetryFields = {
  id: z.uuid(),
  count: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  duration: z.number().finite().nonnegative(),
  boolean: z.boolean(),
  token: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._@+:/-]*$/u),
  environment: z.enum(["development", "test", "staging", "production"]),
  runtime: z.enum(["browser", "node", "edge"]),
  origin: z.enum(["browser", "server"]),
  surface: telemetrySurfaceSchema,
  route: telemetryRouteSchema,
  contentMode: z.enum(["live", "demo"]),
  outcome: z.enum(["succeeded", "failed", "cancelled", "rejected", "unknown"]),
  responseOutcome: z.enum(["completed", "clarification", "partial", "cancelled", "exhausted", "failed", "unknown"]),
  failure: z.enum([
    "validation",
    "unauthenticated",
    "forbidden",
    "customer_limit",
    "overload",
    "not_found",
    "dependency",
    "timeout",
    "network",
    "render",
    "internal"
  ]),
  toolFailure: z.enum([
    "precondition_failed",
    "result_limit",
    "invalid_request",
    "invalid_cursor",
    "timeout",
    "dependency_unavailable",
    "not_found",
    "forbidden",
    "invalid_response",
    "interrupted",
    "internal"
  ]),
  tool: z.enum([...Object.keys(researchToolLabels), "ask_clarification", "unknown"]),
  entity: z.enum(["bill", "person", "organization", "meeting", "vote", "amendment", "document", "material", "legal"]),
  evidenceState: z.enum(["available", "empty", "partial", "unsupported", "stale"]),
  inputMethod: z.enum(["keyboard", "button"]),
  navigation: z.enum(["hard", "soft", "back_forward"]),
  device: z.enum(["mobile", "desktop", "tablet", "unknown"]),
  entry: z.enum(["direct", "internal", "external"]),
  rank: z.enum(["1", "2-5", "6-10", "11+"]),
  size: z.enum(["0", "1-80", "81-280", "281-1000", "1001+"]),
  depth: z.enum(["0", "1", "2-5", "6-20", "21-50", "51+"]),
  dwell: z.enum(["under_10s", "10_60s", "1_5m", "5_30m", "30m_plus"]),
  draftOrigin: z.enum(["typed", "suggestion", "history", "restored", "mixed"]),
  searchKind: z.enum(["discovery", "passage", "mention", "reference_picker", "legal"]),
  searchMode: z.enum(["lexical", "semantic", "hybrid", "structured"]),
  cache: z.enum(["hit", "miss", "bypass", "error"]),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "OTHER"]),
  statusClass: z.enum(["1xx", "2xx", "3xx", "4xx", "5xx", "aborted", "unknown"]),
  caller: z.enum(["browser", "mcp", "api", "service", "synthetic", "unknown"]),
  auth: z.enum(["anonymous", "session", "token", "service", "disabled"]),
  operation: z.enum([
    "read",
    "list",
    "batch",
    "search",
    "analytics",
    "compare",
    "create",
    "update",
    "delete",
    "verify",
    "rotate",
    "research",
    "reference_search",
    "record_inspection",
    "result_pagination",
    "clarification",
    "health",
    "readiness",
    "not_found"
  ]),
  dependency: z.enum(["database", "pool", "retrieval", "reranker", "cache", "model", "auth", "delivery", "web"]),
  stage: z.enum(["validation", "dependency", "enrichment", "projection", "serialization"]),
  phase: z.enum(["pre_ack", "researching", "clarification", "streaming", "terminal"]),
  output: z.enum(["user_message_copy", "assistant_answer_copy", "conversation_export", "mcp_config_copy"]),
  accountAction: z.enum(["sign_in", "sign_out", "reauth", "consent"]),
  settingAction: z.enum(["notification_preferences", "integration", "privacy"]),
  monitoringAction: z.enum([
    "create",
    "read",
    "update",
    "delete",
    "verify",
    "rotate",
    "pause",
    "resume",
    "delivery_status"
  ]),
  channel: z.enum(["in_app", "email", "webhook"]),
  retryLayer: z.enum(["orchestrator", "dependency", "turn"]),
  metricBoundary: z.enum(["raw", "enriched", "model", "request", "response"]),
  diagnostic: z.enum([
    "invalid_schema",
    "payload_limit",
    "attribute_limit",
    "cardinality_limit",
    "dedupe_limit",
    "sink_failure",
    "context_failure",
    "reentrant"
  ])
} as const

export type TelemetryScalar = string | number | boolean

export const telemetryContextSchema = z.strictObject({
  environment: telemetryFields.environment,
  release: telemetryFields.token,
  runtime: telemetryFields.runtime,
  route_template: telemetryFields.route,
  surface: telemetryFields.surface,
  content_mode: telemetryFields.contentMode
})

export type TelemetryContext = Readonly<z.infer<typeof telemetryContextSchema>>
