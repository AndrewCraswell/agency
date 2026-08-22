# Architecture decision log

## Accepted decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| ADR-001 | Keep all product code, workflows, docs, and infrastructure under `apps/legislation`. | Prevent collisions in the shared monorepo until another app proves a reusable boundary. |
| ADR-002 | Use PostgreSQL full-text search and pgvector as the only MVP retrieval stores. | One transactional system is sufficient until measured corpus or query limits justify another store. |
| ADR-003 | Use Open States JSON archives, GovInfo bulk XML, and Congress.gov API v3 for state history, federal history, and federal updates. | These sources provide the required standardized or official coverage. |
| ADR-004 | Use OpenRouter as the model gateway and pin full provider/model IDs in code. | One gateway centralizes credentials and privacy controls; ADR-012 supersedes the original single-model assumption with evaluated product-specific routes. |
| ADR-005 | Use WorkOS as identity and organization authority. | Authentication and tenant identity share one externally managed contract. |
| ADR-007 | Deploy the application runtime to Azure Container Apps with Blob Storage, Key Vault, and Bicep. | The runtime remains containerized and infrastructure changes remain reviewable and repeatable. |
| ADR-008 | Use Langfuse for retrieval and model traces and Azure Monitor for runtime, infrastructure, and operational diagnostics. | Research-quality traces and platform operations have different retention and access concerns. |
| ADR-009 | Use a Railway-managed PostgreSQL 18 service with the pgvector image for development. | It avoids a second database control plane in Azure while preserving the PostgreSQL and pgvector application contract. The current public proxy does not support PostgreSQL TLS, so this is a development-only exception; staging and production require a TLS-capable endpoint. |
| ADR-010 | Use Trigger.dev Cloud for recurring synchronization, dispatch, retries, and run visibility. | The application retains normalization, checkpoints, idempotency, and leases while Trigger.dev owns execution. |
| ADR-011 | Use retained Open States archives for state history and self-hosted jurisdiction scrapers for recurring state freshness; do not depend on the Open States API in production. | The available 250-request daily API quota cannot support even one nationwide polling cycle at the required cadence, and a discretionary quota increase is not a viable dependency for a competing data product. |
| ADR-012 | Store broad-rollout vectors in dedicated, foreign-keyed tables under the `legislation` schema and require a treatment/control MCP retrieval canary before expansion. | A separate schema does not provide physical isolation, inline vectors would enlarge hot corpus rows, and a partially embedded corpus can bias hybrid ranking. Dedicated tables make model versions, canary cleanup, index rebuilds, and measured promotion safer. |
| ADR-013 | Route bills and supporting materials to `voyageai/voyage-4`; route document sections and structured amendments to `openai/text-embedding-3-small`; apply `cohere/rerank-v3.5` only to bill and document-passage discovery. | The expanded graded bakeoff exceeded the 0.02 absolute nDCG@10 promotion threshold for these specific model and reranker changes, while reranking harmed amendment and supporting-material ranking. |
| ADR-014 | Put Trigger.dev database traffic through PgBouncer transaction pooling while retaining a direct PostgreSQL administration and rollback URL. | A 200-client production smoke completed through 20 pooled PostgreSQL backends. Transaction pooling permits Trigger fan-out without assigning one PostgreSQL process to every worker, while the backend ceiling protects the 100-connection database. |

No blocking architecture decision remains open. New decisions use the next ADR number and record status, evidence,
consequences, owner, and reconsideration trigger.

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
