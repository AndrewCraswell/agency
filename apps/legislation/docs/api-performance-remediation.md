# API performance remediation

This checklist tracks the production query work identified by the September 1, 2026 API smoke test and read-only
PostgreSQL plan review. It covers browse, lexical, semantic, and hybrid query performance. The general embedding HNSW
indexes do not accelerate every browse or lexical shape, so each query family still requires a bounded candidate path
and a production plan check.

## Verified baseline

- [x] Confirm all five embedding HNSW indexes are valid and ready and no index build remains active.
- [x] Confirm the five observed 15-second statement timeouts came from the production smoke test.
- [x] Capture planner output for global bill browse, amendment browse, passage search, and the four bill-search candidate
      branches.
- [x] Confirm connection saturation and lock contention were absent during diagnosis.

Production scale at diagnosis:

| Relation | Estimated live rows | Heap cache hit |
| --- | ---: | ---: |
| `bills` | 1,513,431 | 44.25% |
| `bill_documents` | 4,366,519 | 47.83% |
| `document_sections` | 15,258,571 | 63.75% |
| `bill_actions` | 12,674,881 | 94.45% |

## Ordered work

### Browse indexes

- [x] Add a global `(introduced_at DESC, id ASC)` bill index so `/api/bills?sort=introduced-desc` does not scan and
      sort the complete bill table.
- [x] Add a document-amendment index matching `classification`, null placement, `document_date DESC`, and `id ASC` so
      `/api/amendments` can stop after reading one page.
- [x] Keep the indexes in the canonical schema and fresh-database baseline.
- [x] Add a dedicated concurrent production-maintenance task; do not create either large index inside the transactional
      Drizzle migration runner.
- [x] Refuse to start that task while another PostgreSQL index build is visible, and recover only its own invalid index
      names.
- [x] Analyze `bills` and `bill_documents` after both indexes are valid.
- [x] Verify production plans use ordered index scans and both routes complete comfortably inside the 15-second API
      statement timeout.

### Bill lexical search

- [x] Make the persisted `bills.search_vector` the primary bounded candidate source.
- [x] Detect identifier-shaped input and use the canonical identifier lookup instead of vectorizing every identifier.
- [x] Calculate title, abstract, subject, and identifier match flags only for the bounded candidate set.
- [x] Run sponsor and version-text searches as fallback candidate sources only when primary candidates do not fill the
      requested page.
- [x] Persist and GIN-index the sponsor-name search vector used by global fallback candidate generation.
- [x] Prove selective and broad bill searches return canonical results without timing out.

### Passage and amendment lexical search

September 12: the [ranked search comparison](ranked-search-performance-decision.md) does not justify a production
ParadeDB migration. The current implementation work uses a [native amendment search projection](amendment-search-projection.md)
to isolate amendment text without changing the database engine or rebuilding HNSW indexes. Backfill, exact result parity,
production timing and all 14 deployed smoke checks passed in release `ddc68697-d50f-42f2-b760-b2ded5832c64` from
`b1fef71`. **The broad amendment timeout gate is closed; broad passage search remains open.** Amendment lexical smoke
returned in 495–1,785 ms, including 100 results. This is smoke evidence, not a corpus-wide latency guarantee.

September 12 passage follow-up: **not completed; no application or production configuration change deployed**.
Fresh read-only diagnostics removed parent joins, snippets, and hydration entirely. Rank-only `legislation` and
match-count-only `legislation` both exceeded the database-enforced 15-second deadline. Separate transaction-local
probes disabled sequential scans, parallel workers and JIT, and used 128 MB work memory; match-count `legislation`,
rank-only `health`, and rank-only `"health insurance"` still timed out. Every transaction was rolled back.
The session snapshot had one active session (the diagnostic itself) and zero blocked sessions. Section statistics
estimated 16,272,711 live rows and 1,055 dead rows, with last automatic analyze at `2026-09-12T00:10:15.554Z`.
The section relation occupies 17,863,311,360 heap bytes and 96,453,959,680 total bytes including indexes/TOAST;
its native full-text GIN index occupies 7,664,771,072 bytes. These observations do not prove every native redesign
would fail, but do not justify shipping another unverified query rewrite or a full-corpus projection backfill.

