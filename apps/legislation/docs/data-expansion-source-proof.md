# Data expansion source and coverage proof

## Evidence snapshot

This proof was measured against the approved Open States, Congress.gov, and GovInfo interfaces on 2026-08-17. The
machine-readable samples are retained in the development reports container:

- `evidence/expansion/e0/openstates-ten-jurisdiction-sample-2026-08-17.json`
- `evidence/expansion/e0/congress-sample-113-119-2026-08-17.json`
- `evidence/expansion/e0/govinfo-inventory-2026-08-17.json`

The sample is a capability and volume proof, not a completeness claim. Empty and missing fields remain coverage gaps.

## Approved supported capability contract

| Domain | Required canonical fields | Optional fields | Best-effort fields | Explicit limitation |
| --- | --- | --- | --- | --- |
| People | Stable ID, source ID, name, jurisdiction | Party, given name, family name, active role, update time | District, chamber, alternate IDs, offices, contact and demographic fields | Open States does not prove complete historical roles nationally |
| Terms and districts | Stable ID, person, jurisdiction, chamber when a term is created | District, party, start, end, source role | Role title and precise boundary dates | Missing dates and historical state terms are not inferred |
| Committees | Stable ID, source ID, name, classification, jurisdiction | Parent committee, chamber, sources | Alternate names and source extras | Current state snapshots are supported; historical state rosters are not promised |
| Memberships | Person, committee | Title or rank, start, end, active state | Membership classification | Dates are nullable and no historical interval is fabricated |
| Events | Stable ID, source ID, jurisdiction, name, start, status, deleted state | Type, all-day flag, location, description, end | Virtual access, continuation and participant details | State event history and nationwide freshness are conditional by jurisdiction |
| Agendas and calendars | Parent event or chamber, ordered item or document | Related bills, committees, documents and continuation | Floor calendar structure extracted from approved provider records | GovInfo calendars are document-first and are not a guaranteed live structured schedule |
| Votes | Stable ID, organization or chamber, vote time, question or motion, result | Roll-call number, vote type, required threshold, related bill or amendment | Individual positions and party totals | Congress.gov House votes begin with the 115th Congress in the measured API; Senate votes are unsupported |
| Amendments | Stable ID, Congress or session, type, number | Purpose, status, sponsor, dates, related bill | Text versions, actions, amended-amendment and vote links | Structured state amendments remain conditional; unstructured links stay documents |
| Reports and hearings | Stable package ID, type, title, Congress, source link | Committees, dates, related legislation, witnesses | Meeting links and extracted sections | Publication can lag the event, and relationship population varies |
| Supporting documents | Stable ID, parent record, source URL, document type | Date, title, content type | Fiscal notes, analyses, testimony and witness statements | State availability is source-dependent and is never presented as national completeness |

## Open States sample

Ten structurally different jurisdictions were sampled using canonical jurisdiction IDs: Alaska, California, District
of Columbia, Florida, Hawaii, Nebraska, New York, Puerto Rico, Texas, and Vermont. Each request included the related
fields needed for the proposed model.

| Resource | Sample | Measured population | Coverage finding |
| --- | --- | --- | --- |
| People | 100 records, 10 per jurisdiction | Name, party, current role, jurisdiction, timestamps and source were present in all 100. Email was present in 99, image in 90, birth date in 57, alternate identifiers in 33. | Strong current-person coverage; demographic, contact and alternate identifiers remain optional. |
| Committees | 100 records, 10 per jurisdiction | ID, name, classification, parent and included memberships were present in all 100; sources were present in 98. | Current committee snapshots are viable. Filtering must use the canonical jurisdiction ID because name filtering was observed to return the unfiltered global list. |
| Events | 90 records across nine nonempty jurisdictions | Start, status, deleted state, location and sources were present in all 90. Participants appeared in 75, description in 47, agenda in 43, documents in 24, and end time in 6. | Events are viable as conditional rolling coverage. Puerto Rico returned zero events and must be reported as an observed empty response, not proof that no meetings exist. |

