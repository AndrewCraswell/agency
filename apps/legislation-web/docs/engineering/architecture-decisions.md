# Architecture decision log

## Accepted decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| ADR-001 | Separate W `apps/legislation-web`, I `apps/legislation-ingestion`, M `apps/legislation-mcp` and C `packages/legislation-core`. | Supersedes the single-workspace decision. Apps consume C, never sibling source; M calls W over HTTPS. The physical rename is complete; ignored local state was not moved. |
| ADR-002 | Use PostgreSQL full-text search and pgvector as the only MVP retrieval stores. | Canonical PostgreSQL remains authoritative. The isolated passage-search design is documented by the ingestion search-maintenance and serving contracts; it does not authorize replacing the canonical database. |
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
  see the [API contract](api/README.md) for current behavior. Establish deployment status from the live environment.
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

## Single-root presentation boundary

The model-facing answer catalog and composition stream protocol remain in
[`composition.ts`](../../src/modules/conversations/composition.ts) and
[`compositionStream.ts`](../../src/modules/conversations/compositionStream.ts). Models select literal references,
not canonical display facts. The response-local presentation store resolves registered content and canonical result
references against the owning session before the stream emits validated snapshots.

[`ComposedRecord`](../../src/modules/conversations/components/ComposedRecord.tsx) validates the incoming transport
ID and complete snapshot with `presentationBlockSchema` before rendering. The schema requires exactly one root,
no children or actions, canonical result IDs, ordered record/reference agreement, and matching content ID/kind.
Invalid input renders an explicit failure; pending, interrupted and unavailable states keep their existing UI.

After validation, the client dispatches directly to the existing record card, record group or inline content
component. There is no client registry, JSON renderer provider or context carrying a second copy of resolved data.
Record inspector selection and focus return remain local to the activating presentation. Content components retain
their citation controls and session-owned pagination. Client shape validation does not replace server ownership,
canonical resolution or provenance validation.

## Research generation boundary

The research-answer feature in [`research-answers.ts`](../../src/modules/request-handling/api/research-answers.ts)
owns evidence serialization, system/user messages, the configured generation model, JSON output mode, temperature,
claim schema validation and rejection of unsupported citations. The provider adapter accepts a completed
`ChatCompletionRequest` through its capability-specific `ChatCompletionClient`; it does not build legislative prompts.

OpenRouter services retain endpoint construction, credentials, provider privacy controls, timeout signals and provider
envelope parsing. Generation remains a single request with the existing error behavior and configured-model fallback
when the provider omits its model ID. Embedding/reranking routes and their retry policy are unchanged. This boundary
does not introduce an orchestration framework or alter research-answer policy; captured-request tests preserve the
messages and settings without paid model calls.

## Canonical read projection boundary

Public response mapping belongs to the transport-free projection modules under `src/modules/request-handling/api`,
alongside `canonical-projection.ts` and `canonical-read.ts`. Document and vote mappings live in
[`document-read-projection.ts`](../../src/modules/request-handling/api/document-read-projection.ts) and
[`vote-read-projection.ts`](../../src/modules/request-handling/api/vote-read-projection.ts).
Handlers, batch/search/diff readers and persistence queries import those mappings directly, not through route handlers.
Query row types are type-only dependencies; mapping does not import HTTP helpers or telemetry infrastructure.

These modules preserve canonical validation, source provenance, date precision, bounded position continuation and
unknown-versus-zero counts. Route parsing, HTTP error translation and batch error envelopes remain in the handlers.
There is no compatibility re-export or generic repository layer.

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
