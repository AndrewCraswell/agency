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
pnpm --filter legislation verify
```

The current public HTTP runtime is `apps/legislation` on Next.js 16.3.1. Its `app/api` Route Handlers are the
deployment boundary. The former `legislation-api` Railway service is deleted and must not be started or redeployed:

```text
pnpm --filter legislation build
pnpm --filter legislation test
pnpm --filter legislation check:types
pnpm --filter legislation lint
pnpm --filter legislation dev
```

The standalone development server listens on `127.0.0.1:3100` by default and exposes:

- `GET /health` for process health.
- `GET /ready` for dependency readiness.

Copy `.env.example` to an untracked environment file when local overrides are required. The initial foundation supports
server, logging, and PostgreSQL settings. Defaults are suitable for the app-contained local infrastructure.

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
pnpm --filter legislation test
```

The integration suite refuses to perform schema cleanup unless the URL targets the dedicated `legislation_test`
database. It drops only the `legislation` and `legislation_migrations` schemas.

Run the application startup smoke test with `pnpm --filter legislation smoke:local`. It starts the real server against
local PostgreSQL, verifies health and readiness, and shuts the process down.

## Permanent operator and evaluation scripts

The `scripts` directory contains reusable entry points, not deployed background
jobs. Keep their ownership explicit so completed rollouts do not leave
unexplained one-off files:

| Script group | Purpose | Retention rule |
| --- | --- | --- |
| `smoke-local.mjs` | Start the real local service and verify health and readiness. | Permanent release check. |
| `smoke-deployment.mjs` | Verify deployed health, readiness, one bearer-authenticated API collection, the MCP tool set, representative bill and document calls, and protocol behavior. | Permanent post-deployment check; requires separate `LEGISLATION_SMOKE_TOKEN` (API) and `LEGISLATION_MCP_SMOKE_TOKEN` (MCP) credentials, a root HTTP(S) base URL, and never logs either token. |
| `smoke-dependencies.mjs` | Verify production PostgreSQL, pgvector, managed identity, and Blob read/write behavior. | Permanent infrastructure check; packaged with the build intentionally. |
| `build-embedding-*`, `run-embedding-*`, `evaluate-embedding-canary.ts`, `rerank-embedding-bakeoff.ts` | Rebuild frozen evaluation inputs, seed a bounded treatment, compare retrieval, and reproduce model or reranker decisions. | Keep as regression tooling; remove superseded generated outputs instead. |
| `run-trigger-backfill.ts` | Plan or explicitly launch a resumable historical rebuild. | Permanent disaster-recovery and future-rebuild entry point. |
| `reconcile-trigger-schedules.ts` | Diff or explicitly reconcile managed Trigger schedules. | Permanent schedule-control entry point. |
| `copy-migrations.mjs`, `infra-what-if.mjs` | Package migration files with compiled output and preview infrastructure changes. | Permanent build and deployment tooling. |

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
Move code to a top-level monorepo package only after another application has a demonstrated need to consume it.

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
$env:LEGISLATION_WEB_SMOKE_TOKEN = Read-Host 'API bearer token'
pnpm --filter legislation smoke:foundation
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
