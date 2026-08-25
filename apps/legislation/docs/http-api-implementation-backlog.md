# HTTP API implementation backlog

## Purpose

This is the delivery ledger for the HTTP API and Railway release. Every endpoint has one current state:

- **Ready**: its prerequisites exist and implementation may start.
- **In progress**: code exists or is being reviewed, but the endpoint has not passed its phase gate.
- **Blocked**: a named dependency, provider, persistence adapter, or product decision is missing.
- **Done**: exact contract implementation exists with applicable repository/query evidence and focused endpoint tests/smoke, root review, and a reviewed commit.

An endpoint is not **Done** merely because a route handler exists. Each phase is committed only after root review and
the verification listed below. The endpoint contract remains the source of truth for request and response bodies.
The execution gate is the [local smoke checklist](http-api-local-smoke.md). This ledger was last reconciled on
2026-08-24 with the reviewed endpoint implementations in commits `4546f7a`, `0fa41dc`, and `87f38be`, 14 successful
composed-smoke routes, focused endpoint and query tests, and the two previously completed scoped-bill collections.
Canonical meeting outcome persistence and reads are complete. Current totals are 0 **In progress**, 48 **Blocked**, 0
**Ready**, and 39 **Done** across 87 endpoints.

## Delivery phases

| ID | Phase | State | Granular tasks and exit gate |
| --- | --- | --- | --- |
| API-00 | Contract and dependency foundation | In progress | Keep the complete endpoint contract current; install a reproducible web framework dependency graph; use TanStack Start if its public packages can be locked and built, otherwise replace the shell with the latest stable Next.js; run format, type, and contract checks. |
| API-01 | Shared HTTP foundation | In progress | Root review accepted the routing/envelope/error foundation and focused protocol tests. Conditional caching, composed local smoke, and the reviewed commit remain. |
| API-02 | Canonical legislative reads | In progress | Root review accepted the current core-read handler foundation and focused tests. Complete canonical contract projections, missing filters/relationships, source links, database-backed smoke, root review, and the reviewed commit. |
| API-03 | Civic graph, meetings, search, and diffs | In progress | Root review accepted the current civic/search handler foundation and focused validation. Complete canonical projections, missing filters/relationships, truthful model metadata, database-backed smoke evidence, root review, and the reviewed commit. |
| API-04 | Subscriptions and webhooks | In progress | The subscription and webhook read routes have complete endpoint evidence and are **Done**. Subscription and webhook mutations remain blocked on the matcher/materializer, delivery workers, KMS-backed `WebhookSecretProtector`, pinned outbound verification/delivery executors, retry/dead-letter worker, and remaining authorization composition. |
| API-05 | Local smoke validation | In progress | The scoped-bills composed-server profile has passed locally. Execute the remaining fixture, canonical projection, pagination, negative-path, and model-routing checks per product; do not promote an endpoint on handler-unit evidence alone. |
| API-06 | Railway API release | Done | `legislation-api` is deployed at the recorded Railway release. `WORKOS_API_AUDIENCE` isolates the API token audience. Health, readiness, API challenges, and the scoped-bills remote smoke passed; the rollback target is documented. This is release evidence, not an endpoint completion gate. |
| API-08 | Hardening and completion | Blocked | Generate and validate OpenAPI, add rate limits and observability, validate daily incremental behavior, finish blocked data/provider work, update every endpoint state, run scoped and repository verification, and commit final documentation. |

## Review and commit protocol

For each deliverable:

1. The assignee implements only its bounded phase slice and reports files, tests, assumptions, and remaining gaps.
2. The root agent reviews correctness, contract projection, authorization, data exposure, operational safety, and tests.
3. Review feedback is returned to the same assignee and resolved before acceptance.
4. Focused checks run first, followed by the broadest clean verification practical in the dirty monorepo.
5. Only the exact reviewed files are staged. A normal verified commit is attempted first; hook bypass is reserved for a
   demonstrated unrelated repository blocker and is recorded in the handoff.

## Endpoint state matrix

