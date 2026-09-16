# Test ownership and execution

The named projects in [vitest.config.ts](../../vitest.config.ts) establish test ownership before source packages are
extracted. They do not enforce source import boundaries or change deployment packaging. Keep tests beside their
implementation; update project patterns when ownership changes rather than adding another catch-all test command.

## Commands

Run from `apps/legislation`:

| Command | Scope |
| --- | --- |
| `pnpm test` | Web tests only; accepts an optional test-file filter. |
| `pnpm test:watch` | Web tests in watch mode. |
| `pnpm test:backend` | Backend services, contracts, query unit tests, search, models and supporting modules. |
| `pnpm test:ingestion` | Acquisition, synchronization and Trigger orchestration. |
| `pnpm test:parsing` | PDF/XML parsing, text projection, passage construction and tokenizer tests. |
| `pnpm test:tools` | Maintenance tools and the tool launcher. |
| `pnpm test:database` | Real-database suites, run one file at a time. |
| `pnpm test:acceptance` | Built Next.js routing and smoke-harness tests. Builds and starts a local production server. |
| `pnpm test:all` | Every Vitest project, then the Node webhook receiver suite. |
| `pnpm test:coverage` | Every Vitest project with combined coverage, then the Node webhook receiver suite. |

Use an exact file for focused work, including files outside the web project:

```powershell
pnpm exec vitest run app/components/chat/ChatWorkspace.test.tsx
pnpm exec vitest run src/ingestion/regulations/parser-bridge.test.ts
pnpm exec vitest list --filesOnly --project web
```

The web project owns `app`, shared UI under `src/components` and `src/web`, and the Next.js proxy. It alone enables
the vanilla-extract plugin and frontend alias. Backend, ingestion and parsing projects use the Node environment.
Existing per-file DOM environment annotations remain authoritative for component tests.

The parsing boundary is provisional because those modules still live inside ingestion directories. Its explicit
patterns identify the current extraction candidates; other ingestion modules remain with orchestration. Database
and acceptance are execution boundaries, not proposed standalone source packages. Database integration tests remain
environment-gated; a skipped suite does not establish database acceptance. See [local PostgreSQL](development.md#local-postgresql)
and the individual suites for their dedicated database variables and safety guards.

## Test quality

Assert observable behavior, not Markdown wording, dependency-version literals or the spelling of TypeScript/SQL
source. The existing PostgreSQL schema suite checks migrated columns, defaults, enum values, keyset indexes and
foreign-key actions in the database catalog; its shared setup applies the migration chain once. Constraint behavior
and transaction/replay tests remain necessary alongside catalog checks. These checks require the guarded test database
and are not established by a skipped database suite.

Query-builder unit tests should check bound values as well as relevant SQL structure. Test doubles must preserve the
contract that the service relies on: subscription duplicate lookup compares the persisted fingerprint, not just its
length. Keep positive and negative examples so a fake that always returns one row cannot establish correctness.

Mocked SDK/HTTP tests protect wiring, authentication, cancellation, limits and error propagation. They do not establish
deployed latency; keep wall-clock performance gates in a measured integration/benchmark environment. Do not remove
source-policy, tokenizer, parser or packaging tests merely because they use fixed fixtures or execute generated code.
Review prose contracts directly instead of maintaining executable tests for document inventories.

## Full verification

Unfiltered Vitest runs execute web and backend first, ingestion/parsing/tools next, database next, and acceptance last.
The Next.js production build therefore does not compete with parser or coverage test workers in the same invocation.
Coverage is still aggregated across the Vitest projects in one run. The Python OpenStates runner suite remains an
explicit `pnpm test:openstates-runner` check, as before.

Each invocation defaults to at most four workers. Override with `VITEST_MAX_WORKERS` or `--maxWorkers` when measuring
on a dedicated machine. This is not a cross-process lock: wait for an active run to finish before launching another,
and never run two database or built-app acceptance invocations against the same resources. Do not terminate another
session's tests merely because they are slow.

`pnpm verify` from the repository root remains the full release gate, including all legislation Vitest projects and
the receiver suite. Root `pnpm test` now selects the legislation web tests, so it is not a substitute for that gate.
`pnpm dev` starts Next.js only; it does not start tests, ingestion workers or smoke checks.