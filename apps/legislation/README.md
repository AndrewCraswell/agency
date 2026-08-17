# Legislation

Legislative intelligence application containing the complete MVP implementation boundary: ingestion, canonical data,
document processing, search, the remote MCP server, authentication, workflows, observability, and Azure infrastructure.

## Structure

```text
apps/legislation/
├── docs/          Product and implementation documentation
├── infra/         Azure Bicep infrastructure
├── src/           Application source code
├── tests/         Cross-cutting fixtures and integration tests
└── workflows/     n8n workflow definitions
```

The application remains one monorepo workspace unless a component is proven to be reusable by another product.

Start with [the MVP implementation plan](docs/mvp/README.md).

## Container image

Prepare a self-contained production context before building locally or in a remote registry. This keeps unrelated
monorepo packages and private registries out of the legislation build.

```powershell
pnpm container:prepare
docker build -f ../../.container/legislation/Dockerfile -t legislation:local ../../.container/legislation
```

`pnpm docker:build` runs both commands. The generated repository-level `.container/legislation` directory is ignored by
Git and excludes `.env`.
