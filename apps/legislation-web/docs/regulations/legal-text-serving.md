# Exact regulatory source text

Implemented September 15, 2026 in the local application, including the opt-in API-backed `get_legal_text` MCP tool.
This does not enable production coverage.

`GET /api/legal/versions/{versionId}/text` and `LegislationApiClient.getLegalText(versionId, query)` return the same
strict resource envelope. Select exactly one `editionId` for provision text or `sourceObservationId` for publication
text. Both selectors are available in exact search/reader context; no ingestion generation or model ID is required.
The selected version must belong to that edition or observation. A mismatched pair returns 404 without substituting
another version. eCFR reads explicitly describe an observed snapshot; annual CFR reads describe a published edition.
Publication dates never imply that a notice or proposal is effective law.

The existing WorkOS API authenticator supplies identity. `LEGISLATION_LEGAL_API_ORGANIZATIONS` is a comma-separated
organization allowlist, empty by default. It gates this pilot independently of billing. Disabled authentication does
not bypass the reader's verified-identity requirement. MCP-audience tokens cannot call this API directly.

Every request, including continuation, locks selected membership and current source rights before reading body or blocks.
The initial release permits only official federal eCFR, GovInfo CFR and FR sources with worldwide API and display rights.
State and territory-limited sources fail closed pending trusted entitlement/territory support. Responses are private,
no-store; an old cursor does not authorize revoked text. Text reads do not require indexing or embedding completion.

Use C's [reader/window/continuation contract](../../../../packages/legislation-core/docs/regulations/reader-contract.md).
Changing bound continuation inputs returns 409; malformed cursors return 400, unknown anchors 404. Body and stored
block JSON each have a W database-side read limit of 64 MiB. These limits do not confer authorization.

The client checks selected context, source/version identity, block intervals, response size, availability and continuation
consistency. Unknown fields and repeated query parameters fail validation. Unsupported date selectors are rejected;
this operation does not claim arbitrary historical date resolution.

Remaining gates: discoverable coverage and IDs, corpus-wide legal search, other MCP tools and composed multi-call budgets,
built-router/deployed tests and full consumer journeys. The existing in-process HTTP adapter and signed-token tests
are distinct from deployed WorkOS credentials and production router acceptance.

Local pilot: all 110 January 18, 2000 Federal Register records round-tripped through the authenticated HTTP adapter
and typed client in 116 windows, reconstructing 1,704,173 characters exactly. This includes both distinct `00-113`
publications. Every window used real RS256 verification with a local fixture JWKS. No model calls, vectors, canonical
mutations or search-index mutations occurred. Retained evidence:
`artifacts/regulatory-backfills/fr-jan18-legal-text-http.json`.

M owns [text-tool identity checks, transport budget and retained MCP pilot evidence](../../../legislation-mcp/docs/engineering/legal-tools.md).
Its same-principal credential gate is not new OAuth delegation; deployed consent and credentials remain open.
