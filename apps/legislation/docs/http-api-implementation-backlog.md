# HTTP API implementation backlog

## Purpose

This is the delivery ledger for the HTTP API, Railway release, and MCP cutover. Every endpoint has one current state:

- **Ready**: its prerequisites exist and implementation may start.
- **In progress**: code exists or is being reviewed, but the endpoint has not passed its phase gate.
- **Blocked**: a named dependency, provider, persistence adapter, or product decision is missing.
- **Done**: the route matches the contract, has focused tests, passed smoke testing, and is included in a reviewed commit.

An endpoint is not **Done** merely because a route handler exists. Each phase is committed only after root review and
the verification listed below. The endpoint contract remains the source of truth for request and response bodies.

## Delivery phases

| ID | Phase | State | Granular tasks and exit gate |
| --- | --- | --- | --- |
| API-00 | Contract and dependency foundation | In progress | Keep the complete endpoint contract and MCP parity map current; maintain this ledger; install a reproducible web framework dependency graph; use TanStack Start if its public packages can be locked and built, otherwise replace the shell with the latest stable Next.js; run format, type, and contract checks. |
| API-01 | Shared HTTP foundation | In progress | Review request routing, bearer-token context, envelopes, pagination, errors, body limits, conditional requests, request IDs, and handler composition; add focused protocol tests; commit only after the shared foundation passes. |
| API-02 | Canonical legislative reads | In progress | Review and complete jurisdictions, sessions, bills, amendments, votes, documents, materials, changes, and batch routes; ensure canonical IDs and source links; add filter/pagination/negative tests; run a local authenticated smoke; commit independently. |
| API-03 | Civic graph, meetings, search, and diffs | In progress | Review current people, organizations, meetings, four product searches, and document diff routes; complete contract projections and filters; leave relationship routes blocked until service queries exist; verify lexical/semantic/hybrid canonical mapping; commit independently. |
| API-04 | Subscriptions and webhooks | Blocked | Review schema and application service; implement a durable repository, KMS-backed signing-secret encryption, 24-hour idempotency replay, outbound verification/delivery, retry/dead-letter behavior, and authorization; never persist plaintext secrets; commit persistence, delivery, and routes as separate reviewed deliverables. |
| API-05 | Local smoke and parity | Ready | Start the HTTP server against the configured database; smoke health/auth/error paths and representative endpoints from every completed product; run MCP-vs-HTTP parity fixtures for IDs, pagination, errors, and search ranking; record results. |
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

### Legislative records and documents

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/jurisdictions` | In progress | Handler exists; contract projection and root review pending. |
| GET | `/api/jurisdictions/{jurisdictionId}` | In progress | Handler exists; contract projection and root review pending. |
| GET | `/api/jurisdictions/{jurisdictionId}/sessions` | In progress | Handler exists; filter and envelope review pending. |
| GET | `/api/jurisdictions/{jurisdictionId}/bills` | Ready | Reuse bill browse with scoped canonical response. |
| GET | `/api/jurisdictions/{jurisdictionId}/organizations` | Blocked | Jurisdiction-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/commissions` | Blocked | Classification-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/committees` | Blocked | Classification-scoped organization query is missing. |
| GET | `/api/jurisdictions/{jurisdictionId}/meetings` | Ready | Reuse event search with jurisdiction scope and canonical projection. |
| GET | `/api/sessions/{sessionId}` | In progress | Handler exists; contract projection and root review pending. |
| GET | `/api/sessions/{sessionId}/bills` | Ready | Reuse bill browse with session scope. |
| GET | `/api/sessions/{sessionId}/meetings` | Ready | Reuse event search with session scope. |
| GET | `/api/bills` | In progress | Handler exists; complete filters, ordering, and projection. |
| POST | `/api/bills/batch` | In progress | Handler exists; verify per-item isolation and 25-ID maximum. |
| POST | `/api/bills/amendments/batch` | In progress | Handler exists; verify contract limits and item envelopes. |
| GET | `/api/bills/{billId}` | In progress | Handler exists; canonical detail projection pending. |
| GET | `/api/bills/{billId}/timeline` | In progress | Handler exists; change-event page envelope pending. |
| GET | `/api/bills/{billId}/related` | In progress | Handler exists; related-hit projection and semantic metadata pending. |
| GET | `/api/bills/{billId}/sections` | In progress | Handler exists through bill text; page contract review pending. |
| GET | `/api/bills/{billId}/amendments` | In progress | Handler exists; filter and canonical summary review pending. |
| GET | `/api/bills/{billId}/votes` | In progress | Handler exists; page envelope and roll-call detail review pending. |
| GET | `/api/bills/{billId}/documents` | Blocked | Dedicated bill-document collection query is missing. |
| GET | `/api/bills/{billId}/changes` | Ready | Scope the existing change search to the bill. |
| GET | `/api/amendments` | In progress | Handler exists; full filter/projection review pending. |
| POST | `/api/amendments/batch` | In progress | Handler exists; batch error isolation review pending. |
| GET | `/api/amendments/{amendmentId}` | In progress | Handler exists; canonical detail projection pending. |
| GET | `/api/votes` | In progress | Handler exists; ordering/filter/projection review pending. |
| POST | `/api/votes/batch` | In progress | Handler exists; batch error isolation review pending. |
| GET | `/api/votes/{voteId}` | In progress | Handler exists; canonical detail projection pending. |
| GET | `/api/votes/{voteId}/positions` | Blocked | Dedicated paginated position query is missing. |
| GET | `/api/documents/{documentId}` | In progress | Handler exists; hosted/source URLs and extraction state review pending. |
| GET | `/api/documents/{documentId}/sections` | In progress | Handler exists; OCR/extraction metadata and page review pending. |
| GET | `/api/supporting-materials` | In progress | Handler exists; collection projection review pending. |
| GET | `/api/supporting-materials/{materialId}` | In progress | Handler exists; canonical detail projection pending. |
| GET | `/api/supporting-materials/{materialId}/sections` | Blocked | Supporting-material section query is missing. |
| GET | `/api/changes` | In progress | Handler exists; filter/projection review pending. |
| POST | `/api/resources/batch` | Blocked | Cross-resource dispatcher and canonical union projection are missing. |

### Civic graph and events

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/people` | In progress | Handler exists; complete filters and canonical projection. |
| GET | `/api/people/{personId}` | In progress | Handler exists; canonical detail projection pending. |
| GET | `/api/people/{personId}/bills` | Blocked | Role-aware sponsorship/action query is missing. |
| GET | `/api/people/{personId}/amendments` | Blocked | Person-amendment relationship query is missing. |
| GET | `/api/people/{personId}/votes` | Blocked | Person vote-position activity query is missing. |
| GET | `/api/people/{personId}/memberships` | Blocked | Historical membership query is missing. |
| GET | `/api/organizations` | In progress | Handler exists; complete filters and canonical projection. |
| GET | `/api/organizations/{organizationId}` | In progress | Handler exists; canonical detail projection pending. |
| GET | `/api/organizations/{organizationId}/members` | Blocked | Historical organization membership query is missing. |
| GET | `/api/organizations/{organizationId}/meetings` | Ready | Reuse event search with organization scope. |
| GET | `/api/organizations/{organizationId}/bills` | Blocked | Organization-bill relationship query is missing. |
| GET | `/api/organizations/{organizationId}/calendars` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/meetings` | In progress | Handler exists; canonical meeting projection pending. |
| GET | `/api/meetings/{meetingId}` | In progress | Handler exists; canonical detail projection pending. |
| GET | `/api/meetings/{meetingId}/agenda` | Blocked | Agenda-item query/projection is missing. |
| GET | `/api/meetings/{meetingId}/documents` | Blocked | Event-document relationship query is missing. |
| GET | `/api/meetings/{meetingId}/outcomes` | Blocked | Meeting outcome query is missing. |
| GET | `/api/meetings/{meetingId}/participants` | Blocked | Meeting participant query is missing. |
| GET | `/api/calendars` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/calendars/{calendarId}` | Blocked | Durable calendar resources are not modeled. |
| GET | `/api/calendars/{calendarId}/meetings` | Blocked | Durable calendar resources are not modeled. |
| POST | `/api/representative-lookups` | Blocked | Address-to-district provider, privacy policy, and first-party UX are pending. |

