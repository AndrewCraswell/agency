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
last reconciled with the reviewed implementation on 2026-08-24; no endpoint has yet supplied the smoke, parity, and
reviewed-commit evidence required for **Done**. Current totals are 40 **In progress**, 47 **Blocked**, 0 **Ready**, and
0 **Done** across 87 endpoints.

## Delivery phases

| ID | Phase | State | Granular tasks and exit gate |
| --- | --- | --- | --- |
| API-00 | Contract and dependency foundation | In progress | Keep the complete endpoint contract and MCP parity map current; maintain this ledger; install a reproducible web framework dependency graph; use TanStack Start if its public packages can be locked and built, otherwise replace the shell with the latest stable Next.js; run format, type, and contract checks. |
| API-01 | Shared HTTP foundation | In progress | Root review accepted the routing/envelope/error foundation and focused protocol tests. Conditional caching, composed authenticated local smoke, repository-wide verification, and the reviewed commit remain. |
| API-02 | Canonical legislative reads | In progress | Root review accepted the current core-read handler foundation and focused tests. Complete canonical contract projections, missing filters/relationships, source links, authenticated database smoke, parity evidence, and the reviewed commit. |
| API-03 | Civic graph, meetings, search, and diffs | In progress | Root review accepted the current civic/search handler foundation and focused validation. Complete canonical projections, missing filters/relationships, truthful model metadata, database-backed smoke/parity evidence, and the reviewed commit. |
| API-04 | Subscriptions and webhooks | Blocked | Root review accepted the uncomposed schema, service, route, SSRF, and encrypted-secret foundations. A durable `SubscriptionRepository`, KMS-backed `WebhookSecretProtector`, encrypted 24-hour idempotency executor, event matcher/materializer, pinned outbound verification/delivery executors, retry/dead-letter worker, and composition/authorization adapter are still missing. |
| API-05 | Local smoke and parity | Ready | Execute the linked checklist against the composed authenticated server and disposable fixture database. Record canonical projection, pagination, negative-path, model-routing, and MCP parity evidence per product; do not promote an endpoint on handler-unit evidence alone. |
| API-06 | Railway API release | Ready | Resolve the linked Railway project/service; configure the monorepo root/start command and non-secret variables; deploy the reviewed build; wait for terminal `SUCCESS`; verify health plus authenticated remote API smoke; document the release and rollback target. |
| API-07 | MCP HTTP migration | Blocked | After API-06, add an HTTP-backed application-service adapter with service authentication, timeouts, retries only for safe operations, tracing, and an in-process rollback switch; run the full parity suite; deploy MCP; canary and then cut over only after parity passes. |
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
the exact contract projection, live database smoke, MCP parity, or reviewed-commit gates. Subscription handlers remain
intentionally uncomposed and **Blocked**.

