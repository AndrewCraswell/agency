# Retrieval dispatch and acceptance

W owns query embedding, ranking, reranking and product retrieval acceptance. M wraps W's HTTPS API, never queries the
database or a model. C owns [routes and input/storage contracts](../../../../packages/legislation-core/docs/engineering/embeddings.md).
I owns [rollout, source evidence and rebuild hold](../../../legislation-ingestion/docs/engineering/embedding-rollout-plan.md).

## Exact MCP query dispatch

The tool chooses a product route; callers cannot choose model providers. W's `LegislationQueryService` executes it.

| MCP tool | Query embedding | Vector rows searched | Candidate handling | Result projection |
| --- | --- | --- | --- | --- |
| `search_bills` | `voyageai/voyage-4`, 1,024 dimensions, `input_type=query` | `bill_embeddings` with `bill-title-summary-subjects` | Retrieve 25, Cohere rerank, requested limit | Canonical bill |
| `search_bill_text` | `openai/text-embedding-3-small`, 1,536 dimensions | `document_section_embeddings` with `document-section-heading-text`, including amendment documents | Retrieve 25, Cohere rerank, requested limit | Section, document, bill and applicable amendment |
| `search_amendments` | `openai/text-embedding-3-small`, 1,536 dimensions | Separate structured `amendment-purpose-description-identifier-fallback` and document-section routes | No reranking; reciprocal-rank fusion and canonical amendment deduplication | Amendment, related bill and passages |
| `search_supporting_materials` | `voyageai/voyage-4`, 1,024 dimensions, `input_type=query` | `supporting_material_section_embeddings` with `supporting-material-section-heading-text` | Preserve embedding rank, no reranking | Material section, material and bill |

Match exact models/dimensions/contracts, not just tables. Cohere is `cohere/rerank-v3.5` with at most 4,000 characters
per candidate. Exact identifiers, `search_amendments_for_bills`, batch relationship reads and structured filters bypass
embedding/reranking. Relational people, organizations, events, actions, votes and dates are not embedded. OCR/native
text share routes but retain extraction provenance. Do not compare raw OpenAI/Voyage similarity scores; future unified
fusion requires independent validation. Change `EMBEDDING_QUERY_ROUTES`, tests and this dispatch together.

## MCP access plan

Promote only a complete retrieve/traverse/deliver surface: lexical/semantic/hybrid amendment/material search; bounded
identifier batches with per-item errors/coverage; exact paged document/material reads; passage-to-bill and applicable
amendment/event/vote/organization links; bounded aggregate child collections; and explicit text/index/vector/model/input
availability with reasons. Every result retains source URL, stored-object reference, content type, extraction/OCR and
document date. Public delivery URLs stay independent from ranking; do not sign intentionally public artifacts.

Use identical frozen judgments for API and MCP acceptance, adding batching, paging, sparse/unembedded coverage,
source projection, public delivery and tool-call counts for representative research questions.

## Evaluation and promotion

A model/reranker change needs at least 0.02 absolute nDCG@10 improvement without meaningful recall regression on the
product-specific canary, reproduced through MCP. This is not authorization to embed the corpus. Preserve the cohort,
manifest and provider/cost evidence in I; query IDs, filters, graded relevant IDs, class and treatment/control assignment
must remain frozen. Evaluate lexical, semantic and hybrid through M-to-W, not just direct SQL.

Report recall at 5/10/25, precision at 10, MRR/nDCG@10, treatment/control/query/jurisdiction/record strata, filter/source
errors and latency by mode. Link I's provider tokens/requests/retries/cost, database/WAL/backup growth, throughput and
refresh idempotency. Partial semantic coverage must be explicit.

The canary requires:

1. Bill discovery capacity-adjusted Recall@10 >= 90 percent, with ordinary recall also reported because over eleven
   relevant records cannot reach 90 percent ordinary recall at ten.
2. Semantic bill-passage Recall@10 >= 80 percent.
3. Amendment and supporting-material Recall@10 >= 80 percent each before expansion.
4. Sparse bill/identifier-only amendment strata within the predeclared 15-percentage-point gap from rich strata.
5. Hybrid treatment recall improves by a meaningful predeclared margin over lexical.
6. Unembedded control hybrid recall does not materially regress from lexical.
7. Exact phrases, filters, pagination and attribution do not regress.
8. Every hit resolves to canonical records with agency and stored-object provenance where available.
9. Cost/storage growth stays within approved projections.
10. Retries, latency, database load and index maintenance remain acceptable.

Stop after an inconclusive canary and keep lexical, rather than widening to compensate. Regulatory search has its own
[query and promotion contract](../regulations/legal-search-serving.md), not inherited bill-model acceptance.