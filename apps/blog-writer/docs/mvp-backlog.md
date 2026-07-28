# Shopify Blog Writer MVP backlog

## Purpose

This backlog turns the [product plan](./plan.md) into small, ordered implementation tasks. It starts from the code that
already exists and favors a working merchant journey over a generalized platform.

The first usable release is complete when a merchant can install the app, synchronize store content, create or approve
an idea, schedule or generate a draft, edit it, review links, save it to Shopify, and explicitly publish the selected
revision. Shared sources and SEO measurement then complete the planned MVP in bounded follow-up increments.

Task IDs are stable local references until work moves into the issue tracker.

## Current baseline

The following already exist and should be evolved rather than rebuilt:

- PostgreSQL and Drizzle tables for tenants, jobs, Shopify resources, chunks, ideas, articles, revisions, publication
  events, recommendations, keyword imports, observations, and competitor domains;
- PostgreSQL-backed Shopify session storage and uninstall cleanup;
- authenticated Shopify resource traversal with tenant-scoped snapshot persistence;
- authenticated Home, Plan, Articles, Keywords, and Settings routes in place of the original one-page workspace;
- durable articles and immutable revisions behind a TipTap editor, with server-side sanitization, version history,
  restore, and expected-revision conflict detection;
- Shopify publication through `articleCreate` and `articleUpdate`, persisting the returned article GID, the storefront
  URL, and a publication event;
- separate n8n workflows for idea, draft, commercial-crosslink, and further-reading generation;
- an n8n-owned store sync: one workflow syncs a single store and chains into indexing, a second sweeps every store
  that has gone 72 hours without a sync, and the app exposes the scan behind one bearer-authenticated endpoint;
- a store content fingerprint that compares live Shopify counts and update times against the stored catalogue, so
  Settings reports whether the store has changed since the last sync;
- Langfuse-managed prompts and OpenRouter model execution in the production workflows;
- pgvector retrieval over `tenant_resource_chunks` with a hosted rerank pass;
- keyword import, normalization, clustering, calibration, and the ten opportunity detectors;
- unit and integration-test foundations for synchronization, persistence, workflows, and the routes.

The remaining gaps are the absent onboarding flow and the worker lease it needs, shared public sources, and the rest of
the Keywords section. Store sync now has a durable owner in n8n, but nothing is deployed: the app has no public address,
so the workflows cannot reach it and no schedule can run.

## MVP implementation rules

1. Keep PostgreSQL as the application source of truth and n8n as the existing generation orchestrator.
2. Extend the existing `tenant_jobs` table for tenant work and add one PostgreSQL worker command. Shared publication
   refreshes may use a small publication-owned job table when that feature lands, but use the same worker process. Do
   not introduce a queue product, event bus, or workflow framework for the MVP.
3. Replace the pre-release idea and draft shapes with the target records directly. Do not build compatibility APIs or
   duplicate old and new tables.
4. Use explicit save in the first editor. Autosave is not required.
5. Make scheduling work with forms and keyboard controls before adding drag interactions.
6. Support RSS feeds, bounded sitemaps, and explicit article URLs instead of broad crawling. Discover a feed or sitemap
   from a publication home page only when the page advertises it.
7. Retrieve recommendation candidates with hybrid search: deterministic eligibility filters first, then reciprocal
   rank fusion over Postgres full-text and pgvector similarity, then a hosted rerank pass. See
   [the reranking decision record](./reranking-decision.md). Vectors live in the existing database, so this adds no
   separate search service.
8. Start SEO with one Search Console property and one configured market, language, and device per tenant. Keep provider
   provenance, but do not build a generic integration marketplace.
9. Treat ShopifyQL as a feasibility-gated source. Do not replace it with the deferred storefront tracker in the MVP.
10. Keep the content analytics tracker and every other item already listed under Deferred work out of this backlog.

## Delivery gates

| Gate | Required outcome | Tasks | Status |
| --- | --- | --- | --- |
| A: runnable foundation | Tenant settings, the route shell, and one durable store-sync handler work and reject cross-tenant access | BW-001 through BW-009 | Partial. Routes, tenant settings, and job records exist. The worker claim command and the lease, retry, and attempt columns it needs do not. Store sync found its durable owner in the n8n workflows rather than in `tenant_jobs`, so BW-007 is now needed for generation and imports rather than for sync. |
| B: resumable store onboarding | A merchant can leave and return while a large store sync progresses to a usable state | BW-010 through BW-018 | Partial. Store sync ships as an n8n-owned workflow that both the Settings button and a 72-hour sweep run, and Settings reports whether the store has changed since. There is no `/app/onboarding` route, and a sync still has to complete inside one request. |
| C: planned draft | Manual and generated ideas share one backlog and immediate or scheduled work produces exactly one article draft | BW-020 through BW-031 | Mostly complete. Ideas, plan items, articles, and revisions work end to end. |
| D: publishable article | A merchant can edit revisions, review links, create a Shopify draft, and explicitly publish one revision | BW-032 through BW-049 | Mostly complete. Editing, version history, conflict detection, publication, and recommendations all work. |
| E: grounded content | Shared publications can be subscribed, refreshed on schedule, and used only by authorized tenants | BW-050 through BW-057 | Partial. Subscriptions and their Settings UI exist. The source detail route, refresh job, and retention cleanup do not. |
| F: measured content | Search opportunities, keyword targets, baselines, and available Shopify outcomes are visible with provenance | BW-060 through BW-079, BW-088 through BW-102 | Partial. Schema, import, clustering, calibration, and all ten detectors are built, and `/app/keywords` renders ranked opportunities with their evidence. The Competitors, Coverage, and keyword detail views do not exist, and nothing yet schedules the import. |
| G: releasable MVP | Home, recovery, accessibility, privacy, hosting, and end-to-end acceptance are complete | BW-080 through BW-087, BW-103, BW-104 | Partial. Home exists. The app has no public host, so operator recovery, telemetry, accessibility acceptance, the scheduled sync, and end-to-end acceptance are all still open. |