### Legislative records and documents

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/jurisdictions` | In progress | Reviewed handler and page tests exist; exact `Jurisdiction` projection, live database smoke, parity, and commit remain. |
| GET | `/api/jurisdictions/{jurisdictionId}` | In progress | Reviewed handler exists; exact canonical/provenance projection, live smoke, parity, and commit remain. |
| GET | `/api/jurisdictions/{jurisdictionId}/sessions` | In progress | Reviewed handler exists; exact `Session` projection/filter smoke, parity, and commit remain. |
| GET | `/api/jurisdictions/{jurisdictionId}/bills` | In progress | Exact canonical projection and scoped filters are implemented; default `latest-action-desc` performance remains a tracked blocker, while scoped smoke uses `introduced-desc`; live database smoke, MCP parity, and reviewed commit remain. |
| GET | `/api/jurisdictions/{jurisdictionId}/organizations` | Blocked | Jurisdiction-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/commissions` | Blocked | Classification-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/committees` | Blocked | Classification-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/meetings` | Blocked | `legislative_events` lacks a session relationship and authoritative local date, canonical organization relation, and typed location/virtual-access fields required for `MeetingSummary`; route is intentionally unregistered. |
| GET | `/api/sessions/{sessionId}` | In progress | Reviewed handler exists; exact canonical/provenance projection, live smoke, parity, and commit remain. |
| GET | `/api/sessions/{sessionId}/bills` | In progress | Exact canonical projection and scoped filters are implemented; default `latest-action-desc` performance remains a tracked blocker, while scoped smoke uses `introduced-desc`; live database smoke, MCP parity, and reviewed commit remain. |
| GET | `/api/sessions/{sessionId}/meetings` | Blocked | An authoritative event-session relation is missing; inferring through `event_bills` omits session meetings without linked bills. |
| GET | `/api/bills` | In progress | Reviewed handler exists; remaining filters, canonical projection, stable-order database smoke, parity, and commit remain. |
| POST | `/api/bills/batch` | In progress | Reviewed item-isolation and limit tests exist; exact `BillDetail` projection, live smoke/parity, and commit remain. |
| POST | `/api/bills/amendments/batch` | In progress | Reviewed bounds/error foundation exists; exact per-bill envelope, live smoke/parity, and commit remain. |
| GET | `/api/bills/{billId}` | In progress | Reviewed handler exists; exact `BillDetail` canonical/provenance projection, live smoke/parity, and commit remain. |
| GET | `/api/bills/{billId}/timeline` | In progress | Reviewed page-envelope test exists; documented discriminated timeline projection, live parity, and commit remain. |
| GET | `/api/bills/{billId}/related` | In progress | Reviewed handler exists; `Page<RelatedBillHit>` projection, semantic metadata, live parity, and commit remain. |
| GET | `/api/bills/{billId}/sections` | In progress | Reviewed page-envelope test exists; exact section/document/bill projection, live parity, and commit remain. |
| GET | `/api/bills/{billId}/amendments` | In progress | Reviewed handler exists; complete filters, canonical summary projection, live parity, and commit remain. |
| GET | `/api/bills/{billId}/votes` | In progress | Reviewed page-envelope test exists; exact roll-call/position projection, live parity, and commit remain. |
| GET | `/api/bills/{billId}/documents` | Blocked | Dedicated bill-document collection query is missing. |
| GET | `/api/bills/{billId}/changes` | In progress | Reviewed scoped handler/tests exist; exact canonical projection, live database smoke, MCP parity, and commit remain. |
| GET | `/api/amendments` | In progress | Reviewed handler exists; full filters, exact canonical projection, live parity, and commit remain. |
| POST | `/api/amendments/batch` | In progress | Reviewed item-isolation foundation exists; exact detail projection, live parity, and commit remain. |
| GET | `/api/amendments/{amendmentId}` | In progress | Reviewed handler exists; exact canonical/provenance projection, live parity, and commit remain. |
| GET | `/api/votes` | In progress | Reviewed handler exists; ordering, complete filters, exact projection, live parity, and commit remain. |
| POST | `/api/votes/batch` | In progress | Reviewed item-isolation test exists; exact detail projection, live parity, and commit remain. |
| GET | `/api/votes/{voteId}` | In progress | Reviewed handler exists; exact roll-call/position projection, live parity, and commit remain. |
| GET | `/api/votes/{voteId}/positions` | Blocked | Dedicated paginated position query is missing. |
| GET | `/api/documents/{documentId}` | In progress | Reviewed handler exists; hosted/source URLs, extraction state, exact projection, live parity, and commit remain. |
| GET | `/api/documents/{documentId}/sections` | In progress | Reviewed handler/page foundation exists; OCR/extraction metadata, exact projection, live parity, and commit remain. |
| GET | `/api/documents/{documentId}/sections/{sectionId}` | In progress | Canonical projector and contract exist; singular repository query, handler tests, live smoke/parity, and commit remain. |
| GET | `/api/supporting-materials` | In progress | Reviewed handler exists; exact collection projection, complete filters, live parity, and commit remain. |
| GET | `/api/supporting-materials/{materialId}` | In progress | Reviewed handler exists; exact canonical/provenance projection, live parity, and commit remain. |
| GET | `/api/supporting-materials/{materialId}/sections` | Blocked | Supporting-material section query is missing. |
| GET | `/api/supporting-materials/{materialId}/sections/{sectionId}` | In progress | Canonical projector and contract exist; singular repository query, handler tests, live smoke/parity, and commit remain. |
| GET | `/api/changes` | In progress | Reviewed handler exists; complete filters, exact projection, live parity, and commit remain. |
| POST | `/api/resources/batch` | Blocked | Cross-resource dispatcher and canonical union projection are missing. |

