# Legislation Web

Product application for browser chat, the public HTTP API, account/session authentication, subscriptions, webhooks,
database queries and retrieval. The workspace is `apps/legislation-web` and its package name is `legislation-web`.

## Structure

```text
apps/legislation-web/        Product, HTTP API and query runtime (W)
apps/legislation-ingestion/  Source acquisition, workers and indexing (I)
apps/legislation-mcp/        Standalone authenticated MCP-to-HTTP adapter (M)
packages/legislation-core/   Shared contracts, database schema and primitives (C)
```

Applications consume selected core exports, never sibling application source. MCP calls W over HTTPS and has no
database, model-provider or source-provider runtime. Web chat calls W's own query runtime directly.

Web source has three main directories: `src/app/` for Next routes and app UI, `src/components/` for reusable UI, and
`src/modules/` for responsibility-owned capabilities. Modules group legislation (including persistence, coverage and
runtime composition), search (including retrieval and result projections), request handling (including HTTP adapters),
configuration, and observability (including Sentry). There is no catch-all `server/` directory.

`src/proxy.ts` and `src/instrumentation*.ts` are thin Next discovery entrypoints delegating to modules. The proxy
matcher remains statically declared in its entrypoint. Browser instrumentation loads only its browser-safe observability
module, not a barrel containing server initialization. The `@/` alias resolves to `src/app/`. Project configuration,
`public/`, and environment files remain at the workspace root. Tests stay beside each capability.

Start with the [documentation index](docs/README.md), [ingestion](../legislation-ingestion/README.md),
[MCP](../legislation-mcp/README.md) or [core](../../packages/legislation-core/README.md).

Before starting locally, follow [environment setup](docs/operations/development.md#local-environment-after-the-move).
Ignored credentials and evidence were not relocated by the workspace rename.

## Container image

Build from the repository root so pnpm can resolve the root lockfile, catalog, and shared workspace configuration. The
multi-stage image compiles only W and its shared dependency closure, prunes the runtime to production dependencies, and
runs as a non-root user.

```powershell
docker build -f apps/legislation-web/Dockerfile -t legislation-web:local .
```

From W, `pnpm docker:build` runs the same root-context build for local service work. The recorded Railway service is
named `legislation-web`; its Next.js deployment configuration and historical release evidence are recorded in
[the runtime guide](docs/operations/development.md) and [API acceptance](docs/operations/passage-search-delivery.md).
The former standalone `legislation-api` service was deleted and must not be recreated as a rollback target. Database
migrations live once in C and are released explicitly through `pnpm --filter legislation-web db:migrate`; no W, I or M
startup applies them. Separate runtime ownership is not evidence of a completed deployment cutover or live acceptance.

## Deferred capabilities

Standalone calendar, meeting-outcome and representative-lookup API operations were removed from the public contract.
Address-lookup mockups do not imply an available API or activated provider. See the
[product backlog](docs/backlog/backlog.md) and [current API acceptance](docs/operations/passage-search-delivery.md).

The Bicep tree stays with W as a historical combined-runtime infrastructure reference. Its database/model credentials
are not the target M deployment contract; storage/OCR references concern I. See
[runtime ownership](docs/operations/development.md) before changing deployment configuration. AGENTS.md and CLAUDE.md
remain W-specific guidance.
