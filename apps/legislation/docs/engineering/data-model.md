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

See the [foundation source handoff](#canonical-foundation) below for nullable fields, provenance, import checkpoints and route gates.

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
Migrations run only through an explicit administration/release command; application startup does not apply them.

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

<a id="canonical-vocabulary"></a>

<a id="canonical-vocabulary--canonical-legislative-vocabulary"></a>

## Canonical legislative vocabulary

<a id="canonical-vocabulary--concepts"></a>

### Concepts

- A jurisdiction is a country, state, district, or territory with a legislative authority.
- A legislative session is a named convening within exactly one jurisdiction.
- A chamber is `lower`, `upper`, `unicameral`, or `legislature`; unknown provider values remain `null` and are
  diagnosed.
- Bill classifications retain normalized provider categories such as `bill`, `resolution`, `joint-resolution`,
  `concurrent-resolution`, `constitutional-amendment`, `memorial`, and `nomination`. Unmapped values become `other`
  only when the raw value is retained in diagnostics.
- Actions have stable upstream order plus zero or more normalized classifications: `introduction`, `referral`,
  `committee`, `amendment`, `reading-1`, `reading-2`, `reading-3`, `passage`, `failure`, `executive-signature`,
  `executive-veto`, and `other`.
- Vote options normalize to `yes`, `no`, `absent`, `abstain`, `not-voting`, `present`, `proxy`, `paired`, or `other`
  while preserving raw values in diagnostics.
- Documents are `version`, `amendment`, `fiscal-note`, `analysis`, or `supplemental`. A logical version may retain
  multiple official format records.
- Relations are `companion`, `replacement`, `replaced-by`, `prior-session`, `related`, or `other`.

<a id="canonical-vocabulary--missing-values"></a>

### Missing values

`null` means an optional scalar is not supplied or cannot be mapped safely. An empty array means a source supplied no
members of that collection. `not-applicable` is represented only by a documented canonical enum value when the concept
truly does not apply; it is never substituted for unknown data. Required minimum bill fields cause record rejection
when absent.

<a id="canonical-vocabulary--dates-and-times"></a>

### Dates and times

Complete `YYYY-MM-DD` dates are stored as dates. Complete timestamps are normalized to UTC before storage. Year-only or
year-month fuzzy dates are retained in source diagnostics and do not become fabricated first-of-period dates. Open
States action and vote times without offsets are treated as local to the jurisdiction only after a jurisdiction timezone
is configured; otherwise the exact date is stored and the local-time string remains diagnostic metadata.

<a id="canonical-vocabulary--provider-mapping"></a>

### Provider mapping

Open States normalized classifications are accepted when they match the vocabulary and otherwise diagnosed. GovInfo and
Congress.gov bill types map to canonical bill or resolution classifications, while their lower-case type codes remain
part of federal canonical IDs. Provider-specific status strings map to the nearest lifecycle status only when the source
semantics are documented. Unknown values remain absent instead of leaking provider enums into query results.

<a id="canonical-foundation"></a>

<a id="canonical-foundation--canonical-jurisdiction-and-session-foundation"></a>

## Canonical jurisdiction and session foundation

<a id="canonical-foundation--scope"></a>

### Scope

The jurisdiction and session routes require source-backed fields that the current Open States bill archives, Congress
bill API, and GovInfo BILLSTATUS feeds do not provide at the record level. Those feeds identify the jurisdiction and
session, but do not authoritatively state a jurisdiction timezone or active flag, a session classification, or a
source reference for either canonical record.

The application therefore stores these fields as unknown rather than deriving them from a postal abbreviation, current
date, session name, or bill URL. Existing session `is_active` defaults are cleared by the additive migration because
they were not source observations.

<a id="canonical-foundation--source-handoff"></a>

### Source handoff

An authoritative adapter must submit complete records to `importCanonicalFoundationRecords`. Every jurisdiction record
requires `id`, `timezone` (which may explicitly be `null`), `isActive`, and a source reference. Every session record
requires `id`, `classification`, `isActive`, and a source reference. A source reference contains its provider, HTTPS
URL, retrieval time, optional source-update time, and official-source flag. Providers cannot be blank.

The importer updates existing canonical records only. It refuses to create a record from a provider identity, validates
the source payload at the boundary, and advances the `canonical-foundation/jurisdictions-sessions` checkpoint only
after each durable update. A final audit records whether every persisted jurisdiction and session is route-complete.

Reviewed snapshots live under `apps/legislation/data/canonical-foundation`. Import one explicitly with
`pnpm --filter legislation foundation:import -- data/canonical-foundation/<snapshot.json> [checkpoint-stream]`; the path
is package-relative because pnpm runs the script from `apps/legislation`. The command hashes the exact file, uses one
database connection, and relies on the importer's per-record durable checkpoint. A jurisdiction-scoped snapshot must use
its own checkpoint stream and does not make the global audit complete.

The Alaska snapshot is sourced from the current official Alaska State Legislature site and archive. The publisher labels
the persisted numbered records as `Legislature`, and the corrected adapter records the normalized lowercase classification
`legislature`. Legislatures 30 through 33 are in the archive and the official home page identifies the 34th as current.
The jurisdiction timezone remains explicitly unknown rather than being inferred. Production import
`a89bc8c83d9c57893c731e090f9599cf094e9cb73e88fce5f0b7df44aadd357c` processed all 6 of 6 snapshot records; its
idempotent rerun skipped all 6. This scoped source observation is sufficient for the Alaska detail fixtures, but it does
not establish nationwide foundation completeness: the audit remains incomplete for 52 jurisdictions and 648 sessions,
and the command reports `processed_partial` until the global audit is complete.

<a id="canonical-foundation--route-gate"></a>

### Route gate

`provenance_complete` is guarded by a database constraint, but that flag alone is never the route gate. The audit also
requires each jurisdiction's known active state and each session's known classification and active state. A complete
authoritative snapshot can satisfy the gate for its explicit route scope, as the Alaska jurisdiction/session release did; it does
not imply that the nationwide audit is complete or that an unrelated route scope may register.

<a id="change-events"></a>

<a id="change-events--canonical-change-events"></a>

## Canonical change events

Change events provide bounded product and operational history for canonical legislative records. They are not a
provenance ledger and do not retain complete provider payloads.

<a id="change-events--contract"></a>

### Contract

Each event has a deterministic ID, ingestion run ID, canonical record type and ID, one of `create`, `update`, `delete`,
`cancel`, `reschedule`, or `relationship-change`, the names of changed fields, minimal before and after values, and the
observation time. Jurisdiction, organization, person, and source-update time are included when the canonical transaction
already knows them.

Current-record fingerprints use stable key ordering and normalized dates. An unchanged retry does not emit an event.
The event and updated fingerprint are written inside the same canonical database transaction, so a failed transaction
cannot publish a change. Cancellation and deletion require explicit canonical state. Rescheduling requires a changed
start or end time. Relationship changes are emitted only for structured canonical links; the system does not infer
provider intent from text or timestamps.

<a id="change-events--validation"></a>

### Validation

Fresh-schema integration replays the same event snapshot and confirms that it remains silent, then applies a correction,
reschedule, cancellation, and deletion and verifies the exact ordered classifications. A deliberately invalid agenda
replacement proves that the canonical event and its change event roll back together. Deterministic planning tests also
cover relationship-only changes and repeated event identity.

Scheduled events link to later actions or votes through `event_outcome_links`. Every link names exactly one action or
vote, records a nonempty upstream reference, and permits only `explicit` or `deterministic-id` methods. Database checks
reject semantic linkage, and deterministic link IDs make replay silent. When no approved source relationship exists,
the event remains unlinked rather than using similar text or nearby timestamps.

<a id="change-events--query-and-retention"></a>

### Query and retention

The `search_changes` MCP operation provides cursor pagination and filters for canonical record, record type,
jurisdiction, organization, or person. Results expose only the bounded changed fields.

Development change events are retained for 90 days. Current fingerprints are retained while the canonical record
exists because they are compact and required for unchanged-import detection. A future production retention decision may
change the event window based on measured product usage and operational recovery needs; retention must not be extended
solely to establish provenance.
