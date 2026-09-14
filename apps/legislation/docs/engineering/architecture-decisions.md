# Architecture decision log

## Accepted decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| ADR-001 | Keep all product code, workflows, docs, and infrastructure under `apps/legislation`. | Prevent collisions in the shared monorepo until another app proves a reusable boundary. |
| ADR-002 | Use PostgreSQL full-text search and pgvector as the only MVP retrieval stores. | Canonical PostgreSQL remains authoritative. The later isolated passage-search exception is recorded in passage-search-delivery.md; it does not authorize replacing the canonical database. |
| ADR-003 | Use Open States JSON archives for state history and state committee data, GovInfo bulk XML for federal history, GovInfo for federal committee data, and Congress.gov API v3 for federal updates other than standalone committee organization and membership materialization. | GovInfo is the sole approved federal committee-data source and OpenStates is the sole approved state committee-data source; the GovInfo CDIR importer is implemented, with edition acceptance and quarantine gaps recorded in committee-membership-history.md. |
| ADR-004 | Use OpenRouter as the model gateway and pin full provider/model IDs in code. | One gateway centralizes credentials and privacy controls; ADR-012 supersedes the original single-model assumption with evaluated product-specific routes. |
| ADR-005 | Use WorkOS as identity and organization authority. | Authentication and tenant identity share one externally managed contract. |
| ADR-007 | Superseded for the application/MCP runtime by ADR-015: Next.js on Railway. | The Bicep template remains reference infrastructure; Azure storage may still serve ingestion artifacts. |
| ADR-008 | Use Langfuse for retrieval/model traces, Railway for the deployed runtime, Trigger.dev for jobs, and Azure Monitor for applicable Azure resources. | Research-quality traces and platform operations have different retention and access concerns. |
| ADR-009 | Use Railway-managed PostgreSQL with pgvector; see database-connection-pooling.md for the current production connection contract. | The original development proxy/TLS exception was environment-specific, not a statement of current production settings. PgBouncer worker routing is governed by ADR-014. |
| ADR-010 | Use Trigger.dev Cloud for recurring synchronization, dispatch, retries, and run visibility. | The application retains normalization, checkpoints, idempotency, and leases while Trigger.dev owns execution. |
| ADR-011 | Use retained Open States archives for state history and self-hosted jurisdiction scrapers for recurring state freshness; do not depend on the Open States API in production. | The available 250-request daily API quota cannot support even one nationwide polling cycle at the required cadence, and a discretionary quota increase is not a viable dependency for a competing data product. |
| ADR-012 | Store broad-rollout vectors in dedicated, foreign-keyed tables under the `legislation` schema and require a treatment/control MCP retrieval canary before expansion. | A separate schema does not provide physical isolation, inline vectors would enlarge hot corpus rows, and a partially embedded corpus can bias hybrid ranking. Dedicated tables make model versions, canary cleanup, index rebuilds, and measured promotion safer. |
| ADR-013 | Route bills and supporting materials to `voyageai/voyage-4`; route document sections and structured amendments to `openai/text-embedding-3-small`; apply `cohere/rerank-v3.5` only to bill and document-passage discovery. | The expanded graded bakeoff exceeded the 0.02 absolute nDCG@10 promotion threshold for these specific model and reranker changes, while reranking harmed amendment and supporting-material ranking. |
| ADR-014 | Put Trigger.dev database traffic through PgBouncer transaction pooling while retaining a direct PostgreSQL administration and rollback URL. | A 200-client production smoke completed through 20 pooled PostgreSQL backends. Transaction pooling permits Trigger fan-out without assigning one PostgreSQL process to every worker, while the backend ceiling protects the 100-connection database. |
| ADR-015 | Use the Next.js 16 App Router application in `apps/legislation` as the legislation application and public API runtime, with one explicit Route Handler under `apps/legislation/app/api` per documented operation. | One framework owns the future application and HTTP boundary. Existing domain code in `apps/legislation` remains reusable migration input, but the former Railway `legislation-api` service is deleted and is not a rollback target. A route is complete only after its Next.js handler passes a staged `legislation-web` deployment and remote smoke. WorkOS enforcement and API-backed MCP are implemented; current acceptance and remaining search gates are recorded in passage-search-delivery.md. |
| ADR-016 | Include Novu for planned in-app and email notifications; keep legislative subscriptions, matching, batching, and signed webhooks in the application. | The chat-first product needs one inbox and effective delivery preferences without moving domain event semantics into a notification provider. |

The Next.js scaffold landed in commit `03e1c7b` with `next@16.2.6`; the current resolved version is exact
`next@16.3.1`. New decisions use the next ADR number and record status, evidence, consequences, owner, and
reconsideration trigger.

## ADR-015 operational consequences

- Status: accepted and implemented in the Next.js application. Public scope is 81 HTTP operations and 25 MCP tools;
  see [API closeout](../operations/passage-search-delivery.md) for dated deployment evidence and the remaining passage-search gate.
- Explicit API handlers belong under `apps/legislation/app/api`; MCP is composed through the HTTP query adapter.
  WorkOS API/session/MCP audiences remain separate. Source code does not establish corpus completeness.
- Deploy `legislation-web`; rollback only to a verified prior artifact of that service. Do not recreate the deleted
  `legislation-api` service or treat the historical Azure runtime plan as the current application deployment.
- Owner: legislation application platform. Reconsider framework choice only with an explicit updated architecture decision.

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
