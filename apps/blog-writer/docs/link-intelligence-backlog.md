# Link intelligence overhaul backlog

## Purpose

This backlog turns [the target architecture](./link-intelligence-architecture.md) into ordered, reviewable delivery
slices. IDs are stable local planning references until the owning work is promoted into the team's issue tracker.

Do not build recommendation UI before the tenant boundary, synchronization health, and deterministic retrieval contract
exist. Each task includes documentation, tests, and operational signals needed to own its behavior.

## Progress

- [x] LI-001 is implemented in local configuration: indexing uses `read_products,read_content`, the template product
  mutation and `write_products` scope are removed, and unsupported content CRUD topics are excluded. Deployment and shop
  reauthorization remain an environment operation.
- [x] LI-002 is complete: Shopify sessions use namespaced PostgreSQL storage on the existing external database, survive
  adapter recreation, and uninstall removes every session for the authenticated shop. Live integration testing confirms
  that deleting one shop's sessions preserves another shop's sessions.
- [x] LI-003 and LI-004 are complete: `app/persistence/schema.server.ts` carries tenant-keyed resource, chunk, idea,
  article, revision, recommendation, and job tables, and the repositories derive the tenant from authenticated context.
- [x] LI-020 through LI-022 and LI-025 are complete. Retrieval filters eligibility in SQL, fuses full-text and pgvector
  rankings by reciprocal rank, and reorders the pool with `cohere/rerank-4-fast`, falling back to the fused order.
- [x] LI-030 through LI-034 are complete: recommendation contracts, both objectives, the merchant review workflow, and
  revision-guarded application all ship in `/app/articles/:articleId`.
- [ ] LI-005 (operational redaction policy) is the next unstarted foundation task.
- [ ] LI-013 is partly delivered. A 72-hour n8n sweep runs a full traversal of every store that has gone that long
  without one, which is what detects deletion, and Settings compares live Shopify counts and update times against the
  stored catalogue so a merchant sees drift sooner. The `updated_at` incremental traversal with an overlap window and a
  persisted cursor is still open, so every reconciliation currently costs a full pass.
- [ ] LI-023 and LI-024 remain open. The reranker shipped without the versioned evaluation set, so its quality is
  asserted rather than measured.

Note that LI-010 through LI-016 were partly overtaken by events. Synchronization and indexing ship, but the durable
onboarding state machine they assume does not exist; that work is tracked as gate B in
[the MVP backlog](./mvp-backlog.md) and should not be planned twice.

## Delivery gates

| Gate | Required outcome |
| --- | --- |
| A: tenant foundation | Cross-tenant access attempts fail at every persistence and job boundary |
| B: trustworthy index | Onboarding completes, updates converge, deletions deactivate, and sync health is visible |
| C: useful retrieval | Eligible candidates are reproducible and traceable without a hosted reranker |
| D: reviewable recommendations | Crosslink and further-reading suggestions are distinct and merchant-controlled |
| E: safe application | Approved placements apply to the reviewed revision without prose regeneration |
| F: maintainable graph | Target changes identify affected sources and produce proposed refreshes |

## Foundation and tenancy

| ID | Task | Acceptance |
| --- | --- | --- |
| LI-001 | Reconcile Shopify scopes | Read scopes match the validated product, content, online store page, and locale queries; only required write scopes remain; content CRUD topics are not invented |
| LI-002 | Replace prototype session persistence | Installations and sessions survive process restart and uninstall removes or disables tenant access |
| LI-003 | Add tenant-owned job and resource schema | All tables use non-null tenant keys, tenant-scoped unique constraints, foreign keys, and deletion behavior |
| LI-004 | Build tenant-bound repositories | Tenant comes from authenticated context; repository methods cannot query resources without it; negative isolation tests pass |
| LI-005 | Define operational redaction policy | Logs and traces exclude tokens, mixed-tenant payloads, unbounded bodies, and customer data |

## Ingestion and indexing

