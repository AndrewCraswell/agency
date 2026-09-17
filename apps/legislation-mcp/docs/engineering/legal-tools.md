# Regulatory MCP tools

M owns SDK registration, transport budgets and API adaptation. W owns the
[HTTP contract](../../../legislation-web/docs/regulations/api-mcp-contract.md); C owns reader/wire contracts.
M calls W, never regulatory databases, external publishers or models. Tools are read-only; retrieved source text is
untrusted evidence, not instructions or proof that a proposal is current law. No deployed regulatory coverage is claimed.

## MCP mapping

| MCP tool | API operation(s) | Purpose |
| --- | --- | --- |
| `search_regulations` | POST `/api/search/legal` | Bounded, filtered cited retrieval |
| `list_legal_codes` | GET `/api/legal/codes` | Discover actual jurisdiction/code coverage |
| `get_legal_code` | GET `/api/legal/codes/{codeId}` | Authorized code metadata, edition-component count and current eCFR head; no search-readiness claim |
| `list_legal_editions` | GET `/api/legal/codes/{codeId}/editions` | Select supported historical editions |
| `get_legal_edition` | GET `/api/legal/editions/{editionId}` | Inspect one published component, its member count and annual-volume context |
| `list_legal_provisions` | GET `/api/legal/codes/{codeId}/provisions` | Traverse hierarchy in a selected edition |
| `resolve_legal_citation` | POST `/api/legal/provisions/resolve` | Exact citation or explicit ambiguity |
| `get_legal_provision` | GET `/api/legal/provisions/{provisionId}` | Metadata and selected version |
| `get_legal_text` | GET `/api/legal/versions/{versionId}/text` | Bounded source text with exact selected context and continuation |
| `list_legal_agencies` | GET `/api/legal/agencies` | Discover unresolved Federal Register publisher identities used by search filters |
| `get_regulatory_document` | GET `/api/legal/publications/{documentId}` | Published proposal/final/notice metadata |
| `list_regulatory_documents` | GET `/api/legal/publications` | Publication history by kind/date/agency |
| `get_regulatory_action` | GET `/api/legal/actions/{actionId}` + GET `/api/legal/actions/{actionId}/publications` | Bounded evidence-backed grouping |
| `compare_legal_versions` | POST `/api/legal/versions/compare` | Literal source-text differences |
| `get_legal_relationships` | GET `/api/legal/relationships` | Authority/citation/amendment links |
| `get_legal_changes` | GET `/api/legal/events` | Observed changes with historical flags |
| `get_regulatory_coverage` | GET `/api/legal/coverage` | Scope and freshness before relying on absence |

This is the proposed full mapping, not an advertised inventory. The locally implemented organization-gated pilots are
`list_legal_codes`, `get_legal_code`, `list_legal_editions`, `get_legal_edition`, `list_legal_provisions`,
`get_legal_provision`, `search_regulations`, `get_legal_text` and `get_regulatory_coverage`.
The [registered tool contract](tool-contracts.md) and source manifest govern availability; register only after API gates.
SDK read-only/idempotent annotations reflect actual behavior. Other entries remain proposed.

Inputs use C API schemas and exact selection; errors use the safe HTTP adapter mapping. Multiple API calls share a
bounded combined result budget, with no unlimited tool-only limits or separate search algorithm. Search filters,
lexical limit 1–100, frozen pagination and explicit fallback permission match W; use discovered code/edition IDs and
`corpora: ["regulation"]`. Unavailable scope fails explicitly.

## Exact text transport

Advertise `get_legal_text` only for a verified organization on the configured allowlist. Use C's typed `getLegalText`
client and retain the complete envelope, selected context and continuation. Independently verify the outbound API
credential's audience, organization and subject against the incoming verified principal before protected API access.
A shared service credential for another principal fails closed. Never forward the incoming bearer to W or the issuer,
or substitute identity headers/decoded claims. This is a same-principal pilot, not new OAuth delegation.

Select `versionId` plus exactly one `editionId` or `sourceObservationId`, with `anchor` or `cursor` and limit 1–3,
default 3. Three maximum 16,384-character blocks bound escaped JSON and duplicate text/structured representations
under 900,000 bytes and 100,000 text characters. Count the entire result; continue with the returned cursor and same
limit. Do not fetch extra windows or silently drop them. [C reader invariants](../../../../packages/legislation-core/docs/regulations/reader-contract.md)
are shared; [W exact text](../../../legislation-web/docs/regulations/legal-text-serving.md) owns authorization and HTTP behavior.

## Retained MCP pilot evidence

All 110 retained January 18, 2000 FR documents reconstructed exactly through the native MCP client and API/database
path in 302 windows, with exactly 302 API reads. Maximum combined result was 117,357 bytes. The local signed-key
boundary is not deployed WorkOS/standalone acceptance. Evidence remains at its recorded local artifact location:
`artifacts/regulatory-backfills/fr-jan18-legal-text-mcp.json` in the former combined checkout.

Real consent, delegated credential provisioning, revocation, deployed text and composed multi-call acceptance remain
gates in [M authentication](../operations/authentication.md) and [W API tasks](../../../legislation-web/docs/regulations/api-mcp-production-tasks.md).

## Retained search pilot evidence

At `2026-09-16T06:42:47Z`, a streamable HTTP MCP client verified tool discovery, exact search-hit and generation
parity, the second frozen page, and a composed `get_legal_text` call matching the direct HTTP text and selected context.
The adapter used separately signed API and MCP audience credentials for the same principal. Unknown tool arguments
were rejected before HTTP access. Evidence: `artifacts/regulatory-backfills/legal-search-mcp-canary.ts/.json` in the
retained former checkout. The organization gate, same-principal provider and combined 900,000-byte budget applied.
The September 17 contract regression additionally sends Federal Register kind/date/source-agency filters and a
100-result limit through `search_regulations`, verifies the API adapter receives the unchanged request, and confirms the
only upstream path is `POST /api/search/legal`.
The agency-directory regression discovers `fr-agency-406` through the typed `GET /api/legal/agencies` client and
preserves unresolved organization status through `list_legal_agencies`.
Publication regressions browse the same source agency through `list_regulatory_documents`, then retrieve its immutable
document/version/observation identity through `get_regulatory_document`. Both tools call the typed legal HTTP client.
This does not establish standalone/deployed Next-router or live WorkOS acceptance.
