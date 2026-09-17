# Regulatory indexing, embeddings and retrieval

Proposed implementation, September 14, 2026. Parent: [implementation](implementation.md).
Build on existing Rostra search infrastructure; regulatory retrieval is a new product with its own quality gate.

## Existing components and intended extension

| Existing component | Regulatory extension |
| --- | --- |
| `src/models/embedding-routing.ts` | Add explicit `legal-passage` route and regulatory query route |
| `src/ingestion/embeddings/jobs.ts` | Reuse freshness/input-hash/client patterns in a legal-passage job |
| `src/models/openrouter-embeddings.ts` | Reuse exact-input submission, dimension validation, character guard and retry metrics |
| `src/search/passage-search-queue.ts` and replication/readiness modules | Add regulatory outbox/projection consumers with distinct entity kinds |
| `infra/passage-search/schema.sql` | Add separate legal-passage projection in isolated search DB |
| `src/evaluation/embedding.ts` and embedding canary scripts | Extend with regulatory fixtures/judgments and historical/version cases |

Current bill documents and their sections have bill-specific relationships. Do not insert regulations into those tables
to reuse a worker. Add `legal_passages` and route-aware jobs while sharing safe common functions. Existing embedding
routes differ by product: OpenAI Small/1,536 dimensions for document passages and Voyage 4/1,024 for bills/supporting
materials. Those evaluated legislative results do not establish the best regulatory model.

