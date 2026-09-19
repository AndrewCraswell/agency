# Web tests and coordinated verification

W owns product/UI, HTTP API/session auth, subscriptions/webhooks, query/retrieval and built Next.js acceptance.
Only W enables frontend aliases, vanilla-extract and per-file DOM environments. Tests follow implementation ownership;
do not import I or M source to seed a test. Use canonical seeds or a root-coordinated producer/consumer flow.

## Commands

For date-only and timestamp vote storage/reader acceptance, see [vote date precision](vote-date-precision.md).

`src/modules/legislation/query-service.integration.test.ts` exercises the bill timeline SQL against the full canonical
baseline in an explicitly local `legislation_test` database. It covers timestamp/date/null combinations for actions
and votes, timestamp precedence, UTC and ISO formatting under non-default DateStyle/time zone settings, interleaved
ordering, cross-type ties, nulls last and pagination. Its fixture setup resets only that guarded disposable schema.
Run this alongside `query-service.test.ts`; mocked SQL capture cannot detect PostgreSQL type-resolution failures.
See C's [baseline release procedure](../../../../packages/legislation-core/docs/operations/migration-baseline.md)
before running migrations against an existing database.

Run from W (`apps/legislation-web`), or use `pnpm --filter legislation-web <script>` from the repository root:

| Command | Scope |
| --- | --- |
| `pnpm test` | W fast tests; accepts an optional test-file filter. |
| `pnpm test:watch` | Web tests in watch mode. |
| `pnpm test:backend` | W API, query and serving units, not core or worker tests. |
| `pnpm test:database` | Real-database suites, run one file at a time. |
| `pnpm test:acceptance` | Built Next.js routing and smoke-harness tests. Builds and starts a local production server. |
| `pnpm test:coverage` | W web and backend coverage profiles. |
| `pnpm test:webhook-verification-receiver` | Node receiver tests, excluded from Vitest. |

Use an exact file for focused work, including files outside the web project:

```powershell
pnpm exec vitest run src/modules/conversations/components/ChatWorkspace.test.tsx
pnpm exec vitest list --filesOnly --project web
```

The web test project includes routes, shared components, conversation/evaluation/theme modules and the proxy.
Its `@/` alias resolves to `src/`, matching Next and TypeScript. Backend tests exclude those paths so moved suites
are collected exactly once. Tests remain colocated with their implementation, not collected under `app/` by convention.

I owns source/parser/Python suites, M owns fixture-HTTP/SDK tests, and C owns shared/schema tests. See
[I testing](../../../legislation-ingestion/docs/operations/testing.md),
[M testing](../../../legislation-mcp/docs/operations/testing.md) and
[C testing](../../../../packages/legislation-core/docs/operations/testing.md).
Database tests remain environment-gated; skipped suites do not establish acceptance. Use each suite's dedicated URL
and guard from [C setup](../../../../packages/legislation-core/docs/operations/development.md).

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

## Module loading

Use Vitest's import profiler on one representative file before changing runner isolation or deleting tests:
`--experimental.importDurations.print=on-warn --experimental.importDurations.thresholds.warn=0
--experimental.importDurations.limit=20`. Total import timings include nested imports; do not sum them as independent
costs. Keep the worker count, coverage setting and CPU allocation identical for before/after comparisons.

`createResearchTools` is asynchronous. Callers await it; supplying a fixture query service avoids importing the live
application/database composition. The read-only research runtime loads only for a live structured query.
An injected failure reporter also avoids loading the default telemetry SDK; analytics telemetry loads only for
live analytics operations.
In-memory result stores also avoid loading server persistence; the default persistent store imports its adapter only
when saving, restoring or continuing stored results. Fixture tests retain the real tool contracts and SDK loop,
with import guards against loading production runtimes.

## Full verification

The legislation-only entrypoint is `pnpm verify:legislation` from the repository root. The root manifest runs types,
lint, scoped strict knip and non-database coverage across C/W/I/M, then I's Python suite, serialized C/I/W database
profiles, and W followed by M built acceptance. I's coverage includes its parsing project.

W has no `test:all` script. Its Node webhook receiver remains the separate
`pnpm --filter legislation-web test:webhook-verification-receiver` command, also invoked by the root acceptance gate.
M's built acceptance uses distinct-origin HTTP fixtures; the final root-coordinated acceptance also exercises real
built M and W on separate local origins. Positive corpus acceptance requires an explicitly supplied disposable database.
These fixtures do not establish deployed provider availability. Skipped environment-gated database suites are not
passes. Run expensive profiles once and clean up owned processes. Root `pnpm verify` delegates to
`verify:legislation`, excluding unrelated workspaces. Neither entrypoint runs formatting.

Ordinary pnpm run/exec commands and Git hooks report dependency-state mismatches instead of implicitly installing,
linking or pruning packages (`verifyDepsBeforeRun: error`). Run an explicit, coordinated `pnpm install` only after
dependency-manifest changes or a confirmed dependency-state failure. Diagnose configuration/cache mismatches first;
do not reinstall blindly or bypass hooks. Serialize installation with other workspace activity, then rerun the
original command through normal hooks.

Types, lint and non-database coverage use Turbo with four explicit legislation package filters, `--concurrency=1`
and `--cache=local:rw`. Unchanged tasks replay their local cache; coverage restores the configured `coverage/**`
outputs. Shared dependency task relationships remain part of cache invalidation. A previous direct Vitest or recursive
pnpm run does not populate Turbo's cache: the first Turbo run for a new hash executes the task normally.
The web app's shared Storybook configuration remains a lint/type prerequisite; unrelated product workspaces are not
selected. Coverage runs only the four legislation packages.

Knip, Python, database and built-acceptance stages remain outside Turbo and execute on every full invocation.
No remote cache uploads are enabled by these scoped scripts. When diagnosing a cached task, append `--force` to its
individual script, for example `pnpm legislation:check:types --force`.

Turbo serializes package tasks, not Vitest workers. W, I and C support `VITEST_MAX_WORKERS`; an explicit Vitest
`--maxWorkers` also controls a focused invocation. Caching and task concurrency are not cross-process locks: wait for
an active verification to finish before launching another, and never run two database or built-app acceptance
invocations against the same resources. Do not terminate another session's tests merely because they are slow.

`pnpm dev` in W starts Next.js only. Built/fixture acceptance is not live deployment, browser consent, provider coverage
or production latency. This documentation move ran no tests or verification.

For component browser review, `pnpm --filter legislation-web storybook` serves the production components at
`http://127.0.0.1:6007`. Its Vite watcher excludes `.next` build output so generated HTML cannot repeatedly reload
the preview during another Next build. Source changes still update the preview normally.
