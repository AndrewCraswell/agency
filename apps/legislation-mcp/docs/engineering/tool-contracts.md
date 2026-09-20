# Legislative MCP tool contracts

## Shared behavior

M's [registration](../../src/mcp/tools.ts) and [HTTP adapter](../../src/mcp/http-query-adapter.ts) consume C's shared
research definitions, input schemas and canonical wire validation. W executes queries/models. This guide was checked against
that registry on September 16, 2026: 25 baseline read tools plus organization-gated `list_legal_codes`, `get_legal_code`,
`list_legal_editions`, `get_legal_edition`, `list_legal_provisions`, `search_regulations` and `get_legal_text` pilots,
with no calendar, raw-address, conversation or mutation tools. Product chat
actions use authorized application services, not an assumed MCP mutation surface. See [authentication](../operations/authentication.md)
and the [W search contract](../../../legislation-web/docs/engineering/api/search-and-diffs.md) for serving behavior.

Regulatory tools and their API mappings are in [legal tools](legal-tools.md).
[W code discovery](../../../legislation-web/docs/regulations/legal-code-discovery.md),
[edition/provision browsing](../../../legislation-web/docs/regulations/legal-edition-browsing.md)
and [exact legal text](../../../legislation-web/docs/regulations/legal-text-serving.md) are implemented locally. The text tool takes `versionId`, exactly one
`editionId` or `sourceObservationId`, optional `anchor` or `cursor`, and `limit` 1–3 (default 3).
It uses the typed API client, checks both credential audience and principal equality, and preserves lossless continuation.
Other regulatory tools and deployed acceptance remain open. Every result's text and structured copies together must
fit the 900,000-byte MCP response budget.

