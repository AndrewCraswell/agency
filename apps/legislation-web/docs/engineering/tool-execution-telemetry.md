# Conversation tool execution and performance telemetry

Proposed September 18, 2026. Extends the [conversation/composer contract](conversation-telemetry.md),
[event catalog](telemetry-events.md) and [shared collection policy](telemetry-spec.md). Tool telemetry must explain
what executed, what failed and what delayed the answer without exporting arguments, retrieved evidence or model text.

## Existing measurements and gaps

The [research wrapper](../../src/modules/conversations/research.ts) already measures tool execution and publishes the
[canonical measurement](../../src/modules/conversations/researchMeasurement.ts). The
[conversation export](../operations/conversation-export.md) retains measurements received by the browser.

| Existing field | Actual meaning to preserve |
| --- | --- |
| `runId`, `toolCallId`, `toolName` | Execution correlation and tool identity, not a user identity or metric label set |
| `durationMs` | Whole wrapper invocation, including validation, dependency and output preparation |
| `dependencyDurationMs` | Timed dependency invocation, not pure SQL/network time; null when not measured |
| `rawResultBytes` | Prepared structured-content bytes, not the original HTTP transfer or raw database rows |
| `enrichedResultBytes` | Enriched projection JSON bytes |
| `modelResultBytes` | Serialized model-facing text bytes including record links, not model tokens |
| `resultCount`, `hasNextPage` | Observed collection count/continuation state; unknown remains null |
| `outcome`, `failureCode` | Wrapper success/error and normalized [research failure](../../src/modules/conversations/researchFailure.ts) |
| `attemptCount`, `internalRetryCount`, `retryOfToolCallId` | Currently one wrapper attempt, unknown internal retry count and no known retry relationship |

Reuse and extend this measurement at its existing owner; do not introduce an alternative measurement schema for
Sentry, UI and export. Sentry receives a privacy-safe bounded projection, not the diagnostic export or its content.
Current measurement publication is not proof of Sentry ingestion or browser receipt. It also does not establish
per-stage timing, provider retry visibility or full execution coverage.

Instrument every actually registered tool, including conditional tools only when enabled, and control tools such as
clarification through their own lifecycle. The [label catalog](../../src/modules/conversations/researchTools.ts) is
not proof that every listed tool was advertised in a particular run. Record only a server-controlled toolset
configuration identifier plus tool count, and use the actual registration boundary to prevent uninstrumented tools.
Direct browser reference lookup/pagination remains a separate caller population even when it shares a service.

## Execution graph and milestones

The causal graph is conversation -> logical turn -> execution attempt -> model step -> tool invocation -> observed
dependency attempt. Browser rendering is a linked observation, not an extra server tool invocation. Retain opaque
turn/run/tool-call/step/span correlation in restricted logs/traces only; never include record IDs or session keys.
Provider IDs exceeding the shared field limit require a bounded opaque mapped ID, not truncation.

| Boundary | Measure and classify |
| --- | --- |
| Tool selected/requested | Model/orchestrator emits an identified call; distinguish unknown tool, invalid arguments and calls that never enter the wrapper |
| Dispatch wait | Request/enqueue -> wrapper start, only if both boundaries are observable; includes a queue only where one actually exists |
| Input/selection validation | Schema, authorization, exact-record/cursor selection, cancellation and call-budget checks |
| Dependency invocation | Database/search/model/web service call, with child pool/network/query spans when actually observed |
| Result processing | Response parsing/validation, result-store work, enrichment/evidence projection, presentation preparation and model serialization |
| Output limits | Raw/enriched/model-facing byte counts at their actual boundaries; identify the rejected stage and configured limit |
| Tool settled | Model-usable successful result or classified failure; empty/partial/paginated result distinguished from transport success |
| Model continuation | Result made available to the model and next generation started, when observable; not inferred from wrapper success |
| Browser delivery/render | Tool activity received and, where applicable, corresponding result rendered; separate from server/model availability |