Open States throttled burst traffic with HTTP 429 responses. Paced requests with bounded retry completed the sample.
Importers must honor throttling and use jurisdiction-scoped pagination rather than concurrent full-corpus detail fetches.

The development credential later reported a hard limit of 250 requests per day while current people, committee, and
event snapshots were running. Historical session archives do not consume that API quota and completed independently.
Current entity and event expansion therefore remains restartable but blocked until the daily quota resets or the Open
States plan is increased; repeated 429 responses with an explicit daily-limit detail are treated as non-retryable.

## Congress.gov sample and range

Every list endpoint was sampled for each Congress from the 113th through the 119th. All requests succeeded.

The Congress.gov House roll-call endpoint reports zero records for the 113th and 114th Congresses. Its supported data
begins with the 115th Congress: 1,210 roll calls in the 115th, 954 in the 116th, 998 in the 117th, 1,241 in the 118th,
and 645 currently reported for the 119th across both sessions. Detail and member-position endpoints were validated with
an authenticated 119th Congress sample before enabling the restartable importer.

| Resource | Records reported across sampled Congresses | List requests at 250 per page | Detail-request lower-bound time at 5,000 requests/hour | Range finding |
| --- | ---: | ---: | ---: | --- |
| Members | 3,876 term-scoped rows | 21 | 0.78 hours | Present in every Congress; people repeat across terms, so deduplication reduces detail requests. |
| Committees | 1,783 | 11 | 0.36 hours | Present in every Congress. |
| Committee meetings | 17,918 | 76 | 3.58 hours | Present in every Congress. |
| Hearings | 15,526 | 67 | 3.11 hours | Present in every Congress. |
| Amendments | 39,141 | 160 | 7.83 hours | Present in every Congress and the largest measured detail workload. |
| Committee reports | 8,404 | 38 | 1.68 hours | Present in every Congress. |
| House votes | 5,048 | 21 | 1.01 hours | No records for the 113th or 114th; supported from the 115th onward in the measured API. |

The duration column assumes one detail request per list record and is therefore a lower bound. Detail subcollections,
retries, update overlap, and document acquisition increase elapsed time. Bootstraps must be checkpointed by domain and
Congress rather than combined into one execution.

## GovInfo inventory

The GovInfo collection API accepted the existing data.gov API credential. Using an update-date window beginning
2017-01-01, it reported 46,748 CHRG hearing packages, 162,695 CRPT report or Serial Set packages, 7,783 CPRT committee
prints, and 6,397 CCAL calendar packages. List records expose Congress, issue date, document class, last-modified time,
package ID, package link, and title.

These counts bound discovery volume but are not publication-date counts: an older package updated after the requested
date can appear. Importers must retain the package Congress and issue date and then link by structured identifiers from
package details. GovInfo remains the authoritative document source; Congress.gov remains the primary structured source
for live committees, meetings, hearings, amendments, and House votes.

## Approved gaps and exclusions

- State people, committees, memberships, events, agendas, documents and votes are reported per jurisdiction and field.
- Complete historical state committee membership is unsupported.
- Puerto Rico event coverage was empty in the measured sample and remains an explicit gap pending later observations.
- Congress.gov House votes are supported only from the 115th Congress onward in the measured range.
- Senate roll calls and uniformly structured committee votes are unsupported within the approved providers.
- GovInfo calendars are accepted as searchable official documents, not promised as a complete live floor schedule.
- Publisher-specific fallback feeds remain excluded. Missing data does not authorize a new provider.
- No field-level provenance or custody system is introduced by this expansion.

## Bootstrap sequencing

Run independent, restartable bootstraps in dependency order: people and organizations, memberships, meetings and
hearings, votes, amendments, supporting materials, then document processing. Use durable per-domain checkpoints,
provider update timestamps, bounded detail concurrency, and overlap windows for mutable records. Schema migrations may
proceed under the approved supported capability contract above.
