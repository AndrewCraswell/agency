# Legislative data expansion feasibility

## Decision summary

The expansion is feasible, but not with the existing bill importers alone and not with one uniform nationwide coverage
promise.

- Federal people, organizations, meetings, hearings, amendments, reports, and House floor votes have strong
  Congress.gov or GovInfo options.
- State people and current committees are feasible through Open States, while historical committee membership is not a
  dependable national capability.
- State events are feasible as a rolling current-data product, but historical depth and jurisdiction coverage must be
  measured before making a national claim.
- Existing state bill votes provide a useful base. Congress.gov House votes require a new importer. Senate and committee
  votes remain gaps unless an approved provider exposes them.
- Canonical change tracking is application work and needs no new provider, but it follows the entity and event models.
- Expanded MCP tools are straightforward only after the underlying models, ingestion, and coverage gates pass.

## Provenance boundary

Provenance is out of scope for this program phase. We will not build field-level lineage, source custody chains,
immutable audit history, or evidence graphs. We will continue storing only the upstream identifiers, URLs, update
timestamps, ingestion-run references, and content hashes required to operate ingestion, avoid duplicates, detect
changes, replay failures, and debug incorrect records.

## Approved provider boundary

Expansion remains within Open States, Congress.gov, and GovInfo. New endpoints and collections from those providers are
allowed after E0 proves their utility and coverage. We will not add House Clerk, Senate.gov, individual legislature
feeds, or other publisher-specific integrations to fill gaps. An unsupported capability is documented as a coverage gap.

## Existing implementation baseline

The current schema and importers are bill-centric:

- Open States requests bill abstracts, actions, documents, relations, sponsorships, versions, and votes.
- Congress.gov requests bill actions, committee names, cosponsors, related bills, subjects, summaries, and text versions.
- GovInfo parses BILLSTATUS metadata and bill text references.
- People contain a name, optional party and jurisdiction, source link, and upstream IDs.
- Committees are stored as bill-owned name arrays rather than canonical organizations.
- Votes belong directly to bills and contain a motion, result, totals, time, and optional individual positions.
- There are no canonical committees, memberships, meetings, hearings, calendars, amendments, witnesses, or change events.
- The seven query and MCP operations are bill-oriented.

This baseline can be extended, but it cannot support the proposed domains without new schemas, clients, normalization,
coverage reports, workflows, and query contracts.

## Feasibility matrix

| Capability | Existing coverage | Approved provider path | Feasibility | Primary limitation |
| --- | --- | --- | --- | --- |
| State people and terms | Sponsor and voter identities only | Open States `/people` | High for current people; medium for complete term history | Field completeness varies by jurisdiction |
| State committees and memberships | Committee names on bills | Open States `/committees` | High for current snapshots; low for historical membership | Open States explicitly focuses on current membership rather than history |
| Federal members and terms | Bill sponsors and cosponsors | Congress.gov member endpoints | High for Congress.gov-supported fields | Temporal term detail may be incomplete |
| Federal committees and memberships | Committee names on bills | Congress.gov committee endpoints | High for Congress-scoped records | Membership date precision and history may vary |
| State meetings and agendas | None | Open States `/events` | Medium and conditional by jurisdiction | Rolling scrape window, deletions, freshness, and uneven coverage |
| Federal committee meetings | None | Congress.gov committee-meeting endpoints | High | Pagination volume and corrections to scheduled events |
| Federal published hearings | None | Congress.gov hearing endpoints; GovInfo CHRG | High | Published transcript availability can lag the live meeting |
| Federal floor schedules | None | GovInfo calendars when sufficiently structured | Low to medium | GovInfo calendars may not provide a dependable current structured schedule |
| State bill votes | Vote totals and positions where supplied | Existing Open States bill data | High for supported records, conditional for completeness | Vote and voter coverage varies by jurisdiction |
| House floor votes | None | Congress.gov House vote endpoints | High for the supported range | Separate importer and bill or amendment linking required |
| Senate floor votes | None | No approved structured endpoint currently identified | Unsupported for now | Additional publisher feeds are outside the source boundary |
| Committee recorded votes | Incidental state bill votes only | Open States votes or Congress.gov meeting documents when structured | Low to medium | Often document-based rather than a consistent structured feed |
| Federal amendments | Generic documents only | Congress.gov amendment endpoints and amendment text | High | Amendment-to-vote and amended-amendment relationships need careful modeling |
| State amendments | Generic document links where supplied | Open States bill documents | Low to medium | No dependable uniform national structured amendment feed |
| Reports, hearings, and meeting documents | Generic bill documents only | Congress.gov; GovInfo CRPT, CHRG, and committee materials | High federally | Linking and document volume |
| State fiscal notes and analyses | Generic document links where supplied | Existing Open States documents | Medium, source-dependent | Availability and classification are inconsistent |
| Canonical change events | Timestamps, hashes, checkpoints, and ingestion runs | No additional provider required | High after E1-E4 | Correct transactional diff and deduplication semantics |
| Expanded MCP tools | Bill tools only | No additional provider beyond E1-E5 | High after domain completion | Tool sprawl and honest communication of partial coverage |