Gate D is the first working editorial release. Gates E and F complete the product-plan MVP without pulling deferred
capabilities into the critical path.

## A. Runnable foundation

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-001 | Capture the live baseline | Run the current Fencing Club sync and one pass through each n8n workflow; create `docs/mvp-baseline.md` with resource counts, page counts, timings, workflow outputs, failures, and required environment names | The current path is reproducible and any environment blocker is named before schema changes | Existing baseline |
| BW-002 | Add foundation schema fields | Add tenant settings and only the job claim, lease, phase, progress, retry-at, maximum-attempt, and cancellation fields missing from the existing schema | Drizzle checks pass; current resource data remains tenant-scoped; no future feature table is added early | BW-001 |
| BW-003 | Update the migration baseline | Generate and review the Drizzle migration for the foundation changes; reset only disposable Blog Writer data | A clean database migrates successfully and Shopify sessions or unrelated credentials are not deleted | BW-002 |
| BW-004 | Tighten the tenant repository boundary | Reuse the current `session.shop` lookup, centralize the authenticated tenant context, and add settings and job methods; add feature repositories only with their owning tasks | New repository methods cannot run without server-derived tenant context and negative tests cannot read or mutate another tenant's rows | BW-002 |
| BW-005 | Add the app route shell | Create Home, Plan, Articles, and Settings routes under `/app`; list store and subscribed sources in Settings, update the embedded navigation, and retain Shopify boundary handling | Every route authenticates, direct navigation works, and the current one-page workspace is no longer the owning UI | BW-004 |
| BW-006 | Persist tenant settings | Store time zone, default destination blog, generation cadence, target market, language, device, brand voice, content defaults, in-app notification preferences, and onboarding completion | Settings round-trip per tenant and reject unsupported values without accepting a tenant ID from form data | BW-004 |
| BW-007 | Add a bounded job claim path | Add one worker command that claims due `tenant_jobs`; implement leases, retry scheduling, maximum attempts, and cancellation before work starts or between resumable phases | Two workers cannot claim the same job; an interrupted job becomes retryable; exhausted attempts end visibly; external mutations cannot be cancelled after dispatch | BW-002 |
| BW-008 | Dispatch the first job handler | Add a small handler registry, register only `catalog_sync`, and expose a server dispatch method that inserts an idempotent job and returns its ID | A route can enqueue store sync without waiting; the handler updates phase, cursor, progress, status, and redacted error code | BW-007 |
| BW-009 | Add shared task-status UI | Build one reusable status panel for queued, running, succeeded, failed, and retrying jobs with progress and normal failed-job retry | Onboarding and later screens can show and retry the same persisted job after navigation or process restart | BW-007 |

## B. Resumable onboarding and synchronization

Current checkpoint: BW-012 shipped in a different shape from the one written here. Store sync is owned by n8n, not by
`tenant_jobs`: one workflow syncs a single store and chains into indexing, and a second sweeps every store that has gone
72 hours without a sync. The retries, the ordering, and the run history live there. What the app still owns is a single
bearer-authenticated endpoint that scans one store and persists the snapshot in one request.

That leaves BW-010 and BW-011 open for the reason they were always open: a store large enough to exceed one request
needs paged traversal and a persisted cursor, and no workflow retry can supply those. Take them when a real catalogue
forces it, and keep the resumable form behind the same internal endpoint so the workflow layer does not have to change.
BW-008 should register whichever handler is first actually needed for generation or imports; store sync is no longer a
candidate.

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-010 | Split Shopify traversal into pages | Refactor the scanner so each call fetches a bounded page for one resource type and returns the next cursor | A handler can stop after one page and resume without rescanning completed pages | BW-007 |
| BW-011 | Persist synchronization phases | Store catalog, content, indexing, counts, and cursors in the existing job record; move snapshot finalization to the final phase | Restarting during any phase resumes the same job and missing resources deactivate only after a complete traversal | BW-010 |
| BW-012 | Hand store sync to the workflow layer | Replace the long-running Settings action with a call to the single-store n8n workflow, which asks the app to scan and persist one store through a bearer-authenticated internal endpoint and then chains into indexing; keep the Shopify traversal in the app rather than rebuilding it in the workflow | The button and the schedule take one path and leave one run history; the merchant's request waits for a real result rather than a queued acknowledgement; the endpoint refuses an unauthenticated or wrongly-authenticated caller without disclosing why; and a store the app holds no offline session for fails before anything is written | BW-005 |
| BW-013 | Build onboarding routing | Redirect incomplete tenants to `/app/onboarding`; preserve the current step and allow completed tenants to revisit setup from Settings | Refreshing or reopening the app resumes the correct step without a client-supplied tenant identifier | BW-005, BW-006 |
| BW-014 | Build Connect store step | Show authenticated shop identity, required scopes, and capability-specific missing-scope messages | The merchant can continue only with the read capabilities needed for synchronization | BW-013 |
| BW-015 | Build Sync store content step | Dispatch or reconnect to the active sync job; show phase, counts, checkpoint, failure, and retry using the shared status UI | The merchant may leave and return while progress continues and can recover a failed job | BW-009, BW-012 |
| BW-016 | Build publishing-defaults step | List active synchronized `blog` resources and save default blog, time zone, and cadence | A valid blog and time zone persist and prefill later plan items | BW-006, BW-015 |
| BW-017 | Build onboarding review step | Summarize synchronized resource counts, source status when available, defaults, and incomplete work; gate Plan on minimum store data | Successful work is not hidden by an unrelated failure and the merchant can continue once store grounding is ready | BW-015, BW-016 |
| BW-018 | Validate Fencing Club onboarding | Run the full flow against Fencing Club, including leaving during sync and resuming after worker restart | The store reaches `ready` without duplicate active resources or premature missing-resource deactivation | BW-017 |

## C. Planning and scheduled generation

