# Staging database refresh

The refresh subsystem under `src/search/refresh` is deliberately inert until GitHub runs it through the protected
`staging` environment. The source is read only from `LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL`; the command requires
TLS in that URL and never creates, rotates or prints the credential. LEG-124 provisions the read-only production role
with a two-connection ceiling. The source catalog/snapshot session is reused while the copy engine owns the second
connection. Operators supply explicit target primary, target passage-search, staging W and staging M endpoints plus
Railway project, environment, service and restore-topology identifiers. Tests do not mutate an external environment.

The bulk engine streams each policy-approved table as PostgreSQL binary `COPY` inside one exported read-only source
snapshot. The snapshot transaction disables only its idle-in-transaction timeout so it remains valid while external
copy workers use it; individual copy and index-rebuild statements remain bounded to one hour and lock waits to two
seconds. The job installs the PostgreSQL 18 client. It does not create a dump file or automatically restart a failed copy.
Each target table loads in one transaction: lock it, save and remove nonunique non-constraint indexes, suspend triggers,
copy rows, bulk-build the saved indexes, restore their comments, clustering designation and statistics targets, restore
the original trigger states, analyze the table, and commit. Unique and constraint-backed
indexes remain enforced. Failure or cancellation rolls back uncommitted table data and DDL; committed tables remain
partial refresh data and must not be served. A later manually authorized refresh starts from empty managed tables.

This preserves the target database, schema definitions, extensions, migration ledger, roles, grants and excluded
staging configuration. The protected primary endpoint must use a staging-only maintenance principal able to suspend
internal constraint triggers (PostgreSQL requires superuser). The preflight refuses ordinary runtime/refresh credentials
and invalid indexes before clearing anything. Never grant these privileges to a runtime service or the production source
reader. Foreign-key audits remain mandatory before acceptance. Application sequence values are restored from that same
source snapshot. The canonical schema
does not use PostgreSQL large objects; catalog validation must fail closed if that invariant changes rather than silently
omit a large object.

The command emits phase events, each table's ordinal, start/completion, copied row count, transferred bytes, and a
30-second heartbeat separating copy from index construction. Bytes measure the source stream, not committed target
rows; the table completes only after its index rebuild commits. Validation uses COPY receipts from the exported snapshot,
not live production counts that can change during ingestion. Read access to every approved table and the migration ledger
is checked before destructive work.

Before dispatch, verify both staging volumes have capacity for the approved primary data, rebuilt indexes, WAL and
temporary index-build files, and the separate passage-search replica. Do not infer sizing from row-count statistics or
exclude only standalone embedding tables when estimating: canonical tables also contain inline embeddings. The
September 22 rehearsal was cancelled before completion; production allocated table storage for `document_sections`
alone was 75 GB while the staging primary volume was configured for 50 GB. Physical source sizes can include bloat,
but that discrepancy requires a measured capacity plan before another dispatch.
The protected workflow requires the explicit `capacity_reviewed` operator attestation (false by default). This is not
an automatic sizing calculation and must not be checked just to get past the gate.

Railway database endpoints use encrypted `sslmode=require` connections with a platform-managed self-signed certificate.
Node PostgreSQL clients opt into standard libpq semantics for that mode, which preserves transport encryption without
requiring a public certificate authority. Endpoints configured with `verify-ca` or `verify-full` retain certificate
verification and are never weakened by the refresh.

The workflow shares the non-cancelling `legislation-staging-database-mutation` concurrency group with staging
application deployments, holds a target PostgreSQL advisory lock and reads the existing GitHub issue-backed schema
lease. It sets the shared Railway `LEGISLATION_STAGING_REFRESH_MAINTENANCE` marker, removes W and M application
deployments, and verifies stopped replicas and repeated unavailable readiness responses before terminating stale
target sessions or doing destructive work. Zero replicas is not a supported Railway maintenance mechanism:
the CLI serializes zero as region deletion, which can restore a default live replica. A successful stop/remove API
response alone is not evidence of shutdown.

Maintenance operations use a dedicated workspace API token from the protected `RAILWAY_API_TOKEN` secret.
Ordinary project operations continue to use the narrower `RAILWAY_TOKEN` secret. The refresh
then verifies complete catalog policy, fingerprints excluded tables, clears managed tables, copies public data, audits
all private and operational tables as empty, seeds the versioned deterministic staging fixture in one transaction and
rebuilds ParadeDB from the copied primary. W and M are redeployed from recorded deployment IDs only for final readiness
and authenticated smoke validation, with approved topology verified rather than rewritten. A failure reasserts
maintenance and removes any restarted application deployments. Migrations,
extensions, copy counts, foreign keys, private-data absence, passage index and representative search, W readiness and
authenticated M smoke validations must all pass. A failure is redacted, emitted as a GitHub Actions error and appended
to the step summary; the lock is released but maintenance is intentionally retained.

The staging deployment workflow checks the persistent marker before starting either service and fails closed on an
active/invalid marker or unreadable Railway response. The marker is cleared only after refresh acceptance. Direct
Railway deployments and previews bypass this workflow guard: operators must keep those paths paused, including any
preview using the staging databases, throughout maintenance. This is an operational fence, not an application-level
request gate. In the September 22 containment check, W returned 404 after deployment removal and M returned 502 after
stopping; both had stopped replicas and no pending deployments.

The canonical table inventory and policy meanings remain in
[the repository refresh policy](../../../../docs/database-refresh-policy.md). Unit tests exercise the command and
failure matrix without network access. `refresh.integration.test.ts` requires loopback-only disposable database names
and exercises real PostgreSQL 18 binaries through `docker exec`: bulk binary `COPY`,
pgvector values, owned sequences, policy clearing/exclusion, idempotent fixture seeding, FK audits,
ParadeDB 0.25.9 rebuild/search and failure cleanup.
The smaller `copy-engine.integration.test.ts` exercises real HNSW rebuilding, preserved index metadata and disabled
triggers, suppressed outbox writes, and transactional schema restoration on COPY or index-build failure using
`LEGISLATION_BULK_TEST_SOURCE_URL`,
`LEGISLATION_BULK_TEST_TARGET_URL` and `LEGISLATION_BULK_TEST_CONTAINER`. Its database names must be
`legislation_copy_source_test` and `legislation_copy_target_test`, on loopback only.

The operator entry point is `pnpm --filter legislation-ingestion tool search/refresh-staging`. It refuses to mutate
without `--apply`. The production source has no command-line option, preventing accidental credential exposure in
process arguments. There is one bulk-copy engine and no automatic fallback. Required concrete options are:

```text
--target-primary <url> --target-passage-search <url>
--target-web <https-origin> --target-mcp <https-origin>
--railway-project <id> --railway-environment <id>
--web-service <id> --web-scale <region=replicas,...>
--mcp-service <id> --mcp-scale <region=replicas,...> --apply
```

The protected staging job must also provide the existing schema-lease GitHub variables/token, deployment commit SHA,
MCP smoke token and canonical smoke fixture IDs expected by the repository W readiness and M smoke scripts. It must pass
`LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL` only from the protected GitHub `staging` environment.

The manual `Legislation staging database refresh` workflow owns that integration. It has no schedule or push trigger,
requires the operator to type `REFRESH STAGING`, uses the non-cancelling staging database-mutation lock and defaults to
the transactional bulk-copy engine. Protected target endpoints are stored as
`LEGISLATION_STAGING_PRIMARY_DATABASE_URL` and `LEGISLATION_STAGING_PASSAGE_SEARCH_DATABASE_URL`. Creating the workflow
does not copy production content; an operator must dispatch it explicitly after reviewing the current staging lease and
maintenance window.
