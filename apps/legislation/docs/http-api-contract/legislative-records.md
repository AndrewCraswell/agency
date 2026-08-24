# Legislative records and document endpoints

All operations use the [shared envelopes, pagination, errors, and named schemas](schemas.md). Each heading's operation
ID is its lower-camel-case label in parentheses. A `GET` request has no
request body. Unless an operation says otherwise, successful retrieval returns `200`; conditional retrieval may return
`304`; documented domain failures use the shared error body.

## Jurisdictions and sessions

### `GET /api/jurisdictions` (`listJurisdictions`)

Lists covered jurisdictions. Query parameters are `cursor`, `limit`, `classification`, `isActive`, and `q` for a
case-insensitive name or abbreviation prefix. `classification` is a repeated canonical enum and `isActive` is boolean.
Response is `Page<Jurisdiction>`, ordered by name then ID.

### `GET /api/jurisdictions/{jurisdictionId}`

Path parameter `jurisdictionId` is a canonical jurisdiction ID. Response is `ResourceResponse<Jurisdiction>`. Returns
`404 not_found` when absent.

### `GET /api/jurisdictions/{jurisdictionId}/sessions`

Lists sessions owned by the jurisdiction. Query parameters are `cursor`, `limit`, `isActive`, `from`, and `to`; the date
range includes sessions whose interval intersects the requested interval. Response is `Page<Session>`, ordered by start
date descending, name, then ID.

### `GET /api/sessions/{sessionId}`

Path parameter `sessionId` is a canonical session ID. Response is `ResourceResponse<Session>`.

### Contextual jurisdiction and session collections

These relationship collections do not create alternate identities. Every item links to its top-level canonical URL.

| Method and path                                           | Query parameters                                                                                                  | Response                         | Stable order                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `GET /api/jurisdictions/{jurisdictionId}/bills`           | `cursor`, `limit`, `sessionId`, `classification`, `status`, `subject`, `introducedFrom`, `introducedTo`, `sort` | `Page<BillSummary>`              | selected bill sort, then ID               |
| `GET /api/jurisdictions/{jurisdictionId}/organizations`   | `cursor`, `limit`, `classification`, `parentOrganizationId`, `isActive`, `q`                                    | `Page<OrganizationSummary>`      | name, then ID                             |
| `GET /api/jurisdictions/{jurisdictionId}/commissions`     | `cursor`, `limit`, `isActive`, `q`                                                                               | `Page<OrganizationSummary>`      | name, then ID                             |
| `GET /api/jurisdictions/{jurisdictionId}/committees`      | `cursor`, `limit`, `chamber`, `parentOrganizationId`, `isActive`, `q`                                            | `Page<OrganizationSummary>`      | name, then ID                             |
| `GET /api/jurisdictions/{jurisdictionId}/meetings`        | `cursor`, `limit`, `organizationId`, `from`, `to`, `status`, `classification`                                   | `Page<MeetingSummary>`           | start time, upstream sequence, then ID    |
| `GET /api/sessions/{sessionId}/bills`                      | `cursor`, `limit`, `classification`, `status`, `subject`, `introducedFrom`, `introducedTo`, `sort`             | `Page<BillSummary>`              | selected bill sort, then ID               |
| `GET /api/sessions/{sessionId}/meetings`                   | `cursor`, `limit`, `organizationId`, `from`, `to`, `status`, `classification`                                   | `Page<MeetingSummary>`           | start time, upstream sequence, then ID    |

Commission and committee routes are filtered organization views. Their items retain organization IDs and canonical
`/api/organizations/{organizationId}` links. Contextual bill collections default `sort=latest-action-desc`; contextual
meeting collections default `sort=starts-asc`.

## Bills

### `GET /api/bills`

Browses bills without relevance ranking. For full-text or semantic retrieval use `POST /api/search/bills`.

| Query parameter   | Type       | Meaning                                                                 |
| ----------------- | ---------- | ----------------------------------------------------------------------- |
| `cursor`, `limit` | shared     | Cursor pagination.                                                      |
| `jurisdictionId`  | string     | Exact canonical jurisdiction.                                           |
| `sessionId`       | string     | Exact canonical session.                                                |
| `identifier`      | string     | Normalized exact or prefix printed identifier.                          |
| `classification`  | string[]   | One or more canonical bill classifications.                             |
| `status`          | string[]   | One or more canonical lifecycle statuses.                               |
| `subject`         | string[]   | Records containing every requested normalized subject.                  |
| `sponsorPersonId` | string     | Bills with a matching canonical sponsor.                                |
| `organizationId`  | string     | Bills linked to a chamber, committee, commission, or other organization. |
| `introducedFrom`  | date       | Inclusive lower introduced-date bound.                                  |
| `introducedTo`    | date       | Inclusive upper introduced-date bound.                                  |
| `updatedFrom`     | timestamp  | Inclusive canonical update bound.                                       |
| `sort`            | enum       | `updated-desc`, `introduced-desc`, `identifier-asc`, or `latest-action-desc` (default). |