Current checkpoint: durable articles, immutable revisions, and publication events are in the schema, and the article
repository owns create, list, detail, revision history, set-current, and publication writes with expected-revision
conflict detection. `blog_drafts` stays only as the landing table the current n8n workflows write to; BW-030 removes it
once those workflows return content instead of writing application tables.

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-020 | Add planning schema and contracts | Add content ideas and plan items; define statuses, origins, generation date, publication date, destination blog, source idea, and article relationship | UTC timestamps retain the tenant presentation time zone; invalid transitions and publication dates before generation dates are rejected | BW-003 |
| BW-021 | Add planning repository | Implement tenant-bound list, create, edit, approve, dismiss, schedule, unschedule, and claim-due operations | Concurrent approval creates at most one plan item from an idea and all writes enforce tenant ownership | BW-004, BW-020 |
| BW-022 | Add manual plan-item creation | Build `/app/plan/new` for title, brief, audience, keyword, destination blog, and optional dates | A merchant can create approved work without invoking AI and sees field-level validation | BW-005, BW-021 |
| BW-023 | Adapt idea generation | Accept topic, audience, product group, and content goal inputs; register an idea-generation job; have n8n return validated candidate payloads and let the app persist them transactionally | One request creates reviewable ideas with title, angle, keyword, rationale, and no automatic plan item; n8n does not write application tables | BW-008, BW-020 |
| BW-024 | Add idea decisions | Add approve, edit-and-approve, and dismiss actions; promote an approved idea to exactly one plan item | Approval is idempotent, dismissal is preserved, and neither action generates an article | BW-021, BW-023 |
| BW-025 | Build Plan backlog | List proposed ideas separately from approved unscheduled plan items; add filters and direct actions | The merchant can distinguish AI candidates from committed work and open any item | BW-022, BW-024 |
| BW-026 | Build plan-item detail | Build `/app/plan/:planItemId` for editing the brief, dates, and destination while the item is not generating | Changes persist with stale-write detection and generated articles remain linked to their originating plan item | BW-021, BW-025 |
| BW-027 | Add calendar view | Show generation and target-publication dates from the same plan-item query; add keyboard-accessible date and unschedule controls | Moving an item changes scheduling only and the backlog updates from the same record | BW-025, BW-026 |
| BW-028 | Add article, revision, and publication schema | Add durable articles and immutable revisions beside the temporary `blog_drafts` landing table; add publication events, current and published revision foreign keys, and article statuses | One article has ordered revisions; current and published revision references remain tenant-scoped and may differ | BW-003, BW-020 |
| BW-029 | Add article repository | Implement tenant-bound create, list, detail, revision history, create-revision, set-current, and publication operations | Article identity is stable, revision history is ordered, and stale expected-revision writes return a conflict | BW-004, BW-028 |
| BW-030 | Adapt draft workflow output | Have n8n return validated title, excerpt, body, and tags without writing application tables; let the app handler create the immutable revision and advance `current_revision_id` transactionally, then drop `blog_drafts` | The output contract is covered by tests, one idempotency key cannot produce duplicate revisions, and no code path reads `blog_drafts` | BW-023, BW-029 |
| BW-031 | Run immediate and scheduled generation | Register one draft-generation handler; enqueue it from Generate now or when a due plan item is claimed; create the article once and finalize the returned revision | Manual plan items do not depend on idea generation; immediate and scheduled paths use one handler; retries create no duplicate article or revision | BW-008, BW-021, BW-030 |

## D. Durable articles, recommendations, and Shopify publishing

Current checkpoint: `/app/articles` lists stable article identities and `/app/articles/:articleId` owns the preview and
link suggestions. Recommendations now reference an article and persist their destination resource type. Crosslinks can
target any synchronized resource type; Further reading is constrained to articles. Refresh and Add/Remove selection are
implemented. Article content now lives in immutable revisions. The removal of the temporary `blog_drafts` content
bridge, polished link insertion, saved dependency relationships, editing, and Shopify publishing remain open.

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-032 | Build Articles index | Add search and status filters for draft, needs review, ready to publish, published, needs attention, and failed | Every article status links to the correct detail route and empty states offer the next valid action | BW-005, BW-029, BW-031 |
| BW-033 | Build article editor | Load title, excerpt, body, tags, destination blog, current revision, and status on `/app/articles/:articleId` | Editing remains local until explicit save and route loaders never expose another tenant's article | BW-029 |
| BW-034 | Save edited revisions | Validate and sanitize editor input, create an `edited` revision, and advance the current revision with expected-revision checking | Save never overwrites history; two stale editors cannot silently replace each other's work | BW-033 |
| BW-035 | Preserve sandboxed preview | Render the saved or unsaved candidate in a sandboxed storefront preview without executing article scripts | Unsafe markup cannot escape the preview and desktop and narrow layouts remain usable | BW-033 |
| BW-036 | Add revision history | List origin, timestamp, and publication state; allow viewing and restoring a prior revision as a new current revision | Restore preserves the old records and never changes the published revision automatically | BW-031, BW-034 |
| BW-037 | Add regeneration | Dispatch the existing draft-generation handler using the current article and brief; save the returned content as a `regenerated` revision | The existing current and published revisions remain intact while generation runs or fails | BW-030, BW-036 |
| BW-038 | Bind recommendations to revisions | Replace the temporary draft workflow field with article ID plus source revision ID; retain separate crosslink and further-reading objectives and the destination resource type | Recommendations from an older revision are visibly stale and cannot apply to a newer revision | BW-003, BW-029 |
| BW-039 | Adapt recommendation workflows | Update both n8n workflows to return validated destination, section locator, anchor, rationale, and evidence; let the app handler upsert proposals for the requested article and revision | Workflows never write application tables or regenerate the article body and may return no recommendation | BW-038 |
| BW-040 | Build recommendation review | Add separate article-detail sections for crosslinks and further reading with Add/Remove selection, anchor edit, and placement edit | A merchant can inspect the destination type and evidence before making a decision; further reading contains only articles | BW-033, BW-039 |
| BW-041 | Add dependency schema and repository | Add article dependencies with source revision, destination identity and revision or hash, placement, status, and verification time; implement tenant-scoped reverse lookup | Reverse lookup returns every article depending on a destination within the same tenant | BW-003, BW-029 |
| BW-042 | Apply a recommendation atomically | Verify tenant, destination state, and reviewed source revision; insert the accepted link and save the new revision, dependency, and applied status in one transaction | Only the reviewed placement changes; ambiguous or missing placement leaves content and dependency state unchanged | BW-034, BW-040, BW-041 |
| BW-043 | Reapply dependencies on regeneration | After generation, deterministically reapply still-valid dependencies and record conflicts for merchant review | A valid accepted relationship survives regeneration and an ambiguous relationship is never silently dropped | BW-037, BW-041 |
| BW-044 | Create refresh proposals for changed destinations | After store sync, compare availability, publication, canonical URL, and dependency hashes; create one refresh plan item per affected article and destination | Repeated scans do not duplicate proposals, affected articles show `needs_attention`, and published prose is never edited | BW-011, BW-021, BW-041 |
| BW-045 | Add Shopify write scopes | Add the exact content write scope required by the chosen article mutations and show reauthorization state | Read-only installations retain current capabilities and publishing stays disabled until authorization succeeds | BW-014 |
| BW-046 | Validate destination blogs before writes | Reuse synchronized `blog` resources for selectors and perform a bounded live Shopify lookup immediately before a write | A deleted or inaccessible blog is rejected before mutation and the merchant can select another destination | BW-016, BW-045 |
| BW-047 | Save as Shopify draft durably | Register an idempotent Shopify-draft handler; enqueue an explicitly selected revision; create or update one unpublished Shopify article and persist its GID and URL | The request returns the job ID; retries update one Shopify article; status records the exact revision sent and actionable errors | BW-008, BW-029, BW-045, BW-046 |
| BW-048 | Publish selected revision durably | Add a separate confirmation that enqueues an idempotent publish handler and writes an article-publication record after Shopify succeeds | No generation or save action publishes; success records revision, URL, and time; a dispatched mutation is not cancellable | BW-047 |
| BW-049 | Verify the editorial journey | Exercise manual and generated planning, immediate and scheduled generation, edit conflicts, recommendation application, dependency regeneration, destination-change proposals, Shopify draft save, and publish | One Fencing Club article completes the full journey and the published revision matches the selected local revision | BW-018, BW-031, BW-034, BW-042, BW-043, BW-044, BW-048 |

