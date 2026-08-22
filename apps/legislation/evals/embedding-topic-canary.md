# Broad-topic embedding canary

## Decision

Promote pure semantic bill retrieval to the next bounded rollout stage. Do not add reranking or make hybrid retrieval
the default. Keep the full-corpus rollout paused until embeddings move to dedicated tables and the existing partial
embedding coverage is reconciled.

## Cohort

- Ten broad policy topics, each constrained to one jurisdiction and legislative session.
- 148 exhaustive, taxonomy-backed relevance judgments within those scopes.
- 122 previously unembedded treatment bills received a vector.
- 26 control bills remained unembedded throughout the evaluation.
- No document-section or supporting-material vectors were created by this canary.

The manifest is [embedding-topic-canary.json](./embedding-topic-canary.json). Results are stored in the adjacent
`lexical`, `semantic`, and `hybrid` JSON files. All expected bills carry an explicit relevance grade. This first broad
set uses the source's exact subject classification as the positive judgment; future pools should add human grades for
related-but-not-identically-tagged results.

## Results

| Mode     | Treatment Recall@5 | Treatment Recall@10 | Treatment Recall@25 | Capacity-adjusted Recall@10 | Precision@10 |   MRR | nDCG@10 | Warm mean latency |
| -------- | -----------------: | ------------------: | ------------------: | --------------------------: | -----------: | ----: | ------: | ----------------: |
| Lexical  |               1.8% |                1.8% |                1.8% |                        2.0% |        10.0% | 0.150 |   0.036 |             72 ms |
| Semantic |              41.3% |               82.7% |              100.0% |                      100.0% |       100.0% | 1.000 |   1.000 |            347 ms |
| Hybrid   |              38.7% |               80.1% |              100.0% |                       97.0% |        97.0% | 0.950 |   0.955 |            411 ms |

Raw Recall@10 is below 90 percent because nine of the ten topics have more than ten relevant treatment bills. Ten result
slots cannot return all 11 to 13 relevant bills. Capacity-adjusted recall divides by the smaller of the result limit and
the number of relevant bills; semantic search filled every available top-10 slot with a judged relevant bill.

The control cohort's Recall@25 was 10.3 percent in both lexical and hybrid modes and zero in semantic mode. This is the
expected partial-coverage behavior: semantic search cannot retrieve an unembedded control, while hybrid preserves the
lexical control contribution. No mode produced a tool error or a result without source attribution.

## Provider usage

- 122 vectors created.
- 27,781 prompt tokens reported by the provider.
- 122 successful requests, with zero retries, failures, or rate limits.
- Estimated embedding cost: approximately $0.00056 at $0.02 per million tokens.

## Existing coverage discovered

The preflight found 429,261 bills already carrying `openai/text-embedding-3-small` vectors from historical runs on
2026-08-17 and 2026-08-18. They were not created by this canary. The first candidate holdout overlapped that historical
coverage and was rejected before evaluation. The accepted cohort was regenerated entirely from previously unembedded
bills, then rechecked after seeding to prove 122 embedded treatments and 26 unembedded controls.

## Next gate

1. Create dedicated, foreign-keyed embedding tables under the `legislation` schema.
2. Inventory and migrate or deliberately discard the 429,261 inline historical vectors without issuing new provider
   requests.
3. Run a larger human-judged pool that grades related results not covered by exact source subjects.
4. Repeat the semantic and lexical measurements through the MCP boundary after the storage migration.
5. Approve a bounded historical rollout only if recall, latency, storage growth, and cost remain within the recorded
   limits.
