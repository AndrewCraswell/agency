# Core tests

Run `pnpm --filter @repo/legislation-core test` for shared units and
`pnpm --filter @repo/legislation-core test:coverage` for unit coverage. Run
`pnpm --filter @repo/legislation-core test:database` only against the guarded disposable databases from
[database setup](development.md).

All C integration suites read `LEGISLATION_CORE_TEST_DATABASE_URL`, require the database name `legislation_core_test`
and a loopback host (`127.0.0.1`, `localhost` or `[::1]`), and skip when unset. I's dedicated ingestion, older entity,
regulatory and passage suites have different [variables and guards](../../../../apps/legislation-ingestion/docs/operations/testing.md#database-guards).

C owns schema/migration artifacts, identifiers, civic/reader/rights contracts, embedding/tokenizer parity, wire clients,
auth primitives and telemetry sanitization. C imports no app, including test setup. Keep browser-safe schemas separate
from Node auth/context/database exports. Verify packaged migration, tokenizer, checksum and license assets when packaging
changes; subpath exports alone do not prove dependency isolation in M's runtime image.

Serialize C/I/W database suites and run each expensive profile once. Shared contract changes validate their affected
consumers through [root legislation verification](../../../../apps/legislation-web/docs/operations/testing.md#full-verification).