# Remaining passage, indexing and embedding tasks

Owner: [production backlog](production-backlog.md). Requirements: [search indexing](search-indexing.md),
[storage validation](storage-validation.md), [API contract](../../../legislation-web/docs/regulations/api-mcp-contract.md). Use canonical versions and the isolated
legal search tables; do not introduce a second model client or regenerate existing legislative embeddings.

## Passages and source text

Extend `reader-text.ts`, `reader-contract.ts`, `passages.ts`, `table-passages.ts`, `passage-storage.ts` and
`passage-preparation.ts`. The lossless reader, pinned tokenizers and most table continuation logic already exist.
Prerequisite: validated source samples; full execution waits for the corresponding ING partition.

September 15 local evidence for PASS-01/06–08: the [January 18 FR pilot](fr-publication-passage-pilot.md) inventories
all 110 versions, resolves five source-only GPO ruling rows, and prepares every version with both tokenizers.
Independent reconstruction and exact input recounts pass for 873 OpenAI-tokenized and 927 Voyage-tokenized passages.
This closes the ruling-row defect only; the release-wide scope and other table-shape gates below remain outstanding.

The [canonical shape inventory](passage-shape-inventory.md) now scans retained eCFR/annual memberships with bounded
read-only queries, canonical hash checks, exact reader reconstruction and per-table rejection codes. Completed edition
reports are verified before replay. Full current-title execution evidence belongs in the progress ledger; historical/FR
release inventory and tokenizer eligibility remain open.

- [ ] **PASS-01 Inventory every input shape.** Scan selected canonical versions for prose, appendices, nested tables,
  spans, long identifying cells and empty text; record version IDs, sizes and source locators. **Done:** every version
  is classified, with bounded sample manifests and explicit unsupported-shape counts rather than sampled-only coverage.
  Local scope complete September 15: 275,149 current eCFR members plus 9,003 annual members were hash-checked and
  classified. The baseline identifies 451 eCFR and six annual blocked table layouts, with bounded examples for repair.
  The single reader mismatch was isolated to preserved zero-width spacing in Part 774; see the
  [inventory evidence and repair order](passage-shape-inventory.md). Release-wide FR/history inventory remains open.
- [ ] **PASS-02 Support nested tables.** Preserve parent/child table order and source spans when deriving retrieval
  passages; define when nesting remains an indivisible unit. **Done:** source-reader reconstruction is exact and every
  eligible nested table fits token/input limits without dropping cells. Depends on PASS-01.
- [ ] **PASS-03 Support spanning data rows.** Carry row/column spans and applicable headers into passages without
  inventing repeated source content. **Done:** representative merged-cell fixtures preserve row meaning, stable IDs,
  exact reader/context offsets and full cell coverage. Depends on PASS-01.
- [ ] **PASS-04 Handle oversized identifying context.** Define deterministic continuations when labels or multiple
  identifying columns alone exceed the model input budget. **Done:** either supported source-backed segments cover
  the entire row or an explicit ineligible reason is emitted; no prefix truncation. Depends on PASS-01.
  Resolved plain/dotted ditto references now remain attached to every oversized-row fragment with their exact source
  spans and group labels. Missing references and context that exhausts the budget still fail; broad source qualification
  and other oversized identifying-context cases remain open.