| ID | Task | Acceptance |
| --- | --- | --- |
| LI-010 | Implement onboarding state machine | Initial catalog, content, and indexing phases are durable, resumable, observable, and gate recommendations until ready |
| LI-011 | Synchronize products and collections | Full GraphQL traversal upserts normalized resources and deactivates missing resources idempotently |
| LI-012 | Ingest catalog webhook events | Verified product and collection subscriptions use authenticated routes; events are deduplicated, persisted, acknowledged quickly, and processed asynchronously |
| LI-013 | Reconcile blogs, articles, and pages | `updated_at` traversal uses overlap and stable tie-breaking; periodic identity scans detect deletion without content CRUD webhooks |
| LI-014 | Add sitemap verification | Sitemap routes supplement discovery and identify canonical mismatches without overriding Shopify state |
| LI-015 | Build deterministic text representations | Cleaning, chunking, hashing, and representation versioning produce repeatable changed-only indexing |
| LI-016 | Expose synchronization health | Merchant and operator surfaces show progress, cursors, failures, lag, counts, and retry actions |

## Retrieval and ranking

| ID | Task | Acceptance |
| --- | --- | --- |
| LI-020 | Implement full-text retrieval | SQL applies tenant, active, publication, availability, locale, and source-exclusion filters before ranking |
| LI-021 | Implement vector retrieval | Done. Tenant-filtered pgvector search over versioned chunk embeddings, filtered to eligible resources before ranking |
| LI-022 | Merge hybrid candidates | Done. Reciprocal rank fusion deduplicates by resource, keeps the component scores, caps the pool at 40, and is the rerank fallback order |
| LI-023 | Create reranker evaluation set | Versioned cases cover both objectives, no-link outcomes, negatives, locales, catalog sizes, and adversarial descriptions |
| LI-024 | Benchmark rerankers | Baseline and Cohere v4.0 candidates are compared using the decision record's quality, latency, cost, reliability, and privacy gates |
| LI-025 | Add optional reranker adapter | Done. `cohere/rerank-4-fast` reorders one tenant's filtered pool, and a failure falls back to the fused order and is recorded in `ranker` |

## Recommendations and review

| ID | Task | Acceptance |
| --- | --- | --- |
| LI-030 | Define recommendation contracts | Objective, source revision, destination ID, placement, anchor, evidence, ranker version, and status are validated and persisted |
| LI-031 | Generate commercial crosslinks | Product, collection, and utility-content recommendations optimize section relevance and permit a no-link result |
| LI-032 | Generate further reading | Published content recommendations optimize learning progression, novelty, and destination diversity |
| LI-033 | Build merchant review workflow | Merchants can inspect evidence, accept, reject, edit anchor/placement, and identify stale recommendations accessibly |
| LI-034 | Add deterministic insertion | Syntax-tree application changes only the approved span, verifies destination state, and rejects ambiguous or stale revisions |
| LI-035 | Replace n8n article regeneration | Existing crosslink stage returns recommendation placements only; full article content is never regenerated for link insertion |

## Dependency graph and maintenance

| ID | Task | Acceptance |
| --- | --- | --- |
| LI-040 | Persist source-target mappings | Accepted links and related-content references create tenant-scoped, bidirectionally queryable edges |
| LI-041 | Detect target impact | Unpublish, delete, availability, and canonical-route changes identify every affected source idempotently |
| LI-042 | Generate refresh proposals | Scanner creates evidence-backed diffs and never silently changes published content |
| LI-043 | Publish related-content metafields | Approved product and article references use verified app-owned Shopify metafield definitions |
| LI-044 | Build theme extension blocks | Related products and further reading render accessibly, inherit theme styling, and hide when empty |

## Operations and rollout

| ID | Task | Acceptance |
| --- | --- | --- |
| LI-050 | Add queues and dead-letter handling | Jobs have bounded retry, idempotency keys, cancellation, actionable terminal failures, and replay tooling |
| LI-051 | Add index and recommendation telemetry | Metrics cover lag, event age, counts, fallback, cost, latency, conflicts, and broken targets per tenant |
| LI-052 | Run tenant-isolation threat tests | Repository, retrieval, cache, queue, rerank, recommendation, mapping, and telemetry boundaries resist cross-tenant access |
| LI-053 | Plan staged rollout | Feature flags separate indexing, retrieval, recommendations, and application; rollback leaves source content intact |

## First implementation sequence

1. Complete LI-001 without declaring unsupported content webhooks.
2. Complete LI-002 through LI-005 as Gate A.
3. Complete LI-010 through LI-016 as Gate B.
4. Complete LI-020 through LI-023 and establish the local baseline before vendor integration.
5. Run LI-024; LI-025 is conditional on the benchmark and vendor review.
6. Implement crosslinks and further reading through the same contracts, then add review and deterministic application.
7. Replace the n8n regeneration stage only after the replacement path passes end-to-end acceptance.
