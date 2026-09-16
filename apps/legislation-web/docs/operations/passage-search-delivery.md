# Passage search and API closeout

This is retained dated evidence, not a new live deployment check. W owns API/ranking acceptance; I owns copy operations,
M transport acceptance, and C shared schema. Separate-runtime deployment and positive consent are not established here.

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

I owns the [synchronization and readiness procedure](../../../legislation-ingestion/docs/operations/search-maintenance.md).
C owns [projection schemas](../../../../packages/legislation-core/docs/engineering/search-projections.md).
W hydrates canonical IDs/metadata, orders lexical results by BM25 and bytewise section-ID ties, and binds cursors to
query, filters and ranking generation. Concurrent changes are not presented as a stable snapshot.

## Current evidence

Use I's linked read-only readiness command. Even caught-up copy does not approve cutover: corpus parity, full-corpus
searches, authenticated API/MCP and ingestion-overlap acceptance remain required. No new readiness observation was made.

## MCP and data acceptance boundaries

The September 12 authenticated fixture replay accepted the bill-search, provenance, timeline, related-bill, vote and
supporting-material fixes. Broad lexical passage search remains open. Those repaired fixtures do not establish full-corpus
repair. HTTP 200 with an MCP tool or batch-item error is a failed request.

The API-backed MCP adapter is implemented. API-audience tokens must be rejected at the MCP resource. A successful
incoming MCP-resource consent canary remains a separate gate in [authentication](authentication.md); outbound MCP-to-API
credentials do not prove it. Removed calendar, meeting-outcome and representative-lookup operations are not pending gates.

Keep unknown activity/provenance explicit; do not fabricate booleans, dates or relationships to bypass projection failures.
Repeat authenticated bill/detail and relationship checks on current source-backed fixtures before claiming broader coverage.
