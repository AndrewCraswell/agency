# Development, runtime and observability

## Requirements

- Node.js 24 or newer.
- pnpm 11.
- Docker Desktop or another Docker Compose-compatible runtime for PostgreSQL integration work.
- The monorepo dependencies installed from the repository root.

## Commands

From the repository root:

```text
pnpm install
pnpm --filter legislation dev
pnpm --filter legislation test
pnpm --filter legislation check:types
pnpm --filter legislation lint
pnpm --filter legislation build
pnpm verify
```

`dev` starts Next.js; `dev:service` starts the retained standalone test/development server on `127.0.0.1:3100` by default.
For the VPN-constrained AI SDK installation and its local archive checksum, see the
[vendor installation note](../../vendor/README.md). Use the root frozen-lockfile install with the configured Microsoft
feed; no public-registry switch or TLS bypass is required. `pnpm test` runs web-owned tests only. For a focused check,
change into `apps/legislation` and run `pnpm exec vitest run <exact-test-file>`.
See [test ownership and execution](testing.md) for backend, ingestion, parsing, database and release checks.

The public deployment boundary is the Next.js `app/api` Route Handlers. The deleted `legislation-api` Railway service
must not be started or redeployed. Both runtime checks expose:

- `GET /health` for process health.
- `GET /ready` for dependency readiness.

Copy `.env.example` to an untracked environment file when local overrides are required. The initial foundation supports
server, logging, and PostgreSQL settings. Defaults are suitable for the app-contained local infrastructure.

## Development chat research connection

The chat route supports a public production demo when the server-side model key and trusted HTTPS
`LEGISLATION_PUBLIC_API_BASE_URL` are configured. Production requests must match that exact origin; development
remains same-origin/loopback constrained. Origin checks are browser request protection, not authentication. The owner
approved anonymous demo access and retaining unmasked Replay for this release. It calls the existing query service
directly using `createLegislationResearchTools`, the same validated registry used by the public MCP handler. No internal
HTTP request, MCP URL or bearer token is needed. The old chat-specific MCP URL/token settings have been removed.

OpenRouter still requires its server-side model key, and the existing database configuration must be reachable.
Public `/api/**` and `/mcp` authentication has not been changed. Chat exposes only the 25 named baseline read tools;
the organization-gated legal-text reader is not passed to the registry, and private account/mutation tools remain excluded.
The [research runtime](../../src/server/next/research-runtime.ts) owns a process-cached pool limited to two connections
per data store. Each operation creates the existing query service against a client-bound Drizzle database inside
`BEGIN READ ONLY`. Timeouts are applied with transaction-local `set_config`, not rejected PgBouncer startup fields.
Individual requests release their clients but must not close the shared pools. The optional ranked passage store uses
the same transaction-local approach without enabling any unapproved search cutover.

Current per-run bounds: 30-second registry tool calls, 120-second total run deadline, eight model
steps, 24 tool calls, and 180,000 bytes of structured data per model-visible tool result. Oversized results are rejected,
not silently truncated. These limits bound a request and do not impose a conversation count. No transcript is saved
server-side; follow-ups re-fetch evidence instead of trusting client-supplied tool output. Tavily/Firecrawl remain later work.
Cancellation prevents further calls and discards late results; it does not claim to interrupt an already-running SQL
statement. Existing database statement deadlines remain responsible for that bound.

The demo's PgBouncer startup failure is resolved. A live check confirmed a 15-second statement timeout, read-only mode,
server cancellation at a one-second test deadline, and healthy client reuse after rollback. Public API pool configuration
and PgBouncer infrastructure were not changed by this demo-specific fix.

Model-facing optional tool fields explicitly accept null, which is removed before the canonical input schema validates
the request. Empty strings and invented omission markers are not accepted as cursors. Chat only accepts continuation
tokens observed in successful results during the current turn; backend cursor/query binding remains authoritative.

The original AI-in-education question completed live search and bill-detail calls and returned sponsor names with
New Jersey A4352 and Massachusetts H614 source links. Two larger detail calls failed before narrower retrieval
succeeded; broader batch and cancellation acceptance remains open. No full unit suite was run for this repair.

## Conversation reload recovery

