# HTTP API contract

## Status and boundary

This is the approved public and first-party application contract. Implementation is underway and route readiness is
tracked per endpoint in the [HTTP API implementation backlog](../http-api-implementation-backlog.md). The web
application, public API, and MCP adapter share one application-service boundary so authorization, canonical identity,
source attribution, and query behavior do not diverge.

The contract is split into focused pages:

- [Shared schemas and protocol behavior](schemas.md)
- [Legislative records and documents](legislative-records.md)
- [People, organizations, meetings, and calendars](civic-graph-and-events.md)
- [Search, research answers, and document comparison](search-and-diffs.md)
- [Subscriptions, deliveries, and webhooks](subscriptions-and-webhooks.md)
- [MCP migration and parity map](mcp-migration.md)

## Design rules

1. A canonical record has one top-level retrieval URL. A nested URL represents a relationship or contextual collection,
   not a second identity.
2. Routes nest under at most one parent. A session ID already identifies its jurisdiction, so clients use
   `/api/sessions/{sessionId}/bills`, not a deeper jurisdiction/session/bill path.
3. `GET` collections browse and filter records. Ranked lexical, semantic, and hybrid retrieval uses `POST /api/search/*`
   because search inputs can contain arrays and model options that do not belong in a query string.
4. Meeting schedules are filtered meeting collections. A calendar is a first-class resource only when a publisher
   exposes a durable calendar or schedule feed.
5. Commissions and committees are organization classifications. Contextual convenience collections return canonical
   organization records whose detail URL remains `/api/organizations/{organizationId}`.
6. Batch reads accept at most 25 unique IDs and isolate safe errors to the affected item.
7. Generated answers never replace retrieval results. Every assertion must cite a canonical record and official source.

## Authentication and access classes

The HTTP API accepts configured WorkOS M2M bearer tokens and, for first-party browser clients, configured AuthKit
user-session bearer tokens. M2M tokens are verified for issuer, signature, expiry, subject, optional organization, and
either the API or MCP audience. AuthKit sessions are API-only and require the configured client ID, a nonempty session
ID, and a maximum 30-day lifetime. The MCP resource accepts only M2M tokens for its configured resource audience. Every
operation declares one of these access classes:

| Access class  | Meaning                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Public        | May be exposed without a user token after product approval and rate-limit configuration.         |
| Authenticated | Requires a valid user token.                                                                     |
| First-party   | Requires a valid user token and a first-party application client. Raw addresses use this boundary. |
| Operator      | Requires an operator role and is never part of the public developer API.                          |

The draft assumes all routes are authenticated until a separate exposure review marks a route public. Subscription,
webhook, representative-lookup, and research-answer routes always remain authenticated or more restrictive.

## Endpoint inventory

The response-schema column names `T`; the wire body is the complete shared `ResourceResponse<T>`, `Page<T>`,
`SearchPage<T>`, or `BatchResponse<T>` shown there. Endpoint pages define every request body, query field, default,
ordering rule, and exception.

### Legislative records and documents

