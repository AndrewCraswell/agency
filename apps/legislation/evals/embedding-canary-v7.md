# Routed embedding and MCP canary

Evaluated 2026-08-22 against the production PostgreSQL corpus. This canary used the dedicated embedding tables
introduced by migration `0022`; it did not authorize the complete embedding pass.

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

Machine-readable lexical and semantic results are in the adjacent `embedding-canary-v7.lexical.json` and
`embedding-canary-v7.semantic.json` files.

## Promotion decision

The runtime, identity projection, model routing, selective reranking, and partial-coverage behavior pass. The complete
pass should use the mixed model contract above in independent product waves. Keep a control holdout until the first
100,000-row checkpoint and require the larger 23,127-candidate graded bakeoff gains to remain above the 0.02 absolute
nDCG@10 threshold. Do not apply the Cohere reranker to amendments or supporting materials.
