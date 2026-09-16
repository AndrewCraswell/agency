# Final-passage embedding evaluation protocol

The [frozen protocol](embedding-evaluation-protocol.json) defines the next comparison before new scores are produced.
It does not freeze the unfinished corpus, certify relevance labels or select a model. The prior leading-excerpt
benchmark remains diagnostic evidence and cannot satisfy this protocol. Launch thresholds come from
[search indexing](search-indexing.md); cohort allocations and missing-cohort refusal make those requirements concrete.

Use 60 queries: 30 development and 30 held out, with the seven cohort allocations in the JSON. There is no fine-tuning
split. Freeze source-family assignments before writing queries. All versions, near duplicates and publications from
one rulemaking family stay together; publication/CFR overlaps inherit the same assignment. Previously inspected
diagnostic title families are development-only. Previously inspected questions and answers cannot be renamed into a
new held-out set. Newly inspected held-out material must be replaced before another selection run.
The JSON also excludes title families inspected in the retained search/table pilots; additional discovered exposure
must be recorded before corpus freezing. This exclusion inventory is a minimum, not permission to reuse other known answers.

Freeze 2–512 exact final passage inputs with canonical version, source artifact, preparation/generation, input and
manifest hashes. Both models receive identical bytes and boundaries, and every included whole source version must
qualify with both pinned tokenizers. Use common qualified passages; never drop a difficult version for just one model.
Retain exclusions and their reasons separately. If the selected production pipeline changes those boundaries, repeat
the comparison on its final shared manifest before promotion. No existing vectors or freshness contracts are changed
by freezing this protocol.

Include competing versions, proposal/final pairs, similar obligations in other titles, numerical exceptions and
scope-confounding boilerplate. A federal-only benchmark must not claim state-data quality: use explicit unsupported
scope/no-answer cases until a licensed state corpus exists. Each answerable query cites its exact expected source
evidence; each no-answer declaration requires a documented scope/absence rationale and review. Missing source
coverage blocks a cohort; it is not converted into a convenient no-answer label.

Pool the top 25 candidates from every compared system and known answers missed by all systems. Hide model names and
rank, use deterministic blinded order, and retain reviewer identity, rationale and adjudication. Grade 0 is irrelevant,
1 is context only, 2 partially answers and 3 directly answers. Recall counts grades 2–3; nDCG uses the reviewed graded
labels, including context-only grade 1. Automated suggestions remain explicitly automated. The current smoke runner's
single-known-answer grade-3 diagnostic is insufficient for this gate; reviewed graded scoring still needs integration.

Select on held-out nDCG@10 only after correctness, recall and latency gates pass. Apply the quality floors to every
answerable cohort as well as the aggregate. With four or five queries per cohort these are strict smoke gates, not
precise population estimates: one missed query may fail a cohort. Report query-level failures and sample sizes. An
empty or undersized cohort blocks selection; do not average it away or relax its threshold after seeing results.
Differences below 0.01 are a practical tie; prefer measured recurring cost, then end-to-end p95 latency. Quote the
cost assumptions and measured provider usage separately from local tokenizer counts, including unresolved differences.
Bound each live run, including reranking and its live repeat, to USD 5 with one embedding attempt per request. Resolve
current provider prices before execution; unknown or over-cap estimates block that run. This is an evaluation spending
ceiling, not a claim about current vendor prices or a production pricing recommendation. The diagnostic CLI does not
yet enforce the complete protocol; that binding must be implemented before a run can claim protocol compliance.

No-answer queries retain rankings and score distributions for review but have no recall/nDCG contribution. A ranked
list is not an answer or proof of successful abstention. Report unresolved candidate relevance separately; do not
claim an abstention threshold or answer-generation result this retrieval experiment did not measure. Exact citation
resolution likewise has a separate all-correct identity/version check and cannot inflate topical metrics.

Record PostgreSQL lexical, semantic, hybrid and reranker-on/off configurations. Tune only on development data, then
freeze fusion, filters, candidate depth and reranking before held-out execution. Record latency with 20 concurrent
readers under the measured ingestion profile, warm/cold cache state, query-vector cache behavior, run order, provider
calls, reranker overhead and errors. Local smoke durations are not substitutes for deployed end-to-end measurements.

Every scoring artifact must retain the protocol file's SHA-256, corpus/query/split/judgment hashes and configuration.
Changed labels, sources or rules require a new immutable run and an explanation; retain prior artifacts. Before bulk
embedding, reproduce the unchanged held-out result, run a bounded live provider check and verify a persisted pilot
through authenticated HTTP and API-backed MCP. Human review, full cohort coverage and deployed acceptance remain open.
