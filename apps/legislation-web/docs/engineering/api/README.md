# HTTP API contract

## Status and boundary

This is the approved public and first-party application contract. The approved runtime is the Next.js 16 App Router
application in `apps/legislation-web`, with one explicit `route.ts` for every documented HTTP operation under
`apps/legislation-web/src/app/api`. The focused pages below define behavior; Linear and the target environment own
delivery status and acceptance evidence.

The implemented route inventory contains 86 operations: 81 existing legislative operations plus five organization-gated
regulatory reads: [codes](../../regulations/legal-code-discovery.md), [editions and provisions](../../regulations/legal-edition-browsing.md),
and [version text](../../regulations/legal-text-serving.md), plus [lexical search](../../regulations/legal-search-serving.md).
These regulatory slices are locally implemented;
deployed acceptance remains open, and their MCP tools are opt-in. Calendar, meeting-outcome and representative-lookup
operations are removed. Authentication and API-backed MCP are implemented. Source presence and earlier endpoint smoke
do not imply complete corpus coverage or close later search failures.

The standalone server path is retained for testing; the former Railway `legislation-api` service is deleted and is not
a rollback target. The application, public API and MCP adapter share canonical application-service behavior and source
attribution. Runtime ownership is documented in [Next.js runtime](../../operations/development.md#nextjs-runtime).

Handler service contracts declare only the operations their routes consume, rather than the complete query service.
`CoreReadQueryApi` owns bill browsing, scoped-parent checks and supporting-material/document-section reads;
`CivicSearchApi` requires only bill and supporting-material hit searches. Universal search composes the bill/material,
amendment-hit and passage contracts. Research retrieval declares its own amendment collection dependency alongside
bill/material and passage search. These injectable boundaries do not remove capabilities from the live query service.

The operational liveness and readiness endpoints remain public `GET /health` and `GET /ready` contract paths. Their
explicit Next.js handlers live at `apps/legislation-web/src/app/health/route.ts` and
`apps/legislation-web/src/app/ready/route.ts`; documented `/api/**` operations remain under the `src/app/api` boundary. All
must preserve the standalone response, status, content type, and correlation-ID behavior.

The contract is split into focused pages:

- [Shared schemas and protocol behavior](schemas.md)
- [Legislative records and documents](legislative-records.md)
- [Record collection continuation and material link previews](record-collections.md)
- [People, organizations and meetings](civic-graph-and-events.md)
- [Search, research answers, and document comparison](search-and-diffs.md)
- [Subscriptions, deliveries, and webhooks](subscriptions-and-webhooks.md)

## Design rules

Regulatory additions are specified in [regulatory HTTP API and MCP](../../regulations/api-mcp-contract.md).
The implemented regulatory inventory contains `GET /api/legal/codes`, `GET /api/legal/codes/{codeId}`,
`GET /api/legal/codes/{codeId}/editions`,
`GET /api/legal/codes/{codeId}/provisions` and `GET /api/legal/versions/{versionId}/text`. Other proposed operations
remain excluded until their implementation gates pass.

1. A canonical record has one top-level retrieval URL. A nested URL represents a relationship or contextual collection,
   not a second identity.
2. Routes nest under at most one parent. A session ID already identifies its jurisdiction, so clients use
   `/api/sessions/{sessionId}/bills`, not a deeper jurisdiction/session/bill path.
3. `GET` collections browse and filter records. Ranked lexical, semantic, and hybrid retrieval uses `POST /api/search/*`
   because search inputs can contain arrays and model options that do not belong in a query string.
4. Meeting schedules are filtered meeting collections. Standalone calendar operations are outside the current contract.
5. Commissions and committees are organization classifications. Contextual convenience collections return canonical
   organization records whose detail URL remains `/api/organizations/{organizationId}`.
6. Batch reads accept at most 25 unique IDs and isolate safe errors to the affected item.
7. Generated answers never replace retrieval results. Every assertion must cite a canonical record and official source.

## Authentication and access classes

The HTTP API accepts configured WorkOS M2M bearer tokens for the API audience and, for first-party browser clients,
configured AuthKit user-session bearer tokens. M2M tokens are verified for issuer, signature, expiry, subject, optional
organization, and the exact audience of the receiving service. API and MCP credentials are not interchangeable.
AuthKit sessions are API-only and require the configured client ID, a nonempty session ID, and a maximum 30-day
lifetime. The MCP resource accepts only M2M tokens for its configured resource audience. Every operation declares one
of these access classes:

| Access class  | Meaning                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Public        | May be exposed without a user token after a separate product and security approval.             |
| Authenticated | Requires a valid user token.                                                                     |
| First-party   | Requires a valid user token and a first-party application client. Raw addresses use this boundary. |
| Operator      | Requires an operator role and is never part of the public developer API.                          |

The draft assumes all API routes are authenticated until a separate exposure review marks a route public. Subscription,
webhook and research-answer routes remain authenticated or more restrictive. Representative lookup is public but
same-origin only.

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
| GET    | `/api/changes/{changeId}`                                | Authenticated | `ChangeEvent`                   |
| POST   | `/api/resources/batch`                                  | Authenticated | `BatchResponse<CanonicalResource>` |

### Civic graph and events

| Method | Path                                              | Access        | Response schema             |
| ------ | ------------------------------------------------- | ------------- | --------------------------- |
| POST   | `/api/representatives`                            | Public        | `RepresentativeLookupResult` |
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
| GET    | `/api/meetings`                                   | Authenticated | `Page<MeetingSummary>`      |
| GET    | `/api/meetings/{meetingId}`                       | Authenticated | `MeetingDetail`             |
| GET    | `/api/meetings/{meetingId}/agenda`                | Authenticated | `Page<AgendaItem>`          |
| GET    | `/api/meetings/{meetingId}/agenda/{agendaItemId}` | Authenticated | `AgendaItem`                |
| GET    | `/api/meetings/{meetingId}/documents`             | Authenticated | `Page<EventDocument>`       |
| GET    | `/api/meetings/{meetingId}/documents/{eventDocumentId}` | Authenticated | `EventDocument`       |
| GET    | `/api/meetings/{meetingId}/participants`          | Authenticated | `Page<MeetingParticipant>`  |
| GET    | `/api/meetings/{meetingId}/participants/{participantId}` | Authenticated | `MeetingParticipant` |

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

The response set is also deterministic. Every authenticated operation declares `401`, `403`, and `500` with
`ErrorResponse`. Any operation accepting input declares `400` and `413`; a path-resource operation declares `404`;
model-backed or provider-backed operations declare `422` and `503`; mutation operations declare `409`; mutations with
`If-Match` also declare `412`; cacheable GET operations declare `304`. The endpoint's documented success status and
schema are the only success response. This matrix plus endpoint-specific exceptions is the exact OpenAPI response set.

The endpoint pages are the source contract for the future OpenAPI document; a generated specification must preserve
the documented request type, response envelope, statuses, calculated operation ID, and examples exactly.