The shared client now rejects oversized inputs and never shortens text on provider retries. Existing pipelines use
character-capped excerpts, now checked with the shared model tokenizer before submission. Token-aware, lossless prose
preparation is shared in `src/models/embedding-preparation.ts`; it is not a replacement embedding provider. Pinned
tokenizers are implemented for both existing models. All existing embedding
regeneration is deferred by user direction; see the [integrity repair and rebuild plan](../engineering/embedding-rollout-plan.md#input-integrity-repair-and-deferred-rebuild-september-15-2026).

Canonical PostgreSQL remains authoritative. The isolated passage-search service is a reconstructible text projection;
vectors stay in canonical dedicated embedding tables. Its bill passage cutover has a separate readiness gate: inspect
current status at implementation, do not treat a valid target index as completed copy. This spec does not approve
replacing the canonical PostgreSQL image, rebuilding existing vectors or bypassing bill search readiness.

## Passage generation

The initial pure builder is `src/ingestion/regulations/passages.ts`. It validates reader body/generation hashes and
contiguous UTF-16 offsets, binds passage IDs to exact version/context/tokenizer/budgets, counts the complete prefixed
input, and emits reader-block spans. Tokenization is injected with an explicit versioned ID; there is no default
character estimate or selected model. Callers can obtain the real counter from `embeddingTokenizer(model)`.
Tokenization windows use the shared splitter and fit the 16,000-character transport limit including context, with newline preference
and surrogate-safe splits. Chunks use no overlap in this foundation. They may be smaller than the 800-token target;
benchmark chunk packing before selecting the embedding generation.

Tables fitting the 1,200-token hard limit and 16,000-character transport limit stay intact, including reader-split table
blocks with the same source ordinal. Larger blocks require their retained source XML through `sourceBlocks`.
`table-passages.ts` checks exact parser-rendered text equality and separates actual tables from surrounding prose and
other tables inside an appendix wrapper. It maps explicit source rows and repeats the complete caption/column-header
region, including multilevel headers. Headerless tables receive no invented headings. Consecutive row groups use
exponential size probes to avoid tokenizing every growing prefix. A row may exceed the target, but never the hard limit.
Each passage has an exact full-input hash, contiguous `readerSpans` for its original text, and separate `contextSpans`
for repeated headers. Joining original passage text reproduces the body without duplicated headers or missing text.
An individually oversized row may use explicit continuations. Source XML identifies the longest cell and the other
columns. The row text is split while every other column value, the complete column headings, and the nearest explicit spanning group label are
retained as context. The continuation metadata identifies the complete original row and long column. Exact primary
text spans still cover the original row without gaps; context spans identify repeated source evidence separately from
the generated column labels. The shared splitter counts the complete input including all repeated context.
Nested tables, data cells spanning multiple rows, interleaved header groups, ambiguous spanning continuation cells,
unresolved ditto references within a continuation, and identifying context that itself exceeds the target remain explicit
failures for review; no partial generation is returned. Ordinary row groups now retain the nearest explicit spanning
group label and resolve `Do.`, `ditto`, and `〃` to the prior nonempty single-column source cell. Chains preserve the
original referenced cell; group changes, missing columns, empty cells and ambiguous spanning cells prevent stale
reference reuse. Packing stops when required context changes. Resolved values are repeated with labeled source spans,
never substituted into the original reader text. An unresolved reference fails explicitly. Broader table semantics and
full-corpus acceptance remain separate gates. Empty source text is explicitly ineligible. This pure function does not
authorize source rights, persist passages, consume outbox jobs, or mark anything searchable; those remain worker gates.

One provision version may have several passages, but one hit always names its provision and exact text version. A
publication passage names its document version and distinguishes preamble, proposed/amendatory text, table and appendix.
Never merge text across versions, jurisdictions or publication kinds to fill a chunk.

Initial chunk contract `legal-passage-context-text`: jurisdiction/code name, display citation, hierarchy headings,
publication kind when applicable, local heading and bounded source text. Dates, agency IDs, source rights and status
are filters/metadata, not repeated prose padding. Do not embed AI summaries instead of primary text. Normalize whitespace
without changing legal symbols, enumerated paragraphs, table relationships or source references.

Target 800 tokens, hard limit 1,200 tokens per passage under the selected model tokenizer, with up to 100 tokens of
boundary context. Prefer paragraph/subsection boundaries. An oversized table splits by row groups with repeated headers
and preserved row locators; an oversized row uses the bounded continuation contract above, and an oversized paragraph
splits with exact offsets. Do not silently truncate long text.
Retain ordinal, XML path/page coordinates where known, plain-text offsets, source content hash and parser/chunk contract.
Map each retrieval passage to the stable source-reader block/offset in its exact version. Search results carry the
selected edition/source observation and authorized `/api/legal/versions/{versionId}/text` link/anchor. Reader output
never repeats embedding context or overlap, and a text version reused in another edition keeps that edition context separate.
Text-free structural nodes and explicitly empty/repealed placeholders remain browseable but have an explicit embedding
ineligibility reason. Preserve substantive repeal/adoption text as eligible content.

## Lexical indexes and projection

Implemented foundation: `passage-storage.ts` atomically stores immutable canonical passage generations for provision
and publication versions, including the preparation input hashes and exact reader/context spans. The baseline has a
generated English FTS column and GIN index. Its internal lexical canary is bounded to an explicitly authorized published
source/version and exact generation, with current display/local-search rights rechecked on every call. See
[storage validation](storage-validation.md#persistent-passage-generations-and-lexical-canary) for real PostgreSQL and
retained-source evidence. Isolated copying, whole-scope inspection/acknowledgement, current-provision selection and
rights cleanup now exist as local services. Broader ranking, resumable large-scope validation, deployment and public
HTTP/MCP remain open; preparation or copy traversal alone does not acknowledge indexing work.

Use [C's lexical projection identity/schema](../../../../packages/legislation-core/docs/engineering/search-projections.md#legal-lexical-and-vector-identity).
W owns ranking and exact-citation semantics; I validates target compatibility before copying or index builds.

Canonical publish writes a transactional outbox item. A projection worker claims a bounded window, copies the requested
generation, validates count/hash manifests and atomically marks that generation searchable. Acknowledgement follows the
target commit; crash/retry is idempotent. Update/restrict/delete operations must remove obsolete search visibility as
well as adding new text. A tombstone cannot be lost merely because its text was removed first. Old backfills cannot
overwrite newer generations, including on delayed retries.

Hydrate ranked candidates through canonical version and rights checks before returning them. A stale index is never an
authority for permissions or exact text. If candidates reference a generation no longer selectable, suppress them and
record lag; do not silently relabel old text as current. Cache keys bind authenticated access/rights, normalized query,
filters, search generation and model contract; restriction changes invalidate caches.

Backfill by deterministic owner-ID shards and keyset pagination; reconcile committed source work and exact selected
generation receipts. Do not use an allocated sequence number as a commit-order watermark. Readiness compares all requested
owner/version counts and hashes, including delayed retries. Keep source/target transactions separate and preserve
target-commit/source-ack recovery under the [storage handoff](storage-validation.md#scope-publication-current-reads-and-revocation).

## Embedding job and model decision

Initial canary candidate is `openai/text-embedding-3-small` at 1,536 dimensions, matching existing passage infrastructure.
Compare with the already available Voyage 4 route on the same regulatory judgments before selecting bulk production.
The implementation choice is explicit: one selected regulatory embedding route per active generation, never mixing
different model spaces. No new vendor is required for the canary.

### Mandatory model smoke test and comparative evaluation

Model selection is a release gate before bulk embedding expenditure. Implement
`tools/regulations/smoke-regulatory-embeddings.ts` using the existing embedding/evaluation clients. Its live mode reads a fixed
bounded manifest and records provider/model, dimensions, input types, actual inputs' hashes, token usage, cost, latency
and vector counts. Verify correct dimensions/finite values, query/document pairing, long-input splitting, repeated-input
reuse and retrieval of the expected exact passage/version. Include an intentionally wrong model/dimension response in
fixture mode and verify rejection. Do not mistake a successful embeddings HTTP response for successful retrieval.

Compare at least the two already configured providers: OpenAI Small/1,536 and Voyage 4/1,024, with correct provider-specific
document/query input modes. Use identical source corpus, eligibility, chunk boundaries and query/filter sets. Keep each
model's vectors isolated by route/generation. Evaluate lexical baseline, each model's semantic mode, hybrid fusion and
the existing reranker on/off; record the effect of reranking separately from the embedding model. Exact citation lookup
is measured separately and cannot inflate the topical embedding score.

Use the frozen 60-query minimum described below, stratified into development and held-out sets before tuning. Expand
the corpus with relevant competing provisions and hard negatives: similar terms in another jurisdiction/title, a
superseded version, a proposal instead of a final rule and boilerplate that matches the query without answering it.
Pool candidates across compared systems for source-backed human relevance grading. Preserve query/judgment manifests;
do not change held-out labels to favor the current winner. Repeat the final candidate on the unchanged held-out set and
run one deployed API/MCP canary against the same passage/version IDs.

The model report includes per-query/subgroup Recall@25, nDCG@10, wrong-version/filter errors, p50/p95 query latency,
indexing throughput, cost per 1,000 indexed passages and cost per query. Select the best measured held-out retrieval
quality among configurations that pass correctness/latency gates. Treat nDCG differences below 0.01 as a practical tie
unless repeated evidence establishes otherwise; within a tie prefer lower recurring cost, then lower latency. Document
the tradeoff when one configuration improves recall but loses ranking quality. If neither candidate passes, improve
parsing/chunking/judgments or evaluate another explicitly selected model; do not start the full semantic rollout.

The gate means best among tested configurations for this regulatory benchmark, not universally best. Changing model,
dimensions, input contract, chunking or a materially different state corpus requires a new bounded comparison and API/MCP
smoke before promotion. Reusing a previous success report with changed inputs is insufficient.

### Local comparison evidence, September 15

The executable diagnostic is `tools/regulations/smoke-regulatory-embeddings.ts` (`smoke:regulatory-embeddings`). It previews by
default; `--live` explicitly runs both existing models. It accepts a frozen manifest, an optional development/held-out
split, and an exclusive output path. Inputs are bounded to 512 records and 64 queries, submitted in batches of at most
64 without shortening retries. The shared embedding client now rejects duplicate, skipped and out-of-range response
indices, preventing vectors from being assigned to the wrong inputs despite matching response counts/dimensions.

For a query known to have no answer in the selected corpus, set `answerability: "no_answer"` and `relevantIds: []`.
An empty list without explicit intent, or a no-answer declaration containing relevant IDs, is rejected before provider
access. Both the smoke CLI and blind-review pool preserve these cases. The report retains their complete rankings
with `metrics: null`; recall/nDCG are undefined without relevant documents and must not enter answerable-query means.
The runner reports `noAnswerEvaluationComplete: false`: producing ranked candidates does not establish successful
abstention, a calibrated threshold or a reviewed no-answer label. Those remain separate benchmark gates.

The retained local benchmark has 350 exact-version source excerpts from 12 eCFR parts and 60 source-backed,
agent-authored queries. Six titles form the 30-query development split; six different titles form the 30-query held-out
split. The split and single-known-answer labels were frozen before execution. Competing provisions are present, but
these are bounded leading excerpts, not production tokenized passages. This is a diagnostic with provisional labels,
not the complete stratified production benchmark or human relevance review required above.

| Configuration | Held-out Recall@5 | Held-out nDCG@10 |
| --- | ---: | ---: |
| PostgreSQL English OR/`ts_rank_cd` baseline | 0.467 | 0.402 |
| OpenAI Small | 0.933 | 0.857 |
| Voyage 4 | 1.000 | 0.959 |
| OpenAI Small + Cohere rerank | 0.967 | 0.965 |
| Voyage 4 + Cohere rerank | 0.967 | 0.965 |

Read exact values from `regulatory-comparison-corrected-results.json` and `regulatory-comparison-rerank-results.json`.
The unchanged held-out embedding repeat preserved the displayed recall/nDCG results. Both semantic models achieved
Recall@25=1. RRF with this lexical baseline reduced ranking quality; this is not a benchmark of the intended BM25
projection. The initial lexical script incorrectly escaped a whitespace regex; its original result is invalid. The
corrected scorer uses a POSIX whitespace class and retained semantic results without another embedding request.

The 120 sequential Cohere calls reranked each model's top 25 using explicit 4,000-character candidate excerpts,
matching the existing route limit. Held-out reranker p50/p95 were approximately 296/774 ms for OpenAI candidates and
267/340 ms for Voyage candidates. These measure additional reranker request latency, not complete query latency; run
order/network conditions prevent treating their difference as a model latency advantage.

Disagreement review found incomplete labels: 40 CFR 60.1040 also answers the municipal-waste preconstruction question
whose known answer was 60.1005. Credit-balance questions also need explicit open/closed-end scope. Frozen labels were
not changed after evaluation. Pool and grade these alternatives before selecting a winner. Voyage without reranking is
the provisional quality lead; reranking ties the two models in aggregate but moves the expected 45 CFR 164.106 result
to rank 8. Do not promote any configuration from these scores alone.

Initial embedding usage was 186,721 tokens for OpenAI and 198,033 for Voyage. At the September 15
[OpenRouter catalog prices](https://openrouter.ai/api/v1/embeddings/models), estimates are $0.00373 and $0.01188
respectively for that embedding run. These are token-price estimates, not billed totals, and exclude reranking,
repeats, storage and serving. Per-query serving cost and production passage costs remain unmeasured.

Evidence under `artifacts/regulatory-backfills/`: `regulatory-comparison-corpus.json`,
`regulatory-comparison-manifest.json`, `regulatory-comparison-semantic.json`,
`regulatory-comparison-corrected-results.json`, `regulatory-comparison-rerank-journal.jsonl`,
`regulatory-comparison-rerank-results.json`, `regulatory-comparison-heldout-repeat.json`,
`regulatory-embedding-prices.json`. No production routes or stored canonical vectors changed. Production reuse integration,
historical/state/proposal cohorts, exhaustive human judgments, tokenizer/chunking and API/MCP canaries remain open.

The local smoke command now accepts `--cache <directory>` for persistent diagnostic reuse. Immutable entries bind exact
input, model, dimensions, dimensions parameter, input contract and query/document mode. It deduplicates identical inputs
within a request, preserves output order and counts cache hits separately from newly billed token usage. Before reuse,
entries must have the expected key, matching vector checksum, and finite, nonzero vectors of the expected dimension. Corrupt entries stop the run
instead of silently calling a paid provider. A mismatched provider model cannot populate the cache. Entries are retained
with exclusive atomic links; concurrent conflicting content is rejected. This filesystem cache is not a rights-aware
production embedding store and does not replace the canonical worker/storage design below.

Live reuse smoke: 12 retained source excerpts and 12 queries filled both model caches. A second run used a fetch function
that always throws, yet reproduced every ranking exactly from 24 cache hits per model: zero requests, batches or new
tokens. Evidence: `regulatory-cache-smoke-manifest.json`, `regulatory-cache-checksummed-fill.json`,
`regulatory-cache-checksummed-replay.json` and `regulatory-embedding-cache-checksummed/` under the backfill artifact directory.
Earlier cache-fill/replay artifacts predate vector checksums and remain historical evidence only.

`pool:regulatory-judgments` creates a blind relevance-review packet from a frozen manifest and complete system rankings.
It pools the first ten candidates per system plus known answers missed by those systems, removes duplicate candidates,
and orders evidence deterministically without exposing system names, ranks or existing relevance labels in the query
view. Each candidate retains its exact version ID, input hash and source excerpt, with blank grade/rationale/reviewer
fields. The scale is 0 (does not answer), 1 (context), 2 (partial), 3 (direct answer). It rejects incomplete query coverage,
unknown/duplicate ranked IDs, duplicate systems and excessive evidence size. It does not submit or approve judgments.
The local packet `regulatory-judgment-review.json` has 60 questions and 1,315 candidate excerpts across seven compared
configurations; `regulatory-review-systems.json` retains its system inputs. No external model requests were needed.

```powershell
pnpm tool regulations/pool-regulatory-judgments --manifest artifacts/regulatory-backfills/regulatory-comparison-manifest.json --systems artifacts/regulatory-backfills/regulatory-review-systems.json --output artifacts/regulatory-backfills/fresh-review.json
```

```powershell
pnpm tool regulations/smoke-regulatory-embeddings --manifest artifacts/regulatory-backfills/regulatory-comparison-manifest.json --split held-out --output artifacts/regulatory-backfills/fresh-heldout-output.json --live
```

### Vector storage and index build

Use [C's model/dimension/input identity](../../../../packages/legislation-core/docs/engineering/search-projections.md#legal-lexical-and-vector-identity).
Canary candidates remain in separate dimension-constrained staging tables, not the active serving generation.

Implemented foundation: the isolated passage-search schema now has one immutable embedding-generation registry plus
separate OpenAI Small (1,536 dimensions) and Voyage 4 (1,024 dimensions) vector tables. Composite foreign keys bind each
row to the exact copied passage generation, passage ID, model and dimensions. `vector-storage.ts` additionally verifies
the passage input hash, finite nonzero vector, immutable vector hash and complete expected count. The `embedded` state
means storage is complete; it does not imply index validity or serving promotion.

Regulatory candidate routes now own that exact storage identity instead of borrowing another product's route. No model
is selected by default. `vector-shards.ts` uses 16 stable SHA-256 passage-ID shards, keyset cursors and strict scan/item/
byte ceilings. It excludes already stored vectors and independently verifies source input hashes and pinned-tokenizer
counts before a provider batch can be formed.

`regulatory-embedding-dispatch` is the explicit operator entry point for one already registered generation. It creates
the fixed durable shard inventory before submitting 16 globally idempotent children and has no schedule. Each
`regulatory-embedding-shard` run claims one five-minute fenced lease, submits at most one bounded provider batch,
persists its cursor and counters, then creates one continuation only when that shard remains pending. The queue admits
at most four workers. `REGULATORY_EMBEDDING_MODEL` is trusted server configuration and must match the generation before
provider access; no payload may choose a model. The last shard to observe all 16 completed checkpoints runs the exact
vector-count completion gate. Deployment and a bounded paid pilot remain separate acceptance steps.

Before or during a wave, `pnpm tool regulations/inspect-regulatory-vectors --generation <sha256>` reads the isolated
search database in a repeatable-read, read-only transaction. The report binds the generation, passage generation,
route, input contract and manifest; reconciles expected/copied/vector counts; sums expected tokenizer tokens and input
bytes; and exposes rights, shard, lease, attempt, provider-token and reuse counters. Optional `--output <new-file>` uses
exclusive creation for retained evidence. Its gates distinguish permission to dispatch, exact completion eligibility,
stored completion and later serving readiness. Inspection never performs those transitions.

`pnpm tool regulations/plan-regulatory-vectors --generation <passage-generation-sha256> --output <new-file>` creates the
pre-dispatch plan for the trusted `REGULATORY_EMBEDDING_MODEL`. It reads every copied passage in a repeatable-read,
read-only transaction, recomputes input hashes and pinned tokenizer counts, then binds their inventory hash to the
source passage manifest/metadata, route, dimensions, input contract, totals and 16-shard layout. The plan is self-hashed
and written with exclusive creation. Planning does not register or dispatch work. Atomic registration uses
`pnpm tool regulations/register-regulatory-vector-plan --input <plan-file> --apply`: it requires the same trusted model,
rebuilds the complete plan and invokes canonical registration inside one serializable transaction while holding the
passage-generation advisory lock. Changed plans roll back. Registration still does not initialize shards or dispatch
provider work.

Create a unique input identity index and a passage-ID lookup index. Build the new feature's HNSW index after its initial
bounded load, measure build RSS/time/disk and run ANALYZE before query-plan/recall acceptance. Use the existing index
maintenance mechanism for an online build when the table already serves traffic; respect PostgreSQL's nontransactional
concurrent-build requirements and detect invalid/interrupted indexes explicitly. Do not rebuild existing bill indexes.
Record HNSW build/search parameters in the generation manifest, begin with the installed extension defaults and tune
only against exact filtered-neighbor recall and latency. A valid index without complete eligible vectors is not ready.

Cross-generation reuse uses the complete model, dimensions, input-contract and input-hash identity. It copies only from
completed vector generations whose passage owner still has active search rights, while retaining a separate row for the
new owner. Source and target passage generations are locked against rights cleanup and rechecked before insertion. A
bounded page of 256 reused rows yields before any provider call. Conflicting vector hashes for one identity block reuse
instead of choosing by recency. If agency/currency metadata changes without modifying the declared input, this path
avoids re-embedding; changed input text does not match and proceeds to provider work. Retained permitted historical
versions keep their independently owned vectors.

Copy finalization is also the correction boundary for one scope. Verification pages tolerate the prior membership while
the replacement is incomplete, whereas read-only whole-copy inspection continues to reject that stale extra state.
After the full replacement passes, finalization locks every obsolete generation, removes only the replaced scope's
memberships and deletes generations with no remaining owner. Cascades remove their passages, vectors and shard state.
An allowed historical or shared scope membership keeps its generation and vectors intact.

Use 16 deterministic shards based on passage IDs and fixed shard-count/hash algorithm stored in the rollout manifest.
Shard count cannot change mid-wave. Within each shard scan at most 512 rows and submit at most 64 eligible texts per
provider request, additionally bounded by model token/byte caps. Persist at most 256 vector rows per transaction.
Reject wrong count/dimensions, nonfinite values and model mismatches. Partial provider responses do not mark the whole
batch complete. Resume with keyset cursors and a stale-work sweep; inserts behind a cursor still receive outbox work.

Initial semantic coverage: latest validated eCFR edition memberships and in-scope FR history through the completed wave.
Historical annual CFR embeddings are a separately selected rollout scope. The coverage endpoint returns eligible,
embedded-current, skipped-with-reason and missing counts by scope/model. Unembedded historical text remains lexically
searchable; semantic queries requesting that history return an explicit unsupported/partial capability, not false empties.

Scale under the aggregate provider/database limits in [workflows](acquisition-workflows.md). Measure price per 1,000
successful passages, token volume, dedup savings, throughput and cost to keep current. A worker-count increase that only
increases retries is rejected. Do not inherit a 64/128-worker bill embedding allocation without measured shared headroom.

## Query semantics

W owns [available lexical scope and target query semantics](../../../legislation-web/docs/regulations/legal-search-serving.md).
The broader target does not claim semantic, publication or state coverage already exists.

## Evaluation and promotion gates

The single [W promotion checklist](../../../legislation-web/docs/regulations/legal-search-serving.md#evaluation-and-promotion-gates)
owns reader quality, latency, rights and API/MCP acceptance. I supplies completeness/parity, retry, throughput, cost and
model/input coverage evidence, using the [frozen evaluation protocol](embedding-evaluation-protocol.md).
