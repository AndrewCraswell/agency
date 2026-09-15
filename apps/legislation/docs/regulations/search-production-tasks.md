# Remaining passage, indexing and embedding tasks

Owner: [production backlog](production-backlog.md). Requirements: [search indexing](search-indexing.md),
[storage validation](storage-validation.md), [API contract](api-mcp-contract.md). Use canonical versions and the isolated
legal search tables; do not introduce a second model client or regenerate existing legislative embeddings.

## Passages and source text

Extend `reader-text.ts`, `reader-contract.ts`, `passages.ts`, `table-passages.ts`, `passage-storage.ts` and
`passage-preparation.ts`. The lossless reader, pinned tokenizers and most table continuation logic already exist.
Prerequisite: validated source samples; full execution waits for the corresponding ING partition.

- [ ] **PASS-01 Inventory every input shape.** Scan selected canonical versions for prose, appendices, nested tables,
  spans, long identifying cells and empty text; record version IDs, sizes and source locators. **Done:** every version
  is classified, with bounded sample manifests and explicit unsupported-shape counts rather than sampled-only coverage.
- [ ] **PASS-02 Support nested tables.** Preserve parent/child table order and source spans when deriving retrieval
  passages; define when nesting remains an indivisible unit. **Done:** source-reader reconstruction is exact and every
  eligible nested table fits token/input limits without dropping cells. Depends on PASS-01.
- [ ] **PASS-03 Support spanning data rows.** Carry row/column spans and applicable headers into passages without
  inventing repeated source content. **Done:** representative merged-cell fixtures preserve row meaning, stable IDs,
  exact reader/context offsets and full cell coverage. Depends on PASS-01.
- [ ] **PASS-04 Handle oversized identifying context.** Define deterministic continuations when labels or multiple
  identifying columns alone exceed the model input budget. **Done:** either supported source-backed segments cover
  the entire row or an explicit ineligible reason is emitted; no prefix truncation. Depends on PASS-01.
- [ ] **PASS-05 Complete source-backed context checks.** Test multilevel headers, ditto markers, repeated captions,
  footnotes and appendix-wrapped tables across publisher formats. **Done:** context never crosses a table/section
  boundary without evidence; all substitutions point to original source spans. Depends on PASS-02–04.
- [ ] **PASS-06 Freeze the final passage manifest.** Bind owner/version, source membership, reader/input contracts,
  tokenizer, context hash, input hash and eligibility in deterministic per-partition manifests. **Done:** replay has
  identical IDs/hashes and changed context produces distinct preparation work. Depends on PASS-05.
- [ ] **PASS-07 Check both tokenizers at scale.** Run offline counts over the full selected manifest; summarize token
  distribution, maximum input, continuation counts and transport-size failures for both models. **Done:** no eligible
  input exceeds configured limits; failures identify exact versions without changing source text. Depends on PASS-06.
- [ ] **PASS-08 Validate source reconstruction.** Independently compare reconstructed reader bodies and table cell
  coverage against retained source; review difficult real samples visually where text extraction loses layout meaning.
  **Done:** zero unexplained dropped/duplicated source spans in the advertised scope. Depends on PASS-05–07.
- [ ] **PASS-09 Prepare full selected partitions.** Run the deployed preparation worker on validated current/FR/history
  partitions using the selected passage contract. **Done:** expected version inventory equals completed or explicitly
  ineligible inventory; interrupted generations resume without provider calls. Depends on PASS-08, ORCH-06, ING partitions.
- [ ] **PASS-10 Publish preparation readiness.** Expose counts/reasons by corpus, year, title and format; link failures
  to operator repair records. **Done:** downstream lexical/vector manifests cannot silently omit a failed passage or
  reuse a different tokenizer/context generation. Depends on PASS-09.

Passage gate: reader text is lossless; model inputs are bounded and traceable; eligibility accounts for every selected
version. A passing sample is not permission to call a full corpus prepared.

## Indexing and query execution

Extend `infra/passage-search/legal.sql`, canonical preparation/outbox storage, `passage-copy-*`, `passage-search.ts`
and `search-rights.ts`. Lexical generation, atomic copying and basic rights cleanup already exist.

