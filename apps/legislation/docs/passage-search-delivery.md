# Passage search and API closeout

The user approved a separate ParadeDB passage-search service and BM25 ordering on September 12, 2026. This does not approve replacing the canonical PostgreSQL image or rebuilding vector indexes. The earlier whole-database migration hold still applies.

## Delivery gates

1. **Passage search — in progress.** Provision a persistent isolated search database; capture canonical changes; run a resumable full backfill; verify filtered ranking, edits, deletion, OCR replacement, pagination and full-corpus latency; then deploy the API integration. Keep the current release until that gate passes.
2. **Nine API data gates — pending.** Establish real organization/bill/meeting/calendar relationships, meeting agenda/outcome and calendar fixtures, and representative geography/provider coverage. Empty successful responses are not proof that these gates pass. Use only the approved source integrations.
3. **MCP through the API — pending.** Publish the authenticated MCP transport using API-backed tools; verify canonical identifiers, filters, pagination, all search modes and errors in the deployed environment.
4. **Reliability and cleanup — pending.** Exercise searches alongside ingestion and synchronization, worker retries and interruption, then remove redundant runtime paths only after the deployed MCP cutover passes.

No gate is closed by local tests alone. Record commit, deployment, nonempty acceptance evidence and remaining caveats in the release ledger.

## Search synchronization contract

- Canonical PostgreSQL remains authoritative. The search database holds only reconstructible section text and indexed filters; no embeddings are copied.
- A transactional queue captures document, section, bill and sponsor changes, coalesced per entity/source transaction. There is deliberately no sequence-number high-water mark: transactions can commit out of order. Acknowledge only the exact observed event IDs after the search transaction commits.
- Document batches acquire one target transaction advisory lock **before** opening a canonical repeatable-read snapshot. A single publisher serializes retries, backfill and live refreshes, including sections moving between documents. Batched copies of up to 100 documents amortize network costs. Do not introduce per-document parallel publication without a move-safe ordering protocol.
- Replace a document's complete search representation atomically. Missing or unprocessed documents remove old search rows. A timeout rolls back the replacement, never publishes a partial document and leaves its event unacknowledged.
- Source queries use short statement deadlines. Each worker has an aggregate time budget and checkpoints after committed batches. Failed batches split deterministically. Individually failing documents stay pending with a retry time, attempt count and error category; they do not block healthy documents or count as complete. Alert on deferred work before declaring readiness.
- Bill events expand into document events in bounded, checkpointed pages. New documents independently enqueue their own events. A restart can repeat work but must not lose it.
- Initial keyset enumeration enqueues documents while capture is active. Reconcile counts and missing/stale/deleted rows after enumeration and catch-up. Readiness requires backfill completion, measured queue age and integrity evidence, not just an empty queue at one instant.
- API results hydrate canonical IDs and metadata. BM25 scores and bytewise section-ID ties define lexical order. Search cursors must bind to query, filters and ranking generation. Concurrent changes must be handled explicitly, not presented as a stable snapshot.
- Tune the ranked index with the previously verified `mutable_segment_rows=0` setting; retest update cost and search latency on the full corpus. Small canary timings are not production projections.

## Current evidence

The last verified application release remains `ddc68697-d50f-42f2-b760-b2ded5832c64`, with native amendment search accepted. The separate passage service is not yet serving API traffic. No full-corpus passage ETA is claimed until actual load throughput and index build time are measured.

- Search service `000bdbad-62cd-43ef-9890-825675dc15cb`, volume `bf04d46e-4ed6-41af-8b78-9bf949464a5c`, initial deployment `3bf7c2ca-5716-4a69-9e1d-48fd6999f0ad` reached `SUCCESS`. Read-only inspection confirmed PostgreSQL 18.6 and preinstalled `pg_search` 0.25.9. No extension was installed into the canonical database.
- Real-data copy canary: 8 documents, 13 sections, idempotent replay passed; ranked query returned 13 hits in 167 ms. This tiny sample does not establish full-corpus latency.
- Isolated database integration: 7 passing cases covering initial copy/replay, OCR text changes, metadata/sponsors, transaction coalescing, section moves, late commits, backfill checkpointing and deletion/status transitions.
- Focused local checks cover failed-batch isolation, aggregate deadlines and connection failures. Full legislation coverage run passed 2,602 tests plus 4 receiver tests before the final worker-cycle additions. Repository verification remains blocked by unrelated scoring coverage thresholds.
- Migration `0047_passage_search_changes` and Trigger workers are implemented, but production capture, schedule activation, full backfill and API cutover are separate pending operations. The scheduled worker is registered without an automatic cron; deployment alone does not activate it.
