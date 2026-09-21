# Rostra web documentation

W owns the browser product, public HTTP API, sessions, subscriptions, webhooks, and query runtime. These pages document
current contracts and operating procedures. Linear owns active work and prioritization; do not add implementation
backlogs, completed-task ledgers, or dated deployment journals here.

## Start here

| Need | Canonical page |
| --- | --- |
| Product scope and audience | [Product specification](product/product-spec.md), [information architecture](product/information-architecture.md), [ideal customer profiles](product/icp.md) |
| Local setup, dependency deadlines and research pool ownership | [Development](operations/development.md) |
| Tests and final verification | [Testing](operations/testing.md) |
| Authentication and MCP setup | [Authentication](operations/authentication.md) |
| Frontend conventions | [Frontend styling](engineering/frontend-styling.md) |
| API contracts | [HTTP API index](engineering/api/README.md) |
| Architecture boundaries | [Architecture decisions](engineering/architecture-decisions.md) |
| Telemetry and diagnostics | [Telemetry specification](engineering/telemetry-spec.md), [debugging](operations/telemetry-debugging.md) |
| Regulatory APIs and search | [HTTP and MCP contract](regulations/api-mcp-contract.md), [search serving](regulations/legal-search-serving.md), [text serving](regulations/legal-text-serving.md) |
| Agent evaluation operations | [Agent evaluations](operations/agent-evaluations.md) |
| Goal-driven browser scenarios and resumption | [Scenario harness](operations/scenario-harness.md) |

From the repository root:

```powershell
pnpm --filter legislation-web dev
pnpm --filter legislation-web build
pnpm --filter legislation-web test
pnpm verify
```

`pnpm verify` currently delegates to the legislation verification gate. It checks the five legislation packages,
including `@repo/legislation-diffing`; it does not verify unrelated workspaces or run formatting. See
[full verification](operations/testing.md#full-verification) for the exact stages and environment-gated limitations.

## Product and interaction contracts

- [Design direction](design/design.md)
- [Notification experience](product/notification-experience.md)
- [Organization features](product/organization-features.md)
- [Pricing](product/pricing.md) and [pricing research](research/pricing.md)
- [Compact conversation diagnostics and copyable JSON exports](operations/conversation-export.md)
- [Conversation research lifecycle and memory](engineering/conversation-research-memory.md)
- [Canonical bill identity and citation titles](engineering/conversation-bill-identity.md)
- [Exact research selections](engineering/conversation-research-selection.md)
- [Bill progress](engineering/conversation-bill-progress.md)
- [Record inspectors](engineering/conversation-record-inspectors.md)
- [Entity card facts](engineering/entity-card-facts.md)

## Engineering contracts

- [Civic graph and events](engineering/api/civic-graph-and-events.md)
- [Legislative records](engineering/api/legislative-records.md)
- [Record collections](engineering/api/record-collections.md)
- [HTTP schemas](engineering/api/schemas.md)
- [Search and diffs](engineering/api/search-and-diffs.md)
- [Subscriptions and webhooks](engineering/api/subscriptions-and-webhooks.md)
- [Committee membership history](engineering/committee-membership-history.md)
- [Architecture decisions](engineering/architecture-decisions.md), including canonical read projection, feature-owned
  research generation, and single-root presentation rendering

## Telemetry

Start with [the telemetry specification](engineering/telemetry-spec.md). Supporting contracts cover
[runtime ownership](engineering/telemetry-runtime-design.md), [privacy](engineering/telemetry-privacy.md),
[correlation](engineering/telemetry-correlation.md), [events](engineering/telemetry-events.md),
[browser telemetry](engineering/browser-telemetry.md), [Node telemetry](engineering/node-telemetry.md),
[edge telemetry](engineering/edge-telemetry.md), [conversation telemetry](engineering/conversation-telemetry.md), and
[tool execution telemetry](engineering/tool-execution-telemetry.md).

## Operations

- [Environments and deployments](../../../docs/environments-and-deployments.md)
- Production releases use the manual protected deployment workflow. It requires exact staging acceptance, creates a
  database backup before a selected migration, and verifies W readiness, API behavior, browser behavior and CDN
  behavior before M can deploy.
- [CDN cache operations](operations/cdn-cache.md)
- [HTTP API smoke checks](operations/http-api-local-smoke.md)
- [Representative lookup](operations/representative-lookup.md)
- [Telemetry acceptance](operations/telemetry-acceptance.md)
- [Vote date precision](operations/vote-date-precision.md)

## Other legislation workspaces

- [Ingestion](../../legislation-ingestion/docs/README.md)
- [MCP](../../legislation-mcp/docs/README.md)
- [Shared contracts and database](../../../packages/legislation-core/docs/README.md)

Cross-workspace contracts have one owner. Link to that owner instead of copying its requirements into W.
