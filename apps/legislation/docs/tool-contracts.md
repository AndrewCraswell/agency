# Legislative MCP tool contracts

## Shared behavior

All returned bill records contain canonical IDs and relevant official links. Lookup inputs accept canonical bill IDs or an
unambiguous jurisdiction, session, bill-type, and bill-number tuple. Provider IDs are metadata, not public identity.

List operations use opaque cursors, default to 20 results, and allow at most 100. Text queries are limited to 500
characters. Snippets are limited to 500 characters, and a single response contains at most 100,000 text characters.
Responses include `truncated: true` and a continuation cursor whenever a configured limit removes available content.

Stable error categories are `invalid_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`,
`dependency_unavailable`, and `internal`. Errors include a safe message and correlation ID and never include SQL,
credentials, stack traces, or provider secrets.

## Locked tools

### `search_bills`

Input: query plus optional jurisdiction IDs, session IDs, classifications, statuses, subjects, introduced-date range,
cursor, and limit. Output: ranked bill summaries with match explanation, source links, next cursor, and truncation flag.

### `get_bill`

Input: canonical ID plus optional `childCursor` and `childLimit`. Output: canonical metadata, sponsors, latest status,
subjects, documents, relations, upstream attribution, source links, and `nextChildCursor` when any child collection has
another bounded page.

### `get_bill_timeline`

Input: bill lookup plus optional `childCursor` and `childLimit`. Output: ordered actions and votes with stable event IDs,
dates or timestamps, description, result, source link, and a continuation cursor when needed.

### `search_bill_text`

Input: query plus optional bill, jurisdiction, session, document-version, date, cursor, and limit filters. Output: ranked
section matches with bill and document IDs, heading, snippet, lexical and semantic scores, source link, and next cursor.

### `get_bill_text`

Input: bill lookup, optional document ID or version code, optional section identifier, and cursor. Output: ordered
document sections, content hash, source link, next cursor, and truncation flag.

### `compare_bill_versions`

Input: bill lookup and exactly two document IDs or version codes. Output: identified versions and ordered change hunks
classified as added, removed, or unchanged, with source links and truncation signaling.

### `find_related_bills`

Input: bill lookup plus optional relation classifications, semantic expansion flag, cursor, and limit. Output: canonical
related bills with relationship type, relevance score when applicable, and relevant official links.

## Data-expansion tools

### `search_people` and `get_person`

Discovery accepts bounded name or party text plus optional jurisdiction, organization-membership, and active-status
filters. Detail returns the canonical person, legislative terms, memberships, and sponsored bills. Empty results may mean
that a jurisdiction does not publish people through the configured source.

### `search_organizations` and `get_organization`

Discovery accepts bounded name text plus optional jurisdiction, classification, parent-organization, and active-status
filters. Detail returns the canonical legislature, chamber, committee, or subcommittee with children, memberships, and
bounded bill activity. Organization availability is source-dependent.

### Events, calendars, votes, amendments, materials, and changes

`search_events`, `get_event`, and `get_calendar` expose available meeting, hearing, agenda, participant, document, and
calendar records. `search_votes` and `get_vote` expose normalized roll calls and positions. `search_amendments`,
`get_amendment`, `search_supporting_materials`, and `get_supporting_material` expose their canonical records and links;
material detail includes paginated extracted sections. `search_changes` exposes observed canonical changes without
generating summaries or predictions. Every list is cursor-paginated and returns explicit truncation metadata.