Response is `Page<BillSummary>`.

### `POST /api/bills/batch` (`batchGetBills`)

Request body:

```json
{
  "ids": ["bill:us:119:hr:1"]
}
```

`ids` is required with 1 to 25 entries. Duplicates are resolved once and returned in first-occurrence order.
Embedded child collections use a fixed limit of 25 and expose independent cursors in `childPageInfo`. Response is
`BatchResponse<BillDetail>`. Invalid batch shape returns `400`; valid batches with item-level failures return `200`.

### `POST /api/bills/amendments/batch` (`listAmendmentsForBills`)

Request is `{ "billIds": string[], "recordType"?: ("structured" | "document")[], "status"?: string[],
"submittedFrom"?: date, "submittedTo"?: date, "limitPerBill"?: integer }`. `billIds` contains 1 to 25 unique IDs and
`limitPerBill` is 1 to 100, default 25. Response is:

```ts
type BillAmendmentBatchResponse = {
  data: (
    | { billId: string; status: "ok"; page: Page<AmendmentSummary> }
    | { billId: string; status: "error"; error: ItemError }
  )[]
  meta: { correlationId: string; requested: number; returned: number; warnings: string[] }
  links: { self: string }
}
```

A missing or forbidden bill uses the error branch instead of `page`. Each page has its own cursor,
which is passed to the single-bill `/api/bills/{billId}/amendments` endpoint.

### `GET /api/bills/{billId}`

Path parameter `billId` is required. Query parameter `childLimit` is 1 to 25, default 25, and bounds the first page of
the embedded document, amendment, and vote collections. Each `childPageInfo` member has its own cursor, used only with that collection's
relationship endpoint. Response is `ResourceResponse<BillDetail>`. Clients that need a complete
large child collection should follow its dedicated relationship endpoint rather than repeatedly expanding bill detail.

### `GET /api/bills/{billId}/timeline` (`getBillTimeline`)

Query parameters are `cursor`, `limit`, `from`, `to`, and `type` (`action`, `vote`, `meeting-outcome`, or repeated values).
Response is `Page<TimelineItem>`. The union is exact; impossible payload branches are omitted:

```ts
type TimelineFields = { id: string; occurredAt: string | null; date: string; sequence: number; title: string; description: string; sources: SourceReference[] }
type TimelineItem =
  | TimelineFields & { type: "action"; action: BillAction }
  | TimelineFields & { type: "vote"; vote: VoteSummary }
  | TimelineFields & { type: "meeting-outcome"; meetingOutcome: MeetingOutcome }
```

Ordering is date or timestamp, canonical source sequence, type, then ID.

### `GET /api/bills/{billId}/related` (`findRelatedBills`)

Query parameters are `cursor`, `limit`, repeated `classification` from `BillRelation.classification`, and `mode`
(`explicit`, `similar`, or `all`; default `all`). Response is `Page<RelatedBillHit>`, where
`RelatedBillHit = { bill: BillSummary; relationship: BillRelation | null; similarityScore: number | null;
sources: SourceReference[] }`. Explicit publisher relationships sort first, then similarity descending, then bill ID.
Similarity uses the source bill's stored `voyageai/voyage-4` 1,024-dimensional bill vector; it does not generate a new
query vector. It retrieves 25 cosine-distance candidates within the requested jurisdiction/session scope and reports
`similarityScore = clamp(1 - cosineDistance, 0, 1)`. `similar` and `all` require that vector and the HNSW index; if
unavailable the endpoint returns `503 dependency_unavailable`, not lexical substitution.

### `GET /api/bills/{billId}/sections` (`getBillText`)

Provides the MCP-style one-call traversal of all processed bill-version text. Query parameters are `cursor`, `limit`,
repeated `documentId`, repeated `versionCode`, `heading`, `pageFrom`, and `pageTo`. Response is
`Page<DocumentSection>`, ordered by document date, version code, document ID, and ordinal. This is unranked retrieval;
`POST /api/search/passages` performs ranked passage search.

### Bill relationship collections

| Method and path                              | Query parameters                                                                 | Response                  |
| -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `GET /api/bills/{billId}/amendments`         | `cursor`, `limit`, `recordType`, `status`, `submittedFrom`, `submittedTo`       | `Page<AmendmentSummary>`  |
| `GET /api/bills/{billId}/votes`              | `cursor`, `limit`, `from`, `to`, `organizationId`, `classification`, `result`  | `Page<VoteDetail>`        |
| `GET /api/bills/{billId}/documents`          | `cursor`, `limit`, `classification`, `versionCode`, `processingStatus`         | `Page<DocumentSummary>`   |
| `GET /api/bills/{billId}/changes`            | `cursor`, `limit`, `classification`, `observedFrom`, `observedTo`              | `Page<ChangeEvent>`       |

