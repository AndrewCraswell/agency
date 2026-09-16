# Product experience implementation backlog

## Current delivery focus

The [public chat launch backlog](public-chat.md) owns the first deployed Rostra conversation experience: custom-themed
AI Elements, streaming OpenRouter research, existing API/MCP access, Tavily search, Firecrawl source reading, inline
clarification and Railway release. It supersedes older demo assumptions about fixed question allowances, federal-only
coverage and waitlist enrollment. Waitlist implementation is deferred entirely.

The broader signed-in product below remains the parent roadmap, not a prerequisite for this first release. Use the
launch backlog's dependency and scope handoff before crediting these broader tasks; public chat delivery does not
establish account-owned history, issues, following or notifications. Conversation retention and public data eligibility
remain explicit launch decisions. General web research through the selected providers is now in launch scope.

## Scope and status

Prepared September 14, 2026; maintained against the [designer brief](../design/design.md),
[information architecture](../product/information-architecture.md), [conversation handoff](../design/conversations.md), and
[notification specification](../product/notification-experience.md). This is the execution backlog for the chat-first product,
including features, pages, persistence, integrations, and release acceptance. It does not create external tickets or
authorize production activation, external messages, or provider purchases.

Use [API acceptance](../operations/passage-search-delivery.md) for current release gates and recorded fixture acceptance.
Do not copy its historical Done states into this product backlog. The original September 14 source inspection found only the
foundation `src/app/page.tsx` and `src/app/layout.tsx` as product page/layout files, existing research-answer and subscription
services, and no Novu dependency in the app package. This is a source inventory, not a fresh deployed smoke result.
Reconcile the current acceptance record and remaining gates before reuse.

## How to execute and maintain this backlog

Every item below starts **Planned**, including verification and design-decision items. No product feature is marked Done.
Task IDs are stable; filenames describe responsibilities. Lead roles are suggestions, not assigned people. Effort and
dates remain unestimated until design and contract review; dependency order is not a calendar commitment.

Each row contains a deliverable, lead, prerequisites, and acceptance criteria. Dependencies are completion prerequisites
for the shipped item. Exploration and mocked design work may begin earlier. A dependency range means every ID in the
inclusive range; prerequisites are transitive. A slash between roles means joint work with the first role accountable.
Rows in each section are required for that capability unless explicitly listed in the deferred register.

When an item starts, append a progress entry under its workstream: ID, named owner, state, branch/PR, current blocker,
evidence links, and next action. Use Planned, Ready, In progress, Blocked, or Done. Ready requires prerequisites and an
agreed acceptance test; Blocked names the missing decision/data/provider. Done requires the row's evidence and the common
completion gate. Retain stable IDs when refining tasks; add new IDs rather than silently changing completed scope.

### Common completion gate

- Deliver the coherent artifact or implementation and update affected contracts/docs.
- Reuse existing domain handlers, authentication, source pipelines, and dependencies where verified. New libraries need
  discussion under repository guidance; provider setup/costs need their named decisions.
- Test executable behavior proportionately. Do not create tests or validators for narrative backlog tables.
- For UX, validate new copy with Fluent Agent MCP when available and record any unavailability; no dot glyph separators.
- Exercise the actual feature in the integrated browser on desktop/mobile, with keyboard, accessible names, incomplete
  data, error recovery, and authorization. Component tests alone do not satisfy UX acceptance.
- Run focused checks and `pnpm verify`. Record unrelated blockers without claiming a clean repository result.
- Integration/release tasks require target-environment evidence. Source code, empty lifecycle responses, and provider
  trigger acceptance alone do not prove populated data, generated notifications, or email delivery.

## Workstreams

The six workstreams contain 106 actionable items. Core feature work is required for its slice; release acceptance is
mandatory before public availability. The deferred register is lower priority and unscheduled. Within a slice, resolve
data, authorization and contract gates before polishing dependent UI; use the dependency graph to choose ready work.

