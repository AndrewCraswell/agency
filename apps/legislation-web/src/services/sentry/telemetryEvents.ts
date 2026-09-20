import { z } from "zod"
import { telemetryFields as f } from "./telemetryFields"

type EventPhase = "state" | "intent" | "accepted" | "terminal" | "rendered" | "milestone" | "summary"

function event<const Shape extends z.ZodRawShape>(
  attributes: Shape,
  category: "usage" | "operational",
  phase: EventPhase,
  origin: "browser" | "server" | "either" = "browser",
  once = true,
  dimensions: readonly string[] = []
) {
  return { attributes: z.strictObject(attributes), category, phase, origin, once, dimensions }
}

const duration = { duration_ms: f.duration }
const result = { outcome: f.outcome, failure: f.failure.optional(), duration_ms: f.duration.optional() }
const clarification = { kind: z.enum(["single", "multiple", "text"]), revision: f.count }
const draft = { draft_id: f.id, draft_origin: f.draftOrigin, size_bucket: f.size, reference_count: f.count.max(12) }
const search = { search_kind: f.searchKind, mode: f.searchMode.optional() }
const tool = { tool_name: f.tool, tool_call_id: f.id }

export const telemetryEvents = {
  "page.viewed": event({ navigation: f.navigation, entry: f.entry, device: f.device }, "usage", "state"),
  "page.ready": event(
    { ...duration, outcome: z.enum(["content", "empty", "error"]), navigation: f.navigation },
    "operational",
    "rendered"
  ),
  "navigation.failed": event({ failure: f.failure }, "operational", "terminal"),
  "suggestion.shown": event({ count: f.count }, "usage", "state"),
  "suggestion.selected": event({ rank_bucket: f.rank }, "usage", "intent", "browser", false),
  "research.reference_changed": event(
    {
      action: z.enum(["add", "remove"]),
      entity_kind: f.entity,
      source: z.enum(["mention", "picker"]),
      count: f.count.max(12)
    },
    "usage",
    "state",
    "browser",
    false
  ),
  "integration.instructions_used": event(
    { client: z.enum(["claude", "copilot", "cursor", "other"]), action: z.enum(["select", "open"]) },
    "usage",
    "intent",
    "browser",
    false
  ),
  "composer.ready": event({ ...duration, available: f.boolean }, "operational", "state"),
  "composer.draft_started": event({ draft_id: f.id, draft_origin: f.draftOrigin }, "usage", "state"),
  "composer.draft_restored": event(
    { ...draft, source: z.enum(["memory", "development_checkpoint"]) },
    "usage",
    "state"
  ),
  "composer.history_recalled": event(
    { direction: z.enum(["back", "forward", "original_draft"]), history_depth: f.depth },
    "usage",
    "state",
    "browser",
    false
  ),
  "composer.submit_blocked": event(
    {
      reason: z.enum(["empty", "unavailable", "busy", "restoring", "session_mismatch", "navigating", "reference_limit"])
    },
    "operational",
    "terminal"
  ),
  "composer.draft_ended": event(
    {
      ...draft,
      reason: z.enum(["submitted", "cleared", "replaced", "command", "lifecycle_end"]),
      elapsed_bucket: f.dwell,
      focused_bucket: f.dwell,
      used_suggestion: f.boolean,
      used_history: f.boolean,
      used_mention: f.boolean
    },
    "usage",
    "summary"
  ),
  "composer.mention_opened": event({ interaction_id: f.id, loading: f.boolean }, "usage", "state"),
  "composer.mention_closed": event(
    {
      interaction_id: f.id,
      reason: z.enum(["selected", "dismissed", "blurred", "interrupted"]),
      count: f.count,
      request_count: f.count,
      retry_count: f.count,
      ...duration
    },
    "usage",
    "terminal"
  ),
  "composer.reference_picker_opened": event({ interaction_id: f.id, count: f.count.max(12) }, "usage", "state"),
  "composer.reference_picker_closed": event(
    {
      interaction_id: f.id,
      outcome: z.enum(["applied", "dismissed"]),
      added: f.count.max(12),
      removed: f.count.max(12),
      ...duration
    },
    "usage",
    "terminal"
  ),
  "conversation.opened": event(
    {
      entry: f.entry,
      state: z.enum(["new", "memory", "development_restored", "unavailable"]),
      message_count_bucket: f.depth
    },
    "usage",
    "state"
  ),
  "conversation.submitted": event(
    { ...draft, turn_kind: z.enum(["new", "follow_up"]), submit_method: f.inputMethod },
    "usage",
    "intent"
  ),
  "conversation.accepted": event({ model: f.token, provider: f.token }, "operational", "accepted", "server"),
  "conversation.finished": event(
    {
      outcome: f.responseOutcome,
      finish_reason: z.enum(["stop", "length", "error", "cancelled", "unknown"]),
      duration_ms: f.duration,
      first_content_ms: f.duration.optional(),
      tool_count: f.count,
      step_count: f.count.optional()
    },
    "operational",
    "terminal",
    "server"
  ),
  "conversation.rendered": event(
    {
      outcome: f.responseOutcome,
      duration_ms: f.duration,
      first_content_ms: f.duration.optional(),
      citation_count: f.count,
      unresolved_citations: f.count,
      pending_blocks: f.count,
      failed_blocks: f.count
    },
    "operational",
    "rendered"
  ),
  "conversation.milestone": event(
    {
      milestone: z.enum([
        "request_dispatched",
        "acknowledgement_received",
        "progress_rendered",
        "first_chunk_received",
        "first_content_rendered",
        "terminal_received",
        "terminal_rendered"
      ]),
      elapsed_ms: f.duration
    },
    "operational",
    "milestone",
    "browser",
    true,
    ["milestone"]
  ),
  "conversation.stream_summary": event(
    {
      chunk_count: f.count,
      bytes: f.count.optional(),
      stall_count: f.count,
      max_gap_ms: f.duration,
      total_gap_ms: f.duration,
      render_lag_ms: f.duration.optional(),
      visibility: z.enum(["visible", "hidden", "mixed"])
    },
    "operational",
    "summary"
  ),
  "conversation.stop_requested": event({ observed_phase: f.phase, has_partial_content: f.boolean }, "usage", "intent"),
  "conversation.retry_requested": event(
    { kind: z.enum(["retry", "regenerate"]), prior_outcome: f.responseOutcome, observed_phase: f.phase },
    "usage",
    "intent"
  ),
  "conversation.clarification_shown": event(
    { ...clarification, option_count: f.count },
    "usage",
    "rendered",
    "browser",
    true,
    ["revision"]
  ),
  "conversation.clarification_submitted": event(
    { ...clarification, action: z.enum(["answer", "skip"]), selection_count: f.count },
    "usage",
    "intent",
    "browser",
    true,
    ["revision"]
  ),
  "conversation.clarification_finished": event(
    {
      ...clarification,
      ...result,
      revision_matched: f.boolean,
      state: z.enum(["accepted", "expired", "superseded", "unknown"])
    },
    "operational",
    "terminal",
    "either",
    true,
    ["revision"]
  ),
  "conversation.activity_toggled": event(
    { tool_name: f.tool, expanded: f.boolean, state: z.enum(["pending", "running", "succeeded", "failed", "unknown"]) },
    "usage",
    "state",
    "browser",
    false
  ),
  "conversation.follow_mode_changed": event(
    { following: f.boolean, reason: z.enum(["user_scroll", "jump_to_latest", "layout", "unknown"]) },
    "usage",
    "state",
    "browser",
    false
  ),
  "conversation.recovery_observed": event(
    { recovery: z.enum(["retry", "development_restore", "expired_result", "unavailable_thread"]), ...result },
    "operational",
    "terminal"
  ),
  "research.tool_requested": event(tool, "operational", "intent", "server", true, ["tool_call_id"]),
  "research.tool_started": event(tool, "operational", "accepted", "server", true, ["tool_call_id"]),
  "research.tool_finished": event(
    {
      ...tool,
      outcome: z.enum(["success", "error"]),
      failure_code: f.toolFailure.optional(),
      duration_ms: f.duration,
      dependency_duration_ms: f.duration.optional(),
      raw_result_bytes: f.count.optional(),
      enriched_result_bytes: f.count.optional(),
      model_result_bytes: f.count.optional(),
      result_count: f.count.optional(),
      has_next_page: f.boolean.optional()
    },
    "operational",
    "terminal",
    "server",
    true,
    ["tool_call_id"]
  ),
  "research.tool_rejected": event(
    { ...tool, reason: z.enum(["unknown_tool", "schema", "authorization", "budget", "cancelled"]) },
    "operational",
    "terminal",
    "server",
    true,
    ["tool_call_id"]
  ),
  "research.tool_retry_scheduled": event(
    { ...tool, retry_layer: f.retryLayer, reason: f.toolFailure, backoff_ms: f.duration },
    "operational",
    "state",
    "server",
    true,
    ["tool_call_id"]
  ),
  "research.tool_result_observed": event(
    { ...tool, observation: z.enum(["received", "rendered"]) },
    "operational",
    "rendered",
    "browser",
    true,
    ["tool_call_id", "observation"]
  ),
  "research.run_summary": event(
    {
      requested: f.count,
      started: f.count,
      settled: f.count,
      pending: f.count,
      peak_concurrency: f.count,
      tool_wall_ms: f.duration,
      tool_work_ms: f.duration
    },
    "operational",
    "summary",
    "server"
  ),
  "search.submitted": event(
    { ...search, filter_count: f.count, page_action: z.enum(["initial", "next", "previous", "retry"]) },
    "usage",
    "intent"
  ),
  "search.finished": event(
    {
      ...search,
      ...result,
      result_count: f.count.optional(),
      has_next_page: f.boolean.optional(),
      truncated: f.boolean.optional(),
      cache: f.cache.optional()
    },
    "operational",
    "terminal",
    "server"
  ),
  "search.results_rendered": event(
    { ...search, ...result, result_count: f.count.optional() },
    "operational",
    "rendered"
  ),
  "search.result_selected": event(
    { entity_kind: f.entity, rank_bucket: f.rank, input_method: f.inputMethod },
    "usage",
    "intent",
    "browser",
    false
  ),
  "evidence.opened": event(
    {
      entity_kind: f.entity,
      kind: z.enum(["citation", "record", "passage", "source", "comparison", "tab"]),
      source_class: z.enum(["official", "internal"])
    },
    "usage",
    "intent",
    "browser",
    false
  ),
  "evidence.loaded": event(
    { ...result, state: f.evidenceState, count: f.count.optional(), version_count: f.count.optional() },
    "operational",
    "terminal",
    "either"
  ),
  "output.requested": event({ kind: f.output }, "usage", "intent"),
  "output.finished": event(
    { kind: f.output, ...result, bytes: f.count.optional() },
    "operational",
    "terminal",
    "either"
  ),
  "account.action_requested": event({ action: f.accountAction }, "usage", "intent"),
  "account.action_finished": event(
    { action: f.accountAction, ...result, return_route: f.route.optional() },
    "operational",
    "terminal",
    "either"
  ),
  "settings.action_requested": event({ action: f.settingAction }, "usage", "intent"),
  "settings.action_finished": event({ action: f.settingAction, ...result }, "operational", "terminal", "server"),
  "monitoring.action_requested": event({ action: f.monitoringAction, channel: f.channel }, "usage", "intent"),
  "monitoring.action_finished": event(
    { action: f.monitoringAction, channel: f.channel, ...result },
    "operational",
    "terminal",
    "server"
  ),
  "api.request_finished": event(
    {
      operation: f.operation,
      method: f.method,
      status_class: f.statusClass,
      auth_mode: f.auth,
      caller: f.caller,
      ...duration,
      request_bytes: f.count.optional(),
      response_bytes: f.count.optional()
    },
    "operational",
    "terminal",
    "server"
  )
} as const

export type TelemetryEventName = keyof typeof telemetryEvents
export type TelemetryEventInput = {
  [Name in TelemetryEventName]: Readonly<{
    event_name: Name
    operation_id: string
    attempt: number
    event_id?: string
    attributes: z.input<(typeof telemetryEvents)[Name]["attributes"]>
  }>
}[TelemetryEventName]

export function isTelemetryEventName(name: string): name is TelemetryEventName {
  return Object.hasOwn(telemetryEvents, name)
}