Evidence: `tmp/passage-diagnostic-1789225942923.json` and `tmp/passage-index-probe-1789226060517.json`.
[PostgreSQL's GIN documentation](https://www.postgresql.org/docs/18/textsearch-indexes.html) explains that the index
stores lexemes rather than weight labels; finding matches is not equivalent to returning an exactly ranked page.
The existing [ranked-index experiment](ranked-search-performance-decision.md) is a candidate-stage benchmark only,
not full-corpus acceptance. On September 12 the user approved a separate passage-only ParadeDB service and BM25
ordering, retaining canonical IDs, exact filters and deterministic pagination. Implementation and release gates are
tracked in [the passage-search delivery plan](passage-search-delivery.md). Full-corpus acceptance and a compatible
deployment/rollback plan still precede API cutover. Do not silently sample candidates,
switch lexical requests to semantic mode, raise the API deadline, or close this gate with a different error response.

- [ ] Detect lexical queries whose estimated match set is too broad to rank safely within the API budget.
- [ ] Return a documented `query_too_broad` error for unscoped pathological lexical searches rather than a database
      availability error.
- [x] Use semantic HNSW candidates as the bounded first stage for passage hybrid mode, then apply lexical scoring only
      to those section IDs.
- [x] Add the amendment-only partial document-section HNSW candidate path so amendment semantic and hybrid searches do
      not apply the document-classification filter after scanning the shared candidate space.
- [x] Add a nullable `document_classification` discriminator to section embeddings and populate it on every new or
      refreshed embedding write without changing the live search query.
- [x] Apply migration `0045_amendment_document_embedding_classification` before deploying discriminator-aware writes.
- [x] Backfill the discriminator in bounded, restartable batches from `document_sections` and `bill_documents`; verify
      zero mismatches and zero remaining nulls for the active document embedding route.
- [x] Build an amendment-only partial HNSW index concurrently, analyze the embedding table, and prove the production
      plan selects that index inside the 15-second statement budget.
- [x] Validate the classification constraint only after the backfill is complete.
- [x] Complete semantic-first bounded hybrid amendment search after the product-specific candidate path exists.
- [ ] Push jurisdiction, session, bill, document classification, and processing-state filters ahead of ranking.
- [ ] Keep lexical-only behavior deterministic and document when a scope is required.
- [x] Verify lexical, semantic, and hybrid searches against selective and intentionally broad queries.

### Core-table maintenance and observability

- [ ] Schedule `VACUUM (ANALYZE)` for `bills`, `bill_documents`, `document_sections`, and `supporting_materials` after the
      index work; treat it as a bounded I/O maintenance operation.
- [ ] Enable `pg_stat_statements` and I/O timing so execution time, block reads, and temporary spills are attributable to
      exact query families.
- [ ] After query changes are proven, evaluate `shared_buffers` near 1–1.5 GB and an SSD-appropriate
      `random_page_cost`; do not use configuration tuning as a substitute for the missing indexes or bounded search.
- [ ] Track volume headroom while adding indexes. At diagnosis, 579.9 GB of the 750 GB volume was used.

## Release gate

- [x] Focused query-generation and schema tests pass.
- [x] Package format, lint, type, unused-code, and test checks pass.
- [x] Each completed block is deployed separately and reaches terminal Railway success.
- [x] Production smoke has no failed, blocked, or skipped checks attributable to query performance.
- [ ] MCP lexical, semantic, and hybrid retrieval passes after the HTTP API is clean.

## Browse-index production evidence

The browse-index block was deployed on September 1, 2026. Railway deployment
`5c5ed557-fcff-40e4-bce7-2e473423b2c0`, sourced from commit `8150f36`, reached terminal `SUCCESS`. Trigger version
`20260902.1` deployed with 21 detected tasks. The production maintenance sequence confirmed no active PostgreSQL index
build, acquired the shared legislation index-maintenance advisory lock, created both indexes concurrently, analyzed both
tables, and released the lock.

Both indexes are valid and ready: `bills_global_introduced_idx` is 75 MB and
`bill_documents_amendment_date_idx` is 424 MB. `EXPLAIN (FORMAT JSON)` selects an index-only scan on the corresponding
index for each ordered browse query. Authenticated production probes returned canonical one-item pages with correlation-ID
echo on every request:

| Route | Cold | Warm attempts |
| --- | ---: | ---: |
| `GET /api/bills?sort=introduced-desc&limit=1` | 609 ms | 158 ms, 77 ms |
| `GET /api/amendments?limit=1` | 345 ms | 108 ms, 88 ms |

## Final production evidence

The discriminator backfill first exceeded the task's statement timeout after committing 261,295 rows. Commit `1fa13a0`
gave the dedicated maintenance session an unlimited statement timeout while preserving bounded 10,000-row transactions.
Trigger version `20260902.8` resumed the same data operation in run `run_06g63herp7n38f97vmk1342n01`, classified the
remaining 80,695 rows, and completed with zero null classifications and zero mismatches. The classification constraint is
valid and the temporary helper index was removed.

The amendment embedding maintenance run `run_06g64fo9t9hrc8ikj4757d3e01` completed the amendment-only partial HNSW
index and analyzed all four embedding tables. All five embedding HNSW indexes are valid and ready. A natural production
plan selected `document_section_embeddings_amendment_hnsw_idx`, returned 40 candidates, and completed in 93.933 ms of
database execution time and 219.770 ms at the client. Read-only validation found zero invalid document or supporting-
material page ranges; `document_sections_page_range_check` and `supporting_material_sections_pages_check` are valid, and
no data repair was required.

Commits `36e7060`, `e72b5c4`, and `819a0fc` completed the remaining bill, supporting-material, and amendment query work.
Trigger version `20260902.9` maintenance run `run_06g6567e43uu13mooebqbu8501` completed the sponsor search-vector index;
the 23 MB GIN index is valid and ready, `bill_sponsors` was analyzed at `2026-09-02T14:50:14.923Z`, and a natural plan used the
index in 0.066 ms. Production measurements were 176 ms for the bill branch, 711.8 ms for the final amendment SQL, 1,022
ms and 1,095 ms for stable first and deep supporting-material pages, and about 661 ms for a targeted supporting-material
query.

Railway deployment `9824b674-c55e-4933-8cec-a68475746f5f`, sourced from commit `819a0fc`, reached terminal `SUCCESS`.
The authenticated cumulative smoke passed all seven search, document-difference, and research operations: bill,
amendment, passage, supporting-material, and universal search, document diff, and research answer. No search check was
skipped. The broader profile also passed 11 jurisdiction/session checks, 12 legislative checks with six exact
`canonical_data_incomplete` fixture skips, nine document/resource checks, two people/organization collection checks with
12 fixture-not-configured skips, and two meeting/calendar collection checks with 12 fixture-not-configured skips.
Health and readiness returned `200`; unknown routes and unsupported methods returned `404`. The remaining fixture skips
are explicit data-availability gates, not query-performance failures.
