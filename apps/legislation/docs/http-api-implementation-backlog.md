# HTTP API implementation backlog

## Purpose

This is the delivery ledger for the HTTP API, Railway release, and MCP cutover. Every endpoint has one current state:

- **Ready**: its prerequisites exist and implementation may start.
- **In progress**: code exists or is being reviewed, but the endpoint has not passed its phase gate.
- **Blocked**: a named dependency, provider, persistence adapter, or product decision is missing.
- **Done**: the route matches the contract, has focused tests, passed smoke testing, and is included in a reviewed commit.

An endpoint is not **Done** merely because a route handler exists. Each phase is committed only after root review and
the verification listed below. The endpoint contract remains the source of truth for request and response bodies.
The execution gate is the [local smoke and MCP parity checklist](http-api-local-smoke-and-parity.md). This ledger was
last reconciled with the reviewed implementation and authenticated scoped-bills smoke on 2026-08-24. Two scoped bill
collections have the smoke and reviewed-commit evidence required for **Done**. Current totals are 16 **In progress**,
69 **Blocked**, 0 **Ready**, and 2 **Done** across 87 endpoints.

## Delivery phases

| ID | Phase | State | Granular tasks and exit gate |
| --- | --- | --- | --- |
| API-00 | Contract and dependency foundation | In progress | Keep the complete endpoint contract and MCP parity map current; maintain this ledger; install a reproducible web framework dependency graph; use TanStack Start if its public packages can be locked and built, otherwise replace the shell with the latest stable Next.js; run format, type, and contract checks. |
| API-01 | Shared HTTP foundation | In progress | Root review accepted the routing/envelope/error foundation and focused protocol tests. Conditional caching, composed authenticated local smoke, repository-wide verification, and the reviewed commit remain. |
| API-02 | Canonical legislative reads | In progress | Root review accepted the current core-read handler foundation and focused tests. Complete canonical contract projections, missing filters/relationships, source links, authenticated database smoke, parity evidence, and the reviewed commit. |
| API-03 | Civic graph, meetings, search, and diffs | In progress | Root review accepted the current civic/search handler foundation and focused validation. Complete canonical projections, missing filters/relationships, truthful model metadata, database-backed smoke/parity evidence, and the reviewed commit. |
| API-04 | Subscriptions and webhooks | In progress | The authenticated subscription read routes are composed with scope-aware persistence, documented filters, keyset pagination, and focused tests. They await remote authenticated smoke and MCP parity. Subscription mutations and all webhook routes remain blocked on the matcher/materializer, delivery workers, KMS-backed `WebhookSecretProtector`, pinned outbound verification/delivery executors, retry/dead-letter worker, and remaining authorization composition. |
| API-05 | Local smoke and parity | In progress | The scoped-bills composed-server profile has passed locally. Execute the remaining authenticated fixture, canonical projection, pagination, negative-path, model-routing, and MCP-parity checks per product; do not promote an endpoint on handler-unit evidence alone. |
| API-06 | Railway API release | Done | `legislation-api` is deployed at the recorded Railway release. `WORKOS_API_AUDIENCE` isolates the API token audience from the MCP resource audience. Health, readiness, unauthenticated API/MCP challenges, and the authenticated scoped-bills remote smoke passed; the rollback target is documented. |
| API-07 | MCP HTTP migration | Blocked | Production remains explicitly `in-process`. Per product decision, do not enable a production HTTP canary or cut over any MCP method until every one of the 87 API endpoints is **Done** and the full parity suite passes. |
| API-08 | Hardening and completion | Blocked | Generate and validate OpenAPI, add rate limits and observability, validate daily incremental behavior, finish blocked data/provider work, update every endpoint state, run scoped and repository verification, and commit final documentation. |

## Review and commit protocol

For each deliverable:

