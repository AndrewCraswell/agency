# Architecture decision log

## Accepted decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| ADR-001 | Keep all product code, workflows, docs, and infrastructure under `apps/legislation`. | Prevent collisions in the shared monorepo until another app proves a reusable boundary. |
| ADR-002 | Use PostgreSQL full-text search and pgvector as the only MVP retrieval stores. | One transactional system is sufficient until measured corpus or query limits justify another store. |
| ADR-003 | Use Open States JSON archives, GovInfo bulk XML, and Congress.gov API v3 for state history, federal history, and federal updates. | These sources provide the required standardized or official coverage and provenance. |
| ADR-004 | Use OpenRouter with `openai/text-embedding-3-small` pinned to 1,536 dimensions. | The schema and retrieval contract require one reproducible embedding shape. |
| ADR-005 | Use WorkOS as identity and organization authority. | Authentication and tenant identity share one externally managed contract. |
| ADR-006 | Use n8n only for schedules, fan-out, retries, and operator visibility; keep business logic in TypeScript commands. | The same tested logic must run locally, in CI, and under orchestration. |
| ADR-007 | Deploy to Azure Container Apps with PostgreSQL Flexible Server, Blob Storage, Key Vault, and Bicep. | The runtime remains containerized and infrastructure changes remain reviewable and repeatable. |
| ADR-008 | Use Langfuse for retrieval and model traces and Azure Monitor for runtime, infrastructure, and operational diagnostics. | Research-quality traces and platform operations have different retention and access concerns. |

No blocking architecture decision remains open. New decisions use the next ADR number and record status, evidence,
consequences, owner, and reconsideration trigger.
