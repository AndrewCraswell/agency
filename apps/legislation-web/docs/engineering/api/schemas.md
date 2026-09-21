# Shared HTTP API schemas and protocol behavior

This page is normative. Endpoint pages may narrow a shared type but may not silently change it.

W owns HTTP protocol and response presentation here. C owns the
[canonical data model](../../../../../packages/legislation-core/docs/engineering/data-model.md),
[identity/minimum records](../../../../../packages/legislation-core/docs/engineering/identity.md) and
[legal reader/rights contracts](../../../../../packages/legislation-core/docs/regulations/reader-contract.md),
plus typed API-client wire validation. I owns collection/completeness evidence; M consumes the API, not the database.

## Wire conventions

- JSON is UTF-8. Ordinary requests use `application/json`; `PATCH` uses `application/merge-patch+json`.
- Fields are `camelCase`. Dates are `YYYY-MM-DD`; timestamps are RFC 3339 UTC.
- IDs are opaque strings, 1 to 256 characters. Path IDs are percent-encoded as one segment.
- `null` means unknown. `[]` means known empty. Fields are omitted only for an approved sparse response.
- Every canonical record has `id`, `canonicalUrl`, `sources`, and `updatedAt`. `canonicalUrl` is its unique retrieval URL.
- Unknown body fields and query parameters return `400 invalid_request`.
- Array query parameters use repeated keys, for example `classification=committee&classification=commission`.

## Shared parameters

| Name | Type and constraints | Default |
| --- | --- | --- |
| `cursor` | opaque string from the immediately preceding page | none |
| `limit` | integer, 1 to 100 | `20` |
| `fields` | comma-separated endpoint-approved field names | all |
| `q` | trimmed string, 1 to 500 characters | none |
| ID filters | opaque ID; repeat the key for arrays | none |
| `from`, `to` | inclusive date or RFC 3339 timestamp; both values use the same format and `from <= to` | none |
| `updatedSince` | inclusive RFC 3339 timestamp | none |
| `sort` | endpoint enum | endpoint-specific |

A cursor binds the caller, filters, fields, and sort. Changing them returns `400 invalid_request`. GET and DELETE have
no body unless explicitly documented.

Endpoint parameter lists use these exact reusable schemas: a singular name ending in `Id` is one opaque ID; a plural
name ending in `Ids` is a JSON array of 1 to 25 unique opaque IDs in POST bodies; a repeated singular ID or enum query
key is an array with at most 25 unique values; names beginning `is` are booleans encoded as `true` or `false`; names
ending `From` or `To` are inclusive ISO dates unless the endpoint says timestamp; `pageFrom` and `pageTo` are positive
integers with `pageFrom <= pageTo`; and every `sort` value and default is enumerated by its endpoint. Optional query
parameters are absent, never the string `null`. POST JSON may use explicit `null` only where the named type permits it.
Every collection appends canonical `id` ascending as its final stable tie-breaker, including every named sort option.
All fields named `count`, `*Count`, `*Size`, `ordinal`, `sequence`, `attemptCount`, `page*`, `*Offset`, `start`, or `end`
are nonnegative integers unless a geographic coordinate or timestamp is explicitly named. Byte counts and offsets are
64-bit-safe integers; `end >= start`. Scores, confidences, latitude, and longitude are finite decimal numbers in their
documented ranges. Every member of a named count object, including `VoteCounts` and document-diff `counts`, is a
nonnegative integer. Wrapper collections without a top-level ID use the embedded canonical ID as the final tie-breaker:
`BillActivity` uses `bill.id` and `VotePositionActivity` uses `position.id`.

## Complete response envelopes

