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

## Database guards

These are the current source guards, not interchangeable aliases. Supply URLs through the trusted local process
environment, never through committed examples or logs. All targets must be disposable local databases, including the
suites whose code checks a name without checking the host.

| Suite | Variable and required database | Enforced host guard |
| --- | --- | --- |
| Main ingestion integration | `LEGISLATION_INGESTION_TEST_DATABASE_URL`: `legislation_ingestion_test` | Database name only |
| Entity refresh, bill organization dependencies, batch receipts | `LEGISLATION_TEST_DATABASE_URL`: `legislation_test` | Database name only |
| Regulatory storage | `REGULATORY_TEST_DATABASE_URL`: `regulations_test` | `127.0.0.1`, `localhost` or `[::1]` |
| Regulatory search target checks | `REGULATORY_SEARCH_TEST_DATABASE_URL`: `legislation_passage_search` | `127.0.0.1`, `localhost` or `[::1]` |
| Passage synchronization | `PASSAGE_SEARCH_TEST_SOURCE_URL`: `legislation_passage_source_test`; `PASSAGE_SEARCH_DATABASE_URL`: `legislation_passage_search` | Database names only; also verifies the connected source database name |

Core instead uses `LEGISLATION_CORE_TEST_DATABASE_URL` and a loopback `legislation_core_test` database. Missing URLs
skip the relevant suites or cases. Several suites drop schemas or truncate search tables, so serialize C/I/W database
profiles even when their primary database names differ. Never reuse a production search URL for the passage fixture.