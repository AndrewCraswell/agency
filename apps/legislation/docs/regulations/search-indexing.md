# Regulatory indexing, embeddings and retrieval

Proposed implementation, September 14, 2026. Parent: [implementation](implementation.md).
Build on existing Tabra search infrastructure; regulatory retrieval is a new product with its own quality gate.

## Existing components and intended extension

| Existing component | Regulatory extension |
| --- | --- |
| `src/models/embedding-routing.ts` | Add explicit `legal-passage` route and regulatory query route |
| `src/ingestion/embeddings/jobs.ts` | Reuse freshness/input-hash/client patterns in a legal-passage job |
| `src/models/openrouter-embeddings.ts` | Reuse provider abstraction, dimension validation, token limits and metrics |
| `src/search/passage-search-queue.ts` and replication/readiness modules | Add regulatory outbox/projection consumers with distinct entity kinds |
| `infra/passage-search/schema.sql` | Add separate legal-passage projection in isolated search DB |
| `src/evaluation/embedding.ts` and embedding canary scripts | Extend with regulatory fixtures/judgments and historical/version cases |

Current bill documents and their sections have bill-specific relationships. Do not insert regulations into those tables
to reuse a worker. Add `legal_passages` and route-aware jobs while sharing safe common functions. Existing embedding
routes differ by product: OpenAI Small/1,536 dimensions for document passages and Voyage 4/1,024 for bills/supporting
materials. Those evaluated legislative results do not establish the best regulatory model.

Canonical PostgreSQL remains authoritative. The isolated passage-search service is a reconstructible text projection;
vectors stay in canonical dedicated embedding tables. Its bill passage cutover has a separate readiness gate: inspect
current status at implementation, do not treat a valid target index as completed copy. This spec does not approve
replacing the canonical PostgreSQL image, rebuilding existing vectors or bypassing bill search readiness.

## Passage generation

One provision version may have several passages, but one hit always names its provision and exact text version. A
publication passage names its document version and distinguishes preamble, proposed/amendatory text, table and appendix.
Never merge text across versions, jurisdictions or publication kinds to fill a chunk.

Initial chunk contract `legal-passage-context-text`: jurisdiction/code name, display citation, hierarchy headings,
publication kind when applicable, local heading and bounded source text. Dates, agency IDs, source rights and status
are filters/metadata, not repeated prose padding. Do not embed AI summaries instead of primary text. Normalize whitespace
without changing legal symbols, enumerated paragraphs, table relationships or source references.

Target 800 tokens, hard limit 1,200 tokens per passage under the selected model tokenizer, with up to 100 tokens of
boundary context. Prefer paragraph/subsection boundaries. An oversized table splits by row groups with repeated headers
and preserved row locators; an oversized paragraph splits with exact offsets. Do not silently truncate long text.
Retain ordinal, XML path/page coordinates where known, plain-text offsets, source content hash and parser/chunk contract.
Text-free structural nodes and explicitly empty/repealed placeholders remain browseable but have an explicit embedding
ineligibility reason. Preserve substantive repeal/adoption text as eligible content.

## Lexical indexes and projection

Create canonical exact-citation B-tree indexes and a PostgreSQL FTS index over normalized legal-passage text for the
initial lexical path. Rank code title/citation/headings separately from body. Add filtered indexes for current edition
membership and document publication date where measured query plans justify them; avoid one index for every filter
combination. Exact citation resolution bypasses semantic ranking.

For BM25, add `legal_passages` to the existing isolated search database with key, owner/version IDs, text/hash, heading,
jurisdiction, code, corpus/kind, edition/source dates, agency IDs, rights profile, source ID and generation. Use its pinned
extension syntax and current compatibility contract, validated in the disposable canary before modifying the deployed
search schema. No cross-corpus ID collisions and no copies of vectors in this database.

Canonical publish writes a transactional outbox item. A projection worker claims a bounded window, copies the requested
generation, validates count/hash manifests and atomically marks that generation searchable. Acknowledgement follows the
target commit; crash/retry is idempotent. Update/restrict/delete operations must remove obsolete search visibility as
well as adding new text. A tombstone cannot be lost merely because its text was removed first. Old backfills cannot
overwrite newer generations, including on delayed retries.

Hydrate ranked candidates through canonical version and rights checks before returning them. A stale index is never an
authority for permissions or exact text. If candidates reference a generation no longer selectable, suppress them and
record lag; do not silently relabel old text as current. Cache keys bind authenticated access/rights, normalized query,
filters, search generation and model contract; restriction changes invalidate caches.

Backfill the projection by deterministic owner-ID shards and keyset pagination. Capture a source outbox watermark,
perform the snapshot copy, replay through that watermark and drain later changes. Readiness compares all requested
owner/version counts and hash manifests, including delayed retry rows. Keep source/target transactions separate.

## Embedding job and model decision

Initial canary candidate is `openai/text-embedding-3-small` at 1,536 dimensions, matching existing passage infrastructure.
Compare with the already available Voyage 4 route on the same regulatory judgments before selecting bulk production.
The implementation choice is explicit: one selected regulatory embedding route per active generation, never mixing
different model spaces. No new vendor is required for the canary.

### Mandatory model smoke test and comparative evaluation

Model selection is a release gate before bulk embedding expenditure. Implement
`scripts/smoke-regulatory-embeddings.ts` using the existing embedding/evaluation clients. Its live mode reads a fixed
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

