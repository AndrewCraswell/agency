# Routed embedding and MCP canary

Evaluated 2026-08-22 against the production PostgreSQL corpus. This canary used the dedicated embedding tables
introduced by migration `0022`. It was initially a bounded gate; the user subsequently approved the complete pass after
the runtime, retrieval, identity, and cost findings below passed review.

## Exact runtime contract

| Product                      | Model                           | Dimensions | Reranker             |
| ---------------------------- | ------------------------------- | ---------: | -------------------- |
| Bills                        | `voyageai/voyage-4`             |      1,024 | `cohere/rerank-v3.5` |
| Bill-document sections       | `openai/text-embedding-3-small` |      1,536 | `cohere/rerank-v3.5` |
| Structured amendments        | `openai/text-embedding-3-small` |      1,536 | None                 |
| Supporting-material sections | `voyageai/voyage-4`             |      1,024 | None                 |

Trigger.dev deployment `20260822.2` ran one bounded `embedding-sync-shard-worker` on shard 0 of 4. It completed ten
64-row batches for every product: 2,560 stored rows, zero failures, zero retries, and zero skips. A separate exact-ID
treatment seed generated four Voyage bill vectors. Ten matching OpenAI document-section vectors were reconciled from the
inline store without another provider request.

## MCP treatment and control

The frozen known-item manifest contains four treatment bills, three treatment passage queries, and two intentionally
unembedded control bills. Semantic requests used the production query service, including selective Cohere reranking.

| Cohort             | Queries | Errors | Recall@10 | nDCG@10 | Mean latency |
| ------------------ | ------: | -----: | --------: | ------: | -----------: |
| Embedded treatment |       7 |      0 |      100% |   0.929 |       744 ms |
| Unembedded control |       2 |      0 |        0% |   0.000 |       360 ms |
| All                |       9 |      0 |     77.8% |   0.722 |       659 ms |

All four treatment bills ranked first. The three passage targets ranked third, first, and first. Every returned result
retained source attribution. The control result proves that pure semantic search does not silently treat a partially
embedded corpus as complete; hybrid or lexical search remains the safe fallback during a staged rollout.

The first passage run exposed missing PostgreSQL planner statistics on the newly populated vector table. The planner
chose a full-corpus join and the three passage requests timed out. `ANALYZE` reduced the filtered join from minutes to
about 200 ms, after which the complete canary passed. The `embedding-index-maintenance` Trigger task now refreshes all
four vector-table statistics after an embedding wave.

## Additional product smoke

The deployed MCP contracts were also exercised against the bounded runtime rows:

- `search_amendments` returned the expected structured amendment in the top ten after independently searching structured
  and document-backed amendment vectors and applying reciprocal-rank fusion; and
- `search_supporting_materials` returned the expected material first with no reranker. Search and detail summaries now
  omit the material's complete inline text; callers retrieve bounded content through the section-based material detail
  contract, avoiding the MCP response-size ceiling.

Machine-readable lexical and semantic results are in the adjacent `embedding-canary.lexical.json` and
`embedding-canary.semantic.json` files. The frozen input manifest is `embedding-canary.json`.

## Promotion decision

The August canary passed its bounded runtime, projection, routing and retrieval checks and supported the mixed-model
decision. It is not current rebuild authorization. The [embedding guide](../docs/engineering/embedding-rollout-plan.md)
owns later coordinator topology, quality gates and the September exact-input integrity hold. Keep this frozen evidence
and its limits; do not rerank amendments/materials or regenerate existing vectors solely from this historical approval.
