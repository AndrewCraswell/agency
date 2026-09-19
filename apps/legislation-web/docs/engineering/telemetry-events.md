# Telemetry event and coverage catalog

Proposed September 18, 2026. This is the coverage contract for the
[web telemetry specification](telemetry-spec.md), not an assertion that the events below already exist.
[Reporting and acceptance](../operations/telemetry-acceptance.md) defines consumers, denominators and rollout gates.
The [conversation and composer contract](conversation-telemetry.md) owns detailed draft/reference events, turn
correlation, clarification, streaming/render milestones, metrics and recovery scenarios; it extends this catalog.
The [tool execution contract](tool-execution-telemetry.md) extends the tool event/metric families with orchestration,
wrapper/dependency stages, retries and performance attribution.

## Current application coverage

Andrew Craswell is the confirmed accountable platform, web, research, product, privacy, on-call/alerts and budget
owner for this catalog. Platform owns HTTP/runtime boundaries; web owns browser intent/render observations; research
owns domain/tool/model outcomes; product owns report meanings; privacy owns permitted collection; on-call owns alerts.
This is role accountability, not automatic implementation assignment or accepted instrumentation evidence.

Source inventory as of September 18, 2026. Implemented code does not establish live deployment, enabled credentials,
data coverage or customer acceptance. The current browser is primarily home, conversation and contextual record
profiles; the HTTP API is substantially broader. Both are in scope.

| Surface and source | Required usage/outcome coverage | Performance and edge cases |
| --- | --- | --- |
| `/`: [landing](../../src/modules/homepage/components/HomepageLanding.tsx) | Visible entry, generated suggestion shown/selected, typed versus suggestion submission, reference addition/removal | Suggestion-generation latency/failure, fallback state, composer availability and navigation to the new conversation |
| Home examples: [proof](../../src/modules/homepage/components/HomepageProof.tsx) and [workflows](../../src/modules/homepage/components/HomepageWorkflows.tsx) | Example engagement, supported citation/evidence opening and copy actions tagged `content_mode=demo` | Panel readiness and failed rendering; never count demo engagement as a live research answer or activation |
| Home integrations/coverage: [connections](../../src/modules/homepage/components/HomepageConnections.tsx) | Client-example selection, MCP configuration copy, coverage section viewed and supported external-link activation | Clipboard success/denial; documentation use does not prove an external MCP connection; planned source rows do not establish available coverage |
| `/conversations/[conversationId]`: [workspace](../../src/modules/conversations/components/ChatWorkspace.tsx) | New/follow-up turn, in-memory reopen/development-only restore, clarification, Stop/retry, reference selection, evidence opening and local `/export` | Time to first content, stream gaps, composition/render failure, partial/exhausted/unknown outcomes, lost conversation access and export handoff; no production durable-history claim |
| `/records/[kind]/[recordId]`: [profile](../../src/modules/conversations/components/RecordProfile.tsx) | Open person/organization/material, load more, retry failed load, ask about record | Detail/continuation readiness, expired results, invalid kind, missing record and return to conversation; do not claim a full bill directory exists here |
| `/chat`: [multiplexed handler](../../src/app/chat/route.ts) | Separate `reference_search`, `record_inspection`, `result_pagination` and chat-turn operations on the same route | Authorization/validation, expired-result 410, conflict 409, unavailable 503, deadlines, prompt fetch, composition, stream/capture and research-memory persistence failures |
| Research/analytics APIs: [answers](../../src/app/api/research/answers/route.ts) and [analytics](../../src/app/api/analytics/route.ts) | Accepted operation and classified result, caller class, result/row count and truncation | End-to-end, auth, pool/query/model latency and timeout; legislative analytics is a product API, not this telemetry collector |
| Data API families under [API routes](../../src/app/api) | Bills, people, organizations, meetings, votes, amendments, documents, supporting materials, sessions, changes, records/resources, search and legal reads: request, batch/detail/list/pagination outcomes | Per-operation latency/size, exact-version availability, partial/unsupported coverage, validation, auth and dependency failure; legal capability remains gated by its own acceptance |
| Subscription/webhook API families under [API routes](../../src/app/api) | Authorized create/read/update/delete and supported verification/rotation/delivery-status operations via `monitoring` events | Committed versus rejected/unknown writes, idempotent recovery, provider acceptance versus delivery, secret-free diagnostics; do not imply a completed settings UI |
| `/health`, `/ready`, API root/catch-all and framework error/not-found paths | Operational request outcome, readiness state, unmatched-path count, request/render failures | Dependency readiness and bounded unknown-route grouping; no raw arbitrary path labels, no contribution to product activation |
| Identity and shared navigation boundaries | Route entry/return, availability gating, auth denial/session expiry and supported sign-in/sign-out/consent operations wherever exposed | Safe return, cleared user context, no late private response after expiry; future account/settings screens are not inferred from backend capability |

