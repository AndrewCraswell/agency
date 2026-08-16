# Milestone 8: Search and embedding infrastructure

## Goal

Support structured, lexical, semantic, and hybrid retrieval over bill metadata and legislative text.

## Tasks

### Search document design

- [ ] **M8.1** Define the bill-level searchable representation from title, summary, subjects, jurisdiction, and session.
- [ ] **M8.2** Define the passage-level searchable representation from document sections and version context.
- [ ] **M8.3** Define searchable language and text-search configuration assumptions.
- [ ] **M8.4** Define ranking signals and deterministic tie-breaking.
- [ ] **M8.5** Define maximum candidate counts before final ranking and response limits.

### Structured and lexical search

- [ ] **M8.6** Add indexes for jurisdiction, session, identifier, classification, status, subjects, dates, and sponsors.
- [ ] **M8.7** Populate and maintain bill FTS vectors.
- [ ] **M8.8** Populate and maintain document-section FTS vectors.
- [ ] **M8.9** Implement exact canonical-ID and normalized-identifier lookup.
- [ ] **M8.10** Implement composable structured filters with predictable null and empty-list behavior.
- [ ] **M8.11** Implement lexical bill search with snippets and ranking.
- [ ] **M8.12** Implement lexical passage search with bill and version context.
- [ ] **M8.13** Test exact phrases, statutory citations, punctuation, stemming, and common stop words.

### Embedding client and jobs

- [ ] **M8.14** Implement the OpenRouter embeddings client with the pinned model and 1,536-dimensional validation.
- [ ] **M8.15** Disable cross-model fallback for embedding requests.
- [ ] **M8.16** Add bounded batching, concurrency, timeouts, and retry behavior.
- [ ] **M8.17** Record provider, model, input hash, dimensions, usage, and failure metadata.
- [ ] **M8.18** Prevent secrets and full sensitive payloads from appearing in logs or traces.
- [ ] **M8.19** Implement bill-level embedding generation.
- [ ] **M8.20** Implement section-level embedding generation.
- [ ] **M8.21** Generate embeddings only when missing or when the searchable input hash changes.
- [ ] **M8.22** Add commands for embedding missing records, a bounded range, one bill, and failed records.
- [ ] **M8.23** Make embedding jobs restartable and safe under overlapping executions.

### Vector and hybrid retrieval

- [ ] **M8.24** Add appropriate pgvector indexes after measuring expected corpus size and query shape.
- [ ] **M8.25** Implement semantic bill search with structured filters applied correctly.
- [ ] **M8.26** Implement semantic passage search with document and version context.
- [ ] **M8.27** Implement a documented hybrid scoring method combining lexical and semantic candidates.
- [ ] **M8.28** Normalize scores so one retrieval mode does not dominate because of incompatible scales.
- [ ] **M8.29** Ensure results remain stable under deterministic tie-breaking.
- [ ] **M8.30** Measure query latency and inspect query plans for representative structured, lexical, semantic, and hybrid cases.

### Retrieval validation

- [ ] **M8.31** Create a retrieval fixture set containing known bills, exact phrases, paraphrases, and irrelevant controls.
- [ ] **M8.32** Verify known-item lookup and identifier normalization.
- [ ] **M8.33** Verify exact terminology and statutory citations with lexical search.
- [ ] **M8.34** Verify conceptual matches without exact wording using semantic search.
- [ ] **M8.35** Verify relevant passages within long documents.
- [ ] **M8.36** Verify jurisdiction, session, date, status, subject, classification, and sponsor filters.
- [ ] **M8.37** Establish baseline recall, precision, and latency measurements for later regression testing.

## Exit criteria

- All four retrieval modes return bounded, source-linked results.
- Exact, conceptual, passage, and filtered test cases meet the documented baseline.
- Embedding work is pinned, incremental, restartable, and observable.