### Search and document differences

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| POST | `/api/search/bills` | In progress | Handler exists; ranking metadata, filters, and canonical mapping review pending. |
| POST | `/api/search/amendments` | In progress | Handler exists; ranking metadata, filters, and canonical mapping review pending. |
| POST | `/api/search/passages` | In progress | Handler exists; section-to-document/bill mapping review pending. |
| POST | `/api/search/supporting-materials` | In progress | Handler exists; canonical mapping and model metadata review pending. |
| POST | `/api/search/all` | Blocked | Cross-product fusion and stable pagination policy are missing. |
| POST | `/api/document-diffs` | In progress | Handler exists; response projection and validation review pending. |
| POST | `/api/research/answers` | Blocked | Approved generation provider, citation verifier, and budget controls are missing. |

### Subscriptions and webhooks

| Method | Path | State | Current gate |
| --- | --- | --- | --- |
| GET | `/api/subscriptions` | Blocked | Durable repository and authorization adapter are not wired. |
| POST | `/api/subscriptions` | Blocked | Repository, encrypted idempotency replay, and delivery policy are pending. |
| GET | `/api/subscriptions/{subscriptionId}` | Blocked | Durable repository and authorization adapter are not wired. |
| PATCH | `/api/subscriptions/{subscriptionId}` | Blocked | Repository, revision persistence, and replay adapter are pending. |
| DELETE | `/api/subscriptions/{subscriptionId}` | Blocked | Repository and cancellation-event persistence are pending. |
| GET | `/api/subscriptions/{subscriptionId}/events` | Blocked | Event materialization repository is pending. |
| GET | `/api/subscriptions/{subscriptionId}/deliveries` | Blocked | Delivery attempt repository is pending. |
| GET | `/api/webhooks` | Blocked | Durable repository and secret-management adapter are pending. |
| POST | `/api/webhooks` | Blocked | KMS-backed secret encryption and idempotency replay are pending. |
| GET | `/api/webhooks/{webhookId}` | Blocked | Durable repository is pending. |
| PATCH | `/api/webhooks/{webhookId}` | Blocked | Durable repository and revision persistence are pending. |
| DELETE | `/api/webhooks/{webhookId}` | Blocked | Durable repository and delivery shutdown behavior are pending. |
| POST | `/api/webhooks/{webhookId}/rotate-secret` | Blocked | KMS-backed rotation and bounded overlap persistence are pending. |
| POST | `/api/webhooks/{webhookId}/verify` | Blocked | Safe outbound transport and verification executor are pending. |

## MCP cutover gates

The MCP remains on its current application service until all of these are true:

- the Railway API deployment is terminal `SUCCESS` and authenticated smoke tests pass;
- every MCP-mapped endpoint used in the canary is **Done**;
- an HTTP client preserves canonical IDs, pagination, error semantics, timeouts, and trace context;
- MCP-vs-HTTP fixtures show no material result loss for bills, amendments, votes, documents, meetings, and search;
- a configuration switch can immediately restore the in-process adapter without a redeploy;
- the remote canary shows acceptable latency and no authorization or provider regression.
