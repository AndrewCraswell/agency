# Identity link inventory

Read-only production baseline, September 8, 2026. This starts roadmap item IDN-101; it does not accept identity
merges or declare the broader identity inventory complete. Each query ran in a read-only transaction with a
15-second statement limit, sequentially through one connection. No ingestion or index build was active.

| Relation | Rows | Missing person links | Additional evidence |
| --- | ---: | ---: | --- |
| People | 19,698 | Not applicable | 539 active; zero missing jurisdiction/source IDs or blank names |
| Legislative terms | 16,285 | 0 | 997 active term rows; zero unknown chambers |
| Organization memberships | 54,799 | 0 | 3,871 active memberships |
| Bill sponsors | 1,366,332 | 0 | Relationship-link count only, not proof of correct identities |
| Amendments | 38,825 | 416 | None of the unlinked rows has a sponsor name; not yet classified as missing data versus legitimate absence |
| Vote positions | Approximately 50,046,836 | 432 | All 432 have both a source person ID and source name |

The exact all-vote aggregation hit its 15-second bound and was cancelled. The total above is PostgreSQL's
`pg_class.reltuples` estimate. A separate indexed null-person query completed and gives the exact 432 gap count.
Do not report the estimate as a census or raise the query timeout to force a whole-table scan.

There are no duplicate `(source_provider, source_id)` person groups and no duplicate `upstream_ids.bioguide`
values. The only other upstream key is `openstatesVoteName`: shared values such as Johnson and Smith occur across
different people. These name strings are not stable identifiers and their reuse is not evidence of duplicate people.
This bounded key audit is not a full contextual name-conflict review.

## Next bounded reconciliation

1. Group the 432 vote gaps by source provider, jurisdiction, session and source person ID; inspect why the importer
   retained a null canonical link despite a supplied source identifier.
2. Distinguish missing canonical people from stale/reused source IDs or deliberate quarantine. Verify actual source
   records and people before implementing any repair, then ensure replay produces the same deterministic links.
3. Classify the 416 unnamed amendment sponsorship gaps without inventing sponsors.
4. Complete contextual name/term conflict checks and source coverage before marking IDN-101 Done.

No records were changed by this inventory, and no additional providers were introduced.
