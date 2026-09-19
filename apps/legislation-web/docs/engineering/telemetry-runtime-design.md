# Telemetry runtime ownership and sampling

Implementation design for LEG-25, September 18, 2026. This resolves the runtime design in the
[telemetry specification](telemetry-spec.md); it does not approve production collection, a new dependency or a budget.
Implement through the existing foundation tasks, with the full [acceptance gate](../operations/telemetry-acceptance.md).

## Pinned interfaces and current ownership

Reviewed installed public interfaces and implementation behavior for `@sentry/nextjs` / `@sentry/opentelemetry`
10.73.0, `@langfuse/otel` 5.11.1 and `@opentelemetry/sdk-node` 0.221.0. The installed SDK uses OpenTelemetry API 1.9.1
and trace-base 2.10.0. Recheck resolved versions when changing manifests; do not rely on an older integration example.

Today [Next instrumentation](../../src/instrumentation.ts) starts
[conversation telemetry](../../src/modules/conversations/telemetry.ts), whose
[Langfuse service](../../src/services/langfuse/telemetry.ts) owns a global NodeSDK, before initializing Sentry.
Node and edge Sentry skip their own OpenTelemetry setup. Replace this split ownership, rather than starting a second
provider or preserving parallel initialization paths.

The intended sole Node owner lives at the existing Sentry/service boundary and returns one flush/shutdown handle.
Langfuse constructs its processor/integration through that owner; its service no longer registers a global provider.
Conversation call sites consume the shared lifecycle instead of creating runtime infrastructure.

## Node startup and lifecycle

1. From Next's Node-only `register` branch, validate configuration and initialize the Sentry client with automatic
   provider setup skipped. Enable only audited integrations, not the full automatic AI/console/body collection set.
2. Construct the SDK-supported Sentry context manager, propagator, sampler and span processor. Use the supported
   `SentryContextManager` export with the pinned SDK; do not hand-roll async context or copy deprecated wrappers.
3. Construct the Langfuse processor only when configured and permitted. Register the existing AI SDK telemetry
   integration once. Keep media upload disabled and its existing content-policy mask explicitly configured.
4. Register exactly one NodeSDK with the composite sampling/processor policy below. Preserve required HTTP request
   isolation and fetch propagation instrumentation while avoiding duplicate auto/manual spans.
5. Validate Sentry's OpenTelemetry setup before serving requests. Import instrumented application/dependency modules
   after instrumentation; select one ESM-loader owner and do not register both Sentry and separate loader hooks.

Cache the initialization promise/handle at process scope so concurrent registration and hot reload reuse the same
owner. An incompatible configuration change requires an explicit restart, not another global provider or silent reuse
of stale settings. Detect a conflicting owner and report a bounded startup diagnostic.

Flush and shutdown are owned once, idempotent and bounded. Do not await vendor ingestion on the response/streaming
critical path. Flush both processors at supported post-response/process lifecycle boundaries; a missing vendor is
absent from the lifecycle, not a synthetic successful export. Errors, logs, metrics and optional replay remain
independently controlled.

## Independent sink sampling

Use OpenTelemetry's distinction between **recording** and **sampled for export**:

1. Ask the native `SentrySampler` for the Sentry decision, including its SDK-managed trace state. This preserves
   Sentry's parent decisions and propagation metadata; do not invent private Sentry trace-state fields.
2. When the approved Langfuse recording policy needs the trace and Sentry returns `NOT_RECORD`, retain that result's
   metadata but change the local recording decision to `RECORD`, not `RECORD_AND_SAMPLED`.
3. The original span remains unsampled for Sentry and outbound Sentry propagation. Its attributes/events can still be
   recorded locally for the separately approved Langfuse sink. Children repeat the same policy.
4. Forward normal start lifecycle to the Sentry processor for scope/parent bookkeeping, but forward an ended span to
   its exporter only if the **original** span context is sampled and Sentry is enabled.
5. Give Langfuse a detached public `ReadableSpan` snapshot at end, with a sink-local sampled context. This lets its
   internal batch processor export an eligible recording-only span. Preserve trace/span/parent identity; never change
   the original span's flags or inject the snapshot's context into a request. Omit unrelated Sentry-specific trace
   state from this export-only projection.

`SentrySampler` already wraps its result with the SDK's required metadata. If an implementation replaces that sampler
instead, use the public `wrapSamplingDecision` contract; do not discard propagation metadata.

Recording admission must cover the roots that can contain research observations, including server-rendered research
work and descendants of an unsampled incoming request. Langfuse's export predicate is not an admission sampler: a
dropped span cannot be recovered at export time. Keep the admission policy explicit and bounded; recording more than
Sentry exports has CPU/memory cost and must pass the overhead gate before production use.

