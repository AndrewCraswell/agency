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

Web source has four main directories: `src/app/` for Next routes, layouts and error boundaries, `src/components/` for
reusable UI, `src/modules/` for feature responsibilities, and `src/services/` for external integrations. Conversation
UI, agent code and request helpers live in `modules/conversations`; evaluation tools live in `modules/evaluations`;
theme state, initialization and controls live together in `components/theme`. Other modules group legislation (including
persistence, coverage and runtime composition), search, request handling and configuration. Services contain Sentry
initialization/privacy helpers, OpenRouter provider/retrieval adapters, and Langfuse HTTP/SDK setup. Prompts, model
choices, dataset validation and evaluation orchestration stay in their feature modules. Shared cross-app WorkOS and
embedding clients remain in core. No placeholder integrations or catch-all `server/` directory exist.

`src/proxy.ts` and `src/instrumentation*.ts` contain their framework implementations directly, without forwarding
wrappers in modules. Sentry initialization and shared privacy helpers live in `services/sentry`; browser instrumentation
imports only browser-safe helpers. The `@/` alias resolves to `src/`, for example `@/components/ui/button` and
`@/modules/conversations/components/ChatWorkspace`. Shared components must not import route files. Feature-specific
components stay in the owning module rather than a second shared components directory. Project configuration, `public/`,
and environment files remain at the workspace root. Tests stay beside each capability.

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
[the runtime guide](docs/operations/development.md) and [API acceptance](docs/engineering/api/search-and-diffs.md). The
former standalone `legislation-api` service was deleted and must not be recreated as a rollback target. Database
migrations live once in C and are released explicitly through `pnpm --filter legislation-web db:migrate`; no W, I or M
startup applies them. Separate runtime ownership is not evidence of a completed deployment cutover or live acceptance.

## Deferred capabilities

Standalone calendar and meeting-outcome API operations remain outside the public contract. See the
[product backlog](docs/product/product-spec.md) and [current API acceptance](docs/engineering/api/search-and-diffs.md).

The public [representative lookup](docs/operations/representative-lookup.md) is available at `/representatives` when
Geocodio credentials are configured. It uses browser location with permission and matches returned officials to stored
profiles.

The Bicep tree stays with W as a historical combined-runtime infrastructure reference. Its database/model credentials
are not the target M deployment contract; storage/OCR references concern I. See
[runtime ownership](docs/operations/development.md) before changing deployment configuration. AGENTS.md and CLAUDE.md
remain W-specific guidance.