Root review has accepted the current shared, core-read, civic/search, and subscription-security foundations. **In
progress** below therefore means the route has reviewed implementation and focused tests but still lacks one or more of
the exact contract projection, applicable repository/query evidence, focused endpoint smoke, root review, or
reviewed-commit gates. The currently implemented read and search endpoints have cleared those gates. Subscription
mutations and webhook mutation handlers remain intentionally uncomposed and **Blocked**.

### Legislative records and documents

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/jurisdictions` | Blocked | The additive canonical-foundation schema, guarded importer, checkpoint, and fail-closed audit exist. No authoritative source snapshot has supplied complete jurisdiction active/provenance facts, so the route remains intentionally unregistered. |
| GET | `/api/jurisdictions/{jurisdictionId}` | Done | Parent-bound lookup, strict canonical provenance/activity projection, exact Resource envelope, focused tests, root review, and reviewed commit `87f38be`; incomplete persisted rows fail closed with 422. |
| GET | `/api/jurisdictions/{jurisdictionId}/sessions` | Done | Parent-bound interval query, open-ended interval semantics, stable filter-bound keyset pagination, strict canonical projection, focused tests, root review, and reviewed commit `2620c25`. |
| GET | `/api/jurisdictions/{jurisdictionId}/bills` | Done | Exact canonical projection and scoped filters have focused endpoint test/smoke and reviewed-commit evidence for the `scoped-bills` profile for `jurisdiction:ak`; `introduced-desc` avoids the separately tracked default latest-action performance work. |
| GET | `/api/jurisdictions/{jurisdictionId}/organizations` | Done | Parent-bound jurisdiction query, exact filters, stable filter-bound pagination, strict canonical projection, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/jurisdictions/{jurisdictionId}/commissions` | Done | Fixed commission classification view, exact filters, canonical projection, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/jurisdictions/{jurisdictionId}/committees` | Done | Fixed committee classification view with chamber and parent filters, canonical projection, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/jurisdictions/{jurisdictionId}/meetings` | Blocked | `legislative_events` lacks a session relationship and authoritative local date, canonical organization relation, and typed location/virtual-access fields required for `MeetingSummary`; route is intentionally unregistered. |
| GET | `/api/sessions/{sessionId}` | Done | Exact lookup and Resource envelope with strict canonical classification/activity/provenance projection, focused tests, root review, and reviewed commit `2620c25`; incomplete persisted rows fail closed with 422. |
| GET | `/api/sessions/{sessionId}/bills` | Done | Exact canonical projection and scoped filters have focused endpoint test/smoke and reviewed-commit evidence for the `scoped-bills` profile for `session:ak:30`; `introduced-desc` avoids the separately tracked default latest-action performance work. |
| GET | `/api/sessions/{sessionId}/meetings` | Blocked | An authoritative event-session relation is missing; inferring through `event_bills` omits session meetings without linked bills. |
| GET | `/api/bills` | Done | Complete documented filters, deterministic sort plus ID ordering, filter-bound cursors, canonical Page projection, focused query/handler coverage, root review, and reviewed commit `4546f7a`. |
| POST | `/api/bills/batch` | Blocked | Route is intentionally unregistered: the query service has no independent child cursors or complete canonical child records. Strict `BillDetail` projector coverage exists; unblock with persisted child-page/provenance facts, then add batch item-isolation smoke before enabling the route. |
| POST | `/api/bills/amendments/batch` | Blocked | Route is intentionally unregistered: structured and document-backed amendments do not have an authoritative non-null bill and title policy, and the query lacks the complete contract filters. Persist and backfill that policy, then add independent per-bill canonical pages and cursors with item-isolated errors plus database smoke before enabling the route. |
| GET | `/api/bills/{billId}` | Blocked | Route is intentionally unregistered: the query service does not retain the complete canonical child/provenance shape or independent child cursors. Strict `BillDetail` projector coverage exists; unblock with the data-layer projection, then add envelope smoke before enabling the route. |
| GET | `/api/bills/{billId}/timeline` | Blocked | Route is intentionally unregistered: historical action/vote rows do not satisfy the strict discriminated canonical timeline union or requested filtering. Strict ISO date/RFC 3339 timeline projector coverage exists; unblock with data-layer construction/filtering before enabling the route. |
| GET | `/api/bills/{billId}/related` | Blocked | Route is intentionally unregistered: related-bill rows lack immutable relation provenance, direction, and constrained classification. Persist those facts, then add scoped semantic availability as a typed 503 and stable keyset paging for exact canonical hits before registering it. |
| GET | `/api/bills/{billId}/sections` | Blocked | Route is intentionally unregistered: bill text traversal has no persisted/backfilled page mapping or all-processed-version keyset traversal, and cannot preserve repeated document/version filters across pages. Add those durable mappings and traversal semantics before registering it. |
| GET | `/api/bills/{billId}/amendments` | Blocked | Route is intentionally unregistered: structured and document-backed amendments do not have an authoritative non-null bill and title policy, and the query lacks the complete contract filters. Persist and backfill that policy, then add the strict canonical summary projection and stable paging before registering it. |
| GET | `/api/bills/{billId}/votes` | Blocked | Route is intentionally unregistered: votes lack the required publisher-local date, normalized result and nine-bucket counts, complete canonical provenance, publisher position sequence, and contract filters. Persist and backfill those facts, add a complete `VoteDetail` page query, then complete database smoke before enabling the route. |
| GET | `/api/bills/{billId}/documents` | Done | Bounded canonical database query, strict filters/cursor scope, HTTP Page projection, composed endpoint smoke, root review, and reviewed commit evidence exist. |
| GET | `/api/bills/{billId}/changes` | Blocked | Route is intentionally unregistered: change events lack an immutable observation-time source snapshot. Joining the affected record live would rewrite historical values. Persist the canonical affected-record snapshot, typed change payload, provenance, and keyset order, then complete database smoke before registering it. |
| GET | `/api/amendments` | Blocked | Route is intentionally unregistered: the current mixed structured/document query returns persistence rows rather than `AmendmentSummary`; it lacks the contract filters and ordering, and nullable structured `billId` cannot satisfy the required canonical field. |
| POST | `/api/amendments/batch` | Blocked | Route is intentionally unregistered: the raw item path cannot produce `AmendmentDetail` without fabricating detail relationships or returning a mixed noncanonical batch. |
| GET | `/api/amendments/{amendmentId}` | Blocked | Route is intentionally unregistered: structured records lack a canonical document relation and document-backed records lack persisted OCR status needed for `DocumentSummary`; action dates/source URLs are nullable, so a complete canonical detail cannot be guaranteed. |
| GET | `/api/votes` | Blocked | Route is intentionally unregistered: the query exposes raw votes without the required publisher-local date, normalized result, all nine count buckets, canonical provenance, jurisdiction binding, complete filters, or contract order. Persist/backfill the facts and add the canonical summary query before registering it. |
| POST | `/api/votes/batch` | Blocked | Route is intentionally unregistered: raw vote and position rows cannot produce an exact `VoteDetail`; required vote provenance/date/count/result facts and canonical people are incomplete. Add a strict detail query and item-isolation coverage after the data repair. |
| GET | `/api/votes/{voteId}` | Blocked | Route is intentionally unregistered: raw vote and position rows cannot produce an exact `VoteDetail`; required vote provenance/date/count/result facts and canonical people are incomplete. Add a strict detail query and database smoke coverage after the data repair. |
| GET | `/api/votes/{voteId}/positions` | Blocked | Dedicated paginated position query is missing; rows also lack the publisher sequence required for contract ordering and linked people can lack canonical provenance. |
| GET | `/api/documents/{documentId}` | Done | Strict canonical detail query/resource projection and composed endpoint smoke exist. It exposes `storedUrl: null` until a routable artifact URL is persisted and fails closed for incomplete OCR/provenance records. |
| GET | `/api/documents/{documentId}/sections` | Done | Bounded heading/page keyset query, canonical Page projection, composed endpoint smoke, root review, and reviewed commit evidence exist. Historical incomplete page/OCR facts fail closed. |
| GET | `/api/documents/{documentId}/sections/{sectionId}` | Done | Dedicated parent-bound repository query, strict canonical Resource projection, wrong-parent 404 coverage, composed endpoint smoke, root review, and reviewed commit `4546f7a`. |
| GET | `/api/supporting-materials` | Done | Canonical collection projection, bounded filters/sorts, focused query/handler coverage, composed endpoint smoke, root review, and reviewed commit evidence exist. |
| GET | `/api/supporting-materials/{materialId}` | Done | Canonical detail/provenance projection, aggregate-count coverage, composed endpoint smoke, root review, and reviewed commit evidence exist. |
| GET | `/api/supporting-materials/{materialId}/sections` | Blocked | The ordinal/heading query exists, but the contract also requires `pageFrom` and `pageTo`; supporting-material source page mappings are not persisted. The route remains intentionally unregistered until those mappings and page-overlap filtering are available. |
| GET | `/api/supporting-materials/{materialId}/sections/{sectionId}` | Done | Dedicated parent-bound repository query, strict canonical Resource projection, wrong-parent 404 coverage, composed endpoint smoke, root review, and reviewed commit `4546f7a`. |
| GET | `/api/changes` | Blocked | Route is intentionally unregistered: change events lack an immutable observation-time source snapshot. Joining the affected record live would rewrite historical values. Persist the canonical affected-record snapshot, typed change payload, provenance, documented filters, and keyset order, then complete database smoke before registering it. |
| POST | `/api/resources/batch` | Done | Bounded heterogeneous dispatch, first-occurrence de-duplication, per-item failure isolation, concrete document/supporting-material canonical resolvers, focused HTTP tests, root review, and reviewed commit `87f38be`; unavailable canonical kinds return typed per-item dependency errors. |