## E. Shared public sources

Current checkpoint: Settings can subscribe and unsubscribe a tenant through `tenant_blog_subscriptions`, reusing the
existing hostname-keyed `public.blogs` registry. This is the registration portion of BW-052 and BW-055; discovery,
preferences, refresh jobs, documents, revisions, source detail, and retention remain open.

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-050 | Add shared-source schema | Add publications, documents, immutable revisions, tenant subscriptions, and publication-owned refresh jobs with canonical URL and next-refresh constraints | Public rows have no tenant owner; every tenant access path requires an active subscription join; refresh work is keyed by publication | BW-003 |
| BW-051 | Resolve source inputs | Normalize an RSS, bounded sitemap, or article URL; for a home page, follow only declared canonical, feed, and sitemap links | Equivalent inputs resolve to one publication and unsupported or unbounded discovery returns a clear validation result | BW-050 |
| BW-052 | Add subscription repository | Implement subscribe, list, update preferences, and unsubscribe with tenant-bound methods | Two tenants can share a publication and one tenant cannot list or mutate the other's subscription | BW-004, BW-050 |
| BW-053 | Refresh publications on schedule | Extend the same worker command to claim publication jobs; fetch bounded RSS, sitemap, and explicit-article pages with persisted cursors; hash content, create changed-only revisions, set the next refresh, and run dependency impact detection | Initial and recurring refreshes resume after interruption, update shared documents once, preserve history, and create no duplicate refresh proposals | BW-008, BW-044, BW-051 |
| BW-054 | Insert the onboarding source step | Add source registration, existing-publication reuse, skip, progress, and retry as Step 3; update publishing defaults to Step 4 and review to Step 5 | A merchant can complete onboarding without a source or subscribe without duplicate refresh; review reflects the new step | BW-017, BW-052, BW-053 |
| BW-055 | Build Sources settings and detail | Separate Store content and Subscribed sources in Settings; add `/app/settings/sources/:sourceId` with refresh history, document summary, preferences, retry, resync, and unsubscribe | Settings and source detail show last and next refresh, counts, failures, and actionable empty states from their owning records | BW-005, BW-052, BW-053 |
| BW-056 | Authorize generation retrieval | Include public source documents in idea and draft context only after joining through the active tenant subscription | A cross-tenant retrieval test cannot obtain an unsubscribed document and generated evidence identifies its revision | BW-030, BW-052, BW-053 |
| BW-057 | Add source retention cleanup | Mark a publication for deletion after its final unsubscribe and let a daily worker pass delete it after 30 days if no tenant resubscribes | Unsubscribing one tenant does not remove data needed by another tenant and the due-cleanup query is idempotent | BW-052, BW-053 |

## F. SEO intelligence and outcome measurement

Current checkpoint: three pieces of this gate already exist and the remaining tasks must build on them rather than
introduce parallel structures.

- `blog_ideas.target_keyword` is populated on every idea, but the value is written by the idea-generation model and has
  no provider, market, volume, difficulty, or observation date behind it. Plan renders it with a search icon beside real
  crosslinks, so it currently reads as measured data when it is not. BW-075 grounds it; nothing else in this gate should
  treat the column as evidence until then.
- `tenant_competitor_domains` persists normalized competitor hostnames from Settings. This is configuration groundwork
  for BW-064; it carries no market dimensions, provider imports, or metric history. BW-078 seeds it from provider
  suggestions the merchant accepts, so the table stays the single record of confirmed competitors.
- `tenant_resources` and `blog_recommendations` already model published storefront resources and the link suggestions
  made against them, including an `evidence` jsonb column and a `ranker` string. Keyword evidence follows the same
  shape: normalized snapshot plus explicit provenance, never a bare number.
- The store scan already reads the shop's primary locale and stamps it onto every synchronized resource, but does not
  persist it against the tenant. The granted scopes cover `shopLocales`; they do not cover the `markets` query, which
  needs `read_markets` and merchant re-consent. The available country signal is therefore the shop's own billing
  country, which is why BW-079 exists.

