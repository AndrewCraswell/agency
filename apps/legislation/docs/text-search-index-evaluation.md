# Isolated ranked text-index evaluation

September 11, 2026. Status: benchmark completed, production adoption **not approved or implemented**.
The two broad lexical timeout gates remain open. This does not change API acceptance counts.

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
