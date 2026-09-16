# Search projection maintenance

I owns copy, outbox, backfill and synchronization readiness. C owns
[projection schema/identity](../../../../packages/legislation-core/docs/engineering/search-projections.md);
W owns [ranking and cutover acceptance](../../../legislation-web/docs/operations/passage-search-delivery.md).
Commands below run from the repository root; use the I tool manifest for current names.

## Search synchronization contract

- Canonical PostgreSQL remains authoritative; target text/filter projections are reconstructible, with no embeddings copied.
- Transactional queues coalesce document, section, bill and sponsor changes per entity/source transaction. Acknowledge
  only exact observed event IDs after target commit; allocated sequence numbers are not commit-order watermarks.
- Acquire one target transaction advisory lock before opening the canonical repeatable-read snapshot. One publisher
  serializes retries, backfill and live refreshes, including sections moving between documents. Copy at most 100 documents
  per batch. Per-document parallel publication needs a separately approved move-safe ordering protocol.
- Two readers import the same exported snapshot for disjoint document subsets; serialize pages into one target transaction.
  All readers settle before commit/rollback; one failure rolls back the batch. `PASSAGE_SEARCH_READ_CONCURRENCY` defaults
  to 2, supports 1–4, and 1 disables fanout. Single-document retries use the original reader only.
- Replace each document atomically. Missing/unprocessed documents remove old rows; timeout rolls back replacement and
  leaves events unacknowledged. Never publish partial documents.
- Use short source statement deadlines and aggregate worker budgets. Checkpoint committed batches and split failed
  batches deterministically. Individual failures stay pending with retry time, attempts and category, without blocking
  healthy documents or counting as complete. Alert on deferred work.
- Bill events expand into document events in bounded checkpointed pages; new documents independently enqueue events.
  Restart may repeat work, never lose it.
- Keyset enumeration runs with change capture active. Reconcile counts and missing/stale/deleted rows after catch-up.
  Readiness needs completed backfill, queue age and integrity evidence, not an instantaneously empty queue.
- Keep source/target transactions separate. Retest `mutable_segment_rows=0` update cost and full-corpus latency with W;
  small canary timings are not production projections.

`pnpm --filter legislation-ingestion tool search/inspect-passage-search-readiness` inspects backfill, all pending changes
(including delayed retries), oldest pending timestamp and index validity/readiness using `PASSAGE_SEARCH_DATABASE_URL`.
It is read-only. Exit 2 means prerequisites are unmet; query failures fail. Observations are separate snapshots, not
cross-database consistency proof. A caught-up report does not approve cutover. The historical `eval:passage-copy` name
refers to a small mutating replay canary, not a readiness audit; use the current tool manifest to resolve its replacement.

## Amendment projection population

W releases C migration `0046_amendment_section_search` with a bounded lock deadline. It creates the empty narrow table,
indexes and triggers, with no bulk backfill or vector-index change. Then run:

```powershell
pnpm --filter legislation-ingestion tool search/backfill-amendment-search --apply
```

The worker enumerates amendment document keys, locks at most 250 parents per transaction, then upserts/verifies with
fresh READ COMMITTED statements. Statement deadline is 15 seconds, lock deadline one second, transient retries three.
Reruns are idempotent and never change canonical text/embeddings. Require zero vector/title/membership mismatches,
valid indexes and completed ANALYZE. Failure is not completion. W owns query parity and deployment acceptance in
[amendment search](../../../legislation-web/docs/engineering/amendment-search-projection.md).

Regulatory generation/copy mechanics and their dated evidence remain in [search indexing](../regulations/search-indexing.md)
and [storage validation](../regulations/storage-validation.md). No procedure here authorizes vector regeneration or cutover.