Search opportunities move out of Plan into a `/app/keywords` section. Plan stays the commitment surface; Keywords is the
evidence surface. BW-088 through BW-091 build it, BW-094 supplies the charts it and article detail share, and BW-092 and
BW-093 connect it to generation. Opportunity detection is a catalogue of separate detectors rather than one rule:
BW-065 builds the derived layer they all read and lands the first detectors on it, BW-095 adds the detector that needs
no provider data at all, BW-096 adds the demand-trend and decay detectors, and BW-097 adds the detectors whose answer is
not to write. BW-093 is what turns any of it into a tailored draft rather than a keyword pasted into a prompt.

Opportunities are not an approval queue. BW-092 has idea generation draw from them without asking, so the section
reports progress rather than collecting decisions, and BW-102 keeps the manual path honest by completing keyword inputs
from terms that were actually observed. BW-100 fixes the import at a monthly cadence with a weekly ceiling on manual
refreshes, and BW-101 states the isolation rule that keyword evidence makes expensive to get wrong.

Search Console work (BW-061, BW-062, BW-069, BW-070, BW-071) is deferred behind the keyword-provider slice. No UI
promises a Search Console connection, and none should be added until those tasks are scheduled.

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-060 | Add SEO persistence | Add properties, keywords, metric snapshots, article targets, search observations, and redacted provider artifacts referenced by imports; add the keyword tables as two layers, with imports and per-keyword-and-domain observations written once and never updated, clusters and opportunities replaced wholesale by each import, and merchant dismissals kept separately against a fingerprint of the cluster's terms | Provider, endpoint or dataset, market, language, device, collection time, freshness, cost, and tenant ownership are explicit; raw artifacts are redacted before storage; a stored import can be replayed and lifted out as a test fixture without reaching the provider; and a dismissal survives the next import rather than reappearing with a new cluster identity | BW-003, BW-028 |
| BW-076 | Resolve the tenant keyword market | Persist the shop country from `shop.billingAddress.countryCodeV2` and the primary locale the store scan already reads, cache the provider's free `locations_and_languages` catalogue, and resolve the pair by matching `country_iso_code` and the locale language subtag to the catalogue's location and language names | A tenant has exactly one resolved location and language derived from data rather than a hand-written country table, an unresolvable country leaves the pair unset instead of defaulting to `United States`, and a keyword metric can never be written without the dimensions it was requested under | BW-060 |
| BW-079 | Confirm the keyword market in Settings | Show the resolved location and language beside the Shopify signal each came from, offer a correction limited to pairs the cached catalogue supports, and block every keyword operation while the pair is unset | A merchant outside the provider's country coverage can still reach a working market, a correction is recorded as a merchant choice rather than a derived value, and no import, opportunity, or metric runs against an unset pair | BW-006, BW-076 |
| BW-063 | Configure DataForSEO | Add operator-managed server credentials, a connectivity check, and request metadata including endpoint, dataset, freshness, cost, and observation time | Failed requests record no partial metric snapshot and credentials never enter tenant settings or artifacts | BW-060 |
| BW-075 | Ground the idea target keyword | Resolve the model-proposed `blog_ideas.target_keyword` against the keyword provider after idea generation, persist a metric snapshot with provider and observation date, and link the idea to the resolved keyword | An idea shows volume, difficulty, and provenance when the term resolves, and is labelled unverified rather than rendered as measured data when it does not; a provider failure never blocks idea generation | BW-060, BW-063, BW-076 |
| BW-077 | Record keyword provider spend | Persist the per-request cost the provider reports, attributed to the tenant and the operation that caused it, and expose totals per tenant and per competitor domain | A per-tenant and per-competitor cost can be derived from stored rows without reading provider invoices, plan limits can be set from measured figures rather than estimates, and measured spend can be compared against the flat-subscription break-even to decide when switching provider pays for itself | BW-063 |
| BW-078 | Suggest competitor domains during onboarding | Run the provider competitor-discovery endpoint against the storefront during setup, filter out marketplaces, social networks, publishers, and the merchant's own domains, and present the remainder as suggestions with a reason and an explicit accept or reject action | Only accepted domains are written to `tenant_competitor_domains`, rejected and unreviewed suggestions are never read by imports or opportunity rules, and a provider failure leaves manual entry fully usable | BW-017, BW-063, BW-076 |
| BW-064 | Import competitor keywords | Let the merchant add competitor domains and run one market/language/device import for store and competitors | Market dimensions match, irrelevant domains can be removed, and normalized snapshots never overwrite history | BW-063, BW-076, BW-077 |
| BW-100 | Schedule and throttle the keyword import | Run the keyword import monthly per tenant from the n8n schedule, add a manual refresh in Settings that takes the same path under an idempotency key derived from the tenant and the week, and answer a repeat inside that window with the existing collection time | The monthly run happens with no merchant action and records its cost; a manual refresh inside the same week performs no provider request, spends nothing, and reports the data as already current alongside when it was collected rather than as an error or a failure; two simultaneous requests produce one import; and a failed import leaves the previous clusters and opportunities readable instead of emptying the section | BW-064, BW-077, BW-103 |
| BW-061 | Connect Search Console | Add Settings authorization, property selection, application-key-encrypted token storage, disconnect, and status | One verified property can be selected per tenant and tokens never appear in loaders, logs, job errors, or provider artifacts | BW-006, BW-060 |
| BW-062 | Import Search Console data | Register a scheduled, cursor-aware page-query import handler and retain the observed landing URL plus redacted source artifact | Repeated imports upsert the same observation date and disclose that top rows are not a complete query ledger | BW-008, BW-061 |
| BW-065 | Build the opportunity derived layer and the writing detectors | Add checked-in fixtures; normalize case and whitespace; union our own and every accepted competitor's ranked keywords into one observed result table keyed by keyword and domain; form clusters from the URLs that already rank so that terms one page has been proven to win group together; derive reachability from reported intent or from a tracked domain holding a top-ten position with an editorial URL, attainability from the gap between our own domain rank and the average domain rank of the pages ranking for the term, and the demand floor from a percentile of the tenant's own cluster distribution; and land the detector framework with striking distance, competitor gap, weak hold, partial cluster, and answerable question, each scoring reachability, demand, distance, proof, and catalogue relevance through one documented set of fixed component weights | Fixture outputs are deterministic, clusters are derived from observed ranking URLs rather than from term similarity, the observed result table is labelled as a floor on the competition rather than as a complete result page, a term whose reported difficulty is missing is still scored because attainability does not depend on it, a result-page feature carried by nearly every result page cannot act as a trigger, a cluster whose result pages carry an AI overview is valued below what its position and demand alone would suggest, thresholds are derived from the tenant's own measurements rather than from fixed constants so a niche store still receives opportunities, a detector can be added or switched off without changing the others, every row names the detector and evidence that produced it, no single detector may fill the ranked list, every recommendation resolves to exactly one of a new article, a refresh of a named article, scheduled work, or no article, a refresh names both the article it targets and the scope it asks for, and a low reported difficulty on a high-demand term cannot by itself promote a result to the top of the list | BW-062, BW-064 |
| BW-088 | Build the Keywords section shell | Add `/app/keywords` to the navigation and route shell as a wide page carrying the market, language, provider, and last-import line in the page accessory slot, a single banner slot for unresolved-market, import-running, and stale-import states, and the no-import-yet empty state | Direct navigation and tenant authentication work on every view, the header states the dimensions the numbers were measured in, at most one banner shows at a time and names the action that clears it, and an unresolved market shows that state and a link to Settings rather than showing numbers | BW-005, BW-076, BW-079 |
| BW-101 | Scope every keyword operation to the session tenant | Resolve the tenant from the authenticated Shopify session in every keyword loader, action, and job, accept no tenant identifier, shop domain, or store handle from the request, filter every query by the resolved identifier, and carry it on the job row for the scheduled and internal entry points | A request naming another store's tenant, domain, or handle reads nothing and spends nothing, no keyword route exposes an identifier a caller can substitute, the scheduled import runs against the tenant recorded on its own job row, and an isolation test covering imports, observations, clusters, opportunities, dismissals, and the manual refresh forms part of release acceptance | BW-005, BW-060, BW-088 |
| BW-066 | Build the Opportunities view | Render ranked clusters under Keywords with one row per cluster, the shape as the row kicker, the score components reachable from the recommendation without leaving the list, the claiming idea or article named on rows generation has already taken, a write-it-now action on unclaimed rows, and dismissal in a row menu | The view reports progress rather than collecting approvals and never gates generation on a merchant decision; a claimed row names what claimed it and offers no duplicate action; writing an unclaimed row now produces exactly one idea carrying that cluster and is idempotent; a refresh recommendation binds to the named article rather than creating a second article aimed at a cluster the store already owns; a dismissal retains its reason, survives the next import, and is never the easiest control in the row; spelling variants of one cluster never occupy separate rows; the table reads as a list on a narrow viewport without losing the shape or the recommendation | BW-024, BW-065, BW-088, BW-092 |
| BW-089 | Build the Competitors view | Render the store as the first row wearing a badge that names it as the store, then one row per confirmed competitor showing shared terms, average position across those shared terms, total ranking terms, top-ten terms, estimated organic traffic, last import, and attributed spend, plus a position-distribution histogram built from the position bands the provider already returns; surface undecided discovered domains with accept and reject actions | A merchant can tell which competitors produce gaps and which only cost money, every header names the population its number counts so nothing depends on column grouping that the narrow layout discards, shared-term and whole-domain figures are never blended into one column, the store row offers no accept, reject, or tracking actions, accepting a suggestion is the only path into `tenant_competitor_domains`, and removing a competitor never deletes the metric history it produced | BW-064, BW-077, BW-078, BW-088, BW-094 |
| BW-094 | Add the charting foundation | Add Recharts and one shared chart wrapper that takes its colours from Polaris tokens, renders the accompanying figures as text, and supports dated event markers for publications and revisions | Charts read as part of the admin rather than as a library's palette, every chart exposes the same figures to a screen reader without relying on the plot, a marker names the event and date it represents, and a series with one observation renders as a single measurement rather than as a trend | BW-088 |
| BW-090 | Build keyword detail | Build `/app/keywords/:keywordId` showing twelve-month demand as a line, our position over time with a marker at every publication or regeneration of an article targeting the term, difficulty, intent, result-page composition, related and long-tail terms, the owning cluster, and the article targeting the term when one exists | Every figure names its provider, market, language, and observation date; the route is read-only; publication markers are described as coincident in time and never as attribution; a position history with one observation reads as a single measurement rather than as a trend; a term with no provider coverage reads as unavailable rather than as zero demand | BW-064, BW-088, BW-094 |
| BW-091 | Build the Coverage view | Join the terms the store targets, from `blog_ideas.target_keyword` and article keyword targets, against the terms it actually ranks for from the provider; show position, ranking URL, demand, difficulty, intent, estimated traffic, and the targeting article, with the mismatch as the row kicker and one filter control offering targeted-but-not-ranking, ranking-but-not-targeted, and ranking-from-an-unintended-page | Each of the three mismatch filters returns the population it names and all three are reachable without changing route, an unresolved term reads as unverified rather than as a zero, a term the store does not rank for reads as an absence rather than as position zero, and a term already ranking through one page is visible before a second article is planned against it | BW-064, BW-075, BW-088 |
| BW-092 | Draw idea generation from opportunities automatically | Have idea generation read the tenant's highest-scoring unclaimed clusters and work from those with no merchant approval step, treat a free-text focus as a narrowing of that set rather than a replacement, record which cluster each returned idea came from, and mark a cluster claimed only once an idea exists | Asking for ideas without a focus still returns cluster-backed proposals, an idea generated from a cluster cites it and inherits its evidence, an idea generated without one stays allowed and stays labelled unverified, two concurrent runs cannot claim the same cluster, and a dismissed or suppressed cluster is never offered to generation | BW-023, BW-065, BW-075 |
| BW-095 | Detect uncovered catalogue opportunities | Add the detector that finds products and collections with no article supporting them, reading only synchronized Shopify data | The detector produces ranked output for a store with no keyword import and no provider spend, never proposes a second article for something already covered, and is labelled as first-party catalogue evidence rather than as measured search demand | BW-024, BW-060, BW-065 |
| BW-096 | Add trend and decay detectors | Add the seasonal lead time and rising-demand detectors, which read the twelve months of demand history and the trend direction the provider returns with the first import, and the decay detector, which reads the provider's reported previous rank where one exists and our own position history once we hold it | A seasonal proposal names the peak it is written for, states that one year of history shows a peak rather than a repeating pattern, and arrives with enough lead time to be actionable; a rising-demand proposal is distinguished from a merely high-demand one; decay runs on the first import for the terms carrying a previous rank and describes that interval as the provider's own check rather than as our import cycle; and a term whose position fell is distinguished from a term whose demand fell | BW-065, BW-070 |
| BW-067 | Add article keyword targets | Show primary, supporting, and observed queries; allow reviewed role changes and pass approved targets to generation | Observed queries do not become targets automatically and one primary target is enforced per article | BW-031, BW-062, BW-066 |
| BW-102 | Complete keyword inputs from observed terms | Back every keyword input, on manually added ideas and on article keyword targets, with autocomplete over the terms already observed for the store and for its accepted competitors, show each suggestion's demand and whether the store already ranks for it, and record a term taken from the list as resolved | A merchant can choose a real term without leaving the form, a chosen suggestion arrives resolved and is scored and counted as coverage immediately, a freehand term is still accepted and stays labelled unverified until it resolves against the provider, suggestions are drawn only from the session tenant's own import, and the control is operable by keyboard with the suggestion list and its selection announced | BW-064, BW-067, BW-075, BW-101 |
| BW-097 | Add the detectors that recommend not writing | Add cannibalization, product-page territory, out of reach, and adequately covered; emit cannibalization and product-page territory as visible rows carrying their action, let out of reach and adequately covered suppress instead, and keep every suppressed cluster queryable from the Keywords section with the rule that suppressed it | A split between two of our URLs is worded differently from a page ranking that we never targeted, a transactional or navigational cluster no tracked domain wins with an editorial URL is never proposed as an article, a cluster we already hold the top ten for with a targeting article produces no proposal, and a merchant asking why a term is absent from the list gets the rule and the evidence rather than silence | BW-065 |
| BW-093 | Compile and carry the generation directive | Compile the cluster an idea was generated from into a structured directive holding mode, the targeted article for a refresh, the primary term, supporting terms with roles, intent, landing-page shape, what the draft must cover, the competitor URLs proving the cluster, and the store resources to link; persist it on the idea and the plan item that follows it; have the generation workflows read it by identifier; and check the returned revision against it | The directive is stored as data rather than as brief prose and survives the merchant editing the brief, generation receives it by identifier in keeping with the existing thin-payload contract, a metadata-only directive is routed to a title-and-description workflow rather than sent to the draft workflow with an instruction not to touch the body, retrieval is biased toward the named store resources, and missing coverage of the primary target or of a required heading is reported as a review signal without blocking the draft | BW-026, BW-031, BW-067, BW-092 |
| BW-068 | Add rewrite warnings | Add deterministic diffs for removed targets, title or heading coverage, and accepted links; use one structured Langfuse and OpenRouter comparison for search-intent drift with checked-in fixtures | Specific warnings block publication only when their configured severity is material; save and revision review remain available | BW-034, BW-043, BW-067 |
| BW-069 | Capture rewrite and publication baselines | Before regeneration and publication, snapshot available 28-day and 90-day Search Console observations for the canonical URL and targets | The initiating job or publication points to the exact baseline and missing data is unavailable, not zero | BW-037, BW-048, BW-062 |
| BW-070 | Build Search performance trends | Show 7-day, 28-day, and 90-day prior-period and available year-over-year comparisons for clicks, impressions, CTR, and average position | Revision publication markers, provider, freshness, and incomplete-data notes remain visible and no causal claim is made | BW-062, BW-069 |
| BW-071 | Add performance-loss monitoring | On scheduled imports, compare documented thresholds and create one targeted refresh plan item for a meaningful loss | Repeated imports do not duplicate proposals, thresholds are visible, and seasonality or missing data suppress unsupported conclusions | BW-021, BW-070 |
| BW-072 | Prove ShopifyQL feasibility | Request the required approval and scope, then run bounded queries against Fencing Club for article pages, products, sessions, and commerce outcomes | Supported dimensions, time range, latency, and plan limitations are recorded before schema or UI is built | BW-001 |
| BW-073 | Import available ShopifyQL metrics | Add only the daily engagement columns and aggregate queries proven by BW-072, register the import handler, and persist through a small Shopify analytics adapter | Imports are idempotent, tenant-bound, and keep article metrics separate from product or store metrics | BW-008, BW-060, BW-072 |
| BW-074 | Build Store engagement and Sales impact | Show supported aggregate trends on article detail with coverage, source, and limitations; omit unsupported metrics | ShopifyQL and Search Console populations remain distinct and no date correlation is presented as attribution | BW-070, BW-073 |

