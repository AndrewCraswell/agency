# Embedding rollout and retrieval-quality gate

## Input integrity repair and deferred rebuild (September 15, 2026)

The shared OpenRouter embedding client previously capped inputs at 16,000 characters and, after a recognized provider
token-limit error, halved the rejected input and retried. The retry could return a vector for shorter text while the
calling job persisted the original input hash. Existing embedding rows do not record the actual submitted text length,
token-limit retry reason or shortened-input hash, so a matching stored input hash does not prove integrity for this path.
There is no evidence that every existing vector was affected. A bounded read-only inspection confirmed the four remote
embedding tables have no field identifying these retries; affected counts remain unknown.

The client now rejects over-limit inputs before HTTP, submits the exact accepted input, freezes request bodies across
transient retries, and propagates provider size errors without shortening. Shared token checks use pinned
`tiktoken@1.0.22` WebAssembly for OpenAI Small and `@huggingface/tokenizers@0.2.0` with pinned/checksummed Voyage 4
vocabulary files. They load locally once per process. Operational token ceilings are 8,000/290,000 for OpenAI and
31,000/310,000 for Voyage (per input/per batch), with the existing 16,000-character and 64-input transport guards.
`embedding-preparation.ts` emits contiguous, lossless source spans with complete prefixed-input hashes and token
counts. Regulatory prose consumes this splitter; atomic table handling remains with the regulatory passage builder.
Regression tests cover local and provider limits, unchanged retry payloads, caller-array mutation, invalid Unicode,
combined batch limits, reference tokenizer parity, and no vector/hash persistence after rejection. Existing jobs'
explicit character cap occurs before hashing and remains a separate excerpt-coverage limitation to replace before rebuilding.

Live synthetic smoke: OpenAI local/provider counts both total 678; Voyage reference/local counts total 683 while
OpenRouter reports 680. Individual Voyage requests confirmed exactly one fewer reported token per input; the local
counter matches the pinned Rust reference (`tokenizers==0.22.2`) on 21 cases. Do not subtract tokens to match billing.
The strict provider-usage equality smoke reports this discrepancy rather than claiming equality. No existing vectors
were replaced. The initial pure-JavaScript OpenAI implementation was removed after repetitive inputs took about
30 seconds; the WebAssembly implementation passes the focused suite in seconds.

User direction: regenerate **all embeddings later**, not during this repair. Do not delete existing vectors, change
freshness contracts to trigger automatic regeneration, or dispatch a rebuild now. Before that rebuild, share model-aware
token counting and lossless passage preparation across ingestion products, preserve table/section context, and verify
exact-input hashes and retrieval canaries. The transport client must reject inputs it cannot submit intact; a tokenizer
does not justify truncating them. The user approved shared tokenizer preparation; continue using OpenRouter for inference.
Rebuild execution and cutover require their own recorded deployment, scope, coverage,
cost and search validation. Old hashes cannot safely be used to skip the eventual full rebuild.

Source-record promotion and end-to-end ingestion readiness are separate milestones.
For North Carolina and Alaska onboarding, embeddings and verified lexical/semantic
retrieval are required before ingestion is called complete or another state is
onboarded (user decision, 2026-09-15). Structured reads may be available earlier,
but that partial availability does not satisfy the onboarding gate.

Historical routing/corpus gates passed in August, but they do not close the September exact-input integrity issue or
authorize another paid pass. The rebuild hold above takes precedence over the retained rollout procedure. Accepted
future full-pass topology is the sequential 128-shard coordinator; earlier mixed shard counts are not operating instructions.

Future full recreations use the sequential 128-shard coordinator documented below. PgBouncer is now available for a
separate pooled-concurrency canary at 128, 160, and finally 200 workers. Do not raise the task ceiling merely
because PgBouncer accepts more clients: promotion still requires the database, pool-wait, Trigger, and provider gates
in [database connection pooling](../../../../packages/legislation-core/docs/operations/database-connection-pooling.md). Each increase must also demonstrate an end-to-end
completed-vector throughput gain on the same product. The documented benchmark records vectors per minute, provider
latency and errors, database and PgBouncer pressure, retries, cost per successful vector, speedup, and scaling
efficiency. A stage that adds less than 10 percent throughput is the measured saturation point and is not promoted.
Each stage runs for 10 minutes; its first minute is warm-up and the remaining nine minutes form the comparison window.
The 160- and 200-worker stages are temporary measurements. After the benchmark, set the embedding queue to 128 tasks
so 72 of Trigger's 200 ordinary concurrency slots remain available for daily synchronization, OCR, and repairs, even
if the higher stages continue to scale efficiently.

