import type { StackFrame } from "@sentry/core"
import { z } from "zod"
import { telemetryFields as f, type TelemetryScalar } from "./telemetryFields"
import { resolveTelemetryRoute } from "./telemetryRoutes"

export const sentryPayloadFields = {
  eventId: z.string().regex(/^[a-f0-9]{32}$/u),
  spanId: z.string().regex(/^[a-f0-9]{16}$/u),
  timestamp: z.number().finite().nonnegative(),
  release: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/u),
  level: z.enum(["fatal", "error", "warning", "log", "info", "debug"]),
  operation: z.enum([
    ...f.operation.options,
    "chat_prompt",
    "chat_capture",
    "chat_stream",
    "chat_transport",
    "chat_research_memory",
    "answer_composition",
    "citation_resolution",
    "tool_call",
    "conversation_export",
    "react_boundary",
    "clarification_submit",
    "research_suggestions"
  ]),
  spanOperation: z.enum([
    "app.operation",
    "http.server",
    "http.client",
    "db",
    "db.query",
    "db.analytics",
    "db.sql.query",
    "pageload",
    "navigation",
    "ui.action",
    "function",
    "gen_ai.chat",
    "gen_ai.execute_tool",
    "mcp.tool"
  ]),
  status: z.enum([
    "ok",
    "unknown_error",
    "invalid_argument",
    "not_found",
    "permission_denied",
    "unavailable",
    "cancelled",
    "deadline_exceeded",
    "internal_error"
  ])
}

export type SentryPayloadPolicy = Readonly<{
  models?: readonly string[]
  providers?: readonly string[]
  release?: string
}>

export function readPayloadField<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown
): z.output<Schema> | undefined {
  const result = schema.safeParse(value)
  return result.success ? result.data : undefined
}

export function payloadRecord(value: unknown): Record<string, unknown> {
  return readPayloadField(z.record(z.string(), z.unknown()), value) ?? {}
}

export function projectPayloadFields(shape: Readonly<Record<string, z.ZodType>>, value: unknown) {
  const record = payloadRecord(value)
  const output: Record<string, TelemetryScalar> = {}
  for (const [key, schema] of Object.entries(shape)) {
    const parsed = readPayloadField(schema, record[key])
    if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
      output[key] = parsed
    }
  }
  return output
}

export function projectSafeModelFields(value: Readonly<Record<string, TelemetryScalar>>, policy: SentryPayloadPolicy) {
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => {
      if (key === "model" || key === "gen_ai.request.model" || key === "gen_ai.response.model") {
        return typeof entry === "string" && policy.models?.includes(entry)
      }
      if (key === "provider" || key === "gen_ai.system" || key === "gen_ai.provider.name") {
        return typeof entry === "string" && policy.providers?.includes(entry)
      }
      return true
    })
  )
}

const metadataFields = {
  operation: sentryPayloadFields.operation,
  category: z.union([f.failure, f.toolFailure]),
  stage: f.stage,
  tool: f.tool,
  tool_name: f.tool,
  runtime: f.runtime,
  surface: f.surface,
  route_template: f.route,
  content_mode: f.contentMode,
  runId: f.id,
  reference: f.id,
  operation_id: f.id,
  tool_call_id: f.id,
  model: f.token,
  provider: f.token,
  promptVersion: z.union([f.count, z.string().regex(/^\d{1,8}$/u)]),
  durationMs: f.duration,
  dependencyDurationMs: f.duration,
  resultBytes: f.count,
  rawResultBytes: f.count,
  enrichedResultBytes: f.count,
  modelResultBytes: f.count,
  resultCount: f.count,
  hasNextPage: f.boolean,
  attemptCount: f.count,
  unresolvedCitationCount: f.count,
  evidenceCount: f.count,
  outcome: z.union([f.outcome, f.responseOutcome, z.enum(["success", "error"])]),
  "http.request.method": f.method,
  "http.response.status_code": z.number().int().min(100).max(599),
  "analytics.duration_ms": f.duration,
  "analytics.row_count": f.count,
  "analytics.database_rows": f.count,
  "analytics.join_count": f.count,
  "analytics.result_bytes": f.count,
  "gen_ai.request.model": f.token,
  "gen_ai.response.model": f.token,
  "gen_ai.system": f.token,
  "gen_ai.provider.name": f.token,
  "gen_ai.usage.input_tokens": f.count,
  "gen_ai.usage.output_tokens": f.count,
  "gen_ai.usage.total_tokens": f.count
} as const

export function projectSentryMetadata(value: unknown, policy: SentryPayloadPolicy) {
  return projectSafeModelFields(projectPayloadFields(metadataFields, value), policy)
}

export function safeCodeLocation(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) {
    return undefined
  }
  const path = value.replaceAll("\\", "/").split(/[?#]/u)[0] ?? ""
  const asset = /(?:^|\/)(_next\/static\/chunks\/[a-f0-9]{8,64}\.(?:js|mjs))$/u.exec(path)?.[1]
  if (asset) {
    return `/${asset}`
  }
  const compiled = /(?:^|\/)\.next\/server\/app\/(.+)\/(page|route)\.js$/u.exec(path)
  if (compiled?.[1] && compiled[2]) {
    const route = resolveTelemetryRoute(`/${compiled[1]}`)
    if (route.route_template !== "/_unmatched" && route.route_template !== "/api/[...path]") {
      return `app:///.next/server/app${route.route_template}/${compiled[2]}.js`
    }
  }
  return undefined
}

export function projectStackFrame(value: unknown): StackFrame {
  const frame = payloadRecord(value)
  return {
    filename: safeCodeLocation(frame.filename),
    lineno: readPayloadField(f.count, frame.lineno),
    colno: readPayloadField(f.count, frame.colno),
    in_app: readPayloadField(f.boolean, frame.in_app),
    debug_id: readPayloadField(f.id, frame.debug_id)
  }
}
