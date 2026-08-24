# Canonical data model

The application stores source-independent legislative records in the PostgreSQL `legislation` schema. Provider
payloads are normalized into this model rather than creating provider-specific bill tables.

## Core ownership

- `jurisdictions` own legislative sessions and optionally people.
- `legislative_sessions` identify a provider-independent session within a jurisdiction.
- `bills` belong to a jurisdiction and session, retain normalized status, subject and committee names, and own actions,
  sponsors, votes, relations, and documents.
- `bill_documents` own ordered `document_sections` used by full-text and semantic search. Sections retain start and end
  offsets into normalized document text so clients and diagnostics can recover exact source context.
- `ingestion_runs` and `sync_checkpoints` record operational history and incremental provider cursors.

Bill-owned child records cascade when their bill is deleted. Shared people and related bills are restricted from
accidental deletion. Composite constraints prevent a bill from referencing a session in another jurisdiction.

## Jurisdiction and session foundation

Jurisdiction `timezone` and `is_active`, plus session `classification` and `is_active`, are nullable until an
authoritative record states them. `provenance_complete` may be true only with a nonblank provider, HTTPS source URL,
retrieval time, and official-source flag. The canonical foundation importer updates existing canonical records only and records
its cursor in `sync_checkpoints`; its audit is fail-closed, so a partial source snapshot cannot enable a jurisdiction
or session route. See [canonical jurisdiction and session foundation](canonical-foundation.md).

## Search storage

Bill and document-section records retain PostgreSQL `tsvector` columns for lexical search. Semantic search reads four
dedicated, foreign-keyed embedding tables in the same `legislation` schema: `bill_embeddings` uses
`voyageai/voyage-4` at 1,024 dimensions; `document_section_embeddings` and `amendment_embeddings` use
`openai/text-embedding-3-small` at 1,536 dimensions; and `supporting_material_section_embeddings` uses
`voyageai/voyage-4` at 1,024 dimensions. Every row pins its model, dimensions, input-contract ID, canonical input hash,
rollout ID, and timestamps. HNSW indexes are dimension-specific.

Older inline vector columns are migration residue and are not query-authoritative. A bounded reconciliation may reuse a
document-section vector only when its exact model, input, dimensions, and legacy hash match the selected route. See
[ADR-012](architecture-decisions.md) and the [embedding rollout plan](embedding-rollout-plan.md).

## Migrations

Drizzle schema definitions live in `src/db/schema`, and generated migrations live in `src/db/migrations`. The baseline
migration enables pgvector before creating vector columns. The build copies migrations beside the compiled database
runner so production startup and maintenance commands use the same checked-in migration set.

The PostgreSQL integration suite recreates these schemas in a dedicated `legislation_test` database, verifies the
extension and vector dimensions, persists a representative bill aggregate, exercises deletion behavior, and confirms
that a noncanonical bill identifier is rejected.

## Canonical identifiers

Identifier builders normalize Unicode, case, whitespace, punctuation, bill-type formatting, and numeric leading zeros.
Jurisdictions, sessions, state bills, and federal bills receive readable deterministic IDs. Child records use a truncated
SHA-256 digest of the canonical parent and stable upstream identity, making reruns deterministic without exposing the
provider ID as product identity. The full upstream IDs remain in record metadata for audit and refresh work.

Aggregate persistence validates parent ownership before opening a transaction. Each supplied child collection replaces
that portion of the aggregate atomically; omitted collections are preserved. Integration tests prove repeat writes do not
duplicate records and a child constraint failure rolls the parent update back.

Before a provider batch is persisted, its canonical and source identities are checked as a set. Repeated references to
the same source record are allowed, while two distinct source identities that normalize to one canonical ID fail with an
explicit collision error instead of silently overwriting each other.

The planned expansion from source people to durable officials, offices, service intervals, districts, aliases, external
identifiers, extracted mentions, and canonical links is specified in the
[identity, entity, and representative roadmap](identity-and-representative-roadmap.md). Those records will remain in the
`legislation` schema because they are part of the same transactional civic graph; embeddings also remain in that schema
as derived indexes with foreign keys to their canonical source rows.