## G. Home, operations, and release acceptance

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-080 | Build Home attention query | Aggregate onboarding progress, upcoming generation, drafts needing review, pending recommendations, affected articles, performance refresh proposals, and failed jobs | Every item links to its owning route and Home does not duplicate full planner or editor lists | BW-025, BW-032, BW-044, BW-071 |
| BW-081 | Build Home dashboard | Render the attention query in priority order with clear empty, loading, and recovery states | A merchant can identify the next useful action on desktop and a narrow embedded layout | BW-080 |
| BW-082 | Complete Settings | Add connection status, sync controls, publishing defaults, brand voice, content defaults, in-app notification preferences, source controls, SEO settings, Shopify analytics status, cadence, time zone, and data deletion actions | Settings exposes only implemented capabilities and destructive actions require confirmation | BW-055, BW-061, BW-072 |
| BW-083 | Add exhausted-job recovery | Define terminal as maximum attempts exhausted; add an operator command that inspects redacted details and replays by creating a linked new job | Operators can diagnose and replay exhausted work without editing the database; normal merchant retry remains in BW-009 | BW-007, BW-009 |
| BW-084 | Add minimum telemetry | Derive sync age, duration, job latency and attempts, generation failures, source refresh age, SEO freshness, and publication errors from job timestamps and structured redacted logs | Metrics identify tenant and job without tokens, article bodies, source bodies, or customer data | BW-048, BW-053, BW-062, BW-073 |
| BW-085 | Add calendar drag enhancement | Add drag between dates and backlog after the form controls are stable, using an approved accessible dependency only if needed | Pointer and keyboard users have equivalent movement and no drop triggers generation or publishing | BW-027, BW-049 |
| BW-086 | Complete accessibility acceptance | Test navigation, forms, editor, calendar, status announcements, dialogs, Sources, analytics, and preview at desktop and mobile widths | Automated checks pass and integrated-browser verification covers keyboard flow, accessible names, focus, and no overlap | BW-049, BW-055, BW-074, BW-081, BW-082, BW-085 |
| BW-087 | Run release acceptance | Run tenant-isolation tests, a clean migration, worker-restart recovery, the Fencing Club end-to-end journey, and `pnpm verify` | Gates A through G pass; ShopifyQL metrics proven unavailable in BW-072 may be omitted with the limitation documented | BW-049, BW-057, BW-074, BW-083, BW-084, BW-086, BW-104 |
| BW-103 | Host the app at a stable public address | Add a container image and deployment configuration for the app, run the built React Router server behind HTTPS on a host that owns its own environment, point `application_url` and `[auth] redirect_urls` at that address, and keep a separate app configuration for `shopify app dev` so a development tunnel never rewrites the deployed URLs | The embedded app loads from an address that survives a restart of both the host and the developer's machine, `shopify app deploy` publishes configuration without a tunnel present, a `shopify app dev` session leaves the deployed application URL untouched, and the internal task endpoint answers over HTTPS from outside the development machine | BW-005 |
| BW-104 | Prove the workflow-owned store sync end to end | Put `INTERNAL_TASK_TOKEN` into the deployed environment and into the matching n8n bearer credential, point the single-store workflow at the deployed address, publish both the single-store workflow and the 72-hour sweep, and run a sync from the Settings button and from the sweep against a real store | The button reports the tenant and resource count it actually synchronized; the sweep synchronizes a store with no merchant present and chains into embedding; a store already mid-sync is not started twice; one store failing does not stop the rest of the sweep; and every run, whichever way it started, is visible and retryable from one run history | BW-012, BW-103 |

