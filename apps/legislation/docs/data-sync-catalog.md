# Legislative data synchronization catalog

## Purpose and scope

This is the canonical inventory of data available from Open States, Congress.gov, and GovInfo and the subset normalized
into the legislation database. It is intended to support engineering decisions, capability comparisons, and later
public documentation.

The catalog covers every API resource family exposed by Open States and Congress.gov and every GovInfo collection that
directly describes Congress, legislation, legislative publications, or codified federal law. GovInfo also exposes many
executive, judicial, and general federal-publication collections; those remain discoverable through its dynamic
`/collections` directory but are outside this legislative product boundary.

Provider contracts were checked on 2026-08-18 against the official
[Open States OpenAPI specification](https://v3.openstates.org/openapi.json),
[Congress.gov API v3 OpenAPI specification](https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/openapi.json),
[Congress.gov endpoint documentation](https://github.com/LibraryOfCongress/api.congress.gov/tree/main/Documentation),
[GovInfo API documentation](https://github.com/usgpo/api), and
[BILLSTATUS XML user guide](https://github.com/usgpo/bill-status/blob/main/BILLSTATUS-XML_User_User-Guide.md).
The source contracts describe availability; the checked-in importers and database schema determine the ingestion status.
Federal committee, subcommittee, and membership materialization is pending and may use GovInfo only. State committee,
subcommittee, and membership materialization may use OpenStates only. No other provider is a committee-data fallback.

This catalog inventories provider-defined fields, not merely the fields the product already uses. A row may group a
small set of sibling fields only when they share one source type, ingestion decision, destination, and cadence; each
group names every included field. Provider-defined open-ended objects such as Open States `extras`, GovInfo MODS, and
collection-specific granule metadata cannot be exhaustively enumerated because their keys are publisher-defined. They
are called out explicitly instead of being presented as a stable contract. Standard response envelopes, pagination,
request parameters, and operational rate-limit metadata are documented where they affect synchronization but are not
counted as legislative content fields.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| **Ingested** | The source field is parsed and persisted in a canonical table. |
| **Derived** | A canonical value is deterministically derived from one or more source fields. |
| **Partial** | Only a defined subset or first/last value is persisted. The notes state the boundary. |
| **Parsed, not persisted** | The importer reads the field to make a decision or derive another value but does not store the field itself. |
| **Checkpoint only** | The synchronization layer uses the field for ordering, replay, or progress but does not store it as legislative data. |
| **Artifact only** | The acquired provider bundle or XML is retained in source storage but the field is not normalized. This status is used only where the current path actually retains that source artifact. |
| **Backfill only** | The field is consumed by historical archive or rebuild processing, not recurring freshness sync. |
| **Not ingested** | The provider exposes the field or resource, but no current parser persists it. |
| **Not offered** | The provider does not expose a dependable structured representation. |

Recurring Trigger.dev schedules are reconciled from the registry below. “Cadence” describes the desired production
schedule; the live Trigger.dev project is the source of truth for a schedule's active state.

## Trigger.dev synchronization registry

| Provider | Data domain | Trigger.dev task | Scope | Cadence after activation | Cursor or reconciliation model |
| --- | --- | --- | --- | --- | --- |
| Open States | Bills and bill children | `openstates-bills-sync` | One of 52 jurisdictions per run | Every 30 minutes, phase-shifted by jurisdiction | `updated_since` with overlap; ascending updates; per-jurisdiction watermark |
| Open States | State people, terms, committees, memberships | `openstates-entities-sync` | One jurisdiction per run | Daily, staggered from 05:00 UTC in two-minute steps | Complete current snapshot; promote only after every page succeeds |
| Open States | Events, agendas, documents, participants | `openstates-events-sync` | One jurisdiction, previous 30 through next 90 days | Every 2 hours, phase-shifted by jurisdiction | Rolling-window reconciliation; absence alone is not deletion |
| Congress.gov | Bills and bill children | `congress-wave-child` | Federal update feed | Hourly wave | `updateDate` watermark with one-hour overlap |
| Congress.gov | Amendments, actions, sponsors, text | `congress-wave-child` | Configured current Congress | Hourly wave | Offset checkpoint per Congress |
| Congress.gov | Meetings and published hearings | `congress-wave-child` | Configured current Congress | Hourly wave | Independent meeting and hearing offsets per Congress |
| Congress.gov | House roll calls and member positions | `congress-wave-child` | Both sessions of configured current Congress | Hourly wave | Offset checkpoint per Congress and session |
| Congress.gov | Committee reports and text formats, not committee organization or membership data | `congress-wave-child` | Configured current Congress | Hourly wave | Offset checkpoint per Congress |
| Congress.gov | Members and terms | `congress-wave-child` | Configured current Congress | Hourly wave | Complete current snapshot |
| GovInfo | Current-Congress BILLSTATUS XML | `govinfo-bill-status-sync` | Configured Congress and bill-type policy | Daily at 11:45 UTC | Collections API `lastModified` window with 24-hour replay; XML payload from bulk repository |
| GovInfo | Federal committees, subcommittees, memberships | Pending; no task | Current federal catalog | Not scheduled | GovInfo is the sole approved federal committee-data source. Do not materialize or replace a cohort until a complete canonical ingestion is implemented and validated. |
| Open States, GovInfo, and Congress.gov non-committee domains | Historical rebuild | `legislation-backfill` | Explicit rebuild ID and bounded historical ranges | Manual only | Existing archive, package, and domain checkpoints; deterministic child idempotency keys |

The manifest creates 163 desired recurring schedules: 156 Open States jurisdiction schedules, six Congress.gov
schedules, and one GovInfo schedule. The exact phase formulas and concurrency controls remain in the
[Trigger.dev orchestration design](trigger-orchestration-design.md).

## Open States

### Resource and endpoint coverage

Open States partitions records by jurisdiction. The product policy covers the 50 states, District of Columbia, and
Puerto Rico. The API may expose municipal jurisdictions, but they are not part of the configured schedule manifest.

| Resource | Official endpoints or export | Available data | Current ingestion | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| Jurisdictions | `/jurisdictions`, `/jurisdictions/{id}` | Jurisdiction metadata, chambers, sessions, update times, exports, run plans | Partial. Canonical jurisdiction and session identity are created from bill/entity context; the jurisdiction endpoint is not synchronized directly. | No recurring task; historical sessions are consumed by `legislation-backfill`. |
| People | `/people`, `/people.geo` | Identity, names, party, current role, contact/demographic fields, identifiers, offices, links | Partial. `/people` current snapshots are ingested; geographic lookup and contact/demographic fields are not. | `openstates-entities-sync`, daily per jurisdiction. |
| Committees | `/committees`, `/committees/{id}` | Committee hierarchy, classifications, memberships, alternate names, links, extras | Partial. Core committee hierarchy and current memberships are ingested. | `openstates-entities-sync`, daily per jurisdiction. |
| Bills | `/bills`, `/bills/ocd-bill/{id}`, `/bills/{jurisdiction}/{session}/{id}` | Bills, abstracts, actions, sponsors, versions, documents, votes, relations, subjects, sources | Ingested for configured jurisdictions; untyped `extras` and several alternate-name/identifier fields are not normalized. | `openstates-bills-sync`, every 30 minutes per jurisdiction. Historical session JSON uses `legislation-backfill`. |
| Events | `/events`, `/events/{id}` | Meetings, status, times, locations, media, documents, participants, agenda, related entities | Partial. Core events, documents, participants, and agenda rows are ingested; media and agenda related entities are not. | `openstates-events-sync`, every 2 hours per jurisdiction. |
| Metrics | `/metrics` | Service/provider metrics | Not ingested. Operational health uses application and provider request telemetry instead. | None. |

### Open States field catalog

The paths below use Open States API v3 JSON names. Array children are written with `[]`.

| Resource | Source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- | --- |
| Jurisdiction | `id` | string | Partial | Used to scope requests; canonical `jurisdictions.id` is derived from the configured code. | No direct recurring task. |
| Jurisdiction | `name` | string | Partial | `jurisdictions.name` when available from context. | No direct recurring task. |
| Jurisdiction | `classification` | enum | Derived | `jurisdictions.classification` from configured state, district, or territory code. | No direct recurring task. |
| Jurisdiction | `division_id` | string | Not ingested | Available provider identifier. | No direct recurring task. |
| Jurisdiction | `url` | string URL | Not ingested | Provider jurisdiction page is not currently stored. | No direct recurring task. |
| Jurisdiction | `latest_bill_update` | date-time string | Not ingested | Could support cheap freshness checks. | No direct recurring task. |
| Jurisdiction | `latest_people_update` | date-time string | Not ingested | Could support entity-snapshot freshness checks. | No direct recurring task. |
| Jurisdiction | `organizations[]` | `Chamber[]` | Partial | Chambers are derived as canonical organizations from observed records. | No direct recurring task. |
| Jurisdiction | `legislative_sessions[]` | `LegislativeSession[]` | Backfill only | Session identity is loaded from historical manifests and bill context. | `legislation-backfill`, manual. |
| Jurisdiction | `latest_runs[]` | `RunPlan[]` | Not ingested | Open States scraper-run metadata is not stored. | None. |
| Session | `identifier` | string | Ingested | `legislative_sessions.identifier`. | `openstates-bills-sync`; backfill also loads it. |
| Session | `name` | string | Partial | `legislative_sessions.name`, falling back to identifier. | `openstates-bills-sync`; manual backfill. |
| Session | `classification` | string | Not ingested | Regular/special classification is available but not persisted. | None. |
| Session | `start_date` | date string | Backfill only | `legislative_sessions.start_date` when archive metadata supplies it. | `legislation-backfill`, manual. |
| Session | `end_date` | date string | Backfill only | `legislative_sessions.end_date` when archive metadata supplies it. | `legislation-backfill`, manual. |
| Session | `downloads[]` | `DataExport[]` | Backfill only | Archive discovery/manifest input, not a canonical table. | `legislation-backfill`, manual. |
| Person | `id` | string | Ingested | `people.source_id`, `people.upstream_ids.openstates`, canonical `people.id`. | `openstates-entities-sync`, daily; also bill references. |
| Person | `name` | string | Ingested | `people.name`. | `openstates-entities-sync`, daily. |
| Person | `party` | string | Ingested | `people.party`; also copied to the current term. | `openstates-entities-sync`, daily. |
| Person | `current_role.title` | string | Ingested | `legislative_terms.role`. | `openstates-entities-sync`, daily. |
| Person | `current_role.org_classification` | enum | Ingested | `legislative_terms.chamber`. | `openstates-entities-sync`, daily. |
| Person | `current_role.district` | string or integer | Ingested | `legislative_terms.district`. | `openstates-entities-sync`, daily. |
| Person | `current_role.division_id` | string | Partial | Used in deterministic term/source identity; not stored separately. | `openstates-entities-sync`, daily. |
| Person | `jurisdiction` | `CompactJurisdiction` | Partial | Request scope determines `people.jurisdiction_id`; embedded object is not copied. | `openstates-entities-sync`, daily. |
| Person | `given_name` | string | Ingested | `people.given_name`. | `openstates-entities-sync`, daily. |
| Person | `family_name` | string | Ingested | `people.family_name`. | `openstates-entities-sync`, daily. |
| Person | `image` | string URL | Not ingested | Available for a future profile surface. | None. |
| Person | `email` | string | Not ingested | Contact data is intentionally outside the current canonical model. | None. |
| Person | `gender` | string | Not ingested | Demographic field is not stored. | None. |
| Person | `birth_date` | date string | Not ingested | Demographic field is not stored. | None. |
| Person | `death_date` | date string | Not ingested | Demographic field is not stored. | None. |
| Person | `extras` | object | Not ingested | Accepted by the source contract but not persisted by recurring synchronization. | `openstates-entities-sync`, daily. |
| Person | `created_at` | date-time string | Not ingested | Provider creation time is not normalized. | `openstates-entities-sync`, daily. |
| Person | `updated_at` | date-time string | Ingested | `people.source_updated_at`. | `openstates-entities-sync`, daily. |
| Person | `openstates_url` | string URL | Ingested | Fallback for `people.source_url`. | `openstates-entities-sync`, daily. |
| Person | `other_identifiers[]` | `AltIdentifier[]` | Not ingested | Only the stable Open States ID is normalized today. | `openstates-entities-sync`, daily. |
| Person | `other_names[]` | `AltName[]` | Not ingested | Alternate person names are not modeled. | `openstates-entities-sync`, daily. |
| Person | `links[]` | `Link[]` | Not ingested | General links are not normalized. | `openstates-entities-sync`, daily. |
| Person | `sources[].url` | string URL | Ingested | First URL becomes `people.source_url`. | `openstates-entities-sync`, daily. |
| Person | `offices[]` | `Office[]` | Not ingested | Office `name`, `fax`, `voice`, `address`, and `classification` are not modeled. | `openstates-entities-sync`, daily. |
| Committee | `id` | string | Ingested | `organizations.source_id`, `upstream_ids.openstates`, canonical ID. | `openstates-entities-sync`, daily. |
| Committee | `name` | string | Ingested | `organizations.name`. | `openstates-entities-sync`, daily. |
| Committee | `classification` | enum | Ingested | `organizations.classification` normalized to committee/subcommittee. | `openstates-entities-sync`, daily. |
| Committee | `parent_id` | string | Partial | Retained as `upstream_ids.openstatesParent`; canonical parent linking is not yet completed. | `openstates-entities-sync`, daily. |
| Committee | `extras` | object | Not ingested | Accepted by the source contract but not persisted by recurring synchronization. | `openstates-entities-sync`, daily. |
| Committee | `memberships[].person.id` | string | Ingested | Canonical `people.id` and `organization_memberships.person_id`. | `openstates-entities-sync`, daily. |
| Committee | `memberships[].person.name` | string | Ingested | `people.name`. | `openstates-entities-sync`, daily. |
| Committee | `memberships[].person.party` | string | Ingested | `people.party`. | `openstates-entities-sync`, daily. |
| Committee | `memberships[].person.current_role` | `CurrentRole` | Ingested | Current legislative term as described above. | `openstates-entities-sync`, daily. |
| Committee | `memberships[].person_name` | string | Partial | Parsed but embedded person name is authoritative when supplied. | `openstates-entities-sync`, daily. |
| Committee | `memberships[].role` | string | Ingested | Membership `title` and `classification`; participates in source identity. | `openstates-entities-sync`, daily. |
| Committee | `other_names[]` | `AltName[]` | Not ingested | Committee aliases are not modeled. | `openstates-entities-sync`, daily. |
| Committee | `links[]` | `Link[]` | Not ingested | General links are not normalized. | `openstates-entities-sync`, daily. |
| Committee | `sources[].url` | string URL | Ingested | First URL becomes `organizations.source_url`. | `openstates-entities-sync`, daily. |
| Bill | `id` or `_id` | string | Ingested | `bills.upstream_ids.openstates`; canonical ID is jurisdiction/session/identifier based. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `session` or `legislative_session` | string | Ingested | `bills.session_id` and `legislative_sessions.identifier`. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `jurisdiction` | `CompactJurisdiction` | Partial | Scheduled jurisdiction supplies `bills.jurisdiction_id`; embedded object is not copied. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `from_organization` | organization or string ID | Derived | Chamber plus bill-organization origin link when an ID is available. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `identifier` | string | Ingested | `bills.identifier`; bill type and number are parsed into canonical identity. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `title` | string | Ingested | `bills.title`. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `classification[]` | string array | Ingested | `bills.classification`. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `subject[]` | string array | Ingested | `bills.subjects`. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `extras` | object | Not ingested | Not persisted by recurring synchronization; historical archives may retain it. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `created_at` | date-time string | Not ingested | Not normalized. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `updated_at` | date-time string | Ingested | `bills.source_updated_at` and sync ordering. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `openstates_url` | string URL | Ingested | Fallback for `bills.source_url`. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `first_action_date` | date string | Not ingested | Canonical timeline uses action rows instead. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `latest_action_date` | date string | Not ingested | Canonical timeline uses action rows instead. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `latest_action_description` | string | Not ingested | Canonical timeline uses action rows instead. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `latest_passage_date` | date string | Not ingested | Passage is represented through classified actions/votes. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `abstracts[].abstract` | string | Partial | First abstract becomes `bills.summary`. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `abstracts[].note` or `date` | string | Not ingested | Abstract metadata is not modeled. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `other_titles[]` | `BillTitle[]` | Not ingested | Alternate titles are not modeled. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `other_identifiers[]` | `BillIdentifier[]` | Not ingested | Alternate printed identifiers are not modeled. | `openstates-bills-sync`, every 30 minutes. |
| Bill | `sources[].url` | string URL | Ingested | First URL becomes `bills.source_url`. | `openstates-bills-sync`, every 30 minutes. |
| Sponsorship | `id` | string | Not ingested | Canonical sponsor ID is derived from bill and person/name identity. | `openstates-bills-sync`, every 30 minutes. |
| Sponsorship | `name` | string | Ingested | `bill_sponsors.name`. | `openstates-bills-sync`, every 30 minutes. |
| Sponsorship | `entity_type` | string | Parsed, not persisted | Person-vs-organization classification is not stored on sponsor row. | `openstates-bills-sync`, every 30 minutes. |
| Sponsorship | `organization` | organization | Not ingested | Organization sponsorship is not canonicalized. | `openstates-bills-sync`, every 30 minutes. |
| Sponsorship | `person.id` or `person_id` | string | Ingested | `bill_sponsors.person_id` and minimal person record. | `openstates-bills-sync`, every 30 minutes. |
| Sponsorship | `primary` | boolean | Ingested | `bill_sponsors.is_primary`; also informs fallback classification. | `openstates-bills-sync`, every 30 minutes. |
| Sponsorship | `classification` | string | Ingested | `bill_sponsors.classification`. | `openstates-bills-sync`, every 30 minutes. |
| Action | `id` | string | Not ingested | Canonical action ID is deterministic from order/date/text. | `openstates-bills-sync`, every 30 minutes. |
| Action | `organization` or `organization_id` | object or string | Partial | Canonical organization link, source organization ID, and chamber. | `openstates-bills-sync`, every 30 minutes. |
| Action | `description` | string | Ingested | `bill_actions.description`. | `openstates-bills-sync`, every 30 minutes. |
| Action | `date` | date or fuzzy string | Partial | Exact dates become `bill_actions.action_date`; fuzzy values are reported, not fabricated. | `openstates-bills-sync`, every 30 minutes. |
| Action | `classification[]` | string array | Ingested | `bill_actions.classification`. | `openstates-bills-sync`, every 30 minutes. |
| Action | `order` | integer | Ingested | `bill_actions.ordinal`. | `openstates-bills-sync`, every 30 minutes. |
| Action | `related_entities[]` | `BillActionRelatedEntity[]` | Not ingested | Structured action targets are not currently normalized. | `openstates-bills-sync`, every 30 minutes. |
| Related bill | `identifier` | string | Ingested | Resolves canonical `bill_relations.related_bill_id`. | `openstates-bills-sync`, every 30 minutes. |
| Related bill | `legislative_session` | string | Ingested | Part of related canonical bill identity. | `openstates-bills-sync`, every 30 minutes. |
| Related bill | `relation_type` | string | Ingested | Normalized companion, prior-session, replacement, replaced-by, or related classification. | `openstates-bills-sync`, every 30 minutes. |
| Version/document | `id` | string | Not ingested | Canonical document ID derives from bill, collection, and URL. | `openstates-bills-sync`, every 30 minutes. |
| Version/document | `note` | string | Partial | Used as title and classification signal. | `openstates-bills-sync`, every 30 minutes. |
| Version/document | `date` | date string | Ingested | `bill_documents.document_date` when exact. | `openstates-bills-sync`, every 30 minutes. |
| Version/document | `classification` | string | Ingested/derived | Version code or material classification. | `openstates-bills-sync`, every 30 minutes. |
| Version/document | `links[].url` | string URL | Ingested | `bill_documents.source_url`; one row per unique URL. | `openstates-bills-sync`, every 30 minutes. |
| Version/document | `links[].media_type` | string | Ingested | `bill_documents.content_type`; later verified against artifact signature. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `id` | string | Ingested | `votes.source_id`; preferred canonical vote identity input. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `motion_text` or `motion` | string | Ingested | `votes.motion`. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `motion_classification[]` or `classification[]` | string array | Partial | First value becomes canonical classification; joined values become vote type. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `start_date` | date-time string | Partial | ISO timestamps become `votes.held_at`. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `result` | string | Ingested | `votes.result`. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `identifier` | string | Ingested | `votes.roll_call_number` and fallback identity. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `extras` | object | Not ingested | Not normalized. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `organization` or `organization_id` | object or string | Partial | `votes.organization_id` and chamber. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `counts[].option` | string | Ingested/derived | Normalized into yes, no, or other count buckets. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `counts[].value` | integer | Ingested | Aggregated into `votes.yes_count`, `no_count`, and `other_count`. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `votes[].option` | string | Ingested | Normalized `vote_positions.option`. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `votes[].voter.id` or `voter_id` | string | Ingested | `vote_positions.source_person_id`, canonical person link. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `votes[].voter_name` | string | Ingested | `vote_positions.source_name`; name-based identity fallback when no ID exists. | `openstates-bills-sync`, every 30 minutes. |
| Vote | `sources[].url` | string URL | Ingested | First URL becomes `votes.source_url`. | `openstates-bills-sync`, every 30 minutes. |
| Event | `id` | string | Ingested | `legislative_events.source_id`, upstream ID, canonical ID. | `openstates-events-sync`, every 2 hours. |
| Event | `name` | string | Ingested | `legislative_events.name`. | `openstates-events-sync`, every 2 hours. |
| Event | `jurisdiction` | `CompactJurisdiction` | Partial | Scheduled scope supplies `jurisdiction_id`. | `openstates-events-sync`, every 2 hours. |
| Event | `description` | string | Ingested | `legislative_events.description`. | `openstates-events-sync`, every 2 hours. |
| Event | `classification` | string | Ingested | `legislative_events.classification`. | `openstates-events-sync`, every 2 hours. |
| Event | `start_date` | date-time string | Ingested | `legislative_events.start_at`. | `openstates-events-sync`, every 2 hours. |
| Event | `end_date` | date-time string | Ingested | `legislative_events.end_at`. | `openstates-events-sync`, every 2 hours. |
| Event | `all_day` | boolean | Ingested | `legislative_events.all_day`. | `openstates-events-sync`, every 2 hours. |
| Event | `status` | string | Ingested | Canonical event status, including canceled-to-cancelled normalization. | `openstates-events-sync`, every 2 hours. |
| Event | `upstream_id` | string | Ingested | `legislative_events.upstream_ids.provider`. | `openstates-events-sync`, every 2 hours. |
| Event | `deleted` | boolean | Ingested | `legislative_events.is_deleted`; forces canonical status `deleted`. | `openstates-events-sync`, every 2 hours. |
| Event | `location.name` | string | Ingested | Retained inside `legislative_events.location` JSON. | `openstates-events-sync`, every 2 hours. |
| Event | `location.url` | string URL | Ingested | Location JSON and `virtual_access.url`. | `openstates-events-sync`, every 2 hours. |
| Event | `links[]` | `Link[]` | Not ingested | General event links are not normalized. | `openstates-events-sync`, every 2 hours. |
| Event | `sources[].url` | string URL | Ingested | First URL becomes `legislative_events.source_url`. | `openstates-events-sync`, every 2 hours. |
| Event | `media[]` | `EventMedia[]` | Not ingested | Media note/date/offset/classification/links are not modeled. | `openstates-events-sync`, every 2 hours. |
| Event document | `note` | string | Ingested | Document title fallback. | `openstates-events-sync`, every 2 hours. |
| Event document | `date` | date string | Ingested | `event_documents.document_date` when exact. | `openstates-events-sync`, every 2 hours. |
| Event document | `classification` | string | Ingested | `event_documents.classification`. | `openstates-events-sync`, every 2 hours. |
| Event document | `links[].url` | string URL | Ingested | `event_documents.source_url`; deduplicated by URL. | `openstates-events-sync`, every 2 hours. |
| Event document | `links[].media_type` | string | Ingested | `event_documents.content_type`. | `openstates-events-sync`, every 2 hours. |
| Event participant | `note` | string | Ingested | Preferred participant role. | `openstates-events-sync`, every 2 hours. |
| Event participant | `name` | string | Ingested | `event_participants.name`. | `openstates-events-sync`, every 2 hours. |
| Event participant | `entity_type` | string | Partial | Role fallback; provider entity kind is not separately stored. | `openstates-events-sync`, every 2 hours. |
| Event participant | `organization` | organization | Not ingested | Participant organization is not linked today. | `openstates-events-sync`, every 2 hours. |
| Event participant | `person` | `CompactPerson` | Not ingested | Participant person is not linked today. | `openstates-events-sync`, every 2 hours. |
| Agenda | `description` | string | Ingested | `event_agenda_items.description`. | `openstates-events-sync`, every 2 hours. |
| Agenda | `classification[]` | string array | Partial | First value becomes `event_agenda_items.classification`. | `openstates-events-sync`, every 2 hours. |
| Agenda | `order` | integer | Ingested | `event_agenda_items.ordinal`. | `openstates-events-sync`, every 2 hours. |
| Agenda | `subjects[]` | string array | Not ingested | Not modeled. | `openstates-events-sync`, every 2 hours. |
| Agenda | `notes[]` | string array | Not ingested | Not modeled. | `openstates-events-sync`, every 2 hours. |
| Agenda | `extras` | object | Not ingested | Not modeled. | `openstates-events-sync`, every 2 hours. |
| Agenda | `related_entities[]` | `EventRelatedEntity[]` | Not ingested | Bill/committee agenda links are not yet normalized. | `openstates-events-sync`, every 2 hours. |
| Agenda | `media[]` | `EventMedia[]` | Not ingested | Agenda media is not modeled. | `openstates-events-sync`, every 2 hours. |

## Congress.gov

Congress.gov API v3 currently documents 108 endpoint paths across 20 resource families. The recurring jobs use the
configured current Congress for every domain except the global bill update feed. Bounded historical ranges remain
available through `legislation-backfill` and CLI services.

### Complete Congress.gov endpoint-family coverage

| API family | Official endpoint groups | Available data | Current ingestion | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| Bills and laws | `/bill` list/detail; bill actions, amendments, committees, cosponsors, related bills, subjects, summaries, text, titles; `/law` list/detail | Full legislative measure metadata and public/private laws | Bills and eight child collections are ingested. Bill-amendments, alternate titles, CBO costs, law detail, and some detail-only fields are not. | `congress-wave-child`, hourly. |
| Amendments | `/amendment` list/detail; actions, cosponsors, amended amendments, text | Amendment identity, purpose, status, sponsors, relationships, actions, text versions | Partial. Detail, actions, first sponsor, amended bill, and text are ingested; cosponsors and amended-amendment links are not. | `congress-wave-child`, hourly. |
| Standalone summaries | `/summaries` by Congress/type | Bill summary stream | Summary text is ingested through each bill’s summaries subresource, not this standalone feed. | `congress-wave-child`, hourly. |
| Congresses | `/congress`, `/congress/{number}`, `/congress/current` | Congress names, years, sessions | Partial. Session identity derives from bill/entity context; official Congress/session dates are not directly synchronized. | No independent task. |
| Members | `/member` list/detail and filters; sponsored/cosponsored legislation | Member identity, names, party, state, district, terms, leadership, party history, depiction, sponsorship | Partial current-Congress snapshot. Core identity, party, district, and terms are ingested. | `congress-wave-child`, hourly. |
| House votes | `/house-vote` list/detail/members | House roll-call metadata, related legislation, result, question, vote type, notes, member positions | Ingested for both sessions of the configured Congress. Non-legislation votes remain valid chamber activity. | `congress-wave-child`, hourly. |
| Committees | `/committee` list/detail and committee bills/reports/nominations/communications | Committee hierarchy, history, current state, related legislative work | Not ingested for federal committee materialization. GovInfo is the sole approved federal committee-data source. | No task. |
| Committee reports | `/committee-report` list/detail/text | Report identity, citation, committees, related bills, issue date, text formats | Ingested as supporting materials. Committee references do not create or link canonical organizations. | `congress-wave-child`, hourly. |
| Committee prints | `/committee-print` list/detail/text | Print identity, committees, related bills, text | Not ingested. | No task. |
| Committee meetings | `/committee-meeting` list/detail | Schedule, status, committees, location, related bills, documents, video, witnesses | Ingested as events for configured current Congress. Committee references do not create or update canonical organizations. | `congress-wave-child`, hourly. |
| Hearings | `/hearing` list/detail | Published hearing identity, dates, committees, citation, transcript formats, associated meeting | Partial. Core published hearing and available transcript formats are ingested. | `congress-wave-child`, hourly. |
| Congressional Record | `/congressional-record` | Congressional Record issues | Not ingested. | No task. |
| Daily Congressional Record | `/daily-congressional-record` list/issue/articles | Daily issues, sections, articles, full issue formats | Not ingested. | No task. |
| Bound Congressional Record | `/bound-congressional-record` by year/month/day | Bound edition volumes, dates, sections and content links | Not ingested. | No task. |
| House communications | `/house-communication` list/detail | Executive and other communications, committees, authorities, requirements | Not ingested. | No task. |
| House requirements | `/house-requirement` detail/matching communications | Statutory reporting requirements and matching communications | Not ingested. | No task. |
| Senate communications | `/senate-communication` list/detail | Senate executive and petition/memorial communications and committees | Not ingested. | No task. |
| Nominations | `/nomination` list/detail/nominee/actions/committees/hearings | Presidential nominations, nominees, positions, actions, committees, hearings | Not ingested. | No task. |
| CRS reports | `/crsreport` list/detail | CRS report title, summary, authors, topics, versions, formats, related material | Not ingested. | No task. |
| Treaties | `/treaty` list/detail/actions/committees | Treaty identity, countries, topics, transmittal, resolution text, actions and committees | Not ingested. | No task. |

### Congress.gov bill field catalog

| Source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| List `congress` | integer | Ingested | Canonical federal bill and session identity. | `congress-wave-child`, hourly. |
| List `type` | string | Ingested/derived | Printed identifier, classification, chamber-independent canonical ID. | `congress-wave-child`, hourly. |
| List `number` | string | Ingested | Printed identifier and canonical ID. | `congress-wave-child`, hourly. |
| List `updateDate` | date-time string | Ingested | Ordering/checkpoint input and `bills.source_updated_at`. | `congress-wave-child`, hourly. |
| List `url` | string URL | Ingested | Detail retrieval and fallback `bills.source_url`. | `congress-wave-child`, hourly. |
| Detail `title` | string | Ingested | `bills.title`. | `congress-wave-child`, hourly. |
| Detail `introducedDate` | date string | Ingested | `bills.introduced_at`. | `congress-wave-child`, hourly. |
| Detail `originChamber` | string | Ingested/derived | Normalized `bills.chamber`. | `congress-wave-child`, hourly. |
| Detail `originChamberCode` | string | Artifact only | Human chamber name drives normalization. | `congress-wave-child`, hourly. |
| Detail `policyArea.name` | string | Ingested | Appended to `bills.subjects`. | `congress-wave-child`, hourly. |
| Detail `latestAction` | object | Artifact only | Complete action subresource is authoritative for canonical timeline. | `congress-wave-child`, hourly. |
| Detail `constitutionalAuthorityStatementText` | string | Artifact only | Available but not modeled. | `congress-wave-child`, hourly. |
| Detail `updateDateIncludingText` | date-time string | Artifact only | Text-version records and document hashes drive document refresh. | `congress-wave-child`, hourly. |
| Detail `laws[]` | law reference array | Artifact only | Public/private law relationship is not modeled. | `congress-wave-child`, hourly. |
| Detail `cboCostEstimates[]` | `cboCost[]` | Artifact only | CBO cost estimate metadata is not modeled. | `congress-wave-child`, hourly. |
| Detail `committeeReports[]` | committee report references | Artifact only | Reports arrive through their independent report job. | `congress-wave-child`, hourly. |
| Actions `[].actionDate` | date string | Ingested | `bill_actions.action_date`. | `congress-wave-child`, hourly. |
| Actions `[].actionTime` | time string | Partial | Used in deterministic action identity; not persisted separately. | `congress-wave-child`, hourly. |
| Actions `[].text` | string | Ingested | `bill_actions.description`. | `congress-wave-child`, hourly. |
| Actions `[].actionCode` | string | Artifact only | Not persisted for bills. | `congress-wave-child`, hourly. |
| Actions `[].type` | string | Artifact only | Bill action classification is not currently populated from Congress.gov. | `congress-wave-child`, hourly. |
| Actions `[].sourceSystem` | object | Artifact only | Provider-system metadata is not modeled. | `congress-wave-child`, hourly. |
| Committees `[].name` | string | Ingested | Bill-scoped relationship metadata only; does not materialize or update a canonical committee organization. | `congress-wave-child`, hourly. |
| Committees `[].systemCode` | string | Ingested | Canonical bill-to-organization relationship ID only; does not materialize or update a canonical committee organization. | `congress-wave-child`, hourly. |
| Sponsors `[].bioguideId` | string | Ingested | `bill_sponsors.person_id`, `people.source_id`. | `congress-wave-child`, hourly. |
| Sponsors `[].fullName` | string | Ingested | `bill_sponsors.name`, minimal `people.name`. | `congress-wave-child`, hourly. |
| Cosponsors `[].bioguideId` | string | Ingested | `bill_sponsors.person_id`, `people.source_id`. | `congress-wave-child`, hourly. |
| Cosponsors `[].fullName` | string | Ingested | `bill_sponsors.name`, minimal `people.name`. | `congress-wave-child`, hourly. |
| Cosponsor sponsorship date and withdrawal fields | date/string | Artifact only | Current normalizer retains identity/name only. | `congress-wave-child`, hourly. |
| Related bills `[].congress` | integer | Ingested | Related canonical bill ID. | `congress-wave-child`, hourly. |
| Related bills `[].type` | string | Ingested | Related canonical bill ID. | `congress-wave-child`, hourly. |
| Related bills `[].number` | string or integer | Ingested | Related canonical bill ID. | `congress-wave-child`, hourly. |
| Related bills `[].relationshipDetails` | string or object array | Partial | Normalized to companion or related. | `congress-wave-child`, hourly. |
| Subjects `[].name` | string | Ingested | `bills.subjects`. | `congress-wave-child`, hourly. |
| Summaries `[].text` | string | Partial | Latest returned summary becomes `bills.summary`. | `congress-wave-child`, hourly. |
| Summary `actionDate`, `actionDesc`, `updateDate`, `versionCode` | strings | Artifact only | Summary provenance/version metadata is not modeled. | `congress-wave-child`, hourly. |
| Text versions `[].date` | date string | Ingested | `bill_documents.document_date`. | `congress-wave-child`, hourly. |
| Text versions `[].type` | string | Ingested | Document `title` and `version_code`. | `congress-wave-child`, hourly. |
| Text versions `[].formats[].type` | string | Ingested | `bill_documents.content_type` as supplied, later signature-checked. | `congress-wave-child`, hourly. |
| Text versions `[].formats[].url` | string URL | Ingested | `bill_documents.source_url`; downstream artifact processing. | `congress-wave-child`, hourly. |
| Titles `[].title` and `titleType` | strings | Not ingested | `/titles` is not requested; detail title only. | No separate task. |
| Bill amendments subresource | amendment references | Not ingested | Amendment job independently loads the current Congress. | `congress-wave-child`, hourly. |
| Law detail `lawType`, `lawNumber`, dates, and relationship | strings/integers | Not ingested | `/law` endpoints are not synchronized. | No task. |

### Congress.gov amendment field catalog

| Source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| `congress` | integer | Ingested | `amendments.session_id`, jurisdiction, canonical identity. | `congress-wave-child`, hourly. |
| `type` | string | Ingested | `amendments.amendment_type`, printed ID, canonical identity. | `congress-wave-child`, hourly. |
| `number` | string | Ingested | `amendments.amendment_number`, printed ID, canonical identity. | `congress-wave-child`, hourly. |
| `chamber` | string | Ingested/derived | Normalized `amendments.chamber`. | `congress-wave-child`, hourly. |
| `description` | string | Ingested | `amendments.description`. | `congress-wave-child`, hourly. |
| `purpose` | string | Ingested | `amendments.purpose`. | `congress-wave-child`, hourly. |
| `submittedDate` | date string | Ingested | `amendments.submitted_date`. | `congress-wave-child`, hourly. |
| `updateDate` | date-time string | Ingested | `amendments.source_updated_at`. | `congress-wave-child`, hourly. |
| `url` | string URL | Ingested | Retrieval and `amendments.source_url`. | `congress-wave-child`, hourly. |
| `latestAction.text` | string | Partial/derived | Derives agreed, failed, or withdrawn status. | `congress-wave-child`, hourly. |
| `amendedBill.congress` | integer | Ingested | Related canonical `bill_id`. | `congress-wave-child`, hourly. |
| `amendedBill.type` | string | Ingested | Related canonical `bill_id`. | `congress-wave-child`, hourly. |
| `amendedBill.number` | string | Ingested | Related canonical `bill_id`. | `congress-wave-child`, hourly. |
| `sponsors[0].bioguideId` | string | Partial | First sponsor becomes `sponsor_person_id` and `sponsor_source_id`. | `congress-wave-child`, hourly. |
| `sponsors[0].fullName` | string | Partial | First sponsor becomes `sponsor_name`. | `congress-wave-child`, hourly. |
| Additional sponsors/cosponsors | arrays | Not ingested | Cosponsor subresource is not requested. | No separate task. |
| Actions `[].actionCode` | string | Partial | Used in deterministic action ID and description fallback. | `congress-wave-child`, hourly. |
| Actions `[].actionDate` | date string | Ingested | `amendment_actions.action_date`. | `congress-wave-child`, hourly. |
| Actions `[].actionTime` | time string | Artifact only | Not stored separately. | `congress-wave-child`, hourly. |
| Actions `[].text` | string | Ingested | Preferred `amendment_actions.description`. | `congress-wave-child`, hourly. |
| Actions `[].type` | string | Ingested | Single normalized action classification. | `congress-wave-child`, hourly. |
| Text `[].date` | date string | Ingested | `supporting_materials.document_date`. | `congress-wave-child`, hourly. |
| Text `[].type` | string | Ingested | Supporting-material title. | `congress-wave-child`, hourly. |
| Text `[].formats[].type` | string | Ingested | Normalized PDF, HTML, or text content type. | `congress-wave-child`, hourly. |
| Text `[].formats[].url` | string URL | Ingested | Supporting-material source and downstream document processing. | `congress-wave-child`, hourly. |
| Amended amendments subresource | amendment references | Not ingested | Amendment-to-amendment relationships are not modeled. | No task. |

### Congress.gov member field catalog

| Resource and source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| Member `bioguideId` | string | Ingested | Canonical ID, `people.source_id`, `upstream_ids.bioguide`. | `congress-wave-child`, hourly. |
| Member `name` | string | Ingested | `people.name`. | `congress-wave-child`, hourly. |
| Member `firstName`, `lastName`, `directOrderName`, `invertedOrderName`, `honorificName` | strings | Partial | List `name` is persisted; component/order variants are not. | `congress-wave-child`, hourly. |
| Member `partyName` | string | Ingested | `people.party` and term party. | `congress-wave-child`, hourly. |
| Member `state` | string | Artifact only | Federal jurisdiction is canonical; state is not stored on person/term. | `congress-wave-child`, hourly. |
| Member `district` | string or integer | Ingested | `legislative_terms.district`. | `congress-wave-child`, hourly. |
| Member `updateDate` | date-time string | Ingested | `people.source_updated_at`. | `congress-wave-child`, hourly. |
| Member `url` | string URL | Ingested | `people.source_url` and term source URL. | `congress-wave-child`, hourly. |
| Member `terms.item[].chamber` | string | Ingested | `legislative_terms.chamber` and role. | `congress-wave-child`, hourly. |
| Member `terms.item[].startYear` | integer | Partial | Used in deterministic term identity; no exact start date is fabricated. | `congress-wave-child`, hourly. |
| Member `terms.item[].endYear` | integer | Partial | Used in identity and active-state calculation; no exact end date is fabricated. | `congress-wave-child`, hourly. |
| Member `birthYear` | string | Not ingested | Demographic field is outside current model. | No task. |
| Member `depiction` | object | Not ingested | Image/attribution fields are available but not stored. | No task. |
| Member `leadership[]` | array | Not ingested | Leadership roles are not modeled. | No task. |
| Member `partyHistory[]` | array | Not ingested | Historical party changes are not modeled. | No task. |
| Member `sponsoredLegislation`, `cosponsoredLegislation` | count/link objects | Not ingested | Bill sponsor relations provide the current product link. | No task. |
| Committee `systemCode` | string | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `name` | string | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `chamber` | string | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `committeeTypeCode` or `type` | string | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `updateDate` | date-time string | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `url` | string URL | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `subcommittees[].systemCode` | string | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `subcommittees[].name` | string | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `subcommittees[].url` | string URL | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `isCurrent` | boolean | Not ingested | Congress.gov is not an approved federal committee-data source. | No task. |
| Committee `history[]` | array | Not ingested | Committee name/type history is not modeled. | No task. |
| Committee `bills`, `reports`, `communications` | count/link objects | Not ingested | Domain-specific jobs and bill links are authoritative. | No task. |
| Committee nominations/communication subresources | arrays | Not ingested | These endpoint families are outside current scope. | No task. |

### Congress.gov meeting and hearing field catalog

| Resource and source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| Meeting `eventId` | string | Ingested | Event source/upstream ID and canonical event ID. | `congress-wave-child`, hourly. |
| Meeting `congress` | integer | Ingested/derived | Scheduled session scope and canonical identity context. | `congress-wave-child`, hourly. |
| Meeting `chamber` | string | Partial | Present in source; committees carry canonical chamber context. | `congress-wave-child`, hourly. |
| Meeting `title` | string | Ingested | `legislative_events.name`. | `congress-wave-child`, hourly. |
| Meeting `type` | string | Ingested | Event classification, defaulting to committee meeting. | `congress-wave-child`, hourly. |
| Meeting `date` | date-time string | Ingested | `legislative_events.start_at`; date part also applies to documents. | `congress-wave-child`, hourly. |
| Meeting `meetingStatus` | string | Ingested | Canonical status with canceled normalization. | `congress-wave-child`, hourly. |
| Meeting `updateDate` | date-time string | Ingested | `legislative_events.source_updated_at`. | `congress-wave-child`, hourly. |
| Meeting `location` | object | Ingested | `legislative_events.location` JSON. | `congress-wave-child`, hourly. |
| Meeting `committees[].systemCode` | string | Ingested | Event-participant relationship ID only; does not materialize or update a canonical federal committee organization. | `congress-wave-child`, hourly. |
| Meeting `committees[].name` | string | Ingested | Event-participant relationship metadata only; does not materialize or update a canonical federal committee organization. | `congress-wave-child`, hourly. |
| Meeting `relatedItems.bills[].congress/type/number` | object fields | Ingested | Event-to-bill links. | `congress-wave-child`, hourly. |
| Meeting `meetingDocuments[]` | document array | Ingested | Event documents and searchable supporting materials. | `congress-wave-child`, hourly. |
| Meeting `witnessDocuments[]` | document array | Ingested | Event documents and searchable supporting materials. | `congress-wave-child`, hourly. |
| Document `name`, `description`, `documentType`, `format`, `url` | strings/URL | Ingested | Title, classification, content type, source URL. | `congress-wave-child`, hourly. |
| Meeting `videos[].url` | string URL | Partial | First video becomes `legislative_events.virtual_access.url`. | `congress-wave-child`, hourly. |
| Meeting `videos[].name` | string | Artifact only | Video label is not stored. | `congress-wave-child`, hourly. |
| Meeting `witnesses[].name` | string | Ingested | `event_participants.name`. | `congress-wave-child`, hourly. |
| Meeting `witnesses[].position` | string | Ingested | Combined participant role. | `congress-wave-child`, hourly. |
| Meeting `witnesses[].organization` | string | Ingested | Combined participant role; no canonical organization link. | `congress-wave-child`, hourly. |
| Meeting `hearingTranscript` or continuation fields | arrays/objects | Artifact only | Available detail is not separately modeled. | `congress-wave-child`, hourly. |
| Hearing `jacketNumber` | integer or string | Ingested | Event source/upstream ID and canonical ID. | `congress-wave-child`, hourly. |
| Hearing `congress` | integer | Ingested/derived | Scheduled scope and identity context. | `congress-wave-child`, hourly. |
| Hearing `chamber` | string | Partial | Present in source; committee participants provide organization links. | `congress-wave-child`, hourly. |
| Hearing `title` | string | Ingested | `legislative_events.name` and transcript material title. | `congress-wave-child`, hourly. |
| Hearing `dates[].date` | date string | Partial | First date becomes all-day event start and document date. | `congress-wave-child`, hourly. |
| Hearing `committees[].systemCode` | string | Ingested | Event-participant relationship ID only; does not materialize or update a canonical federal committee organization. | `congress-wave-child`, hourly. |
| Hearing `committees[].name` | string | Ingested | Event-participant relationship metadata only; does not materialize or update a canonical federal committee organization. | `congress-wave-child`, hourly. |
| Hearing `formats[].type` | string | Ingested | Transcript material content type. | `congress-wave-child`, hourly. |
| Hearing `formats[].url` | string URL | Ingested | Event document/supporting material source URL. | `congress-wave-child`, hourly. |
| Hearing `updateDate` | date-time string | Ingested | `legislative_events.source_updated_at`. | `congress-wave-child`, hourly. |
| Hearing `citation` | string | Artifact only | Not modeled. | `congress-wave-child`, hourly. |
| Hearing `libraryOfCongressIdentifier` | string | Artifact only | Not modeled. | `congress-wave-child`, hourly. |
| Hearing `associatedMeeting` | object | Artifact only | Published-hearing-to-meeting relationship is not modeled. | `congress-wave-child`, hourly. |

### Congress.gov House vote field catalog

| Source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| List `congress` | integer | Ingested | Session and canonical vote identity. | `congress-wave-child`, hourly. |
| List `sessionNumber` | integer | Ingested | Session-specific vote identity/checkpoint. | `congress-wave-child`, hourly. |
| List `rollCallNumber` | integer | Ingested | `votes.roll_call_number` and canonical ID. | `congress-wave-child`, hourly. |
| List `identifier` | string or integer | Ingested | `votes.source_id`. | `congress-wave-child`, hourly. |
| List `legislationType` | string | Partial | Resolves explicit bill or amendment target. | `congress-wave-child`, hourly. |
| List `legislationNumber` | string or integer | Partial | Resolves explicit bill or amendment target. | `congress-wave-child`, hourly. |
| List `sourceDataURL` | string URL | Parsed, not persisted | Provider data URL is available; canonical source uses Congress.gov URL. | `congress-wave-child`, hourly. |
| List `url` | string URL | Ingested | `votes.source_url`. | `congress-wave-child`, hourly. |
| List `updateDate` | date-time string | Checkpoint only | Drives replay ordering/offset progress, not stored on vote. | `congress-wave-child`, hourly. |
| Detail `startDate` | date-time string | Ingested | `votes.held_at`. | `congress-wave-child`, hourly. |
| Detail `voteQuestion` | string | Ingested | `votes.question` and `votes.motion`. | `congress-wave-child`, hourly. |
| Detail `voteType` | string | Ingested | `votes.vote_type`. | `congress-wave-child`, hourly. |
| Detail `result` | string | Ingested | `votes.result`. | `congress-wave-child`, hourly. |
| Detail `notes` | object/array | Artifact only | Newly available API notes are not modeled. | `congress-wave-child`, hourly. |
| Member vote `bioguideID` | string | Ingested | Canonical person and source identity. | `congress-wave-child`, hourly. |
| Member vote `firstName` | string | Ingested | Combined into `vote_positions.source_name`. | `congress-wave-child`, hourly. |
| Member vote `lastName` | string | Ingested | Combined into `vote_positions.source_name`. | `congress-wave-child`, hourly. |
| Member vote `voteCast` | string | Ingested/derived | Normalized `vote_positions.option`; totals are derived from positions. | `congress-wave-child`, hourly. |
| Party totals and other member-vote metadata | objects | Artifact only | Canonical totals are computed from normalized positions. | `congress-wave-child`, hourly. |

### Congress.gov committee-report field catalog

| Source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| Reference `cmte_rpt_id` | string | Ingested | Supporting-material source identity. | `congress-wave-child`, hourly. |
| Reference `congress` | integer | Ingested/derived | Current-Congress scope and canonical linked bill IDs. | `congress-wave-child`, hourly. |
| Reference `type` | string | Ingested | Source identity and detail route. | `congress-wave-child`, hourly. |
| Reference `number` | string | Ingested | Source identity and detail route. | `congress-wave-child`, hourly. |
| Reference `part` | string | Partial | Selects the matching report part; not persisted separately. | `congress-wave-child`, hourly. |
| Reference `citation` | string | Ingested | Material title prefix/fallback. | `congress-wave-child`, hourly. |
| Reference `chamber` | string | Artifact only | Does not provide canonical committee organization context. | `congress-wave-child`, hourly. |
| Reference `updateDate` | date-time string | Ingested | Fallback `supporting_materials.source_updated_at`. | `congress-wave-child`, hourly. |
| Reference `url` | string URL | Partial | API-record fallback if no text formats exist. | `congress-wave-child`, hourly. |
| Detail `title` | string | Ingested | Material title. | `congress-wave-child`, hourly. |
| Detail `issueDate` | date string | Ingested | `supporting_materials.document_date`. | `congress-wave-child`, hourly. |
| Detail `updateDate` | date-time string | Ingested | Preferred material source-updated time. | `congress-wave-child`, hourly. |
| Detail `associatedBill[].congress/type/number` | object fields | Ingested | `supporting_material_links.bill_id`. | `congress-wave-child`, hourly. |
| Detail `committees[].systemCode` | string | Ingested | Supporting-material-to-organization relationship ID only; does not materialize or update a canonical committee organization. | `congress-wave-child`, hourly. |
| Detail `committees[].name` | string | Ingested | Supporting-material-to-organization relationship metadata only; does not materialize or update a canonical committee organization. | `congress-wave-child`, hourly. |
| Text `[].formats[].url` | string URL | Ingested | One material representation per unique URL. | `congress-wave-child`, hourly. |
| Text `[].formats[].type` | string | Ingested | Material content type/title. | `congress-wave-child`, hourly. |
| Text `[].formats[].isErrata` | string flag | Ingested/derived | Adds errata marker to title. | `congress-wave-child`, hourly. |

### Congress.gov available but not ingested field families

| Resource | Available field families | Source types | Ingestion | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| Congress/session | `name`, `startYear`, `endYear`, `sessions[].number`, `sessions[].startDate`, `sessions[].endDate` | strings, integers, dates | Not directly ingested. | None. |
| Laws | Congress, law type/number, title, dates, actions, committees, reports, sponsors/cosponsors, subjects, summaries, text versions, CBO costs | objects and arrays | Not ingested through `/law`. Some enactment status may appear on bill actions. | None. |
| Committee prints | Congress, chamber, jacket number, number, citation, title, committees, associated bills, update date, text formats | scalar fields and arrays | Not ingested. | None. |
| Congressional Record | issue/date/volume metadata and content links | scalar fields and arrays | Not ingested. | None. |
| Daily Congressional Record | volume, issue, publish date, sections, articles, page ranges, full-issue and article formats | scalar fields and arrays | Not ingested. | None. |
| Bound Congressional Record | year/month/day, volume, session, part, sections, page ranges, content links | scalar fields and arrays | Not ingested. | None. |
| House communications | abstract, chamber, Congress, number/type, session, Congressional Record date, committees, submitting agency/official, legal authority, rulemaking flag, report nature, matching requirements, update date | strings, integers, booleans, arrays | Not ingested. | None. |
| House requirements | requirement number/type, statutory authority, description, frequency, due dates, responsible entities, matching communications | scalar fields and arrays | Not ingested. | None. |
| Senate communications | abstract, chamber, Congress, number/type, session, Congressional Record date, committees, update date | strings, integers, arrays | Not ingested. | None. |
| Nominations | Congress/number/part, citation, description, organization, received date, authority date, nomination type, nominees, positions, actions, committees, hearings, update date | scalar fields, objects, arrays | Not ingested. | None. |
| CRS reports | report ID, title, summary, authors, topics, status, publish/update dates, version, formats, related materials, URL/content type | scalar fields and arrays | Not ingested. | None. |
| Treaties | Congress/number/suffix, topic/title, countries, transmitted/received dates, executive report/resolution text, in-force date, index terms, parts, actions, committees/subcommittees | scalar fields, objects, arrays | Not ingested. | None. |

## GovInfo

GovInfo is both a dynamic package/granule API and a set of bulk repositories. The API can discover collections, search,
list packages by `lastModified` or `dateIssued`, follow related-content links, retrieve package summaries and content,
enumerate granules, and retrieve granule summaries/content. Collection-specific MODS and package metadata can add fields
beyond the common contract.

The current product ingests only BILLSTATUS as a first-class GovInfo feed. Official bill-version URLs carried by
BILLSTATUS are passed to the downstream document processor; this is not equivalent to independently traversing the
GovInfo BILLS collection.

### GovInfo legislative collection coverage

Collection availability is dynamic. Package and granule counts should be queried from `/collections` when publishing a
fresh comparison; they are not hard-coded as product guarantees.

| Collection | Available content | Current ingestion | Trigger.dev workflow and cadence | Incremental strategy if enabled |
| --- | --- | --- | --- | --- |
| `BILLSTATUS` Congressional Bill Status | Structured measure status XML from the 108th Congress onward | Ingested for configured bill types and Congresses. Historical backfill plus current recurring sync. | `govinfo-bill-status-sync`, daily at 11:45 UTC; `legislation-backfill` manually for history. | Collections API bounded `lastModified` window, `offsetMark`, 24-hour replay, then bulk XML payload. |
| `BILLS` Congressional Bills | Official bill text versions and package metadata | Partial through URLs embedded in BILLSTATUS; standalone collection metadata and all representations are not traversed. | No standalone Trigger task. | If enabled, daily after GPO’s release window with `lastModified` and a 48-hour replay. |
| `BILLSUM` Congressional Bill Summaries | Bulk structured bill summaries | Summary text is ingested from BILLSTATUS and Congress.gov; standalone collection is not. | No Trigger task. | If enabled, poll changed packages/feed with a 24-hour overlap. |
| `CCAL` Congressional Calendars | House and Senate calendar editions with package/granule content | Not ingested. | No Trigger task. | If enabled, daily `lastModified` discovery with seven-day replay. |
| `CDIR` Congressional Directory | Congress/member/committee directory volumes and member/state granules | Not ingested. | No Trigger task. | Periodic edition discovery; directory data is not a live roster substitute. |
| `CDOC` Congressional Documents | House and Senate documents and treaty documents | Not ingested. | No Trigger task. | If enabled, 12-hour discovery with seven-day replay. |
| `CHRG` Congressional Hearings | Published hearing packages, transcripts, parts/errata and granules | Congress.gov hearing metadata/formats are ingested; GovInfo packages/granules are not. | No GovInfo Trigger task. | If enabled, six-hour discovery, granule enumeration, seven-day replay. |
| `CMR` Congressionally Mandated Reports | Reports submitted pursuant to statutory mandates | Not ingested. | No Trigger task. | Event-driven package discovery by `lastModified`. |
| `COMPS` Statute Compilations | GPO compilations of public laws and related provisions | Not ingested. | No Trigger task. | Edition/update discovery by `lastModified`. |
| `CPRT` Congressional Committee Prints | Committee print packages, related bills/committees, text and granules | Not ingested. | No Trigger task. | If enabled, 12-hour discovery with seven-day replay. |
| `CREC` Congressional Record | Daily Congressional Record issues, sections, articles and content formats | Not ingested. | No Trigger task. | If enabled, daily issue discovery plus delayed-issue follow-up; seven-day replay. |
| `CRECB` Bound Congressional Record | Bound edition volumes, parts and page granules | Not ingested. | No Trigger task. | Periodic bound-edition discovery. |
| `CRI` Congressional Record Index | Index terms and references into the Record | Not ingested. | No Trigger task. | Periodic edition/granule discovery. |
| `CRPT` Congressional Reports | House, Senate and conference reports, Serial Set material, formats and granules | Congress.gov report metadata/formats are ingested; GovInfo packages are not. | No GovInfo Trigger task. | If enabled, six-hour discovery with seven-day replay. |
| `HOB` History of Bills | Bound-edition bill-history entries | Not ingested. | No Trigger task. | Periodic edition/granule discovery; not a freshness source. |
| `PLAW` Public and Private Laws | Slip laws and package formats | Enactment may appear in bill actions/status; GovInfo law packages are not ingested. | No Trigger task. | If enabled, six-hour discovery and relationship traversal back to bills. |
| `SERIALSET` Congressional Serial Set | House/Senate reports and documents in the Serial Set | Not ingested. | No Trigger task. | Edition/package discovery; deduplicate against CRPT/CDOC. |
| `STATUTE` Statutes at Large | Enacted law volumes and granules | Not ingested. | No Trigger task. | Periodic volume/granule discovery. |
| `USCODE` United States Code | Codified law titles, sections and editions | Not ingested. | No Trigger task. | Edition-based discovery; not a bill-status feed. |

GPO runs the current-Congress BILLSTATUS job every four hours and prior Congresses daily. The product deliberately polls
once daily today. Other collections have collection-specific publication behavior: BILLS is generally released daily,
CREC is published on session days, CCAL is updated on chamber session days, and committee publications are released
when committees supply and authorize the material. No future cadence above is active until a parser, canonical mapping,
checkpoint, tests, and Trigger task exist.

### GovInfo common API field catalog

| Interface and source field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| Collections directory `collectionCode` | string | Discovery only | Identifies available collection. BILLSTATUS is the only enabled code. | `govinfo-bill-status-sync`, daily. |
| Collections directory `collectionName` | string | Not ingested | Documentation/discovery metadata. | None. |
| Collections directory `packageCount` | integer | Not ingested | Dynamic provider metric, not a completeness claim. | None. |
| Collections directory `granuleCount` | integer or null | Not ingested | Dynamic provider metric. | None. |
| Collection page `count` | integer | Validation only | Bounds discovery result; not canonical data. | `govinfo-bill-status-sync`, daily. |
| Collection page `nextPage` | string URL or null | Checkpoint traversal | Supplies next `offsetMark`; every page must complete before watermark advance. | `govinfo-bill-status-sync`, daily. |
| Collection page `packages[].packageId` | string | Ingested | Validated and transformed into BILLSTATUS package/source identity. | `govinfo-bill-status-sync`, daily. |
| Collection page `packages[].lastModified` | date-time string | Checkpoint/discovery | Window filtering and stable package ordering. | `govinfo-bill-status-sync`, daily. |
| Collection request `lastModifiedStartDate` | date-time parameter | Checkpoint input | Last observation minus 24-hour replay window. | `govinfo-bill-status-sync`, daily. |
| Collection request `lastModifiedEndDate` | date-time parameter | Checkpoint input | Bounded observation end committed only after full success. | `govinfo-bill-status-sync`, daily. |
| Collection request `offsetMark` | string cursor | Checkpoint traversal | Opaque pagination cursor; repeated cursors fail the run. | `govinfo-bill-status-sync`, daily. |
| Collection request `pageSize` | integer | Configuration | 1,000, with a 100-page safety ceiling. | `govinfo-bill-status-sync`, daily. |
| Published service `dateIssuedStartDate`, `dateIssuedEndDate` | date parameters | Not ingested | Available alternative publication-date discovery. | None. |
| Published service `collection`, `docClass`, `congress`, `modifiedSince` | query fields | Not ingested | Available filtering contract. | None. |
| Search service `query` | string | Not ingested | GovInfo search is not used for completeness. | None. |
| Search service `pageSize`, `offsetMark`, `sorts[].field`, `sortOrder` | paging/sort fields | Not ingested | Available search traversal. | None. |
| Related service relationship/type/access ID | strings and arrays | Not ingested | Could link BILLS/BILLSTATUS/PLAW to bill history, laws, reports, prints, signing statements, U.S. Code and Statutes. | None. |
| Package summary `packageId` | string | Not ingested outside BILLSTATUS discovery | Generic package identity. | No generic package task. |
| Package summary common title/collection/date fields | strings/dates | Not ingested | Collection-specific metadata is not normalized. | None. |
| Package summary `download.txtLink` | string URL | Not ingested | Available content representation. | None. |
| Package summary `download.xmlLink` | string URL | Not ingested | Available content representation. | None. |
| Package summary `download.pdfLink` | string URL | Not ingested | Available content representation. | None. |
| Package summary `download.modsLink` | string URL | Not ingested | MODS metadata representation. | None. |
| Package summary `download.premisLink` | string URL | Not ingested | PREMIS preservation metadata. | None. |
| Package summary `download.zipLink` | string URL | Not ingested | Package archive; may return 503 with `Retry-After` while generated. | None. |
| Package summary `related` | relationship link object | Not ingested | Available related-content navigation. | None. |
| Granule list `granuleId` | string | Not ingested | Generic granule identity. | None. |
| Granule list `title` | string | Not ingested | Granule title. | None. |
| Granule list summary link | string URL | Not ingested | Leads to content and metadata formats. | None. |
| Granule summary metadata/download fields | collection-specific object | Not ingested | No current generic granule canonical model. | None. |

### GovInfo BILLSTATUS field catalog

The XML guide contains additional processing/facet fields and collection-specific children. The rows below enumerate
the legislative content field families and explicitly distinguish what the current parser accepts.

| BILLSTATUS XML field | Source type | Ingestion | Canonical destination or disposition | Trigger.dev task and cadence |
| --- | --- | --- | --- | --- |
| `billStatus.bill.congress` | integer-like string | Ingested | Federal session and canonical bill identity. | `govinfo-bill-status-sync`, daily; historical backfill. |
| `billStatus.bill.type` | string enum | Ingested/derived | Printed identifier, classification, canonical bill ID. | `govinfo-bill-status-sync`, daily. |
| `billStatus.bill.number` | integer-like string | Ingested | Printed identifier and canonical bill ID. | `govinfo-bill-status-sync`, daily. |
| `billStatus.bill.originChamber` | string | Ingested/derived | Normalized `bills.chamber`. | `govinfo-bill-status-sync`, daily. |
| `billStatus.bill.originChamberCode` | string | Artifact only | Human chamber name drives normalization. | `govinfo-bill-status-sync`, daily. |
| `billStatus.bill.introducedDate` | date string | Ingested | `bills.introduced_at`. | `govinfo-bill-status-sync`, daily. |
| `billStatus.bill.updateDate` | date-time string | Ingested | `bills.source_updated_at`. | `govinfo-bill-status-sync`, daily. |
| `billStatus.bill.createDate` | date-time string | Artifact only | Provider creation time is not modeled. | `govinfo-bill-status-sync`, daily. |
| `titles.item[].title` | string | Partial | Preferred official title, otherwise first title, becomes `bills.title`. | `govinfo-bill-status-sync`, daily. |
| `titles.item[].titleType` | string | Partial | Used only to choose preferred official title. | `govinfo-bill-status-sync`, daily. |
| `titles.item[].chamberCode`, `billTextVersionCode`, `billTextVersionName` | strings | Artifact only | Alternate title metadata is not modeled. | `govinfo-bill-status-sync`, daily. |
| `policyArea.name` | string | Ingested | Single-value `bills.subjects` entry. | `govinfo-bill-status-sync`, daily. |
| `legislativeSubjects.item[].name` | string | Artifact only | Detailed subjects are not parsed from BILLSTATUS. | `govinfo-bill-status-sync`, daily. |
| `summaries.item[].text` | string/XML text | Partial | Last returned summary becomes `bills.summary`. | `govinfo-bill-status-sync`, daily. |
| Summary `actionDate`, `actionDesc`, `updateDate`, `versionCode` | strings/dates | Artifact only | Summary metadata is not modeled. | `govinfo-bill-status-sync`, daily. |
| `latestAction.actionDate` | date string | Artifact only | Full action list is canonical. | `govinfo-bill-status-sync`, daily. |
| `latestAction.text` | string | Partial | `bills.status`. | `govinfo-bill-status-sync`, daily. |
| `latestAction.links[]` | link array | Artifact only | Not modeled. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].actionDate` | date string | Ingested | `bill_actions.action_date`. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].actionTime` | time string | Partial | Used in deterministic action identity. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].text` | string | Ingested | `bill_actions.description`. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].actionCode` | string | Artifact only | Not normalized. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].type` | string | Artifact only | Not normalized. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].committee.name/systemCode` | strings | Artifact only | Committee link is not taken from action child. GovInfo is the sole approved federal committee-data source, but standalone committee materialization remains pending. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].links[]` | link array | Artifact only | Roll-call/Record links are not normalized. | `govinfo-bill-status-sync`, daily. |
| `actions.item[].sourceSystem.code/name` | strings | Artifact only | Source-system processing metadata is not modeled. | `govinfo-bill-status-sync`, daily. |
| `actions.actionByCounts`, `actionTypeCounts` | count objects | Artifact only | Provider facet/processing counts are not canonical data. | `govinfo-bill-status-sync`, daily. |
| `sponsors.item[].fullName` | string | Ingested | Primary `bill_sponsors.name`; minimal person name. | `govinfo-bill-status-sync`, daily. |
| `sponsors.item[].bioguideId` | string | Ingested | Canonical person link/source identity. | `govinfo-bill-status-sync`, daily. |
| Sponsor first/middle/last names, party/state/district, GPO/LIS IDs | scalar fields | Artifact only | Current parser accepts full name and optional Bioguide ID only. | `govinfo-bill-status-sync`, daily. |
| `cosponsors.item[].fullName` | string | Ingested | Cosponsor name/minimal person. | `govinfo-bill-status-sync`, daily. |
| `cosponsors.item[].bioguideId` | string | Ingested | Canonical cosponsor person link. | `govinfo-bill-status-sync`, daily. |
| Cosponsor `isOriginalCosponsor`, sponsorship/withdrawal dates, party/state/district, GPO/LIS IDs | scalar fields | Artifact only | Sponsor relationship dates/details are not modeled. | `govinfo-bill-status-sync`, daily. |
| `committees.item[].name` | string | Partial | Flattened into `bills.committees`. | `govinfo-bill-status-sync`, daily. |
| Committee chamber/systemCode/type, activities, subcommittees and report citations | nested objects/arrays | Artifact only | GovInfo is the sole approved federal committee-data source, but standalone committee materialization is pending. | `govinfo-bill-status-sync`, daily. |
| `committeeReports.committeeReport[].citation` | string | Artifact only | Report job through Congress.gov is authoritative. | `govinfo-bill-status-sync`, daily. |
| `relatedBills.item[].congress` | integer-like string | Ingested | Related canonical bill ID. | `govinfo-bill-status-sync`, daily. |
| `relatedBills.item[].type` | string | Ingested | Related canonical bill ID. | `govinfo-bill-status-sync`, daily. |
| `relatedBills.item[].number` | integer-like string | Ingested | Related canonical bill ID. | `govinfo-bill-status-sync`, daily. |
| `relatedBills.item[].relationshipDetails` | string or item array | Partial | Normalized to companion or related. | `govinfo-bill-status-sync`, daily. |
| Related bill title/latest action/identifiers | scalar/nested fields | Artifact only | Not modeled. | `govinfo-bill-status-sync`, daily. |
| `textVersions.item[].date` | date string | Ingested | `bill_documents.document_date`. | `govinfo-bill-status-sync`, daily. |
| `textVersions.item[].type` | string | Ingested | Document title and provider version code context. | `govinfo-bill-status-sync`, daily. |
| `textVersions.item[].formats.item[].url` | string URL | Partial | Best-ranked official HTTPS BILLS representation becomes a bill document. | `govinfo-bill-status-sync`, daily. |
| Text format name/type | strings | Partial | Content type is derived from chosen URL extension/signature. | `govinfo-bill-status-sync`, daily. |
| `laws.item[].number` | string | Artifact only | Public/private law citation is not modeled. | `govinfo-bill-status-sync`, daily. |
| `laws.item[].type` | string | Artifact only | Public/private law type is not modeled. | `govinfo-bill-status-sync`, daily. |
| `recordedVotes.recordedVote[].chamber` | string | Artifact only | House vote job provides member-level current coverage; Senate structured positions are unavailable. | `govinfo-bill-status-sync`, daily. |
| Recorded vote Congress/date/fullActionName/rollNumber/sessionNumber/url | scalar fields | Artifact only | BILLSTATUS recorded-vote references are not normalized. | `govinfo-bill-status-sync`, daily. |
| `calendarNumbers.item[].calendar` | string | Artifact only | Calendar placement is not modeled. | `govinfo-bill-status-sync`, daily. |
| `calendarNumbers.item[].number` | string | Artifact only | Calendar placement is not modeled. | `govinfo-bill-status-sync`, daily. |
| `cboCostEstimates.item[].rptPubDate` | date-time string | Artifact only | CBO cost estimates are not modeled. | `govinfo-bill-status-sync`, daily. |
| `cboCostEstimates.item[].rptTitle` | string | Artifact only | CBO cost estimates are not modeled. | `govinfo-bill-status-sync`, daily. |
| `cboCostEstimates.item[].rptUrl` | string URL | Artifact only | CBO cost estimates are not modeled. | `govinfo-bill-status-sync`, daily. |
| `constitutionalAuthorityStatementText` | XML/CDATA string | Artifact only | Not modeled. | `govinfo-bill-status-sync`, daily. |
| `isByRequest` | string/flag | Artifact only | Not modeled. | `govinfo-bill-status-sync`, daily. |
| `amendments.amendment[]` and nested actions/targets | nested array | Artifact only | Amendment job through Congress.gov is authoritative for current structured amendments. | `govinfo-bill-status-sync`, daily. |
| Other processing counts, facets, reserved/deprecated fields | mixed | Artifact only | Retained only in source XML; never treated as canonical legislative facts. | `govinfo-bill-status-sync`, daily. |

## Canonical gaps and comparison notes

The catalog exposes several high-value gaps that should remain visible in future competitor comparisons:

- Open States contact, office, alternate-name/identifier, event-media, and agenda-related-entity fields are available but
  not canonicalized.
- Congress.gov exposes laws, committee prints, the Congressional Record, communications, nominations, CRS reports, and
  treaties that the product does not ingest.
- Congress.gov member leadership and party history, committee history/activity, House vote notes, amendment cosponsors,
  and amendment-to-amendment links are available but not modeled.
- GovInfo contains official publications that enrich structured Congress.gov data, but only BILLSTATUS currently has a
  recurring importer. CRPT, CHRG, CPRT, CREC, CCAL, PLAW, CMR, SERIALSET, STATUTE, and USCODE remain unimplemented.
- No approved source currently provides dependable structured Senate member roll-call positions through the implemented
  API contracts. This must remain an explicit limitation rather than an inferred capability.
- “Artifact only” is not equivalent to searchable or queryable. A field becomes a product capability only after a
  canonical mapping, update semantics, quality checks, and query contract exist.

## Maintenance rule

Any change to a provider parser, canonical mapping, source scope, Trigger.dev task, schedule, or checkpoint must update
this catalog in the same commit. Recheck the three official specifications before publishing an external capability
comparison because all three providers add fields and endpoints over time.
