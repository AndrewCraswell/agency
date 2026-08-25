# Legislation

Legislative intelligence service containing synchronization, canonical data, document processing, search, the remote MCP
server, authentication, observability, and Azure MCP infrastructure.

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

From `apps/legislation`, `pnpm docker:build` runs the same root-context build. For the `legislation-api` Railway
service, keep the repository root visible and explicitly set Config File Path to `/apps/legislation/railway.json`;
Railway does not auto-discover this nested file. The service reads Railway's `PORT`, binds to `0.0.0.0`, and starts only
the HTTP/API/MCP server. Database migrations remain an explicit release operation through
`pnpm --filter legislation db:migrate`; container startup never applies them.

## Representative lookups

`POST /api/representative-lookups` is registered in every API deployment. When `OPENSTATES_API_KEY` is configured, the
CLI composes the public US Census geocoder and OpenStates adapter; otherwise the route returns
`503 dependency_unavailable`. The provider receives one normalized address or coordinate request in memory and must not
persist or log it.

The existing OpenStates integration defines the applicable civic-data credential: provision an activated OpenStates API
key as `OPENSTATES_API_KEY`, retain `OPENSTATES_API_URL=https://v3.openstates.org`, and use it through the documented
`/people.geo` endpoint for coordinate-to-legislator results. US address requests use the public Census
structured-address geocoder and then call OpenStates; that geocoder has no API-key configuration. Both integrations run
with the existing bounded request timeout, and address data is neither logged nor persisted.