| Method | Path                                                    | Access        | Response schema                 |
| ------ | ------------------------------------------------------- | ------------- | ------------------------------- |
| GET    | `/api/jurisdictions`                                    | Authenticated | `Page<Jurisdiction>`            |
| GET    | `/api/jurisdictions/{jurisdictionId}`                   | Authenticated | `Jurisdiction`                  |
| GET    | `/api/jurisdictions/{jurisdictionId}/sessions`          | Authenticated | `Page<Session>`                 |
| GET    | `/api/jurisdictions/{jurisdictionId}/bills`             | Authenticated | `Page<BillSummary>`             |
| GET    | `/api/jurisdictions/{jurisdictionId}/organizations`     | Authenticated | `Page<OrganizationSummary>`     |
| GET    | `/api/jurisdictions/{jurisdictionId}/commissions`       | Authenticated | `Page<OrganizationSummary>`     |
| GET    | `/api/jurisdictions/{jurisdictionId}/committees`        | Authenticated | `Page<OrganizationSummary>`     |
| GET    | `/api/jurisdictions/{jurisdictionId}/meetings`          | Authenticated | `Page<MeetingSummary>`          |
| GET    | `/api/sessions/{sessionId}`                              | Authenticated | `Session`                       |
| GET    | `/api/sessions/{sessionId}/bills`                        | Authenticated | `Page<BillSummary>`             |
| GET    | `/api/sessions/{sessionId}/meetings`                     | Authenticated | `Page<MeetingSummary>`          |
| GET    | `/api/bills`                                             | Authenticated | `Page<BillSummary>`             |
| POST   | `/api/bills/batch`                                       | Authenticated | `BatchResponse<BillDetail>`     |
| POST   | `/api/bills/amendments/batch`                            | Authenticated | `BillAmendmentBatchResponse`    |
| GET    | `/api/bills/{billId}`                                    | Authenticated | `BillDetail`                    |
| GET    | `/api/bills/{billId}/timeline`                           | Authenticated | `Page<TimelineItem>`            |
| GET    | `/api/bills/{billId}/related`                            | Authenticated | `Page<RelatedBillHit>`          |
| GET    | `/api/bills/{billId}/sections`                           | Authenticated | `Page<DocumentSection>`         |
| GET    | `/api/bills/{billId}/amendments`                         | Authenticated | `Page<AmendmentSummary>`        |
| GET    | `/api/bills/{billId}/votes`                              | Authenticated | `Page<VoteDetail>`              |
| GET    | `/api/bills/{billId}/documents`                          | Authenticated | `Page<DocumentSummary>`         |
| GET    | `/api/bills/{billId}/changes`                            | Authenticated | `Page<ChangeEvent>`             |
| GET    | `/api/amendments`                                        | Authenticated | `Page<AmendmentSummary>`        |
| POST   | `/api/amendments/batch`                                  | Authenticated | `BatchResponse<AmendmentDetail>` |
| GET    | `/api/amendments/{amendmentId}`                          | Authenticated | `AmendmentDetail`               |
| GET    | `/api/votes`                                             | Authenticated | `Page<VoteSummary>`             |
| POST   | `/api/votes/batch`                                       | Authenticated | `BatchResponse<VoteDetail>`     |
| GET    | `/api/votes/{voteId}`                                    | Authenticated | `VoteDetail`                    |
| GET    | `/api/votes/{voteId}/positions`                          | Authenticated | `Page<VotePosition>`            |
| GET    | `/api/documents/{documentId}`                            | Authenticated | `DocumentDetail`                |
| GET    | `/api/documents/{documentId}/sections`                   | Authenticated | `Page<DocumentSection>`         |
| GET    | `/api/documents/{documentId}/sections/{sectionId}`       | Authenticated | `DocumentSection`               |
| GET    | `/api/supporting-materials`                              | Authenticated | `Page<SupportingMaterialSummary>` |
| GET    | `/api/supporting-materials/{materialId}`                 | Authenticated | `SupportingMaterialDetail`      |
| GET    | `/api/supporting-materials/{materialId}/sections`        | Authenticated | `Page<SupportingMaterialSection>` |
| GET    | `/api/supporting-materials/{materialId}/sections/{sectionId}` | Authenticated | `SupportingMaterialSection` |
| GET    | `/api/changes`                                           | Authenticated | `Page<ChangeEvent>`             |
| POST   | `/api/resources/batch`                                  | Authenticated | `BatchResponse<CanonicalResource>` |

### Civic graph and events

| Method | Path                                              | Access        | Response schema             |
| ------ | ------------------------------------------------- | ------------- | --------------------------- |
| GET    | `/api/people`                                     | Authenticated | `Page<PersonSummary>`       |
| GET    | `/api/people/{personId}`                          | Authenticated | `PersonDetail`              |
| GET    | `/api/people/{personId}/bills`                    | Authenticated | `Page<BillActivity>`        |
| GET    | `/api/people/{personId}/amendments`               | Authenticated | `Page<AmendmentSummary>`    |
| GET    | `/api/people/{personId}/votes`                    | Authenticated | `Page<VotePositionActivity>` |
| GET    | `/api/people/{personId}/memberships`              | Authenticated | `Page<Membership>`          |
| GET    | `/api/people/{personId}/terms/{termId}`           | Authenticated | `LegislativeTerm`           |
| GET    | `/api/organizations`                              | Authenticated | `Page<OrganizationSummary>` |
| GET    | `/api/organizations/{organizationId}`             | Authenticated | `OrganizationDetail`        |
| GET    | `/api/organizations/{organizationId}/members`     | Authenticated | `Page<Membership>`          |
| GET    | `/api/organizations/{organizationId}/memberships/{membershipId}` | Authenticated | `Membership` |
| GET    | `/api/organizations/{organizationId}/meetings`    | Authenticated | `Page<MeetingSummary>`      |
| GET    | `/api/organizations/{organizationId}/bills`       | Authenticated | `Page<BillSummary>`         |
| GET    | `/api/organizations/{organizationId}/calendars`   | Authenticated | `Page<CalendarSummary>`     |
| GET    | `/api/meetings`                                   | Authenticated | `Page<MeetingSummary>`      |
| GET    | `/api/meetings/{meetingId}`                       | Authenticated | `MeetingDetail`             |
| GET    | `/api/meetings/{meetingId}/agenda`                | Authenticated | `Page<AgendaItem>`          |
| GET    | `/api/meetings/{meetingId}/agenda/{agendaItemId}` | Authenticated | `AgendaItem`                |
| GET    | `/api/meetings/{meetingId}/documents`             | Authenticated | `Page<EventDocument>`       |
| GET    | `/api/meetings/{meetingId}/documents/{eventDocumentId}` | Authenticated | `EventDocument`       |
| GET    | `/api/meetings/{meetingId}/outcomes`              | Authenticated | `Page<MeetingOutcome>`      |
| GET    | `/api/meetings/{meetingId}/outcomes/{outcomeId}`  | Authenticated | `MeetingOutcome`            |
| GET    | `/api/meetings/{meetingId}/participants`          | Authenticated | `Page<MeetingParticipant>`  |
| GET    | `/api/meetings/{meetingId}/participants/{participantId}` | Authenticated | `MeetingParticipant` |
| GET    | `/api/calendars`                                  | Authenticated | `Page<CalendarSummary>`     |
| GET    | `/api/calendars/{calendarId}`                     | Authenticated | `CalendarDetail`            |
| GET    | `/api/calendars/{calendarId}/meetings`            | Authenticated | `Page<MeetingSummary>`      |
| POST   | `/api/representative-lookups`                     | First-party   | `RepresentativeLookupResult` |