## H. Corpus scale (after release)

Both tasks reduce the cost of a subscribed publication rather than adding merchant-facing capability, so neither blocks
BW-087. Schedule them when signup volume makes a full first-pass crawl per publication the limiting factor.

| ID | Task | Implementation | Acceptance | Depends on |
| --- | --- | --- | --- | --- |
| BW-098 | Bound the first crawl of a publication | Rank pending queue rows by recency within each publication, admit only a configured ceiling per hostname on the first pass, and leave the remainder in a background tier that is claimed only when no first-pass work is due | A newly subscribed publication supports retrieval within minutes instead of hours, the remainder still reaches the corpus without waiting for the next discovery run, and a large publication cannot starve a small one | BW-053, BW-056 |
| BW-099 | Route the content-cleaning pass by need | Score fetched markdown for boilerplate density before the language-model cleaning step, send only documents the score leaves ambiguous to the model, and use the provider's batch completion endpoint for backfill while reserving interactive completion for newly published documents | Documents the score accepts read the same in review as model-cleaned output, the model runs on a measured minority of documents rather than all of them, and a scoring or batch failure falls back to interactive cleaning instead of storing uncleaned text | BW-053 |

## Recommended implementation order

Work in vertical slices and stop at a usable checkpoint after each gate:

1. Complete Gate A, then verify a clean database and one background job before building screens on it.
2. Complete Gate B and validate Fencing Club before adding planning behavior.
3. Complete Gate C with explicit date controls and one idempotent generation path.
4. Complete Gate D as the first releasable editorial journey.
5. Add shared sources as Gate E without changing tenant-owned Shopify-resource storage.
6. In Gate F, resolve the market first, then land the keyword provider and the Keywords section, then let generation
   draw from clusters on its own. Search Console follows the keyword slice rather than leading it, and Shopify
   analytics is built only from the dimensions proven by BW-072.
