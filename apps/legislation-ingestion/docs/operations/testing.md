# Ingestion tests

Run from the repository root:

| Command | Scope |
| --- | --- |
| `pnpm --filter legislation-ingestion test` | Worker, acquisition, orchestration, parsing and tool suites |
| `pnpm --filter legislation-ingestion test:parsing` | PDF/XML, native parsing, table/passage construction |
| `pnpm --filter legislation-ingestion test:database` | Guarded import, transaction/replay and source-to-target suites |
| `pnpm --filter legislation-ingestion test:python` | `python -m unittest discover -s python -p test_*.py` |
| `pnpm --filter legislation-ingestion test:coverage` | Worker, parsing and tool coverage; Python runs separately |
| `pnpm --filter legislation-ingestion test:all` | All I Vitest profiles and Python; not the cross-workspace gate |

Fixtures and provider/source evidence live here. Keep normal tests deterministic, without live providers, production
jobs or WorkOS/Next dependencies. Preserve source rights, parser and provenance checks. Core tests cannot import these
fixtures through I implementation; root integration coordinates I production and W consumption over process boundaries.

Use [C database setup](../../../../packages/legislation-core/docs/operations/development.md), and serialize shared
database resources. A skipped real-database suite is not acceptance. The single final legislation gate and its root
command are documented in [W verification](../../../legislation-web/docs/operations/testing.md#full-verification).

## Import profiling

Vitest's `--experimental.importDurations.print --experimental.importDurations.limit=30` reports module self and
inclusive import times. Use one worker and no coverage for diagnosis, retaining test isolation. To measure collection
without executing tests or hooks, add `--testNamePattern '^__IMPORT_PROFILE_ONLY__$'` to the normal test command.
Skipped tests in that run are a profiling technique, not behavioral verification. Cumulative import times across
workers are not wall time; do not sum inclusive parent and child durations.

Keep cloud and orchestration dependencies behind their execution boundaries. Local artifact operations do not load
Azure SDKs; blob clients initialize on the first valid cloud operation, and default credentials initialize on the
first token request. Injected OCR/scraper credentials bypass the default credential chain. CLI planning and input
validation do not load Trigger dispatch code. XML-only table readers use `cheerio/slim`; HTML readers retain the
default parser. Preserve the real tokenizer, parser, transport and provider-error regressions when optimizing imports.

Import pure synchronization policy, document shard policy, derived limits and job-result helpers from their focused
modules rather than runtime executors. Their colocated tests must not need the database or worker SDK. Keep runtime
dispatch and persistence tests alongside those boundaries; moving helpers is not a reason to remove that coverage.

## Database guards

These are the current source guards, not interchangeable aliases. Supply URLs through the trusted local process
environment, never through committed examples or logs. All targets must be disposable local databases, including the
suites whose code checks a name without checking the host.

| Suite | Variable and required database | Enforced host guard |
| --- | --- | --- |
| Main ingestion integration | `LEGISLATION_INGESTION_TEST_DATABASE_URL`: `legislation_ingestion_test` | Database name only |
| Entity refresh, bill organization dependencies, batch receipts | `LEGISLATION_TEST_DATABASE_URL`: `legislation_test` | Database name only |
| Destructive regulatory integration | `REGULATORY_DESTRUCTIVE_TEST_DATABASE_URL`: `regulations_destructive_test` | `127.0.0.1`, `localhost` or `[::1]` |
| Destructive regulatory search checks | `REGULATORY_SEARCH_DESTRUCTIVE_TEST_DATABASE_URL`: `legislation_passage_search_destructive_test` | `127.0.0.1`, `localhost` or `[::1]` |
| Passage synchronization | `PASSAGE_SEARCH_TEST_SOURCE_URL`: `legislation_passage_source_test`; `PASSAGE_SEARCH_DATABASE_URL`: `legislation_passage_search` | Database names only; also verifies the connected source database name |

Core instead uses `LEGISLATION_CORE_TEST_DATABASE_URL` and a loopback `legislation_core_test` database. Missing URLs
skip the relevant suites or cases. The regulatory integration variables are deliberately distinct from the
`REGULATORY_TEST_DATABASE_URL` used by retained pilot inspection and import tools. Their dedicated database names are
also enforced before migrations or fixture setup because the suites truncate canonical and search tables. Serialize
C/I/W database profiles even when their primary database names differ. When selecting multiple regulatory database test
files directly, pass Vitest `--no-file-parallelism`. Never reuse a retained pilot or production search URL for a test
fixture.
