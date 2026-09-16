# Native amendment search projection

The broad amendment search fix uses PostgreSQL's existing full-text engine. It does not change the database image,
install extensions, regenerate embeddings, or rebuild HNSW indexes.

## Design

The canonical [projection schema and trigger contract](../../../../packages/legislation-core/docs/engineering/search-projections.md#amendment-projection)
belongs to C. W owns matching and hydration below; I owns population and maintenance.

Matching sections and title-only sections remain disjoint. NULL section vectors retain their existing SQL eligibility.
All parent filters run before exact best-section selection and document ranking. There is no arbitrary candidate cap.
Only the final page is hydrated and given snippets. Search hydration selects seven document-summary fields and the bill's
jurisdiction, never whole document text or bill embeddings. The same narrow summary selection serves semantic/hybrid
amendment candidates. Unscoped lexical searches rely on the validated non-null bill foreign key for existence and avoid
per-section bill joins; jurisdiction/session filters use a canonical bill EXISTS predicate before ranking.
Scores, section/document tie order, API shape and pagination remain unchanged.

## Rollout gates

1. Release C's migration explicitly through W, not startup.
2. Complete [I's bounded population and verification procedure](../../../legislation-ingestion/docs/operations/search-maintenance.md#amendment-projection-population).
3. Require its zero-mismatch, valid-index and ANALYZE evidence.
4. Measure the production query before deploying the application. Require nonempty broad, phrase, filtered and
   paginated results within the API deadline; verify exact output parity on the isolated fixture suite.
5. Deploy the application only after population/verification, then smoke authenticated amendment API retrieval.
   API-backed MCP uses the same service; include authenticated MCP verification in release acceptance.
   The previous application deployment remains the rollback; keeping an unused projection is safe.

## Reproducible checks

- `tools/search/verify-amendment-search-projection.ts`: refuses the source host and requires an isolated database named
  `legislation_search_benchmark`; creates and removes its own schema. Tests migration behavior, exact query parity and
  concurrent parent/section maintenance. Its reduced canonical tables are query fixtures, not full schema validation.
- The temporary balanced-sample and query-plan harnesses were removed after the rollout evidence below was accepted.
   The retained projection verifier covers migration behavior and exact query parity.

## Validation and rollout evidence

September 12 isolated validation passed migration/trigger behavior, the actual backfill CLI across multiple batches,
an idempotent rerun, 21 exact query comparisons, 15 filter/candidate-ID checks, and a concurrent parent/section writer.
The reference intentionally awards section rank only when the section matches: negative terms can otherwise give
`ts_rank_cd` a nonzero value for an ineligible section, unlike the application's disjoint title-only branch.
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
The broad amendment gate has recorded acceptance; passage search remains open. Current release scope and gates
belong to [API acceptance](../operations/passage-search-delivery.md). These ordered comparisons support narrow hydration;
they are not load-test percentiles. Recreate samples using the tools above when changing the query.
