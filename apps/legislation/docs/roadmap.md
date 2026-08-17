# Legislative data expansion roadmap

## Objective

Increase the value of the legislative corpus before building a web application, customer workspaces, notifications, or
production commercialization. This roadmap begins only after the current bill-corpus development work has a stable
baseline.

The feasibility findings, source coverage, and explicit limitations behind this sequence are documented in
[Data expansion feasibility](data-expansion-feasibility.md).

## Scope boundary

The only approved legislative data providers are Open States, Congress.gov, and GovInfo. New endpoints or collections
within those providers are allowed after E0 validates them. House Clerk, Senate.gov, individual legislature feeds, and
other publisher-specific fallbacks are out of scope. Missing data remains a reported coverage gap rather than a reason
to add another source.

This phase does not build a provenance system. It does not add per-field lineage, custody history, immutable audit
chains, or evidence graphs. Existing upstream identifiers, source URLs, update timestamps, and content hashes remain
where they are operationally necessary for fetching, identity matching, deduplication, change detection, and debugging.

Derived intelligence, AI summaries, predictions, customer-facing alerts, a web application, billing, and production
launch are not part of phases E0 through E6.

## Phase E0: Source and coverage proof

### Outcome

We know which fields and historical ranges are actually available before expanding the canonical schema or promising
nationwide completeness.

### Tasks

- [x] **E0.1** Define a capability matrix for people, terms, districts, committees, memberships, events, agendas,
  calendars, votes, amendments, reports, hearings, and supporting documents.
- [x] **E0.2** Sample Open States people, committee, and event responses across at least ten structurally different
  jurisdictions and record field population, update behavior, and missing data.
- [x] **E0.3** Sample Congress.gov member, committee, committee-meeting, hearing, amendment, committee-report, and House
  vote endpoints across the supported Congress range.
- [x] **E0.4** Inventory GovInfo hearings, committee reports, committee prints, and congressional calendars that can be
  linked to canonical committees, meetings, bills, or amendments.
- [x] **E0.5** Measure request volume and bootstrap duration against provider limits using representative pagination,
  without downloading the full datasets.
- [x] **E0.6** Classify every proposed field as required, optional, best-effort, or unsupported by source and jurisdiction.
- [x] **E0.7** Record unavailable capabilities as coverage gaps; do not evaluate or add publisher-specific fallback feeds.
- [x] **E0.8** Approve the supported coverage contract and explicitly list exclusions before creating migrations.

### Exit gate

Every phase E1 through E5 has a source, identifier strategy, update strategy, supported range, expected gaps, and bounded
bootstrap estimate. Conditional state capabilities are not presented as nationally complete.

## Phase E1: People, terms, and legislative organizations

### Outcome

Sponsors and voters resolve to useful people records, and committees become stable entities instead of bill-owned name
strings.

### Tasks

- [x] **E1.1** Add canonical organizations for legislatures, chambers, committees, and subcommittees with parent-child
  relationships and stable source-independent IDs.
- [x] **E1.2** Extend people with stable upstream identifiers, names, party, district, chamber, and active status without
  requiring contact information.
- [x] **E1.3** Add legislative terms with jurisdiction, chamber, district, party, start, end, and source-provided role.
- [x] **E1.4** Add committee memberships with person, organization, title or rank, start, end, and active status when the
  source supplies those dates.
- [ ] **E1.5** Import state people and current committee snapshots from Open States with per-jurisdiction coverage.
- [x] **E1.6** Import federal members, terms, committees, subcommittees, and memberships from Congress.gov; report fields
  or historical ranges that Congress.gov does not supply.
- [ ] **E1.7** Link existing bill sponsors, vote positions, committee-name arrays, and action organization identifiers to
  canonical people and organizations without discarding unmatched source text.
- [x] **E1.8** Prevent same-name people and renamed committees from merging without compatible upstream identity or
  jurisdiction context.
- [x] **E1.9** Add coverage and quality checks for unlinked sponsors, voters, committees, missing districts, overlapping
  terms, and impossible membership dates.
- [x] **E1.10** Add query operations for person detail, organization detail, membership, sponsored bills, and committee
  bill activity.

### Exit gate

