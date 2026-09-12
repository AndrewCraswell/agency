# Ranked search performance decision

September 12, 2026. Decision: **do not migrate with the current design**. Fresh-index passage ranking
improves, but the benefit reverses after a small committed metadata-update workload. The benchmark
does not establish an overall API improvement or resolution of the broad amendment timeout.
Existing vector indexes, embeddings and OCR remain untouched.

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

Before adopting: use a substantial real amendment sample, exercise duplicate-heavy/deep pages and
concurrent ingestion, judge relevance, then measure the integrated API. Do not close either production
timeout gate based on this candidate-stage benchmark.

## Reproduction and verification

Run `pnpm eval:ranked-search --sample` against a fresh, explicitly isolated
`legislation_search_benchmark` database with its extension already supplied by the image. The harness
refuses unsafe source/target identities and incomplete sample strata. Timestamped full observations
and execution plans are written under ignored `tmp/ranked-search-comparison-*.json`; schema cleanup
runs even if report writing fails.

The 101 focused tests and standalone harness type-check pass. Repository `pnpm verify` passed its
check stage but failed unrelated scoring coverage thresholds (lines 96.09%, functions 99.79%,
statements 95.44%, branches 93.78%, against 100%). Repository-wide verification is not green.

Full final observations: `tmp/ranked-search-comparison-2026-09-12T09-51-58.684Z.json`.
The disposable schema was removed by the harness. The temporary Railway service and ephemeral data
were deleted; a fresh listing confirms only the original application, pooler and database remain.
The deleted sample is reproducible from the harness, not recoverable from that service. No production
deployment or database configuration was changed.
