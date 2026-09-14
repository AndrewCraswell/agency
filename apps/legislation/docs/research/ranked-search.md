# Ranked search performance decision

Research decision: the canonical-database migration is on hold. The subsequently approved isolated passage service is a separate decision; see [passage delivery](../operations/passage-search-delivery.md). Historical experiment instructions below are not production rollout authorization.


September 12, 2026. Decision: **hold production migration**.
The original default configuration regresses after metadata updates. The follow-up below establishes
that ordinary vacuum repairs the slowdown and disabling mutable buffers preserves most broad-query
benefits across repeated writes. However, the amendment-heavy follow-up is slower than native search,
including with buffering disabled. This is not an overall API improvement or resolution of the broad amendment timeout.
Existing vector indexes, embeddings and OCR remain untouched.

## Balanced amendment follow-up

The September 12 follow-up sampled complete available sections from up to 1,000 SHA-256-selected amendment
documents per jurisdiction: **45,246 real sections, 18,104 documents, no synthetic copies**. Every copied section's
stored vector matched the production A-heading/B-body weighting. This supersedes the Colorado-heavy sample for
the amendment comparison, but is still a warm candidate-stage test, not production API performance.

After repeated updates and four concurrent readers with a simultaneous writer, the tuned ranked index produced
these final median database execution times (five alternating observations per engine):

| Amendment query | Native ms | Tuned ranked ms |
| --- | ---: | ---: |
| legislation | 38.358 | 43.500 |
| health | 48.075 | 44.418 |
| tax | 29.369 | 44.915 |
| "health insurance" | 12.226 | 17.818 |
| health, Oregon | 16.117 | 18.563 |

All 300 paired measurements completed without errors; 17 exact update-eligibility checks passed. Ranked scoring
is BM25, not native score/result identity. The final amendment results do not justify migrating the production
database engine. Broad passage top-K remains promising but is a separate, unclosed API/relevance decision.

Evidence: `tmp/ranked-search-comparison-2026-09-12T14-17-32.741Z.json`. Native GIN indexes occupied 30,679,040 bytes,
ranked 63,766,528 bytes. Single builds took 1.272 and 0.791 seconds respectively on this isolated host; these
are not full-corpus migration estimates. Benchmark shared buffers differ from production.

Production read-only probes of the existing full-section query and an amendment-first alternative both exceeded
15 seconds for broad terms. One original phrase probe also hit a PostgreSQL shared-memory allocation error;
that is not evidence of a full persistent volume. Evidence: `tmp/amendment-query-diagnostic-2026-09-12T13-46-53.607Z.json`.
The next implementation uses a [narrow native amendment projection](../engineering/amendment-search-projection.md), retaining
exact existing ranking and canonical filters without rewriting the whole section table or any HNSW index.

## Update-regression diagnostic

The isolated `legislation-search-update-diagnostic` service (`57616f58-ef58-463d-a375-e8137f34e7dc`)
ran ParadeDB 0.25.9, deployment `f43305cb-e71e-4ab8-b944-ebe9a9d15de5` (SUCCESS).
The first run repeated the 100,000-row mixed workload using a fresh read-only source sample.
Evidence: `tmp/ranked-search-comparison-2026-09-12T12-57-51.119Z.json`.

Median database execution milliseconds, three observations per cell:

| Query | Fresh snapshots after updates | After 120 seconds idle | After ordinary vacuum | Buffers disabled, after two 5,000-row update cycles | Native at that last stage |
| --- | ---: | ---: | ---: | ---: | ---: |
| legislation | 175.334 | 175.253 | 10.744 | 35.297 | 78.434 |
| health | 154.729 | 153.694 | 10.849 | 12.092 | 83.753 |
| tax | 155.228 | 155.729 | 9.767 | 13.239 | 46.765 |
| "health insurance" | 155.967 | 155.268 | 11.147 | 12.576 | 12.972 |

Background merging was enabled. Releasing the long repeatable-read snapshot and waiting did not
repair the regression in this observation window. Ordinary `VACUUM (ANALYZE)` did, without rebuilding.
The alternative experiment set the supported index option `mutable_segment_rows=0`, reset the test
index once to establish a clean configuration control, and then performed two 5,000-row update cycles
and ten separately committed one-row updates **without intervening vacuum or rebuild**. Four concurrent
readers subsequently retained approximately 12 ms health/tax execution and 36 ms legislation execution.
This first concurrency test had no simultaneous writer; the amendment follow-up adds that case.