Use one invocation span and child stage spans; avoid a second span for an SDK-instrumented dependency. Stage durations
use one local monotonic clock. If a dependency exposes no internal spans, label its time opaque; do not call the
wrapper-minus-dependency remainder "serialization time". Instrument serialization directly before assigning that name.
Queued/scheduled time is absent when dispatch is unobservable, never zero by default.

For parallel calls show the actual waterfall, maximum observed concurrency, wall-clock union of tool-active intervals
and accumulated tool work separately. Two overlapping two-second calls are roughly two seconds of wall time, not
four seconds of answer delay. Attribute the critical path only when causal joins are known; otherwise show overlap and
unknown dependency ordering. Whole-turn latency includes model thinking/generation, tools and browser presentation,
not just the sum of wrapper durations.

## Events, outcomes and retries

| Event | Producer and emission |
| --- | --- |
| `research.tool_requested` | Server orchestration boundary once a concrete tool call is identified; count requests rejected before wrapper entry too |
| `research.tool_started` | Server wrapper entry once per invocation; pending at turn close remains incomplete, not assumed failed |
| Existing `research.tool_finished` | Server terminal measurement once per invocation; feeds the canonical tool outcome/duration metrics |
| `research.tool_rejected` | Server rejects before wrapper entry; reason unknown_tool/schema/authorization/budget/cancelled as applicable, no duplicate wrapper-finished count |
| `research.tool_retry_scheduled` | Explicit retry policy actually schedules an observed retry; link original invocation, reason, backoff and retry layer |
| `research.tool_result_observed` | Browser receives the safe tool measurement/activity, or renders its result; phase distinguishes received/rendered |
| `research.run_summary` | Server attempt closes; bounded totals for requested/started/settled/pending tools, outcomes, measured work and metadata availability |

Do not emit per-token, per-row, per-argument or every SDK callback. A finished event carries only bounded identity,
outcome and summary measurements; detailed stage context belongs on spans so the shared event-size/attribute limits
still hold. Started/requested events can be sampled as diagnostic detail if canonical outcome counters remain
unsampled and reports disclose that pending-call reconstruction then requires a sampled trace.

Preserve normalized `not_processed`, `result_limit`, `invalid_request`, `invalid_cursor`, `timeout`,
`dependency_unavailable`, `not_found`, `forbidden`, `invalid_response`, `step_limit`, `interrupted`, `internal`.
Record failure stage separately. A dependency can succeed and output validation/serialization can fail; tool success
requires successful model-facing preparation. A payload rejection may retain attempted byte counts, never a claim of
delivered bytes or complete coverage. An empty result is not a failure; missing counts are not empty results.

Keep explicit user Stop, upstream abort, service deadline and unknown interruption separate where observable.
`interrupted` alone does not prove the user cancelled; only the turn's explicit cancellation evidence establishes it.
A rejected payload is not model exhaustion. A tool timeout need not mean the whole answer failed if recovery succeeds.

Each wrapper invocation currently has `attemptCount=1`. Do not populate internal retry counts by guessing from elapsed
time or repeated tool names. Extend canonical retry fields only when the actual retrying layer supplies the evidence.
Orchestrator retry, dependency retry and whole-turn regenerate are different layers. A new model call with similar
arguments is not automatically a retry; link only known relationships.

A stalled/pending tool may never emit a terminal event after process loss. The run summary/reconciliation records
pending/unknown and the last observed stage; do not manufacture a timeout without a known elapsed deadline.
Cancellation of sibling parallel calls may leave mixed successful/cancelled/unknown results.

## Required metrics and diagnostics

Reuse `rostra.tool.duration`, `rostra.tool.outcome`, `rostra.dependency.duration` and `rostra.result.bytes` from the
parent catalog; the following extend them. Millisecond distributions use monotonic observed durations.

