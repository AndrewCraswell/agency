# Legislative data coverage policy

## Sources and default range

This is the desired acquisition scope, not a live-coverage promise. Per-jurisdiction activation, content/search acceptance
and remaining gaps are recorded in the [state rollout](../operations/openstates-rollout-checklist.md) and
[W search contract](../../../legislation-web/docs/engineering/api/search-and-diffs.md). Source availability alone does
not satisfy either gate.

- Open States session JSON archives are the state historical source. Import every discoverable archive for all 50
  states, Washington, D.C., and Puerto Rico from 2017 onward. Older or missing archives are reported as source gaps,
  never inferred as empty sessions.
- Self-hosted jurisdiction scrapers are the state recurring-freshness source. The Open States API is not a production
  freshness dependency because its daily quota cannot support the required nationwide cadence.
- GovInfo BILLSTATUS bulk XML is the federal historical metadata source. GovInfo is the sole approved federal
  committee-data source. Its importer is implemented; [membership history](committee-membership-history.md) records
  accepted editions and quarantine gaps. Do not use another provider as a fallback. When a version record includes an
  official XML URL, it is retained and the document worker acquires that artifact separately. BILLSTATUS sometimes reports a version
  count without format URLs; Congress.gov supplies complementary current-version references without fabricated links.
  The default range is the 113th through 119th Congresses.
- Congress.gov API v3 is the federal incremental source for records other than standalone committee organization and
  membership materialization. It may retain bill, event, hearing, and supporting-material relationship metadata, but
  does not materialize or update canonical federal committee organizations.
- Senate.gov Legislative Information System XML is the federal Senate roll-call source. Its session menus and vote
  records provide official vote metadata and individual positions; the current Senate member directory maps LIS member
  IDs to canonical Bioguide identities without name-based merging.

Every source-backed committee appointment or reappointment is a distinct membership tenure. Consecutive complete
snapshots of an uninterrupted appointment retain one tenure; an absence in a complete snapshot followed by a later
reappearance creates a new tenure. Observation and retrieval times never substitute for unknown membership start or end
dates.

`FEDERAL_START_CONGRESS` defaults to `113` and `FEDERAL_END_CONGRESS` defaults to `119`. Both are explicit runtime
configuration values so deployments can advance or backfill deliberately.

## Supported jurisdictions

The policy target is the 50 states plus D.C. and Puerto Rico. A jurisdiction/session is `available`, `missing`, `empty`,
`failed`, or `excluded`. Unavailable sessions remain visible in coverage reports. Other U.S. territories are excluded
until Open States provides compatible archives and the product contract is updated.

## Minimum successful bill

Apply [C's minimum canonical bill contract](../../../../packages/legislation-core/docs/engineering/identity.md#minimum-successful-bill).

## Coverage report

`openstates:discover --output <path>` produces a policy manifest containing every discovered in-range archive, missing
supported jurisdictions, and excluded archive count. Use `--index-url` when the provider supplies an authenticated index
URL. The current Open States index requires an authenticated session; a login page is not interpreted as an empty corpus.

Every ingestion command stores a versioned run with source, run ID, start and completion times, configured scope, record
counts, checkpoint, and bounded failure summary. `coverage:report --output <path>` then produces database coverage by
jurisdiction/session and Congress/bill type, plus action, vote, document-processing status, empty-text, low-text,
extraction-failure and fallback-segmentation counts, bill and section embedding coverage, durable checkpoint age and
cursors, and accumulated ingestion-failure counts. Compare the discovery manifest with this database report for final
release evidence.

This is I's collection/completeness report, not a public HTTP schema. W owns
[coverage response presentation](../../../legislation-web/docs/engineering/api/schemas.md) and
[search behavior](../../../legislation-web/docs/engineering/api/search-and-diffs.md).

## Provider references

- [Open States bulk data](https://open.pluralpolicy.com/data/)
- [Open States session JSON archives](https://open.pluralpolicy.com/data/session-json/)
- [GovInfo Developer Hub and bulk-data coverage](https://www.govinfo.gov/developers)
- [Congress.gov API documentation](https://github.com/LibraryOfCongress/api.congress.gov)
