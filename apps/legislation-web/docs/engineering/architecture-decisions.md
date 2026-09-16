# Architecture decision log

## Accepted decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| ADR-001 | Separate W `apps/legislation-web`, I `apps/legislation-ingestion`, M `apps/legislation-mcp` and C `packages/legislation-core`. | Supersedes the single-workspace decision. Apps consume C, never sibling source; M calls W over HTTPS. The physical rename is complete; ignored local state was not moved. |
| ADR-002 | Use PostgreSQL full-text search and pgvector as the only MVP retrieval stores. | Canonical PostgreSQL remains authoritative. The later isolated passage-search exception is recorded in passage-search-delivery.md; it does not authorize replacing the canonical database. |
| ADR-003 | Use Open States JSON archives for state history and state committee data, GovInfo bulk XML for federal history, GovInfo for federal committee data, and Congress.gov API v3 for federal updates other than standalone committee organization and membership materialization. | GovInfo is the sole approved federal committee-data source and OpenStates is the sole approved state committee-data source; the GovInfo CDIR importer is implemented, with edition acceptance and quarantine gaps recorded in committee-membership-history.md. |
| ADR-004 | Use OpenRouter as the model gateway and pin full provider/model IDs in code. | One gateway centralizes credentials and privacy controls; ADR-012 supersedes the original single-model assumption with evaluated product-specific routes. |
| ADR-005 | Use WorkOS as identity and organization authority. | Authentication and tenant identity share one externally managed contract. |
| ADR-007 | Superseded by ADR-001 and ADR-015 for runtime ownership. | The whole Bicep tree remains historical combined-runtime reference under W, not M's deployment template; Azure storage/OCR references concern I. |
| ADR-008 | Use Langfuse for retrieval/model traces, Railway for the deployed runtime, Trigger.dev for jobs, and Azure Monitor for applicable Azure resources. | Research-quality traces and platform operations have different retention and access concerns. |
| ADR-009 | Use Railway-managed PostgreSQL with pgvector; see database-connection-pooling.md for the current production connection contract. | The original development proxy/TLS exception was environment-specific, not a statement of current production settings. PgBouncer worker routing is governed by ADR-014. |
| ADR-010 | Use Trigger.dev Cloud for recurring synchronization, dispatch, retries, and run visibility. | The application retains normalization, checkpoints, idempotency, and leases while Trigger.dev owns execution. |
| ADR-011 | Use retained Open States archives for state history and self-hosted jurisdiction scrapers for recurring state freshness; do not depend on the Open States API in production. | The available 250-request daily API quota cannot support even one nationwide polling cycle at the required cadence, and a discretionary quota increase is not a viable dependency for a competing data product. |
| ADR-012 | Store broad-rollout vectors in dedicated, foreign-keyed tables under the `legislation` schema and require a treatment/control MCP retrieval canary before expansion. | A separate schema does not provide physical isolation, inline vectors would enlarge hot corpus rows, and a partially embedded corpus can bias hybrid ranking. Dedicated tables make model versions, canary cleanup, index rebuilds, and measured promotion safer. |
| ADR-013 | Route bills and supporting materials to `voyageai/voyage-4`; route document sections and structured amendments to `openai/text-embedding-3-small`; apply `cohere/rerank-v3.5` only to bill and document-passage discovery. | The expanded graded bakeoff exceeded the 0.02 absolute nDCG@10 promotion threshold for these specific model and reranker changes, while reranking harmed amendment and supporting-material ranking. |
| ADR-014 | Put Trigger.dev database traffic through PgBouncer transaction pooling while retaining a direct PostgreSQL administration and rollback URL. | A 200-client production smoke completed through 20 pooled PostgreSQL backends. Transaction pooling permits Trigger fan-out without assigning one PostgreSQL process to every worker, while the backend ceiling protects the 100-connection database. |
| ADR-015 | W uses Next.js 16 App Router with one explicit `src/app/api` Route Handler per public operation; M is a separate MCP resource and I a separate worker runtime. | W owns query/model execution; M uses its authenticated HTTP adapter, not databases. C stores migrations once; W releases them explicitly, never during W/I/M startup. Retained deployment evidence does not certify the separated runtime cutover. |
| ADR-016 | Include Novu for planned in-app and email notifications; keep legislative subscriptions, matching, batching, and signed webhooks in the application. | The chat-first product needs one inbox and effective delivery preferences without moving domain event semantics into a notification provider. |

