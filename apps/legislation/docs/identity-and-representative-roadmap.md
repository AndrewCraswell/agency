# Identity, entity, and representative roadmap

## Purpose and status

Status: planned after the complete embedding pass. The ingestion, document,
OCR, supporting-material, and embedding foundations are tracked separately.
This roadmap begins only after the embedding completion and retrieval-quality
gates pass.

The outcome is one provenance-preserving civic graph that lets the web
application answer:

- Who represents this address now?
- Who represented this district on a past date?
- Which offices, committees, and leadership roles has a person held?
- Which bills and amendments did the person sponsor?
- How did the person vote, and what was the underlying motion?
- Which bills, documents, hearings, and supporting materials mention the
  person, organization, place, law, or cited document?

Address lookup belongs to the web application. The MCP may expose already
canonical official and activity records, but it must not accept or retain a
user's home address.

## Program status

| Program | Status | Completion evidence |
| --- | --- | --- |
| Canonical legislation ingestion | Complete | Bills, actions, sponsors, amendments, votes, people, organizations, terms, memberships, events, documents, and supporting materials are persisted under the `legislation` schema. |
| Document, OCR, and supporting-material processing | Complete | Ordinary ingestion invokes managed OCR, completion gates include retryable and OCR work, and the one-time polling sweep is removed. |
| Embedding model selection and retrieval canary | Complete | The accepted mixed-model contract, dedicated vector tables, Trigger tasks, MCP retrieval, selective reranking, and treatment/control evaluations pass. |
| Complete embedding corpus pass | In progress | Structured amendments are complete. The remaining bill, material-section, and document-section work is moving through PgBouncer to a 128-worker steady state, with temporary 160- and 200-worker throughput canaries and an 80-session PostgreSQL stop threshold. Completion requires every product controller and index-maintenance task to finish with the documented quality and operational gates. |
| Canonical official identity expansion | Planned | Phase 1. |
| District and address resolution | Planned | Phase 3. |
| Unstructured entity extraction and linking | Planned | Phase 4. |
| Official activity navigation | Planned | Phase 5. |

## Architectural boundary

External services are acquisition and enrichment sources, not the serving
path for an official page.

```text
Congress.gov, self-hosted OpenStates, Census, TIGER/Line, Wikidata
  -> scheduled acquisition and reconciliation
  -> canonical PostgreSQL and PostGIS records
  -> query service
  -> web application and approved MCP tools
```

The only normal request-time external lookup is address geocoding when a user
submits an address. After geocoding, district, office, term, person, and
activity resolution uses local data. Raw addresses are not persisted by
default.

## Source and authority matrix

