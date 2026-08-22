# Embedding rollout and retrieval-quality gate

Embeddings are an optional retrieval enhancement, not an ingestion-completion
requirement. The historical corpus remains available through structured and
PostgreSQL lexical search while the complete corpus pass is running.

The corpus, storage, cost, model, and MCP treatment/control gates below passed,
and the complete embedding phase was approved on 2026-08-22. The pass began
with four concurrent product waves at 16 deterministic shards per product.
Structured amendments then completed, releasing 16 worker slots. The
document-section wave is approved for a controlled 16-to-32-shard cutover,
supporting-material sections increase from 16 to 20, and bills remain at 16.
This keeps the shared queue bounded at 68 workers. This page remains the source of
truth for the accepted routing, quality gates, incremental ownership, and
completion audit.

## Canary status

The bounded canary program began on 2026-08-22. Its first treatment created or reused vectors for
four treatment bills and ten treatment document sections, while the two clean
control bills remained unembedded and supporting-material sections were
excluded. The later [routed canary report](../evals/embedding-canary.md) records
the accepted multi-product contract and machine-readable result files.

With canonical jurisdiction and session filters, the treatment cohort reached
100 percent recall at 10 for both known-item bill discovery and judged document
passages. All four treatment bills ranked first; the three treatment passages
ranked second, first, and first. This passes the small known-item check, but it
does not establish broad topical-search quality. The original broad queries
returned relevant but unlabeled bills, so their earlier 57 percent score was a
single-target evaluation artifact rather than a valid topical-relevance score.

Richer bill vectors and passage-to-bill candidate projection were tested and
removed because they did not improve this cohort. The expanded bakeoff showed
material reranking gains for bill and document ranking while it hurt
amendments and Voyage-current supporting materials. Selective reranking is
active only for bill and document-section retrieval; migration `0022` and the
deployed treatment/control canary verified that boundary.

A second canary then tested ten broad topics using 148 exhaustive source-
taxonomy judgments in fixed jurisdiction and session scopes. Pure semantic
retrieval filled every available top-10 position with a judged relevant bill,
reached 100 percent treatment Recall@25, and averaged 347 ms warm latency.
Hybrid retrieval was slightly worse and slower. See the
[broad-topic canary report](../evals/embedding-topic-canary.md). This clears the
bounded retrieval-quality gate for pure semantic search. Dedicated storage and
strict reconciliation are now implemented; the 429,261 historical inline bill
vectors cannot be reused for the selected Voyage bill route and remain
non-authoritative.

The expanded isolated bakeoff then evaluated 3,989 records and 40 queries
across bills, document passages, amendments, and supporting materials. It
selected a mixed per-product arrangement rather than one global model: Voyage
4 for bills and supporting materials, and OpenAI Small for document sections
and structured amendments. The experiment also rejected raw leading document
excerpts as a sparse-bill fallback and showed that each product needs its own
input contract. See the
[model and input bakeoff](../evals/embedding-model-bakeoff.md). Full rollout
was held until the broader human-graded and deployed MCP gates passed.

The routed production canary then stored 2,560 rows through Trigger.dev and
replayed the frozen MCP treatment/control manifest. The embedded treatment
reached 100 percent Recall@10 and 0.929 nDCG@10 with no tool error; intentionally
unembedded controls remained absent from pure semantic search. It also verified
amendment rank fusion, supporting-material retrieval, canonical identity
projection, and query-time selective reranking. See the
[routed MCP canary report](../evals/embedding-canary.md). That result authorized
the current complete pass while retaining lexical and hybrid fallbacks until
all four products finish.

## Retrieval products and embedding inputs

The rollout is not one undifferentiated vectorization job. Each search product
needs its own input contract, relevance judgments, promotion gate, and source
projection. Structured identifiers, dates, jurisdictions, sessions, chambers,
statuses, sponsors, committees, and document classifications remain filters or
joins. They are not a substitute for searchable prose.

