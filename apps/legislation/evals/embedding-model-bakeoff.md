# Legislative embedding model and input bakeoff

Evaluated 2026-08-22. This evaluation did not write vectors to production tables.

## Corpus and judgments

The immutable manifest contains 3,989 candidates:

| Product                      | Candidates | Queries | Judgment style                                                                 |
| ---------------------------- | ---------: | ------: | ------------------------------------------------------------------------------ |
| Bills                        |        984 |      10 | Exhaustive source-taxonomy judgments inside fixed jurisdiction/session scopes. |
| Bill-document sections       |      2,005 |      10 | Manually selected known passages with paraphrased queries.                     |
| Structured amendments        |        500 |      10 | Manually selected amendment purposes with paraphrased queries.                 |
| Supporting-material sections |        500 |      10 | Manually selected hearing and amendment passages with paraphrased queries.     |

Every configuration searched the same candidates with exact cosine similarity and retained the top 25. Temporary vectors
were discarded after each model. Provider request input and output roles were enabled for models that support them.

`current` means the production-style fields: title/summary/subjects for bills, heading/text for passages, and
purpose/description for amendments. `contextual` adds labeled bill, document, classification, and section context;
sparse bills also received a bounded preferred-document excerpt.

## Results

Bill Recall@10 is ordinary recall and is capacity-limited because several topic queries have more than ten relevant
bills. Capacity-adjusted bill Recall@10 is reported separately.

| Model              | Input      | Dimensions |    Time |   Cost | Bill nDCG@10 | Bill adjusted R@10 | Document nDCG@10 | Amendment nDCG@10 | Material R@10 | Material nDCG@10 |
| ------------------ | ---------- | ---------: | ------: | -----: | -----------: | -----------------: | ---------------: | ----------------: | ------------: | ---------------: |
| OpenAI 3 Small     | current    |      1,536 |  84.0 s | $0.041 |        0.964 |              0.970 |            0.865 |             0.963 |         0.500 |            0.352 |
| OpenAI 3 Small     | contextual |      1,536 |  74.7 s | $0.044 |        0.956 |              0.960 |            0.746 |             0.869 |         0.500 |            0.362 |
| OpenAI 3 Large     | current    |      3,072 | 133.7 s | $0.264 |        0.956 |              0.960 |            0.899 |             0.963 |         0.600 |            0.413 |
| OpenAI 3 Large     | contextual |      3,072 | 121.5 s | $0.289 |        0.943 |              0.940 |            0.825 |             0.906 |         0.700 |            0.505 |
| Voyage 4           | current    |      1,024 |  45.3 s | $0.131 |        0.971 |              0.980 |            0.865 |             0.926 |         0.800 |            0.649 |
| Voyage 4           | contextual |      1,024 |  50.9 s | $0.144 |        0.963 |              0.960 |            0.869 |             0.963 |         0.800 |            0.662 |
| Voyage 4 Large     | current    |      1,024 |  66.7 s | $0.263 |        0.979 |              0.980 |            0.876 |             0.950 |         0.800 |            0.682 |
| Voyage 4 Large     | contextual |      1,024 |  75.0 s | $0.288 |        0.970 |              0.970 |            0.906 |             0.889 |         0.900 |            0.632 |
| Qwen3 Embedding 8B | current    |      4,096 | 378.7 s | $0.022 |        0.963 |              0.950 |            0.889 |             0.913 |         0.900 |            0.711 |
| Qwen3 Embedding 8B | contextual |      4,096 | 509.2 s | $0.024 |        0.987 |              0.980 |            0.926 |             0.906 |         0.800 |            0.656 |
| Gemini Embedding 2 | current    |      3,072 |  43.3 s | $0.431 |        0.944 |              0.930 |            0.839 |             0.963 |         0.800 |            0.586 |
| Gemini Embedding 2 | contextual |      3,072 |  43.1 s | $0.472 |        0.932 |              0.910 |            0.926 |             1.000 |         0.700 |            0.650 |

The cost column is the observed provider cost for this 3,989-record evaluation, including queries. It is not a
full-corpus estimate.

## Decision

Use Voyage 4 as the provisional canary model:

- It tied for the best practical bill capacity-adjusted Recall@10 at 98 percent.
- It used 1,024 dimensions, one quarter of Qwen's vector values per record.
- It was the fastest or nearly fastest configuration while retaining strong quality on every product.
- Voyage 4 Large and Qwen improved some supporting-material rankings, but not enough on this set to justify a second
  production model, higher price, larger vectors, or much slower backfill.

Do not use one input template for every product:

- bills: current title, summary, and subjects performed best; do not append a raw leading document excerpt as a
  sparse-bill fallback;
- document passages: retain section text and heading, adding only stable bill and document context that survives the
  next human-judged test;
- amendments: labeled bill/amendment context improved Voyage 4;
- supporting materials: labeled title/classification context improved Voyage 4 slightly and should advance to the MCP
  canary.

The raw preferred-document excerpt is rejected as the bill fallback. A future sparse-bill experiment may test a
deterministic, source-grounded synopsis, but it must be judged independently before rollout.

## Limits and next gate

This is substantially larger than the first canary, but it is not a final production-quality judgment set. Passage,
amendment, and material queries are known-item paraphrases with one relevant target each; they do not measure all
relevant passages for broad questions. The bill topics are exhaustive only inside their fixed scopes.

Before broad embedding:

1. add human-graded broad and confusable-negative queries for every product;
2. split results by native/OCR, sparse/rich, jurisdiction, session age, and document length;
3. implement semantic/hybrid amendment and supporting-material MCP tools plus document-content retrieval and source
   projection;
4. run Voyage 4 through that deployed MCP boundary with an unembedded control;
5. evaluate Voyage 4 Large only as a supporting-material challenger; and
6. test reranking only after retrieval recall is stable, using the same frozen candidate sets and judgments.

Machine-readable inputs and complete per-query rankings are in
[`embedding-model-bakeoff.json`](embedding-model-bakeoff.json) and
[`embedding-model-bakeoff-results.json`](embedding-model-bakeoff-results.json).
