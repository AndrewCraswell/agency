# Civic identity sources and maintenance

Source adapters record the artifact, retrieval time, source ID, parser version and authority tier. Serving remains
local when a source is unavailable. [C identity](../../../../packages/legislation-core/docs/engineering/identity.md)
owns invariants; [W's roadmap](../../../legislation-web/docs/engineering/identity-and-representative-roadmap.md) owns product sequencing.

## Source and authority matrix

| Source | Use | Authority and serving rule |
| --- | --- | --- |
| [Congress.gov API](https://api.congress.gov/) | Federal members, service, bills, amendments and relations | Authoritative acquisition for these records, not canonical federal committee materialization; archive and normalize locally |
| [GovInfo](https://www.govinfo.gov/developers) | Federal committees, subcommittees and memberships | Sole approved source; never infer exact tenure dates from snapshots or add fallback providers |
| [Open States scrapers](https://github.com/openstates/openstates-scrapers) and [people data](https://github.com/openstates/people) | State officials, roles, memberships, committees, bills, votes and events | Sole approved state committee source; self-hosted acquisition, not routine use of the hosted 250-request quota |
| [Census Geocoder](https://geocoding.geo.census.gov/geocoder/) | Submitted address coordinates/current geography | W request-time backend dependency with strict privacy, timeout and no-persistence rules; planned, not activated by this source policy |
| [Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html) | Current/historical congressional and state boundaries | Versioned, checksummed PostGIS import for local/as-of resolution |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) | Biography, portrait, official-site and external-ID enrichment | Noncanonical; may supplement, never create or merge official identity |

## Maintenance

Renaming and cleanup are not an identity roadmap. Keep reusable smoke/evaluation/recovery tools and source decisions;
remove obsolete outputs only after identifying replacements. Retire tasks only after checking schedules, callers,
recovery ownership and in-flight runs. Incident records are dated evidence, not a parallel backlog.

Source synchronization and enrichment tasks retain their original OFF-201 through OFF-210 and ENR-601 through ENR-606
IDs in [the program roadmap](../../../legislation-web/docs/engineering/identity-and-representative-roadmap.md).
I owns their acquisition, normalization, quarantine, archival, source-governance and refresh implementation. W owns
the customer acceptance; C owns schema/identity changes. Those retained task tables are not copied into another backlog.

## Retained coverage decisions

The September 11 final range audit accepted Congresses 105–119: 1,623 complete Congress profiles with aliases and
identifiers. Of 2,135 stored Congress-prefixed identities, 512 still lacked complete aliases/identifiers and were not
fully audited. These are dated observations, not current counters. Do not equate the accepted range with all stored people.

Normalized names only identify review candidates. The Payne father/son identities remain distinct; unverified state
vote-name stubs remain excluded from canonical people results. Preserve source IDs, applicable terms and evidence;
never merge to make a count look complete. State acquisition still needs its own acceptance.

Congress.gov `officialWebsiteUrl` maps to canonical `officialUrl`. Official-site metadata may retain HTTP or HTTPS;
unsafe schemes are rejected and Congress API provenance/fetch remains HTTPS-only. Historical hydration must preserve
the source URL rather than silently rewriting it. Range completion, recurring-wave completion and API acceptance are separate.