`search_regulations` uses [W's legal search API](../../../legislation-web/docs/regulations/legal-search-serving.md) without a separate ranking
path. Use `corpora: ["regulation"]` with discovered code or edition IDs; unavailable requested scope fails explicitly.
Its schema, filters, lexical limit 1–100, frozen pagination and explicit fallback permission match HTTP. Use returned
version/edition IDs for exact text. Source snippets are evidence, never tool instructions or a claim of current legal status.

Returned records contain canonical IDs and available source links. Bill lookup tools accept canonical IDs; resolve an
ambiguous printed identifier through search first. Provider IDs are metadata, not public identity.

List operations use opaque cursors, default to 20 results, and allow at most 100. Text queries are limited to 500
characters. Snippets are limited to 500 characters, and a single response contains at most 100,000 text characters.
Responses disclose truncation; a cursor exists only when the operation supports continuation. A bounded ranked window
may require refined filters rather than another page. Per-tool schemas and [W search limits](../../../legislation-web/docs/engineering/api/search-and-diffs.md) take precedence.
Source-dependent expansion searches return a warning when no record matches; clients must not interpret an empty result
as proof that the jurisdiction has no such people, committees, events, votes, amendments, or materials.

Stable error categories are `invalid_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`,
`dependency_unavailable`, and `internal`. Errors include a safe message and correlation ID and never include SQL,
credentials, stack traces, or provider secrets.

The shared registry does not impose a second whole-tool 30-second timer. M's typed HTTP client still applies its
configured API deadline and propagates request cancellation to the transport. W owns database and provider deadlines;
a genuine dependency timeout is reported as such rather than inferred from an operation's duration.
Oversized singleton records and metadata continue through lossless, snapshot-bound JSON fragments while each response
still fits the combined text-and-structured budget. Fragment continuations retain the first API response's
`meta.correlationId`, so per-request diagnostics do not invalidate unchanged source snapshots. Reconstructed envelopes
retain their original shape and correlation ID; each HTTP request and error still has its own telemetry correlation.
Changes to source content continue to invalidate the snapshot.

## Locked tools

### `search_bills`

Input: query plus optional jurisdiction IDs, session IDs, classifications, statuses, subjects, introduced-date range,
cursor, and limit. Output: ranked bill summaries with match explanation, source links, next cursor, and truncation flag.

### `get_bill`

Input: canonical `id` and optional `childLimit` (1-100), not a child cursor. Returns bounded related records with source
links. Use the relevant relationship/text tool for continuation rather than inventing another `get_bill` argument.

### `get_bills`

Input: 1-25 canonical bill IDs plus an optional per-bill `childLimit` of at most 25. Output: one independent bill-detail
result per unique ID, including each bill's bounded amendments. A missing bill is reported on that item and
does not discard successful results for the other IDs.

### `get_bill_timeline`

Input: canonical `id`, optional `cursor` and `limit` (1-100). Output: ordered actions and votes with stable event IDs,
dates or timestamps, description, result, source link, and a continuation cursor when needed.

### `search_bill_text`

Input: query plus optional bill, jurisdiction, session, document-version, date, cursor, and limit filters. Output: ranked
section matches with bill and document IDs, heading, snippet, lexical and semantic scores, source link, and next cursor.
Semantic and hybrid modes embed the query with `openai/text-embedding-3-small` at 1,536 dimensions, retrieve at most 25
matching document-section candidates, and rerank them with `cohere/rerank-v3.5` before applying the requested limit.

### `get_bill_text`

Input: canonical `id`, optional `documentId`, `versionCode` and `cursor`; no section selector. Output: ordered
document sections, content hash, source link, next cursor, and truncation flag.

### `compare_bill_versions`

Input: canonical `billId` and `documentIds` containing exactly two document IDs, not version codes. Output: identified versions and ordered change hunks
classified as added, removed, or unchanged, with source links and truncation signaling.

### `find_related_bills`

Input: bill lookup plus optional relation classifications, semantic expansion flag, cursor, and limit. Output: canonical
related bills with relationship type, relevance score when applicable, and relevant official links.

## Data-expansion tools

### `read_record_collection`

The shared schema includes `material-links` for complete supporting-material relationship retrieval. It accepts a
canonical material ID as `recordId`, optional `limit` (1–100, default 25) and an independently bound `cursor`.
Items retain the detail's joined link fields and material `sourceUrl`; follow `nextCursor` until absent.
`get_supporting_material` exposes `linksTruncated` separately from its section cursor and includes it in overall
`truncated`. Its relationship-ID arrays are only a preview when that flag is true. See
[collection continuation](../../../legislation-web/docs/engineering/api/record-collections.md) for ordering and cursor scope.

### `search_people` and `get_person`

Discovery accepts bounded name or party text plus optional jurisdiction, organization-membership, and active-status
filters. Detail returns the canonical person, legislative terms, memberships, and sponsored bills. Empty results may mean
that a jurisdiction does not publish people through the configured source.

### `search_organizations` and `get_organization`

Discovery accepts bounded name text plus optional jurisdiction, classification, parent-organization, and active-status
filters. Detail returns the canonical legislature, chamber, committee, or subcommittee with children, memberships, and
bounded bill activity. Organization availability is source-dependent.

### Events, votes, amendments, materials, and changes

`search_events` and `get_event` expose available meeting, hearing, agenda, participant and document records through the
canonical meeting API. `get_calendar` was removed; date-filtered events are the supported schedule view.
`get_bill_votes` is the preferred one-call path for answering who voted for or against a bill. It
returns up to 25 roll calls per page with every normalized member position and a continuation cursor. The service stops
the page early before it approaches the response-size ceiling, so unusually large House vote histories continue safely.
`search_votes`, `get_vote`, and `get_votes` expose the same records as separate discovery and detail operations when
finer control is needed.
`get_votes` accepts 1-25 roll-call IDs so a client can resolve every vote returned for a bill in one follow-up call.
For `get_vote`, `get_votes`, and `get_bill_votes`, M follows W's nested position cursors through the typed HTTP
client before shared research pagination limits the response by bytes. Position IDs, publisher counts and the bill's
outer vote cursor are preserved. Completed HTTP position collections have no child cursor and are not truncated;
clients follow the shared tool's `nextCursor` for remaining output. Reads use the existing MCP cancellation signal
and an overall configured API timeout (30 seconds by default), with no position-count cap. Invalid cursors,
duplicate or mismatched positions, and non-progressing pages fail explicitly instead of returning partial success.
`search_amendments`,
`search_amendments_for_bills`, `get_amendment`, `get_amendments`, `search_supporting_materials`, and
`get_supporting_material` expose their canonical records and links;
material detail includes paginated extracted sections. `search_changes` exposes observed canonical changes without
generating summaries or predictions. Every list is cursor-paginated and returns explicit truncation metadata.

`search_amendments` and `search_supporting_materials` accept `lexical`, `semantic`, or `hybrid` mode. Amendment semantic
search embeds the query with `openai/text-embedding-3-small` at 1,536 dimensions, searches structured amendments and
amendment-classified document sections independently, then merges them with reciprocal-rank fusion without reranking.
Supporting-material semantic search uses `voyageai/voyage-4` at 1,024 dimensions with `input_type=query` and preserves
the embedding rank without reranking. Exact and batch relationship lookups never create embeddings.
Material search and relationship results omit the complete extracted `text` field so one large attachment cannot exceed
the MCP response ceiling. `get_supporting_material` returns the same bounded material metadata plus paginated sections;
section text is the canonical content-delivery surface.

`search_amendments_for_bills` accepts 1-25 bill IDs and returns a separate bounded search result for each bill.
`get_amendments` accepts 1-25 amendment IDs. Batch lookups deduplicate repeated IDs and isolate `not_found` and other
safe domain errors to the affected item.

Federal amendments are returned as structured records with `recordType: "structured"`. State publishers often expose
an amendment only as a labeled bill document. Those files are also returned by the amendment tools with
`recordType: "document"`, a stable `amendment:document:...` ID, the original `documentId`, bill and jurisdiction IDs,
title, date, and source URL. The document-backed representation deliberately does not invent a sponsor, status, actions,
or votes. The original file remains present in the bill's `documents` collection as well.

### Finding who voted yes or no on a bill

1. Call `get_bill_votes` with the canonical `billId`. A bill may have multiple roll calls, including procedural,
   amendment, and final-passage votes. Use each result's `motion`, `question`, `classification`, `heldAt`, and `result`
   to select or label the relevant votes.
2. Each result contains the roll call plus `positions`. The normalized `position.option` is `yes`, `no`, `absent`,
   `abstain`, `not-voting`, `present`, `proxy`, `paired`, or `other`; `person` contains the matched canonical legislator
   when one is available, while `position.sourceName` and `position.sourcePersonId` preserve the publisher identity.
3. If the result is truncated, call `get_bill_votes` again with `nextCursor` until every roll call has been collected
   before presenting the bill's complete voting history.
