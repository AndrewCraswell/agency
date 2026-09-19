# Tool and model diagnostics

LEG-44 identifies which tool/model call failed or consumed time. Reuse the existing
[research wrapper](../../src/modules/conversations/research.ts),
[canonical measurement](../../src/modules/conversations/researchMeasurement.ts) and Langfuse observations.
Do not build a second measurement schema or model-cost accounting system.

## Measurements

| Field | Meaning |
| --- | --- |
| `durationMs` | Whole wrapper invocation, including validation and result preparation |
| `dependencyDurationMs` | Observed dependency invocation, not necessarily pure SQL/network time |
| `rawResultBytes` | Prepared structured-content bytes, not original network transfer bytes |
| `enrichedResultBytes` | Enriched projection JSON bytes |
| `modelResultBytes` | Serialized model-facing output bytes, not tokens |
| `resultCount`, `hasNextPage` | Known result/continuation information; absent/null is not zero/false |
| `outcome`, `failureCode` | Existing wrapper success/error and normalized failure classification |
| Retry fields | Preserve the existing single wrapper attempt and unknown internal retries; do not guess |

[Tool diagnostics](../../src/modules/conversations/toolTelemetry.ts) reuse an active AI SDK tool invocation span.
If that integration is disabled, they create an ordinary invocation span instead. No duplicate child-stage profiling
tree is added. Native dependency spans and existing analytics observations remain independently owned.

Sentry receives a safe projection of the canonical measurement with an opaque invocation ID and a fixed failure
stage (validation, dependency, enrichment or serialization). This is a stage label, not fabricated stage timing.
An existing `ResearchFailure` retains its normalized reason and reference. Pre-wrapper invalid/unknown-tool failures
continue through the existing failure reporter. Clarification remains a control tool, not a data retrieval.

Useful normalized reasons include `precondition_failed`, `result_limit`, `invalid_request`, `invalid_cursor`,
`timeout`, `dependency_unavailable`, `not_found`, `forbidden`, `invalid_response`, `step_limit`, `interrupted`
and `internal`. `interrupted` is not proof of explicit user cancellation; inspect the request/run outcome.

## Privacy and interpretation

Never export arguments, result content, SQL, evidence, access keys or raw provider call IDs to Sentry.
Ordinary tool traces and bounded breadcrumbs are diagnostic observations, not exact billing or execution counters.
An empty result is not automatically a failure, and successful dependency work does not guarantee successful output
preparation. Do not sum parallel tool durations and call that answer delay.

Use Langfuse's existing model/provider, latency, token and reported-cost observations. Missing usage remains unknown;
bytes/chunks are not tokens. Do not charge a model call to every selected tool or add cost estimates to fill gaps.

## Verification and non-goals

Focused tests verify span reuse, safe measured attributes and representative wrapper failures. Existing tool tests
remain responsible for execution, limits and retry behavior. A telemetry publication failure must not change tool
execution or results.

Computed critical paths, overlap/concurrency summaries, argument fingerprints, every-stage timers, bespoke cost
dashboards and controlled parallelism benchmark campaigns are outside the prototype scope.
Use the [debugging workflow](../operations/telemetry-debugging.md) and
[acceptance checklist](../operations/telemetry-acceptance.md).