```ts
type ResourceResponse<T> = {
  data: T
  meta: { correlationId: string; warnings: string[] }
  links: { self: string }
}
type Page<T> = {
  data: T[]
  meta: { correlationId: string; limit: number; nextCursor: string | null; truncated: boolean; warnings: string[] }
  links: { self: string; next: string | null }
}
type SearchPage<T> = Page<T> & {
  meta: Page<T>["meta"] & { mode: SearchMode; isReranked: boolean; models: ModelUsage[] }
}
type SearchMode = "lexical" | "semantic" | "hybrid"
type ModelUsage = {
  provider: "openai" | "voyageai" | "cohere"
  model: string
  purpose: "embedding" | "reranking" | "generation"
  dimensions: number | null
}
```

The proposed legal search extension is defined by `src/api-client/legal-search-contract.ts` and the
[regulatory API contract](../../regulations/api-mcp-contract.md#search-request-and-result). It reuses the search
envelope and adds strict legal hits and `meta.legal` generation, effective-mode, degradation and candidate truncation
fields. `meta.mode` records the requested mode. These schemas are implemented; route/client/MCP registration remains gated.

Lists return `200 Page<T>`; reads return `200 ResourceResponse<T>`; creates return `201 ResourceResponse<T>` plus
`Location`; updates return `200`; deletes return `200 ResourceResponse<CancellationReceipt>`. Calculations
(diff, research answer, and representative lookup) return `200`. `304` has no body. The representative lookup request
and response are defined in [its operating contract](../../operations/representative-lookup.md).

## Batch body and response

Every typed batch body is `{ "ids": string[] }`, with 1 to 25 unique IDs after first-occurrence de-duplication.

```ts
type BatchItem<T> =
  | { id: string; status: "ok"; data: T }
  | { id: string; status: "error"; error: ItemError }
type ItemError = {
  category: "not_found" | "forbidden" | "dependency_unavailable"
  message: string
  retryable: boolean
}
type BatchResponse<T> = {
  data: BatchItem<T>[]
  meta: { correlationId: string; requested: number; returned: number; warnings: string[] }
  links: { self: string }
}
```

The heterogeneous `/api/resources/batch` body is `{ "items": ResourceBatchRequestItem[] }`, 1 to 25 items. Each item
is `{type, id}`; `type` is `jurisdiction`, `session`, `bill`, `amendment`, `vote`, `document`, `supporting-material`,
`person`, `organization`, `meeting`, or `calendar`. The response is `BatchResponse<CanonicalResource>` and each success
retains its discriminating `type`. A valid outer batch returns HTTP `200` even when individual items fail.

The internal batch/projection and subscription schemas still declare `calendar`, and meeting summaries retain a nullable
`calendarId`. These retained values do not restore removed calendar endpoints or guarantee a usable calendar target.
Their public batch/target behavior must be reconciled with the reduced route inventory before broader exposure; do not
advertise calendar discovery from enum presence. This documentation cleanup changes no runtime schema.

## Error contract

```ts
type ErrorResponse = {
  error: {
    category: ErrorCategory
    message: string
    correlationId: string
    retryable: boolean
    details?: Record<string, JsonValue>
  }
}
```

| Category | Status | Meaning |
| --- | ---: | --- |
| `invalid_request` | 400 | malformed input, unsupported parameter, or invalid cursor |
| `unauthorized` | 401 | bearer token absent or invalid |
| `forbidden` | 403 | caller lacks access |
| `not_found` | 404 | resource absent or invisible |
| `conflict` | 409 | uniqueness or idempotency conflict |
| `precondition_failed` | 412 | stale or missing required `If-Match` |
| `payload_too_large` | 413 | request or response exceeds its ceiling |
| `unprocessable` | 422 | valid JSON cannot be fulfilled |
| `internal` | 500 | safe unexpected failure |
| `dependency_unavailable` | 503 | required dependency unavailable |

Retryable `503` responses include `Retry-After`. Errors never expose SQL, stacks, provider payloads, credentials, raw
addresses, or another tenant's identifiers.

## Caching, concurrency, idempotency, and limits

- Retrievals emit `ETag` and `Last-Modified` when possible; `If-None-Match` may return `304`.
- Mutable resources expose `revision`. PATCH and DELETE require `If-Match`; stale values return
  `412 precondition_failed`.
- Mutations require `Idempotency-Key`: 8 to 128 printable ASCII characters. Scope is principal, method, and canonical
  path; retention is 24 hours. Exact replay returns the original status, headers, and body. Different input returns
  `409 conflict`.
- Secret responses are encrypted in the idempotency store for 24 hours so exact replay returns the same one-time secret.
- Request bodies are at most 1 MiB, batch bodies 5 MiB, section snippets 100,000 characters, and research responses
  256 KiB. Larger output returns `413` with a link to a narrower operation.
- Authenticated responses use `Cache-Control: private, no-store`.

## Provenance and canonical fields

```ts
type SourceReference = {
  provider: string
  sourceUrl: string
  sourceUpdatedAt: string | null
  retrievedAt: string
  isOfficial: boolean
}
type CanonicalFields = { id: string; canonicalUrl: string; sources: SourceReference[]; updatedAt: string }
```

Every summary, detail, section, search hit, diff operation, timeline item, and research citation includes non-empty
`sources` directly or embeds a canonical record that does.

## Core resource schemas

The notation `A & {...}` includes every required field of `A`; enum values below are exhaustive.

```ts
type Jurisdiction = CanonicalFields & { type: "jurisdiction"; name: string; classification: "country" | "state" | "district" | "territory"; timezone: string | null; isActive: boolean }
type Session = CanonicalFields & { type: "session"; jurisdictionId: string; name: string; classification: string; startDate: string | null; endDate: string | null; isActive: boolean }
type BillSummary = CanonicalFields & { type: "bill"; jurisdictionId: string; sessionId: string; identifier: string; title: string; classification: string[]; status: string | null; subjects: string[]; introducedDate: string | null; latestActionAt: string | null }
type Sponsor = { person: PersonSummary | null; sourceName: string; classification: "primary" | "cosponsor" | "author" | "other"; isPrimary: boolean; sources: SourceReference[] }
type BillRelation = { relatedBill: BillSummary; classification: "companion" | "replacement" | "replaced-by" | "prior-session" | "related" | "other"; sources: SourceReference[] }
type BillAction = CanonicalFields & { type: "bill-action"; billId: string; description: string; date: string; occurredAt: string | null; sequence: number; classifications: string[]; organization: OrganizationSummary | null }
type ChildCollectionPageInfo = { limit: number; nextCursor: string | null; truncated: boolean }
type ChildPageInfo = Record<"documents" | "amendments" | "votes", ChildCollectionPageInfo>
type BillDetail = BillSummary & { abstract: string | null; sponsors: Sponsor[]; organizations: OrganizationSummary[]; documents: DocumentSummary[]; relations: BillRelation[]; amendments: AmendmentSummary[]; latestActions: BillAction[]; voteSummaries: VoteSummary[]; childPageInfo: ChildPageInfo }
type BillActivity = { bill: BillSummary; roles: ("sponsor" | "cosponsor" | "author" | "subject")[]; firstObservedAt: string; latestObservedAt: string }
```

```ts
type AmendmentSummary = CanonicalFields & { type: "amendment"; billId: string; jurisdictionId: string; recordType: "structured" | "document"; identifier: string; title: string; submittedDate: string | null; status: string | null; documentId: string | null }
type AmendmentAction = CanonicalFields & { type: "amendment-action"; amendmentId: string; description: string; date: string; occurredAt: string | null; sequence: number; classifications: string[] }
type AmendmentDetail = AmendmentSummary & { description: string | null; sponsors: Sponsor[]; actions: AmendmentAction[]; documents: DocumentSummary[] }
type VoteCounts = { yes: number; no: number; absent: number; abstain: number; notVoting: number; present: number; proxy: number; paired: number; other: number }
type VoteSummary = CanonicalFields & { type: "vote"; billId: string | null; organizationId: string | null; motion: string; question: string | null; classification: string | null; heldAt: string | null; date: string; result: "passed" | "failed" | "other"; counts: VoteCounts }
type VotePosition = CanonicalFields & { type: "vote-position"; voteId: string; person: PersonSummary | null; option: "yes" | "no" | "absent" | "abstain" | "not-voting" | "present" | "proxy" | "paired" | "other"; sourceName: string; sourcePersonId: string | null }
type VoteDetail = VoteSummary & { positions: VotePosition[]; positionsPageInfo: ChildCollectionPageInfo }
type VotePositionActivity = { vote: VoteSummary; position: VotePosition; bill: BillSummary | null }
```

```ts
type ProcessingStatus = "pending" | "processing" | "processed" | "failed" | "unsupported"
type OcrStatus = "not-required" | "pending" | "processing" | "processed" | "failed" | "unsupported"
type DocumentSummary = CanonicalFields & { type: "document"; billId: string | null; classification: "version" | "amendment" | "fiscal-note" | "analysis" | "supplemental"; title: string; documentDate: string | null; versionCode: string | null; mimeType: string | null; sourceUrl: string; storedUrl: string | null; processingStatus: ProcessingStatus; ocrStatus: OcrStatus; contentHash: string | null }
type DocumentDetail = DocumentSummary & { byteSize: number | null; pageCount: number | null; sectionCount: number; textCharacterCount: number; failureCategory: string | null }
type DocumentSection = CanonicalFields & { type: "document-section"; documentId: string; billId: string | null; ordinal: number; heading: string | null; text: string; startOffset: number; endOffset: number; pageStart: number | null; pageEnd: number | null; contentHash: string; sourceUrl: string }
type SupportingMaterialSummary = CanonicalFields & { type: "supporting-material"; jurisdictionId: string; classification: string; title: string; billIds: string[]; amendmentIds: string[]; meetingIds: string[]; organizationIds: string[]; documentDate: string | null; sourceUrl: string; mimeType: string | null; processingStatus: ProcessingStatus }
type SupportingMaterialDetail = SupportingMaterialSummary & { linksTruncated: boolean; storedUrl: string | null; byteSize: number | null; pageCount: number | null; sectionCount: number; textCharacterCount: number }
type SupportingMaterialSection = CanonicalFields & { type: "supporting-material-section"; materialId: string; ordinal: number; heading: string | null; text: string; pageStart: number | null; pageEnd: number | null; contentHash: string; sourceUrl: string }
```

```ts
type ChangeEvent = CanonicalFields & { type: "change"; recordType: string; recordId: string; classification: "create" | "update" | "delete" | "cancel" | "reschedule" | "relationship-change"; changedFields: string[]; before: Record<string, unknown> | null; after: Record<string, unknown> | null; jurisdictionId: string | null; organizationId: string | null; personId: string | null; observedAt: string; sourceUpdatedAt: string | null }
type ResourceBatchRequestItem = {
  type: "jurisdiction" | "session" | "bill" | "amendment" | "vote" | "document" | "supporting-material" | "person" | "organization" | "meeting" | "calendar"
  id: string
}
type CanonicalResource = Jurisdiction | Session | BillDetail | AmendmentDetail | VoteDetail | DocumentDetail | SupportingMaterialDetail | PersonDetail | OrganizationDetail | MeetingDetail | CalendarDetail
type CancellationReceipt = { id: string; cancelledAt: string; finalRevision: string }
```

`before` and `after` are capped at 64 KiB and never contain full document text or provider payloads.
Fields whose canonical JSON exceeds 8 KiB are represented as
`{ representation: "sha256", byteLength: number, digest: string }`, where the digest and byte count cover
the complete canonical JSON value in UTF-8. This is an explicit content reference, not truncated text.
Full values remain on their canonical records; unchanged large values do not emit repeat changes.