1. The assignee implements only its bounded phase slice and reports files, tests, assumptions, and remaining gaps.
2. The root agent reviews correctness, contract parity, authorization, data exposure, operational safety, and tests.
3. Review feedback is returned to the same assignee and resolved before acceptance.
4. Focused checks run first, followed by the broadest clean verification practical in the dirty monorepo.
5. Only the exact reviewed files are staged. A normal verified commit is attempted first; hook bypass is reserved for a
   demonstrated unrelated repository blocker and is recorded in the handoff.

## Endpoint state matrix

Root review has accepted the current shared, core-read, civic/search, and subscription-security foundations. **In
progress** below therefore means the route has reviewed implementation and focused tests but still lacks one or more of
the exact contract projection, live database smoke, MCP parity, or reviewed-commit gates. The four subscription read
handlers are composed and await remote authenticated smoke and MCP parity. Subscription mutations and webhook handlers
remain intentionally uncomposed and **Blocked**.

### Legislative records and documents

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/jurisdictions` | Blocked | The additive canonical-foundation schema, guarded importer, checkpoint, and fail-closed audit exist. No authoritative source snapshot has supplied complete jurisdiction active/provenance facts, so the route remains intentionally unregistered. |
| GET | `/api/jurisdictions/{jurisdictionId}` | Blocked | The additive canonical-foundation schema, guarded importer, checkpoint, and fail-closed audit exist. No authoritative source snapshot has supplied complete jurisdiction active/provenance facts, so the route remains intentionally unregistered. |
| GET | `/api/jurisdictions/{jurisdictionId}/sessions` | Blocked | The additive canonical-foundation schema, guarded importer, checkpoint, and fail-closed audit exist. No authoritative source snapshot has supplied session classification/provenance facts, so the route remains intentionally unregistered. |
| GET | `/api/jurisdictions/{jurisdictionId}/bills` | Done | Exact canonical projection and scoped filters passed the authenticated remote `scoped-bills` profile for `jurisdiction:ak`; `introduced-desc` avoids the separately tracked default latest-action performance work. |
| GET | `/api/jurisdictions/{jurisdictionId}/organizations` | Blocked | Jurisdiction-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/commissions` | Blocked | Classification-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/committees` | Blocked | Classification-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/meetings` | Blocked | `legislative_events` lacks a session relationship and authoritative local date, canonical organization relation, and typed location/virtual-access fields required for `MeetingSummary`; route is intentionally unregistered. |
| GET | `/api/sessions/{sessionId}` | Blocked | The additive canonical-foundation schema, guarded importer, checkpoint, and fail-closed audit exist. No authoritative source snapshot has supplied session classification/provenance facts, so the route remains intentionally unregistered. |
| GET | `/api/sessions/{sessionId}/bills` | Done | Exact canonical projection and scoped filters passed the authenticated remote `scoped-bills` profile for `session:ak:30`; `introduced-desc` avoids the separately tracked default latest-action performance work. |
| GET | `/api/sessions/{sessionId}/meetings` | Blocked | An authoritative event-session relation is missing; inferring through `event_bills` omits session meetings without linked bills. |
| GET | `/api/bills` | In progress | Reviewed handler exists; remaining filters, canonical projection, stable-order database smoke, parity, and commit remain. |
| POST | `/api/bills/batch` | Blocked | Route is intentionally unregistered: the query service has no independent child cursors or complete canonical child records. Strict `BillDetail` projector coverage exists; unblock with persisted child-page/provenance facts, then add batch item-isolation smoke and live parity. |
| POST | `/api/bills/amendments/batch` | Blocked | Route is intentionally unregistered: structured and document-backed amendments do not have an authoritative non-null bill and title policy, and the query lacks the complete contract filters. Persist and backfill that policy, then add independent per-bill canonical pages and cursors with item-isolated errors, plus database smoke and parity. |
| GET | `/api/bills/{billId}` | Blocked | Route is intentionally unregistered: the query service does not retain the complete canonical child/provenance shape or independent child cursors. Strict `BillDetail` projector coverage exists; unblock with the data-layer projection, then add envelope smoke and live parity. |
| GET | `/api/bills/{billId}/timeline` | Blocked | Route is intentionally unregistered: historical action/vote rows do not satisfy the strict discriminated canonical timeline union or requested filtering. Strict ISO date/RFC 3339 timeline projector coverage exists; unblock with data-layer construction/filtering and live parity. |
| GET | `/api/bills/{billId}/related` | Blocked | Route is intentionally unregistered: related-bill rows lack immutable relation provenance, direction, and constrained classification. Persist those facts, then add scoped semantic availability as a typed 503 and stable keyset paging for exact canonical hits before registering it. |
| GET | `/api/bills/{billId}/sections` | Blocked | Route is intentionally unregistered: bill text traversal has no persisted/backfilled page mapping or all-processed-version keyset traversal, and cannot preserve repeated document/version filters across pages. Add those durable mappings and traversal semantics before registering it. |
| GET | `/api/bills/{billId}/amendments` | Blocked | Route is intentionally unregistered: structured and document-backed amendments do not have an authoritative non-null bill and title policy, and the query lacks the complete contract filters. Persist and backfill that policy, then add the strict canonical summary projection and stable paging before registering it. |
| GET | `/api/bills/{billId}/votes` | Blocked | Route is intentionally unregistered: votes lack the required publisher-local date, normalized result and nine-bucket counts, complete canonical provenance, publisher position sequence, and contract filters. Persist and backfill those facts, add a complete `VoteDetail` page query, then prove live parity. |
| GET | `/api/bills/{billId}/documents` | In progress | Bounded canonical database query, strict filters/cursor scope, and HTTP Page projection exist. Remaining gates: authenticated Railway smoke and live MCP parity. |
| GET | `/api/bills/{billId}/changes` | Blocked | Route is intentionally unregistered: change events lack an immutable observation-time source snapshot. Joining the affected record live would rewrite historical values. Persist the canonical affected-record snapshot, typed change payload, provenance, and keyset order, then prove database/MCP parity before registering it. |
| GET | `/api/amendments` | Blocked | Route is intentionally unregistered: the current mixed structured/document query returns persistence rows rather than `AmendmentSummary`; it lacks the contract filters and ordering, and nullable structured `billId` cannot satisfy the required canonical field. |
| POST | `/api/amendments/batch` | Blocked | Route is intentionally unregistered: the raw item path cannot produce `AmendmentDetail` without fabricating detail relationships or returning a mixed noncanonical batch. |
| GET | `/api/amendments/{amendmentId}` | Blocked | Route is intentionally unregistered: structured records lack a canonical document relation and document-backed records lack persisted OCR status needed for `DocumentSummary`; action dates/source URLs are nullable, so a complete canonical detail cannot be guaranteed. |
| GET | `/api/votes` | Blocked | Route is intentionally unregistered: the query exposes raw votes without the required publisher-local date, normalized result, all nine count buckets, canonical provenance, jurisdiction binding, complete filters, or contract order. Persist/backfill the facts and add the canonical summary query before registering it. |
| POST | `/api/votes/batch` | Blocked | Route is intentionally unregistered: raw vote and position rows cannot produce an exact `VoteDetail`; required vote provenance/date/count/result facts and canonical people are incomplete. Add a strict detail query and item-isolation/live parity coverage after the data repair. |
| GET | `/api/votes/{voteId}` | Blocked | Route is intentionally unregistered: raw vote and position rows cannot produce an exact `VoteDetail`; required vote provenance/date/count/result facts and canonical people are incomplete. Add a strict detail query and live parity coverage after the data repair. |
| GET | `/api/votes/{voteId}/positions` | Blocked | Dedicated paginated position query is missing; rows also lack the publisher sequence required for contract ordering and linked people can lack canonical provenance. |
| GET | `/api/documents/{documentId}` | In progress | Strict canonical detail query and resource projection exist. It exposes `storedUrl: null` until a routable artifact URL is persisted and rejects incomplete OCR/provenance records. Remaining gates: authenticated Railway smoke and live MCP parity. |
| GET | `/api/documents/{documentId}/sections` | In progress | Bounded heading/page keyset query and canonical Page projection exist. Historical incomplete page/OCR facts fail closed rather than being inferred. Remaining gates: authenticated Railway smoke and live MCP parity. |
| GET | `/api/documents/{documentId}/sections/{sectionId}` | In progress | Canonical projector and contract exist; singular repository query, handler tests, live smoke/parity, and commit remain. |
| GET | `/api/supporting-materials` | In progress | Canonical collection projection, bounded filters/sorts, and focused query/handler coverage exist; authenticated Railway smoke, live MCP parity, and commit remain. |
| GET | `/api/supporting-materials/{materialId}` | In progress | Canonical detail/provenance projection and aggregate-count coverage exist; authenticated Railway smoke, live MCP parity, and commit remain. |
| GET | `/api/supporting-materials/{materialId}/sections` | Blocked | The ordinal/heading query exists, but the contract also requires `pageFrom` and `pageTo`; supporting-material source page mappings are not persisted. The route remains intentionally unregistered until those mappings and page-overlap filtering are available. |
| GET | `/api/supporting-materials/{materialId}/sections/{sectionId}` | In progress | Canonical projector and contract exist; singular repository query, handler tests, live smoke/parity, and commit remain. |
| GET | `/api/changes` | Blocked | Route is intentionally unregistered: change events lack an immutable observation-time source snapshot. Joining the affected record live would rewrite historical values. Persist the canonical affected-record snapshot, typed change payload, provenance, documented filters, and keyset order, then prove database/MCP parity before registering it. |
| POST | `/api/resources/batch` | Blocked | Cross-resource dispatcher and canonical union projection are missing. |

