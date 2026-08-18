# Development completion roadmap

## Purpose

This is the active task list for completing the legislation development MVP. Completed implementation tasks from the
original milestones are intentionally omitted. Production-only work is deferred to the post-MVP roadmap.

## Phase D1: Orchestration readiness

### Outcome

n8n can start, sequence, observe, and safely replay every corpus job while TypeScript remains the owner of legislative
logic, checkpoints, and retry decisions.

### Tasks

- [ ] **D1.6** Test duplicate triggers, overlapping runs, interruption, retryable failure, partial failure, and targeted
  replay against disposable development data.
- [ ] **D1.7** Run one bounded end-to-end orchestration and retain its execution links, job results, and coverage report.

### Exit gate

A failed or interrupted workflow can be diagnosed and replayed without duplicate records, skipped checkpoints, or
manual database changes.

## Phase D2: Complete corpus ingestion

### Outcome

The supported state and federal corpus is loaded into Railway PostgreSQL with source manifests, coverage reports, and
categorized failures.

### Open States tasks

- [ ] **D2.6** Compare a stratified sample across large, small, recent, older, dense, and sparse jurisdictions with the
  original Open States records.

### Federal tasks

- [ ] **D2.10** Compare a stratified federal sample with GovInfo metadata and official bill text.
- [ ] **D2.11** Run Congress.gov incremental synchronization from the recorded checkpoint with the configured overlap
  window.
- [ ] **D2.12** Compare synchronized bills and versions with current Congress.gov records and prove that GovInfo and
  Congress.gov converge on the same canonical IDs. Audit exact URL duplicates and semantic duplicates by canonical
  bill, version code, and content hash; explain any distinct official formats retained for the same version.

### Corpus proof tasks

- [ ] **D2.14** Compare discovered upstream artifacts with database coverage and explain every material gap.
- [ ] **D2.15** Publish the final discovery manifests, coverage reports, failure reports, validation output, sampled
  comparisons, command parameters, run IDs, and timestamps as the corpus completion report.

### Exit gate

Every discovered in-policy artifact is imported successfully or appears in the completion report with a specific,
actionable explanation. Rerunning the imports changes no canonical records unless the upstream content changed.

## Phase D3: Searchable document corpus

### Outcome

Official documents become trustworthy searchable sections with complete, reproducible embeddings.

### Tasks

- [ ] **D3.1** Inventory every document by source, format, version status, acquisition state, extraction state, section
  count, and embedding state before processing.
- [ ] **D3.2** Run pending-document processing in bounded batches until every available document reaches a terminal state.
- [ ] **D3.3** Replay retryable acquisition and extraction failures and retain unsupported or upstream-missing artifacts
  as categorized exceptions.
- [ ] **D3.4** Manually compare a stratified sample of XML, HTML, text, and PDF extraction plus legal section boundaries
  with the official documents.
- [ ] **D3.5** Run embedding refresh for every missing or stale bill and section embedding using
  `openai/text-embedding-3-small` at 1,536 dimensions.
- [ ] **D3.6** Verify that unchanged content is not downloaded, extracted, sectioned, or embedded again.
- [ ] **D3.7** Measure acquisition, extraction, fallback segmentation, empty text, low text, and embedding completion by
  source and document format.
- [ ] **D3.8** Meet the development gates: 100 percent of available documents attempted, 100 percent of failures
  categorized, at least 95 percent of acquired supported documents yielding searchable text, and at least 99 percent of
  successfully extracted sections embedded.
- [ ] **D3.9** Investigate every source or format cohort below a gate, fix release-blocking defects, and rerun only the
  affected slice.
- [ ] **D3.10** Publish the processing report, embedding report, sampled review, exceptions, model identifier, and content
  hashes.
- [ ] **D3.12** Identify and reprocess California `billPdf` false successes, malformed artifacts, and retryable download
  failures after D3.11 passes a representative canary.
- [ ] **D3.13** Normalize non-standard source content-type labels such as Alaska's bare `pdf` value only when artifact
  signatures confirm the real format, then reprocess the affected records.