- [ ] **INDEX-01 Design cross-version filter projections.** Add source/rights, jurisdiction, corpus, code, agency,
  publication kind/date and selected edition fields needed before ranking; document which remain canonically hydrated.
  **Done:** projections are derived from explicit memberships and cannot mix metadata from another observation/version.
- [ ] **INDEX-02 Implement corpus-wide candidate selection.** Select authorized acknowledged scopes before lexical or
  vector ranking; default to validated current scope and honor explicit historical/publication filters. **Done:** test
  queries across multiple editions/publications never leak excluded or unacknowledged candidates. Depends on INDEX-01.
- [ ] **INDEX-03 Make whole-copy acknowledgement resumable.** Replace the current single 60-second full-scope inspection
  limit with durable, bounded validation checkpoints tied to immutable inventory/generation/rights evidence. **Done:**
  changed source, membership, target content or rights invalidates the receipt; only a fully revalidated scope can
  acknowledge. Preserve target-commit-before-source-ack recovery. Depends on PASS-06.
- [ ] **INDEX-04 Wire correction and removal propagation.** Emit/replay target updates for changed versions, membership
  removal and current-head replacement; distinguish removal from revocation and historical retention. **Done:** stale
  current hits disappear while allowed historical citations remain available. Depends on ING-11, INDEX-01.
- [ ] **INDEX-05 Complete rights invalidation across serving.** Extend existing scope cleanup to filter projections,
  result/candidate caches and later vector records; preserve shared allowed copies. **Done:** source revocation denies
  reads immediately and resumably removes forbidden derivatives without deleting another scope's allowed content.
- [ ] **INDEX-06 Add reconciliation and repair inspection.** Report source/target counts, hashes, selected receipts,
  missing generations, delayed jobs and oldest pending age per partition. **Done:** deliberately corrupt or omit a row
  and the inspector fails without authorizing serving; targeted recopy restores readiness. Depends on INDEX-03–05.
- [ ] **INDEX-07 Implement canonical result hydration.** Group passage candidates by owner and exact selected version;
  attach validated citation, source locator, dates, agency references and coverage warnings. **Done:** multiple matching
  passages cannot produce contradictory version context or duplicate document results. Depends on INDEX-02, ING-09.
- [ ] **INDEX-08 Implement lexical cursor binding.** Bind cursor to caller, normalized query/filters, limit, stable
  ranking and generation; invalidate on incompatible generation/rights changes. **Done:** no duplicate/skipped results
  across pages; cross-account, changed-filter and expired cursors fail safely. Depends on INDEX-07.
- [ ] **INDEX-09 Implement frozen semantic/hybrid candidates.** Persist bounded candidate sets with generation/model,
  expiry, caller binding and truncation metadata; add deterministic fusion and reranking where selected. **Done:**
  later pages cannot rerun a changing ranking or expose a revoked cached hit. Depends on INDEX-07, VECTOR-04.
- [ ] **INDEX-10 Implement explicit degradation.** Return unavailable semantic capability unless the request explicitly
  permits lexical fallback; preserve requested/effective mode, generation and model metadata. **Done:** provider outage,
  missing vectors and partial scope never masquerade as full semantic results. Depends on INDEX-02, INDEX-09.
- [ ] **INDEX-11 Tune selective lexical/filter indexes.** Capture EXPLAIN ANALYZE plans and timings for common and sparse
  jurisdiction/code/agency/date/edition queries against representative volume. **Done:** no unbounded scan or filter
  applied only after global top-k; measured limits and remaining risks are recorded. Depends on INDEX-02, INDEX-07.
- [ ] **INDEX-12 Copy and acknowledge full lexical partitions.** Run the existing copy worker followed by INDEX-03's
  verifier; retain inventory/hash receipts. **Done:** every PASS-10 eligible generation is acknowledged or has an
  explicit blocking disposition; copy traversal exhaustion alone cannot pass. Depends on PASS-09–10, INDEX-03/06.
- [ ] **INDEX-13 Benchmark correction and concurrent retrieval.** Load the selected corpus while issuing representative
  queries, corrections and rights revocations. **Done:** latency/throughput and repair lag meet documented targets
  without degrading existing bill search beyond the agreed budget. Depends on INDEX-11–12, OPS-06.
- [ ] **INDEX-14 Promote lexical capability by partition.** Store the selected serving generation and rollback pointer;
  test disable/revert without source-data deletion. **Done:** API coverage advertises only the acknowledged measured
  partitions, and rollback restores the previous allowed generation. Depends on INDEX-06, INDEX-12–13, HTTP-14.