### Vector storage and index build

Use the existing PostgreSQL vector extension and cosine HNSW index pattern. The canary keeps each candidate in a
separate dimension-constrained staging table; the selected production `legal_passage_embeddings` table has the chosen
fixed vector dimension and model/input-contract checks. A later different-dimension model builds a new isolated
generation/storage target and changes routing only after parity and quality checks; never compare 1,024- and
1,536-dimensional vectors or rewrite the active vectors in place during a query rollout.

Create a unique input identity index and a passage-ID lookup index. Build the new feature's HNSW index after its initial
bounded load, measure build RSS/time/disk and run ANALYZE before query-plan/recall acceptance. Use the existing index
maintenance mechanism for an online build when the table already serves traffic; respect PostgreSQL's nontransactional
concurrent-build requirements and detect invalid/interrupted indexes explicitly. Do not rebuild existing bill indexes.
Record HNSW build/search parameters in the generation manifest, begin with the installed extension defaults and tune
only against exact filtered-neighbor recall and latency. A valid index without complete eligible vectors is not ready.

Embedding input hash covers normalized input, model ID, dimensions, input contract and chunk contract. Persist those
fields with each vector. Skip only if all match. If agency/currency metadata changes without modifying the declared
input, update projection metadata without paying to re-embed. If text changes, regenerate only affected passages.
Retained historical versions keep their old vectors where permitted.

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

`POST /api/search/regulations` supports lexical, semantic and hybrid modes. Default corpus is regulatory code plus
regulatory publications; statutory-code search uses an explicit `corpora: ["statute"]` filter on the same legal corpus
service when enabled. Latest validated code editions are the default; publications use explicit kind/date filters.
Historical queries select edition IDs or a supported asOf date and never intermingle current and historical text implicitly.

Apply jurisdiction, agency, code, kind, date, edition and rights filters before candidate ranking. Vector ANN filtering
must demonstrate adequate recall under selective filters; use bounded exact filtered vector search where justified by
small subsets. Do not fetch an unfiltered top-k and claim it is the top-k of a restricted jurisdiction.

Initial retrieval limits: lexical limit 1–100/default 20; semantic/hybrid limit 1–25/default 10. Candidate pools start at
100 lexical and 100 vector entries, then deduplicate by owner-version and merge using reciprocal-rank fusion for hybrid.
Benchmark candidate sizes and record the chosen configuration. Selective reranking uses the existing reranker only if
the regulatory canary improves quality within the latency budget; reranking is disabled until that gate passes.

Do not add raw BM25 and cosine scores as if they shared a scale. Return rank and mode; raw scores are optional diagnostic
fields with documented semantics. Multiple passages from one section are grouped into a hit with its best passage and
bounded sibling pointers, preventing a long provision from monopolizing a result page.

For lexical pagination use generation-bound deterministic score + ID ordering. For semantic/hybrid, freeze the bounded
candidate ranking in a short-lived server-side result snapshot; cursor binds principal, filters, generation and ranking
contract. Pages consume that same candidate set and do not re-embed/re-rank arbitrarily. Expired cursors return
`400 invalid_request` with a safe restart reason. `nextCursor: null` means the selected bounded candidate set ended,
not exhaustive proof of no additional relevant law; return `candidateSetTruncated` where applicable.

If semantic dependencies are unavailable, semantic mode returns `503 dependency_unavailable`. Hybrid can use lexical
only if `allowDegraded: true` was explicitly requested; return `effectiveMode: lexical` and a degradation warning.
No silent mixed-model/fallback ranking. Coverage gaps and source staleness are separate from dependency failures.

## Evaluation and promotion gates

Freeze at least 60 query judgments: 15 exact citations, 20 topical code queries, 10 proposals versus final rules,
10 historical/correction queries and five cross-title/agency/appendix cases. Include negative controls from excluded
dates/corpora, text-free nodes and future synthetic state fixtures. Have a product/domain reviewer approve expected
answers and evidence; an LLM may propose judgments but cannot self-certify the gate.

Initial launch targets, to measure rather than claim in advance:

- Exact citation resolution: 100 percent correct identity/version on supported fixtures; no ambiguous match silently chosen.
- Human-judged topical Recall@25 >= 0.90 and nDCG@10 >= 0.80; no material regression from lexical baseline on temporal,
  proposed/final or jurisdiction filters. Record subgroup results instead of hiding failures in an overall average.
- Every returned hit has correct canonical/source/version references; zero forbidden, wrong-jurisdiction or wrong-version hits.
- At 20 concurrent readers while the approved ingestion profile runs: warmed p95 detail <= 500 ms, lexical <= 1 second,
  semantic <= 2.5 seconds and hybrid <= 3 seconds. Record cold cache separately; error rate < 1 percent, excluding
  deliberate invalid/auth/chaos requests. These targets are release criteria, not existing production measurements.
- Projection parity: no unexplained missing/extra current passages, matching sampled hashes and no failed or delayed
  retry work through the promotion watermark. Embeddings: all eligible inputs in the declared semantic scope match
  model/dimensions/contracts; excluded historical or empty text is accounted for explicitly.

Run missing-model, failed-copy, stale-generation, rights-restriction, correction, cancellation and replay smoke cases.
Compare API and MCP retrieval against the same fixtures. Promote lexical and semantic capabilities separately; a
successful DB index build, green Trigger run or small canary cannot alone establish full-corpus readiness.