The mechanism is consistent with [ParadeDB's documented mutable-buffer design](https://www.paradedb.com/blog/increased-write-performance):
recent buffered records are materialized into a searchable in-memory index during queries.
The [0.25.9 index-option implementation](https://github.com/paradedb/paradedb/blob/v0.25.9/pg_search/src/postgres/options.rs)
accepts zero to disable mutable segments. This remains a causal inference from the controlled comparison,
not CPU profiling inside the extension.

Tradeoff: on this run, ten 500-row update commits took 2.474 seconds with default buffering versus
3.022 and 3.055 seconds with buffering disabled (approximately 22–24% more wall time). Both native and
ranked indexes coexist, network time is included, and these are single observations, not an isolated
write-throughput estimate. The phrase query has essentially no benefit; not every search becomes faster.

Reproduce with `pnpm eval:ranked-search --diagnose-updates`; use `--diagnose-amendments` for the bounded
latest-amendment sample, exact metadata eligibility and committed insert/delete checks, four readers
with a simultaneous bounded writer, and final exact amendment grouping. Full plans are retained in
timestamped ignored JSON artifacts; terminal output contains summaries. Both modes refuse the source
host and any target database other than `legislation_search_benchmark`, use read-only source
transactions, and clean up their own disposable schema. No production configuration is changed.

### Amendment-heavy follow-up

The second run copied 1,294 actual sections from 1,000 recent amendment documents, then created nine
synthetic copies: 12,940 sections. All sample sections belong to amendments; 94.3% are Colorado.
This is substantially more actual amendment coverage than the original 13 sections, but remains a
small, jurisdiction-skewed sample, not a production-scale benchmark. The source query uses the
amendment-date index and bounded per-document section lookups; source reads have 15-second timeouts.
Evidence: `tmp/ranked-search-comparison-2026-09-12T13-07-43.691Z.json`. All 300 paired measurements
completed without errors, every amendment measurement returned 21 distinct documents, and all 17
exact metadata eligibility checks passed. These are not empty-result performance claims.

The exact metadata ID-set checks passed after every update cycle, including removal of superseded
timestamps and committed insert/delete visibility. A further 5,000-row writer overlapped all ten
committed batches with four reader workloads and completed in 2.684 seconds. The final exact
amendment grouping comparison still favored native search: health 11.367 ms versus ranked 43.774 ms;
tax 4.867 ms versus ranked 21.154 ms; legislation 7.680 ms versus ranked 46.304 ms (five-run medians).
Do not confuse these with deployed API latency or identical relevance scores.

Automatic vacuum was observed on this smaller table: at 13:02:05 UTC its catalog reported two
autovacuums, zero dead rows, and last autovacuum at 13:01:14 UTC. Default-buffer performance therefore
recovered during the post-update suite. Even with buffering disabled, timings varied after subsequent
writes. This reinforces that a short clean-index result is not a steady-state guarantee.

Recommendation: retain the current production engine and preserve all vector indexes. The buffer
regression has a supported mitigation; **the overall migration business case has not passed**.
If further evaluation is pursued, require larger, jurisdiction-balanced amendment workloads and an
integrated API comparison before investing the estimated 30–55 engineering hours in migration.

## What was measured

The disposable Railway service `legislation-search-comparison`
(`b0ac38fb-e088-43de-825c-1e4323d5d0e6`) ran `paradedb/paradedb:0.25.9`, deployment
`eb34506e-3b22-40d9-b957-67f3c5b8418f` (SUCCESS). Production supplied read-only samples;
all index creation and updates occurred in the isolated database.

The final sample contains 2,000 actual sections each from Alaska, California, New York, Texas and
federal records, plus nine synthetic copies: 100,000 rows and 33,010 distinct document keys. These
are the first keys within each range, not a random corpus sample. Only 130 sample rows are amendment
sections, so amendment coverage is inadequate for an adoption decision. An earlier all-Alaska trial
was superseded; an empty-range attempt was stopped and discarded, not counted as evidence.

Both engines use the same table and eligibility filters. Native PostgreSQL uses stored English text
vectors and GIN; ParadeDB uses the proposed ranked query implementation. Five alternating warm runs
cover three broad terms, a phrase and a 20%-selective jurisdiction filter, for passage candidates and
exactly deduplicated amendment candidates. The suite repeats after 5,000 metadata updates committed
in ten batches. The current API, hydration, authentication and hybrid retrieval are not exercised.
BM25 and `ts_rank_cd` intentionally differ; faster execution does not prove equivalent relevance.

Session work memory (4 MiB) and parallel gather (2) match production. The benchmark still has about
5.59 GiB shared buffers versus production's 128 MiB, different maintenance memory and ephemeral disk.
Client wall time includes a remote connection and must not be presented as deployed API latency.
Five observations support medians and ranges, not p95, concurrency capacity or an SLA.

## Repeated performance results

Median database execution time in milliseconds, five observations per cell:

| Passage query | Native fresh | Ranked fresh | Native after updates | Ranked after updates |
| --- | ---: | ---: | ---: | ---: |
| legislation | 75.958 | 9.374 | 77.008 | 172.449 |
| health | 81.495 | 9.477 | 80.258 | 150.844 |
| tax | 48.670 | 9.058 | 51.978 | 154.037 |
| "health insurance" | 12.659 | 10.348 | 14.581 | 156.823 |
| health, Alaska only | 37.104 | 9.885 | 38.982 | 176.521 |

Fresh broad passage ranking was 5.4–8.6 times faster. After metadata updates, ranked passage execution
was 1.9–10.8 times slower than native across these cases. All 200 candidate measurements completed
without errors, but completion under 15 seconds on this small sample is not production acceptance.
Amendment candidate server medians after updates were 149.8–160.2 ms ranked versus 11.4–20.6 ms native;
the small amendment population means these are not full-corpus grouping conclusions.

Saved native plans never use ParadeDB Custom Scan. Ranked plans retain top-K and filter pushdown.
In the first broad passage observation, ranked segment count changed from 24 to 29, shared-buffer
hits from 781 to 13,352, and startup time from 8.7 to 158.1 ms; disk reads remained zero. This localizes
the observed regression to the updated index's execution path, rather than a loss of top-K or cold
disk reads. It does not prove which internal segment/visibility behavior is responsible.
Investigate update/visibility/maintenance behavior before expanding the migration plan.

## Storage and build observations

- Ranked index: 134,258,688 bytes; native body/title GIN indexes combined: 44,318,720 bytes.
- One ranked build: 1.88 seconds; native GIN builds: 2.14 seconds. Native vector preparation took
  31.25 seconds and is not work that production needs to repeat.
- Updating 5,000 metadata rows took 4.12 seconds including remote round trips, with both index types
  present. This is not an isolated measurement of ParadeDB write overhead.

Do not multiply the 1.88-second build by corpus row count and call that a migration ETA. Repeated
text, vocabulary, storage, maintenance memory, live writes and metadata backfill all differ.
Production currently has approximately 15,622,114 sections; its section table including indexes/TOAST
is 95.2 GB. Backfill can produce substantial row churn and WAL beyond the new index's final size.

## Migration effort, not an elapsed-time promise

If the remaining performance gates justify adoption, a planning estimate is **30–55 engineering
hours, approximately 4–7 focused working days**, excluding database processing and operational waiting:

| Work | Engineering hours |
| --- | ---: |
| Schema and correct metadata maintenance across bill, sponsor, document and OCR changes | 10–18 |
| Restartable backfill and consistency verification | 5–9 |
| API hydration, pagination, hybrid integration and error handling | 6–10 |
| Compatible-image rehearsal, relevance validation and authenticated deployed smoke | 9–18 |

Backfill/index wall time and restart downtime remain unmeasured. A defensible total migration duration
requires a production-like storage/build rehearsal and measured bounded metadata backfill throughput.
No new embedding generation or HNSW rebuild belongs in that plan.

Before adopting: use a larger jurisdiction-balanced amendment sample, exercise duplicate-heavy/deep pages and
long-running concurrent ingestion, judge relevance, then measure the integrated API. Do not close either production
timeout gate based on this candidate-stage benchmark.

## Reproduction and verification

Run `pnpm eval:ranked-search --sample` against a fresh, explicitly isolated
`legislation_search_benchmark` database with its extension already supplied by the image. The harness
refuses unsafe source/target identities and incomplete sample strata. Timestamped full observations
and execution plans are written under ignored `tmp/ranked-search-comparison-*.json`; schema cleanup
runs even if report writing fails.

The follow-up's 107 focused tests and standalone harness type-check pass. Repository `pnpm verify`
passed its check stage but failed two unrelated `fc-theme-base` component-library tests at their
five-second timeouts. Repository-wide verification is not green.

Original comparison observations: `tmp/ranked-search-comparison-2026-09-12T09-51-58.684Z.json`.
The disposable schema was removed by the harness. The temporary Railway service and ephemeral data
were deleted; a fresh listing confirms only the original application, pooler and database remain.
The deleted sample is reproducible from the harness, not recoverable from that service. No production
deployment or database configuration was changed.

<a id="text-search-index-evaluation"></a>

<a id="text-search-index-evaluation--isolated-ranked-text-index-evaluation"></a>

## Isolated ranked text-index evaluation

September 12 update: [paired performance comparison and migration decision](ranked-search.md).
Production adoption is on hold; the implementation below remains an isolated candidate, not a deployed solution.

September 11, 2026. Status: ranked-query implementation and isolated correctness canary completed;
production schema, ingestion integration, API cutover and extension rollout **not implemented**.
The two broad lexical timeout gates remain open. This does not change API acceptance counts.

<a id="text-search-index-evaluation--selected-direction-and-current-implementation"></a>

### Selected direction and current implementation

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

<a id="text-search-index-evaluation--full-query-correctness-canary"></a>

### Full-query correctness canary

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

<a id="text-search-index-evaluation--production-rollout-gates"></a>

### Production rollout gates

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

<a id="text-search-index-evaluation--scope-and-reproducibility"></a>

### Scope and reproducibility

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

<a id="text-search-index-evaluation--findings"></a>

### Findings

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

<a id="text-search-index-evaluation--limitations-and-next-gates"></a>

### Limitations and next gates

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

<a id="text-search-index-evaluation--verification"></a>

### Verification

All 62 focused search/query/benchmark tests pass, including four pre-connection safety tests. Scoped
formatting and lint pass. Repository `pnpm verify` reached
coverage but failed in the unrelated `scoring#test:coverage` task; the repository-wide loop is not green.