## Model evaluation

Extend `embedding-smoke.ts`, `embedding-judgments.ts`, the diagnostic cache and existing smoke scripts. The current
Voyage lead is provisional. The selected route must be justified on final prepared passages, not old excerpt scores.

- [ ] **EVAL-01 Freeze the evaluation protocol before scoring.** Record cohorts, train/development/held-out separation,
  retrieval metrics, acceptable regressions, cost/latency ceilings and selection rule from the search specification.
  **Done:** the retained protocol hash predates new scoring and explains how ties and sparse cohorts are handled.
- [ ] **EVAL-02 Build final-passage evaluation corpora.** Select current eCFR, proposals/final rules/notices, annual
  history and difficult tables from PASS-06; include near-identical versions and agency/jurisdiction confounders.
  **Done:** exact source/version/input manifests are frozen and cohort membership is reviewable. Depends on PASS-06, EVAL-01.
- [ ] **EVAL-03 Expand queries and hard negatives.** Extend existing 60-query packets with historical date selection,
  proposed-versus-current obligations, exception clauses, numerical tables and no-answer cases. **Done:** held-out
  titles/queries remain separate from development tuning and every expected answer cites source text. Depends on EVAL-02.
- [ ] **EVAL-04 Complete blind relevance review.** Use existing rank-blind packets; record grades, rationales, multiple
  acceptable answers, reviewer and disagreements. **Done:** domain/product review adjudicates ambiguous labels before
  final scoring. Automated judge suggestions are marked as such and do not become human review. Depends on EVAL-03.
- [ ] **EVAL-05 Close tokenizer/provider accounting evidence.** Recheck the recorded Voyage local/provider usage
  difference with identical text, query/document mode and provider metadata. **Done:** exact input integrity remains
  verified and billing discrepancy is explained or explicitly bounded; no text mutation is introduced to force equality.
- [ ] **EVAL-06 Run both semantic candidates.** Compare OpenAI Small and Voyage 4 through the repaired shared client
  using identical frozen passages/queries and immutable response cache. **Done:** dimensions, input/output pairing,
  usage, provider errors, latency and model IDs are retained per request. Depends on EVAL-02, EVAL-04–05.
- [ ] **EVAL-07 Compare lexical, hybrid and reranked retrieval.** Use actual PostgreSQL lexical behavior and the proposed
  fusion/rerank path; distinguish PostgreSQL FTS from BM25. **Done:** configuration, Recall@k, nDCG@k, per-cohort failures,
  latency and incremental cost are reproducible. Depends on EVAL-06, INDEX-09–11.
- [ ] **EVAL-08 Audit failures against source.** Review false positives/negatives, proposal/current confusion and table
  mistakes; fix pipeline defects without tuning against held-out answers. **Done:** changes produce a new frozen
  development run; any held-out contamination requires a new held-out set. Depends on EVAL-07.
- [ ] **EVAL-09 Reproduce the held-out result.** Re-run the frozen selection with cache provenance and a small live
  provider check; report all excluded/unanswered queries. **Done:** route choice satisfies the predeclared cohort
  thresholds and is not based solely on one aggregate score. Depends on EVAL-08.
- [ ] **EVAL-10 Publish cost and capacity estimates.** Combine measured final-passage token counts, retry overhead,
  dimensions, storage/index size and current contracted provider rates. **Done:** retained per-million-input and
  full-selected-manifest estimates state assumptions; internal measurement adds no customer usage quotas. Depends on EVAL-09, PASS-07.
- [ ] **EVAL-11 Run the deployed model canary.** Persist a bounded pilot generation and query it through authenticated
  HTTP and API-backed MCP, including a difficult table and historical/publication case. **Done:** exact IDs, input
  hashes, dimensions, citations and mode metadata agree end to end. Depends on VECTOR-01–07, HTTP-14/17, TOOLS-05.
- [ ] **EVAL-12 Record the selected regulatory route.** Publish model/dimensions/input contract, optional reranker,
  quality/cost rationale, unpassed cohorts and rollback configuration. **Done:** EVAL-01 thresholds, EVAL-09 and EVAL-11
  pass; explicitly authorize only the qualified regulatory scope for bulk jobs. This does not authorize old-vector rebuilds.