### Civic graph and events

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/people` | Blocked | Route is intentionally unregistered: `people.source_url` and `is_active` are nullable, while canonical provenance and `isActive` are required; the query also lacks `party`/`sort` filters and stored aliases. Backfill provenance/activity and add the canonical query before registering it. |
| GET | `/api/people/{personId}` | Blocked | Route is intentionally unregistered: no persisted aliases, image, public email, official URL, external identifiers, canonical person-jurisdiction set, or required term office title; membership role/provenance is incomplete. Add authoritative profile and relationship facts before registering it. |
| GET | `/api/people/{personId}/bills` | Blocked | Role-aware sponsorship/action query is missing. |
| GET | `/api/people/{personId}/amendments` | Blocked | Person-amendment relationship query is missing. |
| GET | `/api/people/{personId}/votes` | Blocked | Person vote-position activity query is missing. |
| GET | `/api/people/{personId}/memberships` | Done | Parent-bound historical membership query, canonical embedded summaries, interval filters, filter-bound pagination, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/people/{personId}/terms/{termId}` | Done | Parent-bound repository query, fail-closed canonical term projection, exact nested route, wrong-parent 404 coverage, root review, and reviewed commit `4546f7a`. |
| GET | `/api/organizations` | Done | Complete documented filters/sorts, stable filter-bound cursors, strict shared canonical projection, focused tests, root review, and reviewed commit `87f38be`; incomplete returned rows fail closed with 422. |
| GET | `/api/organizations/{organizationId}` | Blocked | Route is intentionally unregistered: no persisted description, website, public contact, or terms of reference; children are unbounded and memberships lack canonical embedded-record provenance. Add profile facts and bounded canonical child queries before registering it. |
| GET | `/api/organizations/{organizationId}/members` | Done | Parent-bound historical membership query, canonical embedded summaries, interval filters, filter-bound pagination, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/organizations/{organizationId}/memberships/{membershipId}` | Done | Parent-bound repository query, canonical embedded person/organization projection, exact nested route, wrong-parent 404 coverage, root review, and reviewed commit `4546f7a`. |
| GET | `/api/organizations/{organizationId}/meetings` | Blocked | `legislative_events` lacks a session relationship and authoritative local date, canonical organization relation, and typed location/virtual-access fields required for `MeetingSummary`; route is intentionally unregistered. |
| GET | `/api/organizations/{organizationId}/bills` | Done | Parent-bound relationship query, exact filters, latest-activity keyset pagination, fail-closed canonical summaries, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/organizations/{organizationId}/calendars` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/meetings` | Blocked | Route is intentionally unregistered: `source_url` is nullable; location and virtual access are untyped JSON; no authoritative local date, session, or calendar relation exists; and the query lacks calendar, bill, classification, status, remote, and sort filters. Persist typed canonical facts before registering it. |
| GET | `/api/meetings/{meetingId}` | Blocked | Route is intentionally unregistered: child collections are raw/unbounded; agenda rows lack title/status/amendment/material relations, event documents lack canonical links/classification, and outcome links lack description/classification/agenda relations. Add complete bounded child projections before registering it. |
| GET | `/api/meetings/{meetingId}/agenda` | Done | Canonical agenda persistence, explicit completeness-qualified relation arrays, ordinal/ID keyset pagination, exact Page projection, focused tests, root review, and reviewed commits `f9f9bae` and `87f38be`. |
| GET | `/api/meetings/{meetingId}/agenda/{agendaItemId}` | Done | Parent-bound complete-facts lookup, explicit relation projection, wrong-parent/incomplete-row 404 behavior, focused tests, root review, and reviewed commits `f9f9bae` and `87f38be`. |
| GET | `/api/meetings/{meetingId}/documents` | Done | Parent-bound event-document query, classification-bound stable pagination, canonical Page projection, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/meetings/{meetingId}/documents/{eventDocumentId}` | Done | Parent-bound repository query filters soft-deleted meetings, projects a canonical event-document Resource, and has exact-route/wrong-parent coverage, root review, and reviewed commit `4546f7a`. |
| GET | `/api/meetings/{meetingId}/outcomes` | Done | Canonical source-sequenced persistence, explicit agenda/target facts, bill/classification filters, scoped keyset pagination, strict projection, focused tests, root review, and reviewed commits `2d5de80` and `0fc6162`. |
| GET | `/api/meetings/{meetingId}/outcomes/{outcomeId}` | Done | Parent-bound canonical outcome lookup with persisted provenance and explicit target/agenda semantics, wrong-parent coverage, focused tests, root review, and reviewed commits `2d5de80` and `0fc6162`. |
| GET | `/api/meetings/{meetingId}/participants` | Done | Parent-bound participant query, canonical linked summaries, exact filters, filter-bound pagination, focused tests, root review, and reviewed commit `0fa41dc`. |
| GET | `/api/meetings/{meetingId}/participants/{participantId}` | Done | Parent-bound repository query filters soft-deleted meetings, projects canonical linked person/organization summaries, and has exact-route/wrong-parent coverage, root review, and reviewed commit `4546f7a`. |
| GET | `/api/calendars` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/calendars/{calendarId}` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/calendars/{calendarId}/meetings` | Blocked | Durable calendar resources are not modeled. |
| POST | `/api/representative-lookups` | Blocked | Address-to-district provider, privacy policy, and first-party UX are pending. |

