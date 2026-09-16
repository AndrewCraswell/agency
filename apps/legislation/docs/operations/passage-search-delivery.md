# Passage search and API closeout

## September 14 scope and acceptance

The public surface now contains 81 operations. Calendar, meeting-outcome and representative-lookup endpoints were removed, including calendar MCP discovery and client methods. The advertised MCP surface contains 25 tools.

Commit `07d7f94` is pushed and deployed as Railway `7eaa1e92-7947-4c2f-bb75-5f345b48e7e9` (`SUCCESS`). Ingestion version `20260914.1` is deployed with the Open States source-include fix. Authenticated production checks passed:

| Operation | Real fixture | Result |
| --- | --- | --- |
| Organization bills | `organization:congress:hsvr00` | 200, nonempty, 284 ms |
| Organization meetings | `organization:congress:hsif03` | 200, nonempty, 153 ms |
| Meeting detail | `event:congress:committee-meeting-119189` | 200, 119 ms |
| Agenda-item detail | California Rules event `ocd-event/6694d8b5-f5f4-41a0-ab81-d5f63ec9ec33` | 200, 65 ms, Assembly source link |

All seven removed operations returned 404. The agenda contract uses the source description as a display title when necessary, and null relationship arrays mean unknown, not confirmed absent. Source replay used the ordinary normalizers and persistence paths; no invented links or fabricated source records were added. These checks establish endpoint acceptance, not exhaustive historical coverage, state scraper deployment, or merged cross-provider organization identities.

At 13:18 UTC, passage readiness still reported `backfill_incomplete` and `pending_changes` (120 queued, zero failed attempts). The target index was valid and ready. Passage cutover remains disabled until the existing copy and final acceptance complete; no vector indexes were rebuilt.

The user approved a separate ParadeDB passage-search service and BM25 ordering on September 12, 2026. This does not approve replacing the canonical PostgreSQL image or rebuilding vector indexes. The earlier whole-database migration hold still applies.

## Remaining delivery gates

1. **Passage search:** finish the retained backfill and change catch-up; verify corpus parity, corrections/deletions,
   filtered ranking, pagination, full-corpus latency and authenticated API/MCP behavior before enabling cutover.
2. **Reliability acceptance:** exercise search alongside ingestion, retries and interruption; retain evidence tied to
   the actual deployment. API-backed MCP is already implemented and exercised; do not recreate its migration as new work.

The previous nine civic-data gates are superseded by the four accepted retained operations and seven removed operations
recorded above. Acceptance of those fixtures does not certify exhaustive historical data. No gate closes from local
checks alone, and this documentation audit did not refresh the production passage-copy status.

## Search synchronization contract

- Canonical PostgreSQL remains authoritative. The search database holds only reconstructible section text and indexed filters; no embeddings are copied.
- A transactional queue captures document, section, bill and sponsor changes, coalesced per entity/source transaction. There is deliberately no sequence-number high-water mark: transactions can commit out of order. Acknowledge only the exact observed event IDs after the search transaction commits.
- Document batches acquire one target transaction advisory lock **before** opening a canonical repeatable-read snapshot. A single publisher serializes retries, backfill and live refreshes, including sections moving between documents. Batched copies of up to 100 documents amortize network costs. Do not introduce per-document parallel publication without a move-safe ordering protocol.
- Within that locked batch, two source readers import the same exported snapshot and own disjoint document subsets. Pages are explicitly serialized into the single target transaction. All readers settle before commit or rollback; one failure rolls back the entire batch. This does not create independent publishers or duplicate queue consumers. `PASSAGE_SEARCH_READ_CONCURRENCY` defaults to 2, supports 1–4, and can be set to 1 to disable read fanout. One-document retries use only the original reader.
- Replace a document's complete search representation atomically. Missing or unprocessed documents remove old search rows. A timeout rolls back the replacement, never publishes a partial document and leaves its event unacknowledged.
- Source queries use short statement deadlines. Each worker has an aggregate time budget and checkpoints after committed batches. Failed batches split deterministically. Individually failing documents stay pending with a retry time, attempt count and error category; they do not block healthy documents or count as complete. Alert on deferred work before declaring readiness.
- Bill events expand into document events in bounded, checkpointed pages. New documents independently enqueue their own events. A restart can repeat work but must not lose it.
- Initial keyset enumeration enqueues documents while capture is active. Reconcile counts and missing/stale/deleted rows after enumeration and catch-up. Readiness requires backfill completion, measured queue age and integrity evidence, not just an empty queue at one instant.
- API results hydrate canonical IDs and metadata. BM25 scores and bytewise section-ID ties define lexical order. Search cursors must bind to query, filters and ranking generation. Concurrent changes must be handled explicitly, not presented as a stable snapshot.
- Tune the ranked index with the previously verified `mutable_segment_rows=0` setting; retest update cost and search latency on the full corpus. Small canary timings are not production projections.

## Current evidence

Use `pnpm --filter legislation tool search/inspect-passage-search-readiness` with the isolated `PASSAGE_SEARCH_DATABASE_URL` to inspect synchronization prerequisites without modifying either database. It reports backfill completion, all pending changes (including delayed retries), oldest pending timestamp and ranked-index validity/readiness. Exit 2 means prerequisites are not met; query failures also fail rather than reporting success. The observations are separate snapshots, not a cross-database consistency guarantee. Even a caught-up report never approves cutover: corpus parity, full-corpus searches, authenticated API/MCP and ingestion-overlap acceptance remain required. This intentionally avoids repeatedly counting the entire section corpus during copying. `eval:passage-copy` remains a small mutating replay canary, not a readiness audit.

## MCP and data acceptance boundaries

The September 12 authenticated fixture replay accepted the bill-search, provenance, timeline, related-bill, vote and
supporting-material fixes. Broad lexical passage search remains open. Those repaired fixtures do not establish full-corpus
repair. HTTP 200 with an MCP tool or batch-item error is a failed request.

The API-backed MCP adapter is implemented. API-audience tokens must be rejected at the MCP resource. A successful
incoming MCP-resource consent canary remains a separate gate in [authentication](authentication.md); outbound MCP-to-API
credentials do not prove it. Removed calendar, meeting-outcome and representative-lookup operations are not pending gates.

Keep unknown activity/provenance explicit; do not fabricate booleans, dates or relationships to bypass projection failures.
Repeat authenticated bill/detail and relationship checks on current source-backed fixtures before claiming broader coverage.
