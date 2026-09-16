# Canonical civic identity

This contract separates canonical invariants from proposed office/geography expansion. Proposed records below are not
implemented or live merely because the contract moved. [W's roadmap](../../../../apps/legislation-web/docs/engineering/identity-and-representative-roadmap.md)
owns sequencing; [I's source policy](../../../../apps/legislation-ingestion/docs/engineering/identity-sources.md) owns authority and maintenance.

## Identity rules

1. A person is not an office. A durable person may hold many offices; an office persists as holders change.
2. District geography is versioned; redistricting never overwrites boundaries needed for historical queries.
3. A textual mention is evidence, not identity. Link only when resolution evidence passes its threshold.
4. Names alone never merge people. Use deterministic provider IDs, jurisdiction, chamber, district, office dates,
   aliases and corroborating relationships.
5. Leave ambiguous mentions explicit and reviewable rather than assigning a wrong link.
6. Official sources establish service; enrichment can supplement an already resolved identity, never create one.
7. Imported/inferred facts retain source, observation time, source identifier and resolver/extractor version.

## Target data model

Existing `people`, `organizations`, `legislative_terms`, `organization_memberships`, `bill_sponsors`, `amendments`,
`votes` and `vote_positions` remain canonical. Planned focused records:

| Record | Responsibility |
| --- | --- |
| `external_identifiers` | Typed IDs for person, organization, office, district or place; unique within issuing system |
| `entity_aliases` | Normalized/former/honorific-free names, abbreviations, validity dates, language and provenance |
| `offices` | Durable elected or appointed seats, independent of holder |
| `office_terms` | Person/office service interval, party, role, appointment/election context and source |
| `districts` | Jurisdiction, chamber, district code, Census GEOID, geometry vintage and effective dates |
| `district_geometries` | PostGIS geometry and source artifacts for each vintage |
| `places` | Canonical geographic entities mentioned in legislative text |
| `entity_mentions` | Record/section offsets, text, type, context, confidence, extractor version and state |
| `entity_links` | Mention/canonical candidate, resolution method, score, evidence, review state and resolver version |
| `document_citations` | Source passage references to bills, amendments, votes, laws, regulations, reports or documents |
| `person_profiles` | Biography, portrait, contact and official-link projection with field provenance and licensing |

Reuse existing `person_external_identifiers` and `person_aliases` instead of creating competing tables. IDN-103/104 in W
record their partial acceptance. Canonical relationships use foreign keys; JSON is bounded unqueried source evidence,
not a generic profile for geometry, aliases, identifiers or terms.

## Entity taxonomy

Mention types cover people; legislative bodies, committees/subcommittees, agencies, courts, companies and organizations;
countries, states/territories, districts, counties, municipalities, facilities and places; offices and government roles;
bills, resolutions, amendments, votes, hearings, reports and materials; laws, statutes, code sections, regulations,
court cases, executive orders and citations. Date, money, program and policy topic are included only when useful for
filters/navigation. Topics are classifications, not canonical entities without a governed vocabulary.

## Minimum successful bill

A successfully ingested bill has a canonical ID, jurisdiction, legislative session, printed identifier, nonempty title
and official/provider source URL. Missing optional scalars are null and collections empty. Never fabricate dates,
people, statuses, text or classifications. I owns [coverage collection](../../../../apps/legislation-ingestion/docs/engineering/coverage-policy.md);
W owns response presentation. [Membership history](committee-membership-history.md) defines effective versus detected dates.