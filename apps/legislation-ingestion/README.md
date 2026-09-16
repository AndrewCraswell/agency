# Legislation Ingestion

Provider acquisition, canonical import persistence, document processing, OCR, embeddings, source coverage collection,
search replication and Trigger.dev orchestration. This app does not host the web API or MCP.

## Commands

- `pnpm --filter legislation-ingestion cli --help`: source and maintenance commands.
- `pnpm --filter legislation-ingestion tool --list`: app-local operator tools.
- `pnpm --filter legislation-ingestion trigger:dev`: Trigger workers.
- `pnpm --filter legislation-ingestion trigger:deploy`: validate the deployed API contract, then deploy workers.
- `pnpm --filter legislation-ingestion build`: TypeScript check without emitting a build artifact.
- `pnpm --filter legislation-ingestion test`: worker, parsing and tool suites.
- `pnpm --filter legislation-ingestion test:parsing`: parsing and native-runtime suites.
- `pnpm --filter legislation-ingestion test:database`: guarded disposable-database suites.
- `pnpm --filter legislation-ingestion test:python`: Python unittest discovery.
- `pnpm --filter legislation-ingestion test:coverage`: worker, parsing and tool coverage; Python runs separately.

Use Node 24 or later, pnpm 11 and the Python runtime pinned by the scraper Dockerfiles. Install workspace links before
compiling consumers. Migration assets and database setup belong to `@repo/legislation-core`; W releases migrations
explicitly through `pnpm --filter legislation-web db:migrate`. They are not an importer CLI or startup command. Root
verification must sequence database suites across apps, not run them concurrently.

## Configuration

The local loader reads database, ingestion/provider, source storage, OCR, backfill, embedding and worker telemetry
settings. It does not load WorkOS, Next.js, chat, web encryption keys or serving search settings. Provider credentials
remain optional until their source command executes. Existing Trigger project configuration is preserved; extraction
does not deploy workers or change credentials.

Follow [local environment setup](../legislation-web/docs/operations/development.md#local-environment-after-the-move)
before running a command. The ignored environment file remains under `apps/legislation`; manually relocate only I-owned
settings locally. Do not copy the combined environment wholesale or expose values in logs, chat or commits.

## Document Relay

`pnpm --filter legislation-ingestion relay` starts only the approved-source relay, `/health` and `/ready`. Set
`DOCUMENT_FETCH_RELAY_TOKEN`, optionally `DOCUMENT_FETCH_RELAY_HOST` and `DOCUMENT_FETCH_RELAY_PORT` (default 3102). The
relay accepts authenticated POSTs at `/internal/document-fetch`, retains the source allowlist, and limits request bodies
to 4096 bytes. Public hosting requires an independently configured TLS endpoint. No MCP or API routes are hosted.

## Local Assets

Tracked Python files, Dockerfiles, source fixtures, regulatory fixtures and review evidence moved with the worker.
Ignored `.data`, `data`, `artifacts`, `tmp`, `.trigger`, Python caches and local dependency directories were not moved
or deleted. Existing scraper build-input directories therefore remain under the former app location. Before a local
Docker build, explicitly relocate the required inputs into this app's `artifacts/openstates-runtime` or provide them in
the chosen Docker build context. Do not copy credentials or unrelated runtime evidence as part of that operation.

The application-local Python directory is runtime input for parser bridges and Trigger builds. Run source tools from
this package directory. Shared migration, tokenizer and search-schema assets resolve through core, not sibling apps.

## Documentation

Use the [ingestion index](docs/README.md) for source policy, workers, regulatory evidence and operations;
[core](../../packages/legislation-core/docs/README.md) for shared contracts; [web](../legislation-web/docs/README.md)
for product/API acceptance; and [MCP](../legislation-mcp/docs/README.md) for transport. Web links resolve to
`apps/legislation-web`. Dated evidence does not certify live separated-runtime acceptance.
