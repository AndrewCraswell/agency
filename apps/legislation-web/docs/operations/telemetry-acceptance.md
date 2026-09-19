# Telemetry reporting and acceptance

Proposed September 18, 2026. Implements the [telemetry specification](../engineering/telemetry-spec.md) and
[coverage catalog](../engineering/telemetry-events.md). Targets below are initial engineering proposals, not measured
baselines, contractual SLOs or claims about the current Sentry plan.
The [conversation and composer contract](../engineering/conversation-telemetry.md) adds its detailed funnel, latency
waterfall, reference-use, clarification and recovery dashboard plus interaction-level acceptance cases.
The [tool execution contract](../engineering/tool-execution-telemetry.md) adds per-tool latency/outcome/size views,
parallel critical-path analysis, retry accounting and executable performance scenarios.

## Product measures

All reports show environment, release, reporting window, eligible population, sample policy, collection gaps and
denominator. Exclude synthetic/internal/test traffic using an explicit server-controlled cohort; browser declarations
are advisory only. Identify known crawlers conservatively, label unknown traffic and never claim perfect bot removal.
Consent-filtered browser usage is an observed cohort, not every visitor.
Exclude illustrative homepage answers and evidence from live research activation; report their engagement separately.

| Question | Definition | Limitation |
| --- | --- | --- |
| What is being used? | Counts of visible route entries, intentional feature actions and authoritative completions by fixed surface/action | Distinguish views, initiations, attempts and completions; do not sum browser and server observations as one count |
| Are visitors reaching value? | Sessions with a completed substantive answer rendered / sessions with a conversation submission, within 30 minutes of first submission | Also report clarification, partial, cancelled, exhausted, failed and unknown; this is perceived completion, not evaluated correctness |
| Are users checking evidence? | Sessions with a citation/source opened after a rendered answer / sessions with a rendered cited answer, within the same 30-minute window | Opening is not reading, agreement or verification |
| Does search help? | Successful zero-result searches / successful searches; result-selection rate for displayed result sets; reformulation frequency | No query text; cancellation and failure are not zero results; result click is not relevance proof |
| How many active users? | Distinct approved authenticated pseudonyms with a meaningful action per UTC day and trailing 7/30 days | No stable ID approval means session counts only, not DAU/WAU/MAU; distinguish authenticated from anonymous |
| Do researchers return? | Users with another meaningful action in days 7-13 or 30-36 after first observed meaningful action / eligible first-action cohort with a fully elapsed window | Requires retained, unsampled, deduplicated identity-bearing events; first observed is not necessarily first-ever use |
| Where does a journey stop? | Ordered, same-session home view -> conversation submission -> answer rendered -> evidence opened, within 30 minutes; report direct entries separately | Missing next event means "not observed", not deliberate abandonment; background tabs and blocking can cause loss |
| Are future paid workflows useful? | Issue reuse, reviewed brief output, follow-to-reviewed-update and authorized team review, when those workflows ship | Define denominators from actual eligible users/workspaces; do not graph unshipped features as zero adoption |

A meaningful action is conversation submission, a committed search, evidence opening or a successful supported save,
follow or output action; passive page views and heartbeats do not qualify. Feature reports use the catalog's owning
event, not every underlying request. UI filter changes before submission do not count as searches.

Use Sentry metrics for aggregate counts/ratios and distributions. Use retained event logs with approved pseudonyms for
distinct users and ordered funnels only after demonstrating the account's query capabilities. Never estimate unique
users by summing counters or derive user-level retention from sampled traces. If the required join/cohort query is not
supported, mark that report blocked and obtain an approved analytics/reporting decision; do not label a simple ratio
a conversion funnel. Store reproducible queries and report definitions alongside the implementation.

## Performance and reliability measures

Use client monotonic timings for visible UX and server monotonic timings for execution. Split by route/operation and
coarse device class where relevant; show p50/p75/p95/p99 and sample counts, not just averages.

| Measure | Boundary and population | Initial target |
| --- | --- | --- |
| Core Web Vitals | Native LCP, INP and CLS for eligible browser page visits; retain vital ID/final update semantics | p75 LCP <=2.5 s, INP <=200 ms, CLS <=0.1, separately for mobile and desktop |
| Route ready | Committed navigation intent -> meaningful destination content/error state rendered; hard loads and soft navigation separate | p75 <=1.5 s warm soft navigation, <=3 s cold page content; errors are not successful ready content |
| API transport availability | Valid authorized W business requests without unexpected 5xx/application failure/server timeout / all valid authorized W business requests | >=99.5% over 28 days; client validation/auth denials excluded and separately charted |
| Known-record retrieval | Authorized request entry -> canonical record response ready, including pool wait | p95 <=2 s, consistent with the product's service-boundary target |
| Search | Committed browser search -> current results/error rendered; separately measure server execution | p95 <=3 s visible results for non-generative searches; segmented by search mode/cache state |
| Chat feedback | Submit accepted locally -> visible progress indication | p95 <=250 ms, even while dependencies are slow |
| First answer content | Submit -> first substantive answer text rendered, excluding status, reasoning and tool-progress text | p95 <=10 s; clarification measured separately; missing first content is not zero latency |
| Chat completion | Server-accepted turns -> valid terminal outcome; successful-answer latency measured separately from failure/cancellation | Initial p95 answer completion <=60 s; baseline complex tool-heavy tasks separately before enforcing |
| Stream delivery | Inter-chunk gaps while a nonterminal stream is expected; browser render backlog and total bytes | Count gaps >15 s as stalled observations, not proof of timeout; explicit server deadline defines timeout |
| Dependency health | Pool acquire, DB/search/model/auth/provider duration, retries, timeouts, cache hit/miss and result size | Baseline per operation/provider; warn on >2x comparable 7-day p95 with sufficient samples |
| Browser stability | Measured sessions without an unhandled JS/render failure / measured sessions | >=99.5% over 28 days; show collection coverage and separate handled recoverable failures |