The conversation composer supports Up/Down history recall of previously sent, visible user messages. Up moves
from newest to oldest without wrapping; Down moves forward and restores the unsent draft. Recalled text is selected
for editing and is never submitted automatically. Editing starts a new recall cycle. For multiline drafts, recall
starts only at the beginning (Up) or end (Down); modifier keys, other selections, and IME composition retain normal
editing behavior. Hidden clarification-continuation messages are excluded. Browser checks cover history boundaries,
draft restoration, edited recalls, multiline caret movement, selected text, composition, and mobile-width keyboard use.

During `next dev`, the current conversation is checkpointed in this tab's `sessionStorage` under
`rostra.development.conversation`. Full development reloads restore the conversation ID, messages, retrieved evidence,
draft, and confirmed clarification answers. React Fast Refresh keeps live state rather than replaying an older checkpoint.
Only one conversation is retained per tab; starting another replaces the checkpoint. This is not server-side history.
Browser session restoration may also restore session storage, so do not treat closing the browser as guaranteed deletion.
Clear the entry or the site's storage to remove the checkpoint explicitly.

A full reload interrupts an active model request; it does not resume a running stream. Retained partial output is
marked incomplete and Retry starts a new response. Unanswered clarification forms restore as expired because their
server-side state may have disappeared; confirmed answers remain readable. Invalid checkpoints are discarded, and
unavailable or full browser storage produces a warning rather than crashing chat. Completed conversations and drafts,
pending-request reload, keyboard Retry, and a 390px mobile layout have been checked in the integrated browser.

Checkpointing is development-only. Production retains the existing in-memory, refresh-expires behavior. This exception
was requested to keep code edits and full development reloads from erasing demo conversations.

## Sentry error monitoring

The Next.js app uses pinned `@sentry/nextjs` 10.73.0. Set `NEXT_PUBLIC_SENTRY_DSN` to the
`legislation/legislation` project DSN to enable it, then restart development or rebuild the browser bundle.
Without a DSN, monitoring is disabled. The DSN is public configuration, not an authentication credential.
Optional `SENTRY_AUTH_TOKEN` is build-only and enables source-map upload; never expose it through a public variable.
No Railway settings or deployment have been changed for this integration.

Browser exceptions, React error boundaries, Next request failures, and chat stream/tool failures are captured.
Caught API 5xx responses are reported in the shared `apiErrorResponse` boundary; expected 4xx validation responses
are not server errors. AI SDK client transport failures and failed clarification transport/response parsing are
explicitly reported because handled promise failures do not reach browser global handlers.

Every chat tool failure is observed through the SDK stream, including invalid arguments and unknown tool names
before execution, clarification-tool errors, and research execution failures. A per-run reporter deduplicates by
tool-call ID across the execution wrapper and stream. Invalid tool calls are captured before the SDK converts their
errors to strings. Events retain a run ID, tool-call ID, known tool name, failure category, and reference; available
duration/result-size metrics are allowlisted. Actual timeouts are reported; intentional user stops are not errors.
This is observability, not durable orchestration or a replacement for the existing AI SDK research loop.
The shared event allowlist removes raw messages, request bodies, headers, cookies, user data, breadcrumbs,
arbitrary tags/contexts, and source code context. It retains standard error types, safe stack locations, the recognized
`Invalid URL` diagnostic, and known research tool/category
tags plus the same reference shown in the failed research step. Stop requests do not produce research failure events.
Error logs and performance tracing remain disabled. Sentry does not register another OpenTelemetry provider.
This error-event policy does not cover Replay recordings or the pre-existing logging and Langfuse pipelines.

Session Replay is enabled for the demo at 100% in development, 10% of sessions otherwise, and 100% on errors.
By explicit demo-owner direction, text/input masking and media blocking are disabled: visible questions, answers,
source content and ordinary form input can be recorded. Use non-sensitive demo data. Request/response body capture
remains off; custom console/network recording events are discarded. Error events retain only a validated replay ID
for correlation. Review this deliberately unmasked policy before any public production rollout.

VS Code's `sentry` MCP entry uses hosted OAuth scoped to `legislation/legislation`. Start that server and complete
Sentry sign-in in VS Code when ready. It is an editor tool, not a public-chat research capability, and no access token
or model-provider key is stored in its configuration. OAuth and real event receipt have been verified through MCP
(`LEGISLATION-1`, environment `sentry-smoke-test`); the local DSN is configured. Browser Replay receipt has also
been verified. Source-map upload remains unverified. The in-memory transport check verifies the error scrubber
without contacting Sentry.

