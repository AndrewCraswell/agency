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
in [database connection pooling](../operations/database-connection-pooling.md). Each increase must also demonstrate an end-to-end
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

The rollout is not one undifferentiated vectorization job. Each search product
needs its own input contract, relevance judgments, promotion gate, and source
projection. Structured identifiers, dates, jurisdictions, sessions, chambers,
statuses, sponsors, committees, and document classifications remain filters or
joins. They are not a substitute for searchable prose.

| Search product | Embedding input | Result returned to the caller |
| --- | --- | --- |
| Bill discovery | Bill title, summary, and subjects. Do not append a raw document excerpt or embed a bare identifier as if it described the policy. | Canonical bill with jurisdiction, session, sponsors, committees, actions, source links, and coverage metadata. |
| Bill-document passage search | Section heading and text under the accepted route; OCR retains provenance. | Canonical document section plus its document and bill, source URL and stored-object reference. |
| Structured amendment search | Purpose and description, with the accepted printed-identifier fallback. Sparse input is a quality limitation, not permission to invent a synopsis. | Canonical amendment, sponsor and dates, related bill and available passages. |
| Document-backed amendment search | Section heading and text under the document-section route. | Canonical `amendment:document:` result projected to its bill and document. |
| Supporting-material search | Section heading and text under the material route. | Canonical material/section, related bill and source/storage references. |

All four product tools now declare lexical/semantic/hybrid modes. Contextual headers and lossless chunks are future
input-contract changes requiring their own evaluation and rebuild; do not describe them as the current route input.

## Canonical canary routing contract

A model switch or reranking stage advances when it improves nDCG@10 by at
least 0.02 absolute on the product-specific evaluation without a meaningful
recall regression. This is a canary-routing threshold, not permission to embed
the full corpus. The pooled, graded MCP evaluation must reproduce each gain.
The machine-readable source of truth is
[`src/models/embedding-routing.ts`](../../src/models/embedding-routing.ts). Index
creation, embedding jobs, and query code must consume that contract rather
than repeat model names or dimensions.

The exact external model identifiers are part of the production contract:

- OpenAI embeddings: `openai/text-embedding-3-small`, requested through the
  OpenRouter embeddings endpoint with exactly 1,536 dimensions;
- Voyage embeddings: `voyageai/voyage-4`, requested through the OpenRouter
  embeddings endpoint with exactly 1,024 dimensions and the route-specific
  `document` or `query` input role; and
- Cohere reranking: `cohere/rerank-v3.5`, requested through the OpenRouter
  rerank endpoint.

These are full provider/model IDs, not family names or aliases. Environment
variables provide credentials and the OpenRouter base URL, but they do not
override the selected model IDs, dimensions, input contracts, or reranker.

| Data indexed | Embedding input | Embedding model | Reranker | Expanded-bakeoff basis |
| --- | --- | --- | --- | --- |
| Bills | Current title, summary, and subjects | `voyageai/voyage-4` | `cohere/rerank-v3.5` for natural-language discovery | Voyage improved nDCG@10 by 0.027 over OpenAI Small; reranking added another 0.041. |
| Bill-document sections | Section heading and text | `openai/text-embedding-3-small` | `cohere/rerank-v3.5` for natural-language passage search | Reranking improved OpenAI nDCG@10 by 0.069 and reached the same 0.856 as reranked Voyage, avoiding Voyage's higher document-corpus generation cost. |
| Structured amendments | Purpose and description, with the printed identifier as the sparse fallback | `openai/text-embedding-3-small` | None | Voyage contextual improved only 0.007 over OpenAI; reranking reduced nDCG@10 by 0.030 or more. |
| Document-backed amendment sections | Section heading and text | `openai/text-embedding-3-small` | `cohere/rerank-v3.5` only when returned by `search_bill_text`; none in `search_amendments` | These use the same tested document-section model space and index; the graded canary reports the amendment classification separately. |
| Supporting-material sections | Section heading and text | `voyageai/voyage-4` | None | Voyage improved nDCG@10 by 0.263 and Recall@10 by 0.400; reranking reduced the strongest Voyage configuration. |

| Product route | Storage table | Dimensions | Index-time input role | Query-time input role | First-stage candidates |
| --- | --- | ---: | --- | --- | ---: |
| Bills | `bill_embeddings` | 1,024 | Voyage `document` | Voyage `query` | 25 |
| Bill-document and document-backed amendment sections | `document_section_embeddings` | 1,536 | OpenAI default | OpenAI default | 25 |
| Structured amendments | `amendment_embeddings` | 1,536 | OpenAI default | OpenAI default | 25 |
| Supporting-material sections | `supporting_material_section_embeddings` | 1,024 | Voyage `document` | Voyage `query` | 25 |

Every stored vector records its exact model ID, dimensions, input-contract ID,
canonical input hash, source-record ID, and creation time. Query code selects
one route from the MCP tool and result kind, embeds the query with that route's
model and query role, and searches only rows with the same model and input
contract. It must reject dimension or model drift rather than compare vectors
from different spaces.