Unsupported Web Vitals/browser APIs are `not_measured`, never synthetic zeros. LCP/CLS describe browser page lifecycles,
not every SPA transition; use route-ready spans for soft navigation. Define vitals finalization/update handling once so
multiple callbacks do not inflate the population. No first-content percentile should hide the fraction of turns that
never produced content.

HTTP 200 for chat is only an accepted stream. Report terminal conversation outcomes and stalled/unknown streams
alongside transport availability. An explicit user Stop is cancellation; a disconnected client alone does not prove it.
Expected 404/empty/coverage gaps are separate from unavailable services. A missing canonical record that the current
product contract promises to serve is a distinct correctness/degraded-data failure, not automatically an ordinary 404.
Rate-limit denial has its own rate and reason, including intentional customer limits versus service overload.

## Dashboards and alerts

| Dashboard | Required panels | Owner |
| --- | --- | --- |
| Product usage | Observed sessions, feature initiation/completion, activation, evidence use, search zero results, qualified funnels/retention | Product |
| Experience | Web Vitals, route readiness, chat first content/completion, stalls, render failures, desktop/mobile breakdowns | Web |
| Conversation and composer | Draft-to-send, blocked submits, reference use, acknowledgement/first-content/render waterfall, clarification, Stop/retry recovery and evidence engagement | Web/research |
| API and dependencies | Traffic, server error/timeout rate, status classes, pool/query/search/provider latency, cache behavior, retries | Platform/on-call |
| AI and research quality | Turn outcomes, tool outcomes, token usage, provider-reported cost when present, missing-usage rate, citation availability and linked Langfuse evaluation results | Research |
| Tool execution | Per-tool call volume, p95/p99 stage latency, retries, result limits, concurrency, pending calls and critical-path contribution | Research/platform |
| Collection health and cost | Ingest by signal, drops/rate limits, sampled fraction, schema rejection, canary age, SDK overhead, retention and quota utilization | Platform |
| Release comparison | Same-route/device/cohort baseline versus release candidate, errors and latency regressions, volume/sample changes | Release owner |

No empty chart is labeled healthy without traffic and telemetry-health evidence. Evaluation scores must show dataset,
model/prompt version and sample size; citation presence is not citation correctness. Keep estimates separate from
provider-reported cost, and unknown cost/usage absent rather than zero.

Initial alert policy, subject to on-call approval:

- **Page:** unexpected business-request failures >=5% for 5 minutes with >=100 eligible requests, or independent
  readiness probes fail three consecutive one-minute checks. Exclude routine probes from product-use counts.
- **Page:** service-deadline timeouts/failed terminal chat executions >=10% of accepted turns whose deadlines have
  elapsed, for 10 minutes with >=30 turns. User cancellation is excluded; unknown terminal outcomes remain visible.
- **Ticket:** p95 latency exceeds its approved target for 30 minutes with >=100 measurements, or the comparable
  release cohort is >20% slower with >=200 measurements in both cohorts. Small samples show insufficient data.
- **Ticket:** telemetry canary missing for 10 minutes, drop/rejection rate >1% for 15 minutes with >=100 emissions,
  or projected monthly spend/volume exceeds 80% of the approved budget.
- **Privacy incident:** any confirmed prohibited content in an exported payload stops the affected signal immediately
  and invokes incident/deletion handling. Do not resend the payload to another diagnostic system.

Each alert needs an owning team, deduplication key, runbook, safe release/trace links, recovery threshold and a tested
notification destination. Suppress repeated pages for one dependency incident; alert text must contain no research or
identity data. Use an independent monitor for collector failure rather than trusting Sentry to report its own outage.

## Sampling, costs and overhead

Initial proposal for an approved production pilot:

| Signal | Collection policy |
| --- | --- |
| Unexpected errors | 100% locally eligible, filtered and storm-protected; show server-side quota/rate-limit losses |
| Core outcome metrics | Unsampled application emission, independent of trace decisions; sampled diagnostic detail never supplies a billing denominator |
| Semantic usage logs | Unsampled within the opted-in pilot cohort; disable whole optional cohorts at a documented boundary if budget is insufficient, not random funnel steps |
| Other diagnostic logs | Warn/error plus bounded operation summaries; debug/trace disabled in production |
| Traces | 10% root sampling, consistent parent decisions on trusted internal traffic, bounded local override; exclude routine health/static asset noise |
| Web Vitals | One finalized measurement per eligible page/vital; emit without trace sampling; consent policy still applies |
| Replay | Off initially; after privacy acceptance, at most 1% of consenting sessions and 10% error-buffer sessions |
| Local/test environments | No external collection by default; explicit synthetic validation cohort uses full sampling in a nonproduction project |

Head sampling cannot recover a discarded successful/slow/error trace later. Errors can be captured independently;
missing linked traces are expected and must be labeled. Raising sampling for a canary is time-bounded and must not
override consent. Keep vendor-default log/AI/replay integrations explicit so an SDK upgrade cannot expand collection.

Before rollout, measure a representative day: metric records, log bytes, sampled traces/spans, replay minutes, eligible
sessions and per-session egress. Forecast monthly use as daily measured volume times 30 times expected traffic growth,
then price each signal using the actual account contract. Include logs+metrics duplication, Langfuse and headroom.
Privacy and platform owners approve a currency budget and per-signal quotas; none are presumed here.

Overhead acceptance against telemetry-off baseline on the same build/device/network:

- No synchronous telemetry network wait on an interaction or server response path.
- <=5% regression in p75 navigation and interaction latency and p95 API latency across repeated controlled runs.
- <=30 KiB additional compressed initial-route JavaScript beyond the existing Sentry baseline; load optional replay
  after consent and outside the critical path.
- <=100 KiB extra telemetry egress in a scripted five-minute research session, excluding separately measured replay.
- Bounded SDK buffers/retries during ten minutes of blocked ingestion; no steadily growing heap, persistent offline
  queue or application failure. Record actual buffer limits and flush timeout in implementation configuration.

If a budget fails, reduce payloads/sampling or defer the signal; do not silently weaken privacy or correctness.

## Rollout and acceptance

| Gate | Deliverable and evidence |
| --- | --- |
| 1. Approve collection | Named owners, field catalog, consent/identity/retention policy, region/plan capabilities, query feasibility and cost ceiling |
| 2. Wire foundations | One provider per runtime, destination-filtered Sentry/Langfuse exports, browser-to-server correlation, concurrent-request isolation and safe failure handling |
| 3. Cover current surfaces | Every shipped catalog row mapped to its producer, meaningful actions, terminal states, metrics, query and verification evidence; API-only routes explicitly included |
| 4. Validate reports | Synthetic known-count dataset proves deduplication, metric denominators, percentiles, consent cohorts and proposed funnel/retention queries; expected values documented |
| 5. Production canary | Authorized internal cohort first, then 10% of eligible consenting usage sessions for seven days; operational coverage governed separately; show actual ingest, privacy and cost evidence |
| 6. Expand and maintain | Expand only with approval and all gates met; remaining shipped surfaces cannot be marked complete until their rows pass; review catalog on each feature change |

Implementation tests cover executable event contracts and emitters, not this prose:

- Component/unit coverage for one event per action, rerender/Strict Mode, cancellation, retries, duplicate terminals,
  stale search results, unknown outcomes, unsupported timings and payload bounds.
- Integration coverage for browser/server trace continuity, concurrent actors, server/edge boundaries, each vendor
  independently unavailable, exporter filtering, provider sampling and shutdown flushing.
- Inject canary credentials, email/address, prompt text, URLs and SQL values into every relevant channel; inspect
  captured envelopes before transport and the approved synthetic vendor records. No prohibited value may survive.
- Test consent not granted, granted and withdrawn; sign-in/sign-out/account switch; no identity cross-contamination or
  replay buffering before permission.
- Exercise the full customer journey in the integrated browser at desktop/mobile sizes and with keyboard navigation:
  submit, stream, inspect citations, search, retry/Stop, export, auth/re-auth and supported API flows. Inspect accessible
  names if consent/settings copy is introduced. Fluent review applies to new customer-facing strings when available.
- Block telemetry hosts, simulate vendor 429/offline/unload, drop terminal events and trigger a late stream failure;
  product behavior stays intact and collection loss is visible through bounded independent diagnostics.
- Verify source-mapped stack traces against the deployed release without publishing source maps as public assets.
  Trigger and resolve each alert with synthetic data; record notification and recovery evidence.

After a coherent implementation, run focused tests and the repository's `pnpm verify` gate. Passing tests without
browser acceptance, received vendor payloads and dashboard/alert evidence is not full telemetry acceptance. Do not
create executable validators or test suites for these documentation tables.

Provide independent switches for optional usage, tracing, logs and replay. A privacy failure disables its signal
immediately; a performance/cost regression rolls back the affected configuration or build. Never disable error
reporting accidentally when turning off usage. Rollback preserves the product and existing authorized Langfuse policy,
does not migrate prototype telemetry, and records the resulting reporting gap.