### Civic graph and events

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/people` | Blocked | Route is intentionally unregistered: `people.source_url` and `is_active` are nullable, while canonical provenance and `isActive` are required; the query also lacks `party`/`sort` filters and stored aliases. Backfill provenance/activity and add the canonical query before registering it. |
| GET | `/api/people/{personId}` | Blocked | Route is intentionally unregistered: no persisted aliases, image, public email, official URL, external identifiers, canonical person-jurisdiction set, or required term office title; membership role/provenance is incomplete. Add authoritative profile and relationship facts before registering it. |
| GET | `/api/people/{personId}/bills` | Blocked | Role-aware sponsorship/action query is missing. |
| GET | `/api/people/{personId}/amendments` | Blocked | Person-amendment relationship query is missing. |
| GET | `/api/people/{personId}/votes` | Blocked | Person vote-position activity query is missing. |
| GET | `/api/people/{personId}/memberships` | Blocked | Historical membership query is missing. |
| GET | `/api/people/{personId}/terms/{termId}` | Blocked | Canonical projector exists; direct person-scoped term lookup and handler are missing. |
| GET | `/api/organizations` | Blocked | Route is intentionally unregistered: `source_url` and `is_active` are nullable, chamber values are unconstrained, and the query lacks `chamber`/`sort` filters. Backfill canonical provenance/activity and add constrained projection/filtering before registering it. |
| GET | `/api/organizations/{organizationId}` | Blocked | Route is intentionally unregistered: no persisted description, website, public contact, or terms of reference; children are unbounded and memberships lack canonical embedded-record provenance. Add profile facts and bounded canonical child queries before registering it. |
| GET | `/api/organizations/{organizationId}/members` | Blocked | Historical organization membership query is missing. |
| GET | `/api/organizations/{organizationId}/memberships/{membershipId}` | Blocked | Canonical projector exists; direct organization-scoped membership lookup and handler are missing. |
| GET | `/api/organizations/{organizationId}/meetings` | Blocked | `legislative_events` lacks a session relationship and authoritative local date, canonical organization relation, and typed location/virtual-access fields required for `MeetingSummary`; route is intentionally unregistered. |
| GET | `/api/organizations/{organizationId}/bills` | Blocked | Organization-bill relationship query is missing. |
| GET | `/api/organizations/{organizationId}/calendars` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/meetings` | Blocked | Route is intentionally unregistered: `source_url` is nullable; location and virtual access are untyped JSON; no authoritative local date, session, or calendar relation exists; and the query lacks calendar, bill, classification, status, remote, and sort filters. Persist typed canonical facts before registering it. |
| GET | `/api/meetings/{meetingId}` | Blocked | Route is intentionally unregistered: child collections are raw/unbounded; agenda rows lack title/status/amendment/material relations, event documents lack canonical links/classification, and outcome links lack description/classification/agenda relations. Add complete bounded child projections before registering it. |
| GET | `/api/meetings/{meetingId}/agenda` | Blocked | Agenda-item query/projection is missing. |
| GET | `/api/meetings/{meetingId}/agenda/{agendaItemId}` | Blocked | Canonical projector exists; direct meeting-scoped agenda-item lookup and handler are missing. |
| GET | `/api/meetings/{meetingId}/documents` | Blocked | Event-document relationship query is missing. |
| GET | `/api/meetings/{meetingId}/documents/{eventDocumentId}` | Blocked | Canonical projector exists; direct meeting-scoped event-document lookup and handler are missing. |
| GET | `/api/meetings/{meetingId}/outcomes` | Blocked | Meeting outcome query is missing. |
| GET | `/api/meetings/{meetingId}/outcomes/{outcomeId}` | Blocked | Canonical projector exists; direct meeting-scoped outcome lookup and handler are missing. |
| GET | `/api/meetings/{meetingId}/participants` | Blocked | Meeting participant query is missing. |
| GET | `/api/meetings/{meetingId}/participants/{participantId}` | Blocked | Canonical projector exists; direct meeting-scoped participant lookup and handler are missing. |
| GET | `/api/calendars` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/calendars/{calendarId}` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/calendars/{calendarId}/meetings` | Blocked | Durable calendar resources are not modeled. |
| POST | `/api/representative-lookups` | Blocked | Address-to-district provider, privacy policy, and first-party UX are pending. |

