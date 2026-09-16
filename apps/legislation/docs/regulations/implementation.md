# Regulatory implementation specification

Recorded September 14, 2026. Implementation has started with local frozen-inventory and raw-backfill tooling.
See [implementation progress](implementation-progress.md) for actual completed scope and evidence. The remaining tables,
routes, Trigger tasks and release gates below remain proposed until their implementation checks pass.

## Outcome and scope

Build a locally stored, versioned federal regulatory corpus with resumable backfills, recurring updates, searchable text,
embeddings, authenticated HTTP endpoints and API-backed MCP. Use Vaquill's audited open federal collectors as starting
code, while keeping Rostra's durable workflows and completeness controls. Prepare the same contracts for a later licensed
Vaquill state statutory/admin-code feed. No nationwide state rulemaking claim follows from a state-code license.

Initial federal pipelines are current eCFR, Federal Register rules/proposals/notices, and U.S. Code for statutory context.
U.S. Code does not block independently useful regulatory text; unresolved authority references remain explicit. Backfill
annual CFR editions and older FR in separate waves. Docket attachments/comments, RegInfo planning/review, additional
agency guidance/enforcement and complete bill-to-rule impact analysis are later expansions. Existing bill collection stays.

## Specification map

| Page | Implementation contract |
| --- | --- |
| [Data and versions](data-contract.md) | Canonical identities, schema, editions, source provenance, temporal semantics, rights and atomic publication |
| [Acquisition and Trigger workflows](acquisition-workflows.md) | Adapters, parser reuse, source windows, backfill units, fan-out, retries, budgets and operator commands |
| [Search and embeddings](search-indexing.md) | Chunking, lexical projection, model/input routing, query filters, pagination, quality and performance gates |
| [HTTP API and MCP](api-mcp-contract.md) | Exact proposed route/tool inventory, schemas, version selection, auth, errors, paging and cross-product integration |
| [Remaining production backlog](production-backlog.md) | Current execution order, concrete remaining ingestion/search/API/MCP/operations tasks and release gates |
| [Original implementation phases](implementation-backlog.md) | Historical task IDs and prior implementation scope; retained as prior art |
| [Vaquill state onboarding](state-onboarding.md) | Future feed/rights contract, adapter mapping, delta recovery, per-state rollout and parity tests |

The [federal baseline](federal-collector-baseline.md) explains what we adopt and change from Vaquill; the
[source catalog](sources.md) records publisher scope and limits; [sourcing options](sourcing-options.md) records the
commercial alternatives. This implementation specification governs concrete task/data/API decisions where the older
research pages only describe options. Public source details must be revalidated against actual responses at implementation.

## Current workspace foundations to extend

This inventory is based on current source and documentation, not a production audit. Some previously recorded runtime
acceptance is incomplete; inspect readiness before relying on a deployed capability.

| Foundation | Existing integration points | Extension |
| --- | --- | --- |
| Canonical storage | `src/db/schema/schema.ts`, `src/db/database.ts`, `src/db/queries/` | Independent legal/regulatory records and query services |
| Artifacts | Configured federal/state source and normalized-document Azure containers | Regulatory key prefixes, immutable bytes and manifests |
| Ingestion | `src/ingestion/http-client.ts`, GovInfo clients, synchronization and document services | Regulatory adapters, provider budgets and parser bridge |
| Orchestration | `src/trigger/tasks/`, manifest/identities/activation policy, `trigger.config.ts` | Bounded regulatory tasks and inactive schedules |
| Python packaging | Existing `@trigger.dev/python` extension for Open States adapter files | Explicit federal parser packaging and deployed startup checks |
| Embeddings | `src/models/embedding-routing.ts`, OpenRouter client, `src/ingestion/embeddings/jobs.ts` | New legal-passage route, tables, hashes and canary |
| Text search | `src/search/passage-search-*`, `infra/passage-search/schema.sql` | Regulatory outbox and isolated projection generation |
| HTTP | Next.js explicit `app/api/.../route.ts`, application services, `src/api-client/client.ts` | Proposed regulatory operations with existing auth/envelopes |
| MCP | `src/mcp/http-query-adapter.ts` and tool contracts | API-backed regulatory tools with exact API parity |
| Events | Existing change-event, subscription and webhook infrastructure | New regulatory target/event kinds with historical suppression |

