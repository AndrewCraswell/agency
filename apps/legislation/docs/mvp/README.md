# Legislative intelligence delivery plan

## Current objective

Complete and prove the development environment for a WorkOS-authenticated remote MCP server backed by a nationwide
state and federal legislative corpus. Production provisioning and launch are not part of the current delivery target.

## Implemented foundation

The application foundation, Azure development baseline, canonical bill model, search, query service, and WorkOS staging
authentication are implemented. Their completed milestone checklists have been removed. Architecture and operational
decisions remain documented in the focused pages under `docs`.

The remaining ingestion, document-processing, MCP, orchestration, observability, and validation work is consolidated
into the active roadmap rather than repeating completed tasks.

## Active roadmap

The canonical forward-looking task list is [Development completion roadmap](development-completion.md). It contains
only work that remains for the development MVP:

1. Finish and prove automated orchestration.
2. Ingest and validate the supported state and federal corpus.
3. Process documents and embeddings to the agreed quality gates.
4. Validate all seven MCP tools against the live corpus in two clients.
5. Prove development operations and publish a completion record.

## Next data phases

After the development MVP passes its exit gate, continue the remaining work in the
[Legislative data expansion roadmap](../roadmap.md): state people and committees, meetings and hearings, amendments and
supporting materials, and human review of the expanded MCP interface.

## Development MVP definition of done

The development MVP is complete when:

- Open States data from 2017 onward for all supported jurisdictions is imported or every unavailable archive is recorded
  as an upstream gap.
- GovInfo data for the 113th through 119th Congresses is imported, and Congress.gov incremental synchronization updates
  the same canonical bills.
- Every available document is attempted, every failure is categorized and replayable, and searchable sections reach the
  documented extraction and embedding thresholds.
- All seven MCP tools return source-aware results through authenticated Streamable HTTP.
- Two MCP-capable clients complete the evaluation set with recorded evidence and known limitations.
- n8n can run the bootstrap-to-searchable-corpus sequence without manual data manipulation.
- Azure Monitor, Langfuse, coverage reports, runbooks, and a development release record provide operational evidence.

## Scope boundaries

All implementation remains under `apps/legislation`. PostgreSQL is hosted by Railway for development; Azure contains the
application runtimes, n8n, Blob Storage, Key Vault, identities, and diagnostics in the legislation resource group.
WorkOS staging is the only authentication environment currently required.

Production infrastructure, production WorkOS configuration, billing, and customer launch remain deferred until the
development MVP exit gate is met.

## Task conventions

- Active tasks use stable phase identifiers such as `D2.4`.
- A task is complete only when its observable result has been verified in the repository or development environment.
- Provider fixtures remain available so parsers can be tested without external calls.
- Ingestion and processing operations are idempotent and restartable before schedules are enabled.
- Repository changes follow the monorepo verification command: `pnpm verify`.
