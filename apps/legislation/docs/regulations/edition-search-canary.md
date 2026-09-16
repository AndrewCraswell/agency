# Cross-edition lexical retrieval

`src/api/legal-edition-search.ts` adds an application-level search service over explicitly selected published federal
editions. It accepts 1–100 unique edition IDs, a trimmed 1–500-character query and limit 1–100 (default 20). These IDs
are discoverable through the edition API; consumers do not supply passage generation or preparation IDs.

This service now backs the [public lexical route and typed client](legal-search-serving.md). Its internal result
shape is projected into the existing public search DTO with provenance and bounded snippets. Current-code selection
and API-backed MCP search are implemented; publications, agency filters and semantic/hybrid retrieval remain open.
Frozen pagination is implemented as described below.

## Frozen pagination

Multi-page queries persist at most 1,000 ranked candidate identities and scores in the search database's
`legal_search_results` table, with a 15-minute expiry. The cache contains no source text or embedding vectors.
Continuation binds the caller's organization and user, sorted edition scope, normalized query, page size, current
rights and generation signatures. Each page repeats authorization and copy-integrity checks, then hydrates the
frozen candidates against canonical storage. Continuation does not rerun ranking. A candidate-list hash detects
cache corruption; it is not an authorization credential. A fresh application instance can read the same cursor.

`nextCursor` is null at the end of the retained window. `candidateSetTruncated` explicitly reports matches beyond
the 1,000-version window and asks the consumer to refine the query. `truncated` is true when either more pages exist
or that window was exceeded; it can therefore remain true on the last page. Expired or differently bound cursors
return a conflict. Malformed cursors return an invalid-request error.

Creating a multi-page snapshot removes at most 100 expired rows, skipping locked rows. Expiry prevents serving old
snapshots even without cleanup traffic; dedicated retention cleanup and national-volume performance remain open.

## Read and integrity boundaries

The verified request context and legal organization allowlist are required before any database connection. Every
requested edition must be published and from official federal eCFR/CFR data. Source API/MCP, text-display and local
search rights are locked and checked before connecting to the search database. An unsupported or unknown edition
returns 404; missing acknowledgement/copy evidence returns a dependency error. No requested edition is silently dropped.

The canonical source must have prepared, idle preparations and an acknowledged lexical outbox row for every selected
edition. The target receipt selects the matching preparation when multiple tokenizers have prepared the same source.
Preparation identity, expected generation count and inventory hash must agree across databases, and a target scope
revocation rejects the request.

PostgreSQL computes ordered SHA-256 signatures of every selected version/generation identity and its generation
metadata, excluding only the source-only creation timestamp. Signatures and total generation/passage counts must match
between canonical preparation members and target memberships. Actual target passage counts must also match the
receipts. This avoids transferring whole editions into the application while detecting missing/swapped generations
and metadata drift, including in generations that return no hit. The result generation additionally binds edition
metadata and current rights hashes.

Ranking filters to selected memberships before evaluating PostgreSQL English full-text matches. It chooses the best
passage for each exact version, then ranks those versions globally by score with stable passage/edition tiebreakers.
This is PostgreSQL `ts_rank_cd`, not BM25 or semantic retrieval. English stemming can match `reimbursed` to source
`reimbursable`; a lexical match is not a literal quotation of the query.

Each returned passage is checked against canonical passage text, prepared input, source version membership and
generation metadata. Input hashes and passage identities are rechecked. Hydration adds exact provision/version/edition
and code IDs, source native ID, heading, locator, issue/currency dates, rights hash and a source-selected text URL.
One version matching several passages is returned once. This does not merge different versions of the same provision.

Both databases use repeatable-read transactions and 5-second lock / 15-second statement timeouts. The selected
preparation catalog is capped at 1,000 entries. This does not replace whole-copy validation: every passage body is
not rehashed on every search request. Out-of-band corruption of an unreturned passage that preserves metadata/counts
still requires reconciliation. Large-corpus query plans, mutation invalidation and resumable acknowledgement remain
open, so this service is not a national search-readiness certificate.

## Evidence

The retained Titles 3 and 23 search pilot returned the expected ethical-conduct provision and reimbursement table
from one query across both editions. The final metadata-signature implementation took approximately 340 ms in that
local run, covering 1,270 generation metadata records and 1,953 stored passages. This is a two-title measurement,
not a full-corpus latency commitment. Scope filtering, unique versions, explicit truncation, exact replay with
reordered edition IDs and refusal of an unacknowledged edition passed.

A cloned search target on port 55455 supplied real database fault injection. Missing passage, missing membership,
changed receipt, generation metadata drift, scope revocation and changed returned text all failed closed. Exact
baseline results returned after each restoration. The canonical database and retained target on port 55454 were
not mutated. Scripts and reports are under `artifacts/regulatory-backfills/current-edition-search-canary.*` and
`edition-search-corruption-canary.*`; the target clone came from `legal-search-canary.sql`.

At `2026-09-16T03:41:52Z`, the pagination canary on source 55438 and clone target 55455 passed frozen order,
fresh-service replay, query/page-size/scope/caller binding, malformed cursor rejection, candidate tampering rejection,
expiry rejection and expired-row cleanup. Evidence: `edition-pagination-canary.ts/.json` under the same artifact
directory. This test wrote only query-cache records on the clone, with zero source/index writes or provider calls.
