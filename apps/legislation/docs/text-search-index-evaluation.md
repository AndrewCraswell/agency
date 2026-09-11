# Isolated ranked text-index evaluation

September 11, 2026. Status: ranked-query implementation and isolated correctness canary completed;
production schema, ingestion integration, API cutover and extension rollout **not implemented**.
The two broad lexical timeout gates remain open. This does not change API acceptance counts.

## Selected direction and current implementation

Prefer an in-place ParadeDB index on `document_sections`, not a separate search service or a duplicate
full-text projection. Native PostgreSQL still has to score/sort broad match sets: the additional exact
per-document lateral amendment query hit PostgreSQL's existing 15-second deadline on September 11.
An amendment-only GIN index would not solve global passage ranking. A separate engine introduces
another corpus, synchronization, deletion handling and operational ownership.

The implementation in `src/search/ranked-section-search.ts` is deliberately **not connected to the API**:

- Index the existing heading/text expression; retain canonical section/document IDs.
- Add derived document title and filter metadata to the same section row at rollout. These columns
  currently exist only in the disposable canary, not the canonical or production schema.
- Compile default AND, quoted phrases, OR and minus exclusions through `ranked-text-query.ts`.
  Caller text cannot inject Tantivy operators, field selectors or SQL. Invalid grammar fails closed.
- Use literal, case-sensitive indexed metadata and epoch-millisecond date ranges. All filter
  predicates use `pdb.const(0)` so adding a filter cannot change a surviving result's relevance score.
- Order by score descending and bytewise canonical IDs. For amendments, document ID precedes section
  ID. Scan additional ranked batches until enough distinct documents are found; never truncate at an
  arbitrary candidate limit. The first section for a document is its highest-scoring section.
- Callers must hold a repeatable-read snapshot across batches and enforce a cumulative deadline.
  The canary does both. The collector propagates errors instead of returning a falsely complete prefix.

This is BM25 relevance, not numerical `ts_rank_cd` parity. Stemming/tokenization, stopword behavior,
the explicit grammar and changed tie ordering require relevance acceptance before API cutover.
Conjunction/phrase matching remains within one section or the title, never across unrelated sections.

## Full-query correctness canary

`pnpm eval:ranked-search` runs against a fresh, explicitly named `legislation_search_benchmark` database
on a different host/port from `DATABASE_URL`. No extension is installed by the script. It creates its
own temporary `legislation` schema and refuses to reuse an existing one. Fixtures roll back on exit.
`--sample` additionally copies at most 10,000 public sections in read-only, 500-row source batches,
adds nine synthetic copies with distinct canonical keys, commits the sample, measures in a fresh
read-only repeatable-read transaction, and removes its own schema in cleanup.

The second disposable Railway service was `legislation-search-canary`
(`fc96e46e-7c9a-41cc-850f-3e418e3525be`), with successful deployment
`0294b48e-4884-4c9e-8b6b-856daaaf4142`, image `paradedb/paradedb:0.25.9`.
No production database writes, extension changes, restart or API deployment occurred.
The canary service and its ephemeral data were deleted after verification; the local Railway link
was restored to `legislation-web`. The sample is reproducible, but the deleted service is not recoverable.

Live fixtures pass five grammar cases, thirteen filter cases, database-paged exact amendment grouping,
and section text update, deletion, processing-status update and rollback checks. All seven positive
filter combinations produce `TopKScanExecState` without `heap_filter`; surviving scores are unchanged.
The checks caught and corrected three problems that a SQL-string-only test would miss:

1. `AND NOT field:term` did not implement exclusions correctly; `AND -field:term` does.
2. Ordinary JSON containment and numeric extraction filters used heap filtering, not index filtering.
3. Direct SQL text equality filters contributed to BM25 scores; constant-zero indexed filters do not.

Corrected, committed 100,000-row sample measurements (one observation, not latency percentiles):

| Query | Passage server ms | Amendment section-page server ms | Exact 21-document collection incl. network ms | Batches |
| --- | ---: | ---: | ---: | ---: |
| legislation | 121.427 | 125.569 | 590.826 | 1 |
| tax | 131.373 | 130.139 | 1613.970 | 2 |
| education | 123.354 | 123.138 | 457.522 | 1 |
| health | 122.744 | 133.980 | 448.574 | 1 |