The installed Trigger SDK/Python integration is 4.5.10; the current task runtime configuration is node-22, distinct from
repository tooling's Node >=24 requirement. Validate parser and SDK behavior in the deployed task environment. Do not
assume local interpreter success proves deployment startup. Add no alternative scheduler, vector service or raw ingestion
path behind MCP. Query handlers serve locally stored records and never start backfills.

## Implementation defaults

- Current foundation: all active eCFR titles at a frozen discovery cutoff, 90 recent FR days, latest verified U.S. Code scope.
- Historical waves: FR 2020 onward and CFR 2020 onward first; then FR 2000–2019 and CFR 1996–2019. Earlier FR is separately qualified.
- Acquisition: GovInfo publication text + FederalRegister.gov metadata; eCFR title inventory + dated full-title XML.
- Native parsing first; preserve tables, appendices, exact citations and source artifacts. OCR only when a required source lacks usable structured text.
- Scope/version publication is atomic after full validation. Source availability, canonical completeness, lexical readiness and semantic readiness are different gates.
- Trigger dispatch is bounded and durable; database units/outboxes survive retries, cancellation and task retention limits.
- Lexical ships independently from semantic. Regulatory model choice requires a regulatory canary; existing bill-model results are not transferred untested.
- Smoke-test and compare OpenAI Small and Voyage 4 on held-out regulatory retrieval, latency and cost before bulk embedding; confirm the selected route through deployed API and MCP.
- Every API/MCP result retains exact source/version and honest date/coverage metadata. Historical queries never silently substitute nearby annual editions.
- State integration reuses the same schema/pipeline/query paths, with provider-specific identity, rights and temporal capabilities.

## Delivery and validation

Implement source evidence, schema, adapters, orchestration and frozen current/historical backfills first. The user's
September 14 execution instruction takes precedence over the earlier recurrence-first ordering: keep recurring source
collection disabled until the selected backfill gate G4 passes; SYNC-11 owns activation.
Search development proceeds from validated backfills; API contracts can be developed against synthetic data earlier.
Then complete API, MCP and deployed federal release gates. State synthetic contract tests start with the schema; real
licensed onboarding follows federal delivery and vendor validation. See the task backlog for the exact dependency graph.

All numeric queue, latency, relevance and cadence values are initial implementation or launch targets, not observed
performance promises. Retain measured evidence and revise a target only through an explicit documented scope/design
decision; do not relabel a failed gate as passed. Backfill cannot starve current bill/regulation updates or hide incomplete
history behind an aggregate section count.

Minimum release evidence spans source inventory -> retained bytes -> parsed/versioned records -> lexical/embedding
readiness -> authenticated API -> API-backed MCP, under retries and live ingestion. A successful task, valid index or
healthy HTTP endpoint alone does not establish coverage. Regulated text/source correctness and rights have zero tolerance
for fabricated matches or forbidden text; unavailable history and partial states remain explicit.

The [production backlog](production-backlog.md) names current tasks, smoke artifacts and acceptance cases. Tests should verify
implemented runtime behavior, not this prose. Run required repository verification after coherent changes. Any regulatory
UI requires integrated-browser acceptance; no mockup or component test substitutes for that workflow check.

## Operations and future expansion

Use read-only planning/readiness by default, explicit environment/manifests for backfill application, and the existing
schedule reconciler's activation semantics. Production exposure and source scheduling follow actual release gates.
Rollback pauses intake, retains immutable history/pending work and restores the previous searchable generation. It does
not delete source data or migrate bill indexes as a shortcut.

Observe source currency, detection/processing lag, stage counts, failed/delayed work, lease age, model/input coverage,
source/DB/Trigger saturation and cost per completed unit. Track upstream publication separately from Rostra polling.
Vendor delivery frequency likewise differs from collection freshness. Preserve the flat, feature-based customer-pricing
approach; internal consumption metrics do not create customer usage quotas.

Regulations.gov and RegInfo later add explicit source adapters and capabilities for dockets and planning, using the same
work records and version/provenance semantics. Bill relationships begin with published authority/citation evidence;
semantic similarity is a candidate for review, not proof that a pending bill causes or governs a rule. Broad impact
analysis, compliance advice and legal-validity determinations are outside this ingestion/retrieval release.