Verification includes a real SDK/mock-model probe for execution, invalid-input and unknown-tool failures (three
events, no duplicates), browser transport-event delivery, and malformed citation links rendering without an error
boundary crash. These focused checks do not establish full ingestion/worker observability or production acceptance.

## Conversation telemetry

With both Langfuse keys configured, the Node server registers the official AI SDK 7 integration.
Each research run propagates the conversation's persisted `sessionKey` as the Langfuse `sessionId`.
Turns, retries, and clarification continuations therefore share a session, including after reload recovery;
new conversations receive a new UUID. Individual runs remain separate traces. Evaluation cases use their
own session UUID across follow-up turns.

Telemetry is flushed after the streaming response completes. The existing telemetry redaction and truncation
policy applies, and media uploads are disabled. Model inputs and outputs are recorded, so use non-sensitive
demo data. Without Langfuse keys, chat telemetry registration is skipped.

## Local PostgreSQL

The legislation app owns an isolated PostgreSQL 18 and pgvector environment. It binds only to
`127.0.0.1:55432`, uses a named Compose project, and stores its data in an app-specific volume.

From the repository root:

```text
pnpm --filter legislation db:up
pnpm --filter legislation db:wait
pnpm --filter legislation db:migrate
pnpm --filter legislation db:status
```

Run the real-database integration suite in PowerShell:

```powershell
$env:LEGISLATION_TEST_DATABASE_URL = "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
pnpm --filter legislation test:database
```

The integration suite refuses to perform schema cleanup unless the URL targets the dedicated `legislation_test`
database. It drops only the `legislation` and `legislation_migrations` schemas.

Run the application startup smoke test with `pnpm --filter legislation smoke:local`. It starts the real server against
local PostgreSQL, verifies health and readiness, and shuts the process down.

## Package scripts and specialist tools

Keep `package.json` scripts limited to package lifecycle, local infrastructure, release checks, and deployment
automation. Specialist maintenance and evaluation programs live under `tools`, grouped by ownership, and run through
`pnpm tool <area>/<name>`. Use `pnpm tool --list` to discover them. Do not add a package alias for an individual tool.

| Entry point | Purpose | Retention rule |
| --- | --- | --- |
| `scripts/smoke-local.mjs` | Start the real local service and verify health and readiness. | Permanent release check. |
| `scripts/smoke-deployment.mjs` | Verify deployed health, readiness, one bearer-authenticated API collection, the MCP tool set, representative bill and document calls, and protocol behavior. | Permanent post-deployment check; requires separate `LEGISLATION_SMOKE_TOKEN` (API) and `LEGISLATION_MCP_SMOKE_TOKEN` (MCP) credentials, a root HTTP(S) base URL, and never logs either token. |
| `scripts/smoke-dependencies.mjs` | Verify production PostgreSQL, pgvector, managed identity, and Blob read/write behavior. | Permanent infrastructure check; packaged with the build intentionally. |
| `tools/trigger/run-trigger-backfill.ts` | Plan or explicitly launch a resumable historical rebuild. | Permanent disaster-recovery and future-rebuild entry point. |
| `tools/trigger/reconcile-trigger-schedules.ts` | Diff or explicitly reconcile managed Trigger schedules. | Permanent schedule-control entry point. |
| `scripts/copy-migrations.mjs`, `scripts/infra-what-if.mjs` | Package migration files with compiled output and preview infrastructure changes. | Permanent build and deployment tooling. |

## Container and Railway build

The current Railway service is named `legislation-web`. Its image uses the repository root as Docker context so pnpm
can resolve the root lockfile, catalog, and shared TypeScript package. The Dockerfile installs `apps/legislation`,
builds the Next.js application, and runs the standalone output as a non-root process.

From the repository root:

```text
docker build -f apps/legislation/Dockerfile -t legislation-web:local .
```

Railway config-as-code lives at `apps/legislation/railway.json`. Keep the service root at the repository root and
explicitly set Config File Path to `/apps/legislation/railway.json`; nested config is not discovered automatically.
Before release, verify the effective service uses the Dockerfile builder, `apps/legislation/Dockerfile`, and `/ready`
health check. Railway injects `PORT`; the service binds it on `0.0.0.0`. Apply migrations as a separate, explicit
release operation with `pnpm --filter legislation db:migrate`; neither the image build nor startup runs migrations.

