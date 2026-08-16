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
