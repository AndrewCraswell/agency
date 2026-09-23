# Legislation database refresh policy

This inventory is the source of truth for production-to-staging refresh behavior. A refresh must refuse to run when a
table exists in either database without a policy below. Production data is not copied until the refresh implementation,
roles, sanitization checks and bounded acceptance run are complete.

## Policy meanings

| Policy | Refresh behavior |
| --- | --- |
| Copy | Replace staging rows with the production rows. These tables contain public source or canonical data. |
| Clear | Remove staging rows and do not copy production rows. This covers private or environment-bound operational state. |
| Exclude | Leave the staging table untouched. This preserves staging-owned configuration and credentials. |
| Rebuild | Remove staging rows and regenerate them from copied canonical data after the copy commits. |

The refresh preserves the staging database itself, extensions and schema migration ledger. It never copies roles,
credentials, ownership, grants, sequences outside the copied schemas or environment variables.

## Primary database

All tables below are in the `legislation` schema.

### Copy public canonical data

| Tables |
| --- |
| `jurisdictions`, `legislative_sessions`, `bills`, `bill_actions` |
| `people`, `person_aliases`, `person_details`, `person_external_identifiers`, `person_jurisdictions` |
| `organizations`, `legislative_terms`, `organization_memberships` |
| `legislative_events`, `event_sessions`, `event_organizations`, `event_participants`, `event_bills`, `event_documents`, `event_agenda_items`, `event_agenda_item_bills`, `event_agenda_item_amendments`, `event_agenda_item_supporting_materials`, `event_continuations` |
| `calendar_entries`, `calendars`, `calendar_events` |
| `bill_sponsors`, `bill_organizations`, `bill_relations` |
| `amendments`, `amendment_actions`, `amendment_relations` |
| `supporting_materials`, `supporting_material_sections`, `supporting_material_links` |
| `votes`, `vote_positions` |
| `event_outcome_links`, `event_outcomes` |
| `bill_documents`, `document_sections` |
| `canonical_record_fingerprints` |
| `legal_rights_profiles`, `legal_sources` |
| `legal_import_manifests`, `legal_artifacts`, `legal_import_generations`, `legal_import_records` |
| `legal_codes`, `legal_editions`, `legal_annual_editions`, `legal_annual_edition_volumes`, `legal_provisions`, `legal_provision_versions`, `legal_edition_provisions`, `legal_provision_source_reviews`, `legal_code_heads` |
| `regulatory_documents`, `regulatory_document_versions`, `regulatory_document_observations` |

Source URLs, public contact details for officials, document text and public provenance remain unchanged. This policy does
not make application telemetry, subscriber data or delivery configuration public.

### Clear private application data

| Table | Reason |
| --- | --- |
| `research_result_snapshots` | May contain user-directed research inputs and generated results. |
| `subscriptions` | Contains organization-owned subscription configuration. |
| `subscription_events` | Derived from private subscriptions and may expose organization activity. |
| `webhook_audit_records` | Contains private delivery history and endpoint metadata. |
| `subscription_deliveries` | Contains organization delivery state. |
| `api_idempotency_records` | Contains request fingerprints and encrypted response material. |

Clearing is the sanitization policy for these tables. A refresh must prove they are empty before staging is released.

### Exclude staging-owned configuration

| Table | Reason |
| --- | --- |
| `webhooks` | Staging endpoints and enablement are environment-specific. |
| `webhook_signing_keys` | Staging secrets must survive a data refresh and production secrets must never cross environments. |

The refresh does not delete, replace or validate these rows as production-derived data. Separate staging configuration
management owns them.

### Clear operational state

| Tables |
| --- |
| `document_download_leases`, `ingestion_runs`, `ingestion_locks`, `sync_checkpoints` |
| `change_events`, `passage_search_changes`, `passage_search_backfill` |
| `legal_discovery_checkpoints`, `legal_discovery_pages`, `legal_discovery_units`, `legal_derived_outbox` |
| `regulatory_publication_batches`, `regulatory_publication_outbox` |

Refreshes must not resume production leases, checkpoints, outbox work or delivery history in staging. New staging work
creates new operational rows after the refresh.

### Rebuild derived data

| Tables | Rebuild owner |
| --- | --- |
| `amendment_section_search` | Primary database derived-search rebuild |
| `bill_embeddings`, `document_section_embeddings`, `amendment_embeddings`, `supporting_material_section_embeddings` | Embedding pipeline, only when the staging model budget is explicitly enabled |
| `legal_passage_generations`, `legal_passages`, `legal_passage_preparations`, `legal_passage_preparation_items` | Legal passage preparation pipeline |

Embedding tables stay empty when staging embedding generation is disabled. Search acceptance must not silently fall back
to production embeddings.

## Passage-search database

The isolated `legislation_passage_search` database has one application table:

| Schema and table | Policy | Reason |
| --- | --- | --- |
| `legislation.document_sections` | Rebuild | Replicate from refreshed primary `bill_documents` and `document_sections`; never copy the production search store directly. |

The ParadeDB index is schema-owned derived state. The canonical passage-search schema creates it, and the replication
acceptance query proves it is valid before W is enabled.

## Staging privilege roles

Both staging database clusters define the same NOLOGIN roles. Login credentials must be separate role members; services
must never receive the Railway administrator credential as their long-term runtime identity.

| Role | Primary database | Passage-search database |
| --- | --- | --- |
| `legislation_staging_runtime` | Read canonical data; write only research snapshots, subscriptions, webhooks, delivery state and API idempotency records; no canonical writes or DDL. | Read ranked sections; no writes or DDL. |
| `legislation_staging_migration` | Own the application and migration schemas and their objects; create and alter application objects; no role administration. | Own the application schema and ranked table; create and alter application objects; no role administration. |
| `legislation_staging_refresh` | Read and replace application data, including sequence use and truncation; no DDL or role administration. | Read and replace replicated sections; no DDL or role administration. |
| `legislation_staging_diagnostic` | Read application data; no writes, DDL or role administration. | Read ranked sections; no writes, DDL or role administration. |

Default privileges apply equivalent read and refresh grants to new migration-owned objects. New runtime-write tables
require an explicit reviewed grant; they do not silently inherit canonical write access.

The protected bulk-refresh job is a maintenance operation, not a runtime use of `legislation_staging_refresh`.
Its primary endpoint requires a staging-only superuser to transactionally suspend internal constraint triggers and
rebuild nonunique indexes after loading. The ordinary refresh role keeps its no-DDL boundary. Do not grant the
maintenance principal to services or use it for the production source. The job checks this prerequisite before clearing
tables, restores the original index definitions and trigger states before each table commits, and audits foreign keys
before release. See the [operator procedure](../apps/legislation-ingestion/docs/operations/database-refresh.md).

## Non-application schemas

| Schema | Policy |
| --- | --- |
| `legislation_migrations` | Exclude. Staging migrations own their ledger; never import production migration rows. |
| `public` and extension-owned schemas | Exclude data. Provision extensions from the reviewed image and canonical schema. |
| PostgreSQL catalogs | Exclude. Railway manages the database service and cluster metadata. |

## Refresh gates

A refresh is releasable only when:

1. Catalog comparison proves every source and target application table has exactly one policy.
2. The copy runs in a consistent read-only production snapshot with bounded statements and connections.
3. Private tables are empty, excluded tables retain their pre-refresh fingerprints and operational tables contain no
   production rows.
4. Foreign-key validation and canonical row-count checks pass before derived rebuilds begin.
5. Passage replication drains to zero and a representative BM25 query hydrates its canonical primary record.
6. Temporary public database proxies are removed and W readiness plus authenticated smoke checks pass.
