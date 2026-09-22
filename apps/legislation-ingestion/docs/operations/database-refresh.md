# Staging database refresh

The refresh subsystem under `src/search/refresh` is deliberately inert until GitHub runs it through the protected
`staging` environment. The source is read only from `LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL`; the command requires
TLS in that URL and never creates, rotates or prints the credential. LEG-124 provisions the read-only production role
with a two-connection ceiling. The source catalog/snapshot session is reused while the copy engine owns the second
connection. Operators supply explicit target primary, target passage-search, staging W and staging M endpoints plus
Railway project, environment, service and restore-topology identifiers. Tests do not mutate an external environment.

The direct engine streams each policy-approved table as PostgreSQL binary `COPY` inside one exported read-only source
snapshot. It does not create a dump file. A streaming custom-format `pg_dump` to `pg_restore` pipeline is the tested
fallback. Both paths preserve the target database, schemas, extensions, migration ledger, roles, grants and excluded
staging configuration. Application sequence values are restored from that same source snapshot. The canonical schema
does not use PostgreSQL large objects; catalog validation must fail closed if that invariant changes rather than silently
omit a large object.

Railway database endpoints use encrypted `sslmode=require` connections with a platform-managed self-signed certificate.
Node PostgreSQL clients opt into standard libpq semantics for that mode, which preserves transport encryption without
requiring a public certificate authority. Endpoints configured with `verify-ca` or `verify-full` retain certificate
verification and are never weakened by the refresh.

The workflow holds a target PostgreSQL advisory lock, reads the existing GitHub issue-backed schema lease, scales W and
M to zero replicas and terminates stale target sessions before destructive work. Railway service topology changes use
a dedicated workspace API token from the protected `RAILWAY_API_TOKEN` secret because environment-scoped project tokens
cannot update replica topology. Ordinary project operations continue to use the narrower `RAILWAY_TOKEN` secret. It
then verifies complete catalog policy, fingerprints excluded tables, clears managed tables, copies public data, audits
all private and operational tables as empty, seeds the versioned deterministic staging fixture in one transaction and
rebuilds ParadeDB from the copied primary. W and M are restored to their explicit prior topology only for final readiness
and authenticated smoke validation. Staging is scaled back to zero on any failure. Migrations,
extensions, copy counts, foreign keys, private-data absence, passage index and representative search, W readiness and
authenticated M smoke validations must all pass. A failure is redacted, emitted as a GitHub Actions error and appended
to the step summary; the lock is released but maintenance is intentionally retained.

The canonical table inventory and policy meanings remain in
[the repository refresh policy](../../../../docs/database-refresh-policy.md). Unit tests exercise the command and
failure matrix without network access. `refresh.integration.test.ts` requires loopback-only disposable database names
and exercises real PostgreSQL 18 binaries through `docker exec`: direct binary `COPY`, custom-format `pg_dump` streamed
to `pg_restore`, pgvector values, owned sequences, policy clearing/exclusion, idempotent fixture seeding, FK audits,
ParadeDB 0.25.9 rebuild/search and failure cleanup.

The operator entry point is `pnpm --filter legislation-ingestion tool search/refresh-staging`. It refuses to mutate
without `--apply`. The production source has no command-line option, preventing accidental credential exposure in
process arguments. `--copy-engine direct` fails if binary copy cannot complete, `--copy-engine pg-dump` selects the
tested dump pipeline, and the default `--copy-engine fallback` tries direct copy before dump/restore. Required concrete
options are:

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
the direct-copy-with-dump-fallback engine. Protected target endpoints are stored as
`LEGISLATION_STAGING_PRIMARY_DATABASE_URL` and `LEGISLATION_STAGING_PASSAGE_SEARCH_DATABASE_URL`. Creating the workflow
does not copy production content; an operator must dispatch it explicitly after reviewing the current staging lease and
maintenance window.
