# Reranking decision record

## Status

Adopted. Hybrid retrieval and hosted reranking run in production for both recommendation objectives.

## Decision

Rank candidates in three stages. Deterministic eligibility filters run first and are never delegated to a model.
Surviving candidates are ordered by reciprocal rank fusion over Postgres full-text search and pgvector cosine
similarity. The top pool is then reordered by a hosted reranker.

Production uses `openai/text-embedding-3-small` for embeddings and `cohere/rerank-4-fast` for reranking, both reached
through OpenRouter rather than direct vendor accounts. Embeddings are stored in
`blog_writer.tenant_resource_chunks.embedding`, so no separate vector database exists.

The stored vector keeps the leading 512 of the model's 1,536 dimensions, renormalized to unit length, in a
`halfvec(512)` column. The model is trained so that the leading dimensions carry the most meaning, so a truncated and
renormalized vector stays usable for cosine comparison at a fraction of the storage. Renormalization is required rather
than optional, because truncating a unit vector leaves one shorter than unit length and cosine distance assumes
otherwise. Because the truncation point is baked into stored data, changing it means a full re-embed, which is what
`embedding_model` and `embedding_version` exist to sequence.

## Context

Vector similarity alone overweights semantic resemblance. Full-text search favors lexical overlap. Link recommendations
also depend on section intent, resource type, commercial usefulness, topical adjacency, diversity, and publication
constraints. A second-stage ranker can compare a query with a small candidate set after hard constraints have already
been applied.

Cohere Rerank v2 accepts a query and ordered documents, returns original indices with relevance scores, supports
structured candidates serialized as YAML, and advertises multilingual support. Its score is an ordering signal, not a
calibrated probability. Requests should remain far below its documented 1,000-document maximum; the application should
rerank only a compact pool produced by tenant-filtered retrieval.

## Candidates

| Candidate | Strength | Main risk | Benchmark role |
| --- | --- | --- | --- |
| Reciprocal rank fusion over full-text and vector search | Deterministic, local, inexpensive, explainable | Limited query-document interaction | Shipped as the retrieval stage and the fallback ranking |
| Cohere Rerank v4.0 | Managed structured and multilingual reranking | Vendor processing, cost, network latency | Shipped as the final ranking stage, reached through OpenRouter |
| Self-hosted cross-encoder | Strong data control and predictable boundary | Operations, model serving, language quality | Evaluate if privacy or volume warrants it |
| Alternative hosted reranker | Reduces single-vendor assumption | Separate security and quality review | Add only when a concrete candidate is available |
| General LLM judge | Flexible reasoning and rationale generation | High latency, cost, variance, prompt injection | Limited offline adjudication, not default online ranking |

Do not use an LLM to replace publication, availability, locale, or tenant filters. Those are deterministic eligibility
rules.

## Privacy and vendor gates

Cohere's current public Enterprise Data Commitments distinguish paid commercial use from trial and research use:

- ordinary hosted enterprise SaaS logs prompts and generations and generally deletes them after 30 days;
- legal, contractual, and suspected-policy-violation exceptions can extend that handling;
- model-training use can be disabled in dashboard Data Controls and the change applies prospectively;
- zero data retention requires account approval and still retains usage metadata;
- private and supported third-party cloud deployments do not expose prompts or generations to Cohere;
- enterprise customers can request a DPA and review subprocessors through Cohere's Trust Center;
- trial or research use may permit inputs and outputs to be used for research and model improvement.

Production reaches Cohere through OpenRouter, so OpenRouter is the processor of record and Cohere is a subprocessor.
Every embedding and rerank request sets `provider: { data_collection: "deny" }`, which restricts routing to providers
that do not store request content for training.

Recorded state for the current deployment:

1. account and deployment mode: OpenRouter hosted routing on the project's existing OpenRouter account;
2. training opt-out: enforced per request through `data_collection: "deny"` rather than a dashboard toggle;
3. zero data retention: not separately approved. Treat rerank inputs as leaving the trust boundary;
4. DPA, region, subprocessor, security, and deletion review: **outstanding, owner action before merchant data at
   scale**;
5. fields sent: candidate title and short description only, plus the draft title and a truncated draft body as the
   query. Resource IDs, shop domain, canonical URLs, prices, and customer data are not sent;
6. kill switch and fallback: the rerank node is set to `continueRegularOutput`, so any failure falls through to the
   fused retrieval order and the stored `ranker` value records `rerank:none` for that run.

No account setting replaces application isolation. Each request contains candidates for exactly one tenant. Serialize
only the fields needed to rank: opaque candidate ID, resource type, title, short description, selected tags, and section
context. Exclude shop domain, customer data, credentials, prices unless required by the objective, and full documents
when concise extracts suffice.

## Benchmark design

Build a versioned evaluation set from real or realistically seeded stores, with explicit permission and tenant labels.
Each case contains one source section, one objective, a prefiltered candidate pool, relevance judgments, prohibited
destinations, locale, and expected diversity attributes.

Cover at least:

- direct product use and comparison intent;
- informational sections where no commercial link is appropriate;
- closely related and tangential further-reading intent;
- near-duplicate articles and products;
- unavailable, unpublished, deleted, self, and wrong-locale negatives;
- sparse catalogs and large catalogs;
- non-English and mixed-language content supported by target merchants;
- adversarial text inside synchronized descriptions.

Evaluate each objective separately. Crosslinks favor contextual and commercial utility. Further reading favors learning
progression, novelty, and destination diversity.

### Metrics

- hard-constraint violations, which must remain zero because filtering precedes ranking;
- NDCG at 5 and precision at 3 against graded judgments;
- no-link accuracy when every candidate is unsuitable;
- destination and resource-type diversity;
- merchant acceptance, edit, and rejection rates in later online evaluation;
- p50, p95, and p99 latency;
- cost per recommendation set;
- timeout, error, and fallback rates;
- quality by locale and catalog-size cohort.

Review disagreements between rankers manually. Do not select a service from aggregate relevance alone if it materially
degrades a supported locale or the no-link cases.

## Acceptance gate

Set numeric budgets in the benchmark task before running it. The gate must include:

- a material quality improvement over the hybrid baseline on at least one target objective;
- no statistically or operationally meaningful regression on the other objective or a decision to use objective-specific
  rankers;
- zero eligibility violations in the constructed request and returned result;
- acceptable tail latency and cost at projected traffic;
- successful timeout and malformed-response fallback;
- completed privacy and security gates.

If Cohere does not pass, keep the hybrid baseline in production and benchmark the next concrete candidate. Reranking is
an optimization, not a launch dependency for synchronization, retrieval, review, or deterministic insertion.

## Operational contract

The reranker adapter accepts an already filtered single-tenant candidate array and returns candidate IDs in order with
provider metadata. It cannot add candidates. Validate returned indices, uniqueness, and cardinality before use.

Use a short, bounded response-start timeout and no automatic replay unless the error is demonstrably transient and the
request is idempotent. On failure, record the reason, use deterministic hybrid ordering, and continue the merchant
workflow. Version the candidate serialization, model, and ranking configuration for reproducible evaluation.

## References

- [Cohere Rerank API v2](https://docs.cohere.com/reference/rerank)
- [Cohere Enterprise Data Commitments](https://cohere.com/enterprise-data-commitments)
- [Cohere Privacy Policy](https://cohere.com/privacy)
- [Link intelligence architecture](./link-intelligence-architecture.md)
