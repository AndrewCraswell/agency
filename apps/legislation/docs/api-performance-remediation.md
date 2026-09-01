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
- [ ] Analyze `bills` and `bill_documents` after both indexes are valid.
- [ ] Verify production plans use ordered index scans and both routes complete comfortably inside the 15-second API
      statement timeout.

### Bill lexical search

- [ ] Make the persisted `bills.search_vector` the primary bounded candidate source.
- [ ] Detect identifier-shaped input and use the canonical identifier lookup instead of vectorizing every identifier.
- [ ] Calculate title, abstract, subject, and identifier match flags only for the bounded candidate set.
- [ ] Run sponsor and version-text searches as fallback candidate sources only when primary candidates do not fill the
      requested page.
- [ ] If global sponsor-name candidate generation remains necessary, persist and GIN-index its search vector.
- [ ] Prove selective and broad bill searches return canonical results without timing out.

### Passage and amendment lexical search

- [ ] Detect lexical queries whose estimated match set is too broad to rank safely within the API budget.
- [ ] Return a documented `query_too_broad` error for unscoped pathological lexical searches rather than a database
      availability error.
- [ ] Use semantic HNSW candidates as the bounded first stage for hybrid mode, then apply lexical scoring to that set.
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
- [ ] Each completed block is deployed separately and reaches terminal Railway success.
- [ ] Production smoke has no failed, blocked, or skipped checks attributable to query performance.
- [ ] MCP lexical, semantic, and hybrid retrieval passes after the HTTP API is clean.