### Search and document differences

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| POST | `/api/search/bills` | In progress | Canonical bill hits, actual model/rerank metadata, every documented filter including BaseSearch `from`/`to` inclusive `BillSummary.updatedAt` bounds (a date-only upper bound includes that full UTC day), capped cursors, and focused handler/query/projection tests exist. Remaining gates: database-backed ranking/filter integration, authenticated Railway smoke, MCP parity, review, and commit. |
| POST | `/api/search/amendments` | Blocked | Intentionally unregistered: `AmendmentSummary.billId` is required while structured amendment rows permit a null bill relationship. Define and backfill an authoritative relationship policy, then add independently retrieved structured and document records, complete filters, canonical hits, and actual model metadata. |
| POST | `/api/search/passages` | Blocked | Intentionally unregistered: `DocumentSummary` requires durable OCR status, but `bill_documents` only persists processing status. Persist and backfill OCR state, then add canonical section-document-bill projection, highlight ranges, complete filters, and actual model metadata. |
| POST | `/api/search/supporting-materials` | In progress | Canonical bounded-section hits, lexical/semantic/hybrid score and model metadata, all documented material/link/session/date filters, and hostile-Host-safe canonical URLs are implemented and focused-tested. Remaining gates: database-backed ranking/filter integration, authenticated Railway smoke, MCP parity, review, and commit. |
| POST | `/api/search/all` | Blocked | Cross-product fusion and stable pagination policy are missing. |
| POST | `/api/document-diffs` | Blocked | Intentionally unregistered: document canonical projection lacks durable OCR state, and the comparison service only returns section before/after text. Add OCR state plus an exact bounded diff engine with ownership and processing conflict semantics, granularity, operations and offsets, counts, cursors, hunk sources, and canonical document summaries. |
| POST | `/api/research/answers` | Blocked | Approved generation provider, citation verifier, and budget controls are missing. |