## Vector storage and execution

Extend existing model routing, embedding-job machinery and isolated search storage. A new regulatory owner contract
must not alter current bill/document embedding freshness. Small pilot writes may precede EVAL-12; bulk dispatch may not.

- [ ] **VECTOR-01 Add regulatory vector schema.** Store passage/input hash, model, dimensions, contract, generation,
  owner/version and readiness with FK/uniqueness constraints and rights ownership. **Done:** wrong dimensions,
  mismatched owners and duplicate logical vectors fail at validation/storage boundaries; disposable DB migration passes.
- [ ] **VECTOR-02 Add the regulatory route and manifest.** Resolve server-configured candidate/selected routes without
  accepting caller model names; bind vector jobs to frozen passage inventory. **Done:** default existing product routes
  and freshness hashes are unchanged; candidate pilot and production generation are distinct. Depends on VECTOR-01, PASS-06.
- [ ] **VECTOR-03 Implement token-aware shard selection.** Reuse shared token validation and client limits; select
  deterministic bounded batches by token and item budgets with stable shard keys. **Done:** oversize input is ineligible
  with evidence, never silently shortened; replay selects the same exact inputs. Depends on VECTOR-02.
- [ ] **VECTOR-04 Persist exact paired outputs.** Validate returned indices, count, model, finite dimensions and input
  hash before transactional storage/checkpoint. **Done:** reordered valid responses pair correctly; duplicate/missing/
  corrupt responses cannot acknowledge a batch. Depends on VECTOR-03.
- [ ] **VECTOR-05 Implement retries and reuse.** Reuse permitted identical inputs, preserve multiple owner memberships,
  and recover provider success followed by persistence failure without losing provenance. **Done:** accounting separates
  cache hits, possible repeated paid attempts and new writes; incomplete shards remain pending. Depends on VECTOR-04.
- [ ] **VECTOR-06 Fence stale input and revoked rights.** Recheck selected input/route/rights before writes and serving;
  invalidate stale jobs, vector memberships and caches through the correction path. **Done:** a source change or rights
  revocation during provider execution cannot promote stale/forbidden vectors. Depends on VECTOR-04, INDEX-04–05.
- [ ] **VECTOR-07 Run the durable pilot.** Exercise malformed response, provider 429/outage, killed worker, lost lease,
  source correction and target write failure on a bounded persisted corpus. **Done:** exact vector inventory recovers
  with no falsely complete shards; pilot is queryable for EVAL-11. Depends on VECTOR-05–06, ORCH-08–10.
- [ ] **VECTOR-08 Plan full manifest cost and dispatch.** Freeze eligible partitions, expected vectors/tokens, reuse,
  budget stop conditions and chosen route. **Done:** plan excludes old embedding rebuilds and unqualified historical
  cohorts; operator preview accounts for every selected passage. Depends on EVAL-12, PASS-10.
- [ ] **VECTOR-09 Execute staged bulk waves.** Increase regulatory vector concurrency only within measured provider/DB
  admission; checkpoint partitions and report spend/progress. **Done:** every expected vector has a verified result or
  explicit pending/ineligible disposition, with interrupted-wave replay evidence. Depends on VECTOR-08, ORCH-14, OPS-06.
- [ ] **VECTOR-10 Build and validate vector indexes.** Measure bulk-load versus incremental index strategy, build the
  selected indexes and inspect catalog validity/readiness; repair failed concurrent builds explicitly. **Done:** ANALYZE
  and sparse-filter recall/latency tests pass without assuming an index name proves a valid index. Depends on VECTOR-09.
- [ ] **VECTOR-11 Reconcile and promote semantic generations.** Compare source manifest, vectors, route/dimensions,
  rights and index readiness; select the serving generation atomically. **Done:** partially embedded partitions cannot
  claim semantic readiness, lexical remains usable independently, rollback is tested. Depends on VECTOR-10, INDEX-09–10.
- [ ] **VECTOR-12 Verify incremental vector operation.** Run changed-text, unchanged-text/currency-only, removed-version
  and failed-provider cases through sync-derived jobs. **Done:** only changed eligible inputs incur work, stale vectors
  cannot serve, and periodic updates need no full vector/index rebuild. Depends on VECTOR-11, SYNC-05–08.
