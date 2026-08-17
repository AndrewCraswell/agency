# Legislative research evaluation cases

These cases lock the research intent and expected tool boundaries for the development corpus. They test retrieval and
evidence access only. They do not ask the system to predict outcomes, infer intent, generate legal advice, or claim
coverage that an upstream jurisdiction does not provide.

## Scoring contract

For every case, retain the client, tool sequence, arguments, canonical identifiers, official links, latency, truncation,
and any error. Score tool selection, required-field accuracy, source support, and task completion separately. An empty
result is correct only when the coverage report confirms that the relevant source/domain cohort was attempted. A human
reviewer must compare sampled records with the linked official source before E6.9 can pass.

## Cases

| ID | Research task | Expected tool path | Required evidence |
| --- | --- | --- | --- |
| R01 | Find a known federal bill by identifier and inspect its current canonical record. | `search_bills`, `get_bill` | Canonical bill ID, Congress, title, status, official link |
| R02 | Find a known state bill by topic without supplying its identifier. | `search_bills`, then `get_bill` | Ranked match, jurisdiction/session, match text, official link |
| R03 | Locate a phrase in official bill text and open its surrounding section. | `search_bill_text`, `get_bill_text` | Bill/document IDs, version, section, content hash, source link |
| R04 | Compare two available versions of the same federal bill. | `get_bill`, `compare_bill_versions` | Both document IDs and ordered changed/added/removed sections |
| R05 | Discover a legislator and inspect current terms, memberships, and sponsored bills. | `search_people`, `get_person` | Canonical person ID, source link, terms, bounded child pages |
| R06 | Discover a committee and inspect its hierarchy, members, and bill activity. | `search_organizations`, `get_organization` | Canonical organization ID, classification, parent/children, memberships |
| R07 | Find a committee meeting or hearing in a date range and inspect its agenda. | `search_events`, `get_event` | Status, start time, committee, agenda, documents, related bills |
| R08 | Inspect available chamber calendar entries for a jurisdiction and date range. | `get_calendar` | Entry date/time, organization, classification, related bill where supplied |
| R09 | Find a roll call for a bill and inspect normalized member positions. | `search_votes`, `get_vote` | Motion, result, counts, positions, official link where supplied |
| R10 | Find an amendment related to a bill and inspect its actions, votes, and materials. | `search_amendments`, `get_amendment` | Amendment ID, printed identifier, sponsor, related bill, actions |
| R11 | Find a committee report, fiscal note, analysis, or hearing document by its content. | `search_supporting_materials`, `get_supporting_material` | Material type, canonical links, extracted sections, source URL |
| R12 | Inspect recent observed changes for a bill, person, committee, event, or vote. | `search_changes` | Record ID/type, change type, changed fields, observation time |
| R13 | Confirm honest behavior for a state/domain combination with no upstream coverage. | Domain search plus current coverage report | Empty bounded result and explicit source-dependent coverage explanation |
| R14 | Continue a result that exceeds one page without duplicates or omissions. | Any paginated search/detail tool | Opaque cursor, stable ordering, truncation transition, unique IDs |
| R15 | Submit malformed IDs, dates, cursors, and over-limit values. | Representative tools from every domain | Stable safe error, no provider or database details, no service crash |

## Sampling matrix

Run known-item and discovery cases across the United States Congress plus representative large, small, dense, and sparse
state cohorts. Include recent and older sessions, active and inactive people, parent committees and subcommittees,
scheduled and cancelled events, votes with and without full positions, and processed plus unsupported material formats.
The current coverage report selects the actual jurisdictions and records; no case assumes uniform Open States fields.

E6.1 covers definition of these scenarios. E6.8 requires automated contract, authorization, payload, latency, and
two-client execution. E6.9 remains a separate human-reviewed evaluation and cannot be satisfied by these definitions.

## Automated compatibility evidence

For a credential-free preflight, run `pnpm --filter legislation eval:local`. The command exercises all seven original
research tools through the production MCP handler with deterministic fixtures and records calls, arguments, structured
evidence, latency, assertion scores, safe errors, and failure categories in
`work/evaluation/local-mcp.json`. See the [MCP evaluation readiness audit](mvp/mcp-evaluation-audit.md) for the exact
scope and remaining live gates. This local artifact is not authenticated corpus evidence and does not establish
two-client compatibility.

The MCP test suite advertises and calls all 21 tools, validates that every array parameter publishes an item schema,
rejects malformed canonical IDs before service execution, enforces the response byte ceiling, and calls every expansion
tool through an authenticated server. Two independent MCP SDK client sessions each execute all 14 expansion calls while
recording a two-second p95 contract budget. This is protocol compatibility evidence; it does not replace the live corpus
and human-source review required by E6.9.

## Live development corpus checkpoint

On 2026-08-17, the MCP SDK benchmark ran against the live Railway corpus through a local instance of the production
handler while the Open States replay, Congress synchronization, four document shards, and four embedding shards were
active. Twelve serial lexical calls completed with a 1,324 ms p95, including bill and extracted-text searches, and all
returned valid MCP results. A 30-call run at concurrency five reached a 6,281 ms p95 and exceeded the two-second target.
Direct query plans used the expected GIN indexes and completed representative searches in 99 to 321 ms; the concurrent
tail was database contention from the intentionally heavy development bootstrap.

This checkpoint proves live result correctness and the single-client development target, but it is not production
capacity evidence. Repeat the concurrent benchmark after the bulk processors are idle and before accepting E6.9 or any
production-readiness gate.

A subsequent SDK smoke on 2026-08-17 exercised all 21 advertised tools through the production handler against the live
Railway corpus. Health and readiness returned 200, and all 21 tool calls completed without a tool error. The run used a
local server with authentication disabled, so it proves live corpus and tool-contract behavior but does not satisfy the
authenticated-client checks. It exposed and drove corrections for state vote IDs, amendment material IDs, and smoke
fixture selection; the corrected runtime image is
`sha256:13f7bb8b081a53d4bbf2b157a04809f81bc6f24ca3b5274d9becb2e677495150`.
