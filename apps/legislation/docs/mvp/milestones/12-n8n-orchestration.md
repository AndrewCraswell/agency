# Milestone 12: n8n ingestion orchestration

## Goal

Automate schedules, sequencing, retries, and operational visibility while keeping legislative logic in TypeScript.

## Tasks

### n8n deployment

- [x] **M12.1** Provision one n8n instance in the legislation Azure environment.
- [x] **M12.2** Configure n8n persistence in its dedicated PostgreSQL database.
- [x] **M12.3** Store n8n encryption and runtime secrets in Key Vault.
- [x] **M12.4** Restrict editor access and runtime network exposure appropriately.
- [x] **M12.5** Configure backups and document restore steps for n8n configuration state.
- [x] **M12.6** Confirm queue mode, Redis, and separate n8n workers remain disabled for MVP.

### Job invocation contract

- [x] **M12.7** Define how n8n invokes TypeScript jobs, including command, job ID, parameters, and environment.
- [x] **M12.8** Define a structured job result containing status, counts, checkpoint, failure summary, and correlation ID.
- [x] **M12.9** Make every job independently idempotent before it is scheduled.
- [x] **M12.10** Define maximum execution time and retry policy by job type.
- [x] **M12.11** Prevent an n8n retry from bypassing application-level checkpoints or locks.
- [x] **M12.12** Implement mutual exclusion or safe overlap behavior for each workflow.

### Workflows

- [x] **M12.13** Create the Open States bootstrap or refresh workflow.
- [x] **M12.14** Create the GovInfo bootstrap workflow with configurable Congress range.
- [x] **M12.15** Create the Congress incremental synchronization workflow.
- [x] **M12.16** Create the pending-document processing workflow.
- [x] **M12.17** Create the missing-or-stale embedding workflow.
- [x] **M12.18** Create a coverage-report workflow after corpus-changing runs.
- [ ] **M12.19** Sequence downstream document and embedding work without embedding business logic in n8n nodes.
- [ ] **M12.20** Add manual inputs for bounded backfill, targeted retry, and dry-run operations.

### Failure handling and operations

- [x] **M12.21** Configure retry only for categories the underlying job marks as retryable.
- [x] **M12.22** Surface partial failures rather than treating a successful process exit as complete success.
- [x] **M12.23** Retain correlation IDs between n8n executions and application ingestion runs.
- [x] **M12.24** Define operator notifications or dashboards using existing Azure capabilities without adding Novu.
- [x] **M12.25** Document how to pause schedules, replay a failed range, and verify the resulting checkpoint.
- [x] **M12.26** Export workflow JSON into `apps/legislation/workflows` and make deployment repeatable.
- [ ] **M12.27** Test interrupted, retried, overlapping, and manually replayed workflows against disposable data.
- [ ] **M12.28** Run a complete bootstrap-to-searchable-corpus orchestration in staging.

## Exit criteria

- Production data can remain current without manual command execution.
- Workflow retries and replays do not duplicate or skip data.
- All legislative parsing, normalization, SQL, processing, embedding, and search logic remains in TypeScript.
