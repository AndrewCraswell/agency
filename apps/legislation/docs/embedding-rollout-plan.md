# Embedding rollout and retrieval-quality gate

Embeddings are an optional retrieval enhancement, not an ingestion-completion
requirement. The historical corpus remains available through structured and
PostgreSQL lexical search while this rollout is paused.

The full embedding phase must not start merely because document and material
processing has finished. It starts only after the corpus gate, storage design,
cost estimate, and MCP retrieval canary below are accepted.

## Canary status

The first bounded canary ran on 2026-08-22. It created or reused vectors for
four treatment bills and ten treatment document sections, while the two clean
control bills remained unembedded and supporting-material sections were
excluded. See [the canary report](../evals/embedding-canary-v1.md) and its
machine-readable result files.

With canonical jurisdiction and session filters, the treatment cohort reached
100 percent recall at 10 for both known-item bill discovery and judged document
passages. All four treatment bills ranked first; the three treatment passages
ranked second, first, and first. This passes the small known-item check, but it
does not establish broad topical-search quality. The original broad queries
returned relevant but unlabeled bills, so their earlier 57 percent score was a
single-target evaluation artifact rather than a valid topical-relevance score.

Richer bill vectors and passage-to-bill candidate projection were tested and
removed because they did not improve this cohort. Query-time reranking remains
disabled in the deployed MCP. Although it reduced quality in the first small
canary, the expanded bakeoff showed material gains for bill and document
ranking while it hurt amendments and Voyage-current supporting materials. It
therefore advances only as a selective bill/document candidate pending pooled,
graded judgments. Full-corpus embedding remains paused until dedicated
embedding tables exist and the larger evaluation is complete.

A second canary then tested ten broad topics using 148 exhaustive source-
taxonomy judgments in fixed jurisdiction and session scopes. Pure semantic
retrieval filled every available top-10 position with a judged relevant bill,
reached 100 percent treatment Recall@25, and averaged 347 ms warm latency.
Hybrid retrieval was slightly worse and slower. See the
[broad-topic canary report](../evals/embedding-topic-canary.md). This clears the
bounded retrieval-quality gate for pure semantic search, but full rollout is
still blocked on dedicated storage and reconciliation of 429,261 historical
inline vectors discovered during the preflight.

The expanded isolated bakeoff then evaluated 3,989 records and 40 queries
across bills, document passages, amendments, and supporting materials. Voyage 4
is the provisional canary model because it combined 98 percent
capacity-adjusted bill Recall@10, strong per-product ranking, 1,024-dimensional
vectors, and low evaluation latency. The experiment also rejected raw leading
document excerpts as a sparse-bill fallback and showed that each product needs
its own input contract. See the
[model and input bakeoff](../evals/embedding-model-bakeoff.md). Full rollout
remains paused until the broader human-graded and deployed MCP gates pass.

## Retrieval products and embedding inputs

The rollout is not one undifferentiated vectorization job. Each search product
needs its own input contract, relevance judgments, promotion gate, and source
projection. Structured identifiers, dates, jurisdictions, sessions, chambers,
statuses, sponsors, committees, and document classifications remain filters or
joins. They are not a substitute for searchable prose.

| Search product | Embedding input | Result returned to the caller |
| --- | --- | --- |
| Bill discovery | Labeled bill title, summary, and subjects. When summary and subjects are absent, use a short deterministic synopsis from the preferred bill document when one exists. Do not embed a bare identifier as if it described the policy. | Canonical bill with jurisdiction, session, sponsors, committees, actions, source links, and coverage metadata. |
| Bill-document passage search | Bill title and identifier, document title, version/classification, section heading, and section text. OCR text uses the same contract as native text while retaining OCR provenance. | Canonical document section plus its document and bill, agency URL, and stored-object reference. |
| Structured amendment search | Bill context, printed amendment identifier and type, purpose, and description. If the structured row contains only an identifier, associate proven amendment document text instead of inventing a synopsis. | Canonical amendment, sponsor and dates, related bill, and any supporting document passages. |
| Document-backed amendment search | Bill context, amendment document title/classification, section heading, and section text. | Canonical `amendment:document:` result projected back to its bill and source document. |
| Supporting-material search | Bill context, material title/classification, section heading, and section text. | Canonical supporting material and section, related bill, agency URL, and stored-object reference. |

This requires semantic and hybrid modes for `search_amendments` and
`search_supporting_materials` before their vectors are promoted. Bills and
bill-document passages already have semantic consumers, but their input
contracts must be upgraded before the broad rollout.

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

Embedding records belong to the legislation domain but should not remain
inline on the primary corpus rows for the broad rollout. Use dedicated,
foreign-keyed tables for bills, document sections, and any later approved
supporting-material sections. Each record includes:

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
5. Reconcile the 429,261 historical inline bill vectors by input hash and model
   before making any provider call; reuse matching vectors and regenerate only
   records that do not satisfy the selected contract.
6. If approved, expand in bounded, checkpointed waves while retaining a
   nonembedded holdout long enough to detect regressions.
7. Roll out bills and bill-document passages first, then amendments, then
   supporting materials. Each product has an independent stop/go decision.
8. Run final embedding-integrity validation and deployed MCP smoke tests.
9. Enable recurring embedding refresh only after the historical rollout is
   complete and its daily cost is measured.
10. Keep the model-bakeoff corpus and judgments as a regression suite for model,
    input, chunking, index, and reranker changes.
