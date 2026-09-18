# Canonical migration baseline

The migration directory contains one SQL baseline, one Drizzle snapshot and one journal entry. The baseline replaces
the former 52-file chain through Federal Register publication recovery. It contains 102 tables, including SQL-owned
regulatory tables that are not exported by the TypeScript schema, plus enums, sequences, constraints, indexes,
functions and triggers. The generated snapshot describes the 90 Drizzle-owned tables; it is not a replacement for
the complete SQL baseline.

The SQL was generated with PostgreSQL 18 `pg_dump --schema-only` from an empty database built with the full historical
chain. All constraints were validated on that empty database before export. Owner/privilege statements and psql-only
commands were excluded, extensions retained, and session settings made transaction-local. A second empty database
built from the baseline produced an identical schema dump. Named pg_dump object headings are retained because the
isolated amendment/passage fixture tools load selected canonical objects from them.

## Fresh databases

Use W's explicit `db:migrate` release command. The first release installs the baseline and records one hash/timestamp;
a repeat is a no-op. `migrateDatabase` rejects a ledger that is not an exact prefix of the available files, including
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
3. Apply only verified pending changes from the retained release history, with a direct administration connection,
   bounded lock waits, a transaction and a single migration owner. Recheck the live catalog before proceeding.
4. After schema parity is established, replace only `legislation_migrations.migrations` with the baseline hash and
   journal timestamp in a transaction. Retain the original ledger as release evidence. Do not modify `public.migrations`.
5. Run the normal release command again and verify it performs no schema/data changes. Check serving reads, search
   triggers and database readiness before deploying consumers. Keep the pre-release recovery evidence.

Schema parity may retain a documented extra operational index or stronger validation state. Do not drop production
indexes or weaken constraints just to make textual dumps equal. Do not record missing schema objects as applied.

## September 18 rollout status

**Production rollout deferred; no live schema or ledger writes were made.** The inspected Railway pgvector database
has 62 legislation tables and records migrations 0 through 47. The local baseline has 102 tables; the 40 missing live
tables are the pending regulatory additions. Existing column definitions match. Both vote-query indexes added to the
current schema are already deployed. Production also retains its amendment HNSW index and previously validated
constraints; neither should be removed.

Railway refused a fresh named snapshot because its per-volume backup limit was exceeded. No existing backups were
deleted. The latest listed daily snapshot was September 17, 2026 at 20:42 UTC. Before rollout, authorize removal of an
obsolete recovery point and create/verify a fresh snapshot, or explicitly accept the older recovery window.

Ignored release evidence uses the `tmp/migration-baseline-*0fc57135*` prefix; the exact pre-consolidation chain is in
`tmp/migration-history-retained-0fc57135`. Git history also retains the former files. Never ship these artifacts as a
second migration path. The local rehearsal database `legislation_baseline_0fc57135` is disposable and not a live replica.

## Verification

Core `migrate.integration.test.ts` verifies the fresh baseline, regulatory objects, repeat-release data preservation
and rejection of stale/edited ledgers. The existing schema and legal-storage suites cover catalog and constraint
behavior. W's `query-service.integration.test.ts` exercises the actual timeline query against the full baseline,
including both date precisions, nulls, ordering, pagination and non-default DateStyle/time zone settings.