### Search, diffs, subscriptions, and delivery

| Method | Path                                             | Access        | Response schema              |
| ------ | ------------------------------------------------ | ------------- | ---------------------------- |
| POST   | `/api/search/bills`                              | Authenticated | `SearchPage<BillSearchHit>`  |
| POST   | `/api/search/amendments`                         | Authenticated | `SearchPage<AmendmentSearchHit>` |
| POST   | `/api/search/passages`                           | Authenticated | `SearchPage<PassageSearchHit>` |
| POST   | `/api/search/supporting-materials`               | Authenticated | `SearchPage<MaterialSearchHit>` |
| POST   | `/api/search/all`                                | Authenticated | `UniversalSearchResponse`    |
| POST   | `/api/document-diffs`                            | Authenticated | `DocumentDiff`               |
| POST   | `/api/research/answers`                          | Authenticated | `ResearchAnswer`             |
| GET    | `/api/subscriptions`                             | Authenticated | `Page<Subscription>`         |
| POST   | `/api/subscriptions`                             | Authenticated | `Subscription`               |
| GET    | `/api/subscriptions/{subscriptionId}`            | Authenticated | `Subscription`               |
| PATCH  | `/api/subscriptions/{subscriptionId}`            | Authenticated | `Subscription`               |
| DELETE | `/api/subscriptions/{subscriptionId}`            | Authenticated | `CancellationReceipt`        |
| GET    | `/api/subscriptions/{subscriptionId}/events`     | Authenticated | `Page<SubscriptionEvent>`    |
| GET    | `/api/subscriptions/{subscriptionId}/deliveries` | Authenticated | `Page<Delivery>`             |
| GET    | `/api/webhooks`                                  | Authenticated | `Page<Webhook>`              |
| POST   | `/api/webhooks`                                  | Authenticated | `WebhookWithSecret`          |
| GET    | `/api/webhooks/{webhookId}`                      | Authenticated | `Webhook`                    |
| PATCH  | `/api/webhooks/{webhookId}`                      | Authenticated | `Webhook`                    |
| DELETE | `/api/webhooks/{webhookId}`                      | Authenticated | `CancellationReceipt`        |
| POST   | `/api/webhooks/{webhookId}/rotate-secret`        | Authenticated | `WebhookWithSecret`          |
| POST   | `/api/webhooks/{webhookId}/verify`               | Authenticated | `Webhook`                    |

## Compatibility and evolution

The prototype has one canonical, unversioned contract. Breaking changes replace the draft rather than creating
version-suffixed routes. Before public availability, the contract will be frozen into a machine-readable OpenAPI
document. After public availability, a separate compatibility policy must be approved before any breaking change.

## Operation IDs and generated specifications

Every operation ID is generated exactly as `<lowercase-method>__<normalized-path>`. Normalize by removing the leading
slash, replacing each slash with `__`, replacing a literal hyphen with `_`, and replacing `{name}` with `by_<name>`.
For example, `GET /api/bills/{billId}/votes` is `get__api__bills__by_billId__votes`. This deterministic rule covers every
inventory row, is globally unique, and must not change after public release.

The response set is also deterministic. Every authenticated operation declares `401`, `403`, `429`, and `500` with
`ErrorResponse`. Any operation accepting input declares `400` and `413`; a path-resource operation declares `404`;
model-backed or provider-backed operations declare `422` and `503`; mutation operations declare `409`; mutations with
`If-Match` also declare `412`; cacheable GET operations declare `304`. The endpoint's documented success status and
schema are the only success response. This matrix plus endpoint-specific exceptions is the exact OpenAPI response set.

The endpoint pages are the source contract for the future OpenAPI document; a generated specification must preserve
the documented request type, response envelope, statuses, calculated operation ID, and examples exactly.

## MCP migration

See the [complete MCP parity map](mcp-migration.md). HTTP handlers and MCP tools call the same application-service
methods. An in-process MCP server never makes loopback HTTP calls; a separately deployed adapter may use the HTTP API.
