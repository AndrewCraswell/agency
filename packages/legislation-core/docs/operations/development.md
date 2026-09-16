# Shared database development

C owns the single PostgreSQL 18/pgvector Compose definition, migration history, schema and database primitives.
The local database binds only to `127.0.0.1:55432`, with a dedicated Compose project and volume.
Run from the repository root with Node 24, pnpm 11 and a Compose-compatible Docker runtime:

```powershell
pnpm --filter @repo/legislation-core db:up
pnpm --filter @repo/legislation-core db:wait
pnpm --filter legislation-web db:migrate
pnpm --filter @repo/legislation-core db:status
```

Migration artifacts live in C; release execution belongs to W. Apply migrations deliberately using the direct
administration URL, never as W, I or M startup work. C's migration helper is not a second release authority.
W lives at `apps/legislation-web`; its database scripts delegate to C. C's helper reads `DATABASE_URL` from the process
environment, not an app-local `.env`. Follow [local credential setup](../../../../apps/legislation-web/docs/operations/development.md#local-environment-after-the-move)
before invoking it. The existing ignored environment file was not moved from `apps/legislation`.

For C integration work, `LEGISLATION_CORE_TEST_DATABASE_URL` must name `legislation_core_test` on `127.0.0.1`,
`localhost` or `[::1]`. All three core integration suites enforce both checks and skip when the variable is absent.
The schema suite drops `legislation` and `legislation_migrations` before and after its migration checks. The Compose
runtime database is not a substitute for this dedicated disposable test database.

I uses different variables and guards, including `LEGISLATION_INGESTION_TEST_DATABASE_URL`,
`LEGISLATION_TEST_DATABASE_URL`, and separate regulatory/search URLs. Some check only database names, not hosts;
see [I's exact guard table](../../../../apps/legislation-ingestion/docs/operations/testing.md#database-guards).
Never point these at production, even when a name would pass the guard. Serialize database suites across C, I and W;
see [testing](testing.md). A skipped profile is not acceptance.

Stop while retaining data with `pnpm --filter @repo/legislation-core db:down`. An explicitly approved disposable reset is:

```powershell
pnpm --filter @repo/legislation-core db:reset
pnpm --filter @repo/legislation-core db:up
pnpm --filter legislation-web db:migrate
```

This deletes only the dedicated local volume, not credentials or unrelated services. Never point a test/reset command
at a production database. [Pooling](database-connection-pooling.md) owns retained capacity evidence and shared limits.