Federal people and organizations meet the approved coverage contract. State coverage is reported per jurisdiction;
historical state committee membership is not inferred when Open States supplies only a current snapshot.

## Phase E2: Meetings, hearings, agendas, and calendars

### Outcome

The corpus represents scheduled legislative activity and its relationship to bills, committees, documents, and later
status changes.

### Tasks

- [x] **E2.1** Add canonical events with type, status, start and end time, timezone, location, virtual access, description,
  and cancellation or deletion state.
- [x] **E2.2** Add event participants, organizations, agenda items, related bills, related documents, and continuation
  dates.
- [x] **E2.3** Add calendar entries for chamber floor activity separately from committee events.
- [ ] **E2.4** Import Open States events using a rolling window and retain the upstream deleted state so cancellations do
  not appear as active meetings.
- [ ] **E2.5** Import Congress.gov committee meetings and published hearings, including committees, witnesses, related
  legislation, meeting documents, and transcript references when supplied.
- [ ] **E2.6** Normalize rescheduled, continued, cancelled, deleted, and duplicate event records without fabricating
  missing times or locations.
- [ ] **E2.7** Reconcile event-to-bill and event-to-committee links using stable IDs first and bounded normalized matching
  only when an upstream ID is unavailable.
- [ ] **E2.8** Add rolling refresh workflows whose overlap window captures corrections and late cancellations.
- [ ] **E2.9** Report state event freshness and coverage by jurisdiction; do not treat an empty event response as proof
  that the legislature has no scheduled activity.
- [x] **E2.10** Add query operations for event search, event detail, committee schedules, bill schedules, and available
  chamber calendars.

### Exit gate

Federal committee meetings and published hearings meet the approved coverage contract. Floor schedules are included
only where an approved provider supplies usable records. Supported state events are current within the refresh target,
and unsupported or stale jurisdictions are visible as coverage gaps.

## Phase E3: Roll-call vote intelligence

### Outcome

Researchers can inspect a roll call, its motion and result, individual positions, and its relationship to a bill,
amendment, committee, or chamber.

### Tasks

- [x] **E3.1** Generalize votes so a roll call can relate to a bill, amendment, event, organization, or chamber while
  preserving existing bill vote behavior.
- [x] **E3.2** Add roll-call number, vote type, question, requirement, result, session, organization, and committee or floor
  classification when supplied.
- [x] **E3.3** Extend vote positions with the source-provided member identity and normalized option; derive party totals
  from member terms only when the vote date resolves unambiguously.
- [ ] **E3.4** Retain current Open States bill-vote ingestion and measure totals, member-position, and source-link coverage
  per jurisdiction.
- [ ] **E3.5** Import Congress.gov House roll-call data for its supported range and report Congresses or fields it does
  not supply.
- [ ] **E3.6** Import committee recorded votes only where Open States, Congress.gov, or GovInfo supplies a structured
  record or reliably classified meeting document; report them separately from floor-roll-call coverage.
- [ ] **E3.7** Link votes to bills and amendments using structured references and retain unmatched votes as valid chamber
  activity.
- [x] **E3.8** Validate reported totals against normalized positions and classify proxy, paired, present, absent,
  not-voting, and source-specific options without forcing them into yes or no.
- [x] **E3.9** Add query operations for vote detail, votes by bill, votes by member, votes by organization, and recent
  roll calls.

### Exit gate

Congress.gov-supported House roll calls and Open States-supported state bill votes are queryable with explainable
coverage. Senate roll calls and committee votes remain unsupported or best-effort unless an approved provider adds a
dependable structured representation.

## Phase E4: Amendments and legislative supporting material

### Outcome

Amendments and high-value legislative documents become independently queryable records linked to bills, people,
committees, meetings, actions, and votes where the source provides those relationships.

### Tasks

- [x] **E4.1** Add canonical amendments with chamber, Congress or session, printed identifier, purpose, description,
  status, sponsor, submitted date, related bill, and stable identifiers.
- [x] **E4.2** Add amendment actions, text versions, amended-amendment relationships, and vote relationships without
  flattening amendments into bill documents.
- [ ] **E4.3** Import federal amendments, actions, sponsors, related bills, and available text through Congress.gov.
- [ ] **E4.4** Promote structured state amendment records only where Open States supplies them; otherwise retain Open
  States amendment links as classified bill documents.