The `/chat` handler is outside `/api`; instrumentation restricted to `/api/*` is incomplete. Instrument server-rendered
suggestion generation and page failures as well as Route Handlers. Reference search and pagination are not new chat
turns. Local export does not call the model. Separate browser-customer, external MCP/API, service and synthetic traffic
so a burst of API requests cannot appear as browser adoption.

The source inventory groups API families rather than freezing an endpoint count. Implementation acceptance requires
every actual route/method to resolve to a registered operation or an explicit bounded not-found/operational category.
Future endpoints inherit the common request boundary and need their own domain outcomes when generic HTTP success
does not prove completion.

## Naming, ownership and outcomes

Use static names `domain.action` in structured logs. Never embed a URL, record ID, tool argument or customer text in
an event/span/metric name. Browser intent and server effect are different events; one does not substitute for the other.
The shared envelope and privacy rules are defined in the parent specification.

| Event family | Producer and exact trigger | Allowed additional measurements/context |
| --- | --- | --- |
| `page.viewed` | Browser: destination is committed and visible, once per navigation entry, excluding prefetch | Static page kind, entry class (direct/internal/external), hard/soft/back-forward navigation, coarse device class; no referring URL |
| `page.ready` | Browser: meaningful content, empty state or error state first rendered for that entry | Duration, readiness outcome; skeletons and a mounted shell alone are not ready |
| `navigation.failed` | Browser: observed route/chunk/load failure | Failure category and destination template; no raw failed URL |
| `suggestion.shown` / `suggestion.selected` | Browser: a generated suggestion set becomes visible / user deliberately selects one | Set correlation, count and ordinal bucket; never suggestion text; generation has a separate server dependency span |
| `research.reference_changed` | Browser: a mention/picker reference is explicitly added or removed | Add/remove, entity kind, mention/picker source and resulting count; no name, query text or record ID |
| `integration.instructions_used` | Browser: MCP client example selected or supported setup instructions activated | Fixed client/instruction/action enums; configuration copy outcome uses `output.finished`; no connection-success inference |
| `conversation.submitted` | Browser: deliberate send after local guards pass, not each keystroke or mention lookup | New/follow-up, draft origin, keyboard/button, character-count bucket and reference count; blocked intent uses `composer.submit_blocked` |
| `conversation.accepted` | Server: request authorized/validated and a run accepted | Logical operation/run correlation, attempt, fixed model/provider route; no session access key |
| `conversation.finished` | Server: run has a known terminal outcome | Outcome, explicit finish category, time to first answer content, total duration, tool count, known token/cost measurements |
| `conversation.rendered` | Browser: terminal answer/clarification/partial state actually rendered | Browser outcome, submit-to-first-content/completion, citation count, presentation/render failure count |
| `conversation.stop_requested` | Browser: user invokes Stop for the active run | Operation correlation; cancellation is confirmed separately from request intention |
| `conversation.retry_requested` | Browser: deliberate retry/regenerate of a supported operation | Retry kind and prior outcome; automatic transport/tool retry is not a user action |
| `research.tool_finished` | Server: one wrapper attempt settles | Fixed tool name, attempt, outcome, wrapper/dependency duration, returned count/bytes, continuation availability |
| `search.submitted` | Browser: committed/debounced search issued, excluding stale keystrokes/prefetch | Static search kind/mode, filter count, page action; no query or filter values |
| `search.finished` | Server: retrieval completes/fails for one attempt | Outcome, result count, continuation/truncation, cache state, duration; zero results is successful execution |
| `search.results_rendered` | Browser: latest matching result set or failure state is rendered | Result count, visible duration, outcome; stale/cancelled responses do not count as viewed |
| `search.result_selected` | Browser: deliberate activation of a displayed result | Entity kind, ordinal rank bucket, result-set correlation, input method; no selected record identity |
| `evidence.opened` | Browser: citation, record, passage, source link, comparison or supported tab explicitly opened | Entity/evidence kind, source class (official/internal), entry surface; no citation text or full source URL |
| `evidence.loaded` | Owning runtime: evidence retrieval or reader rendering settles, reported separately by origin | Outcome, available/empty/partial/unsupported/stale state, count, version count, latency |
| `output.requested` | Browser: explicit supported copy/export action | Output kind and owning surface; no content or file name |
| `output.finished` | Owning runtime: generation/copy/download handoff settles | Outcome and byte count; clipboard API success and download handoff do not prove user consumption or disk persistence |
| `account.action_requested` / `account.action_finished` | Browser intent / server-confirmed auth action, with a separate browser return/render outcome when applicable | Fixed action (sign-in/sign-out/reauth/consent), provider outcome, duration, safe return-route template |
| `settings.action_requested` / `settings.action_finished` | Browser intent / authorized committed supported settings change | Fixed setting/action, outcome and duration; no old/new values or integration secrets |
| `monitoring.action_requested` / `monitoring.action_finished` | Browser intent when UI exists / server-confirmed subscription or webhook operation | Fixed operation, channel, outcome, duration; no matched query, destination URL, key or record identity |
| `api.request_finished` | Server: handler settles once per HTTP request, including rejection/abort | Static operation/route/method, status class, auth mode, caller class, duration, request/response sizes if known |

