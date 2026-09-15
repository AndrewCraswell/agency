# Legislation

Legislative intelligence application containing synchronization, canonical data, document processing, search, the
Next.js public API boundary, the remote MCP server, authentication, observability, and infrastructure templates. This is
the canonical application and documentation home. Railway retains the service name `legislation-web`; that service name
does not create a separate canonical product application.

## Structure

```text
apps/legislation/
├── docs/          Product and implementation documentation
├── infra/         MCP infrastructure and local PostgreSQL
├── scripts/       Build, smoke, and Trigger.dev operations
├── src/           Application source code
└── trigger.config.ts
```

The application remains one monorepo workspace unless a component is proven to be reusable by another product.

Start with the [documentation index](docs/README.md).

## Container image

Build from the repository root so pnpm can resolve the root lockfile, catalog, and shared workspace configuration. The
multi-stage image compiles only `legislation`, prunes the runtime to production dependencies, and runs as a non-root
user.

```powershell
docker build -f apps/legislation/Dockerfile -t legislation:local .
```

From `apps/legislation`, `pnpm docker:build` runs the same root-context build for local service work. Production is the
Railway service named `legislation-web`; its current Next.js deployment configuration and release evidence are recorded
in [the runtime guide](docs/operations/development.md) and [API acceptance](docs/operations/passage-search-delivery.md).
The former standalone `legislation-api` service was deleted and must not be recreated as a rollback target. Database
migrations remain an explicit release operation through `pnpm --filter legislation db:migrate`; container startup never
applies them.

## Deferred capabilities

Standalone calendar, meeting-outcome and representative-lookup API operations were removed from the public contract.
Address-lookup mockups do not imply an available API or activated provider. See the
[product backlog](docs/backlog/backlog.md) and [current API acceptance](docs/operations/passage-search-delivery.md).

The Bicep MCP template is retained as an infrastructure reference; the current application/API-backed MCP runtime is
Next.js on Railway. See [runtime ownership](docs/operations/development.md#nextjs-runtime) before changing deployment
configuration.
