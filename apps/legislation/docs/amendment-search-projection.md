# Native amendment search projection

The broad amendment search fix uses PostgreSQL's existing full-text engine. It does not change the database image,
install extensions, regenerate embeddings, or rebuild HNSW indexes.

## Design

`amendment_section_search` contains section/document keys, an exact copy of the canonical weighted section vector,
and a precomputed document-title vector. Two GIN indexes cover matching. It contains amendment sections regardless
of processing status; processing status, bill, jurisdiction, session, and date filters remain canonical parent predicates.
This avoids rewriting every section when unrelated parent metadata changes.

Matching sections and title-only sections remain disjoint. NULL section vectors retain their existing SQL eligibility.
All parent filters run before exact best-section selection and document ranking. There is no arbitrary candidate cap.
Only the final page is hydrated and given snippets. Search hydration selects seven document-summary fields and the bill's
jurisdiction, never whole document text or bill embeddings. The same narrow summary selection serves semantic/hybrid
amendment candidates. Unscoped lexical searches rely on the validated non-null bill foreign key for existence and avoid
per-section bill joins; jurisdiction/session filters use a canonical bill EXISTS predicate before ranking.
Scores, section/document tie order, API shape and pagination remain unchanged.

Synchronous database triggers copy the actual stored section vector after the existing heading/text vector trigger.
Section insertion, replacement, moves, title changes, classification changes and cascading deletion update the projection
in the same transaction. Section maintenance takes parent share locks; parent metadata writers already hold write locks.
Concurrent deadlocks abort and require normal transaction retry; no maintenance operation is silently skipped.

## Rollout gates

1. Apply migration `0046_amendment_section_search` with a bounded lock deadline. It creates an empty narrow table and
   its indexes/triggers; it performs no bulk backfill and changes no existing vector index.
2. Run `node --env-file=.env --import tsx scripts/backfill-amendment-search.ts --apply` from the app directory.
   It enumerates amendment document keys, locks at most 250 parents per transaction, then upserts and verifies using fresh
   READ COMMITTED statements. Statements have 15-second deadlines, locks one second, and transient failures three attempts.
   Reruns are idempotent. Existing canonical text and embeddings are never updated. A failure is not completion.
3. Verify every batch has zero vector/title/membership mismatches, all projection indexes are valid, and ANALYZE finishes.
4. Measure the production query before deploying the application. Require nonempty broad, phrase, filtered and
   paginated results within the API deadline; verify exact output parity on the isolated fixture suite.
5. Deploy the application only after population/verification, then smoke authenticated API and MCP retrieval.
   The previous application deployment remains the rollback; keeping an unused projection is safe.

## Reproducible checks

- `scripts/verify-amendment-search-projection.ts`: refuses the source host and requires an isolated database named
  `legislation_search_benchmark`; creates and removes its own schema. Tests migration behavior, exact query parity and
  concurrent parent/section maintenance. Its reduced canonical tables are query fixtures, not full schema validation.
- `pnpm eval:ranked-search --balanced-amendments`: hashes amendment document keys and selects up to 1,000 per available
  jurisdiction, copies all their available sections, verifies source vector weights, and compares native/ranked search.
  No synthetic duplicates. Per-batch and total section/byte budgets fail closed instead of truncating documents.
  It reports missing/unprocessed coverage separately; a balanced key sample is not a corpus-wide latency claim.
- `scripts/diagnose-amendment-query.ts`: sequential, read-only 15-second plan probes. Single ordered observations are
  diagnostic evidence, not unbiased performance estimates.

## Validation and rollout evidence

September 12 isolated validation passed migration/trigger behavior, the actual backfill CLI across multiple batches,
an idempotent rerun, 21 exact query comparisons, 15 filter/candidate-ID checks, and a concurrent parent/section writer.
The reference intentionally awards section rank only when the section matches: negative terms can otherwise give
`ts_rank_cd` a nonzero value for an ineligible section, unlike the application's disjoint title-only branch.
All 2,583 legislation coverage tests and four webhook receiver tests passed; Next.js 16.3.1 production build passed.
Repository `pnpm verify` passed its checks but remains blocked by unrelated scoring coverage thresholds.

Production migration 0046 applied successfully in 2.70 seconds after confirming it was the sole pending migration.
The backfill completed in 1,109.49 seconds (18.49 minutes), visiting all 113,937 amendment documents in 456 batches,
each with zero mismatches and no retries. The projection contains 340,696 sections from 108,481 documents, no null
vectors, and occupies 1,175 MB including indexes. All four indexes are valid/ready; ANALYZE completed at
`2026-09-12T14:38:47.699Z`. Evidence: `tmp/amendment-search-backfill-2026-09-12T14-38-49.193Z.json`.

Seven production read-only comparisons proved exact canonical-record, score, match-flag, snippet, and ordering parity
between the first projection query and its optimized hydration/filtering form, including 20/100-result requests and
jurisdiction, bill and session filters. Ordered diagnostic observations (not randomized benchmarks):

| Query | Full-record projection query ms | Narrow-summary query ms | Internal JSON before / after bytes |
| --- | ---: | ---: | ---: |
| health, 20 | 4,342 | 1,030 | 6,734,947 / 14,871 |
| tax, 20 | 6,305 | 1,061 | 12,084,740 / 14,663 |
| health insurance phrase, 20 | 2,499 | 396 | 4,924,397 / 14,763 |
| health, Oregon, 20 | 1,390 | 1,779 | 923,715 / 13,878 |
| health, 100 | 18,957 | 1,529 | 41,821,892 / 75,201 |

These byte counts describe serialized internal database results, not the public API response. The original full-section
query timed out before this migration; production plan evidence for the first projection is
`tmp/amendment-query-diagnostic-2026-09-12T14-40-09.024Z.json`.
The optimized application is awaiting deployed smoke; this is not yet a completed API cutover.