`account`, `settings` and `monitoring` paired events are two literal names each, with finite registered action enums,
not arbitrary string interpolation. New action values require a catalog/schema change. New public workflows require
an explicit event owner before shipping. Do not manufacture events for disabled or planned UI.

For non-conversation operations, terminal outcomes are `succeeded`, `failed`, `cancelled`, `rejected` or `unknown`.
Use a separate domain state for empty/partial/stale/unsupported evidence. Fixed failure categories distinguish
validation, unauthenticated, forbidden, customer_limit, overload, not_found, dependency, timeout, network, render and
internal; do not send the raw exception message as a reason.

Conversation outcomes retain the [existing export semantics](../operations/conversation-export.md):
`completed`, `clarification`, `partial`, `cancelled`, `exhausted`, `failed`, `unknown`.
Composer `ready`, HTTP 200, tool success and any text on screen are not completion. Completion requires the existing
substantive-answer/terminal contract. A request for clarification is its own useful result, not a failed answer.
Only explicit output-length/step-limit evidence establishes exhaustion. A dropped terminal message is unknown,
not a guessed timeout/cancellation; a known completed answer is not overwritten by a late network exception.

## Cross-cutting coverage required everywhere

- Page shell/navigation: hard and soft loads, back/forward restore, mobile navigation, not-found, error boundaries,
  chunk/resource failures, hydration failures and offline/reconnection. Preserve existing focus and draft behavior.
- Interactions: measure important controls via semantic actions, including keyboard activation. Do not autocapture
  every click, scroll, pointer movement, editor change or DOM text; do not infer disability from assistive interactions.
- Lists/readers: pagination, load-more, sort/filter submission, empty/partial/unavailable states, stale responses,
  detail-to-list return and failed media/document loads. Count committed changes, not intermediate control edits.
- Mutations: intent, validation/rejection, accepted execution, committed result, retry/undo when actually supported,
  conflict, lost response and reconciliation. Telemetry must not itself retry a business mutation.
- Errors: own unexpected exceptions at one boundary; handled recovery emits a classified diagnostic without duplicate
  captures from component, handler and service. Distinguish source-data absence from service unavailability.
- API coverage: every shipped route has bounded request outcome and latency, including anonymous, session, token,
  external MCP and service callers. Count health/synthetic traffic separately. No new path may bypass instrumentation.
- Dependencies: database pool wait/query timeout, retrieval/reranking/cache, model generation/streaming, identity,
  notification and webhook-provider interactions where called by W. Include retries and circuit/rate-limit outcomes.
- Rendering: large tables/cards/document sections, ordered streamed presentation, render backlog and long tasks where
  supported. Browser memory/long-task APIs are optional capability-labelled diagnostics, not universal requirements.
- Data availability: partial/truncated/unsupported evidence and freshness only from actual source timestamps, measured
  separately from HTTP/cache freshness. Never assert corpus completeness from request success.

## Measurement dictionary

`rostra.` is the proposed application metric namespace. The registry gives every metric an owner, unit, dimensions
and exact emission site. These are minimum families; only supported operations may populate them.

