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