| Sentry tracing | Langfuse recording | Local/provider behavior | Export behavior |
| --- | --- | --- | --- |
| Off | Off | No research span recording needed | Neither trace sink; independently enabled errors can still operate |
| On | Off | Native Sentry sampling | Only selected Sentry traces |
| Off or client disabled | On | Record admitted research-capable traces without setting the original sampled bit | Eligible Langfuse snapshots only |
| On | On | Record the union of approved sink populations; preserve original Sentry decision | Sentry-selected traces and independently eligible Langfuse observations |

Do not blindly trust incoming sampled flags to override local admission/budget policy. Apply the approved
first-party/service propagation allowlist at network boundaries. There is no new cross-vendor sampling header or
telemetry ingress endpoint in this design.

## Export isolation and content filtering

Langfuse 5.11.1 applies its mask **in place** to the ended span it receives. Passing the shared SDK span directly to
both processors makes masking order-dependent. The Langfuse end adapter must snapshot public attributes, nested
attribute arrays, events, links, status and timing fields; do not spread undocumented private SDK fields or mutate
the shared span. Resource and instrumentation metadata also require the approved safe projection.

Preserve the processor's start-time root classification. Its `shouldExportSpan` predicate can run at start and end,
so it must be side-effect-free and cannot require duration/end-only attributes. A supplied predicate replaces the
default filter: explicitly preserve the intended Langfuse/AI observation population and exclude unrelated HTTP/DB
content rather than assuming defaults are still applied.

Sentry's original spans receive only bounded approved attributes at the instrumentation boundary. Apply destination
allowlists again to complete transaction/span/error/log/metric payloads before transport, including child spans and
SDK-added request data. Never rely on Langfuse masking to make a Sentry payload safe.

For the initial Node implementation explicitly select `traceLifecycle: "static"` and `streamGenAiSpans: false`.
In 10.73.0, AI-span streaming defaults to enabled even with static transactions. Without disabling it, AI child
spans can leave through a separate envelope path; transaction-only filtering is not a complete privacy boundary.
Reconsider streaming only with separate privacy, sampling, buffering and envelope acceptance for every export path.
No automatic Sentry AI prompt/input/output capture is part of this design.

## Browser and edge

The browser owns one browser Sentry client, not NodeSDK. It uses approved navigation/vitals/errors and independently
gated usage/replay. Its propagated sampled decision remains meaningful even when Node records additional spans only
for Langfuse. A missing sampled browser parent is not a claim of complete front-to-back trace coverage.

The edge branch loads only the supported edge Sentry integration; never import NodeSDK, Node context managers or
Langfuse's Node processor there. Do not retain `skipOpenTelemetrySetup` without supplying the required supported edge
setup. Verify its isolation and parentage independently; the Node probe below is not evidence of edge acceptance.

## Dependencies and implementation gates

No dependency was added for this design. The installed transitive packages supply the probe interfaces. Production
imports must declare direct dependencies rather than relying on hoisting: assess `@sentry/opentelemetry`,
`@opentelemetry/api` and `@opentelemetry/sdk-trace-base` at versions compatible with the installed SDK graph.
Obtain the required dependency approval before changing manifests, and align Sentry package versions.

Foundation implementation must prove hot-reload/concurrent initialization, real Next request isolation, allowed
network propagation, arbitrary parent sampling, exporter failures, snapshot immutability, AI-envelope filtering,
bounded flush/heap behavior and overhead. Keep existing conversation telemetry tests' parentage, credential masking
and content-policy behavior, without assuming those tests already cover the new runtime.

## Local SDK feasibility evidence

Six isolated Node processes ran against the installed packages using **only in-memory transports/exporters**.
Each synthetic workload contained two concurrent isolated roots and one child per root. No application content,
credentials or telemetry were sent to a vendor, and no production configuration changed.

| Sentry client | Sentry rate | Langfuse | Sentry transactions | Langfuse spans |
| --- | --- | --- | ---: | ---: |
| Enabled | 0 | Enabled | 0 | 4 |
| Enabled | 1 | Enabled | 2 | 4 |
| Enabled | 0 | Disabled | 0 | 0 |
| Enabled | 1 | Disabled | 2 | 0 |
| Disabled | 0 | Enabled | 0 | 4 |
| Disabled | 0 | Disabled | 0 | 0 |

All six cases passed assertions for original sampling-flag preservation and concurrent Sentry scope isolation.
Langfuse-enabled cases also verified two separate trace IDs and correct root/child identity. This establishes SDK
feasibility of the sampling split, not application coverage, live ingest, arbitrary-rate statistics, consent acceptance,
loader correctness or production performance. Replace the temporary probe with co-located executable runtime tests
when implementing the foundation tasks; do not create validators for this document.

References: [Sentry custom OpenTelemetry](https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/custom-setup/)
and the installed Next.js instrumentation guide. The repository specifications remain the owning privacy and
deployment contracts.
