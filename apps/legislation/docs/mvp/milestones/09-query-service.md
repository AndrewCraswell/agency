# Milestone 9: Source-independent legislative query service

## Goal

Implement and test the product operations independently of MCP transport concerns.

## Tasks

### Shared contracts

- [x] **M9.1** Define source-independent input and output types for all seven operations.
- [x] **M9.2** Define result envelopes containing canonical IDs, source links, pagination, truncation, and warnings.
- [x] **M9.3** Define shared error types for validation, not found, unsupported scope, temporary failure, and result limits.
- [x] **M9.4** Define maximum defaults and hard limits for results, snippets, timelines, sections, and comparisons.
- [x] **M9.5** Keep MCP SDK types out of all query-service modules.

### `searchBills`

- [x] **M9.6** Accept query text and all locked structured filters.
- [x] **M9.7** Select structured, lexical, semantic, or hybrid retrieval intentionally from the request.
- [x] **M9.8** Return identifiers, titles, jurisdiction, session, status, summary, dates, snippets, scores, and source links.
- [x] **M9.9** Implement stable cursor or offset behavior and deterministic ordering.
- [x] **M9.10** Signal partial or truncated results explicitly.

### Bill detail and timeline

- [x] **M9.11** Implement `getBill` by canonical ID and supported normalized identifier input.
- [x] **M9.12** Aggregate metadata, subjects, sponsors, actions, votes, documents, versions, and relations.
- [x] **M9.13** Keep large child collections bounded and expose follow-up pagination where required.
- [x] **M9.14** Implement `getBillTimeline` with deterministic chronological ordering.
- [x] **M9.15** Resolve same-day or missing-time actions without presenting false precision.
- [x] **M9.16** Include source evidence for detail and timeline records.

### Bill text

- [x] **M9.17** Implement `searchBillText` across a bill, selected version, or the filtered corpus.
- [x] **M9.18** Return passage text with section, version, document classification, bill context, and source link.
- [x] **M9.19** Implement `getBillText` with version selection and section-based pagination.
- [x] **M9.20** Prevent unbounded full-document responses while allowing complete retrieval through pages.
- [x] **M9.21** Distinguish missing text, unprocessed text, and failed extraction.

### Comparison and relations

- [x] **M9.22** Implement deterministic version ordering and explicit version selection.
- [x] **M9.23** Implement section-aware comparison before falling back to plain text comparison.
- [x] **M9.24** Return inserted, removed, and changed sections with bounded context.
- [x] **M9.25** Reject incompatible documents with an actionable validation error.
- [x] **M9.26** Implement explicit related-bill lookup from canonical relationships.
- [x] **M9.27** Add optional semantically related bills with method and similarity clearly labeled.
- [x] **M9.28** Avoid returning the source bill or duplicate related bills.

### Verification

- [x] **M9.29** Add unit tests for validation, limits, ordering, pagination, and error mapping.
- [x] **M9.30** Add PostgreSQL integration tests for all seven operations.
- [x] **M9.31** Test sparse bills, missing text, multiple versions, large timelines, and large result sets.
- [x] **M9.32** Record representative response examples in the tool-contract documentation.
- [x] **M9.33** Benchmark representative operations and record latency baselines before MCP is added.

## Exit criteria

- All seven operations work directly against PostgreSQL and are independently testable.
- Responses are bounded, predictable, source-linked, and transport-independent.
- Sparse and oversized records fail or paginate explicitly rather than producing misleading results.
