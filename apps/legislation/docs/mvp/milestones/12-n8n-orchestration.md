# Milestone 12: n8n ingestion orchestration

## Goal

Automate schedules, sequencing, retries, and operational visibility while keeping legislative logic in TypeScript.

## Tasks

### n8n deployment

- [ ] **M12.1** Provision one n8n instance in the legislation Azure environment.
- [ ] **M12.2** Configure n8n persistence in its dedicated PostgreSQL database.
- [ ] **M12.3** Store n8n encryption and runtime secrets in Key Vault.
- [ ] **M12.4** Restrict editor access and runtime network exposure appropriately.
- [ ] **M12.5** Configure backups and document restore steps for n8n configuration state.
- [ ] **M12.6** Confirm queue mode, Redis, and separate n8n workers remain disabled for MVP.

### Job invocation contract

- [ ] **M12.7** Define how n8n invokes TypeScript jobs, including command, job ID, parameters, and environment.
- [ ] **M12.8** Define a structured job result containing status, counts, checkpoint, failure summary, and correlation ID.
- [ ] **M12.9** Make every job independently idempotent before it is scheduled.
- [ ] **M12.10** Define maximum execution time and retry policy by job type.
- [ ] **M12.11** Prevent an n8n retry from bypassing application-level checkpoints or locks.
- [ ] **M12.12** Implement mutual exclusion or safe overlap behavior for each workflow.

### Workflows

- [ ] **M12.13** Create the Open States bootstrap or refresh workflow.
- [ ] **M12.14** Create the GovInfo bootstrap workflow with configurable Congress range.
- [ ] **M12.15** Create the Congress incremental synchronization workflow.
- [ ] **M12.16** Create the pending-document processing workflow.
- [ ] **M12.17** Create the missing-or-stale embedding workflow.
- [ ] **M12.18** Create a coverage-report workflow after corpus-changing runs.
- [ ] **M12.19** Sequence downstream document and embedding work without embedding business logic in n8n nodes.
- [ ] **M12.20** Add manual inputs for bounded backfill, targeted retry, and dry-run operations.

### Failure handling and operations

- [ ] **M12.21** Configure retry only for categories the underlying job marks as retryable.
- [ ] **M12.22** Surface partial failures rather than treating a successful process exit as complete success.
- [ ] **M12.23** Retain correlation IDs between n8n executions and application ingestion runs.
- [ ] **M12.24** Define operator notifications or dashboards using existing Azure capabilities without adding Novu.
- [ ] **M12.25** Document how to pause schedules, replay a failed range, and verify the resulting checkpoint.
- [ ] **M12.26** Export workflow JSON into `apps/legislation/workflows` and make deployment repeatable.
- [ ] **M12.27** Test interrupted, retried, overlapping, and manually replayed workflows against disposable data.
- [ ] **M12.28** Run a complete bootstrap-to-searchable-corpus orchestration in staging.

## Exit criteria

- Production data can remain current without manual command execution.
- Workflow retries and replays do not duplicate or skip data.
- All legislative parsing, normalization, SQL, processing, embedding, and search logic remains in TypeScript.

