# Web tests and coordinated verification

W owns product/UI, HTTP API/session auth, subscriptions/webhooks, query/retrieval and built Next.js acceptance.
Only W enables frontend aliases, vanilla-extract and per-file DOM environments. Tests follow implementation ownership;
do not import I or M source to seed a test. Use canonical seeds or a root-coordinated producer/consumer flow.

## Commands

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
pnpm exec vitest run app/components/chat/ChatWorkspace.test.tsx
pnpm exec vitest list --filesOnly --project web
```

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

## Full verification

The legislation-only entrypoint is `pnpm verify:legislation` from the repository root. The root manifest runs types,
lint, scoped strict knip and non-database coverage across C/W/I/M, then I's Python suite, serialized C/I/W database
profiles, and W followed by M built acceptance. I's coverage includes its parsing project. The command exists; this
documentation audit did not run it or establish a passing result.

W has no `test:all` script. Its Node webhook receiver remains the separate
`pnpm --filter legislation-web test:webhook-verification-receiver` command; the root gate does not explicitly invoke
it. M's built acceptance uses distinct-origin HTTP fixtures, not a running W deployment. Root-coordinated I-to-W
publication/rights/replay and live M-to-W acceptance are not implied by the scripts above. Skipped environment-gated
database suites are not passes. Run expensive profiles once and clean up owned processes. Root `pnpm verify` remains
the broader repository gate, including global formatting; `verify:legislation` does not run formatting.

Each invocation defaults to at most four workers. Override with `VITEST_MAX_WORKERS` or `--maxWorkers` when measuring
on a dedicated machine. This is not a cross-process lock: wait for an active run to finish before launching another,
and never run two database or built-app acceptance invocations against the same resources. Do not terminate another
session's tests merely because they are slow.

`pnpm dev` in W starts Next.js only. Built/fixture acceptance is not live deployment, browser consent, provider coverage
or production latency. This documentation move ran no tests or verification.