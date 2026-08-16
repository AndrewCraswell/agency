# Milestone 3: Canonical legislative data model

## Goal

Create the source-independent model into which state and federal data converge without duplicate bills.

## Tasks

### Domain vocabulary

- [x] **M3.1** Inventory representative concepts and fields from Open States, GovInfo, and Congress.gov fixtures.
- [x] **M3.2** Define canonical jurisdiction, session, chamber, bill classification, action, vote, document, and relation terms.
- [x] **M3.3** Define mapping rules for provider values that do not have an exact canonical equivalent.
- [x] **M3.4** Define how unknown, missing, and not-applicable values differ.
- [x] **M3.5** Define date precision and timezone rules for dates without complete timestamps.

### Identifiers

- [x] **M3.6** Implement deterministic jurisdiction IDs.
- [x] **M3.7** Implement deterministic legislative-session IDs.
- [x] **M3.8** Implement canonical federal bill IDs such as `bill:us:119:hr:1234`.
- [x] **M3.9** Implement canonical state bill IDs such as `bill:wa:2025-2026:hb:1234`.
- [x] **M3.10** Implement deterministic IDs for actions, sponsors, votes, vote positions, relations, and documents.
- [x] **M3.11** Define collision handling and test case, whitespace, punctuation, and provider-format variations.
- [x] **M3.12** Preserve upstream IDs as metadata without using them as the canonical identity.

### Database schema

- [x] **M3.13** Model `jurisdiction` and `legislative_session`.
- [x] **M3.14** Model `bill` with title, summary, classification, status, subjects, dates, and source links.
- [x] **M3.15** Model `bill_action` with ordering and source detail.
- [x] **M3.16** Model `person` and `bill_sponsor`, including sponsor type and primary-sponsor status.
- [x] **M3.17** Model `vote` and `vote_position` without assuming identical state and federal vote semantics.
- [x] **M3.18** Model `bill_relation` for companion, replacement, related, and other upstream relations.
- [x] **M3.19** Model `bill_document` for versions, amendments, fiscal notes, analyses, and supplemental documents.
- [x] **M3.20** Model `document_section` with stable ordering, headings, searchable text, and embedding fields.
- [x] **M3.21** Model `ingestion_run` and `sync_checkpoint` for operational state.
- [x] **M3.22** Add foreign keys, uniqueness constraints, check constraints, and deletion behavior.
- [x] **M3.23** Add indexes required for canonical lookups and expected ingestion upserts.
- [x] **M3.24** Add FTS and vector columns in a way that supports later indexing work.

### Migrations and access

- [x] **M3.25** Configure Drizzle against the app-contained schema and migration directories.
- [x] **M3.26** Generate the canonical baseline migration.
- [x] **M3.27** Add a repeatable database bootstrap that enables required extensions before schema creation.
- [x] **M3.28** Add typed transaction helpers for atomic bill-aggregate upserts.
- [x] **M3.29** Add query helpers for canonical bill, document, and ingestion-state lookups.
- [x] **M3.30** Verify the schema can be created from zero and dropped in an isolated test database.

### Normalization proof

- [x] **M3.31** Create representative Open States, GovInfo, and Congress.gov fixtures.
- [x] **M3.32** Normalize one state bill aggregate into canonical in-memory types.
- [x] **M3.33** Normalize one GovInfo federal bill aggregate into the same types.
- [x] **M3.34** Normalize a Congress.gov update to the same GovInfo-created canonical bill ID.
- [x] **M3.35** Test aggregate upsert idempotency and transaction rollback on a child-record failure.

## Exit criteria

- Representative records from all three providers normalize without provider-specific schema tables.
- GovInfo and Congress.gov update one canonical federal bill.
- Migrations recreate the database from zero and all schema tests pass.