Natural-language bill and document searches send the first-stage top 25 to
`cohere/rerank-v3.5`, using at most 4,000 characters per candidate. Structured
amendments and supporting materials retain the embedding order. Exact
identifiers and structured filters bypass both embedding and reranking. The
MCP currently exposes product-specific search tools, so it does not compare
raw similarity scores across the OpenAI and Voyage spaces. Any future unified
search must validate rank fusion independently before launch.

### Exact MCP query dispatch

This is the lookup table the MCP implementation must follow after vectors are
created. The MCP tool selects the query route; callers never choose a provider
model directly.

| MCP tool | Query embedding | Vector rows searched | Candidate handling | Result projection |
| --- | --- | --- | --- | --- |
| `search_bills` | `voyageai/voyage-4`, 1,024 dimensions, `input_type=query` | `bill_embeddings` rows matching `voyageai/voyage-4`, 1,024 dimensions, and `bill-title-summary-subjects` | Retrieve 25, rerank with `cohere/rerank-v3.5`, then apply the requested result limit | Canonical bill |
| `search_bill_text` | `openai/text-embedding-3-small`, 1,536 dimensions | `document_section_embeddings` rows matching `document-section-heading-text`, including ordinary and amendment-classified documents | Retrieve 25, rerank with `cohere/rerank-v3.5`, then apply the requested result limit | Canonical section, document, bill, and amendment identity when applicable |
| `search_amendments` | `openai/text-embedding-3-small`, 1,536 dimensions | Search `amendment_embeddings` with `amendment-purpose-description-identifier-fallback` and amendment-classified `document_section_embeddings` with `document-section-heading-text` separately | Do not rerank. Merge the two ranked lists with reciprocal-rank fusion and deduplicate by canonical amendment identity | Canonical amendment, related bill, and supporting document passages |
| `search_supporting_materials` | `voyageai/voyage-4`, 1,024 dimensions, `input_type=query` | `supporting_material_section_embeddings` rows matching `voyageai/voyage-4`, 1,024 dimensions, and `supporting-material-section-heading-text` | Preserve embedding rank; do not rerank | Canonical material section, material, and related bill |

`search_amendments_for_bills` is a structured relationship lookup, not a
semantic search surface. It continues to fetch amendments for the supplied
bill IDs without creating a query embedding. Exact bill numbers, amendment
identifiers, and other structured filters similarly bypass semantic retrieval.

The same dispatch is encoded in `EMBEDDING_QUERY_ROUTES` next to the index-time
contract. A model, dimension, input-contract, candidate count, reranker, or
merge-strategy change must update that contract, its tests, and this table in
the same commit. This prevents indexing with one model and later querying with
another.

Exact identifiers, structured filters, bill actions, votes, people,
organizations, events, dates, and other relational metadata are not embedded
or reranked. They remain database filters, joins, and canonical lookups. OCR
and native text use the same product route while preserving extraction
provenance as metadata.

Identifier lookups and filtered collection retrieval bypass both embedding and
reranking.

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

Reranking stays in `LegislationQueryService`, synchronously inside the MCP
request after PostgreSQL returns at most 25 first-stage candidates. It is not a
Trigger.dev task because it changes the ordering of one interactive response,
and it does not need a separate public API because the MCP HTTP service is
already the retrieval API. If retrieval later becomes an independently scaled
service, move the complete search-and-rerank operation behind an internal API;
do not expose a raw reranker endpoint that callers could apply inconsistently.

## MCP access plan

Embedding work is not promoted until the MCP can retrieve, traverse, and
deliver the underlying records. Implement and evaluate these capabilities as
one retrieval surface:

1. Add `lexical`, `semantic`, and `hybrid` modes to amendment and
   supporting-material search. Amendment search merges structured amendments
   and document-backed amendments without returning duplicate identities.
2. Let bill, amendment, vote, document, and material lookup tools accept a
   bounded array of identifiers. Return per-identifier success, missing, and
   coverage states so bulk questions do not require one tool call per record.
3. Add document and material content retrieval by canonical record or section
   ID, with bounded pagination for long text. Search results include stable IDs
   that can be passed directly to the content tool.
4. Project every passage result back to its bill and, where applicable, its
   amendment, event, vote, organization, or other material link. Return the
   agency source URL, stored-object URL/reference, content type, extraction
   method, OCR state, and document date without requiring another discovery
   query.
5. Add aggregate bill retrieval options for amendments, roll calls and voter
   identities, documents, and supporting materials. Keep large collections
   paginated, but allow one call to request the related collections for several
   bills.
6. Return explicit search-coverage metadata: searchable text available,
   lexical index available, embedding available, model/input version, and the
   reason content is unavailable. Missing vectors must never be represented as
   zero matches without that disclosure.
7. Keep public document delivery independent from retrieval ranking. The MCP
   returns a canonical public delivery URL when configured and retains source
   attribution; it does not generate signed URLs for intentionally public
   artifacts.

