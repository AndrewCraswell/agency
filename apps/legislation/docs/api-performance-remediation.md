# API performance remediation

This checklist tracks the production query work identified by the September 1, 2026 API smoke test and read-only
PostgreSQL plan review. It covers browse and lexical-search performance; the completed HNSW embedding indexes do not
accelerate these query shapes.

## Verified baseline

- [x] Confirm all four embedding HNSW indexes are valid and ready and no index build remains active.
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
- [ ] If global sponsor-name candidate generation remains necessary, persist and GIN-index its search vector.
- [ ] Prove selective and broad bill searches return canonical results without timing out.

### Passage and amendment lexical search

- [ ] Detect lexical queries whose estimated match set is too broad to rank safely within the API budget.
- [ ] Return a documented `query_too_broad` error for unscoped pathological lexical searches rather than a database
      availability error.
- [x] Use semantic HNSW candidates as the bounded first stage for passage hybrid mode, then apply lexical scoring only
      to those section IDs.
- [ ] Add a product-specific document-backed-amendment embedding candidate store or index; the shared
      document-section HNSW index cannot efficiently apply the joined document-classification filter across the
      113,937 amendment documents in production.
- [ ] Complete semantic-first bounded hybrid amendment search after the product-specific candidate path exists.
- [ ] Push jurisdiction, session, bill, document classification, and processing-state filters ahead of ranking.
- [ ] Keep lexical-only behavior deterministic and document when a scope is required.
- [ ] Verify lexical, semantic, and hybrid searches against selective and intentionally broad queries.

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
- [ ] Production smoke has no failed, blocked, or skipped checks attributable to query performance.
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