These are the fuller query shape, not the simplified benchmark below. They are **not evidence that
15-million-section production queries meet the deadline**, nor a direct speedup comparison against
the earlier simplified GIN test. The sample is canonical-ID ordered and synthetically repeated, not
representative. Representative filters, cold/warm repetitions, concurrency, judged relevance and
full-corpus cost/storage remain rollout gates.

## Production rollout gates

Read-only inspection confirms production PostgreSQL **18.6**, Debian 12 x86-64, pgvector **0.8.6**,
empty `shared_preload_libraries`, and no available `pg_search` extension. Do not replace it blindly
with the canary image or downgrade pgvector. A compatible production image and controlled restart
are required; the temporary-service approval alone did not authorize that infrastructure cutover.

- [x] Implement and test safe query compilation, indexed filters and exact grouping.
- [x] Prove fixture correctness, score-neutral filters, index-plan shape and bounded sample execution.
- [ ] Prepare a pinned PostgreSQL 18 / pgvector 0.8.6 image with matching pg_search binaries; verify
      startup and existing extension compatibility in isolation. The official release supplies a
      [Debian 12 PostgreSQL 18 package](https://github.com/paradedb/paradedb/releases/tag/v0.25.9),
      `postgresql-18-pg-search_0.25.9-1PARADEDB-bookworm_amd64.deb`, published SHA-256
      `8f70e992f03493dafe9f93d84781779625a23450c5eb85b6791501032d190bcb`. It has not been installed.
- [ ] Agree on the production restart window and verify backup/restore. Extension activation is a
      user-run step under the Railway operating policy, not an automated `CREATE EXTENSION`.
      Only after the compatible image is available, preserve any existing preload entries, set
      `shared_preload_libraries` to include `pg_search`, restart, then run `CREATE EXTENSION pg_search;`.
      Do not run that command against the current image: the extension is unavailable.
- [ ] Add canonical derived title/metadata columns and transactionally maintained section, document,
      bill and sponsor update paths. Test concurrent parent/section changes; do not introduce an
      eventually consistent outbox merely for same-database metadata.
- [ ] Backfill in resumable bounded batches, check metadata integrity, then build the index with
      adequate storage and no overlapping maintenance. Measure actual index footprint and write cost.
- [ ] Integrate passage/amendment API candidate retrieval, hydration, match/snippet metadata, cursor
      binding and the cumulative request deadline. Judge relevance against real queries.
- [ ] Deploy and run authenticated full-corpus broad/scoped lexical and regression smoke tests.
      Keep the previous application/native query deployment available for rollback. After creating
      extension-backed indexes, an application rollback is not permission to remove their binaries.

The implementation's 82 focused tests, service type-check, standalone canary type-check and scoped
lint/format pass. `pnpm verify` passed its check stage but failed in the unrelated scoring scenario
`rejects invalid foil classification provenance, ranges, bounds, and state pairings` (5-second test
timeout). Repository verification is not green; neither production timeout gate is closed.

## Scope and reproducibility

User-approved temporary Railway service `legislation-search-benchmark`, service ID
`6a946159-d829-49c0-a3fd-bf254bdaaa9b`, used the pinned official `paradedb/paradedb:0.25.9` image.
Deployment `cf211942-373d-422b-81a5-86c70841b9dd` reached SUCCESS. No production extensions,
configuration, indexes, or application behavior were changed.

Cleanup completed: the temporary service and its ephemeral copied data were deleted. A fresh service
listing confirms only the original application, pooler and database remain; the local service link was
restored to `legislation-web`. Reproducing the benchmark requires provisioning a new temporary service.

The harness is `scripts/benchmark-text-index.mjs`, available through `pnpm eval:text-index` from this app.
Supply `TEXT_INDEX_BENCHMARK_URL` securely; `.env` supplies the source `DATABASE_URL`. The target must
be named `legislation_search_benchmark` on a different host/port. The script also checks the connected
database name. These checks reduce mistakes; they are not a substitute for verifying service identity.

The initial run copies at most 10,000 public sections in 500-row batches inside a read-only source
transaction. Run it against a fresh disposable database with pg_search already installed by the image.
`--scale-synthetic` adds nine bounded, idempotent copies of that sample with distinct section/document IDs,
yielding 100,000 rows without further source reads. `--rebuild-ranked` rebuilds only the benchmark's
ranked index, and `--measure-only` reruns measurements without modifying rows or indexes.
All database statements have a 60-second target or 15-second source timeout.

Each query is executed once, followed by EXPLAIN ANALYZE with buffers. Reported server times below come
from that second execution: warm, single observations, **not percentiles**. Network round trips were
around 160 ms or higher and are recorded separately. Generated rows and complete plans are written to
ignored `tmp/text-index-benchmark.json`; no credentials are included in the report.

## Findings

The 10,000-row trial returned results for all 16 term/query combinations. Its small size was insufficient
to demonstrate scaling. At 100,000 rows, merely using a ranked index was also insufficient:

1. Tokenized canonical IDs prevented efficient columnar retrieval. Indexing IDs as `pdb.literal` removed
   the broad passage query's heap fetches, but still returned every matching row to PostgreSQL for sorting.
2. The default text collation on the section-ID tie-breaker prevented ranked top-K execution.
   `ORDER BY pdb.score(id) DESC, section_id COLLATE "C"` produced `TopKScanExecState`, a pushed-down
   limit of 20, and 20 heap fetches. The default-collation alternative returned 25,560 matches for
   `legislation` to an outer sort. This is a benchmark finding, not permission to silently change API ordering.
3. Numeric ID tie-breaking also enabled top-K, but uses a synthetic key instead of canonical IDs and
   is included only as a diagnostic control.

Final 100,000-row server timings, milliseconds:

| Term | Passage GIN | Ranked, default ID sort | Ranked, bytewise ID sort | Amendment GIN | Ranked amendment |
| --- | ---: | ---: | ---: | ---: | ---: |
| legislation | 106.940 | 42.810 | 6.018 | 18.750 | 3.296 |
| tax | 102.734 | 33.853 | 6.159 | 16.997 | 3.546 |
| education | 90.360 | 37.891 | 6.880 | 13.986 | 9.723 |
| health | 94.083 | 37.987 | 5.807 | 20.241 | 3.875 |

All 24 final combinations returned 20 rows without an error. Matching row counts do not establish
equivalent results. Amendment grouping still uses PostgreSQL aggregation over matching section scores;
this trial does not establish an efficient full-corpus grouped top-K path.

## Limitations and next gates

- This is the first 10,000 sections by canonical ID, not a representative corpus. Synthetic copies have
  repeated vocabulary and abnormal ties. Do not extrapolate these times to 15 million production sections.
- The prototype does not reproduce processing-status filters, title-only amendment matching, title-plus-
  section scoring, best-passage metadata, production joins, or every API filter.
- BM25 and PostgreSQL `ts_rank_cd` are different ranking functions. Tokenization, stopwords, phrase,
  Boolean, negation and tie-breaking behavior require explicit acceptance tests and relevance evaluation.
- Next, build a representative full-contract canary with canonical mappings, filters, stable paging,
  phrase/Boolean fixtures, and judged relevance. Measure repeated cold/warm queries and concurrent load.
- Prove amendment grouping has no arbitrary candidate truncation that loses eligible documents.
- Before production adoption, choose and approve either a separate synchronized search service or a
  database image/extension migration, with initial backfill, incremental updates, deletion handling,
  rollback, operational ownership and cost evidence. A temporary benchmark is not that authorization.
- Only close the timeout gates after deployed, authenticated API smoke passes within the existing budget.

Implementation reference: [ParadeDB scoring and deterministic sorting](https://www.paradedb.com/docs/documentation/sorting/score).
The official API documents indexed tie-breakers; the collation/plan evidence above was measured locally
against the temporary Railway database.

## Verification

All 62 focused search/query/benchmark tests pass, including four pre-connection safety tests. Scoped
formatting and lint pass. Repository `pnpm verify` reached
coverage but failed in the unrelated `scoring#test:coverage` task; the repository-wide loop is not green.