### Civic graph and events

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/people` | In progress | Reviewed handler/filter tests exist; exact `PersonSummary` projection, live database parity, and commit remain. |
| GET | `/api/people/{personId}` | In progress | Reviewed handler exists; exact canonical detail/child metadata, live parity, and commit remain. |
| GET | `/api/people/{personId}/bills` | Blocked | Role-aware sponsorship/action query is missing. |
| GET | `/api/people/{personId}/amendments` | Blocked | Person-amendment relationship query is missing. |
| GET | `/api/people/{personId}/votes` | Blocked | Person vote-position activity query is missing. |
| GET | `/api/people/{personId}/memberships` | Blocked | Historical membership query is missing. |
| GET | `/api/people/{personId}/terms/{termId}` | Blocked | Canonical projector exists; direct person-scoped term lookup and handler are missing. |
| GET | `/api/organizations` | In progress | Reviewed handler exists; exact `OrganizationSummary` projection/filter smoke, live parity, and commit remain. |
| GET | `/api/organizations/{organizationId}` | In progress | Reviewed handler exists; exact canonical detail/child metadata, live parity, and commit remain. |
| GET | `/api/organizations/{organizationId}/members` | Blocked | Historical organization membership query is missing. |
| GET | `/api/organizations/{organizationId}/memberships/{membershipId}` | Blocked | Canonical projector exists; direct organization-scoped membership lookup and handler are missing. |
| GET | `/api/organizations/{organizationId}/meetings` | Blocked | `legislative_events` lacks a session relationship and authoritative local date, canonical organization relation, and typed location/virtual-access fields required for `MeetingSummary`; route is intentionally unregistered. |
| GET | `/api/organizations/{organizationId}/bills` | Blocked | Organization-bill relationship query is missing. |
| GET | `/api/organizations/{organizationId}/calendars` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/meetings` | In progress | Reviewed handler exists; exact `MeetingSummary` projection/filter smoke, live parity, and commit remain. |
| GET | `/api/meetings/{meetingId}` | In progress | Reviewed handler exists; exact canonical detail/child metadata, live parity, and commit remain. |
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
| POST | `/api/search/bills` | In progress | Reviewed validation/mode tests exist; actual model/rerank metadata, complete filters, canonical hits, live ranking parity, and commit remain. |
| POST | `/api/search/amendments` | In progress | Reviewed validation exists; complete filters, actual model metadata, canonical hits, live ranking parity, and commit remain. |
| POST | `/api/search/passages` | In progress | Reviewed bounds/duplicate validation exists; section-document-bill projection, full filters, model metadata, live parity, and commit remain. |
| POST | `/api/search/supporting-materials` | In progress | Reviewed date/filter validation exists; canonical material mapping, model metadata, live parity, and commit remain. |
| POST | `/api/search/all` | Blocked | Cross-product fusion and stable pagination policy are missing. |
| POST | `/api/document-diffs` | In progress | Reviewed request-mapping test exists; exact counts/operations/provenance projection, pair validation, live smoke, and commit remain. |
| POST | `/api/research/answers` | Blocked | Approved generation provider, citation verifier, and budget controls are missing. |

### Subscriptions and webhooks

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/subscriptions` | Blocked | Reviewed uncomposed route/service foundation exists; bounded durable repository queries and composition/authorization adapter are missing. |
| POST | `/api/subscriptions` | Blocked | Durable repository, encrypted 24-hour idempotency executor, matcher/materializer, and delivery executors are missing. |
| GET | `/api/subscriptions/{subscriptionId}` | Blocked | Reviewed scope checks exist; durable repository and composition/authorization adapter are missing. |
| PATCH | `/api/subscriptions/{subscriptionId}` | Blocked | Reviewed revision/validation foundation exists; durable revision transaction and encrypted replay executor are missing. |
| DELETE | `/api/subscriptions/{subscriptionId}` | Blocked | Durable cancellation transaction, exact replay, audit/event persistence, and delivery shutdown are missing. |
| GET | `/api/subscriptions/{subscriptionId}/events` | Blocked | Bounded repository contract exists; event matcher/materializer and durable event queries are missing. |
| GET | `/api/subscriptions/{subscriptionId}/deliveries` | Blocked | Bounded repository contract exists; durable attempt repository and delivery workers are missing. |
| GET | `/api/webhooks` | Blocked | Reviewed uncomposed route/service foundation exists; durable repository and composition/authorization adapter are missing. |
| POST | `/api/webhooks` | Blocked | Nominal encrypted-secret boundary exists; KMS protector, durable repository, encrypted replay, and verification executor are missing. |
| GET | `/api/webhooks/{webhookId}` | Blocked | Reviewed scope checks exist; durable repository and composition adapter are missing. |
| PATCH | `/api/webhooks/{webhookId}` | Blocked | Reviewed validation/revision foundation exists; durable revision/verification-state transaction and replay executor are missing. |
| DELETE | `/api/webhooks/{webhookId}` | Blocked | Durable cancellation, linked-delivery shutdown, audit persistence, and exact replay are missing. |
| POST | `/api/webhooks/{webhookId}/rotate-secret` | Blocked | Reviewed overlap/secret foundation exists; KMS encryption, transactional key persistence/expiry, and encrypted replay are missing. |
| POST | `/api/webhooks/{webhookId}/verify` | Blocked | Approved-destination/revalidation boundary exists; a pinned connection-time-revalidating challenge transport and durable activation transaction are missing. |

## MCP cutover gates

The MCP remains on its current application service until all of these are true:

- the Railway API deployment is terminal `SUCCESS` and authenticated smoke tests pass;
- every MCP-mapped endpoint used in the canary is **Done**;
- an HTTP client preserves canonical IDs, pagination, error semantics, timeouts, and trace context;
- MCP-vs-HTTP fixtures show no material result loss for bills, amendments, votes, documents, meetings, and search;
- a configuration switch can immediately restore the in-process adapter without a redeploy;
- the remote canary shows acceptable latency and no authorization or provider regression.
