# Embedding canary v1

## Decision

Proceed with a larger document-section embedding canary. Do not start a full-corpus rollout yet. Do not enable
query-time reranking in the production MCP path yet.

## Cohorts

- Treatment: four bills and ten document sections with current `openai/text-embedding-3-small` vectors.
- Control: two bills confirmed to have no vector.
- Supporting materials: excluded. The canary runner enforces a maximum of zero supporting-material sections.
- Query set: nine fixed paraphrased queries, evaluated through the MCP `search_bills` and `search_bill_text` tools. The
  six known-item bill queries include canonical jurisdiction and session filters. Passage queries include a bill ID.

The manifest is [embedding-canary-v1.json](./embedding-canary-v1.json). Machine-readable results are stored beside it
for lexical, semantic, hybrid, and semantic-rerank modes. The final accepted run is prefixed `embedding-canary-v6`.

## Results

| Mode                 | Recall@5 | Recall@10 | Recall@25 | Precision@10 |   MRR | nDCG@10 | Warm mean latency |
| -------------------- | -------: | --------: | --------: | -----------: | ----: | ------: | ----------------: |
| Lexical              |       0% |        0% |        0% |         0.0% | 0.000 |   0.000 |            133 ms |
| Semantic             |     100% |      100% |      100% |        46.9% | 0.929 |   0.947 |            447 ms |
| Hybrid               |     100% |      100% |      100% |        46.9% | 0.929 |   0.947 |            421 ms |
| Semantic then rerank |     100% |      100% |      100% |        46.9% | 0.833 |   0.876 |            695 ms |

The table reports the final warmed treatment run. Latency is a small-sample observation and is highly affected by cache
warmth. One cold filtered semantic run averaged 7,865 ms before the vector index was warm. Compare ranking quality first
and rerun latency tests at larger sample sizes before setting a production SLO. All returned results had a source URL;
the evaluator recorded zero missing-attribution results in every mode.

## Findings

1. All four treatment bill queries ranked the expected bill first when supplied with their canonical jurisdiction and
   session filters. The three judged treatment passages ranked 2, 1, and 1.
2. The original unfiltered bill queries returned many genuinely relevant bills that were not labeled relevant. The
   earlier 57 percent aggregate therefore measured single-target retrieval for broad queries, not topical search
   quality.
3. Broad topical queries require pooled judgments with multiple graded relevant IDs. They must not reuse the known-item
   success metric.
4. A bounded richer bill-text representation and passage-to-bill candidate projection were tested, produced no
   measurable gain, and were removed. Final vectors and code use the original title, summary, and subject
   representation.
5. Hybrid retrieval did not improve this canary. Reranking preserved recall but reduced MRR and nDCG while adding cost
   and latency, so it remains disabled.
6. The two non-embedded controls remained absent, confirming that the evaluation distinguishes vector-backed and
   non-vector-backed records.

## Provider usage

- Initial embedding seed: 6,118 reported prompt tokens and 12 new vectors. Experimental bill representations were
  reverted to the original canonical inputs. Every provider request completed without a retry, failure, or rate limit.
- Total embedding experimentation remained below one tenth of one cent at $0.02 per million tokens.
- Rerank experiments remained below five cents at $0.001 per search.

## Next gate

Before expanding the treatment cohort:

1. Move vector persistence to the approved dedicated embedding tables under the `legislation` schema. The current inline
   columns are suitable for this bounded experiment but are not the final rollout contract.
2. Add judged queries covering more jurisdictions, bill types, short summaries, missing summaries, OCR-derived sections,
   and semantically similar distractors.
3. Add a separate broad-topic evaluation with pooled, graded relevance judgments rather than a single expected bill.
4. Expand document-section treatment first. Keep supporting-material embeddings deferred.
5. Adopt reranking only if a larger judged set shows a material top-5 or nDCG gain after accounting for its query cost
   and latency.
