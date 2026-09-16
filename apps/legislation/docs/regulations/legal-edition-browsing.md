# Edition and provision browsing

The local HTTP and MCP surfaces now support a complete source-reading sequence: list codes, list editions, traverse
one edition, then read the exact version using the existing text operation. These routes remain behind the legal API
organization allowlist and use separate verified API/MCP audiences and identity-bound API credentials.

| HTTP operation | MCP tool | Selection |
| --- | --- | --- |
| `GET /api/legal/codes/{codeId}/editions` | `list_legal_editions` | Optional `sourceId`, `issuedFrom`, `issuedTo` |
| `GET /api/legal/codes/{codeId}/provisions` | `list_legal_provisions` | `editionId` or default current eCFR head; traversal and parent |

Both accept cursor and limit, default 20 and maximum 100. Invalid code IDs, unknown or duplicate fields, reversed
date ranges and conflicting selectors return 400. Date filters apply inclusively to `issueDate`, never currency or
collection time. Edition order is issue date descending, null dates last, then ID. Only published, rights-authorized
official federal editions appear; an absent or wholly inaccessible code returns 404. A known code with no matching
source/date filter returns an empty page with a coverage warning.

Edition metadata includes code ID, source ID, source observation, native key, revision, publisher source URL, issue
date, source currency and publication timestamp. `scope` distinguishes `current_code_snapshot` from `annual_volume`.
An annual volume is not a complete annual title or proof of continuous historical coverage. Unpublished/staged volumes
remain inaccessible. Edition detail and annual title coverage endpoints are still separate implementation gates.

Provision traversal defaults to `children`: omit `parentId` for roots, or supply it for direct children. `all` enumerates
all members in their stored structural order and cannot be combined with a parent. `nodeKind` filters that traversal.
A parent must belong to the selected edition; an unknown parent or mismatched code/edition returns 404. Annual browsing
requires an explicit edition when no eCFR head is present. `asOf` is accepted syntactically but returns 409 with
`details.reason=historical_coverage_unavailable`; no nearby edition is substituted.

The provision page extends the shared envelope with `meta.selectedEdition`, including on an empty page. Each member
contains provision/version/edition IDs, parent, ordinal, source native ID, node kind, heading, locator, `hasChildren`
and an exact `textUrl`. Source native IDs remain source identities, not display-ready citations. Bodies are never
loaded by traversal. The `(edition_id,parent_id,ordinal)` index supports child selection and child existence checks.

All requests authenticate before database access and lock/validate source API rights before disclosing results.
Traversal also requires `displayText` before loading headings or parent membership. Transactions use repeatable read,
5-second lock timeout and 15-second statement timeout. Edition lists bound rights profiles at 1,000 and editions at
10,000, failing closed above those limits. Traversal fetches at most `limit+1` members. Cursors are scope identifiers,
not authorization credentials; rights are rechecked on every request.

Edition cursors bind the visible catalog, rights, caller, code, date/source filters and limit. Provision cursors bind
the selected immutable edition, rights, caller, code, traversal, parent, node filter and limit. A continuation created
from the default head explicitly retains its selected edition instead of consulting a newer head. Changing request
selection or scope returns 409. Keep the original filters and limit when continuing; do not add an explicit edition
parameter midway through a sequence that began with the default head.

The API client now accepts the server's optional JSON object error details and retains them on `LegislationApiError`.
Previously the strict client rejected those legitimate server errors as malformed. The API-backed MCP adapter retains
these details internally, while the existing tool error envelope still presents category, message and retryability.

Local evidence covers all 1,237 Title 23 provisions through HTTP and all 33 Title 3 provisions through MCP, followed
by exact source reconstruction of 3 CFR 100.1. The annual pilot verifies three published Title 5 volumes and exclusion
of two unpublished editions. See the [implementation ledger](implementation-progress.md) for reports and limitations.
This does not certify deployed routing, live credentials, search/embedding readiness or national historical coverage.
