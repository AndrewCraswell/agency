# MCP migration and HTTP parity

## Architecture

The MCP and HTTP API are adapters over one `LegislationApplicationService`. Authorization, validation, canonical
mapping, search routing, pagination, provenance, and error classification live in that service, not in either adapter.
An in-process MCP adapter calls it directly. A separately deployed MCP adapter may use an HTTP client implementing the
same interface; it must not reinterpret payloads or perform loopback HTTP when co-located.

MCP output stays optimized for model context, while HTTP returns the full documented envelopes. Both expose the same
records, rankings, filters, identities, and sources.

## Tool-to-endpoint map

| MCP tool | HTTP operation | Shared service operation | Parity rule |
| --- | --- | --- | --- |
| `search_bills` | `POST /api/search/bills` | `searchBills` | identical filters, ranking, and canonical bill hits |
| `get_bill` | `GET /api/bills/{billId}` | `getBill` | same bill detail and bounded children |
| `get_bills` | `POST /api/bills/batch` | `batchGetBills` | same 25-ID limit and item isolation |
| `get_bill_timeline` | `GET /api/bills/{billId}/timeline` | `getBillTimeline` | same discriminated timeline union and order |
| `search_bill_text` | `POST /api/search/passages` | `searchBillPassages` | same mode, filters, models, and sections |
| `get_bill_text` | `GET /api/bills/{billId}/sections` | `getBillText` | one-call traversal across processed bill versions |
| `compare_bill_versions` | `POST /api/document-diffs` | `compareDocumentVersions` | same document identity and deterministic hunks |
| `find_related_bills` | `GET /api/bills/{billId}/related` | `findRelatedBills` | explicit and similarity relationships preserved |
| `search_people` | `GET /api/people` | `searchPeople` | lexical name and relationship filters only |
| `get_person` | `GET /api/people/{personId}` | `getPerson` | same current and historical service data |
| `search_organizations` | `GET /api/organizations` | `searchOrganizations` | commissions and committees remain organizations |
| `get_organization` | `GET /api/organizations/{organizationId}` | `getOrganization` | same canonical organization identity |
| `search_events` | `GET /api/meetings` | `searchMeetings` | meetings, hearings, and sessions share filters |
| `get_event` | `GET /api/meetings/{meetingId}` | `getMeeting` | same event detail and child cursors |
| `get_calendar` | `GET /api/calendars/{calendarId}` plus `/meetings` | `getCalendar` | MCP may bundle the bounded first meeting page |
| `search_votes` | `GET /api/votes` | `searchVotes` | same filters and complete normalized counts |
| `get_bill_votes` | `GET /api/bills/{billId}/votes` | `getBillVotes` | positions identify who voted and how |
| `get_vote` | `GET /api/votes/{voteId}` | `getVote` | same normalized and source identities |
| `get_votes` | `POST /api/votes/batch` | `batchGetVotes` | same 25-ID limit and item isolation |
| `search_amendments` | `POST /api/search/amendments` | `searchAmendments` | structured and document amendments both searched |
| `get_amendment` | `GET /api/amendments/{amendmentId}` | `getAmendment` | same canonical amendment record |
| `get_amendments` | `POST /api/amendments/batch` | `batchGetAmendments` | same 25-ID limit and item isolation |
| `search_amendments_for_bills` | `POST /api/bills/amendments/batch` | `listAmendmentsForBills` | one independent page and cursor per bill |
| `search_supporting_materials` | `POST /api/search/supporting-materials` | `searchSupportingMaterials` | same passages, model route, and relationships |
| `get_supporting_material` | `GET /api/supporting-materials/{materialId}` plus `/sections` | `getSupportingMaterial` | MCP may bundle the bounded first section page |
| `search_changes` | `GET /api/changes` | `searchChanges` | same durable change-feed filters and ordering |

## Migration gates

1. Add the application-service interface around the existing tested MCP behavior without changing outputs.
2. Implement HTTP adapters against that interface and generate conformance fixtures from the contract.
3. Run paired MCP and HTTP queries over known bills, amendments, votes, OCR sections, and supporting materials; compare
   canonical IDs, source links, page boundaries, and ranked ordering.
4. Move a remote MCP deployment to the HTTP client only after parity tests pass. Keep the in-process direct adapter.
5. Treat a missing HTTP parity route as a release blocker; do not add adapter-only data access.