| Metric | Type and unit | Owning measurement |
| --- | --- | --- |
| `rostra.page.view` | Count | Browser `page.viewed`; observed views, not unique users |
| `rostra.feature.action` | Count | One browser semantic action selected by the catalog; static feature/action enums |
| `rostra.operation.outcome` | Count | Server terminal logical-operation result, not each dependency attempt; domain/action/outcome |
| `rostra.api.request` | Count | Server HTTP request outcome; route/method/status class/caller class |
| `rostra.api.duration` | Distribution, millisecond | Request entry -> response/stream close; report stream acceptance separately |
| `rostra.route.ready` | Distribution, millisecond | Browser navigation -> meaningful rendered state; outcome and navigation kind |
| `rostra.web_vital.lcp` / `rostra.web_vital.inp` | Distribution, millisecond | Final eligible native Web Vital measurement |
| `rostra.web_vital.cls` | Distribution, none | Final eligible native CLS measurement |
| `rostra.search.duration` | Distribution, millisecond | Separate server execution and browser-visible result duration with origin dimension |
| `rostra.search.results` | Distribution, none | Result count per successful search; never zero for an error |
| `rostra.chat.first_content` / `rostra.chat.duration` | Distribution, millisecond | Separate browser-visible and server-execution measurements; terminal outcome |
| `rostra.chat.outcome` | Count | One terminal turn observation per origin, using the conversation outcome enum |
| `rostra.chat.stream_gap` | Distribution, millisecond | Gaps in a live nonterminal stream, not idle time after completion |
| `rostra.tool.duration` / `rostra.dependency.duration` | Distribution, millisecond | Wrapper and actual dependency attempt timings, with fixed operation names |
| `rostra.tool.outcome` | Count | Each wrapper attempt outcome; not a count of user actions |
| `rostra.result.bytes` | Distribution, byte | Actual serialized result projection at the named boundary; not estimated DB row size |
| `rostra.ai.tokens` | Count | Known provider-reported tokens by fixed input/output/cache kind; avoid counting cached tokens twice |
| `rostra.ai.cost` | Distribution, none | USD per reported invocation, with fixed `currency=USD` and reported/estimated source; unknown values omitted |
| `rostra.cache.lookup` | Count | Hit/miss/bypass/error per fixed cache class; no cache keys |
| `rostra.pool.connections` / `rostra.pool.waiting` | Gauge, none | Actual pool snapshots by process/pool class; never assume one process's gauge is the fleet total |
| `rostra.telemetry.dropped` | Count | Bounded nonrecursive diagnostic by signal/reason, backed by independent local/collector monitoring |

Parent run totals and child invocation usage must not both feed the same token/cost counter. Missing cost, token,
dependency duration or size measurements remain absent and have a separate availability count. Reuse existing tool
measurement semantics: wrapper duration includes wrapper work, dependency duration is not necessarily database time,
and hidden provider retries are not inferred. Record observed attempt counts only.

API requests, logical operations, chat outcomes and feature actions deliberately have different populations. Dashboards
must select the owning metric and must not add these families together. In-operation automatic retries increment
attempt diagnostics; the logical operation outcome is emitted only when that operation settles. If a durable
operation's terminal result cannot be observed, report unknown/reconciliation, not an invented success.

## Extending coverage with the product

The following are requirements **when shipped**, not evidence of existing UI:

| Product family | Required meaningful events/outcomes | Performance and correctness context |
| --- | --- | --- |
| Issues and findings | Create/reopen, scope change, include/exclude, save/annotate/remove, review and reuse | Save/read latency, conflict/recovery, counts only; no issue titles or political-interest labels |
| Briefs and reviewed output | Evidence selection, generation, review invalidation/review, copy/export | Time to ready/reviewed output; distinguish generated, reviewed and handed-off; no generated text |
| Updates and following | Follow/pause/resume/remove, inbox viewed, update opened, marked reviewed, preferences saved | Match/source availability and inbox latency; accepted/delivered/suppressed/failed/unknown per channel, not human review |
| Workspaces and collaboration | Authorized workspace switch, invite/accept, assignment, review/approval, share/revoke/offboard | Access denial/isolation, revision identity held only in restricted diagnostic context if approved |
| Address and representatives | Resolve, ambiguous/unsupported/provider-failed, remove and manual-discovery alternative | Resolve latency; no address, coordinates, district or precise location in telemetry |
| Billing and entitlements | Provider-backed checkout/portal intent, confirmed entitlement transition, rejection | Provider latency and safe plan tier only after policy approval; never infer payment from return navigation |
| Full evidence directories/readers | Bill/person/committee/meeting details, exact-version comparison and source material | Load/filter/pagination latency, missing/version-mismatch/partial state; no new hubs implied |
| Regulatory research | Supported code/edition/text/search navigation and retrieval | Coverage and exact edition availability; gated endpoints are not nationwide/current-law acceptance |

At implementation time, maintain a small coverage registry alongside executable event schemas. Each shipped surface
must name its source route/component/service, event/metric owners, supported states, dashboard query, privacy class and
acceptance evidence. Tests cover the emitters and generated runtime contract, not a prose inventory. Any intentional
coverage exception needs a named owner, reason and review date; it cannot be hidden behind "full coverage".