The Next.js scaffold landed in commit `03e1c7b` with `next@16.2.6`; the current resolved version is exact
`next@16.3.1`. New decisions use the next ADR number and record status, evidence, consequences, owner, and
reconsideration trigger.

## ADR-015 operational consequences

- Status: accepted runtime separation; live deployment acceptance of the separated apps remains unverified here.
  The September 14 recorded baseline is 81 HTTP operations and 25 MCP tools;
  see [API closeout](../operations/passage-search-delivery.md) for dated deployment evidence and the remaining passage-search gate.
  The local [regulatory text pilot](../regulations/legal-text-serving.md) adds one gated HTTP operation and MCP tool;
  its deployed acceptance is still open.
- Explicit API handlers belong under W's `src/app/api`; M owns `/mcp`, discovery, transport and outbound API credentials.
  WorkOS API/session/MCP audiences remain separate. Chat stays in W's query runtime. Source code does not establish corpus completeness.
- Migration/schema assets live once in C. Release them through `pnpm --filter legislation-web db:migrate` using the
  direct administration connection. Builds, W/I/M startup and health/readiness never apply migrations.
- Deploy `legislation-web`; rollback only to a verified prior artifact of that service. Do not recreate the deleted
  `legislation-api` service or treat the historical Azure runtime plan as the current application deployment.
- Owner: legislation application platform. Reconsider framework choice only with an explicit updated architecture decision.

## ADR-001 operational consequences

- W owns product/API/auth/query docs, I source/worker/evidence docs, M MCP transport/auth/tool docs, and C shared contracts.
  Owner indexes: [W](../README.md), [I](../../../legislation-ingestion/docs/README.md),
  [M](../../../legislation-mcp/docs/README.md), [C](../../../../packages/legislation-core/docs/README.md).
- No app imports another app; C imports no app. M needs no source-provider, database, OCR, Trigger or model credentials.
- AGENTS.md and CLAUDE.md remain W-specific. Historical Bicep stays W-owned reference, not proof of live placement.
- Separate deployment and positive consent require release evidence. Historical anonymous/wrong-token rejection is not
  successful browser consent, and a local extraction is not deployed acceptance.

## ADR-011 operational consequences

- Status: accepted.
- Evidence: the production key is limited to 250 requests per day; the configured minimum cadence requires at least
  3,172 requests per day before pagination, retries, or high-volume jurisdictions.
- Consequences: keep all Open States API schedules inactive; retain session JSON archives for rebuilds; onboard
  self-hosted scrapers one jurisdiction at a time; retain raw scraper output in `state-sources`; and normalize scraper
  output through the canonical ingestion layer.
- Owner: legislation data platform.
- Reconsideration trigger: none for a discretionary API quota increase. Reconsider only if the provider offers a
  contractual production feed with sufficient quota, availability, and commercial redistribution rights.

## ADR-016 operational consequences

- Status: accepted for product/design scope on September 14, 2026; integration and deployment are not complete.
- Evidence: user requested Novu in the notification specification; current provider documentation and integration
  requirements are linked in the [notification experience](../product/notification-experience.md).
- Consequences: Novu is no longer deferred. The application owns domain matching, durable delivery identity, batching,
  and authorization; Novu handles configured in-app/email execution and inbox state. Preserve the public webhook
  contract. Resolve provider status mapping, preference precedence, recipient policy, and recovery before rollout.
- Owner: legislation application team.
- Cost and release gates: choose hosting/region and plan, estimate recipient/channel volume and budget, establish
  retention, and verify authenticated delivery and isolation canaries before production activation.
- Reconsideration trigger: required isolation, preference behavior, recovery, or delivery observability cannot be met.