| Metric | Type and owning population |
| --- | --- |
| `rostra.tool.requested` / `rostra.tool.rejected` | Counters for concrete orchestration requests / pre-wrapper rejections; not extra executed calls |
| `rostra.tool.dispatch_wait` | Distribution for observed dispatch waits only |
| `rostra.tool.stage_duration` | Distribution by fixed validation/dependency/enrichment/projection/serialization stage |
| `rostra.tool.retry` / `rostra.tool.retry_backoff` | Counter / ms distribution for observed retries, segmented by retry layer and reason |
| `rostra.tool.results` | Distribution of returned item counts; separate empty/partial/continuation and unknown metadata |
| `rostra.tool.calls_per_turn` | Distribution at attempt close, with requested/executed/settled count kind |
| `rostra.tool.concurrent_peak` | Distribution of observed peak concurrency per execution attempt |
| `rostra.tool.wall_time` | Distribution of union of tool-active intervals per attempt; not sum of durations |
| `rostra.tool.pending_at_close` | Distribution of requested or started calls with no observed terminal state |
| `rostra.tool.measurement_missing` | Counter by missing terminal/dependency/size/count/usage/browser-observation class, without substituting zero |

Tool name, fixed stage, outcome/reason, dependency class and release are bounded dimensions; run/call/step IDs,
arguments, SQL, query hashes, cursor values and external URLs are not. Approved model/provider dimensions belong on
generation metrics, not every tool metric.

Inspect model-input/output tokens, cached-token usage, provider cost and generation latency per model step, linked to
tool calls where available. Do not assign a whole model call's token cost to each tool it selected or treat returned
bytes as tokens. External service billing is a separate observed/estimated cost source, never inferred from SDK
success. Parent and child summaries must not double-count usage or cost.

For suspected loops, count repeated identical invocations only via a bounded, per-run, in-memory comparison of
validated inputs; export the count/boolean, not arguments or a reusable argument fingerprint. Mark repeated page
requests, explicit retry and deliberate re-read separately when observable. Repetition and a tool result not cited
are diagnostic candidates, not automatic waste or proof that the model ignored evidence.

## Performance dashboard and acceptance

Provide per-tool invocation volume, failure/empty/partial rates, p50/p95/p99 wrapper/dependency/stage durations,
result-size distributions, retry/backoff, pending calls and metadata-availability rates. Support safe drill-down from
an affected turn to its model/tool/dependency waterfall and browser render milestones.

Show slowest tool by p95, cumulative measured work and observed critical-path contribution as different rankings.
Compare release/model-route cohorts with minimum sample sizes from the
[shared alert policy](../operations/telemetry-acceptance.md). Known-record retrieval inherits the two-second
service-boundary target; other tools need measured per-tool budgets before paging on latency. Do not turn every slow
tool into an error or alter its execution timeout just to satisfy a telemetry threshold.

Acceptance requires:

1. Every tool advertised in a synthetic run resolves to the measurement boundary, including conditional and control
   tools; unknown/schema-invalid calls are accounted for before wrapper entry.
2. Test success, true zero results, paginated/truncated output, rejected cursor/identity, dependency error/timeout,
   cancellation before/during work, output-size rejection, invalid output and projection/serialization failure.
3. Two overlapping controlled two-second calls show about two seconds of wall time and four seconds of aggregate
   work; serial calls show about four seconds of both. Tolerances are explicit in the executable timing test.
4. Controlled retry records one logical invocation relationship and the correct layer's attempt/backoff counts;
   unobservable internal retries remain unknown. No parent/child duplicate token or tool counts.
5. A successful dependency with a failed model-facing projection reports tool failure, preserving attempted versus
   delivered sizes. A completed tool whose browser event is lost is not relabeled a failed server execution.
6. Missing terminal events and partial sibling cancellation remain pending/unknown with an explicit denominator.
   Streamed measurements, server summaries and browser export agree where the same invocation is observed.
7. Seed sensitive arguments, retrieved passages, provider error bodies and credentials; inspect safe Sentry
   projections and destination-specific exporters. Research content remains out of Sentry and replay.

These tests belong to executable instrumentation when implemented, not this prose. Use the shared telemetry-off
baseline and overhead budget; instrumentation must never duplicate tool execution, change selection/retry policy,
block streaming on ingestion or mutate model-facing results.
