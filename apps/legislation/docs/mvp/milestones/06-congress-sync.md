# Milestone 6: Congress.gov incremental synchronization

## Goal

Keep the canonical federal corpus current without duplicating the GovInfo bootstrap.

## Tasks

### API client

- [x] **M6.1** Confirm Congress.gov endpoints, change-detection fields, pagination, and current rate limits.
- [x] **M6.2** Implement an authenticated client with request timeouts and response validation.
- [x] **M6.3** Implement bounded retry behavior for transient failures and rate limiting.
- [x] **M6.4** Emit actionable failures for invalid credentials, unsupported responses, and exhausted retries.
- [x] **M6.5** Add provider fixtures for successful, sparse, paginated, rate-limited, and malformed responses.

### Checkpoint model

- [x] **M6.6** Define a durable checkpoint that cannot skip updates sharing the same timestamp.
- [x] **M6.7** Define a configurable overlap window to protect against upstream ordering or clock behavior.
- [x] **M6.8** Store checkpoint progress independently from individual bill transactions.
- [x] **M6.9** Advance the durable checkpoint only after all required pages and records are committed.
- [x] **M6.10** Support a dry run and an explicit bounded backfill range.

### Synchronization

- [x] **M6.11** Discover bills changed since the effective checkpoint.
- [x] **M6.12** Fetch complete detail required for changed bills without unnecessary calls for unchanged children.
- [x] **M6.13** Normalize metadata, actions, sponsors, cosponsors, versions, relations, and supported votes.
- [x] **M6.14** Generate the same canonical IDs as the GovInfo importer.
- [x] **M6.15** Upsert new federal bills and update existing GovInfo-created bills transactionally.
- [x] **M6.16** Prevent duplication of actions, sponsors, documents, and relations across overlapping sync windows.
- [x] **M6.17** Preserve official GovInfo document data when Congress.gov omits an equivalent field.
- [x] **M6.18** Mark changed documents for downstream processing and embedding without processing them inline.

### Failure handling and proof

- [x] **M6.19** Record per-page and per-record progress for restartability.
- [x] **M6.20** Retain failed record identifiers and failure categories for targeted replay.
- [x] **M6.21** Make replay of a failed record safe after later successful syncs.
- [x] **M6.22** Record inserted, updated, unchanged, failed, API-call, and rate-limit metrics.
- [x] **M6.23** Test bootstrap followed by sync followed by identical sync.
- [x] **M6.24** Test a later update that adds actions, sponsors, and a version to the same bill.
- [x] **M6.25** Test interruption before and after a page commit and verify no update is skipped.
- [ ] **M6.26** Compare a documented synchronized sample with current Congress.gov records.

## Exit criteria

- GovInfo and Congress.gov converge on one canonical federal bill.
- Repeated, overlapping, and restarted syncs are idempotent and do not skip updates.
- New federal developments are represented and downstream processing is queued correctly.