7. Add drag only after Gate D, then complete Gate G and release. Do not pull deferred tracker, theme, collaboration, or
   Ahrefs work into a gate.

BW-103 sits in Gate G but does not wait for it. A development tunnel has no address that outlives a restart, so nothing
scheduled can run and no production store can install the app until the app is hosted. Bring BW-103 forward as soon as
either the 72-hour sweep or live-store acceptance becomes the thing standing in the way.

## Definition of done for each task

A task is complete only when:

- authenticated tenant identity is derived on the server and negative tenant-isolation behavior is covered where data
  is tenant-owned;
- input, persisted output, and external responses are validated at the owning boundary;
- focused unit or integration tests cover the new behavior and meaningful failure path;
- changed merchant-facing copy is reviewed with the Fluent Agent MCP when available;
- changed UX is exercised in the integrated browser at desktop and mobile widths, including keyboard and accessible-name
  behavior;
- the relevant documentation and environment examples are current;
- `pnpm verify` passes at the end of the coherent delivery slice.

## Explicitly outside the MVP

Do not schedule these tasks until BW-087 is complete unless a release blocker changes the decision:

- custom content analytics tracker and article journey attribution;
- theme app extension related-content blocks;
- Ahrefs and backlink analysis;
- a separate vector database or search service;
- automatic refresh campaigns;
- collaborative roles and approvals;
- campaign imports and external notification channels;
- generalized connector, queue, rules, or event platforms.