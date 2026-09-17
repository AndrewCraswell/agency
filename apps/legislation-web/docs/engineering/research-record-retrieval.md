# Research record retrieval

Known identities and topic discovery are separate operations. `resolve_record` accepts a canonical ID, published
name, source URL, or a domain-supported identifier plus canonical scope. It returns `resolved`, `ambiguous` or
`not-found`; the caller must not silently substitute a related record. For bills, use identifier `H.R. 1` with
`jurisdiction:us` and `session:us:116`, not `H.R. 1 116th Congress` as search text. Discover scope through
`list_jurisdictions` and `list_sessions`. Name resolution normalizes punctuation/order and uses provenance-backed
person aliases; unrecorded nicknames are not invented.

The authenticated `POST /api/records/resolve` endpoint and MCP adapter use the same request schema and resolver as
chat. Bill-number lexical searches also avoid document-content ranking. Topic queries retain explicit lexical,
semantic and hybrid modes; hybrid passage search retrieves independent lexical/vector candidates.

Use `read_record_collection` for independently paged bill actions/sponsors/documents, person terms, organization
children, meeting children, vote positions and amendment children. Section collections return exact bounded text
windows with parent/version/source metadata. Continue a section using its `sectionId` and `nextTextOffset`; continue
rows using `nextCursor`. `POST /api/records/collection` exposes the same authenticated reader to MCP. Dedicated
membership, sponsored-bill, committee-bill and document-section tools expose existing readers. Do not pass a bill
child cursor to `get_bill`; its detail is a preview and collection tools are the continuation path.

Research tool cursors bind tool name, selection and cursor field. Copy returned cursors unchanged. Arbitrary backend
offsets and cursors from another tool/filter selection are rejected. Transport-size paging includes cursor overhead
and never clips a record to fit the budget. Oversized text can be read through the bounded section-window operation.

Exact evidence has priority when the 40-item evidence selection budget is reached. A long passage remains available
as an explicitly marked excerpt; source text is never fabricated to fill missing content. Source-window offsets are
part of evidence identity. The source panel and inline quote disclose incomplete excerpts.

Wrapped SQL timeouts and transient connection failures retain actionable categories at the shared registry boundary.
Not-yet-processed content and oversized responses no longer map indiscriminately to internal errors. Connection
acquisition observes request cancellation; existing SQL deadlines still bound already executing statements. Batch
lookup runs sequentially on the shared transaction client instead of queuing all child queries concurrently.

Version comparison accepts a limit and a selection-bound continuation. Chat hydrates section text for the selected
page rather than every version section; MCP forwards pagination to the public comparison endpoint. Oversized sections
remain readable through the text-window operation. Historical memberships support date overlap and current-state
filters independently of a person's active status. Vote discovery supports both date bounds, including date-only votes.
Supporting-material search exposes organization and document-date scope; session scope requires a text query where
the public endpoint supports it. Unsupported combinations fail explicitly. Parent person/organization readers do not
advertise the public API's unsupported child limit; callers use the independent relationship readers instead.

Model-facing record cards use short turn-local handles such as `r1`. The server resolves them to canonical UUIDs before
emitting ready presentation blocks; it rejects handles from another turn. Persisted/browser references remain UUIDs.

Server-owned result snapshots are retained in `legislation.research_result_snapshots` for 24 hours. Tool and reference
search responses are persisted before delivery. Inspection, follow-up references and page requests can restore the
same session-owned snapshot on another process. Resumption uses server-retained tool inputs, not client facts. Later
pages are fresh reads and do not promise snapshot isolation. Expired snapshots are removed on subsequent writes.
The table and expiry index are in the canonical migration baseline and require an explicit release on existing
databases; startup does not create schema. The configured database received that limited table release locally.

Semantic bill search uses a bounded approximate nearest-neighbor window of at most 1,000 candidates with request-local
HNSW search breadth. It applies scope after that window and reports partial coverage; exact resolution does not use
this path. Empty scoped approximate results never establish absence. This bounds latency, not corpus-wide recall.

Local acceptance on 2026-09-17: the five reported identifiers resolved correctly; conversation `KH08ILi860hYNirZ`
retrieved and rendered all five canonical bills in one compact group at desktop and mobile widths. A separate process
restored a saved browser result and rejected another session. The formerly timing-out semantic title query returned
11 scoped results in approximately 11.6 seconds with explicit partial coverage. These are scoped acceptance receipts,
not a production rollout or a corpus-wide relevance benchmark.