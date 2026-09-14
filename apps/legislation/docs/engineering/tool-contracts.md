# Legislative MCP tool contracts

## Shared behavior

Proposed regulatory tools and their API mappings are in [regulatory HTTP API and MCP](../regulations/api-mcp-contract.md).
They extend the existing API-backed adapter after validation; this link does not mark those tools implemented.

All returned bill records contain canonical IDs and relevant official links. Lookup inputs accept canonical bill IDs or an
unambiguous jurisdiction, session, bill-type, and bill-number tuple. Provider IDs are metadata, not public identity.

List operations use opaque cursors, default to 20 results, and allow at most 100. Text queries are limited to 500
characters. Snippets are limited to 500 characters, and a single response contains at most 100,000 text characters.
Responses include `truncated: true` and a continuation cursor whenever a configured limit removes available content.
Source-dependent expansion searches return a warning when no record matches; clients must not interpret an empty result
as proof that the jurisdiction has no such people, committees, events, calendars, votes, amendments, or materials.

Stable error categories are `invalid_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`,
`dependency_unavailable`, and `internal`. Errors include a safe message and correlation ID and never include SQL,
credentials, stack traces, or provider secrets.

## Locked tools

### `search_bills`

Input: query plus optional jurisdiction IDs, session IDs, classifications, statuses, subjects, introduced-date range,
cursor, and limit. Output: ranked bill summaries with match explanation, source links, next cursor, and truncation flag.

### `get_bill`

Input: canonical ID plus optional `childCursor` and `childLimit`. Output: canonical metadata, sponsors, latest status,
subjects, documents, relations, amendments, upstream attribution, source links, and `nextChildCursor` when
any child collection has another bounded page.

### `get_bills`

Input: 1-25 canonical bill IDs plus an optional per-bill `childLimit` of at most 25. Output: one independent bill-detail
result per unique ID, including each bill's bounded amendments. A missing bill is reported on that item and
does not discard successful results for the other IDs.

### `get_bill_timeline`

Input: bill lookup plus optional `childCursor` and `childLimit`. Output: ordered actions and votes with stable event IDs,
dates or timestamps, description, result, source link, and a continuation cursor when needed.

### `search_bill_text`

Input: query plus optional bill, jurisdiction, session, document-version, date, cursor, and limit filters. Output: ranked
section matches with bill and document IDs, heading, snippet, lexical and semantic scores, source link, and next cursor.
Semantic and hybrid modes embed the query with `openai/text-embedding-3-small` at 1,536 dimensions, retrieve at most 25
matching document-section candidates, and rerank them with `cohere/rerank-v3.5` before applying the requested limit.

### `get_bill_text`

Input: bill lookup, optional document ID or version code, optional section identifier, and cursor. Output: ordered
document sections, content hash, source link, next cursor, and truncation flag.

### `compare_bill_versions`

Input: bill lookup and exactly two document IDs or version codes. Output: identified versions and ordered change hunks
classified as added, removed, or unchanged, with source links and truncation signaling.

### `find_related_bills`

Input: bill lookup plus optional relation classifications, semantic expansion flag, cursor, and limit. Output: canonical
related bills with relationship type, relevance score when applicable, and relevant official links.

## Data-expansion tools

### `search_people` and `get_person`

Discovery accepts bounded name or party text plus optional jurisdiction, organization-membership, and active-status
filters. Detail returns the canonical person, legislative terms, memberships, and sponsored bills. Empty results may mean
that a jurisdiction does not publish people through the configured source.

### `search_organizations` and `get_organization`

Discovery accepts bounded name text plus optional jurisdiction, classification, parent-organization, and active-status
filters. Detail returns the canonical legislature, chamber, committee, or subcommittee with children, memberships, and
bounded bill activity. Organization availability is source-dependent.

### Events, calendars, votes, amendments, materials, and changes

`search_events`, `get_event`, and `get_calendar` expose available meeting, hearing, agenda, participant, document, and
calendar records. `get_bill_votes` is the preferred one-call path for answering who voted for or against a bill. It
returns up to 25 roll calls per page with every normalized member position and a continuation cursor. The service stops
the page early before it approaches the response-size ceiling, so unusually large House vote histories continue safely.
`search_votes`, `get_vote`, and `get_votes` expose the same records as separate discovery and detail operations when
finer control is needed.
`get_votes` accepts 1-25 roll-call IDs so a client can resolve every vote returned for a bill in one follow-up call.
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