## Official source findings

### Open States

Open States API v3 exposes people, committees, and events in addition to bills. People can have multiple roles. This is
a viable expansion path for current state entities.

Open States' committee design is an important constraint: its documented restoration effort focuses on maintaining
current committee membership and explicitly does not focus on historical committee information. Historical state
committee rosters therefore cannot be an initial nationwide requirement.

Open States events are intended to run regularly and use a default window of 30 days before and 90 days after the
scrape date. Future events that disappear can be returned as deleted. This makes the API appropriate for rolling
meeting and agenda coverage, but not proof of comprehensive historical schedules.

References:

- [Open States API v3](https://docs.openstates.org/api-v3/)
- [Open States committee data design](https://docs.openstates.org/enhancement-proposals/004-committee-data/)
- [Open States events data design](https://docs.openstates.org/enhancement-proposals/007-events/)

### Congress.gov

Congress.gov API v3 exposes members, committees, committee meetings, published hearings, amendments, committee reports,
and House roll-call votes in addition to the bill endpoints already used. Committee meeting detail can include
committees, related bills, witnesses, witness documents, meeting documents, video, continuations, and linked hearing
transcripts. This makes it the primary federal structured source for phases E1, E2, and E4.

The documented API limit is 5,000 requests per hour with pages up to 250 records. Full bootstraps are feasible but must
use list endpoints, update timestamps, durable checkpoints, and bounded detail fetches rather than refetching every
record on each run.

References:

- [Congress.gov API](https://api.congress.gov/)
- [Congress.gov API repository and limits](https://github.com/LibraryOfCongress/api.congress.gov)
- [Committee meeting endpoint documentation](https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/CommitteeMeetingEndpoint.md)

### GovInfo

GovInfo is already an approved provider and offers programmatic package access plus bulk XML for selected collections.
Its developer catalog includes
Congressional Hearings, Congressional Reports, committee prints, calendars, the Congressional Record, and other
committee materials. GovInfo is most useful for authoritative document packages and historical published material,
not as the sole live meeting or roll-call feed.

References:

- [GovInfo Developer Hub](https://www.govinfo.gov/developers)
- [GovInfo committee materials](https://www.govinfo.gov/app/browse/category/committee-materials)
- [GovInfo Congressional Hearings coverage](https://www.govinfo.gov/help/chrg)

## Principal risks and controls

### Uneven state coverage

State capability must be reported per jurisdiction and data type. The system must never convert a missing or stale feed
into an empty schedule, empty committee, or proof that no vote occurred.

### Historical expectations

Current people, committee, and event data can be valuable without reconstructing complete history. Each domain needs an
explicit supported start date or rolling window. Historical state committee membership is excluded unless E0 proves a
reliable source.

### Identity resolution

People, committees, meetings, bills, amendments, and votes must use upstream IDs where available. Name-only matching is
bounded by jurisdiction, chamber, and time and must remain unresolved when ambiguous.

### Mutable schedules

Meetings and calendars change frequently. Importers need overlap windows, cancellation and deletion semantics, and
short refresh intervals. A schedule is an observed current record, not a prediction.

### Rate and volume

Congress.gov's request limit and detail-heavy meeting records require discovery-first ingestion, conditional refresh by
update timestamp, bounded concurrency, and resumable checkpoints. Document downloads run separately from metadata
normalization.

### Source restraint

Coverage gaps do not automatically justify a new provider. E0 records what the three approved providers expose and the
roadmap scopes features to that evidence. Direct chamber, individual legislature, and other publisher-specific feeds
remain excluded unless the source strategy is explicitly reconsidered later.

### Tool expansion

New tools are added by research scenario, not one tool per table. Tool contracts must expose coverage status and
pagination so partial state availability is visible rather than silently incomplete.

## Recommended delivery order

1. Finish the current corpus ingestion, document processing, and baseline seven-tool evaluation.
2. Complete E0 and approve exact source and coverage contracts.
3. Build E1 entities because meetings, votes, and amendments depend on stable people and organizations.
4. Build E2 events and calendars.
5. Build E3 Congress.gov House votes and Open States state votes, keeping Senate and committee votes unsupported or
   conditional.
6. Build E4 amendments and supporting material.
7. Build E5 canonical change tracking without provenance or derived interpretation.
8. Expose and evaluate E6 MCP research capabilities incrementally as each domain passes its gate.

No web application, customer notification system, production commercialization, or derived intelligence phase should
begin before this sequence is reviewed using measured coverage from E0.
