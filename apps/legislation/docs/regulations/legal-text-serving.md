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

Use `limit` (default 20, maximum 100 source blocks), optionally `anchor` on the first request, then `cursor` from
`data.nextCursor`. Each block is at most 16,384 UTF-16 characters; a window is at most 100,000. Concatenating a complete
sequence reconstructs the exact canonical body. Tables retain tabs/newlines, and source strings remain plain text.
Continuation binds organization, user, version, selected edition/observation, rights hash, reader generation and limit.
Changing those inputs returns 409; malformed cursors return 400, unknown anchors return 404. Cursors are scope-bound
positions, not authorization grants. Body and stored block JSON each have a 64 MiB database-side read limit.

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

MCP discovery advertises `get_legal_text` only for a verified organization on the configured allowlist. The adapter
uses `getLegalText` on the typed HTTP client and preserves its full response envelope, selected source and continuation.
It has no database, model client or source fetch. The API credential is separately verified for the API audience;
its organization **and subject** must match the incoming verified MCP principal. A shared service credential for another
principal fails before the protected API request. The incoming MCP bearer is never forwarded to the API or token issuer.
This is a restrictive same-principal pilot, not a new OAuth delegation implementation. Production delegated credentials
and real WorkOS acceptance remain gates; do not bypass them by forwarding identity headers or comparing decoded JWTs.

The tool accepts the API's exact selectors and continuation, with a stricter block limit of 1–3 (default 3). Three
16,384-character blocks bound worst-case JSON escaping and duplicated MCP text/structured output under the existing
900,000-byte budget, while remaining below the 100,000-character text ceiling. Continue using the returned cursor with
the same limit; no extra windows are fetched or silently dropped. The shared MCP size check now counts the entire result,
including both output representations. Source text is explicitly untrusted evidence; the tool is read-only and idempotent.

MCP pilot evidence: all 110 retained FR documents reconstruct exactly through the native MCP client and API/database
path in 302 windows, with exactly 302 API reads. Maximum combined tool result: 117,357 bytes. The local signed-key
boundary and deployed-acceptance distinction remain the same as the HTTP smoke above. Evidence:
`artifacts/regulatory-backfills/fr-jan18-legal-text-mcp.json`.