| Search product | Embedding input | Result returned to the caller |
| --- | --- | --- |
| Bill discovery | Bill title, summary, and subjects. Do not append a raw document excerpt or embed a bare identifier as if it described the policy. | Canonical bill with jurisdiction, session, sponsors, committees, actions, source links, and coverage metadata. |
| Bill-document passage search | Bill title and identifier, document title, version/classification, section heading, and section text. OCR text uses the same contract as native text while retaining OCR provenance. | Canonical document section plus its document and bill, agency URL, and stored-object reference. |
| Structured amendment search | Bill context, printed amendment identifier and type, purpose, and description. If the structured row contains only an identifier, associate proven amendment document text instead of inventing a synopsis. | Canonical amendment, sponsor and dates, related bill, and any supporting document passages. |
| Document-backed amendment search | Bill context, amendment document title/classification, section heading, and section text. | Canonical `amendment:document:` result projected back to its bill and source document. |
| Supporting-material search | Bill context, material title/classification, section heading, and section text. | Canonical supporting material and section, related bill, agency URL, and stored-object reference. |

This requires semantic and hybrid modes for `search_amendments` and
`search_supporting_materials` before their vectors are promoted. Bills and
bill-document passages already have semantic consumers, but their input
contracts must be upgraded before the broad rollout.

## Canonical canary routing contract

A model switch or reranking stage advances when it improves nDCG@10 by at
least 0.02 absolute on the product-specific evaluation without a meaningful
recall regression. This is a canary-routing threshold, not permission to embed
the full corpus. The pooled, graded MCP evaluation must reproduce each gain.
The machine-readable source of truth is
[`src/models/embedding-routing.ts`](../src/models/embedding-routing.ts). Index
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

Trigger.dev owns asynchronous embedding generation through three explicit
tasks:

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

The historical `embeddings` phase calls `embedding-sync`; it no longer relies
on an implicit branch inside the general document worker. The same entry task
is the future recurring refresh boundary, but its production schedule remains
disabled until the historical pass is complete and daily cost is measured.

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

## Current scope

Production PostgreSQL statistics observed on 2026-08-21 estimated approximately
21 million possible embedding rows:

| Record kind | Estimated rows | Current MCP semantic consumer |
| --- | ---: | --- |
| Bills | 1.51 million | `search_bills` semantic and hybrid modes; semantic bill-relation expansion. |
| Bill-document sections | 15.25 million | `search_bill_text` semantic and hybrid modes. |
| Structured amendments | 38,822 | None. `search_amendments` is lexical-only. |
| Supporting-material sections | 4.26 million | None. `search_supporting_materials` is lexical-only. |

At 1,536 float dimensions, 21 million vectors contain roughly 120 GiB of raw
vector values before PostgreSQL row overhead, HNSW indexes, WAL, backups, or
replicas. Supporting-material sections therefore remain outside the paid
rollout until their MCP semantic retrieval path and evaluation set exist.

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
5. Inventory the 429,261 historical inline bill vectors and leave them
   non-authoritative because their OpenAI model does not match the selected
   Voyage bill route. Reuse only document-section vectors whose exact model,
   dimensions, canonical input, and legacy hash satisfy the selected contract.
6. If approved, expand in bounded, checkpointed waves while retaining a
   nonembedded holdout long enough to detect regressions.
7. Roll out bills and bill-document passages first, then amendments, then
   supporting materials. Each product has an independent stop/go decision.
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

Begin all four products concurrently with 16 checkpointed shards per product.
After a product completes, its released capacity may be assigned to one
remaining product without exceeding 32 shards for that product or the
68-worker derived queue. The first approved scale-up uses 32 section shards,
16 bill shards, and 20 material shards. Retain it only while database sessions
remain below the 80-session operational threshold. The model contract remains:

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
rate, and deployed MCP quality against the projection. The current corpus estimate is
approximately $444 for the mixed generation pass, compared with approximately
$292 for all OpenAI Small and approximately $943 for all Voyage 4. Cohere
Rerank 3.5 is query-time spend, approximately $0.001 per reranked request, and
is not part of generation cost. Refresh these prices immediately before the
paid pass.

The broad pass is recommended only if the frozen graded evaluation and the
deployed MCP canary both retain an absolute nDCG@10 improvement greater than
0.02 for every promoted model or reranker, all result identities resolve to
canonical database rows, and no sparse cohort has a material recall regression.
