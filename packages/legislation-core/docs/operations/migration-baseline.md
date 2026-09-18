# Canonical migration baseline

The migration directory contains one SQL baseline, one Drizzle snapshot and one follow-up data-reconciliation migration.
The baseline replaces the former 52-file chain through Federal Register publication recovery. It contains 102 tables, including SQL-owned
regulatory tables that are not exported by the TypeScript schema, plus enums, sequences, constraints, indexes,
functions and triggers. The follow-up canonicalizes legacy event vocabulary and validates constraints that older live
releases added as `NOT VALID`; it is a no-op on a fresh empty database. The generated snapshot describes the 90
Drizzle-owned tables; it is not a replacement for the complete SQL baseline.

The SQL was generated with PostgreSQL 18 `pg_dump --schema-only` from an empty database built with the full historical
chain. All constraints were validated on that empty database before export. Owner/privilege statements and psql-only
commands were excluded, extensions retained, and session settings made transaction-local. A second empty database
built from the baseline produced an identical schema dump. Named pg_dump object headings are retained because the
isolated amendment/passage fixture tools load selected canonical objects from them.

## Fresh databases

Use W's explicit `db:migrate` release command. The first release installs the baseline and reconciliation migration and
records both hash/timestamp pairs; a repeat is a no-op. `migrateDatabase` rejects a ledger that is not an exact prefix of the available files, including
changed hashes, old timestamps and superseded history. It never rewrites that history or resets a populated schema.
Migrations remain an explicit release operation, not application startup.

Changing an already-applied prototype baseline requires a deliberate schema release and ledger reconciliation.
Do not merely update the hash to suppress the guard. Future generated schema changes must preserve SQL-owned tables,
search/capture triggers, copy-revision functions and operational indexes. Run `db:check` and real PostgreSQL suites;
an ORM-only schema diff does not cover all those objects.

## Existing databases

1. Identify the exact database/service/environment. Obtain a current recoverable backup, retain the old migration
   files and ledger outside tracked source, and capture the live schema. Preserve credentials and unrelated schemas.
2. Compare live columns, constraints, indexes, functions and triggers with a freshly built canonical database.
   Review required DDL and data effects; never replay the entire create-only baseline against a populated schema.
3. Apply only verified pending changes from the retained release history and the tracked event-vocabulary reconciliation,
   with a direct administration connection, bounded lock waits, a transaction and a single migration owner. Recheck the
   live catalog and every validated constraint before proceeding.
4. After schema and data parity are established, replace only `legislation_migrations.migrations` with both canonical
   hash/timestamp pairs in a transaction. Retain the original ledger as release evidence. Do not modify `public.migrations`.
5. Run the normal release command again and verify it performs no schema/data changes. Check serving reads, search
   triggers and database readiness before deploying consumers. Keep the pre-release recovery evidence.

Schema parity may retain a documented extra operational index or stronger validation state. Do not drop production
indexes or weaken constraints just to make textual dumps equal. Do not record missing schema objects as applied.

## September 18 rollout status

**Production rollout deferred; no live schema, data or ledger writes were made.** The inspected Railway pgvector database
has 62 legislation tables and records migrations 0 through 47. The local baseline has 102 tables; the 40 missing live
tables are the pending regulatory additions. A keyed live-catalog audit confirms every existing column definition,
function and trigger matches the retained 0-through-47 schema. Both vote-query indexes added to the current schema are
already deployed. Production also retains its amendment HNSW index and ten constraints that were validated separately;
neither should be removed.

Sixteen other historical constraints remain unvalidated. Read-only predicate scans found zero violations for fourteen.
The two event-vocabulary constraints found 2,657 legacy classifications and 1,569 legacy statuses. The tracked
`0001_reconcile_legacy_event_vocabulary.sql` maps those exact legacy forms with the same canonical semantics as current
ingestion, then validates all 26 formerly deferred constraints. A PostgreSQL integration test replays the observed
classification/status forms through that migration and verifies their final values and validation state.

A clean PostgreSQL 18 rehearsal applied retained migrations 0 through 47, then pending migrations 48 through 51 and the
event-vocabulary reconciliation. It moved from 62 to 102 legislation tables and produced exact catalog parity with the
canonical baseline across relations, columns, constraints, indexes, functions and triggers. The canonical migration
hashes are `3cf5d1f0b7a331700a8426695a65b4e9ed07b4c0ca12dff1b985b45a05457ff7` at
`1789725600000` and `cbe63b9c7528993c84daaad15355086ecbfdb79e0cdc0ef197468da5db81ada1` at
`1789761185934`.

The exact production-shaped release payload is retained outside tracked source at
`apps/legislation-ingestion/artifacts/regulatory-backfills/production-migration-release-20260918/production-regulatory-baseline-release.sql`
with SHA-256 `e9ebe0032754aaa2bfc2eab131e5181d96c0b7856dfa47b2c1fbe3641efee54f`. It takes one advisory
lock and one transaction, verifies the frozen 48-row ledger and live catalog, locks event writes, applies the five exact
SQL inputs, asserts the complete post-release catalog, and only then replaces the migration ledger. A production-shaped
rehearsal included the 4,226 legacy rows, 16 unvalidated constraints, 48 historical ledger rows and retained amendment
HNSW index. It completed with 102 tables, two canonical ledger rows and zero unvalidated constraints or legacy values.

Railway refused a fresh named snapshot because its per-volume backup limit was exceeded. No existing backups were
deleted. A September 18 read-only Railway API audit returned 17 recovery points for the canonical volume. The latest is
the September 17, 2026 20:42 UTC daily snapshot and expires September 23 at 20:42 UTC. Before rollout, authorize removal
of an obsolete recovery point and create/verify a fresh snapshot, or explicitly accept that existing recovery window.

Ignored release evidence uses the `tmp/migration-baseline-*0fc57135*` prefix; the exact pre-consolidation chain is in
`tmp/migration-history-retained-0fc57135`. Git history also retains the former files. Never ship these artifacts as a
second migration path. The local rehearsal database `legislation_baseline_0fc57135` is disposable and not a live replica.

## Verification

Core `migrate.integration.test.ts` verifies the fresh baseline, regulatory objects, legacy vocabulary reconciliation,
constraint validation, repeat-release data preservation and rejection of stale/edited ledgers. The existing schema and legal-storage suites cover catalog and constraint
behavior. W's `query-service.integration.test.ts` exercises the actual timeline query against the full baseline,
including both date precisions, nulls, ordering, pagination and non-default DateStyle/time zone settings.
