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

## Phase E1: People, terms, and legislative organizations

### Outcome

Sponsors and voters resolve to useful people records, and committees become stable entities instead of bill-owned name
strings.

### Tasks

- [ ] **E1.5** Import state people and current committee snapshots from Open States with per-jurisdiction coverage.

### Exit gate

Federal people and organizations meet the approved coverage contract. State coverage is reported per jurisdiction;
historical state committee membership is not inferred when Open States supplies only a current snapshot.

## Phase E2: Meetings, hearings, agendas, and calendars

### Outcome

The corpus represents scheduled legislative activity and its relationship to bills, committees, documents, and later
status changes.

### Tasks

- [ ] **E2.4** Import Open States events using a rolling window and retain the upstream deleted state so cancellations do
  not appear as active meetings.
- [ ] **E2.5** Import Congress.gov committee meetings and published hearings, including committees, witnesses, related
  legislation, meeting documents, and transcript references when supplied.
- [ ] **E2.9** Report state event freshness and coverage by jurisdiction; do not treat an empty event response as proof
  that the legislature has no scheduled activity.

### Exit gate

Federal committee meetings and published hearings meet the approved coverage contract. Floor schedules are included
only where an approved provider supplies usable records. Supported state events are current within the refresh target,
and unsupported or stale jurisdictions are visible as coverage gaps.

## Phase E4: Amendments and legislative supporting material

### Outcome

Amendments and high-value legislative documents become independently queryable records linked to bills, people,
committees, meetings, actions, and votes where the source provides those relationships.

### Tasks

- [ ] **E4.3** Import federal amendments, actions, sponsors, related bills, and available text through Congress.gov.
- [ ] **E4.6** Import Congress.gov committee reports, hearings, and meeting documents and use GovInfo for available
  official text packages.
- [ ] **E4.7** Retain state fiscal notes, analyses, and supplemental documents from Open States with per-type coverage
  rather than promising uniform availability.

### Exit gate

Federal amendments and supported federal materials meet the approved coverage contract. State materials remain
explicitly source-dependent, with no fabricated amendment entity created from an unstructured link alone.

## Phase E6: Expanded MCP research interface

### Outcome

MCP clients can research the new data domains through bounded, source-independent tools after each underlying capability
passes its data-quality gate.

### Tasks

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