Bill vote pages include complete normalized positions for every returned roll call. The service may end a page before
the requested limit to remain under the response-size ceiling; `nextCursor` and `truncated` report continuation.

## Amendments

### `GET /api/amendments`

Browses amendments. Query parameters are `cursor`, `limit`, `billId`, `jurisdictionId`, `sponsorPersonId`, `recordType`,
`status`, `submittedFrom`, `submittedTo`, and `sort` (`submitted-desc` default, `updated-desc`, or `identifier-asc`). Response is
`Page<AmendmentSummary>`. State amendment documents appear with `recordType: document`; the API does not invent sponsor,
status, action, or vote fields that the publisher did not provide.

### `POST /api/amendments/batch` (`batchGetAmendments`)

Request body is `{ "ids": string[] }` with 1 to 25 canonical amendment IDs. Response is
`BatchResponse<AmendmentDetail>`.

### `GET /api/amendments/{amendmentId}`

Returns `ResourceResponse<AmendmentDetail>`. A document-backed amendment has an empty sponsor and action collection and
links to its canonical document.

## Votes

### `GET /api/votes`

Query parameters are `cursor`, `limit`, `billId`, `personId`, `organizationId`, `jurisdictionId`, `from`, `to`,
`classification`, `result`, and `sort` (`held-desc` default or `held-asc`). When `personId` is provided, only votes with a stored
position for that person match, but each returned item remains a `VoteSummary`. Response is `Page<VoteSummary>`.

### `POST /api/votes/batch` (`batchGetVotes`)

Request body is `{ "ids": string[] }` with 1 to 25 canonical roll-call IDs. Response is
`BatchResponse<VoteDetail>`.

### `GET /api/votes/{voteId}`

Returns `ResourceResponse<VoteDetail>`. Positions preserve the normalized option, matched canonical person when
available, and publisher identity fields. An unmatched publisher identity is not omitted.

### `GET /api/votes/{voteId}/positions` (`listVotePositions`)

Query parameters are `cursor`, `limit`, repeated `option`, and `personId`. Response is `Page<VotePosition>`, ordered by
publisher sequence then ID. The cursor in `VoteDetail.positionsPageInfo` is consumed here.

Sponsors, organizations, relations, and `latestActions` embedded by `BillDetail` are complete. Ingestion enforces hard
per-bill maxima of 500 sponsors, 250 organizations, 500 relations, and 100 latest actions; exceeding an invariant rejects
the source record for operator remediation rather than silently truncating an API response. Amendment detail similarly
contains complete arrays with maxima of 500 sponsors, 1,000 actions, and 500 documents.

## Documents and supporting materials

### `GET /api/documents/{documentId}`

Returns `ResourceResponse<DocumentDetail>`. The record exposes both the official `sourceUrl` and `storedUrl` when a
stored artifact exists. A client may prefer the stored URL for reliable delivery while displaying the official link as
provenance. No body is accepted.

### `GET /api/documents/{documentId}/sections`

Returns ordered, unranked `Page<DocumentSection>`. Query parameters are `cursor`, `limit`, `heading`, `pageFrom`, and
`pageTo`. This endpoint reads a known document; it does not perform lexical or semantic ranking. Use
`POST /api/search/passages` to search within one or more documents.

### `GET /api/supporting-materials`

Query parameters are `cursor`, `limit`, `jurisdictionId`, `billId`, `amendmentId`, `meetingId`, `organizationId`,
`classification`, `documentFrom`, `documentTo`, `processingStatus`, and `sort` (`document-desc` default, `updated-desc`, or
`title-asc`). Response is `Page<SupportingMaterialSummary>`. Full extracted text is never embedded in list items.

### `GET /api/supporting-materials/{materialId}`

Returns `ResourceResponse<SupportingMaterialDetail>`. The response contains bounded metadata, links, and section count,
not one unbounded text field.

### `GET /api/supporting-materials/{materialId}/sections`

Returns ordered `Page<SupportingMaterialSection>`. Query parameters are `cursor`, `limit`, `heading`, `pageFrom`, and
`pageTo`.

## Change feed

### `GET /api/changes`

Query parameters are `cursor`, `limit`, `recordType`, `recordId`, `jurisdictionId`, `organizationId`, `personId`,
`classification`, `observedFrom`, and `observedTo`. Response is `Page<ChangeEvent>`, ordered by observation time then ID.
The feed is bounded by the configured retention period and is not a complete provenance ledger.

## Heterogeneous resource batch

### `POST /api/resources/batch` (`batchGetResources`)

Uses the exact `ResourceBatchRequestItem`, `CanonicalResource`, and `BatchResponse` definitions in
[shared schemas](schemas.md). It exists for clients resolving mixed search references; typed batch endpoints remain
preferred. It returns `200` for a valid outer request and the standard `400`, `401`, `403`, `413`, `429`, `500`, and
`503` errors.