The MCP acceptance suite uses the same frozen judgments as the isolated
bakeoff. It additionally checks batching, pagination, source projection,
document delivery, sparse/unembedded coverage reporting, and the number of tool
calls required for representative research questions.

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

Replace character truncation with tokenizer-aware chunks. Preserve natural
section boundaries when possible, split oversized sections with bounded
overlap, and include the same contextual header on every child chunk. A stable
chunk identity is derived from the source-record ID, normalized content hash,
chunking version, and chunk ordinal. Changing the model must create a new
embedding record without changing the canonical source or chunk identity.

The current 16,000-character cap rarely truncates document sections in the
sampled corpus, but it is not a dependable token budget and supporting
materials have a longer tail. The bakeoff therefore compares the current input
against the contextual, token-aware input instead of assuming that a model
change alone explains quality.

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

Embedding records belong to the legislation domain and do not remain inline on
the primary corpus rows for the broad rollout. Migration `0022` creates four
dedicated, foreign-keyed tables under the `legislation` schema:

| Table | Exact model | Dimensions | Input contract |
| --- | --- | ---: | --- |
| `bill_embeddings` | `voyageai/voyage-4` | 1,024 | `bill-title-summary-subjects` |
| `document_section_embeddings` | `openai/text-embedding-3-small` | 1,536 | `document-section-heading-text` |
| `amendment_embeddings` | `openai/text-embedding-3-small` | 1,536 | `amendment-purpose-description-identifier-fallback` |
| `supporting_material_section_embeddings` | `voyageai/voyage-4` | 1,024 | `supporting-material-section-heading-text` |

Each record includes:

- source-record ID;
- model and dimensions;
- canonical input hash;
- vector;
- canary or rollout ID; and
- creation and refresh timestamps.

A separate PostgreSQL schema would provide only namespace and permission
separation. It would not isolate storage, index maintenance, backups, or query
compute. Use a separate database or vector service only after measurements show
that PostgreSQL resource isolation is required.

The older inline vector columns are not query-authoritative. A historical
document-section vector may be copied into the dedicated table only when its
exact model, canonical input, dimensions, and legacy input hash all match the
new route. Bills and supporting materials changed model routes and must be
generated with their selected model. Unverifiable inline vectors are ignored,
not silently mixed with the new index.

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

Each judged query contains:

- a stable query ID and natural-language query;
- the MCP tool and filters to invoke;
- relevant source-record IDs with graded relevance;
- query class, such as exact phrase, paraphrase, broad topic, narrow policy,
  OCR text, or ambiguous wording; and
- whether each relevant record belongs to treatment or control.

After the isolated bakeoff selects an input and model candidate, run the same
query and filters through the deployed MCP boundary in three
modes:

1. `lexical`, which is the full-corpus baseline;
2. `semantic`, which measures only records that have canary vectors; and
3. `hybrid`, which combines lexical and semantic candidates.

This is an MCP evaluation, not a direct SQL benchmark. It includes query
embedding, tool validation, filters, pagination, result projection, and source
attribution.

## Required measurements

Report at least:

- recall at 5, 10, and 25;
- precision at 10;
- mean reciprocal rank and nDCG at 10;
- results split by treatment, control, query class, jurisdiction, and record
  kind;
- filter violations and missing source attribution;
- query latency by mode;
- provider tokens, requests, retries, and cost;
- PostgreSQL table, index, WAL, and backup growth; and
- embedding throughput and refresh idempotency.

Partial coverage must be explicit in the evaluation output. A hybrid result is
not evidence of universal semantic coverage when only the treatment cohort has
vectors.

## Promotion gates

The canary passes only when all of the following are true:

1. topical bill discovery reaches at least 90 percent capacity-adjusted recall
   at 10 and reports ordinary recall at 10 alongside it, because ordinary
   recall cannot reach 90 percent when more than eleven relevant records exist;
2. semantic bill-passage queries reach at least 80 percent recall at 10;
3. amendment and supporting-material retrieval each reach at least 80 percent
   recall at 10 on their own judged sets before their vectors are expanded;
4. sparse bill and identifier-only amendment strata do not trail their
   summary-rich counterparts by more than a predeclared 15 percentage points;
5. hybrid recall at 10 for embedded treatment records improves over the lexical
   baseline by a practically meaningful, predeclared margin;
6. hybrid recall at 10 for unembedded control records does not materially
   regress from lexical search;
7. exact-phrase retrieval, filters, pagination, and source attribution do not
   regress;
8. every semantic result resolves to its canonical bill, amendment, document,
   or material and exposes both agency and stored-object provenance when
   available;
9. observed cost and storage growth remain within the approved full-corpus
   projection; and
10. retries, latency, database load, and index maintenance remain operationally
   acceptable.

If quality does not improve, stop after the canary and retain lexical search.
Do not expand the rollout to compensate for an inconclusive evaluation.

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
