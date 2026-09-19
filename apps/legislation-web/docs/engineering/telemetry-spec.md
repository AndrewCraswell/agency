# Web application telemetry specification

Status: proposed implementation contract, September 18, 2026. Scope: Rostra's `legislation-web` browser, Next.js
server/edge runtimes, HTTP API and their dependency boundaries. This document does not enable collection, approve a
vendor plan or claim production coverage. "Full coverage" means every shipped workflow has usage, outcome,
performance and failure visibility, not recording every click or collecting research content.

Companion contracts: [event and coverage catalog](telemetry-events.md) and
[dashboards, budgets and acceptance](../operations/telemetry-acceptance.md).
The [conversation and composer contract](conversation-telemetry.md) defines detailed draft/reference interactions,
turn correlation, streaming/render milestones, clarification and recovery without collecting private text.
The [tool execution contract](tool-execution-telemetry.md) owns per-call outcomes, stage timing, retries, parallelism,
result budgets and tool/model cost attribution.
The [runtime ownership design](telemetry-runtime-design.md) resolves pinned-SDK provider initialization,
sink-independent sampling and export isolation, with local feasibility evidence.
The [product specification](../product/product-spec.md) continues to own product scope. Telemetry must not ship a
planned product feature merely to fill a dashboard.

## Goals and boundaries

- Measure discovery, activation, meaningful feature use, successful research and repeat use.
- Explain slow or unsuccessful journeys from browser navigation through API, retrieval and model execution.
- Detect availability, dependency, streaming, rendering and evidence-availability regressions by release.
- Connect a customer-visible failure to a safe diagnostic trail without reproducing private research in Sentry.
- Make collection loss, sampling bias, instrumentation overhead and spend visible.

Sentry owns operational errors, traces, structured logs, application metrics and privacy-approved replay. Langfuse
continues to own model/retrieval observations and evaluations. Sentry records safe AI timing, usage and outcome
summaries, not a duplicate prompt/answer store. Platform resource telemetry and worker execution stay with their
existing owners. Propagate correlation at W's boundaries with MCP and jobs; instrument W's processing of those
requests, not the whole ingestion or MCP runtime in this project.

Sentry usage counts are not billing records, a security audit ledger, proof of delivery or evidence of research
correctness. Cohort/funnel reports require verified query and retention capabilities; do not add a product-analytics
vendor, warehouse, collector service or new dependency without a separate approved decision.

## Observed baseline

This is a source-code baseline, not a deployment audit.

