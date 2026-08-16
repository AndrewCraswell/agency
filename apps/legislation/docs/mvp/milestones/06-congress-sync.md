# Milestone 6: Congress.gov incremental synchronization

## Goal

Keep the canonical federal corpus current without duplicating the GovInfo bootstrap.

## Tasks

### API client

- [ ] **M6.1** Confirm Congress.gov endpoints, change-detection fields, pagination, and current rate limits.
- [ ] **M6.2** Implement an authenticated client with request timeouts and response validation.
- [ ] **M6.3** Implement bounded retry behavior for transient failures and rate limiting.
- [ ] **M6.4** Emit actionable failures for invalid credentials, unsupported responses, and exhausted retries.
- [ ] **M6.5** Add provider fixtures for successful, sparse, paginated, rate-limited, and malformed responses.

### Checkpoint model

- [ ] **M6.6** Define a durable checkpoint that cannot skip updates sharing the same timestamp.
- [ ] **M6.7** Define a configurable overlap window to protect against upstream ordering or clock behavior.
- [ ] **M6.8** Store checkpoint progress independently from individual bill transactions.
- [ ] **M6.9** Advance the durable checkpoint only after all required pages and records are committed.
- [ ] **M6.10** Support a dry run and an explicit bounded backfill range.

### Synchronization

- [ ] **M6.11** Discover bills changed since the effective checkpoint.
- [ ] **M6.12** Fetch complete detail required for changed bills without unnecessary calls for unchanged children.
- [ ] **M6.13** Normalize metadata, actions, sponsors, cosponsors, versions, relations, and supported votes.
- [ ] **M6.14** Generate the same canonical IDs as the GovInfo importer.
- [ ] **M6.15** Upsert new federal bills and update existing GovInfo-created bills transactionally.
- [ ] **M6.16** Prevent duplication of actions, sponsors, documents, and relations across overlapping sync windows.
- [ ] **M6.17** Preserve official GovInfo document data when Congress.gov omits an equivalent field.
- [ ] **M6.18** Mark changed documents for downstream processing and embedding without processing them inline.

### Failure handling and proof

- [ ] **M6.19** Record per-page and per-record progress for restartability.
- [ ] **M6.20** Retain failed record identifiers and failure categories for targeted replay.
- [ ] **M6.21** Make replay of a failed record safe after later successful syncs.
- [ ] **M6.22** Record inserted, updated, unchanged, failed, API-call, and rate-limit metrics.
- [ ] **M6.23** Test bootstrap followed by sync followed by identical sync.
- [ ] **M6.24** Test a later update that adds actions, sponsors, and a version to the same bill.
- [ ] **M6.25** Test interruption before and after a page commit and verify no update is skipped.
- [ ] **M6.26** Compare a documented synchronized sample with current Congress.gov records.

## Exit criteria

- GovInfo and Congress.gov converge on one canonical federal bill.
- Repeated, overlapping, and restarted syncs are idempotent and do not skip updates.
- New federal developments are represented and downstream processing is queued correctly.

