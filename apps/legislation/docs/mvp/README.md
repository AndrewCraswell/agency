# Legislative intelligence MVP implementation plan

## Objective

Deliver a production-deployed, WorkOS-authenticated remote MCP server that supports useful legislative research over a
nationwide state and federal historical corpus.

## Definition of done

The MVP is complete when it provides:

- Nationwide state legislative data from Open States for the supported historical range.
- Federal historical data from GovInfo.
- Incremental federal updates from Congress.gov.
- One canonical model for bills, actions, sponsors, votes, versions, supplemental documents, full text, and related bills.
- PostgreSQL full-text search and pgvector semantic search.
- The seven locked legislative MCP tools over Streamable HTTP.
- WorkOS authentication with organization identity propagated through each request.
- n8n orchestration for ingestion, document processing, and embedding jobs.
- OpenRouter embeddings pinned to `openai/text-embedding-3-small` at 1,536 dimensions.
- Langfuse retrieval traces and Azure Monitor operational diagnostics.
- Azure deployment reproducible through Bicep.
- Automated validation and human evaluations proving that MCP-capable agents can perform useful legislative research.

## Application boundary

All implementation stays under `apps/legislation`:

```text
apps/legislation/
├── docs/
├── infra/
│   └── bicep/
│       └── modules/
├── src/
│   ├── auth/
│   ├── cli/
│   ├── config/
│   ├── db/
│   │   ├── migrations/
│   │   ├── queries/
│   │   └── schema/
│   ├── ingestion/
│   │   ├── congress/
│   │   ├── documents/
│   │   ├── embeddings/
│   │   ├── govinfo/
│   │   └── openstates/
│   ├── legislation/
│   │   └── normalize/
│   ├── mcp/
│   │   └── tools/
│   ├── models/
│   ├── observability/
│   └── search/
├── tests/
│   ├── fixtures/
│   └── integration/
└── workflows/
```

Deployment may run multiple entry points from this application, but that does not require separate monorepo packages.

## Locked scope

### Sources

| Purpose | Source |
| --- | --- |
| State historical corpus | Open States bulk data |
| Federal historical corpus | GovInfo bulk data |
| Federal incremental updates | Congress.gov API |

### MCP tools

1. `search_bills`
2. `get_bill`
3. `get_bill_timeline`
4. `search_bill_text`
5. `get_bill_text`
6. `compare_bill_versions`
7. `find_related_bills`

### Explicitly deferred

- State real-time ingestion.
- Committee meetings, media, recordings, and transcripts.
- Mux and Deepgram.
- AI-generated summaries.
- Client portfolios, watch lists, notifications, and Novu.
- Web application and billing.
- Temporal, LangChain, and LangGraph.
- Redis, OpenSearch, a dedicated vector database, and a graph database.

## Milestone sequence

| Milestone | Outcome | Depends on |
| --- | --- | --- |
| [0](milestones/00-mvp-contract.md) | MVP contract and decisions are frozen | None |
| [1](milestones/01-application-foundation.md) | Local application foundation runs cleanly | 0 |
| [2](milestones/02-azure-baseline.md) | Reproducible Azure baseline exists | 0, 1 |
| [3](milestones/03-canonical-data-model.md) | Canonical legislative schema and IDs exist | 0, 1 |
| [4](milestones/04-open-states-ingestion.md) | Historical state corpus is ingestible | 3 |
| [5](milestones/05-govinfo-ingestion.md) | Historical federal corpus is ingestible | 3 |
| [6](milestones/06-congress-sync.md) | Federal corpus receives incremental updates | 3, 5 |
| [7](milestones/07-document-processing.md) | Legislative documents become structured text | 3-6 |
| [8](milestones/08-search-and-embeddings.md) | Structured, lexical, and semantic retrieval work | 3, 7 |
| [9](milestones/09-query-service.md) | Source-independent product operations work | 3, 8 |
| [10](milestones/10-mcp-server.md) | Remote MCP exposes the seven tools | 9 |
| [11](milestones/11-workos-auth.md) | Remote MCP access is authenticated | 10 |
| [12](milestones/12-n8n-orchestration.md) | Production data workflows run automatically | 4-8 |
| [13](milestones/13-observability.md) | Requests and jobs are diagnosable | 2, 4-12 |
| [14](milestones/14-validation-and-release.md) | Corpus, MCP, deployment, and usefulness are proven | 2-13 |

Milestones may overlap where their dependencies permit, but their exit criteria remain release gates.

## Task conventions

- Every task has a stable milestone-scoped identifier such as `M4.7`.
- A task is complete only when its stated evidence exists in the repository or the target environment.
- Provider fixtures must be retained so parsers can be tested without calling external services.
- Ingestion and processing work must be idempotent and restartable before production automation is enabled.
- Implementation work follows the monorepo verification command: `pnpm verify`.