| Surface | Current evidence | Required change |
| --- | --- | --- |
| Shared Sentry options | [Options](../../src/services/sentry/sentryOptions.ts) disable logs, traces and breadcrumbs; default integrations are empty | Explicit, runtime-specific integration, sampling and filtering policy |
| Browser | [Initialization](../../src/instrumentation-client.ts) retains GlobalHandlers and configures replay at 10% of production sessions and 100% on error; text/input/media masking is disabled | Audit actual envelopes and replace this with the privacy-gated replay policy below; a recording-event callback is not proof that DOM snapshots are safe |
| Node and edge | [Node](../../src/services/sentry/sentry.server.config.ts) and [edge](../../src/services/sentry/sentry.edge.config.ts) skip OpenTelemetry setup | Validate context isolation, propagation and span export instead of merely increasing the sample rate |
| Startup | [Instrumentation](../../src/instrumentation.ts) initializes conversation telemetry before Node Sentry and exports request-error capture | Establish one documented initialization owner per runtime |
| AI telemetry | [Conversation telemetry](../../src/modules/conversations/telemetry.ts) initializes [Langfuse's NodeSDK](../../src/services/langfuse/telemetry.ts) when credentials exist | Coexist with Sentry without two global providers, duplicate spans or exporting content to both destinations |
| Analytics operations | [Analytics telemetry](../../src/modules/legislation/analytics-telemetry.ts) creates Sentry spans and Langfuse observations with timing/row metadata | Preserve semantics, enable verified export and add outcome metrics independently of trace sampling |
| Diagnostic export | [Conversation export](../operations/conversation-export.md) distinguishes response outcomes, wrapper/dependency timings and unknown values | Reuse these meanings; do not infer success from composer readiness or export initiation |

The SDK is pinned to 10.73.0 in the [app manifest](../../package.json), which supports current logs and application
metrics. Account entitlements, actual ingest, retention, quota and available reporting features remain unverified.

## Signal and instrumentation architecture

| Signal | Purpose | Rules |
| --- | --- | --- |
| Error event | Actionable unexpected exception with safe stack/context | One capture owner; expected validation, authorization denial and explicit cancellation are classified outcomes, not exception spam |
| Structured event log | Semantic action or state transition | Static event name plus validated attributes; no blanket console capture, DOM autocapture or free-form messages |
| Counter | Aggregate activity/outcomes | One producer per canonical count; independent of trace sampling; best-effort delivery, never called an exact ledger |
| Distribution | Duration, size, count per operation | Named unit and measurement boundary; missing is absent, not zero |
| Gauge | Actual current process/resource state | Owner-scoped snapshots, not an increment/decrement approximation of fleet state |
| Trace/span | Causal timing and dependency diagnosis | Stable names, parentage, bounded attributes and approved propagation targets |
| Breadcrumb | Short local sequence attached to an error | Allowlisted semantic actions only; not the usage event store |
| Replay | Visual diagnosis | Optional, separately gated and masked; never required for usage or availability measurement |

### Runtime wiring

1. Put browser-safe event contracts, schemas and instrumentation helpers under the existing Sentry service boundary;
   use the installed Zod and established request context. Do not scatter raw SDK calls through components.
   Extend the existing application telemetry interface only where a shared application operation needs it.
2. Initialize browser, Node and edge independently. Restore only required integrations after auditing their default
   payloads: navigation/Web Vitals, request tracing, safe runtime errors and approved dependency instrumentation.
   `defaultIntegrations: []` means changing sampling alone is insufficient.
3. In Node, consolidate the existing OpenTelemetry owner with Sentry-required context, propagator, sampler and span
   processor plus the Langfuse processor. Initialization must work with either vendor disabled and during hot reload.
   A sampling/export matrix must preserve the approved Langfuse observation policy independently of Sentry's trace
   policy; do not accidentally drop all AI observations with a global 10% sampler. Filter content before each exporter,
   including child spans that bypass a parent's mask. No second global NodeSDK/provider.
4. Edge must use supported edge instrumentation; never load NodeSDK there. Verify edge error isolation and propagation
   separately. Validate the exact pinned SDK and Next.js integration before choosing new dependencies.
5. Use direct Sentry SDK transport for browser signals and server SDK transport for authoritative outcomes. Do not
   introduce an application telemetry endpoint by default. Browser events are untrusted; never accept them as proof
   of identity, payment, authorization, a completed write or a server SLI. The public DSN is not an authentication key.
6. Carry standard trace context only to allowlisted first-party/service origins. Never forward it to arbitrary source
   links, webhook destinations or model providers by default. Validate inbound context, bound baggage, and apply local
   sampling budgets rather than blindly honoring an external client's sampled flag.
7. Bridge browser interaction, request and existing conversation run/tool context using opaque correlation IDs.
   Sentry and Langfuse may use different trace IDs: store an explicit safe cross-reference when necessary rather than
   claiming their trace IDs are interchangeable. Async work gets a causal link and its own lifetime.
8. Instrument HTTP middleware/handler boundaries once, then service/dependency spans for database pool wait, query,
   search/rerank, model, auth and delivery-provider operations. Reuse SDK spans where correct; do not time the same
   dependency twice. A streamed HTTP 200 records transport acceptance, not a completed answer.

### Event contract and reliability

Every semantic event has `event_name`, integer `schema_version`, random `event_id`, UTC `occurred_at`, `environment`,
`release`, `runtime`, static `surface`, normalized `route_template` and `origin` (`browser` or `server`).
Operation events also carry an opaque `operation_id`, `attempt`, phase, and a catalog-approved outcome/reason.
Only applicable fields are sent. SDK receive time is retained for clock-skew diagnosis; durations use a monotonic clock
within one runtime, never subtraction of client and server timestamps.
Illustrative homepage content carries `content_mode=demo`; real research uses `live`. Reports exclude demo content from
research-success/activation measures. Server-controlled customer/internal/synthetic cohorts remain separate from
untrusted browser-provided classifications.

Optional restricted log/trace fields: telemetry session, request, trace and run IDs and an approved pseudonymous actor.
Conversation diagnostics may also use the approved opaque draft, turn, message and interaction IDs defined in the
[conversation contract](conversation-telemetry.md); none may contain or substitute for an access/session key.
No high-cardinality identifiers belong in metric attributes. Metric dimensions are individually allowlisted per name:
normally environment, release, runtime, route/operation, outcome and a small device class; model/provider only on AI
metrics. Do not attach every dimension everywhere. Cap at 1,000 observed dimension combinations per metric/environment
per day initially; retire/group dimensions when exceeded, without silently dropping core outcome counts.

Schemas reject unknown fields, cap each string at 128 characters and each event at 20 application attributes/4 KiB.
Metric records, including SDK-added attributes, must remain below Sentry's 2 KiB limit. Reject oversize payloads, do not
truncate an identifier into a different valid identity. Production drops invalid telemetry with a bounded local
diagnostic and an aggregate drop reason; development/tests fail loudly. Reporting the fault must not recurse into the
same broken emitter or display an application-success message.

Events emit from committed state/interaction boundaries, not React renders. Visibility events require an actual visible
surface; prefetch, Strict Mode, hydration, rerenders and virtualized remounts must not multiply them. Retries preserve
the logical operation ID with a new attempt; automatic retries are not new user intent. A server write succeeds only
after commit; a lost response is `unknown` to the browser and is reconciled against the original operation.

There is at most one terminal observation per attempt **per origin**. Browser delivery/render outcomes and server
execution outcomes remain separate. A completed answer survives a late transport error, which is a separate diagnostic.
De-duplicate repeated local terminal notifications; do not assume Sentry deduplicates arbitrary event IDs or metrics.
Transport retry reuses the event ID. Queries using logs de-duplicate by that ID where supported; metrics remain
approximate under loss/duplicates. SDK buffering is bounded and nonblocking, with no persistent offline research queue.
Use lifecycle-appropriate bounded flushes; never await ingestion on the user request path. Surface send failures,
rate limits, invalid schemas and queue drops through nonrecursive diagnostics and independent health monitoring.

## Privacy, identity and retention

Telemetry about legislative research can reveal political interests even when the underlying records are public.
Field allowlists are the primary defense; existing credential redactors are defense in depth, not content consent.

| Category | Default policy |
| --- | --- |
| Operational context | Route templates, fixed action names, outcome codes, coarse device class, durations and sizes |
| Research content | Never send prompt/search text, answers, citations/passages, issue/brief titles, selected record IDs, filter values, uploads or editor contents to Sentry |
| Secrets and identity | Never send access/session keys, auth headers/cookies, emails, names, raw user/org IDs, postal addresses, webhook URLs/secrets or token-bearing URLs |
| Network/database | No request/response bodies, raw query strings/fragments, SQL literals/bindings or unrestricted headers; use route templates and static query/operation names |
| Error surfaces | Scrub exception messages, causes, stack URLs, breadcrumb data, span descriptions, log attributes, replay metadata and SDK-added user/request fields before export |
| AI | Safe model/provider IDs, token counts, timing and outcome only; no reasoning or prompts/outputs in Sentry; existing Langfuse content policy requires separate access/retention review |

Separate essential operational collection from optional usage/replay under a privacy-owner-approved lawful basis and
regional consent policy. Until approved, optional usage and replay remain off. Do not start error-buffered replay before
consent. Honor applicable opt-out/GPC requirements; withdrawal stops optional emission/recording and clears queued
optional events and local identifiers. Sign-out/account or workspace switches clear context; no cross-user attribution.

Anonymous usage uses a random per-tab telemetry session, rotated after 30 minutes of inactivity, on sign-out or after
24 hours maximum. No fingerprinting, IP identity or cross-device stitching. Authenticated retention/unique-user reports
require a server-derived, environment-specific keyed pseudonym with approved purpose and retention; hashing an email
is not sufficient. Keys stay server-side. Do not retroactively link pre-consent or anonymous history at sign-in.
Workspace segmentation is off until an authorized workspace actually exists and its privacy/access policy is approved.

Replay remains disabled until text/input masking, media blocking, sensitive-container blocking, safe URL handling and
disabled body/header/console capture pass envelope inspection. Conversation, search, address, settings/secrets and
future issue/brief content need explicit blocking even when text masking is on. Replay is never an audit trail.

Proposed maximum vendor retention: replay 7 days, logs and traces 30 days, errors 90 days, anonymous aggregate metrics
90 days. Identity-bearing usage records may extend to 90 days only with approval for 30-day retention reporting.
Verify plan support, region, deletion support and access controls; shorter supported retention is acceptable with
documented reporting limitations. Unsupported required deletion/retention blocks that signal, not a best-effort promise.
Engineering/on-call gets operational access; product gets aggregate usage; content-bearing Langfuse and replay access
is separately restricted. Document subject deletion, incident cleanup, backups/vendor limitations and retention-key
rotation before collecting stable actor identifiers.

## Delivery ownership and decisions

Application platform owns initialization, contracts, correlation and collector health. Feature owners own catalog rows
and truthful outcomes. Product owns KPI definitions; privacy owns collection/identity/retention; on-call owns alerts.
Assign named owners in the implementation work items before rollout.

Approval gates: lawful basis/consent and identity policy; vendor region/retention/quotas and monthly budget; whether
Sentry can actually compute the requested funnels/cohorts; replay masking; and the shared OpenTelemetry sampling plan.
Defaults and thresholds in this specification are proposals, not contractual SLOs or authorization to purchase tools.

Implementation proceeds through privacy/runtime foundations, current-workflow coverage, dashboards/alerts and a
measured production canary. Future product workflows add their catalog rows when shipped. See
[acceptance and rollout](../operations/telemetry-acceptance.md) for gates and rollback.

## Vendor references

Reviewed September 18, 2026; recheck against the pinned SDK during implementation:
[logs](https://docs.sentry.io/platforms/javascript/guides/nextjs/logs/),
[metrics](https://docs.sentry.io/platforms/javascript/guides/nextjs/metrics/),
[custom OpenTelemetry](https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/custom-setup/),
[replay privacy](https://docs.sentry.io/platforms/javascript/guides/nextjs/session-replay/privacy/).
