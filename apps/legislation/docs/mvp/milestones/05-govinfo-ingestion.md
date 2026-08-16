# Milestone 5: GovInfo federal historical bootstrap

## Goal

Create a configurable historical federal corpus from official GovInfo bulk data.

## Tasks

### Coverage and acquisition

- [ ] **M5.1** Confirm the GovInfo collections and structured formats required for bill metadata, status, and versions.
- [ ] **M5.2** Document gaps and overlap among the selected collections.
- [ ] **M5.3** Implement configuration for start Congress, end Congress, and bill types.
- [ ] **M5.4** Implement package or bulk-file discovery for the configured range.
- [ ] **M5.5** Implement resumable downloads with bounded concurrency, timeouts, retries, and rate-limit handling.
- [ ] **M5.6** Validate downloaded packages using available metadata and content hashes.
- [ ] **M5.7** Store source packages and acquisition metadata in the federal source store.
- [ ] **M5.8** Skip unchanged packages while supporting an explicit forced refresh.

### Parsing and normalization

- [ ] **M5.9** Parse Congress, bill type, bill number, title, summaries, subjects, and dates.
- [ ] **M5.10** Generate the same canonical federal bill ID expected from Congress.gov.
- [ ] **M5.11** Parse sponsors, cosponsors, actions, committees, and status fields available in the selected inputs.
- [ ] **M5.12** Parse official bill versions and their version codes, dates, titles, and source URLs.
- [ ] **M5.13** Parse related legislation and other supported document references.
- [ ] **M5.14** Prefer XML or text while retaining PDF and other official artifact links.
- [ ] **M5.15** Map GovInfo values into the canonical vocabulary without leaking provider types downstream.
- [ ] **M5.16** Record source fields that cannot yet be mapped as diagnostics.

### Persistence and reliability

- [ ] **M5.17** Implement transactional canonical aggregate upserts.
- [ ] **M5.18** Make package and record processing restartable from durable progress.
- [ ] **M5.19** Ensure repeated runs do not duplicate bills, actions, sponsors, relations, or versions.
- [ ] **M5.20** Bound memory, database connections, download concurrency, and disk use.
- [ ] **M5.21** Isolate failed packages and records while continuing safe independent work.
- [ ] **M5.22** Capture per-run discovery, insertion, update, unchanged, skip, and failure totals.

### Validation and reporting

- [ ] **M5.23** Generate coverage by Congress, bill type, and document version.
- [ ] **M5.24** Add fixtures for multiple Congresses, bill types, versions, and sparse packages.
- [ ] **M5.25** Test initial bootstrap, repeat bootstrap, changed package, and interrupted restart.
- [ ] **M5.26** Verify a documented bill sample against GovInfo metadata and official text.
- [ ] **M5.27** Verify multiple versions remain distinct and correctly ordered.
- [ ] **M5.28** Run the configured bootstrap and retain the coverage and failure reports.

## Exit criteria

- The configured federal historical range imports reproducibly.
- Official versions and text references remain attached to one canonical bill.
- Repeated and restarted imports are idempotent.
- Coverage by Congress and bill type is measurable.