Use [API closeout](passage-search-delivery.md#september-14-scope-and-acceptance) for the latest recorded deployment
and [Next.js runtime](#nextjs-runtime) for the active runtime contract. Do not copy historical deployment IDs into a
new rollback command; identify and verify the immediately preceding successful `legislation-web` artifact. The old
`legislation-api` service is deleted. API-backed MCP is implemented; its authentication remains separate from API tokens.

After Railway allocates the public service domain, set `LEGISLATION_PUBLIC_API_BASE_URL` to that exact `https` URL.
This required production variable is the trusted base for canonical API URLs; it must not be derived from request headers.

There is no standalone historical OCR sweep script or task. Native document
and material ingestion own OCR handoff, and a later unowned OCR accumulation
is treated as a defect rather than hidden by polling.

Document OCR metadata is deliberately forward-only. `bill_documents.ocr_status`
uses the HTTP contract lifecycle (`not-required`, `pending`, `processing`,
`processed`, `failed`, or `unsupported`); provider, completion time, and page
count remain `NULL` for historical rows unless a recorded ingestion attempt
establishes them. `document_sections`
receives a one-based inclusive page range only when the provider's complete,
contiguous UTF-16 source spans are identical to the canonical normalized text;
any normalization or layout ambiguity leaves both page fields `NULL`. Do not infer
page values from section order, PDF page count, or prior document versions.

Stop the container while retaining data with `pnpm --filter legislation db:down`. To delete only the disposable
legislation database volume and recreate it from zero, run:

```text
pnpm --filter legislation db:reset
pnpm --filter legislation db:up
pnpm --filter legislation db:migrate
```

The Compose project and volume names are app-specific, so this reset does not target infrastructure belonging to
other monorepo applications.

## Local artifacts

When `AZURE_STORAGE_ACCOUNT` is unset, immutable source archives, normalized documents, and reports use the filesystem
adapter rooted at `LEGISLATION_SOURCE_DIRECTORY` (default `.data/sources`). Paths are content-addressed and constrained
to that app-owned directory. Set an Azure storage account to select the managed-identity Blob Storage adapter instead.

## Workspace boundary

Database code, infrastructure, ingestion, Trigger.dev tasks, MCP tools, authentication, and observability remain in this app.
Named [test projects](testing.md) prepare ownership boundaries for a future package split without moving source code.
Package extraction remains a separate decision; the test configuration does not imply independent builds or deployments.

<a id="nextjs-runtime"></a>

<a id="nextjs-runtime--nextjs-runtime-and-smoke-boundary"></a>

## Next.js runtime and smoke boundary

<a id="nextjs-runtime--ownership"></a>

### Ownership

`apps/legislation` is the canonical Legislative Intelligence application and documentation home. The deployed Railway
service retains the name `legislation-web`. That is a service identity, not a second canonical application. The Next.js
runtime, route handlers, and smoke harness belong to `apps/legislation`.

The deleted `legislation-api` Railway service is historical evidence only. It is neither a current service nor a
rollback target. Rollback uses the immediately preceding known-good `legislation-web` deployment.

<a id="nextjs-runtime--runtime-contract"></a>

### Runtime contract

Each documented public operation requires an explicit Next.js Route Handler. Root `GET /health` is liveness and root
`GET /ready` is database-backed readiness. Neither endpoint runs migrations. Browser code must never receive database
credentials, a machine-to-machine API secret, or a `NEXT_PUBLIC_*` copy of one.

The runtime is pinned to `next@16.3.1`, `react@19.2.7`, and `react-dom@19.2.7`. Next's build-only TypeScript API uses
the local `typescript@5.9.3` dependency; the repository's native TypeScript compiler remains the type-checking source
of truth. The deployment image is credential-free and uses a frozen install without copying workstation registry
credentials.

<a id="nextjs-runtime--current-release-boundary"></a>

### Current release boundary

The contract contains 81 HTTP operations and 25 advertised MCP tools after the September 14 scope reduction.
Use [API closeout](passage-search-delivery.md#september-14-scope-and-acceptance) for the latest recorded deployment,
accepted civic fixtures and remaining passage-search gate. Historical September 2 smoke does not establish current
full-corpus search acceptance. This documentation audit did not perform a fresh production smoke.

The locally implemented [regulatory text pilot](../regulations/legal-text-serving.md) adds one organization-gated HTTP
operation and MCP tool beyond that deployed baseline. Its production credentials and deployment checks remain open.

The shared Next.js API boundary authenticates supported and catch-all `/api/**` requests in WorkOS mode, installs
verified user/organization context, and returns the canonical `401` challenge before endpoint handlers run.
Health/readiness stay public. The `/mcp` route uses the API-backed adapter with separate WorkOS API and MCP audiences;
see [authentication](authentication.md) and [MCP acceptance](passage-search-delivery.md).

Production requires `AUTH_MODE=workos`, the public WorkOS verifier configuration, and independent base64 or base64url
32-byte values for `LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET` and `LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY`.
These names are deployment configuration, never client-visible values. Endpoint acceptance and corpus completeness
remain separate gates.

<a id="nextjs-runtime--smoke-procedure"></a>

### Smoke procedure

Run the deployed Next.js smoke only with an audited production origin and audited fixtures. The unified harness lives
in `apps/legislation/scripts/smoke-foundation.mjs`; use its documented `LEGISLATION_WEB_SMOKE_*` environment variables.
The profile is cumulative for every enabled route block.

```powershell
$env:LEGISLATION_WEB_SMOKE_BASE_URL = 'https://legislation-web-production-b024.up.railway.app'
$env:LEGISLATION_WEB_SMOKE_TOKEN = Read-Host 'API bearer token' -MaskInput
pnpm --filter legislation smoke:foundation
Remove-Item Env:LEGISLATION_WEB_SMOKE_TOKEN
```

`LEGISLATION_WEB_SMOKE_TOKEN` is optional for an isolated runtime with authentication disabled and required when the
target uses `AUTH_MODE=workos`. The harness sends it only as an in-memory `Authorization: Bearer` header for `/api/**`
requests. It does not send the token to `/health`, `/ready`, or the homepage and does not include it in reports or
diagnostics.

For search, document-difference, and research smoke, configure the audited query, expected-outcome, bill, document,
and research-fixture variables. Before repeating an expensive profile, verify no index build is active. The harness keeps fixture
identities, query text, coordinates, research prompts, tokens, and model errors out of its stable report.

Use [API acceptance](passage-search-delivery.md) for the retained release gates. Identify the currently running and preceding successful artifacts in Railway before an operational change.

<a id="observability"></a>

<a id="observability--observability-contract"></a>

## Observability contract

Every HTTP request has a correlation ID, every ingestion command has an ingestion-run ID, every Trigger.dev run has its
run ID, and OpenTelemetry supplies trace and span IDs. Logs use timestamp, level, service, environment, operation,
status, duration, error category, correlation ID, and targeted canonical identifiers where applicable.

Railway is the current application/database runtime; its service logs and metrics provide the runtime operating
surface. Azure Monitor and the retained Bicep alerts apply to Azure resources when deployed, not automatically to
Railway. Trigger.dev owns synchronization run status, retries, and schedule health.
Langfuse owns MCP tool and embedding observations,
including retrieval mode, sanitized filters, candidate counts, selected identifiers, provider, pinned model, usage, and
latency. Correlated observations share the request/run identifiers. Langfuse SDK v5 uses OpenTelemetry and masks credential-shaped fields,
bearer tokens, long payloads, and full bill text before export.

The `/ready` response includes only safe pool counters: active, idle, total, maximum, waiting, and saturation. It never
includes database URLs, SQL text, parameters, or credentials, so runtime probes and diagnostics can collect pool pressure.

Expected validation failures are `info`; recoverable provider throttling is `warn`; exhausted dependencies and internal
errors are `error`; high-volume diagnostic detail is `debug`. Development retains logs for 7 days, staging for 30 days,
and production for 90 days unless the organization policy is stricter. Production samples successful high-volume search
spans after a baseline is established but never samples errors or ingestion summaries.

Alert ownership belongs to the legislation on-call rotation. Page for sustained MCP 5xx rates, readiness failures, or
zero ready replicas. Trigger.dev notifications cover failed or delayed synchronization. Recovery evidence includes the
correlated run, cause, replay range, resulting checkpoint, coverage delta, and healthy query.

The retained Azure Bicep template defines three rules: MCP 5xx, readiness failure, and zero MCP replicas. Metric alerts use
Container Apps metrics; the readiness rule parses structured logs in `ContainerAppConsoleLogs_CL`. Rules can exist
without notification receivers, but each deployed environment should supply an on-call action group.

Configured retention periods and paging ownership above are operating requirements. This audit did not verify live
receiver wiring, retention configuration or a staffed on-call rotation. See [runtime ownership](#nextjs-runtime).