- [x] **E4.5** Add supporting-material records for committee reports, committee prints, hearing transcripts, fiscal notes,
  bill analyses, testimony, witness statements, and meeting documents.
- [ ] **E4.6** Import Congress.gov committee reports, hearings, and meeting documents and use GovInfo for available
  official text packages.
- [ ] **E4.7** Retain state fiscal notes, analyses, and supplemental documents from Open States with per-type coverage
  rather than promising uniform availability.
- [ ] **E4.8** Reuse the existing artifact acquisition, extraction, sectioning, lexical search, and embedding pipeline for
  new searchable document types.
- [x] **E4.9** Add quality checks for broken relationships, duplicate documents, missing text, unsupported formats, and
  amendment-to-bill ambiguity.
- [x] **E4.10** Add query operations for amendment search and detail plus supporting-material search and retrieval.

### Exit gate

Federal amendments and supported federal materials meet the approved coverage contract. State materials remain
explicitly source-dependent, with no fabricated amendment entity created from an unstructured link alone.

## Phase E5: Canonical change tracking

### Outcome

The application can answer what changed in the stored legislative data and when it observed that change, without
building provenance, predictions, or AI-generated interpretation.

### Tasks

- [x] **E5.1** Define a bounded change-event contract for create, update, delete, cancel, reschedule, relationship change,
  and document-content change.
- [x] **E5.2** Add current-record fingerprints and minimal before-and-after changed fields; do not copy complete provider
  payloads into a lineage store.
- [x] **E5.3** Emit change events from successful canonical transactions only, with the ingestion run and affected
  canonical identifiers needed for replay and debugging.
- [x] **E5.4** Make change-event identity deterministic so overlap windows, retries, and repeated imports do not duplicate
  events.
- [x] **E5.5** Distinguish an upstream correction from a newly observed legislative event only when the source supplies
  enough information; otherwise classify it as a record update.
- [ ] **E5.6** Link scheduled events to later actions or votes only through explicit relationships or deterministic
  identifiers, not semantic guessing.
- [x] **E5.7** Define retention based on operational and product needs; do not retain fields solely to establish a chain
  of custody.
- [x] **E5.8** Add query operations for changes by canonical record, jurisdiction, committee, person, and observation
  window.
- [ ] **E5.9** Validate replay, correction, cancellation, rescheduling, deletion, and unchanged-import behavior.

### Exit gate

Every emitted change corresponds to a committed canonical mutation, repeated ingestion is silent, and the feature does
not expand into provenance or derived intelligence.

## Phase E6: Expanded MCP research interface

### Outcome

MCP clients can research the new data domains through bounded, source-independent tools after each underlying capability
passes its data-quality gate.

### Tasks

- [ ] **E6.1** Define research scenarios and evaluation cases before selecting tool boundaries.
- [ ] **E6.2** Add person and organization discovery and detail tools after E1.
- [ ] **E6.3** Add meeting, hearing, and calendar discovery and detail tools after E2.
- [ ] **E6.4** Add roll-call discovery and detail tools after E3.
- [ ] **E6.5** Add amendment and supporting-material discovery and retrieval tools after E4.
- [ ] **E6.6** Add recent-change queries after E5 without summaries, predictions, or notification delivery.
- [ ] **E6.7** Keep tool schemas narrow, paginated, and explicit about coverage gaps and unavailable fields.
- [ ] **E6.8** Run contract, authorization, payload, latency, and two-client compatibility tests for every added tool.
- [ ] **E6.9** Run human-reviewed evaluation cases across federal and representative state coverage before declaring a
  domain supported.

### Exit gate

Every new tool is backed by a proven canonical domain, communicates missing coverage honestly, and passes its research
evaluation without depending on a web application or derived intelligence.

## Deferred roadmap

The following require a separate planning decision after E6:

- Derived intelligence, predictions, AI-generated summaries, and semantic conclusions about legislative behavior.
- Research web application and mobile experiences.
- Organization workspaces, saved research, portfolios, and private tenant data.
- Customer alerts, digests, and external notification delivery.
- Production infrastructure, commercial packaging, billing, and launch.