### Search and document differences

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| POST | `/api/search/bills` | Done | Canonical hits, truthful model/rerank metadata, all documented filters, stable capped ranking, filter-bound cursors, focused handler/query/projection tests, database-integration coverage, root review, and reviewed commit `4546f7a`. |
| POST | `/api/search/amendments` | Blocked | Intentionally unregistered: `AmendmentSummary.billId` is required while structured amendment rows permit a null bill relationship. Define and backfill an authoritative relationship policy, then add independently retrieved structured and document records, complete filters, canonical hits, and actual model metadata. |
| POST | `/api/search/passages` | Blocked | Intentionally unregistered: `DocumentSummary` requires durable OCR status, but `bill_documents` only persists processing status. Persist and backfill OCR state, then add canonical section-document-bill projection, highlight ranges, complete filters, and actual model metadata. |
| POST | `/api/search/supporting-materials` | Done | Canonical bounded-section hits, truthful score/model metadata, all documented filters, hostile-Host-safe URLs, deterministic capped ranking, filter-bound cursors, focused tests, database-integration coverage, root review, and reviewed commit `4546f7a`. |
| POST | `/api/search/all` | Blocked | Cross-product fusion and stable pagination policy are missing. |
| POST | `/api/document-diffs` | Blocked | Intentionally unregistered: document canonical projection lacks durable OCR state, and the comparison service only returns section before/after text. Add OCR state plus an exact bounded diff engine with ownership and processing conflict semantics, granularity, operations and offsets, counts, cursors, hunk sources, and canonical document summaries. |
| POST | `/api/research/answers` | Blocked | Approved generation provider, citation verifier, and budget controls are missing. |

