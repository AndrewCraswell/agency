# Tabra documentation

Start with the question you need to answer. Planned product features and dated release evidence are not claims of live
availability.

| Question                                                | Read                                                                                                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What are we building?                                   | [ICP-focused product specification](product/product-spec.md): core research jobs, scope/value gate and acceptance                                                          |
| Who should we serve and prioritize?                     | [Ideal customer profiles](product/icp.md): needs, journeys, fit, revenue scenarios and acquisition effort                                                                  |
| Who competes for each customer's job?                   | [Competitors by ICP](product/competitors.md): alternatives, strengths, gaps and dated commercial evidence                                                                  |
| What should we build next?                              | [Single product backlog](backlog/backlog.md)                                                                                                                               |
| How should it work and look?                            | [Design brief and handoff](design/design.md), [task hierarchy and routes](product/information-architecture.md), [mockups](../legislation.pen)                              |
| How does conversation connect the product?              | [Conversations and product integration](design/conversations.md): entry, turns, content types, references/citations, progress and write-back                               |
| How do lists scale as data grows?                       | [Discovery and collection behavior](product/information-architecture.md#supporting-discovery): scope, grouping, sorting, pagination and selection                          |
| How do we complete the core workflows?                  | [Connected IA flows](product/information-architecture.md#connected-acceptance-flows), [customer workflow acceptance](product/product-spec.md#customer-workflow-acceptance) |
| Where is complexity justified?                          | [Scope and complexity budget](product/product-spec.md#scope-and-complexity-budget), [navigation priorities](product/information-architecture.md#navigation-priorities)     |
| How do organizations and workspaces work?               | [Navigation and management design](design/organization-workspace-design.md), [organization behavior](product/organization-features.md)                                     |
| What do customers pay for?                              | [Pricing and offerings](product/pricing.md), [organization and workspace behavior](product/organization-features.md)                                                       |
| What has passed release acceptance?                     | [API and passage acceptance](operations/passage-search-delivery.md)                                                                                                        |
| What is the state-ingestion priority?                   | [NC/Alaska end-to-end gate](operations/openstates-rollout-checklist.md), [onboarding queue](operations/openstates-jurisdiction-onboarding.md)                              |
| How do I develop or operate it?                         | [Development and runtime](operations/development.md), [API contract](engineering/api/README.md)                                                                            |
| How will we add regulations?                            | [Regulatory plan](regulations/README.md)                                                                                                                                   |
| How do we implement regulatory ingestion and retrieval? | [Implementation specification](regulations/implementation.md), [remaining production tasks](regulations/production-backlog.md)                                             |

## Where information belongs

| Folder         | Responsibility                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `product/`     | ICP/competition, product scope, information architecture, notifications, organization workflows and pricing |
| `design/`      | Visual/interaction handoffs and organization management design                                              |
| `backlog/`     | Product implementation work and acceptance tracking                                                         |
| `engineering/` | Data/source contracts, architecture and technical implementation plans                                      |
| `operations/`  | Setup, procedures, diagnostics, rollout gates and current acceptance                                        |
| `regulations/` | Regulatory contracts, local validation evidence and gated production delivery                               |
| `research/`    | Market/provider comparisons, options and experiments supporting a decision                                  |

Update the owning document first; backlog rows link to requirements instead of repeating them. Current work selection
belongs to the product or regulatory production backlog, not old check-in notes. Keep dated evidence needed to reproduce
source, rollout and model decisions, but remove superseded instructions and duplicate status summaries. Preserve
untracked material outside the repository before removing it. Create a page only for a distinct contract/procedure and
update this index.

## Full inventory

The catalog below includes every retained document. Most product work needs only the entry points above.

<details>
<summary>Product and features</summary>

- [Product experience implementation backlog](backlog/backlog.md)
- [Legislative research app design specification](design/design.md)
- [Conversations and product integration](design/conversations.md)
- [Information architecture](product/information-architecture.md)
- [Account, privacy and integrations action plan](product/account-integrations-action-plan.md)
- [Notification experience and Novu integration](product/notification-experience.md)
- [Organization features](product/organization-features.md)
- [Organization and workspace design specification](design/organization-workspace-design.md)
- [Pricing and offerings](product/pricing.md)
- [Ideal customer profiles and opportunity strategy](product/icp.md)
- [Competitors by ideal customer profile](product/competitors.md)
- [Legislative intelligence product specification](product/product-spec.md)

</details>

<details>
<summary>Engineering contracts and plans</summary>

- [Native amendment search projection](engineering/amendment-search-projection.md)
- [People, organizations, and meetings](engineering/api/civic-graph-and-events.md)
- [Legislative records and document endpoints](engineering/api/legislative-records.md)
- [HTTP API contract](engineering/api/README.md)
- [Shared HTTP API schemas and protocol behavior](engineering/api/schemas.md)
- [Search, research answers, and document comparison](engineering/api/search-and-diffs.md)
- [Subscription, delivery, and webhook endpoints](engineering/api/subscriptions-and-webhooks.md)
- [Architecture decision log](engineering/architecture-decisions.md)
- [Committee membership history](engineering/committee-membership-history.md)
- [Historical committee reconciliation](engineering/committee-reconciliation.md)
- [Legislative data coverage policy](engineering/coverage-policy.md)
- [Canonical data model](engineering/data-model.md)
- [Legislative data synchronization catalog](engineering/data-sync-catalog.md)
- [Embedding rollout and retrieval-quality gate](engineering/embedding-rollout-plan.md)
- [Identity, entity, and representative roadmap](engineering/identity-and-representative-roadmap.md)
- [Self-hosted Open States scraper implementation milestones](engineering/self-hosted-openstates-milestones.md)
- [Supporting-material processing](engineering/supporting-material-processing.md)
- [Legislative MCP tool contracts](engineering/tool-contracts.md)
- [Trigger.dev synchronization orchestration](engineering/trigger-orchestration-design.md)

</details>

<details>
<summary>Operations and acceptance</summary>

- [Authentication and MCP client setup](operations/authentication.md)
- [Database connection pooling](operations/database-connection-pooling.md)
- [Development, runtime and observability](operations/development.md)
- [Document OCR implementation and operations](operations/document-ocr.md)
- [Document-processing operations](operations/document-processing-operations.md)
- [HTTP API local smoke checklist](operations/http-api-local-smoke.md)
- [Ingestion remediation catalog](operations/ingestion-remediation-catalog.md)
- [Open States rollout requirements and results](operations/openstates-rollout-checklist.md) includes the bounded local
  embedding-freshness audit command and per-state evidence.
- [Open States extraction build](operations/openstates-runtime-build.md)
- [Open States jurisdiction onboarding and recorded milestones](operations/openstates-jurisdiction-onboarding.md)
- [Partial Open States people imports and quarantine](operations/openstates-people-quarantine.md)
- [Passage search and API closeout](operations/passage-search-delivery.md)

</details>

<details>
<summary>Regulatory program and evidence</summary>

- [Regulatory acquisition, backfills and Trigger.dev workflows](regulations/acquisition-workflows.md)
- [Regulatory HTTP API and MCP contract](regulations/api-mcp-contract.md)
- [Competitor regulatory data sourcing](regulations/competitor-sources.md)
- [Regulatory data and version contract](regulations/data-contract.md)
- [Federal collector baseline and reuse decision](regulations/federal-collector-baseline.md)
- [Remaining regulatory ingestion and production backlog](regulations/production-backlog.md)
- [Regulatory source ingestion and orchestration tasks](regulations/ingestion-production-tasks.md)
- [Regulatory passage, indexing and embedding tasks](regulations/search-production-tasks.md)
- [Regulatory HTTP and MCP tasks](regulations/api-mcp-production-tasks.md)
- [Regulatory sync and production operations tasks](regulations/operations-production-tasks.md)
- [Original regulatory phase IDs and retained milestones](regulations/implementation-backlog.md)
- [Regulatory implementation specification](regulations/implementation.md)
- [Regulatory implementation progress and source evidence](regulations/implementation-progress.md)
- [Federal XML parser and pilot validation](regulations/parser-validation.md)
- [Regulatory storage and search-lifecycle validation](regulations/storage-validation.md)
- [Federal Register metadata and rendition validation](regulations/fr-metadata-validation.md)
- [Regulatory data ingestion proposal](regulations/README.md)
- [Regulatory indexing, embeddings and retrieval](regulations/search-indexing.md)
- [Regulatory source catalog](regulations/sources.md)
- [Regulatory sourcing options and tradeoffs](regulations/sourcing-options.md)
- [Future Vaquill state onboarding contract](regulations/state-onboarding.md)
- [Legal data supplier shortlist](regulations/supplier-shortlist.md)

</details>

<details>
<summary>Research and provider references</summary>

- [LegiScan provider evaluation](research/legiscan.md)
- [Initial pricing research](research/pricing.md)
- [Ranked search performance decision](research/ranked-search.md)

</details>

### App-local guides and evaluation assets

- [Application README](../README.md)
- [Azure infrastructure reference](../infra/bicep/README.md)
- [GovInfo review-data instructions](../src/ingestion/govinfo/review-data/README.md)
- [Committee source decisions](../src/ingestion/govinfo/review-data/source-decisions.md)
- [Embedding canary](../evals/embedding-canary.md): [manifest](../evals/embedding-canary.json),
  [lexical](../evals/embedding-canary.lexical.json), [semantic](../evals/embedding-canary.semantic.json)
- [Embedding model bakeoff](../evals/embedding-model-bakeoff.md): [inputs](../evals/embedding-model-bakeoff.json),
  [results](../evals/embedding-model-bakeoff-results.json)
- [Embedding topic canary](../evals/embedding-topic-canary.md): [inputs](../evals/embedding-topic-canary.json),
  [hybrid](../evals/embedding-topic-canary.hybrid.json), [lexical](../evals/embedding-topic-canary.lexical.json),
  [semantic](../evals/embedding-topic-canary.semantic.json)
- [Pinned tokenizer vocabulary provenance](../src/models/tokenizers/README.md)
- [Design source](../legislation.pen) Evaluation data: [canary](../evals/embedding-canary.json),
  [lexical](../evals/embedding-canary.lexical.json),