- [ ] **PASS-05 Complete source-backed context checks.** Test multilevel headers, ditto markers, repeated captions,
  footnotes and appendix-wrapped tables across publisher formats. **Done:** context never crosses a table/section
  boundary without evidence; all substitutions point to original source spans. Depends on PASS-02–04.
  Blank publisher-row handling is implemented and checked against all 457 previously blocked retained blocks.
  The [preparation canary](passage-shape-inventory.md#ditto-scope-and-preparation-gates) prepares 445 of those blocks
  with both tokenizers; 12 fail actual preparation with unresolved ditto references. Historical structural diagnostics
  separately reported 138 header/caption-only blocks and 21 unresolved-ditto blocks. The 138 blocks now contribute 163
  atomic layouts, all at most 1,324 characters, and replay with zero blocked source blocks; visual graphics completeness
  remains a distinct review concern. An explicit full-width group label can retain an earlier same-column value; blank
  separators still clear context. Remaining concrete work is to complete the fresh full-corpus requalification and
  retain the exact Title 33 source-gap quarantine in its terminal audit.
  Dotted leaders now use the same exact-column references and unsafe-continuation rejection as plain ditto markers.
  The 457-block recheck still prepares 445 with both tokenizers; 14 CFR 171.311 block 65 gains correct source context.
  The terminal ten-diagnostic review has since resolved nine exact layouts. The remaining 33 CFR 110.214 defect is now
  represented by a provision-level source-review contract: its exact current eCFR table and annual CFR evidence preview
  as `quarantined_source_gap`, and passage preparation retains `source_review_quarantined` through retries. Applying the
  disposition awaits the current development schema; a fresh 49-title structural and tokenizer run remains required
  before closure.
- [ ] **PASS-06 Freeze the final passage manifest.** Bind owner/version, source membership, reader/input contracts,
  tokenizer, context hash, input hash and eligibility in deterministic per-partition manifests. **Done:** replay has
  identical IDs/hashes and changed context produces distinct preparation work. Depends on PASS-05.
- [ ] **PASS-07 Check both tokenizers at scale.** Run offline counts over the full selected manifest; summarize token
  distribution, maximum input, continuation counts and transport-size failures for both models. **Done:** no eligible
  input exceeds configured limits; failures identify exact versions without changing source text. Depends on PASS-06.
  `inspect:regulatory-shapes --prepare` now runs both pinned tokenizers over complete canonical versions with production
  context, per-model dispositions and independently recounted limits. Mode/tokenizer/context/implementation bindings
  protect report replay. `audit-regulatory-qualification` now requires the expected implementation hash and edition
  count, verifies the terminal inventory, exact selected/result identity, every per-edition report, retained NDJSON hash
  and record count, and aggregates per-model tokens, passages, limits, continuations and failure reasons. It reports
  tokenizer qualification separately from unresolved table-shape review. The prior 49-edition/275,149-record run is
  terminal and independently verified with zero tokenizer blockers for either model. Its historical 148 diagnostics
  have since narrowed to the explicitly quarantined Title 33 source rendition gap; a fresh full-corpus run under the
  atomic-layout implementation is required before PASS-06 freezes the final manifest.
- [ ] **PASS-08 Validate source reconstruction.** Independently compare reconstructed reader bodies and table cell
  coverage against retained source; review difficult real samples visually where text extraction loses layout meaning.
  **Done:** zero unexplained dropped/duplicated source spans in the advertised scope. Depends on PASS-05–07.
- [ ] **PASS-09 Prepare full selected partitions.** Run the deployed preparation worker on validated current/FR/history
  partitions using the selected passage contract. **Done:** expected version inventory equals completed or explicitly
  ineligible inventory; interrupted generations resume without provider calls. Depends on PASS-08, ORCH-06, ING partitions.
- [ ] **PASS-10 Publish preparation readiness.** Expose counts/reasons by corpus, year, title and format; link failures
  to operator repair records. **Done:** downstream lexical/vector manifests cannot silently omit a failed passage or
  reuse a different tokenizer/context generation. Depends on PASS-09.

Local PASS-09/10 implementation now persists deterministic preparation failures per version with a reason and timestamp.
The worker continues through later versions, reports `complete` and `blocked` counts, and ends in `blocked` when any
source failures remain after accounting for the full inventory. Index copying still requires `prepared`; blocked
records never become an accepted omission. Unknown errors, rights failures and lease loss remain retryable exceptions.
An explicit `retryBlocked: true` dispatch clears only failed checkpoints after acquiring the scope lease and checking
rights; successful generations are retained. Continuations set that flag to false to avoid repeatedly retrying source
failures. Operator presentation, deployed execution and full partition acceptance remain open.

The read-only `inspect:regulatory-readiness --preparation <id>` operator command now exposes bounded failed-version
pages and checkpoint accounting, including missing rows, leases and delayed retries, under current source rights.
This advances PASS-10 diagnosis; it does not replace source/target reconciliation, integrity verification, public
coverage reporting or whole-scope acknowledgement. A zero exit status certifies only the stored preparation counters.

Passage gate: reader text is lossless; model inputs are bounded and traceable; eligibility accounts for every selected
version. A passing sample is not permission to call a full corpus prepared.

## Indexing and query execution

W owns [INDEX-02/05/07–11/13–14 serving tasks](../../../legislation-web/docs/regulations/api-mcp-production-tasks.md#search-serving-tasks).
I owns copy, reconciliation and maintenance below. C owns the shared projection schema; task IDs retain their original meaning.

Extend `infra/passage-search/legal.sql`, canonical preparation/outbox storage, `passage-copy-*`, `passage-search.ts`
and `search-rights.ts`. Lexical generation, atomic copying and basic rights cleanup already exist.

Local INDEX-12 evidence: all 110 FR pilot scopes and 873 passages were copied and acknowledged in the separate
search database. Two collision-focused positive/negative canaries pass. This is version-scoped lexical evidence;
deployed full-partition execution, cross-corpus candidates and authenticated HTTP/MCP gates remain open.

The retained current-eCFR Title 3 partition now also has 33 persisted generations / 35 OpenAI-tokenized passages,
with exact offline-manifest parity, isolated copying, acknowledgement/replay and canonical/target query parity.
The application canary rejects unacknowledged, absent-identity and wrong-organization reads. See the progress ledger
for database identities and artifacts. This is one local edition, not full current-corpus or deployed HTTP/MCP acceptance.

Title 23 adds a local table-bearing partition: 1,237 generations / 1,918 passages with the same manifest, copy,
acknowledgement, replay and application-query parity checks. The pilot used sequential ten-record batches, not
deployed Trigger fan-out. Whole-scope acknowledgement passed for this size; INDEX-03 remains open for larger scopes.

The [cross-edition lexical canary](../../../legislation-web/docs/regulations/edition-search-canary.md) advances INDEX-02/06/07 for explicit federal code editions.
It validates acknowledgements, generation metadata signatures, membership/count parity and canonical hits before
returning globally ranked unique versions. A retained two-title query and six real fault injections pass locally.
Publication/default-current selection, public search DTO/route/MCP, frozen paging, full-body reconciliation and
representative-volume plans remain open; these tasks are not closed by the application canary.

- [ ] **INDEX-01 Design cross-version filter projections.** Add source/rights, jurisdiction, corpus, code, agency,
  publication kind/date and selected edition fields needed before ranking; document which remain canonically hydrated.
  **Done:** projections are derived from explicit memberships and cannot mix metadata from another observation/version.
- [ ] **INDEX-03 Make whole-copy acknowledgement resumable.** Replace the current single 60-second full-scope inspection
  limit with durable, bounded validation checkpoints tied to immutable inventory/generation/rights evidence. **Done:**
  changed source, membership, target content or rights invalidates the receipt; only a fully revalidated scope can
  acknowledge. Preserve target-commit-before-source-ack recovery. Depends on PASS-06.
  Completeness prerequisite: inspection and acknowledgement now reject a target scope whose membership count differs
  from the canonical inventory, in addition to validating every expected generation/passage. A real PostgreSQL
  regression injects 30 extra memberships and verifies both paths reject them before rights cleanup. Durable bounded
  pages and explicit finalization now validate saved revision-bound checkpoints without rereading passage bodies.
  Serving-time receipt revision binding and retained Title 3/23 pilot renewal are verified locally; deployed verification and
  national-scale finalization/serving measurements remain outstanding. Both the
  diagnostic whole-copy operation and finalizer retain a 60-second deadline. See
  [checkpoint boundaries](copy-validation-checkpoints.md).
  Local timing exposed an actual deadline failure on the indexed pilot. Metadata and membership validation now use
  two locked target queries per 25-generation batch rather than two per generation, preserving exact equality and
  completeness checks. The subsequent read-only pilot inspected Title 3 in 0.77 seconds and Title 23 (1,237
  generations/1,918 passages) in 44.95 seconds. Evidence: `artifacts/regulatory-backfills/copy-inspection-timing.json`.
  Workstation load differs between runs; this is not a controlled speedup claim. Resumable validation remains required.
  Mutation counters now exist in both original schemas, with PostgreSQL checks for changes, rollback,
  deletion/recreation and truncation. Bounded pages now save revision/hash checkpoints without acknowledging a scope.
  Finalization and serving invalidation are not yet connected.
  See [checkpoint boundaries](copy-validation-checkpoints.md).
- [ ] **INDEX-04 Wire correction and removal propagation.** Emit/replay target updates for changed versions, membership
  removal and current-head replacement; distinguish removal from revocation and historical retention. **Done:** stale
  current hits disappear while allowed historical citations remain available. Depends on ING-11, INDEX-01.
- [ ] **INDEX-06 Add reconciliation and repair inspection.** Report source/target counts, hashes, selected receipts,
  missing generations, delayed jobs and oldest pending age per partition. **Done:** deliberately corrupt or omit a row
  and the inspector fails without authorizing serving; targeted recopy restores readiness. Depends on INDEX-03–05.
  Local progress: a read-only per-preparation inspector now reconciles canonical preparation/outbox state with target
  memberships, bounded-validation checkpoints, the exact scope receipt and current source/target revision fences. It
  rejects incomplete copy, missing acknowledgement, stale revisions and revoked rights. Partition aggregation, oldest
  pending age, targeted repair and deliberately corrupted deployed acceptance remain open.
- [ ] **INDEX-12 Copy and acknowledge full lexical partitions.** Run the existing copy worker followed by INDEX-03's
  verifier; retain inventory/hash receipts. **Done:** every PASS-10 eligible generation is acknowledged or has an
  explicit blocking disposition; copy traversal exhaustion alone cannot pass. Depends on PASS-09–10, INDEX-03/06.

## Model evaluation

Extend `embedding-smoke.ts`, `embedding-judgments.ts`, the diagnostic cache and existing smoke scripts.
`embedding-reviewed-scores.ts` now scores complete bound top-25 review packets via
`pnpm tool regulations/score-regulatory-judgments --manifest <file> --systems <file> --review <file> --output <new-file>`.
It supports grades 0–3 and excludes no-answer cases from quality averages. Automated reviewer declarations do not
close EVAL-04 or authorize model selection; full frozen-protocol enforcement remains outstanding. The current
Voyage lead is provisional. The selected route must be justified on final prepared passages, not old excerpt scores.

The comparison helper now preflights all document batches and all queries through both pinned tokenizers before any
cache write or provider request. Its `qualification` evidence includes per-model tokenizer IDs and per-input IDs,
version IDs for documents, SHA-256 hashes and local token counts. Counts are local qualification evidence, not billed
provider usage. Malformed Unicode and a later over-budget input reject the whole diagnostic before early batches can
be sent. This does not establish source provenance, passage eligibility, reviewed judgments or model selection.

- [x] **EVAL-01 Freeze the evaluation protocol before scoring.** Record cohorts, train/development/held-out separation,
  retrieval metrics, acceptable regressions, cost/latency ceilings and selection rule from the search specification.
  **Done:** the retained protocol hash predates new scoring and explains how ties and sparse cohorts are handled.
  Frozen September 16, 2026: [protocol and interpretation](embedding-evaluation-protocol.md), with machine-readable
  cohort allocations, quality/latency/cost limits, exposure exclusions and promotion gates. Corpus assignments and
  reviewed scoring are not complete; the CLI must bind the protocol before any run claims compliance.
- [ ] **EVAL-02 Build final-passage evaluation corpora.** Select current eCFR, proposals/final rules/notices, annual
  history and difficult tables from PASS-06; include near-identical versions and agency/jurisdiction confounders.
  **Done:** exact source/version/input manifests are frozen and cohort membership is reviewable. Depends on PASS-06, EVAL-01.
  Full-title qualification identified a tokenizer-dependent eligibility case in 40 CFR 81.324, version
  `4665d270-022a-489d-876a-70c3e9e480a7`. The partial-county source-scope repair now qualifies both models in the
  canonical recheck: OpenAI 35 passages, Voyage 71. Freeze common boundaries before including this version in a
  comparison; whole-version eligibility alone does not establish identical model inputs or comparative quality.
  `pnpm tool regulations/prepare-common-regulatory-passages --input <whole-version-json> --output <new-file>` now
  qualifies the entire supplied version separately for both pinned tokenizers, then splits once using the greater
  token count for every candidate input. The output retains one shared passage/input manifest, distinct per-model
  counts and individual qualification evidence. A blocked version cannot be silently subsetted. The retained
  canonical 40 CFR 81.324 smoke produced 71 shared passages; actual multi-cohort corpus selection remains open.
  The CLI consumes supplied source JSON and does not independently authenticate its source; canonical export
  provenance must accompany the frozen evaluation manifest.
  `pnpm tool regulations/export-evaluation-code --edition <uuid> --version <uuid> --content-hash <sha256>
  --output <new-file>` now prepares common inputs directly from a published canonical eCFR or annual-CFR membership
  in the explicit local `REGULATORY_TEST_DATABASE_URL`. One read-only statement binds source text, membership and active
  rights. The exporter recomputes the canonical content hash, checks display/search/embedding/export permissions and
  rights hash, enforces source-byte/context/passage bounds, then qualifies the whole version for both tokenizers.
  It writes an exclusive snapshot packet containing source dates/locator, generation/rights/context hashes and complete
  common passages. This verifies the database snapshot, not publisher artifact replay, cohort assignment or human review.
  A real canonical pesticide-section export produced 52 shared passages; incorrect edition membership rejected before
  output creation. Final multi-cohort selection and review remain open.
  `pnpm tool regulations/export-evaluation-publication --observation <uuid> --version <uuid>
  --content-hash <sha256> --output <new-file>` provides the publication counterpart. It verifies published batch and
  observation/version/document membership, active rights and a registered supporting PDF in one read-only statement.
  XML-derived and preformatted-HTML records use their actual original content-hash rules. Source-reviewed metadata is
  preserved with its own hash, not promoted to reviewed family assignment. The complete version must qualify for both
  tokenizers before exclusive output creation. A canonical notice produced one common passage; an invalid observation
  rejected before output creation. Publisher bytes, family/cohort review and final corpus assembly remain separate gates.
  Annual Title 6 for 2023/2024 is now retained and locally published after source/date/complete-volume checks
  (658/659 memberships). This supplies an unexcluded historical family for held-out candidate selection, without
  inspecting its passage text during acquisition. It still needs whole-version qualification and an explicit split
  assignment before becoming evaluation evidence. Retained evidence is recorded in the implementation ledger.
  Whole-edition qualification has since completed: all 1,317 Title 6 memberships pass both tokenizers with no
  blockers, including six empty structural records. Common-boundary passage selection and final split/query
  assignment are still open. The terminal manifest is `annual-title6-preparation/inventory.json`.
  `pnpm tool regulations/group-evaluation-publications --input <publication-json> --output <new-file>` groups
  candidate publication families using transitive source identifiers and correction links. The retained 110-version
  inventory yields 104 candidate groups, 51 with warnings. This is conservative evaluation coassignment evidence,
  not canonical rulemaking resolution or reviewed independence; unidentified families still require review.
  Input must include canonical `documentId` as well as `versionId`. The current canonical family packet preserves
  the distinct publications sharing printed `00-113` and explicitly flags that collision. Source-reviewed field
  subsets do not inherit unapproved identifiers from their original API candidates. Use
  `publication-family-canonical-review.json` for current review; the preceding packet is historical.
  The diagnostic accepts `--assignments <file>` to validate a full 60-query assignment manifest before filtering a
  requested split or opening live output. Assignments bind the frozen protocol hash and normalized input manifest,
  all record/query identities, 30/30 cohort allocations, code-title/publication families, source/generation hashes,
  declared near-duplicate groups and additional exposed families. Cross-split families, versions, exact input/source
  hashes and declared near-duplicates are rejected, as are exposed held-out families and answers outside their split.
  Query split labels in the CLI manifest must match assignments. These are declaration checks only: source hashes,
  cohort semantics, near-duplicate discovery and whole-version dual-tokenizer qualification still require canonical
  verification. Synthetic allocation smoke evidence does not close EVAL-02 or EVAL-03.
- [ ] **EVAL-03 Expand queries and hard negatives.** Extend existing 60-query packets with historical date selection,
  proposed-versus-current obligations, exception clauses, numerical tables and no-answer cases. **Done:** held-out
  titles/queries remain separate from development tuning and every expected answer cites source text. Depends on EVAL-02.
  The diagnostic now accepts explicit no-answer queries (`answerability: "no_answer"`, empty `relevantIds`). Empty
  labels without that declaration, or no-answer declarations with relevant IDs, fail before provider access. Rankings
  remain available for blind review, while recall/nDCG metrics are null and no abstention success is inferred. Final
  source-backed query construction, review and abstention evaluation are still required.
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

- [x] **VECTOR-01 Add regulatory vector schema.** Store passage/input hash, model, dimensions, contract, generation,
  owner/version and readiness with FK/uniqueness constraints and rights ownership. **Done:** wrong dimensions,
  mismatched owners and duplicate logical vectors fail at validation/storage boundaries; disposable DB migration passes.
  Implemented in the isolated passage-search schema with separate 1,536-dimension OpenAI Small and 1,024-dimension
  Voyage 4 tables. Immutable generation registration binds copied passage inventory, route, input contract and manifest;
  exact replay and completion checks reject changed vectors, input hashes, model routes and partial counts. Search-ready
  promotion and HNSW indexes remain VECTOR-10/11 work.
- [x] **VECTOR-02 Add the regulatory route and manifest.** Resolve server-configured candidate/selected routes without
  accepting caller model names; bind vector jobs to frozen passage inventory. **Done:** default existing product routes
  and freshness hashes are unchanged; candidate pilot and production generation are distinct. Depends on VECTOR-01, PASS-06.
  Both candidates now have explicit regulatory input contracts and isolated storage tables. Trusted configuration may
  select only those routes; no configured selection leaves semantic serving disabled. Immutable vector generations bind
  route, copied passage generation, input contract, manifest and expected count.
- [x] **VECTOR-03 Implement token-aware shard selection.** Reuse shared token validation and client limits; select
  deterministic bounded batches by token and item budgets with stable shard keys. **Done:** oversize input is ineligible
  with evidence, never silently shortened; replay selects the same exact inputs. Depends on VECTOR-02.
  Selection fixes every generation to 16 SHA-256 passage-ID shards and caps a read at 512 candidates, 64 provider inputs
  and 1 MiB. It excludes stored vectors, rehashes input text, verifies the persisted count with the pinned tokenizer and
  returns a stable shard key plus keyset cursor. The integration smoke proves shard isolation and completed-row exclusion.
- [x] **VECTOR-04 Persist exact paired outputs.** Validate returned indices, count, model, finite dimensions and input
  hash before transactional storage/checkpoint. **Done:** reordered valid responses pair correctly; duplicate/missing/
  corrupt responses cannot acknowledge a batch. Depends on VECTOR-03.
  The shared client validates and orders provider indices, count, model and dimensions. Route-specific storage then
  validates finite nonzero vectors, exact passage/input hashes and an immutable vector hash. Exact replay succeeds;
  changed vectors, input hashes, model routes and partial-generation completion fail in the PostgreSQL smoke.
- [ ] **VECTOR-05 Implement retries and reuse.** Reuse permitted identical inputs, preserve multiple owner memberships,
  and recover provider success followed by persistence failure without losing provenance. **Done:** accounting separates
  cache hits, possible repeated paid attempts and new writes; incomplete shards remain pending. Depends on VECTOR-04.
  Durable 16-shard rows now retain a fenced lease, keyset cursor, attempts, possible repeated paid attempts, provider
  tokens and inserted/reused counts. A killed or failed request releases for retry without claiming success; stored
  vectors disappear from the next selection. An explicit Trigger task fans out exactly 16 globally idempotent children;
  each four-worker-queue run processes one bounded page and submits one continuation from the durable cursor. Trusted
  server configuration must match the registered model before provider access. Cross-generation input reuse and
  multi-owner reuse accounting remain open.
- [ ] **VECTOR-06 Fence stale input and revoked rights.** Recheck selected input/route/rights before writes and serving;
  invalidate stale jobs, vector memberships and caches through the correction path. **Done:** a source change or rights
  revocation during provider execution cannot promote stale/forbidden vectors. Depends on VECTOR-04, INDEX-04–05.
  Rights fencing is implemented for registration, batch writes and completion using the copied generation lock and a
  nonrevoked search membership. Rights cleanup cascades the route-specific vectors and generation. Correction/removal
  propagation and serving-time semantic selection remain open under INDEX-04/05 and VECTOR-11.
- [ ] **VECTOR-07 Run the durable pilot.** Exercise malformed response, provider 429/outage, killed worker, lost lease,
  source correction and target write failure on a bounded persisted corpus. **Done:** exact vector inventory recovers
  with no falsely complete shards; pilot is queryable for EVAL-11. Depends on VECTOR-05–06, ORCH-08–10.
  Local two-database evidence now covers a wrong provider model, target write failure, conservative retry-cost
  accounting, synthetic HTTP 429 and repeated HTTP 503 failures through the shared client, exact replay,
  incomplete-shard completion rejection, empty-shard completion and rights-revocation cleanup.
  Focused Trigger tests additionally cover bounded fan-out, global dispatch replay keys, checkpoint continuation and
  finalization by the last shard. Deployed Trigger recovery and authenticated queryability remain open.
- [ ] **VECTOR-08 Plan full manifest cost and dispatch.** Freeze eligible partitions, expected vectors/tokens, reuse,
  budget stop conditions and chosen route. **Done:** plan excludes old embedding rebuilds and unqualified historical
  cohorts; operator preview accounts for every selected passage. Depends on EVAL-12, PASS-10.
  A read-only generation inspector now reports the bound passage/manifest/route identity, expected vectors, pinned
  tokenizer tokens, input bytes, raw stored vector bytes, active rights, shard state, provider usage, retry exposure and
  separate dispatchable/completable/embedded/ready gates. It does not price, initialize, dispatch, complete or promote a
  generation. Full selected-scope manifest, measured reuse and budget stop conditions remain open.
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
