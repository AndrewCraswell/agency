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

Prepare a self-contained production context before building locally or in a remote registry. This keeps unrelated
monorepo packages and private registries out of the legislation build.

```powershell
pnpm container:prepare
docker build -f ../../.container/legislation/Dockerfile -t legislation:local ../../.container/legislation
```

`pnpm docker:build` runs both commands. The generated repository-level `.container/legislation` directory is ignored by
Git and excludes `.env`.