| Source | Use | Authority and serving rule |
| --- | --- | --- |
| [Congress.gov API](https://api.congress.gov/) | Federal members, service context, bills, amendments, and related legislative records. | Authoritative federal acquisition source for these records. It may retain relationship metadata, but does not materialize or update canonical federal committee organizations. Archive responses and serve normalized local records. |
| [GovInfo](https://www.govinfo.gov/developers) | Federal committees, subcommittees, and memberships. | Sole approved federal committee-data source. Canonical ingestion is pending; do not treat another provider as a fallback. |
| [Open States scrapers](https://github.com/openstates/openstates-scrapers) and [people data](https://github.com/openstates/people) | State officials, roles, memberships, committees, bills, votes, and events. | Sole approved state committee-data source and self-hosted normalized state acquisition. Do not depend on the hosted 250-request quota for routine sync. |
| [Census Geocoder](https://geocoding.geo.census.gov/geocoder/) | Standardize a submitted address and return coordinates and current geographies. | Request-time web backend dependency with strict privacy, timeout, and no-persistence rules. |
| [Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html) | Current and historical congressional and state legislative boundary geometry. | Versioned, checksummed PostGIS import used for local and historical point-in-polygon resolution. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) | Biography, portrait, official-site, and cross-database enrichment. | Noncanonical enrichment only. A Wikidata result may supplement but cannot create or merge an official identity. |

Every source adapter must record the retrieved artifact, retrieval time,
source identifier, parser version, and authority tier. Serving remains local
when any acquisition source is unavailable.

## Identity rules

1. A person is not an office. A durable person may hold multiple offices and
   an office persists as its holders change.
2. A district is versioned geography. Redistricting never overwrites an older
   boundary needed for an as-of-date query.
3. A textual mention is evidence, not identity. Extraction creates a mention;
   resolution links it to a canonical record only when evidence passes a
   threshold.
4. Names alone never merge people. Deterministic provider identifiers,
   jurisdiction, chamber, district, office dates, aliases, and corroborating
   relationships drive resolution.
5. An unresolved mention is preferable to a wrong link. Ambiguity remains
   explicit and reviewable.
6. Congress.gov and official legislature data are authoritative for official
   service. Self-hosted OpenStates supplies normalized state coverage. Census
   supplies address geocoding and district geography. Wikidata enriches an
   already resolved identity but never creates it.
7. Every imported or inferred fact retains source, observation time, source
   identifier, and resolver or extractor version.

## Target data model

Existing `people`, `organizations`, `legislative_terms`,
`organization_memberships`, `bill_sponsors`, `amendments`, `votes`, and
`vote_positions` remain canonical. Add the following focused records:

| Record | Responsibility |
| --- | --- |
| `external_identifiers` | One typed external identifier per canonical person, organization, office, district, or place. Enforce uniqueness within the issuing system. |
| `entity_aliases` | Normalized names, abbreviations, former names, honorific-free forms, validity dates, language, and provenance. |
| `offices` | Durable elected or appointed seats, independent of the current holder. |
| `office_terms` | Person-to-office service interval, party, role, election or appointment context, and source. |
| `districts` | Jurisdiction, chamber, district code, Census GEOID, geometry vintage, and effective dates. |
| `district_geometries` | PostGIS geometry and source artifact metadata, separated when multiple vintages share one logical district. |
| `places` | Canonical geographic entities referenced in legislative text. |
| `entity_mentions` | Source record and section, character offsets, surface text, normalized text, entity type, context, confidence, extractor version, and state. |
| `entity_links` | Mention-to-canonical record candidate, resolution method, score, evidence, review state, and resolver version. |
| `document_citations` | Structured references between a source passage and a bill, amendment, vote, law, regulation, report, or document. |
| `person_profiles` | Optional biography, portrait, contact, and official-link projection with per-field provenance and licensing metadata. |

Use foreign keys for canonical relationships and JSON only for bounded source
evidence that is not independently queried. Do not put district geometry,
aliases, identifiers, or terms into a generic JSON profile.

## Entity taxonomy

The first supported mention types are:

- person;
- legislative body, committee, subcommittee, agency, court, company, and
  other organization;
- country, state, territory, district, county, municipality, facility, and
  other place;
- elected office and government role;
- bill, resolution, amendment, vote, hearing, committee report, and supporting
  material;
- public law, statute, code section, regulation, court case, executive order,
  and other legal citation; and
- date, money, program, and policy topic when they materially improve search
  filters or relationship navigation.

Topics are classifications rather than canonical named entities unless they
have a separately governed vocabulary.

## Repository hygiene completed with this roadmap

The cleanup is deliberately conservative: remove superseded one-time outputs,
but keep reusable validation, deployment, recovery, and evaluation entry
points. A file is not obsolete merely because its first rollout completed.

| Task | Status | Disposition and evidence |
| --- | --- | --- |
| HYG-001 | Complete | Replaced version-suffixed canary names with the canonical `embedding-canary` manifest, report, lexical result, and semantic result. |
| HYG-002 | Complete | Removed intermediate embedding canary outputs from iterations 1 through 6. The accepted routed canary, topic canary, model bakeoff, judgment pool, and regression inputs remain. |
| HYG-003 | Complete | Renamed the reusable document operations guide from a historical backfill name to `document-processing-operations.md` and repaired the documentation index. |
| HYG-004 | Complete | Reconciled stale paused-rollout wording with the approved 16-shard-per-product embedding pass without rewriting dated incident evidence as if it were current. |
| HYG-005 | Complete | Audited every file in `apps/legislation/scripts` against package commands, build behavior, operations, and future regression needs. No current script is dead. |
| HYG-006 | Complete | Retained `smoke-local.mjs`, `smoke-deployment.mjs`, and `smoke-dependencies.mjs`: they test distinct local startup, deployed MCP behavior, and production database/Blob dependencies. |
| HYG-007 | Complete | Retained embedding builders, seeders, evaluators, and rerankers as reproducible quality-regression tooling. They are not deployed Trigger tasks and do not run unless explicitly invoked. |
| HYG-008 | Complete | Retained schedule reconciliation, historical backfill, migration-copy, container-context, and infrastructure what-if scripts because each remains the canonical operator or build entry point. |
| HYG-009 | Complete | Audited registered Trigger tasks. Removed historical polling behavior remains absent; current ingestion, OCR, embedding, schedule, validation, and resumable-backfill tasks all have permanent runtime or recovery ownership. |

Future cleanup follows these rules:

1. Delete a historical controller only after the corresponding incremental
   path passes and an accumulation alarm proves ownership.
2. Keep smoke and evaluation tools while they protect a release or model
   contract; remove only superseded outputs and versioned snapshots.
3. Never delete a remediation catalog entry. It is the incident and rollback
   audit trail, not an active task list.
4. Delete a Trigger task only after its schedule, parent task, CLI entry point,
   recovery role, and in-flight runs are all absent.

## Phase 0: close the embedding program

Dependency: none. Status: complete for generation and production index maintenance; final MCP transport verification is
tracked separately.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| EMB-001 | Complete | Pin `voyageai/voyage-4`, `openai/text-embedding-3-small`, and `cohere/rerank-v3.5` to the accepted per-product contract. |
| EMB-002 | Complete | Persist four dedicated embedding tables with exact model, dimensions, input contract, hash, and rollout identity. |
| EMB-003 | Complete | Deploy `embedding-sync`, shard controller, shard worker, and index-maintenance tasks. |
| EMB-004 | Complete | Verify MCP treatment/control recall, canonical projection, amendment fusion, material search, and selective reranking. |
| EMB-005 | Complete | Bills, amendments, material sections, and document sections are complete, and all five production HNSW indexes are valid and ready. |
| EMB-006 | In progress | Final `ANALYZE` is complete for all four embedding tables. Record provider spend, rerun the frozen evaluation, and publish the promotion decision if those artifacts are still required. |
| EMB-007 | Planned | Verify daily ingestion creates or refreshes only affected embeddings and does not require a historical sweep. |
| EMB-008 | Complete | Add `embedding-full-sync` so future complete recreations run amendments, bills, material sections, and document sections sequentially at the 128-worker steady-state cap and transfer capacity automatically at each product boundary. |

Exit gate: all four embedding products are complete, indexes have current
statistics, daily incremental behavior passes, observed spend is reconciled,
and MCP semantic and hybrid search retains the accepted quality threshold.

## Phase 1: canonical identity and office contracts

Dependency: Phase 0 exit gate. Parallelism: schema and fixture tasks may run
together only after the contract document is accepted.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| IDN-101 | In progress | [Identity inventory](identity-link-inventory.md) diagnosed 432 stale vote links, checked all 416 amendment source records, and found collection/detail term duplication. Importer fixes deployed as Trigger 20260908.8; guarded data replay and authenticated verification await the active Congress wave. Exact-name collision is the distinct Payne father/son pair; broader contextual checks remain open. |
| IDN-102 | Planned | Write the canonical person, office, district, identifier, alias, term, and provenance contracts, including merge and split rules. |
| IDN-103 | Planned | Add `external_identifiers` and uniqueness rules for Bioguide, OpenStates, Wikidata, and provider-native IDs. |
| IDN-104 | Planned | Add `entity_aliases` with normalization, validity dates, language, and provenance. |
| IDN-105 | Planned | Add `offices` and `office_terms`; migrate service facts from `legislative_terms` without losing source identity. |
| IDN-106 | Planned | Add versioned `districts` and `district_geometries` with PostGIS indexes and non-overlapping effective-date checks. |
| IDN-107 | Planned | Add `places`, `entity_mentions`, `entity_links`, and `document_citations` with bounded evidence fields and source foreign keys. |
| IDN-108 | Planned | Add fixtures for same-name officials, party changes, chamber changes, appointments, vacancies, redistricting, and non-consecutive service. |
| IDN-109 | Planned | Add migration, schema integration tests, query indexes, deletion rules, and validation metrics. |
| IDN-110 | Planned | Document data ownership and forbid name-only automatic merges. |

Exit gate: the migration passes on a production-shaped copy, every existing
relationship remains resolvable, and ambiguous identities are reported rather
than merged.

## Phase 2: official and membership synchronization

Dependency: IDN-102 through IDN-109. Federal and state work can proceed in
parallel after the shared contracts land.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| OFF-201 | Planned | Implement a Congress.gov member client keyed by Bioguide ID with bounded pagination, source archiving, and retry telemetry. |
| OFF-202 | Planned | Normalize federal member names, identifiers, offices, service terms, state, district, party, and official links. |
| OFF-203 | Planned | Reconcile Congress.gov members with existing bill sponsors, amendment sponsors, and House vote positions. |
| OFF-204 | Planned | Import self-hosted OpenStates people, roles, offices, districts, and memberships without using the hosted API quota. |
| OFF-205 | Planned | Reconcile state people with existing sponsors, vote positions, committees, and event participants. |
| OFF-206 | Planned | Model vacancies, special elections, appointments, resignations, party changes, and overlapping source observations. |
| OFF-207 | Planned | Add current and historical completeness reports by jurisdiction, chamber, district, and date. |
| OFF-208 | Planned | Add Trigger tasks for federal and state official refreshes with source-specific schedules, durable checkpoints, and non-overlap. |
| OFF-209 | Planned | Add conflict quarantine so a lower-authority source cannot overwrite an authoritative service interval. |
| OFF-210 | Planned | Run a federal canary and three-state canary covering one ordinary, one multi-member or unusual, and one redistricted jurisdiction. |

Exit gate: every canary seat has at most one valid current holder unless its
office contract explicitly permits multiple holders, and historical service
queries reproduce source records for graded dates.

## Phase 3: district geography and address resolution

Dependency: IDN-106 and current office terms from Phase 2. This is a web
application feature, not an MCP address tool.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| GEO-301 | Planned | Pin current and historical Census geography vintages needed for supported congressional and state legislative terms. |
| GEO-302 | Planned | Build a repeatable TIGER/Line acquisition, checksum, archive, validation, and PostGIS import pipeline. |
| GEO-303 | Planned | Map Census GEOIDs to canonical districts and reject unmatched or multiply matched boundaries. |
| GEO-304 | Planned | Implement a server-side Census Geocoder client for one-line addresses and coordinates with strict timeout and response validation. |
| GEO-305 | Planned | Implement local point-in-polygon resolution as the durable fallback and historical lookup path. |
| GEO-306 | Planned | Resolve district plus as-of date to office terms and officials, including vacancies and multi-member seats. |
| GEO-307 | Planned | Add a web backend endpoint that returns standardized geography and representative IDs without persisting the raw address. |
| GEO-308 | Planned | Add privacy controls, redacted telemetry, cache policy, abuse protection, and explicit saved-address consent. |
| GEO-309 | Planned | Build an official-address test set with boundary-edge, apartment, rural route, Puerto Rico, and no-match cases. |
| GEO-310 | Planned | Compare Census response, local geometry, and official lookup results; require discrepancies to be classified before launch. |

Exit gate: current and historical representative resolution passes the graded
address set, raw addresses never enter logs, and the web flow handles no-match
and ambiguous-boundary responses explicitly.

## Phase 4: entity extraction and canonical linking

Dependency: Phase 1 contracts. It can overlap Phase 3 after canonical
districts and places are stable.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| ENT-401 | Planned | Build a stratified human-graded corpus from native text, OCR text, amendments, fiscal notes, testimony, reports, and hearings. |
| ENT-402 | Planned | Implement deterministic recognizers for canonical bill, amendment, roll-call, public-law, code, regulation, case, and document citations. |
| ENT-403 | Planned | Implement alias and exact-identifier matching against canonical people, organizations, offices, places, and legislative records. |
| ENT-404 | Planned | Evaluate local named-entity models on the graded corpus; record precision, recall, latency, memory, license, and per-page cost. |
| ENT-405 | Planned | Add an optional bounded LLM ambiguity resolver that receives candidate IDs and evidence but cannot mint canonical IDs. |
| ENT-406 | Planned | Generate candidates constrained by jurisdiction, chamber, document date, service interval, organization, and nearby titles. |
| ENT-407 | Planned | Persist mentions and candidate links with offsets, context, extractor version, resolver version, score, and evidence. |
| ENT-408 | Planned | Define automatic-link, review, and unresolved thresholds per entity type; optimize canonical-link precision before recall. |
| ENT-409 | Planned | Add `entity-extraction-sync`, shard-controller, shard-worker, and resolution tasks with idempotent input hashes. |
| ENT-410 | Planned | Invoke incremental extraction from successful native-text and OCR persistence; do not depend on a recurring historical sweep. |
| ENT-411 | Planned | Add a bounded historical backfill controller that can be removed after the corpus reaches the permanent incremental path. |
| ENT-412 | Planned | Add extractor-version reprocessing and stale-link invalidation without deleting human-reviewed decisions. |
| ENT-413 | Planned | Publish per-type precision, recall, unresolved rate, ambiguous-candidate rate, and source-stratum metrics. |

Exit gate: deterministic citations meet 99% precision on the graded set;
automatically linked people and organizations meet at least 98% precision;
every result retains source offsets and provenance; and incremental ingestion
produces mentions without a cleanup sweep.

## Phase 5: official activity and navigation

Dependency: Phases 2 and 4. Query work can start when canonical official links
are stable; the web UI starts after query contracts pass.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| ACT-501 | Planned | Add person detail queries for identifiers, aliases, offices, terms, parties, districts, committees, and provenance. |
| ACT-502 | Planned | Add sponsored and cosponsored bill queries with primary/secondary classification and service-date context. |
| ACT-503 | Planned | Add sponsored amendment queries and document-backed amendment relationships. |
| ACT-504 | Planned | Add vote queries joining person positions to roll call, motion, bill or amendment, chamber, result, and source. |
| ACT-505 | Planned | Add committee, leadership, event, and hearing participation timelines. |
| ACT-506 | Planned | Add extracted-mention queries grouped by source type and confidence, with direct passage and document navigation. |
| ACT-507 | Planned | Produce one chronological activity feed with stable cursors and filters; preserve the underlying typed relationships. |
| ACT-508 | Planned | Add web routes for address lookup, representative lists, official profiles, service history, and activity drill-down. |
| ACT-509 | Planned | Add accessible empty, vacancy, ambiguity, historical, and incomplete-coverage states. |
| ACT-510 | Planned | Add approved MCP tools for canonical official lookup and activity only after web contracts stabilize; exclude raw-address input. |
| ACT-511 | Planned | Add batch official/activity lookup so callers do not require one MCP call per bill, amendment, vote, or official. |

Exit gate: a user can resolve representatives, open an official, inspect each
relationship, and reach the authoritative bill, amendment, vote, event, or
document with source attribution and coverage disclosures.

## Phase 6: enrichment and source governance

Dependency: stable canonical identities from Phase 2.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| ENR-601 | Planned | Resolve Wikidata QIDs only through corroborated external identifiers or reviewed candidates. |
| ENR-602 | Planned | Import bounded biography, portrait, official website, social, and cross-database fields with per-field provenance. |
| ENR-603 | Planned | Record image license, attribution, source URL, retrieval time, and permitted delivery behavior. |
| ENR-604 | Planned | Define source authority and conflict rules for names, service terms, party, district, biography, and contact details. |
| ENR-605 | Planned | Refresh volatile fields on a schedule and retain historical observations where they affect past views. |
| ENR-606 | Planned | Reject Wikipedia page scraping as a serving dependency; use structured Wikidata and authoritative official sources. |

Exit gate: enrichment can be deleted and rebuilt without changing canonical
identity or legislative relationships.

## Phase 7: operations, quality, and rollout

Dependency: each preceding phase contributes its own canary.

| Task | Status | Deliverable and acceptance gate |
| --- | --- | --- |
| OPS-701 | Planned | Add dashboards for official freshness, empty seats, overlapping terms, unmatched districts, unresolved mentions, and extraction drift. |
| OPS-702 | Planned | Add alerts for schedule failure, source drift, identity conflicts, geometry mismatch, and automatic-link precision regression. |
| OPS-703 | Planned | Add runbooks for redistricting, special elections, resignations, source disagreement, false entity links, and address no-match. |
| OPS-704 | Planned | Add deletion and correction workflows that preserve audit evidence and invalidate dependent caches. |
| OPS-705 | Planned | Run federal, three-state, ten-state, and nationwide staged promotions with explicit rollback scopes. |
| OPS-706 | Planned | Complete privacy, security, accessibility, load, and cost reviews before general availability. |
| OPS-707 | Planned | Remove the one-time entity historical backfill controller only after incremental extraction proves no unowned accumulation. |
| OPS-708 | Planned | Mark this roadmap complete only after 30 days of healthy nationwide official refresh and entity extraction. |

## Assignable work packets

These packets are deliberately bounded so independent agents can work without
editing the same files. An agent must not cross its ownership boundary without
coordinating first.

| Packet | Tasks | Starts after | Primary ownership |
| --- | --- | --- | --- |
| A: identity contract and schema | IDN-101 through IDN-110 | EMB-006 | Schema, migrations, model contracts, schema tests, data-model docs |
| B: federal officials | OFF-201 through OFF-203, OFF-206 through OFF-210 federal cases | IDN-109 | Congress member client, normalization, federal fixtures, Trigger worker |
| C: state officials | OFF-204 through OFF-210 state cases | IDN-109 and self-hosted scraper output contract | OpenStates person/role importer, state fixtures, Trigger worker |
| D: geography and address | GEO-301 through GEO-310 | IDN-106 | Geography acquisition, PostGIS import, address resolver, privacy tests |
| E: extraction and resolution | ENT-401 through ENT-413 | IDN-107 and IDN-110 | Entity taxonomy, recognizers, model evaluation, resolver, extraction tasks |
| F: official activity queries | ACT-501 through ACT-507 and ACT-511 | OFF-210 and ENT-408 | Query service, pagination, relationship projections, contract tests |
| G: web experience | ACT-508 and ACT-509 | GEO-310 and ACT-507 | Web routes, UI, accessibility, browser acceptance |
| H: MCP official access | ACT-510 | ACT-507 and stable web contracts | MCP schemas, tools, batch limits, protocol tests |
| I: enrichment | ENR-601 through ENR-606 | OFF-210 | Wikidata and official-source enrichment, provenance, licensing |
| J: operations and rollout | OPS-701 through OPS-708 | First canaries from every packet | Telemetry, alerts, runbooks, staged promotion, completion audit |

## Dependency order

```text
Embedding completion
  -> identity contracts and schema
     -> federal officials
     -> state officials
     -> district geography and address resolution
     -> entity extraction and linking
        -> official activity queries
           -> web experience
           -> MCP official tools
     -> enrichment
  -> operations and nationwide rollout
```

## Completion definition

The program is complete only when:

- every current supported district resolves to its office and current holder
  or an explicit vacancy;
- historical representative queries use the correct boundary and service
  interval for the requested date;
- sponsorship, amendment, vote, committee, event, and mention relationships
  resolve through canonical person IDs;
- entity links meet the graded precision gates and retain source offsets;
- address input is transient by default and absent from logs;
- external API outages do not prevent serving already synchronized officials;
- every enrichment field carries source and licensing provenance;
- incremental ingestion owns official refresh, embeddings, and entity
  extraction without a permanent historical sweep; and
- the 30-day nationwide health gate has no unresolved critical identity,
  geography, privacy, or freshness discrepancy.