### Subscriptions and webhooks

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/subscriptions` | Done | Scope-aware route composition/persistence, documented filters, keyset pagination, composed endpoint smoke, root review, and reviewed commit evidence exist. |
| POST | `/api/subscriptions` | Blocked | Durable scope-aware repository, transactional event/audit writer, and encrypted 24-hour idempotency boundary now exist; matcher/materializer, delivery executors, and route composition/authorization remain. |
| GET | `/api/subscriptions/{subscriptionId}` | Done | Scope-aware lookup, ETag route composition, composed endpoint smoke, root review, and reviewed commit evidence exist. |
| PATCH | `/api/subscriptions/{subscriptionId}` | Blocked | Reviewed revision/validation foundation, durable scope/revision transaction, and encrypted replay boundary now exist; route composition/authorization adapter remains. |
| DELETE | `/api/subscriptions/{subscriptionId}` | Blocked | Durable scope/revision cancellation, transactional event/audit writer, and encrypted replay boundary now exist; delivery shutdown and route composition/authorization remain. |
| GET | `/api/subscriptions/{subscriptionId}/events` | Done | Scope-aware listing, documented filters, keyset pagination, composed endpoint smoke, root review, and reviewed commit evidence exist. Event materialization remains a separate mutation prerequisite. |
| GET | `/api/subscriptions/{subscriptionId}/deliveries` | Done | Scope-aware listing, documented filters, keyset pagination, composed endpoint smoke, root review, and reviewed commit evidence exist. Delivery workers remain a separate mutation prerequisite. |
| GET | `/api/webhooks` | Done | Scope-aware persistence, documented status/eventType filters, keyset pagination, canonical projection, composed endpoint smoke, root review, and reviewed commit evidence exist. |
| POST | `/api/webhooks` | Blocked | Nominal encrypted-secret boundary exists; KMS protector, durable repository, encrypted replay, and verification executor are missing. |
| GET | `/api/webhooks/{webhookId}` | Done | Scope-aware lookup, canonical projection, ETag route composition, composed endpoint smoke, root review, and reviewed commit evidence exist. |
| PATCH | `/api/webhooks/{webhookId}` | Blocked | Reviewed validation/revision foundation exists; durable revision/verification-state transaction and replay executor are missing. |
| DELETE | `/api/webhooks/{webhookId}` | Blocked | Durable cancellation, linked-delivery shutdown, audit persistence, and exact replay are missing. |
| POST | `/api/webhooks/{webhookId}/rotate-secret` | Blocked | Reviewed overlap/secret foundation exists; KMS encryption, transactional key persistence/expiry, and encrypted replay are missing. |
| POST | `/api/webhooks/{webhookId}/verify` | Blocked | Approved-destination/revalidation boundary exists; a pinned connection-time-revalidating challenge transport and durable activation transaction are missing. |

The current release evidence is recorded in [the Railway API release record](http-api-railway-release.md). The endpoint
matrix is 0 **In progress**, 48 **Blocked**, 0 **Ready**, and 39 **Done** routes.
