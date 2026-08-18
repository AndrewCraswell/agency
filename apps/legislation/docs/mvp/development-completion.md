# Development completion roadmap

## Purpose

This is the active task list for completing the legislation development MVP. Completed implementation tasks from the
original milestones are intentionally omitted. Production-only work is deferred to the post-MVP roadmap.

## Phase D1: Orchestration readiness

### Outcome

n8n can start, sequence, observe, and safely replay every corpus job while TypeScript remains the owner of legislative
logic, checkpoints, and retry decisions.

### Tasks

- [x] **D1.1** Reconcile the deployed n8n environment variables, managed identity, ingestion job resource ID, and
  immutable application image reference with the checked-in deployment configuration.
- [x] **D1.2** Re-import the nine checked-in workflows and verify that each stable workflow ID updates instead of creating
  duplicates.
- [x] **D1.3** Add bounded manual inputs for source range, jurisdiction, Congress, bill type, failed-record replay, force
  refresh, and dry run where the underlying command supports them.
- [x] **D1.4** Implement the bootstrap sequence: source ingestion, pending-document processing, stale-embedding refresh,
  and final coverage reporting.
- [x] **D1.5** Pass the workflow execution ID and correlation ID through every Container Apps Job invocation and retain
  the resulting application run ID and summary.
- [ ] **D1.6** Test duplicate triggers, overlapping runs, interruption, retryable failure, partial failure, and targeted
  replay against disposable development data.
- [ ] **D1.7** Run one bounded end-to-end orchestration and retain workflow execution links, job results, and the coverage
  report as evidence.
- [x] **D1.8** Keep schedules inactive until phases D2 and D3 pass; document the exact activation and pause procedure.

### Exit gate

A failed or interrupted workflow can be diagnosed and replayed without duplicate records, skipped checkpoints, or
manual database changes.

## Phase D2: Complete corpus ingestion

### Outcome

The supported state and federal corpus is loaded into Railway PostgreSQL with auditable source artifacts, coverage, and
failure evidence.

### Open States tasks

- [x] **D2.1** Acquire the authenticated Open States session archive manifest programmatically and store the discovery
  result in Blob Storage.
- [x] **D2.2** Compare discovery with the policy set of all 50 states, Washington, D.C., and Puerto Rico from 2017 onward.
- [x] **D2.3** Run the restartable Open States import for every available in-policy archive with bounded concurrency.
- [x] **D2.4** Replay retryable archive and record failures, then classify the remaining failures as upstream gaps or
  implementation defects.
- [x] **D2.5** Generate state coverage by jurisdiction and session, including bills, actions, sponsors, votes, documents,
  failures, missing archives, and empty archives.
- [ ] **D2.6** Compare a stratified sample across large, small, recent, older, dense, and sparse jurisdictions with the
  original Open States records.

### Federal tasks

- [x] **D2.7** Discover and retain the GovInfo BILLSTATUS package manifest for the 113th through 119th Congresses and the
  configured bill types.
- [x] **D2.8** Run the restartable GovInfo bootstrap for all discovered packages and replay retryable failures.
- [x] **D2.9** Generate federal coverage by Congress, bill type, bill count, official version count, and failure category.
- [ ] **D2.10** Compare a stratified federal sample with GovInfo metadata and official bill text.
- [ ] **D2.11** Run Congress.gov incremental synchronization from the recorded checkpoint with the configured overlap
  window.
- [ ] **D2.12** Compare synchronized bills and versions with current Congress.gov records and prove that GovInfo and
  Congress.gov converge on the same canonical IDs. Audit exact URL duplicates and semantic duplicates by canonical
  bill, version code, and content hash; explain any distinct official formats retained for the same version.

### Corpus proof tasks

- [x] **D2.13** Run duplicate, orphan, required-field, relation, ordering, and impossible-date validation across the full
  database.
- [ ] **D2.14** Compare discovered upstream artifacts with database coverage and explain every material gap.
- [ ] **D2.15** Store the final discovery manifests, coverage reports, failure reports, validation output, sample record,
  command parameters, run IDs, and timestamps as one development corpus evidence bundle.

### Exit gate

Every discovered in-policy artifact is imported successfully or appears in the evidence bundle with a specific,
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
- [ ] **D3.10** Store the processing report, embedding report, sampled review, exceptions, model identifier, and content
  hashes in the development evidence bundle.
- [x] **D3.11** Fix California's JavaScript-driven `billPdf` acquisition so the stored artifact is the actual PDF, and
  reject download forms, navigation shells, and other publisher chrome as successful bill text.
- [ ] **D3.12** Identify and reprocess California `billPdf` false successes, malformed artifacts, and retryable download
  failures after D3.11 passes a representative canary.
- [ ] **D3.13** Normalize non-standard source content-type labels such as Alaska's bare `pdf` value only when artifact
  signatures confirm the real format, then reprocess the affected records.
- [x] **D3.14** Split transient download failures into timeout, DNS, connection, rate-limit, and upstream 5xx reasons;
  retain bounded retry, host-fair scheduling, and per-host circuit breaking.
- [x] **D3.15** Add a `source-inaccessible` terminal disposition for documents whose recorded host is retired,
  unresolvable, or no longer serves the artifact; retain the source URL and last access result without repeatedly
  retrying it.
- [x] **D3.16** Reclassify image-only PDFs and raster documents as `ocr-required`, exclude them from ordinary text
  extraction retries, and defer OCR implementation to a later milestone.
- [x] **D3.17** Distinguish genuinely corrupt or truncated PDFs from HTML/XML publisher intermediaries using signature,
  structural, and minimum-content checks before extraction.
- [x] **D3.18** Record source 404 and 410 responses as terminal `not-found` results while allowing a later upstream URL
  change to make the document eligible again.
- [x] **D3.19** Resolve unsafe or unsupported URL schemes without weakening SSRF protections; use an approved HTTPS URL
  supplied by the existing provider when available, otherwise mark the artifact `source-inaccessible`.
- [ ] **D3.20** Inventory unsupported office, rich-text, image, and archive formats by MIME type and extension, then add
  one bounded extractor at a time only where the corpus volume justifies it.
- [x] **D3.21** Keep oversized artifacts terminal with the observed byte count and configured limit, and verify that a
  single oversized download cannot consume a worker or hold a processing lease indefinitely.
- [x] **D3.22** Retry processing-transient failures without downloading an unchanged valid artifact again, and make
  parser exceptions observable by extractor and format. The retained cohort audit found 39 deterministic corrupt
  archive/root-reference failures, moved them to terminal `malformed-document`, and left zero processing-transient rows.
- [x] **D3.23** Deterministically classify legacy failed and unsupported rows that predate structured failure categories;
  requeue only rows mapped to a repaired, retryable class.
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

- [x] **D5.1** Add Azure alerts for sustained MCP failures, readiness failure, failed scheduled syncs, stalled
  checkpoints, document failure rate, embedding backlog, and infrastructure health.
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
- [ ] **D5.8** Verify Azure logs and alerts, Langfuse traces, coverage reports, evidence retention, and operator runbooks.
- [ ] **D5.9** Publish a development completion record containing the commit, image digest, migration state, corpus
  coverage, processing rates, evaluation baseline, performance baseline, active schedules, and known limitations.
- [ ] **D5.10** Freeze the completed development baseline before activating any legislative data expansion phase.

### Exit gate

The development completion record contains enough evidence to reproduce, operate, evaluate, and recover the environment
without relying on undocumented manual actions.
