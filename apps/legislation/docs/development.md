# Local development

## Requirements

- Node.js 24 or newer.
- pnpm 11.
- Docker Desktop or another Docker Compose-compatible runtime for PostgreSQL integration work.
- The monorepo dependencies installed from the repository root.

## Commands

From the repository root:

```text
pnpm install
pnpm --filter legislation-web dev
pnpm --filter legislation-web test
pnpm --filter legislation-web check:types
pnpm --filter legislation-web verify
```

The current public HTTP runtime is `apps/legislation-web` on Next.js 16.3.1. Its `app/api` Route Handlers are the
deployment boundary. The following commands exercise reusable legislation domain and transitional standalone code; they
do not start or deploy the deleted `legislation-api` Railway service:

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

The current Railway runtime is `legislation-web`. Its image uses the repository root as Docker context so pnpm can
resolve the root lockfile, catalog, and shared TypeScript package. The Dockerfile installs the web application and its
legislation dependency closure, builds the Next.js application, and runs the standalone output as a non-root process.

From the repository root:

```text
docker build -f apps/legislation-web/Dockerfile -t legislation-web:local .
```

Railway config-as-code lives at `apps/legislation-web/railway.json`. Keep the service root at the repository root and
explicitly set Config File Path to `/apps/legislation-web/railway.json`; nested config is not discovered automatically.
Before release, verify the effective service uses the Dockerfile builder, `apps/legislation-web/Dockerfile`, and `/ready`
health check. Railway injects `PORT`; the service binds it on `0.0.0.0`. Apply migrations as a separate, explicit
release operation with `pnpm --filter legislation db:migrate`; neither the image build nor startup runs migrations.

The current verified deployment is `1795e79c-9a7a-4f6a-ab6c-c7c1a546450a` from source commit `6afcf42` (including route
commit `04ca95d`), with image
`sha256:a9bd51f8b4af80b50986b5f7bec35b272d8530c71ded44f10805635c51221f84`. Rollback uses the prior successful
`legislation-web` deployment `cc047806-27f7-4110-a6e0-7f27f4b4e517`. The former `legislation-api` Railway service was
deleted and must not be redeployed, described as current, or used as a rollback target.

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
