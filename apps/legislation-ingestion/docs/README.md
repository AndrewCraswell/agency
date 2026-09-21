# Ingestion documentation

I owns source acquisition, normalization/import persistence, document/OCR processing, embeddings, index replication,
source evidence and Trigger orchestration. Dated results are not current deployment acceptance. Applications import C,
not sibling apps. W lives at `apps/legislation-web`; ignored local state remains at the former combined location.

## Start here

| Need | Canonical page |
| --- | --- |
| Commands, import profiling and isolated worker settings | [README](../README.md), [development](operations/development.md), [testing](operations/testing.md) |
| Source scope and inventory | [Coverage policy](engineering/coverage-policy.md), [sync catalog](engineering/data-sync-catalog.md) |
| State activation and retained evidence | [Rollout checklist](operations/openstates-rollout-checklist.md), [onboarding](operations/openstates-jurisdiction-onboarding.md) |
| Washington onboarding and acceptance | [Washington requirements and source audit](operations/washington-onboarding.md) |
| Worker dispatch and budgets | [Trigger design](engineering/trigger-orchestration-design.md), [worker capacity](operations/worker-capacity.md) |
| Approved-source network relay | [Document fetch relay](operations/document-relay.md) |
| State archive content draining | [Content continuation](operations/openstates-content-continuation.md) |
| Retrieval/index work | [Embedding rollout and rebuild hold](engineering/embedding-rollout-plan.md), [search maintenance](operations/search-maintenance.md) |
| Staging database refresh | [Refresh engine, maintenance and validation](operations/database-refresh.md) |
| Regulatory source program | [Regulations index](regulations/README.md), [implementation contract](regulations/implementation.md) |

Run from the repository root: `pnpm --filter legislation-ingestion cli --help`,
`pnpm --filter legislation-ingestion tool --list`, `pnpm --filter legislation-ingestion trigger:dev`.
Package-local `pnpm tool <area>/<name>` examples in these pages run from I. The launcher discovers exact paths from
the tools directory; old colon aliases in dated logs are historical, not additional commands. Existing ignored artifact
paths may still refer to the former combined checkout. Resolve them explicitly without overwriting evidence.

## Source and operations catalog

- [Committee history reconstruction](engineering/committee-membership-history.md) and [reconciliation](engineering/committee-reconciliation.md)
- [Civic identity source authority and evidence](engineering/identity-sources.md)
- [Hearing publication backfill](engineering/data-sync-catalog.md#hearing-publication-backfill)
- [Open States rollout](operations/openstates-rollout-checklist.md), [runtime build](operations/openstates-runtime-build.md), [people quarantine](operations/openstates-people-quarantine.md)
- [Supporting-material processing](engineering/supporting-material-processing.md), [document operations](operations/document-processing-operations.md), [OCR](operations/document-ocr.md)
- [Remediation evidence](operations/ingestion-remediation-catalog.md), [LegiScan research](research/legiscan.md)
- [GovInfo source decisions](../src/ingestion/govinfo/review-data/source-decisions.md) and [review-data guidance](../src/ingestion/govinfo/review-data/README.md)

## Other owners

- [W product/API index](../../legislation-web/docs/README.md), [search and diff behavior](../../legislation-web/docs/engineering/api/search-and-diffs.md)
- [M transport/tool index](../../legislation-mcp/docs/README.md)
- [C contracts and database setup](../../../packages/legislation-core/docs/README.md)
- [Root legislation verification](../../legislation-web/docs/operations/testing.md#full-verification)

Schema/migrations live once in C and release explicitly through W, never worker startup. Keep source/historical tables
here; shared and serving specs have one canonical owner linked from their former sections.
