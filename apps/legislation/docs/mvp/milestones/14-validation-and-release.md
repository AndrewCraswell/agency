# Milestone 14: Corpus validation, MCP evaluation, and production release

## Goal

Prove that the corpus is correct, the tools are useful, and the Azure deployment can operate safely in production.

## Tasks

### Automated quality gates

- [x] **M14.1** Require format, lint, type-check, unused-code, unit, integration, and coverage checks through `pnpm verify`.
- [x] **M14.2** Add deterministic parser and normalization tests for retained provider fixtures.
- [x] **M14.3** Add database tests for constraints, migrations from zero, transactions, and idempotent upserts.
- [x] **M14.4** Add ingestion restart and replay tests for all three providers.
- [x] **M14.5** Add document-processing golden tests across the supported format matrix.
- [x] **M14.6** Add retrieval regression tests for exact, conceptual, filtered, passage, and negative queries.
- [x] **M14.7** Add query-service and MCP contract tests for all seven tools.
- [x] **M14.8** Add authentication tests for allowed and rejected token cases.
- [x] **M14.9** Add deployment smoke tests for health, readiness, database, storage, authentication, and a representative tool call.

### Corpus validation

- [ ] **M14.10** Generate the final state coverage report by jurisdiction and session.
- [ ] **M14.11** Generate the final federal coverage report by Congress and bill type.
- [ ] **M14.12** Compare coverage with discovered upstream archives and explain every material gap.
- [x] **M14.13** Detect duplicate canonical bills, actions, sponsors, votes, documents, and sections.
- [x] **M14.14** Detect orphaned children, invalid relations, empty required fields, and impossible date ordering.
- [x] **M14.15** Measure document acquisition, extraction, segmentation, and embedding completion rates.
- [ ] **M14.16** Verify a stratified sample across jurisdictions, Congresses, sessions, document formats, and bill complexity.
- [x] **M14.17** Record known upstream limitations separately from implementation defects.

### MCP evaluation set

- [x] **M14.18** Create evaluation prompts for known-bill lookup and detail retrieval.
- [x] **M14.19** Create evaluation prompts for exact topical and statutory-term discovery.
- [x] **M14.20** Create evaluation prompts for conceptual discovery without shared wording.
- [x] **M14.21** Create evaluation prompts for legislative timelines and status changes.
- [x] **M14.22** Create evaluation prompts for passage search within long documents.
- [x] **M14.23** Create evaluation prompts for version comparison and changed-section identification.
- [x] **M14.24** Create evaluation prompts for explicit and semantic related-bill discovery.
- [x] **M14.25** Include cross-jurisdiction, sparse-data, ambiguous-identifier, no-result, and oversized-result cases.
- [x] **M14.26** Define expected evidence, relevant bills or passages, acceptable tool paths, and failure conditions for each case.

### Agent and human evaluation

- [ ] **M14.27** Run the evaluation set through at least two supported MCP-capable clients.
- [ ] **M14.28** Record tool selection, tool arguments, retrieved evidence, answer correctness, citations, latency, and failures.
- [ ] **M14.29** Score known-item recall, passage relevance, unsupported claims, source usage, and task completion.
- [ ] **M14.30** Have a human reviewer inspect a representative sample against official source records.
- [ ] **M14.31** Classify failures as corpus, normalization, processing, retrieval, contract, client, or evaluation defects.
- [ ] **M14.32** Fix release-blocking defects and rerun the affected evaluation slice.
- [ ] **M14.33** Publish the final evaluation baseline and known limitations.

### Performance and resilience

- [x] **M14.34** Define production service-level targets for tool latency, error rate, and scheduled sync completion.
- [ ] **M14.35** Load-test representative cheap, expensive, and large-result tool calls.
- [ ] **M14.36** Validate database pool behavior and Container Apps scaling under expected concurrency.
- [ ] **M14.37** Validate provider rate-limit behavior and embedding batch throttling.
- [ ] **M14.38** Validate timeout, cancellation, retry, and graceful-shutdown behavior.
- [ ] **M14.39** Restore PostgreSQL and n8n configuration from backups in a non-production environment.
- [ ] **M14.40** Verify recovery from a failed deployment and document rollback or forward-fix procedures. The checked
  evidence validator and runbook are ready; this task remains open until a disposable unhealthy revision is recovered.

### Production release

- [ ] **M14.41** Review Bicep what-if output for production.
- [ ] **M14.42** Verify production secrets, managed identities, least-privilege assignments, TLS, and network controls.
- [ ] **M14.43** Deploy database extensions and the canonical migration baseline.
- [ ] **M14.44** Deploy the MCP, ingestion, and n8n runtimes from immutable image references.
- [ ] **M14.45** Run the configured historical state and federal bootstraps.
- [ ] **M14.46** Run document processing and embedding workflows to the agreed completion threshold.
- [ ] **M14.47** Enable Congress.gov incremental sync and other approved schedules.
- [ ] **M14.48** Run authenticated production smoke tests for all seven MCP tools.
- [ ] **M14.49** Verify Azure alerts, Langfuse traces, coverage reports, and operator runbooks. The alert rules and
  evidence validator are checked in; live fired-and-resolved evidence remains required.
- [ ] **M14.50** Record release version, image digests, migration state, corpus coverage, evaluation baseline, and known limitations.

## Exit criteria

- Root verification and all legislation-specific tests pass.
- Coverage gaps, processing gaps, and known upstream limitations are documented.
- At least two MCP-capable clients complete the representative research flows with acceptable evidence and accuracy.
- Production is reproducible from Bicep, authenticated through WorkOS, observable, backed up, and smoke-tested.
- The release record contains enough evidence to reproduce and audit the deployment.
