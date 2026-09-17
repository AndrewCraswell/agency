# Regulatory data ingestion proposal

Recorded September 14, 2026. Status: implementation started; supported product coverage is not yet available.
See [implementation progress and backfill evidence](implementation-progress.md).
The [durable preparation dispatcher](preparation-dispatch.md) records bounded submission intent and uncertain-response recovery.
The [copy-validation checkpoint boundaries](copy-validation-checkpoints.md) track mutation counters and remaining resumable acknowledgement work.
The [canonical passage inventory](passage-shape-inventory.md) measures retained edition structure and optionally
checks full-version input eligibility with both pinned tokenizers, without embedding calls.
The [remaining ditto-source review](ditto-source-review.md) distinguishes unresolved reference shapes and retains exact source excerpts.
W owns [exact text](../../../legislation-web/docs/regulations/legal-text-serving.md),
[code discovery](../../../legislation-web/docs/regulations/legal-code-discovery.md),
[edition/provision browsing](../../../legislation-web/docs/regulations/legal-edition-browsing.md),
[cross-edition canary](../../../legislation-web/docs/regulations/edition-search-canary.md) and
[public search/promotion](../../../legislation-web/docs/regulations/legal-search-serving.md).
M owns [regulatory tools](../../../legislation-mcp/docs/engineering/legal-tools.md); C owns
[reader invariants](../../../../packages/legislation-core/docs/regulations/reader-contract.md).
The [Federal Register source identity contract](fr-source-identities.md) accounts for duplicated printed numbers
without merging distinct source publications or accepting conflicting metadata.
The [Federal Register passage pilot](fr-publication-passage-pilot.md) records full-issue reconstruction, both
tokenizer manifests and the isolated lexical copy without embedding calls.
The [annual source observation contract](annual-source-observations.md) distinguishes duplicated package observations
from verified annual editions without inventing newer revision dates.
The [annual Title 5 source review](annual-title5-source-review.md) records the exact quoted-revision correction and
its official printed-page evidence.

## Purpose and decision

The [embedding corpus candidate inventory](embedding-corpus-candidates.md) records canonical export qualification,
pre-freeze duplicate screening, rejected selections and the remaining evaluation gates.

Update September 14, 2026: evaluate **Vaquill for state statutory and administrative codes, with direct federal
acquisition**, as the leading scoped option. Compare it with a broader license and OpenLaws before selecting a contract.
State-only availability, savings, coverage and rights remain unverified. Keep current legislative providers.
See [sourcing options and tradeoffs](sourcing-options.md) and [supplier shortlist](supplier-shortlist.md).

The [federal collector baseline](federal-collector-baseline.md) combines our original plan with the inspected Vaquill
code: reuse its collection patterns, with Rostra update and completeness controls. Paid state coverage plus direct
federal ingestion is the agreed direction, subject to provider validation and terms. Do not build
duplicate collectors for content a validated licensed feed supplies. [Sourcing options](sourcing-options.md) records current ingestion overlap and broader licensing opportunities.

Build a dependable, locally stored regulatory corpus before adding regulatory analysis to Rostra. The first objective
is complete source acquisition, preserved text and versions, and measurable freshness. Bill correlation and AI impact
analysis depend on that foundation and are not prerequisites for importing the data.

This proposal records the product discussion and public source documentation reviewed on the date above. Actual local
downloads and checks are recorded separately in the progress page; they do not establish production ingestion, national
completeness, vendor licensing rights or searchable product coverage.

- [Shared federal collector baseline and reuse decision](federal-collector-baseline.md)
- [Source catalog, overlap, bulk access and rate limits](sources.md)
- [Acquisition, storage, synchronization and release plan](implementation.md)
- [Remaining ingestion and production backlog](production-backlog.md)
- [Original phase IDs and retained milestones](implementation-backlog.md)
- [C canonical data, versions and rights](../../../../packages/legislation-core/docs/regulations/data-contract.md)
- [Implemented edition storage and validation](storage-validation.md)
- [Federal Register metadata and issue reconciliation](fr-metadata-validation.md)
- [Backfills, collectors and Trigger.dev workflows](acquisition-workflows.md)
- [Regulatory source discovery checkpoints](regulatory-discovery.md)
- [Search indexing and embeddings](search-indexing.md)
- [Frozen final-passage evaluation protocol](embedding-evaluation-protocol.md)
- [W regulatory API endpoints](../../../legislation-web/docs/regulations/api-mcp-contract.md)
- [M tool tasks](../../../legislation-mcp/docs/engineering/legal-tool-tasks.md)
- [Future Vaquill state onboarding](state-onboarding.md)
- [Competitor source disclosures and their limits](competitor-sources.md)
- [Sourcing options and tradeoffs](sourcing-options.md)
- [Legal data supplier shortlist](supplier-shortlist.md)

