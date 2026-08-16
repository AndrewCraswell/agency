# Milestone 13: Observability and operational diagnostics

## Goal

Make failures and degraded behavior diagnosable across ingestion, processing, search, MCP, authentication, and Azure.

## Tasks

### Telemetry contract

- [x] **M13.1** Define correlation, trace, ingestion-run, workflow-execution, and request identifiers.
- [x] **M13.2** Define common structured fields for service, environment, operation, status, duration, and error category.
- [x] **M13.3** Define redaction rules for tokens, secrets, source payloads, user identifiers, and legislative text.
- [x] **M13.4** Define log levels and prevent expected validation failures from becoming noisy platform errors.
- [x] **M13.5** Define retention and sampling policies appropriate for development, staging, and production.

### Azure Monitor

- [x] **M13.6** Capture Container Apps stdout and stderr as structured logs.
- [x] **M13.7** Capture request rate, duration, status, timeout, and payload-limit metrics.
- [x] **M13.8** Capture process restarts, CPU, memory, replica count, job duration, and job exit status.
- [x] **M13.9** Capture PostgreSQL availability and connection-pool saturation signals without logging query parameters unsafely.
- [x] **M13.10** Create queries or workbooks for MCP health, ingestion health, document failures, and embedding failures.
- [ ] **M13.11** Add alerts for sustained MCP failures, failed scheduled syncs, stalled checkpoints, and unhealthy infrastructure.
- [x] **M13.12** Document alert ownership, severity, acknowledgement, and recovery evidence.

### Langfuse

- [x] **M13.13** Trace MCP requests and individual tool invocations.
- [x] **M13.14** Attach search mode, sanitized filters, candidate counts, selected passages, and latency.
- [x] **M13.15** Trace embedding batches with provider, model, count, token usage, cost metadata, and failures.
- [x] **M13.16** Attach user and organization correlation according to the privacy contract.
- [x] **M13.17** Link Langfuse traces to Azure correlation IDs.
- [x] **M13.18** Ensure full bill text and credentials are not captured by default.

### Ingestion diagnostics

- [x] **M13.19** Emit records discovered, read, inserted, updated, unchanged, skipped, and failed.
- [x] **M13.20** Emit documents acquired, extracted, sectioned, unchanged, unsupported, and failed.
- [x] **M13.21** Emit embeddings requested, reused, created, rate-limited, retried, and failed.
- [x] **M13.22** Emit checkpoint start, proposed checkpoint, committed checkpoint, and replay window.
- [x] **M13.23** Emit coverage changes and unexpected corpus regressions by jurisdiction or Congress.
- [x] **M13.24** Retain targeted identifiers required to replay failures without logging entire provider records.

### Diagnostic proof

- [ ] **M13.25** Inject a controlled provider timeout and locate it from workflow to ingestion log.
- [ ] **M13.26** Inject a controlled document extraction failure and identify the source document and retry path.
- [ ] **M13.27** Inject a controlled OpenRouter failure and identify the affected embedding batch.
- [x] **M13.28** Inject an invalid MCP request and verify safe client error plus correlated diagnostics.
- [ ] **M13.29** Inject a database outage and distinguish dependency failure from application validation failure.
- [x] **M13.30** Write runbooks for each alert and major failure category.

## Exit criteria

- An operator can identify the failing stage, affected records, correlation path, and safe recovery action.
- Azure Monitor owns operational health while Langfuse owns MCP, retrieval, and embedding traces.
- Diagnostic data is useful without exposing credentials or unnecessary content.