### Subscriptions and webhooks

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/subscriptions` | In progress | Authenticated route composition, scope-aware persistence, documented filters, and keyset pagination are implemented and focused-tested. Remaining gate: remote authenticated smoke and MCP parity. |
| POST | `/api/subscriptions` | Blocked | Durable scope-aware repository, transactional event/audit writer, and encrypted 24-hour idempotency boundary now exist; matcher/materializer, delivery executors, and route composition/authorization remain. |
| GET | `/api/subscriptions/{subscriptionId}` | In progress | Authenticated scope-aware lookup and ETag route composition are implemented and focused-tested. Remaining gate: remote authenticated smoke and MCP parity. |
| PATCH | `/api/subscriptions/{subscriptionId}` | Blocked | Reviewed revision/validation foundation, durable scope/revision transaction, and encrypted replay boundary now exist; route composition/authorization adapter remains. |
| DELETE | `/api/subscriptions/{subscriptionId}` | Blocked | Durable scope/revision cancellation, transactional event/audit writer, and encrypted replay boundary now exist; delivery shutdown and route composition/authorization remain. |
| GET | `/api/subscriptions/{subscriptionId}/events` | In progress | Authenticated scope-aware event listing, documented filters, and keyset pagination are implemented and focused-tested. Remaining gate: remote authenticated smoke and MCP parity. Event matching/materialization remains a mutation-delivery prerequisite, not a read-route prerequisite. |
| GET | `/api/subscriptions/{subscriptionId}/deliveries` | In progress | Authenticated scope-aware delivery listing, documented filters, and keyset pagination are implemented and focused-tested. Remaining gate: remote authenticated smoke and MCP parity. Attempt workers remain a mutation-delivery prerequisite, not a read-route prerequisite. |
| GET | `/api/webhooks` | In progress | Authenticated scope-aware persistence, documented status/eventType filters, keyset pagination, and canonical projection are implemented and focused-tested. Remaining gate: remote authenticated smoke and MCP parity. |
| POST | `/api/webhooks` | Blocked | Nominal encrypted-secret boundary exists; KMS protector, durable repository, encrypted replay, and verification executor are missing. |
| GET | `/api/webhooks/{webhookId}` | In progress | Authenticated scope-aware lookup, canonical projection, and ETag route composition are implemented and focused-tested. Remaining gate: remote authenticated smoke and MCP parity. |
| PATCH | `/api/webhooks/{webhookId}` | Blocked | Reviewed validation/revision foundation exists; durable revision/verification-state transaction and replay executor are missing. |
| DELETE | `/api/webhooks/{webhookId}` | Blocked | Durable cancellation, linked-delivery shutdown, audit persistence, and exact replay are missing. |
| POST | `/api/webhooks/{webhookId}/rotate-secret` | Blocked | Reviewed overlap/secret foundation exists; KMS encryption, transactional key persistence/expiry, and encrypted replay are missing. |
| POST | `/api/webhooks/{webhookId}/verify` | Blocked | Approved-destination/revalidation boundary exists; a pinned connection-time-revalidating challenge transport and durable activation transaction are missing. |

## MCP cutover gates

The MCP remains on its current application service until all of these are true:

- the Railway API deployment is terminal `SUCCESS` and authenticated smoke tests pass;
- every one of the 87 API endpoints is **Done** before any production MCP HTTP canary or cutover;
- an HTTP client preserves canonical IDs, pagination, error semantics, timeouts, and trace context;
- MCP-vs-HTTP fixtures show no material result loss for bills, amendments, votes, documents, meetings, and search;
- a configuration switch can immediately restore the in-process adapter without a redeploy;
- the remote canary shows acceptable latency and no authorization or provider regression.

The current release evidence and remaining MCP-cutover gate are recorded in
[the Railway API release record](http-api-railway-release.md). The endpoint matrix is 11 **In progress**, 74
**Blocked**, and 2 **Done** routes; the two scoped bill collections are the only completed endpoint rows.
