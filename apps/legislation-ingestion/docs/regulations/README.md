# Regulatory ingestion

I owns federal regulatory acquisition, normalization, publication, passage preparation, search-copy maintenance, and
recurring synchronization. These pages describe durable contracts and runbooks. Linear owns active implementation work;
deployment status must be established from the target environment rather than a repository progress ledger.

## Start here

| Need | Canonical page |
| --- | --- |
| Program scope and architecture | [Implementation contract](implementation.md) |
| Canonical identities, versions, rights, and dates | [C data contract](../../../../packages/legislation-core/docs/regulations/data-contract.md) |
| Lossless text and continuation | [C reader contract](../../../../packages/legislation-core/docs/regulations/reader-contract.md) |
| Source acquisition and orchestration | [Acquisition workflows](acquisition-workflows.md) |
| Passage generation, search copy, and embeddings | [Search indexing](search-indexing.md) |
| HTTP routes and selectors | [W API contract](../../../legislation-web/docs/regulations/api-mcp-contract.md) |
| Search behavior and promotion | [W search serving](../../../legislation-web/docs/regulations/legal-search-serving.md) |
| MCP mapping and transport | [M legal tools](../../../legislation-mcp/docs/engineering/legal-tools.md) |
| Future licensed state feeds | [State onboarding](state-onboarding.md) |

## Sources and acquisition

- [Federal collector baseline](federal-collector-baseline.md)
- [Source catalog](sources.md)
- [Federal Register source identities](fr-source-identities.md)
- [Federal Register metadata validation](fr-metadata-validation.md)
- [Federal Register passage pilot](fr-publication-passage-pilot.md)
- [Annual source observations](annual-source-observations.md)
- [Annual Title 5 source review](annual-title5-source-review.md)
- [Regulatory discovery](regulatory-discovery.md)
- [Parser validation](parser-validation.md)

Government APIs and bulk files are acquisition inputs. Customer reads use Rostra's persisted, versioned corpus. Preserve
the exact source identity, retrieval time, rendition, content hash, rights, and publication context. Source availability
alone does not establish complete or searchable coverage.

## Storage and retrieval

- [Storage validation](storage-validation.md)
- [Passage shape inventory](passage-shape-inventory.md)
- [Preparation dispatch](preparation-dispatch.md)
- [Copy-validation checkpoints](copy-validation-checkpoints.md)
- [Embedding corpus candidates](embedding-corpus-candidates.md)
- [Embedding evaluation protocol](embedding-evaluation-protocol.md)

Canonical completeness, lexical readiness, semantic readiness, and public serving are separate gates. Lexical search may
ship independently from semantic search. Never rebuild existing embeddings or activate recurring collection merely
because a new schema, parser, or route exists.

## Sourcing research

- [Competitor source disclosures](competitor-sources.md)
- [Sourcing options](sourcing-options.md)
- [Supplier shortlist](supplier-shortlist.md)
- [Ditto source review](ditto-source-review.md)

Research pages record source and licensing constraints, not procurement approval or current provider availability.