## Canary status

The August embedding canary and model-bakeoff artifacts were superseded by the routed production contracts and removed.
They were dated evidence, not fresh acceptance after input, model, serving, or source changes. Current model routes and
input contracts are executable source; new model changes require a new preregistered evaluation rather than reviving old
fixtures. Unverified inline vectors remain non-authoritative.

## Retrieval products and embedding inputs

Use [C's per-product input contract](../../../../packages/legislation-core/docs/engineering/embeddings.md#retrieval-products-and-embedding-inputs).

## Canonical canary routing contract

Use [C's route/model/storage contract and retained selection basis](../../../../packages/legislation-core/docs/engineering/embeddings.md).
Index creation, jobs and W queries consume the same C definitions; app environment settings do not override models.

### Exact MCP query dispatch

W owns [query dispatch](../../../legislation-web/docs/engineering/api/search-and-diffs.md).
M performs transport/API adaptation only, without a database or model client.

### Runtime ownership

Trigger.dev owns asynchronous embedding generation through five explicit
tasks:

- `embedding-full-sync` recreates every product sequentially at the full
  128-worker steady-state cap and advances automatically when a product completes;
- `embedding-sync` starts one bounded embedding wave;
- `embedding-sync-shard-controller` serially advances a shard checkpoint; and
- `embedding-sync-shard-worker` embeds amendments, bills, document sections,
  and supporting-material sections for one bounded shard batch; and
- `embedding-index-maintenance` refreshes PostgreSQL planner statistics after a
  canary or completed wave so a newly populated vector table cannot cause a
  filtered passage query to choose a full-corpus join.

`embedding-sync` accepts an explicit `products` array containing `bills`,
`sections`, `amendments`, or `materials`. Product names are part of the durable
lease, checkpoint stream, and idempotency keys, so the staged waves below can
run independently without reusing another product's completion state.

The historical `embeddings` phase calls `embedding-full-sync`; it no longer
relies on an implicit branch inside the general document worker. A complete
recreation runs amendments, bills, supporting-material sections, and document
sections sequentially, with 128 shards in every stage. Completion of one stage
durably gates the next, so all capacity transfers automatically without
canceling live shards or changing a product's modulo partition while it runs.
Product-specific `embedding-sync` remains the targeted repair and future
incremental refresh boundary. Its production schedule remains disabled until
the historical pass is complete and daily cost is measured.

Reranking stays in W's `LegislationQueryService`, synchronously during API/query execution after first-stage candidates.
It is neither an I task nor an M model runtime. M calls W's complete query operation over HTTPS.

## MCP access plan

See [W's retrieve/traverse/deliver acceptance](../../../legislation-web/docs/engineering/api/search-and-diffs.md).

### Corpus gaps the bakeoff must represent

The first broad-topic canary deliberately selected summary-rich bills. It did
not represent the difficult majority of the corpus. The production snapshot on
2026-08-22 contained 1,514,900 bills, of which 978,409 (64.6 percent) lacked a
usable summary, 740,625 (48.9 percent) had no subjects, and 341,142 (22.5
percent) had neither. Of 38,822 structured amendments, 29,061 (74.9 percent)
had neither purpose nor description. The larger bakeoff must report these
strata separately rather than allowing well-described records to hide poor
recall on sparse records.

### Chunking and refresh identity

See [C's chunk and refresh identity](../../../../packages/legislation-core/docs/engineering/embeddings.md#chunking-and-refresh-identity).

## Corpus sizing

The August 21 estimate of roughly 21 million potential rows predates later ingestion and mixed-model completion.
Reinventory rows, actual input lengths, selected dimensions, indexes/WAL/storage and provider prices before a paid pass.
Amendment/material semantic consumers now exist; the original lexical-only rollout exclusion is obsolete.

## Preconditions

Before creating canary vectors:

1. document and supporting-material gates report zero pending, processing,
   eligible retryable, deferred retryable, interrupted, and OCR-required work;
2. exhausted failures and evidence-based unsupported outcomes are reviewed;
3. structural corpus validation passes without treating intentionally missing
   embeddings as an error;
4. the model, dimensions, input truncation, and provider privacy settings are
   pinned;
5. dedicated embedding tables and indexes are ready under the `legislation`
   schema; and
6. the canary budget, maximum row count, stop conditions, and approver are
   recorded before the first provider request.

## Storage contract

See [C's dedicated storage contract](../../../../packages/legislation-core/docs/engineering/embeddings.md#storage-contract).
The September integrity hold forbids using old matching hashes to skip the future approved full rebuild.

## Canary cohort

The canary uses a deterministic manifest rather than the first rows returned by
the database. It samples bills and bill-document sections across:

- federal and state jurisdictions;
- recent and historical sessions;
- short, median, and long text;
- OCR and native-text documents;
- common and rare subjects; and
- exact-phrase and paraphrase retrieval cases.

Within each stratum, deterministically assign matched records to:

- **treatment:** receives a canary embedding; or
- **control:** remains unembedded.

The manifest records the seed, source IDs, strata, model, input hashes, and
rollout ID. Re-running the canary must select the same records and must not
silently widen the cohort.

## Model and input bakeoff

The model is selected by measured retrieval quality on our legislative corpus,
not by a generic leaderboard. Run the bakeoff outside the production embedding
tables so it cannot overwrite current vectors or make partially embedded data
appear complete.

Use one immutable manifest and the same candidate pool for every configuration.
Process one model at a time, embed documents in bounded batches, compute exact
cosine similarity against the judged queries, retain only each query's top 25,
and discard the temporary vectors before the next model. Record provider model
ID, dimensions, input type, canonical input hash, tokens, requests, retries,
latency, and price.

The first expanded bakeoff should contain at least 4,000 records and include:

- at least 1,000 bills, with summary-rich, title-only, and document-synopsis
  strata and all judged relevant bills inside each query scope;
- at least 2,000 native and OCR document passages across short, median, long,
  recent, and historical strata;
- at least 500 structured or document-backed amendments, including
  identifier-only structured rows; and
- at least 500 supporting-material passages across multiple classifications.

Use at least ten bill-topic queries and at least ten judged queries for each
passage, amendment, and supporting-material product. Include exact phrases,
paraphrases, policy descriptions without bill numbers, and deliberately
confusable negatives. Judgments must be model-independent and frozen before
examining model rankings.

Compare the currently available gateway candidates against the production
baseline:

| Candidate | Purpose in the bakeoff |
| --- | --- |
| `openai/text-embedding-3-small` | Current quality, latency, and cost baseline. |
| `openai/text-embedding-3-large` | Higher-cost OpenAI quality comparison at a pinned dimension. |
| `voyageai/voyage-4` | Mid-cost retrieval-focused comparison with query/document input roles. |
| `voyageai/voyage-4-large` | Higher-quality Voyage comparison. |
| `qwen/qwen3-embedding-8b` | Low-cost open-model comparison. |
| `google/gemini-embedding-2` | Optional high-cost ceiling if its first bounded sample clears the budget gate. |

First run a field ablation using the baseline model: current bill fields versus
labeled fields plus deterministic document synopsis; current passage text
versus contextual token-aware chunks; amendment metadata versus linked
amendment text. Only the winning input contract advances to the multi-model
comparison. This prevents choosing a model to compensate for a weak document
representation.

No candidate wins globally merely by having the best aggregate score. Report
quality by retrieval product and sparse-content stratum. Different products may
use different models only when the improvement is material enough to justify
the added operational and storage complexity.

## Evaluation set

I retains the immutable corpus, provider and generation evidence. W owns
[judged query fields and API/MCP evaluation](../../../legislation-web/docs/engineering/api/search-and-diffs.md).

## Required measurements

Report provider tokens/requests/retries/cost, PostgreSQL table/index/WAL/backup growth, embedding throughput and refresh
idempotency. W's linked evaluation adds retrieval metrics and partial-coverage disclosure to the same run evidence.

## Promotion gates

Use [W's single retrieval promotion checklist](../../../legislation-web/docs/engineering/api/search-and-diffs.md).
It includes I's budget, storage, retry and load evidence. An inconclusive canary does not authorize expansion.

## Rollout sequence

1. Implement the contextual input contracts, token-aware chunking, and
   semantic MCP contracts for amendments and supporting materials.
2. Run the isolated field ablation and multi-model bakeoff on the frozen,
   multi-entity judged corpus.
3. Run an MCP treatment/control canary for the winning bill, document,
   amendment, and supporting-material configurations.
4. Review per-product quality, sparse-stratum quality, cost, storage, and
   latency evidence.
5. Keep inline and potentially shortened-input vectors non-authoritative for the rebuild. The September integrity
   finding means an old matching hash alone cannot authorize reuse or skipping the approved full regeneration.
6. If approved, expand in bounded, checkpointed waves while retaining a
   nonembedded holdout long enough to detect regressions.
7. Use the approved sequential full-pass coordinator after each product's quality gate; do not change shard partitions
   or launch competing product waves during a run.
8. Run final embedding-integrity validation and deployed MCP smoke tests.
9. Enable recurring embedding refresh only after the historical rollout is
   complete and its daily cost is measured.
10. Keep the model-bakeoff corpus and judgments as a regression suite for model,
    input, chunking, index, and reranker changes.

## Complete-pass recommendation

After the deployed MCP treatment/control canary reproduces the product gates,
run the complete corpus with the mixed routing contract above. Do not choose a
single cheaper model for every product: the measured supporting-material gain
from Voyage is large, while OpenAI Small is the cost-effective winner for
document passages and structured amendments.

For a separately approved recreation, use 128 deterministic shards per sequential product and a 128-worker ceiling.
The prior 200-shard mixed pass is not the current coordinator contract. A historical worker selects up to 640
candidates per product in one query, sends provider requests in batches of 64,
and persists generated vectors in batches of 128. Incremental and daily syncs
keep their normal 64-record selection and persistence path, so the bulk tuning
does not increase their database footprint. Retain 128 workers only while
database sessions remain below the 80-session operational threshold and
PgBouncer wait time remains acceptable. The model contract remains:

1. bills with `voyageai/voyage-4` and query-time
   `cohere/rerank-v3.5`;
2. bill-document sections with `openai/text-embedding-3-small` and
   query-time `cohere/rerank-v3.5`;
3. structured amendments with `openai/text-embedding-3-small` and no
   reranker; and
4. supporting-material sections with `voyageai/voyage-4` and no reranker.

Evaluate after the first 100,000 generated or reconciled rows and reduce the
fan-out if provider throttling, retries, or database pressure appear. Compare
observed spend, p95 task duration, database connections, index growth, retry
rate, and deployed MCP quality against the projection. The historical August estimate was
approximately $444 for the mixed generation pass, compared with approximately
$292 for all OpenAI Small and approximately $943 for all Voyage 4. Cohere
Rerank 3.5 is query-time spend, approximately $0.001 per reranked request, and
is not part of generation cost. Refresh these prices immediately before the
paid pass.

### Historical throughput canary, 2026-08-23

The original 128-worker pass produced 184,690 vectors during its nine-minute
measured window, or 20,521 vectors per minute. A bulk database-access canary at
the same 128-worker limit produced 403,638 vectors from 01:31:41Z through
01:40:41Z, or 44,849 vectors per minute. That is a 2.19 times throughput
increase without raising Trigger concurrency or provider batch size.

The 160- and 200-worker stages were not run after this optimization. At 128,
PgBouncer used all 60 server connections, PostgreSQL reached the 80-session
safety boundary, and Railway reported pgvector memory at essentially 100
percent of its 24 GiB limit. Increasing Trigger concurrency under those
conditions would add waiting clients and failure risk rather than safe
capacity. Keep the historical queue at 128 and reserve the remaining 72
Trigger slots for recurring ingestion. Reconsider a higher limit only after
increasing database memory or materially reducing database work per vector,
then repeat the same 10-minute staged canary.

HNSW indexes may be omitted during the historical load to avoid write
amplification. Recreate them concurrently once after the historical pass and
then run `ANALYZE`. Daily incremental inserts update the indexes automatically;
they do not require daily index rebuilds.

Each historical embedding worker reserves two PgBouncer client connections:
one for batch selection and persistence and one for the renewable ingestion
lease heartbeat. This does not raise PgBouncer's 60-server PostgreSQL ceiling.
The separate heartbeat connection is required because a single-client worker
can lose its lease while a long document-section transaction occupies its only
local pool connection. Such a loss is resumable and does not duplicate vectors,
but it terminates that shard controller and requires a checkpointed replacement
wave.

Index maintenance must not rely on `CREATE INDEX CONCURRENTLY IF NOT EXISTS`
alone. PostgreSQL retains an invalid zero-byte catalog entry when a concurrent
build fails, and `IF NOT EXISTS` will skip that name. The maintenance task
detects `pg_index.indisvalid = false`, drops only the four fixed invalid HNSW
indexes concurrently, and recreates them before `ANALYZE` and retrieval
acceptance. Each index builds sequentially with two internal PostgreSQL workers
and a 32 MiB session-local maintenance allocation, which fits the hosted
64 MiB shared-memory segment without making three large builds compete for
volume I/O. The maintenance task has a 24-hour execution allowance because the
15.3-million-row document index cannot fit inside the ordinary four-hour task
window.

The broad pass is recommended only if the frozen graded evaluation and the
deployed MCP canary both retain an absolute nDCG@10 improvement greater than
0.02 for every promoted model or reranker, all result identities resolve to
canonical database rows, and no sparse cohort has a material recall regression.
