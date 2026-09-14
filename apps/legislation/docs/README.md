# Tabra documentation

Start with the question you need to answer. Planned product features and dated release evidence are not claims of live availability.

| Question | Read |
| --- | --- |
| What are we building? | [Product specification](product/product-spec.md) |
| What should we build next? | [Single product backlog](product/backlog.md): 106 tasks across six sections |
| How should it work and look? | [Design brief and handoff](product/design.md), [route inventory](product/information-architecture.md), [mockups](../legislationpen.pen) |
| What do customers pay for? | [Pricing and offerings](product/pricing.md), [organization features](product/organization-features.md) |
| What has passed release acceptance? | [API and passage acceptance](operations/passage-search-delivery.md) |
| How do I develop or operate it? | [Development and runtime](operations/development.md), [API contract](engineering/api/README.md) |
| How will we add regulations? | [Regulatory plan](regulations/README.md) |
| How do we implement regulatory ingestion and retrieval? | [Implementation specification](regulations/implementation.md), [phases and tasks](regulations/implementation-backlog.md) |

## Where information belongs

| Folder | Responsibility |
| --- | --- |
| `product/` | Scope, design, backlog, notifications, organization workflows and pricing |
| `engineering/` | Data/source contracts, architecture and technical implementation plans |
| `operations/` | Setup, procedures, diagnostics, rollout gates and current acceptance |
| `regulations/` | Future regulatory acquisition and implementation; not delivered coverage |
| `research/` | Market/provider comparisons, options and experiments supporting a decision |

Update the existing owning document first. A backlog row should link to a requirement, not repeat its specification.
Keep completed rollout narratives out of active guides; retain only evidence needed to explain a decision or reproduce
a result. Keep source evidence beside reviewed data and benchmarks beside evaluation fixtures. Git history holds superseded committed prose; keep a recovery copy for untracked material before removal. There is no general documentation archive. Do not create a new review/summary page for each conversation. Create a new page only for a distinct contract
or operating procedure that cannot be read comfortably within its owner. Update this inventory when adding or removing one.

## Full inventory

The catalog below includes every retained document. Most product work needs only the entry points above.

<details>
<summary>Product and features</summary>

- [Product experience implementation backlog](product/backlog.md)
- [Legislative research app design specification](product/design.md)
- [Information architecture](product/information-architecture.md)
- [Notification experience and Novu integration](product/notification-experience.md)
- [Organization features](product/organization-features.md)
- [Pricing and offerings](product/pricing.md)
- [Legislative intelligence MVP product specification](product/product-spec.md)

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
- [Open States rollout requirements and results](operations/openstates-rollout-checklist.md)
- [Open States extraction build](operations/openstates-runtime-build.md)
- [Passage search and API closeout](operations/passage-search-delivery.md)

</details>

<details>
<summary>Future regulations</summary>

- [Regulatory acquisition, backfills and Trigger.dev workflows](regulations/acquisition-workflows.md)
- [Regulatory HTTP API and MCP contract](regulations/api-mcp-contract.md)
- [Competitor regulatory data sourcing](regulations/competitor-sources.md)
- [Regulatory data and version contract](regulations/data-contract.md)
- [Federal collector baseline and reuse decision](regulations/federal-collector-baseline.md)
- [Regulatory implementation phases, tasks and validation gates](regulations/implementation-backlog.md)
- [Regulatory implementation specification](regulations/implementation.md)
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
- [Embedding canary](../evals/embedding-canary.md)
- [Embedding model bakeoff](../evals/embedding-model-bakeoff.md)
- [Embedding topic canary](../evals/embedding-topic-canary.md)
- [Design source](../legislationpen.pen)

Evaluation data: [canary](../evals/embedding-canary.json), [lexical](../evals/embedding-canary.lexical.json),
[semantic](../evals/embedding-canary.semantic.json), [model inputs](../evals/embedding-model-bakeoff.json),
[model results](../evals/embedding-model-bakeoff-results.json), [topic inputs](../evals/embedding-topic-canary.json),
[topic hybrid](../evals/embedding-topic-canary.hybrid.json), [topic lexical](../evals/embedding-topic-canary.lexical.json),
[topic semantic](../evals/embedding-topic-canary.semantic.json).

Inventory: **53** Markdown pages here and **7** elsewhere in the app, **60 total**, plus one design source and nine evaluation JSON files.
