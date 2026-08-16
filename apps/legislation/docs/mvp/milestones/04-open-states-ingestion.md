# Milestone 4: Open States historical ingestion

## Goal

Populate the supported nationwide state legislative corpus from Open States bulk data.

## Tasks

### Source acquisition

- [ ] **M4.1** Confirm the Open States archive endpoints and file formats used by the importer.
- [ ] **M4.2** Implement archive discovery by jurisdiction and session.
- [ ] **M4.3** Compare discovered archives with the configured coverage policy.
- [ ] **M4.4** Implement resumable archive download with timeouts, retries, and bounded concurrency.
- [ ] **M4.5** Validate HTTP status, content length when available, archive format, and checksum or content hash.
- [ ] **M4.6** Store source archives and acquisition metadata in the configured source store.
- [ ] **M4.7** Skip unchanged archives safely while allowing an explicit forced refresh.

### Parsing and normalization

- [ ] **M4.8** Parse jurisdiction and session metadata.
- [ ] **M4.9** Parse bill identifiers, titles, abstracts, classifications, subjects, and source links.
- [ ] **M4.10** Parse actions while preserving their upstream order and timestamps.
- [ ] **M4.11** Parse sponsors and people, including primary and organization sponsorship where present.
- [ ] **M4.12** Parse votes and individual vote positions.
- [ ] **M4.13** Parse both `versions[]` and `documents[]` into canonical bill documents.
- [ ] **M4.14** Parse related and companion bills.
- [ ] **M4.15** Map provider classifications and statuses into the canonical vocabulary.
- [ ] **M4.16** Retain source URLs and provider IDs needed for audit and future refreshes.
- [ ] **M4.17** Record unsupported or malformed source values as diagnostics without inventing canonical data.

### Persistence and reliability

- [ ] **M4.18** Implement transactional upsert of a bill and its child aggregates.
- [ ] **M4.19** Bound batch size and concurrency to avoid exhausting PostgreSQL connections or memory.
- [ ] **M4.20** Record run totals for discovered, read, inserted, updated, unchanged, skipped, and failed records.
- [ ] **M4.21** Make archive and record processing restartable after interruption.
- [ ] **M4.22** Ensure rerunning an archive does not duplicate actions, sponsors, votes, documents, or relations.
- [ ] **M4.23** Isolate malformed records so one record does not invalidate an entire jurisdiction import.
- [ ] **M4.24** Emit a nonzero partial-failure result when any records remain unprocessed.

### Coverage and validation

- [ ] **M4.25** Generate a machine-readable report by jurisdiction and session.
- [ ] **M4.26** Include bill, action, vote, document, and failure counts in the report.
- [ ] **M4.27** Flag expected archives that were missing or empty.
- [ ] **M4.28** Add fixture tests for different state schemas and sparse records.
- [ ] **M4.29** Add integration tests for initial import, repeated import, changed record, and interrupted restart.
- [ ] **M4.30** Spot-check a documented sample across jurisdictions against the original Open States records.
- [ ] **M4.31** Run the supported corpus import and retain the resulting coverage report as release evidence.

## Exit criteria

- Every configured and available jurisdiction/session imports successfully or has a documented source gap.
- Repeated and restarted imports are idempotent.
- Historical bills with actions, sponsors, votes, versions, documents, and relations are retrievable from PostgreSQL.
- Coverage and failure reports explain exactly what was and was not loaded.