- [ ] **D3.14** Split transient download failures into timeout, DNS, connection, rate-limit, and upstream 5xx reasons;
  retain bounded retry, host-fair scheduling, and per-host circuit breaking. Failure taxonomy and bounded retry are
  complete; fleet-wide host-fair selection and circuit-breaking evidence remain open because sorted shard queues can
  still concentrate workers on one publisher.
- [ ] **D3.20** Inventory unsupported office, rich-text, image, and archive formats by MIME type and extension, then add
  one bounded extractor at a time only where the corpus volume justifies it.
- [ ] **D3.24** Publish a post-remediation document-quality report with counts by jurisdiction, host, format, failure
  reason, and disposition; require representative canaries before restoring full worker concurrency.

The failure baseline, disposition rules, and per-class acceptance criteria are in
[Document failure remediation](../document-failure-remediation.md).

### Exit gate

The corpus meets every documented processing gate, and each exception is attributable to a specific source limitation
or a non-blocking known defect.

## Phase D4: MCP usefulness evaluation

### Outcome

Authenticated clients can use all seven tools to perform accurate, source-grounded legislative research over the live
development corpus.

### Tasks

- [ ] **D4.1** Run authenticated smoke tests for `search_bills`, `get_bill`, `get_bill_timeline`, `search_bill_text`,
  `get_bill_text`, `compare_bill_versions`, and `find_related_bills` against nonempty live data.
- [ ] **D4.2** Verify each tool's result identifiers, official links, pagination, truncation, empty-result behavior, and
  safe errors.
- [ ] **D4.3** Run the evaluation set through the already-connected MCP client and retain tool calls, arguments, evidence,
  latency, and final answers.
- [ ] **D4.4** Connect a second MCP-capable client through WorkOS staging and repeat the same evaluation set.
- [ ] **D4.5** Score known-item recall, exact and conceptual discovery, passage relevance, version comparison, related-bill
  relevance, source use, unsupported claims, latency, and task completion.
- [ ] **D4.6** Have a human reviewer verify the stratified evaluation sample against official source records.
- [ ] **D4.7** Classify failures as corpus, normalization, processing, retrieval, tool contract, authentication, client, or
  evaluation defects.
- [ ] **D4.8** Fix release-blocking defects and rerun the affected evaluation slice in both clients.
- [ ] **D4.9** Publish the evaluation baseline, client compatibility record, and known limitations.

### Exit gate

Both clients complete every representative research flow, all seven tools return grounded results, and no known
release-blocking correctness or authentication defect remains.

## Phase D5: Development release candidate

### Outcome

The development environment is reproducible, observable, recoverable, and ready to become the baseline for product work.

### Tasks

- [ ] **D5.2** Inject controlled provider timeout, extraction failure, OpenRouter failure, and database outage scenarios;
  trace each from n8n through application diagnostics and its documented recovery action.
- [ ] **D5.3** Load-test representative cheap, expensive, and large-result MCP calls against the populated corpus and
  record latency, error rate, pool saturation, memory, and scaling behavior.
- [ ] **D5.4** Validate provider throttling, timeout, cancellation, retry, graceful shutdown, and overlapping job behavior.
- [ ] **D5.5** Restore the development PostgreSQL backup and n8n configuration into disposable targets and verify the
  restored service without altering the active environment.
- [ ] **D5.6** Deploy a new immutable image revision, run smoke tests, and prove rollback or forward-fix recovery from a
  deliberately unhealthy revision.
- [ ] **D5.7** Run `pnpm verify`, Bicep build and lint, workflow validation, migration-from-zero, deployment smoke, and all
  seven authenticated MCP smoke tests.
- [ ] **D5.8** Verify Azure logs and alerts, Langfuse traces, retained coverage reports, and operator runbooks.
- [ ] **D5.9** Publish a development completion record containing the commit, image digest, migration state, corpus
  coverage, processing rates, evaluation baseline, performance baseline, active schedules, and known limitations.
- [ ] **D5.10** Freeze the completed development baseline before activating any legislative data expansion phase.

### Exit gate

The development completion record contains enough information to reproduce, operate, evaluate, and recover the environment
without relying on undocumented manual actions.