## Core clarification: content type versus time

GovInfo is not only a historical archive. It also publishes new and corrected material and supports discovery by
modification time. Regulations.gov and RegInfo are not required simply to keep published federal rules current.

| Need | Initial acquisition decision | Additional source when useful |
| --- | --- | --- |
| Published proposed rules, final rules and notices | GovInfo text + FederalRegister.gov metadata joined by document number | Extend reused RULE/PRORULE collector for scoped notices |
| Consolidated federal regulatory code | eCFR title inventory and dated full-title XML | GovInfo bulk alternative; annual CFR for historical editions |
| Rulemaking supporting materials and public comments | Outside the initial minimum corpus | Regulations.gov, with agency-document acquisition prioritized over all comments |
| Planned rules and review information | Outside the initial minimum corpus | RegInfo Unified Agenda XML; review-status collection is a separate feasibility task |

The initial design uses three pipelines: U.S. Code, eCFR and Federal Register. FederalRegister.gov supplies structured
metadata while GovInfo supplies bulk publication text; eCFR supplies versioned full-title acquisition. Docket research
and regulatory planning remain later additions.
The existence of overlapping content does not mean all endpoints have identical metadata, historical depth, publication
timing, legal status or identifiers.

## Ingest once, serve from Rostra

APIs and bulk downloads are collection methods. Both populate Rostra's own storage. A normal customer query searches
the stored and indexed corpus rather than calling government APIs for every result or answer.

```text
Government inventories, bulk files and APIs
    -> durable original artifacts and acquisition manifest
    -> normalized documents, provisions, versions and events
    -> local search and cited analysis
    -> monitoring, reviewed briefs and exports
```

Separate the initial import from recurring updates. Preserve source versions so an answer can point to the exact text
used even after the government source changes. Customer query volume should not multiply government API traffic.

## What competitive coverage means

Two collections are essential:

1. Existing regulations: consolidated administrative code, hierarchy, authority citations, source currency and available
   historical editions or versions.
2. Regulatory developments: proposed, revised, adopted, emergency, withdrawn and corrected materials, relevant source
   dates, and the actual text needed to understand the change.

A list of notices without their proposed or adopted text is partial coverage. A current-code snapshot without
rulemaking updates is also partial coverage. A final rule may provide amendment instructions rather than a complete
replacement chapter; retain that document alongside the consolidated code rather than pretending the two are copies.

Do not market the initial scope as all federal regulatory information. Dockets, comments, agency guidance, enforcement
actions, court decisions, incorporated external standards and regulatory planning are distinct content classes. Annual
code editions are not a complete daily history. A published effective date is not a guarantee that a rule remains legally
operative after subsequent events outside our coverage.

## Federal and state delivery boundaries

Start by validating licensed state delivery against the source and completeness requirements, alongside the direct
federal design. Compare broader licensed delivery if its incremental cost is worthwhile. Inventory uncovered official
sources for targeted supplementation; provider coverage and Rostra's storage/redistribution rights remain unverified.

The nationwide state target should explicitly account for all 50 states and DC. Record Puerto Rico and other territories
as separately evaluated scope; existing legislative support does not automatically establish regulatory support.
Each jurisdiction needs both its code and its rulemaking publications assessed. Do not count a state as complete because
one searchable code website was imported.

## Relationship to existing Rostra plans

- [Organization features](../../../legislation-web/docs/product/organization-features.md) describes shared research, review, reports and delivery. Those
  surfaces can later consume regulatory content; their delivery does not establish regulatory coverage.
- [Product backlog](../../../legislation-web/docs/backlog/backlog.md) keeps regulations outside the initial personal release gate. This proposal does not add regulations to the
  current personal-experience completion gate.
- [Legislative synchronization catalog](../engineering/data-sync-catalog.md) and [coverage policy](../engineering/coverage-policy.md) remain the
  legislative contracts. Reconcile them when the relevant regulatory capability passes acceptance; do not silently reclassify a source
  as ingested based on this proposal.
- [Canonical data model](../../../../packages/legislation-core/docs/engineering/data-model.md), [document processing](../engineering/supporting-material-processing.md),
  [OCR operations](../operations/document-ocr.md), [change events](../../../../packages/legislation-core/docs/engineering/data-model.md#change-events), and
  [Trigger.dev orchestration](../engineering/trigger-orchestration-design.md) are integration points to inspect before coding.

Regulatory acquisition is independent of customer pricing. Preserve the agreed flat, feature-based pricing approach;
measure collection, processing, storage and customer-serving costs internally. No usage quotas, vendor purchase,
production schedules or release commitments are authorized by this document.
