# Published code discovery

The local `GET /api/legal/codes` operation and API-backed `list_legal_codes` MCP tool list published federal code
metadata. They share the legal API organization allowlist, verified caller context, strict client contract and
identity-bound API credentials. The MCP audience token is not accepted by the API. No ingestion or embedding request
is issued from discovery.

Inputs are optional `jurisdictionId` and `kind` (`regulation` or `statute`), plus `cursor` and `limit` (default 20,
maximum 100). Unknown or duplicated parameters and malformed cursors return 400. Results use the normal page envelope,
ordered by jurisdiction, name using PostgreSQL C collation, then code ID. Names sort lexically, not as title numbers.
Each row has a canonical code identity, jurisdiction, code key, name, kind, latest authorized publication timestamp
and authorized source/rights-profile references. This timestamp is catalog publication time, not legal currency.
Canonical detail URLs now resolve through `GET /api/legal/codes/{codeId}`, C's `getLegalCode` client and the
`get_legal_code` MCP tool. Detail accepts no query parameters and returns `Resource<LegalCodeDetail>` with the same authorized
metadata as its catalog row plus `editions.publishedComponents` and nullable `editions.current`. The count covers visible
published source edition components; three annual volumes count as three, not three complete years. Current is the
explicit authorized eCFR code head, never a guessed maximum date or an annual volume. It contains edition/code/source IDs,
issue date and source currency date separately. An annual-only code, or a code whose current head is not visible, has null
current. Counts and head metadata use the same transaction snapshot and permitted rights set as catalog detail.
Exact code/current-edition ownership and canonical-URL binding are verified by the wire contract. Missing,
unpublished or entirely rights-denied codes return the same 404, while unauthenticated/unapproved callers remain denied
before database access. Responses are private and non-cacheable; no provision text is loaded.

Only published editions from `ecfr` and `govinfo-cfr` in `jurisdiction:us` can contribute. Active rights profiles are
locked and validated for API/MCP access, worldwide territory and matching policy hashes before aggregation. Denied
profiles contribute neither code metadata nor timestamps. Catalog metadata does not require text redistribution;
exact text separately requires `displayText`. Licensed state sources remain excluded until their rights and serving
policy are implemented. An unsupported or absent scope returns an empty page with an explicit coverage warning, not
a claim that no laws exist there.

Each request uses a read-only-in-effect repeatable-read transaction with 5-second lock and 15-second statement
timeouts. The implementation bounds the profile catalog at 1,000 and code catalog at 10,000, failing rather than
silently truncating a larger catalog. It never loads provision bodies. Pagination hashes the authorized visible
metadata, policy hashes, caller, filters, order contract and page size. Continuations recheck rights and return 409
when this scope changes. The cursor is not an authorization credential; current verified identity and rights remain
mandatory. All pages are private and non-cacheable.

The [edition and provision browser](legal-edition-browsing.md) now supports edition lists and structural traversal.
Code membership establishes published metadata availability only. It does not certify complete historical coverage,
passage preparation, lexical indexing or embeddings. Those capabilities require their own receipts and public
coverage operation. Complete-history coverage and indexing/embedding capability enrichment of code detail remain open, along with
edition detail, public coverage reporting and deployed acceptance. This metadata slice does not close HTTP-04.

Tests cover bounded pages, stale continuation, caller/filter/limit changes, rights exclusion before aggregation,
strict HTTP parameters, token audiences, client protocol checks and MCP account isolation. The retained local canary
uses the actual canonical database through the signed-token API handler, typed client and MCP transport. This does
not establish deployed Next routing or live WorkOS acceptance; see the implementation ledger for exact results.
