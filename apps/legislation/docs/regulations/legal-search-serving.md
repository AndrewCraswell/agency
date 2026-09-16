# Regulatory lexical search serving

`POST /api/search/legal`, `LegislationApiClient.searchLegal` and the opt-in `search_regulations` MCP tool are implemented locally through the existing WorkOS
API authentication boundary. The request/response contract is in `src/api-client/legal-search-contract.ts`; the client
checks both wire shape and agreement with requested filters, mode, limits and fallback permission.

## Available scope

The current implementation requires `corpora: ["regulation"]`. It supports explicit published federal edition IDs,
or current eCFR heads selected by code IDs. With neither selector it requests every published current eCFR head;
every selected edition must have a verified search copy. It never narrows that request to just indexed titles.
Selection is capped at 100 editions. All selected code IDs and edition IDs must be represented; incompatible
intersection or missing published identities return 404. Jurisdiction can be omitted or `jurisdiction:us`.

Lexical limit is 1–100, default 20. Pagination persists the frozen ranked window described in
[cross-edition retrieval](edition-search-canary.md). Repost the same JSON filters with `meta.nextCursor` as `cursor`.
The next link is the same POST endpoint, not a GET query. Cursors also bind normalized public filters and requested
mode/fallback permission. Default-current head changes invalidate the underlying selection; they do not silently
resume a different generation. No national readiness is implied by the two-title pilot.

Publication/statute corpora, state jurisdictions and agency filters return 503 with a safe capability reason.
The default mixed regulation/publication request therefore currently returns 503. Date-based `asOf` returns 409
`historical_coverage_unavailable`. Semantic/hybrid returns 503 unless `allowDegraded: true`, in which case lexical
results explicitly report the requested mode, effective lexical mode, degradation and an explanatory warning.
No embeddings or reranker calls occur in this implementation.

## Provenance and boundaries

Hits include canonical provision/version/passage IDs, source URL, artifact acquisition timestamp, publisher,
rights attribution, canonical version hash, locator, parent, edition observation and publisher currency. The result
update timestamp is the selected edition's publication into Rostra; unavailable source modification time remains null.
eCFR selections are labeled observed snapshots, not proof of arbitrary historical legal status. Annual editions use
published-edition context. Section native IDs produce CFR citations; other structural IDs remain explicit native
identifiers with a warning. Agency arrays remain empty with a mapping-unavailable warning.

Snippets are at most 500 characters. The canonical URL points to the existing exact-version text endpoint with its
edition selector. Publisher/supplier are the stored official publisher for this direct federal acquisition path;
future licensed sources require a separate attribution/supplier policy. Source rights and target copy integrity are
checked before ranking, and returned passages are compared with canonical storage. Responses use `private, no-store`.

Search now requires a separate acknowledgement revision snapshot for every generation in each selected scope.
Canonical and target mutations invalidate that snapshot before ranking, including mutations that remove all query
matches. Reverified pages alone do not renew it; explicit acknowledgement is required. Snapshot manifests also bind
frozen cursors. See [copy-validation boundaries](copy-validation-checkpoints.md). Both retained two-title pilots have
been upgraded and re-acknowledged for this contract without replacing source text or embeddings.
The serving transaction additionally compares live source inventory counts, ordinal/version identities and preparation
context. Added source members or changed code names/publication document numbers fail even when no existing generation
counter changes. This prevents expected-generation joins from silently hiding newly added unprepared source records.

## Validation and remaining gates

The local HTTP canary uses the authenticated Web Request/Node handler bridge and typed client, signed test credentials,
source database 55438 and disposable target 55455. It verifies two exact hits across Titles 3/23, source provenance and
canonical version hashes, pagination, current code selection, explicit fallback, unprepared/default scope refusal,
cursor mode binding, and missing/wrong-audience/wrong-organization credentials. Evidence is stored in
`artifacts/regulatory-backfills/legal-search-http-canary.ts/.json`. The renewed run at `2026-09-16T06:42:29Z` also
verified stale-revision refusal for a no-match query, refusal after page revalidation alone, restored serving after
acknowledgement and rejection of the old cursor. It writes query caches, a target metadata no-op, validation/receipt
records and canonical lexical acknowledgement; no source content or embeddings change.

At `2026-09-16T06:42:47Z`, a streamable HTTP MCP client verified tool discovery, exact search-hit and generation
parity, the second frozen page, and a composed `get_legal_text` call matching the direct HTTP text and selected context.
The adapter used separately signed API and MCP audience credentials for the same principal. Unknown tool arguments
were rejected before HTTP access. Evidence: `artifacts/regulatory-backfills/legal-search-mcp-canary.ts/.json`.
The tool uses the existing organization gate, identity-bound API credential provider and combined 900,000-byte
response budget. It has no database or ingestion dependency of its own.

This is not deployed Next-router or real WorkOS credential evidence. Agency/publication
retrieval, full-corpus performance, semantic/vector search, remaining reconciliation and deployment acceptance are open.