| Workstream | Task range | Scope |
| --- | --- | --- |
| [Foundation and design](#foundation-and-design) | BASE-01 through BASE-15 | Design, WorkOS, authorization, app shell, shared infrastructure |
| [Conversation and research](#conversation-and-research) | CHAT-01 through CHAT-18 | History, context, model integration, citations, streaming, tool actions |
| [Legislative pages](#legislative-pages) | VIEW-01 through VIEW-22 | Search, bills/progress, representatives, committees, evidence |
| [Issue tracking and briefs](#issue-tracking-and-briefs) | ISSUE-01 through ISSUE-12 | Durable scope, exclusions, comparison, reviewed findings |
| [Following and notifications](#following-and-notifications) | ALERT-01 through ALERT-25 | Domain matching, Novu, preferences, inbox/email, webhooks |
| [Integrations and release](#integrations-and-release) | SHIP-01 through SHIP-14 | MCP UI, operational integrations, usability, release gates |

## Delivery sequence and exit gates

This sequence prioritizes complete user journeys. All six capabilities remain core scope; an early slice is not a claim
that the complete product has shipped. Novu planning and civic data reconciliation should start early because they can
block later UX. Foundation design review covers the whole experience before any slice's visual implementation.

| Slice | Required work | User-visible exit gate |
| --- | --- | --- |
| Foundation | BASE-01 through BASE-15 | Approved coherent prototype, authenticated shell, account isolation, shared evidence/navigation behavior |
| Read and research | CHAT-01 through CHAT-15; VIEW-01 through VIEW-11; VIEW-21 | Ask, find a bill, inspect progress and cited versions, compare text, and resume history |
| Civic research | VIEW-12 through VIEW-20; VIEW-22 | Identify representative/committee, understand votes and meetings, traverse attributed activity with coverage states |
| Durable issues | ISSUE-01 through ISSUE-09; ISSUE-11 | Create/resume issue, refine scope, compare evidence, copy reviewed brief without activating alerts implicitly |
| Follow and receive | ALERT-01 through ALERT-25; CHAT-16 through CHAT-18; ISSUE-10 and ISSUE-12 | Confirm a follow, produce real matched events, receive in-app/email, manage preferences and recover delivery failures |
| Pilot and release | SHIP-01 through SHIP-14 | Current connected ICP/evidence flows and external MCP setup verified; critical usability findings resolved; operational release evidence recorded |

Critical dependency paths:

- Existing data readiness -> verified read adapters -> cited research and record pages -> persona acceptance.
- Conversation contract -> persistence and authorized tools -> streamed responses -> safe confirmed mutations.
- Activity semantics -> source events -> matching -> durable delivery intents -> Novu dispatch -> inbox/preferences.
- Issue ownership/scope -> saved queries and exclusions -> matching behavior -> comparison and briefs.

## Page and surface coverage

Browser paths are the proposed IA paths, not assertions that routes exist. Contextual panes reuse standalone templates.

| Page or surface | Proposed route or entry | Implementation tasks |
| --- | --- | --- |
| Home/composer | `/` | BASE-09; CHAT-10 |
| Conversations list/detail | `/conversations`, `/conversations/{conversationId}` | CHAT-02, CHAT-11, CHAT-12 |
| Contextual evidence pane | Conversation result/citation | BASE-10; VIEW-21 |
| Search | `/search` | VIEW-01 through VIEW-03 |
| Bills directory/detail | `/bills`, `/bills/{billId}` | VIEW-04 through VIEW-07 |
| Document/section | `/documents/{documentId}`, nested section link | VIEW-08, VIEW-09 |
| Version comparison | `/compare?from={documentId}&to={documentId}` | VIEW-10 |
| Amendments/supporting materials | `/amendments/{amendmentId}`, `/supporting-materials/{materialId}` | VIEW-11, VIEW-20 |
| Representatives/profile | `/representatives`, `/people/{personId}` | VIEW-12 through VIEW-14 |
| Committees/profile | `/committees`, `/organizations/{organizationId}` | VIEW-15 through VIEW-17 |
| Vote detail | `/votes/{voteId}` | VIEW-18 |
| Meeting detail/agenda | `/meetings/{meetingId}` | VIEW-19 |
| Issues/list/detail/brief | `/issues`, `/issues/{issueId}`, contextual brief preview | ISSUE-03 through ISSUE-09 |
| Following/list/detail | `/following`, `/following/{subscriptionId}` | ALERT-13, ALERT-14 |
| Bell/Updates | Global bell, `/updates` | ALERT-17, ALERT-18 |
| Email/digest templates | External email opened by recipient | ALERT-20 |
| Account and sign-in | `/settings/account`, provider route | BASE-06 through BASE-08 |
| Notification settings | `/settings/notifications` | ALERT-15, ALERT-16 |
| Integration overview/MCP | `/settings/integrations`, `/settings/integrations/mcp` | SHIP-01, SHIP-02 |
| Webhook destinations | `/settings/integrations/webhooks` | ALERT-23 |

## Integration ownership

| Integration | Existing baseline to reuse or verify | Backlog owner |
| --- | --- | --- |
| Next.js and app HTTP services | Existing runtime and explicit API handlers | BASE-05, BASE-09, BASE-11 |
| WorkOS/AuthKit | Existing API token verification; browser lifecycle needs product proof | BASE-06 through BASE-08 |
| PostgreSQL/Drizzle | Canonical records and subscription storage | BASE-13; CHAT-02; ISSUE-02; ALERT-06 |
| Model gateway and retrieval | Existing OpenRouter/research service decisions; interactive limits need definition | CHAT-05 through CHAT-09; CHAT-14 |
| State/federal source pipelines | Existing ingestion and civic-data readiness records | BASE-12; VIEW-05, VIEW-14, VIEW-17; ALERT-03 |
| Novu | Selected in product scope; deployment not evidenced here | ALERT-08 through ALERT-12, ALERT-16 through ALERT-21 |
| Email provider and sender domain | Provider/destination readiness to establish | ALERT-09, ALERT-20 |
| Trigger.dev | Existing execution platform; delivery execution/recovery to reconcile | ALERT-07; SHIP-05 |
| App signed webhooks | Existing contract and lifecycle service | ALERT-22 through ALERT-24 |
| External MCP clients | Existing protected API-backed MCP source and release ledger | SHIP-01, SHIP-02 |
| Langfuse/operational telemetry | Existing observability integrations | CHAT-14; SHIP-03, SHIP-04 |
| Railway release environment | Existing unified application release program | SHIP-06, SHIP-13, SHIP-14 |
| Fluent content review | Use when available; absence is not validated copy | BASE-04; SHIP-10 |

## Deferred scope register

These are recorded for future decisions, not hidden requirements for completing the core backlog.

The [organization features proposal](../product/organization-features.md) records the next organization layer, including its
placement in the existing design. It does not mark these deferred capabilities implemented or add them to the current
personal-experience completion gate.

| Candidate | Decision needed before scheduling |
| --- | --- |
| Team/client workspaces and shared portfolios | Roles, isolation, sharing, named recipients, organization ownership and cost |
| Organization-wide distribution and assignments | Recipient consent, access removal, review authority and task ownership |
| Address lookup | Activated provider, supported geography, privacy/retention and real identity canary |
| Weekly/custom digests and quiet hours | Public timing contract, timezone behavior, queued-message changes |
| SMS, push, chat channels | Provider costs, consent, destination verification and delivery promises |
| File exports and immutable research archives | Formats, version retention, citation preservation and retention policy |
| Public conversation sharing | Explicit sharing/revocation model and disclosure review |
| Additional web providers and visitor-supplied MCP sources | Tavily Search and Firecrawl Scrape are covered by the [public chat launch](public-chat.md). Additional providers and arbitrary external servers still require source permissions, credential custody, trust-boundary and citation review. |
| Courts, regulations, legal deadlines, compliance determinations | Regulations have a separate [implementation specification](../../../legislation-ingestion/docs/regulations/implementation.md) and [technical phase backlog](../../../legislation-ingestion/docs/regulations/implementation-backlog.md); this does not add them to the current product completion gate. Other capabilities still require scoped coverage and interpretation requirements. |
| Campaign/contact tools and external messaging | Consent, recipient verification, communications authorization and operational workflow |
| Billing and paid plans | Entitlements, pricing decision, payment integration and account lifecycle |

## Initial readying queue

Begin with BASE-01 (source/readiness reconciliation), BASE-02 (design package), and BASE-03 (contract decisions).
Then establish acceptance fixtures (BASE-04), auth/ownership (BASE-06 through BASE-08), and canonical read access
(BASE-05). Prepare CHAT-01, ISSUE-01, ALERT-01, and ALERT-08 as their prerequisites complete. Do not start by building
all page shells with placeholder data and counting them as finished features.

<a id="foundation-and-design"></a>

<a id="foundation-and-design--foundation-and-design-backlog"></a>

## Foundation and design backlog

All items Planned. Leads: Product, Design, Frontend, Backend, Data,
Platform, and QA are role placeholders. BASE items apply across every workstream. Brief reference: sections 1–4 and 11–15.

| ID | Deliverable | Lead | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- |
| BASE-01 | Reconcile implementation and data readiness | Backend/Data | None | Inventory existing handlers, browser pages and deployed evidence; map each planned flow to populated fixtures or a named missing-data gate; no historical state treated as fresh smoke. |
| BASE-02 | Complete designer package and scope review | Design/Product | None | Sitemap, desktop/mobile prototype, components, email designs and current ICP/evidence paths reviewed against owning handoffs; record scope decisions. |
| BASE-03 | Resolve shared product contracts | Product/Backend | BASE-01 | Decide personal ownership, history/issue deletion and retention, research limits, preference ownership, stage mapping authority and per-feature rollout flags; list remaining provider decisions with owners. |
| BASE-04 | Prepare representative fixtures and copy review | Design/QA | BASE-01, BASE-02 | Coherent bill/person/committee/meeting/version fixtures plus missing data, reschedule and procedural-vote examples; distinguish illustrative from real; review product strings with Fluent when available. |
| BASE-05 | Build verified canonical read boundary | Backend | BASE-01 | Reuse existing HTTP/application services; typed error, pagination, source and identity projection; verify nonempty records and private caching; no alternate domain logic in components. |
| BASE-06 | Complete AuthKit browser lifecycle | Backend/Frontend | BASE-03 | Sign-in, callback, expiry, refresh and sign-out work in target app; safe return destinations; no user token printed or embedded in links; session canary distinct from machine token smoke. |
| BASE-07 | Enforce private ownership and account isolation | Backend | BASE-03, BASE-06 | Server derives identity for every read/write; reject cross-user/account conversation, issue, subscription and inbox access; membership removal and account switch invalidate cached private data. |
| BASE-08 | Integrate account and authentication recovery | Frontend | BASE-06, BASE-07 | Account identity/sign-out and safe return work within existing authentication flows; no standalone lifecycle screens, automatic mutation replay or implied team roles; recover only permitted drafts. |
| BASE-09 | Build responsive application shell | Frontend | BASE-02, BASE-06 | Chat-first home; Conversations, Updates, Issues, Following, secondary Explore and Settings; navigation states work at wide, medium and narrow sizes. |
| BASE-10 | Implement evidence navigation and deep links | Frontend | BASE-05, BASE-09 | Context pane and standalone record share identity; Back, close and expand preserve state/focus; copied record link omits private conversation context. |
| BASE-11 | Build shared API client states | Frontend/Backend | BASE-05, BASE-06 | Typed errors, cancellation, pagination, stale-result prevention, retry policy and correlation IDs; unknown mutation outcomes never trigger automatic duplicate writes. |
| BASE-12 | Expose coverage and freshness for product views | Data/Backend | BASE-01, BASE-05 | Distinguish missing, empty, failed and excluded scope; action/publication time separate from retrieval; per-feature processing/availability information can be rendered without raw operator details. |
| BASE-13 | Define app persistence and schema operations | Backend | BASE-03, BASE-07 | App-local data model for new personal resources; tenant/owner keys, indexes, foreign keys, safe deletion policy and migration procedure reviewed; preserve canonical domain identities. |
| BASE-14 | Implement shared accessible components | Frontend | BASE-02, BASE-04, BASE-09 | Composer inputs, dialogs, context controls, result rows, status labels, citations and notifications support focus, names, contrast, reduced motion and narrow reflow. |
| BASE-15 | Establish executable workflow test harness | QA/Backend | BASE-04, BASE-07, BASE-11, BASE-14 | Authenticated deterministic fixtures and fault injection support browser tests; secrets excluded; tests exercise behavior, not narrative docs; baseline unrelated failures recorded. |

Exit: the authenticated shell, contracts, fixtures and design are ready for vertical product work. No provider integration
or research quality is inferred from this foundation gate.

<a id="conversation-and-research"></a>

<a id="conversation-and-research--conversation-and-research-backlog"></a>

## Conversation and research backlog

All items Planned. Brief reference: sections 5, 7, 12 and 13.
Reuse `src/modules/request-handling/api/research-answers.ts` and existing search services after BASE-01 reconciliation; a single research answer
does not provide history, cancellation, structured components, or safe product actions.

| ID | Deliverable | Lead | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- |
| CHAT-01 | Specify conversation and response contract | Backend/Product | BASE-03, BASE-05 | Message/turn/run IDs, context revisions, evidence references, structured result types, partial/error states, retention, and delete semantics documented; distinguish immutable past answers from current records. |
| CHAT-02 | Persist conversations and messages | Backend | CHAT-01, BASE-13 | Create/list/read/rename/delete APIs with pagination, ownership, revisions and deterministic message order; deletion leaves independent issues/follows intact; cross-account tests pass. |
| CHAT-03 | Implement explicit research context | Backend/Frontend | CHAT-01, BASE-12 | Jurisdiction/session/date/record/issue scope serialized; relative dates resolved visibly; add/remove context explicit; ambiguous identities require selection before binding. |
| CHAT-04 | Define allowed research and action tools | Backend | CHAT-01, BASE-07 | Typed allowlist routes to existing authorized services; validate tool arguments; retrieved text cannot authorize actions or change permissions; unknown tool rejected. |
| CHAT-05 | Integrate interactive model execution | Backend | CHAT-04, BASE-05 | Reuse approved gateway/model routing; define request timeout, context/output budget, concurrency and failure envelope; model errors do not expose prompts or credentials. |
| CHAT-06 | Stream durable response events | Backend | CHAT-02, CHAT-05 | Ordered start/result/citation/complete/error events reconnect without duplicating messages; final and partial answers stored consistently; no fabricated progress. |
| CHAT-07 | Implement stop and recovery | Backend/Frontend | CHAT-06, BASE-11 | Stop cancels supported downstream work, labels retained partial text and prevents late response overwrite; retry/read-after-disconnect distinguishes continuation from a new run. |
| CHAT-08 | Bind citations to exact evidence | Backend | CHAT-04, BASE-05 | Claims reference canonical records and identified document sections/versions; unresolved citation flagged; copied citations retain identity and source; later version updates cannot rewrite evidence silently. |
| CHAT-09 | Return structured result components | Backend/Frontend | CHAT-06, CHAT-08, BASE-14 | Bills/people/committees/activity/progress/comparison components use validated schemas; unknown component degrades safely; structured input is never executed as arbitrary HTML or code. |
| CHAT-10 | Implement home composer | Frontend | BASE-09, BASE-14, CHAT-03, CHAT-06 | First-use and returning-home layouts, example tasks, multiline draft, send/stop and accessible errors work; no mandatory persona questionnaire or unsupported attachment controls. |
| CHAT-11 | Implement active conversation page | Frontend | CHAT-07, CHAT-09, CHAT-10, BASE-10 | User can ask/refine/open evidence and preserve context; streaming does not announce every token or force-scroll someone reading earlier text; mobile keyboard and pane return work. |
| CHAT-12 | Implement conversation history management | Frontend | CHAT-02, CHAT-11 | List/open/rename/delete with meaningful titles, confirmation and failure recovery; saved state restores; private ownership visible; deletion does not cancel a follow. |
| CHAT-13 | Build no-answer and coverage behavior | Backend/Frontend | CHAT-08, BASE-12 | Insufficient evidence, unsupported scope, model failure and empty retrieval differ; no claim that missing evidence proves absence; original question and filters retained. |
| CHAT-14 | Integrate research telemetry and usage bounds | Backend/Platform | CHAT-05, CHAT-06 | Extend existing Langfuse/operational tracing with approved redaction, latency/cost/error signals and correlation IDs; enforce agreed limits and report safe user-facing budget errors. |
| CHAT-15 | Evaluate research quality and adversarial inputs | QA/Data | CHAT-08, CHAT-09, CHAT-13, CHAT-14, BASE-15 | Existing retrieval targets plus claim/citation accuracy, exact-version checks, unsupported legal/industry conclusions, prompt injection and sensitive-data tests pass; record reviewed evaluation evidence. |
| CHAT-16 | Implement action proposal component | Frontend/Backend | CHAT-04, CHAT-09, ALERT-13 | User sees exact follow target, event choices, channels/frequency and effective preferences; adjust/cancel/confirm available; text response alone cannot report saved action. |
| CHAT-17 | Execute confirmed actions safely | Backend | CHAT-16, ALERT-06, ALERT-14 | Bind confirmation to validated arguments/revision; persist action receipt and idempotency identity; retries cannot duplicate follows; unauthorized or stale proposal rejected. |
| CHAT-18 | Reconcile unknown action outcomes | Backend/Frontend | CHAT-17 | Timeout after save exposes check-status; reconnect restores real receipt; login recovery never automatically replays mutation; saved/failed/unknown states remain distinct. |

Exit: users can resume private source-grounded conversations and confirm real product actions, with inspectable evidence,
bounded execution, and recoverable failures. Read-only research can ship before action support under the parent slices.

<a id="legislative-pages"></a>

<a id="legislative-pages--legislative-pages-backlog"></a>

## Legislative pages backlog

All items Planned. Brief reference: sections 6 and 7.
Existing record handlers are reuse candidates; rows include adapter/data validation rather than automatically rebuilding
APIs. Every page must support direct links, contextual navigation, incomplete data, and the common browser gate.

| ID | Deliverable | Lead | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- |
| VIEW-01 | Specify search state and filter mapping | Backend/Frontend | BASE-05, BASE-12 | Map supported record types, dates, modes and filters to existing API; preserve normalized query/URL state, clear pagination on changes, and expose truncation/coverage without invented totals. |
| VIEW-02 | Build search results page | Frontend | VIEW-01, BASE-10, BASE-14 | Query, type filters, excerpts, identity and sources; exact-word option and unavailable-mode state; returning from record restores position; no ranking-as-confidence display. |
| VIEW-03 | Implement search refinement and actions | Frontend | VIEW-02 | Direct filter changes supersede stale responses; copy link discloses query state; open/add-context available; follow/add-issue actions gated until owning tasks complete. |
| VIEW-04 | Build bills directory | Frontend | VIEW-01, BASE-10 | Jurisdiction/session/status/sponsor/date filters and supported ordering; usable narrow list; no unsupported filters; populated and missing-session states validated. |
| VIEW-05 | Reconcile bill detail and event projection | Backend/Data | BASE-05, BASE-12 | Bill identity, latest recorded status/actions, sponsors, documents, amendments, votes and relationships reconcile to source; stable chronology/ties; missing collections labeled correctly. |
| VIEW-06 | Define legislative stage mapping | Data/Product | VIEW-05 | Reviewed jurisdiction/measure-specific mapping with source actions, repeated referrals, multiple chambers, veto/override, alternative outcomes and effective-date uncertainty; explicit unsupported mapping state. |
| VIEW-07 | Build bill detail and progress visualization | Frontend | VIEW-04, VIEW-05, VIEW-06, BASE-14 | Header/latest action, selected historical stage versus current status, source-linked stages, timeline, next published event; no percent complete or invented hearing; mobile/text equivalent works. |
| VIEW-08 | Implement document reader | Frontend | BASE-05, BASE-10, BASE-14 | Document identity/version/source, section navigation and original access; missing/extracting/low-quality text states; selection and long text readable at narrow widths. |
| VIEW-09 | Implement passage navigation and pinned versions | Frontend/Backend | VIEW-08 | Search/citation deep link selects exact section/version and surrounding context; copy passage link stable; newer-version notice never replaces cited text silently. |
| VIEW-10 | Implement version comparison page | Frontend/Backend | VIEW-08, VIEW-09 | Two explicit versions, added/removed/unchanged context, next-change navigation, source links and truncation; inline narrow layout and non-color change signals. |
| VIEW-11 | Build amendment detail | Frontend | BASE-05, BASE-10, VIEW-08 | Parent bill, sponsor, amendment identity/status/actions and structured versus document record distinction; available text/source navigation validated. |
| VIEW-12 | Build representative discovery | Frontend/Backend | VIEW-01, BASE-10 | Manual name/jurisdiction/office/service-period selection; district filter only when supported; disambiguation shows identity/service; address not required; missing lookup coverage explicit. |
| VIEW-13 | Build representative profile | Frontend | VIEW-12, BASE-05 | Current/historical service, memberships, sponsored/cosponsored bills, amendments/votes and source links; dates not inferred from first observation; personal action distinguished from bill outcome. |
| VIEW-14 | Validate representative activity semantics | Data/Backend | VIEW-13, BASE-12 | Own actions and associated-bill updates independently filterable; sponsorship and vote attribution verified on nonempty fixtures; missing vote not treated as abstention; no effectiveness score. |
| VIEW-15 | Build committee discovery | Frontend | VIEW-01, BASE-10 | Name/jurisdiction/chamber/classification filters; canonical organization identity preserved; unknown historical coverage distinct from no committee. |
| VIEW-16 | Build committee profile | Frontend | VIEW-15, BASE-05 | Purpose, membership/leadership, referred bills, meetings/materials and next published event; historical membership and missing data states; member and bill links resolve correctly. |
| VIEW-17 | Validate committee activity and data readiness | Data/Backend | VIEW-16, BASE-12 | Formal action, publication, meeting change and referred-bill update are distinct; reconcile source gaps in the existing civic ledger; nonempty fixture proves each enabled relationship. |
| VIEW-18 | Build vote detail | Frontend/Backend | BASE-05, BASE-10, VIEW-13 | Motion/question, body/date/result, totals and individual positions; explain procedural versus passage vote, find representative and open evidence; absent positions never fabricated. |
| VIEW-19 | Build meeting and agenda detail | Frontend/Backend | BASE-05, BASE-10, VIEW-16 | Status/date/timezone/location, agenda/bills, participants/materials; rescheduled/cancelled states retain context; no inferred filing or hearing deadline. |
| VIEW-20 | Build supporting material view | Frontend | BASE-05, BASE-10, VIEW-08 | Publisher/date/type, related records and available sections; original-only and missing-text variants; no uncited generated replacement for unavailable source text. |
| VIEW-21 | Connect read-only evidence to conversation | Frontend | CHAT-11, VIEW-02, VIEW-07 through VIEW-11 | Search/bill/document/amendment/comparison responses open same standalone templates; Back/focus/draft/context preserved; copying evidence does not share conversation. |
| VIEW-22 | Connect civic evidence and run record acceptance | QA/Frontend | VIEW-14, VIEW-17 through VIEW-21, BASE-15 | Representative, vote, committee and meeting conversation paths work; direct-link and keyboard flows across all templates pass; coverage and action attribution checked with real source fixtures. |

Exit: all evidence templates are usable and coherent in conversation and standalone form. Follow controls and issue
actions become active only after ALERT and ISSUE dependencies; temporary inactive affordances are not feature completion.

<a id="issue-tracking-and-briefs"></a>

<a id="issue-tracking-and-briefs--issue-tracking-and-briefs-backlog"></a>

## Issue tracking and briefs backlog

All items Planned. Brief reference: section 8 and persona flows.
An issue organizes personal research; a subscription monitors a record/query. Keep their ownership and lifecycle distinct.

| ID | Deliverable | Lead | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- |
| ISSUE-01 | Specify issue and scope lifecycle | Product/Backend | BASE-03, VIEW-01 | Name/owner, scope revisions, queries, included/excluded records, annotations and subscription references defined; query effective time, exclusion effects and deletion disposition explicit. |
| ISSUE-02 | Implement issue storage and APIs | Backend | ISSUE-01, BASE-13 | Authorized create/list/read/update/delete with pagination and concurrency; canonical references validated; no cross-account access or automatic subscription creation. |
| ISSUE-03 | Build issue list and creation | Frontend | ISSUE-02, BASE-14 | Create from list/chat/search with name and scope preview; returning list shows personal ownership and actual follow state; failed save preserves inputs. |
| ISSUE-04 | Build issue detail | Frontend | ISSUE-03, VIEW-02, VIEW-07 | Scope, selected records, query matches, annotations and available canonical changes; resume research and edit controls; subscription-matched updates activate in ISSUE-10; unknown coverage never shown as no activity. |
| ISSUE-05 | Implement inclusion and exclusion rules | Backend/Frontend | ISSUE-04 | User choices distinguish manual inclusion from automated relevance; explain exclusion effect on issue versus linked follows; removing exclusion recoverable; version changes don't silently lose selections. |
| ISSUE-06 | Implement scope revision and baseline preview | Backend/Frontend | ISSUE-05 | Edit terms/jurisdictions/dates shows changed matches and effective time; initial/historical matches distinct from later changes; affected follows require explicit reviewed update. |
| ISSUE-07 | Add cross-jurisdiction evidence comparison | Backend/Frontend | ISSUE-04, VIEW-09, VIEW-10, CHAT-08 | Bill/version/status date, relevant passages, proposed change and known effective dates comparable; source gaps visible; industry/legal relevance labeled for review. |
| ISSUE-08 | Build reviewed brief preview and copy | Frontend/Backend | ISSUE-07 | Scope/reporting interval, selected findings, exact citations, annotations and limitations persist together; changed selection/content requires review again; no routine freshness badge, publish/send or unsupported export. |
| ISSUE-09 | Connect issues and conversations | Frontend/Backend | ISSUE-04, CHAT-03, CHAT-11 | Explicit add-to-issue and resume-with-issue actions; selected scope revision visible; older conversation does not mutate when issue scope changes. |
| ISSUE-10 | Connect issues to following | Backend/Frontend | ISSUE-06, ALERT-13, ALERT-14 | Preview subscriptions created/changed; save confirmations reflected accurately; exclusions affect matching as specified; no hidden notification activation. |
| ISSUE-11 | Verify issue comparison and evidence journeys | QA | ISSUE-05 through ISSUE-09, BASE-15 | Non-profit/company/lawyer flows preserve ownership, relevance distinctions, pinned versions and copyable citations; deleted/unavailable evidence has explicit state. |
| ISSUE-12 | Implement deletion and follow disposition | Backend/Frontend | ISSUE-10, ALERT-14 | Delete preview identifies follows retained/cancelled; shared references not silently cancelled; partial failure recoverable without claiming complete deletion; personal history isolation maintained. |

Exit: issues can be researched and revised independently of chat history, with explicitly managed subscription effects.
Team/client spaces, report file formats and immutable matter archives remain deferred in the parent register.

<a id="following-and-notifications"></a>

<a id="following-and-notifications--following-and-notifications-backlog"></a>

## Following and notifications backlog

All items Planned. Brief reference: section 9.
The [notification experience](../product/notification-experience.md) owns Novu design semantics. Existing subscription CRUD,
events/deliveries APIs and signed webhooks are reuse inputs, not proof that real change generation or Novu delivery works.

| ID | Deliverable | Lead | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- |
| ALERT-01 | Extend domain target/event contract | Backend/Product | BASE-03, BASE-05 | Specify sponsorship, committee actions/referrals, agenda/material publication and associated-bill updates; identify existing versus new events; no generic update mislabeled as a specific action. |
| ALERT-02 | Define recipient and preference ownership | Backend/Product | BASE-03, BASE-07 | Personal recipient mapping, any organization recipient gate, membership removal, channel opt-out and effective preference contract documented; no implicit organization-wide email. |
| ALERT-03 | Emit canonical change events | Data/Backend | ALERT-01, BASE-12 | Real source changes produce stable event IDs, actor/relation/source/date; distinguish imported history, new activity and corrections; validate bill/person/committee examples against source. |
| ALERT-04 | Implement record subscription matching | Backend | ALERT-03, ALERT-02 | Event/target matrix enforced, own actions versus associated-bill updates selectable; relation changes handled; inactive/unauthorized subscriptions cannot generate intents. |
| ALERT-05 | Implement saved-query matching | Backend/Data | ALERT-03, VIEW-01, ISSUE-01 | Normalized query/scope revision matched deterministically; exclusions and baseline policy applied; historical import does not flood new-action alerts; search dependency failure is visible/retryable. |
| ALERT-06 | Persist delivery intents and recovery identity | Backend | ALERT-02, ALERT-04, ALERT-05, BASE-13 | Durable event-to-recipient/channel intent, uniqueness and receipts; retries reuse identity, unknown acceptance reconciled; update existing Delivery schema through reviewed changes. |
| ALERT-07 | Implement schedule and dispatch ownership | Backend/Platform | ALERT-06 | Reuse Trigger.dev execution as appropriate; app owns coalescing/hourly/daily windows, timezone/DST, leases and cancellation recheck; no second Novu digest delay; retry boundary ownership explicit. |
| ALERT-08 | Select Novu environment and operating plan | Platform/Product | BASE-03 | Decide hosting/region, account/plan, projected volume/cost, retention and limits; verify SDK compatibility/idempotency capabilities; no production activation or purchase inferred from design selection. |
| ALERT-09 | Configure email delivery provider | Platform | ALERT-08 | Approved sender/domain, provider credentials, domain authentication and verified test destination; bounce/complaint and unsubscribe handling defined; no customer email used as an unsolicited test. |
| ALERT-10 | Implement protected Novu subscriber mapping | Backend | ALERT-02, ALERT-08 | Stable server-derived recipient IDs, signed inbox identity/context, membership/account isolation; keys stay server-side; tampered subscriber/context cannot read another inbox. |
| ALERT-11 | Implement Novu workflow dispatch | Backend | ALERT-07, ALERT-09, ALERT-10 | In-app/email workflows consume bounded source-grounded payloads and app-closed batches; no private research notes; accepted workflow ID mapped to durable intent. |
| ALERT-12 | Reconcile receipts and provider failures | Backend/Platform | ALERT-11 | Authentic receipts deduplicated and ordered safely; queued/accepted/delivered/suppressed/failed/unknown mapped truthfully; outage recovery and provider retention limits cannot duplicate delivered events. |
| ALERT-13 | Build follow configuration and preview | Frontend | ALERT-01, ALERT-02, ALERT-15, BASE-14 | Target/query/events/channels/frequency/timezone editable; effective delivery shown; explicit confirmation and safe cancellation; unsupported target/event options not submitted. |
| ALERT-14 | Build Following list/detail and lifecycle | Frontend/Backend | ALERT-06, ALERT-13, BASE-11 | Reuse CRUD APIs; list/filter/detail/edit/pause/resume/cancel with revision conflicts and idempotent recovery; matched events remain available independently of inbox. |
| ALERT-15 | Define account notification preferences API | Backend | ALERT-02, ALERT-10 | Novu preference source of truth, app frequency/timezone and verified destinations composed; no conflicting shadow preference store; opt-out race and failure states specified. |
| ALERT-16 | Build notification settings | Frontend | ALERT-15, BASE-14 | Global/category/channel permissions, timezone/destination and effective-follow suppression visible; disabled email cannot be overridden by a follow; changes synchronize across devices. |
| ALERT-17 | Integrate inbox bell and state | Frontend/Backend | ALERT-10, ALERT-11, BASE-09 | Protected Novu-backed bell, unread count and recent items; opening bell alone does not mark all read; sign-out/account switch clears scope and cached items. |
| ALERT-18 | Build Updates inbox page | Frontend | ALERT-17, ALERT-14, BASE-10 | Read/unread/archive states shared with bell; open item marks it read; reason/source/time and related follow reachable; archive does not cancel following. |
| ALERT-19 | Implement overlap and correction presentation | Backend/Frontend | ALERT-06, ALERT-18 | Same recipient/channel/due-batch event appears once with all matching reasons; different windows disclosed; corrections/reschedules preserve context and source identity. |
| ALERT-20 | Build and verify email templates | Frontend/Platform | BASE-02, ALERT-09, ALERT-11, ALERT-15 | Immediate and digest templates show subject/change/date/reason/evidence and preferences/unsubscribe; narrow/email-client checks; authenticated destination receives actual test content with recorded evidence. |
| ALERT-21 | Build delivery history and inbox recovery | Frontend/Backend | ALERT-12, ALERT-14, ALERT-18 | User sees accurate delivery status/suppression cause; unavailable inbox differs from empty; canonical matched events accessible; retry/check-status actions cannot blindly resend. |
| ALERT-22 | Reconcile signed webhook delivery implementation | Backend | BASE-01, ALERT-06 | Preserve existing payload/signature/rotation/retry/SSRF contract; prove nonempty canonical event delivery and receiver deduplication, not only verification challenge; Novu push webhook not substituted. |
| ALERT-23 | Build webhook destination management | Frontend | ALERT-22, BASE-14 | Create/verify/edit/rotate/remove and delivery errors; one-time secret and replay handling follow contract; no secrets in saved frontend state or example screenshots. |
| ALERT-24 | Connect webhook delivery to follows | Backend/Frontend | ALERT-07, ALERT-14, ALERT-23 | Advanced channel only accepts owned active destination; failed verification and removed destination fail clearly; delivery receipt shares canonical event identity. |
| ALERT-25 | Run notification acceptance suite | QA/Platform | ALERT-16, ALERT-19 through ALERT-21, ALERT-24, BASE-15 | Test real source change -> match -> inbox/email/webhook; cross-account rejection, opt-out/queued cancellation, duplicates, DST, imports, corrections, unknown acceptance, outages and recovery; measure detection separately from delivery. |

Exit: matching, delivery, inbox/preferences and failure recovery are evidenced end to end. Shipping API CRUD or Novu
trigger acceptance alone does not complete this workstream. SMS, weekly digests and quiet hours remain deferred.

<a id="integrations-and-release"></a>

<a id="integrations-and-release--integrations-and-release-backlog"></a>

## Integrations and release backlog

All items Planned. Brief reference: sections 10, 12–15.
Release work reuses existing infrastructure and API delivery processes; this backlog does not authorize a production
cutover or an external message. Operational decisions and evidence are explicit completion requirements.

| ID | Deliverable | Lead | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- |
| SHIP-01 | Reconcile external MCP client capability | Backend/Platform | BASE-01, BASE-06 | Verify resource-specific auth/discovery and populated tool calls for supported external clients; document API versus MCP token boundary; no setup-complete claim from URL display alone. |
| SHIP-02 | Build integration overview and MCP settings | Frontend | SHIP-01, BASE-09, BASE-14 | Copy server URL and supported authentication/setup/help; no in-app connection-status or verification UI; provider-supported revocation only, no secret/browser-token copying. |
| SHIP-03 | Implement product diagnostics and support evidence | Platform/Backend | CHAT-14, ALERT-12 | Correlation IDs connect user-safe failures to redacted model/API/matching/delivery traces; safe troubleshooting without private queries or client notes in alerts/logs. |
| SHIP-04 | Define and measure performance/cost budgets | Product/Platform | CHAT-14, VIEW-22, ALERT-25 | Agreed search/record/first-response/completion and notification latency targets; representative workloads and model/email costs measured; no fabricated estimates or freshness SLA. |
| SHIP-05 | Verify background execution operations | Platform | ALERT-07, ALERT-12 | Trigger.dev concurrency, leases, retry ownership, stalled work and recovery tested; operator can identify processing backlog without confusing it with upstream publication delay. |
| SHIP-06 | Prepare deployment and recovery plan | Platform | BASE-13, CHAT-02, ISSUE-02, ALERT-10 | Railway environment/secrets and app schema procedure reconciled; per-feature activation gates, approved rollback, retention/backups and configuration restoration documented. |
| SHIP-07 | Verify privacy and access lifecycle | QA/Backend | CHAT-12, ISSUE-12, ALERT-25, SHIP-02 | Cross-user/account tests cover history/issues/inbox/links/actions; deletion/retention/destination removal and membership changes enforced; private context absent from provider payloads. |
| SHIP-08 | Complete accessibility and responsive acceptance | QA/Frontend | VIEW-22, ISSUE-12, CHAT-18, ALERT-25, SHIP-02 | Integrated-browser keyboard/names/focus/reflow at desktop/medium/mobile and enlarged text; non-color progress/diffs, restrained streaming announcements, email readability and reduced motion checked. |
| SHIP-09 | Run target-ICP usability study | Design/Product | BASE-02 | Recruit qualified researchers under the ICP validation plan; observe recurring brief/question journeys and supporting vote/progress/evidence/follow tasks; add specialist perspectives for distinct risks and resolve critical misunderstandings. |
| SHIP-10 | Complete content and coverage review | Product/Data | SHIP-09, VIEW-22, ISSUE-11, ALERT-20 | Neutral terminology, exact-version/effective-date labels, relevance assessments and missing-data states checked; Fluent review when available, no uncited legal or nationwide-completeness promises. |
| SHIP-11 | Run complete user-journey acceptance | QA | CHAT-15, CHAT-18, VIEW-22, ISSUE-11, ISSUE-12, ALERT-25, SHIP-02, SHIP-08, SHIP-10 | Current product/IA/conversation flows pass with populated evidence plus missing-data and failed-action cases; desktop/mobile, deep-link auth recovery and no duplicate mutations verified. |
| SHIP-12 | Complete repository and build verification | Engineering | SHIP-11 | Focused checks, `pnpm verify` and application build clean; attach exact output or explicitly named unresolved blockers; no unrelated dirty work modified to mask failures. |
| SHIP-13 | Run staged authenticated integration canaries | Platform/QA | SHIP-04 through SHIP-07, SHIP-12 | Reviewed build on approved target, migrations/config verified, browser/model/MCP/source-event/Novu/email/webhook canaries pass; release data coverage matrix current. |
| SHIP-14 | Record release decision and pilot handoff | Product/Platform | SHIP-13 | Named approval and enabled scopes, known limitations, support/runbooks, rollback triggers and pilot observation plan; no feature marked released without deployed evidence. |

<a id="integrations-and-release--evidence-expected-at-handoff"></a>

### Evidence expected at handoff

- Design/prototype URL and resolved critical persona findings.
- Per-flow browser evidence, accessibility review, and source fixtures with coverage limitations.
- Exact commit/build and target environment; focused/full check results.
- Authentication and isolation canaries, model quality/latency evaluation, and delivery receipts.
- Budget, operating ownership, runbook, retention/deletion behavior, and reviewed rollback plan.

None of these artifacts has been produced by writing this backlog. Completion updates belong alongside the relevant
task IDs and in the existing API release records where that boundary is affected.
