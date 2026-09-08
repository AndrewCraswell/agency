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

## Follow-up findings and release, September 8

All 416 amendment detail URLs were fetched successfully from Congress.gov: 416 contained a sponsor entry,
zero lacked one, and zero requests failed. The affected rows are House amendments in Congresses 113–119
(47, 45, 67, 44, 78, 48 and 87 respectively). Committee entries use `name`, whereas individual sponsors use
`fullName` and a Bioguide ID. The parser discarded `name`. Examples include Rules Committee on
113/HAMDT/17, Ways and Means Committee on 114/HAMDT/1437, and Judiciary Committee on 114/HAMDT/214.
The correction preserves either source name; it does not manufacture a person ID for a committee.
Commit `936e828` includes the normalizer regression test. The stored-name replay is now complete; see closure below.

The exact `(jurisdiction_id, lower(name))` census found one collision: `PAYNE, Donald M.` maps to
`P000149` and `P000604`. The [House biography of Donald Payne Jr.](https://history.house.gov/People/Detail/15032387602)
explicitly identifies him as the son of Donald Milford Payne and describes succeeding his father. These are
two different people, not duplicate identities. No merge or display-name rewrite was performed.

Term checks found zero reversed exact dates, zero person/term jurisdiction mismatches, zero duplicated
`(person_id, source_provider, source_id)` keys, and zero same-person/chamber duplicate intervals with a known
start date. Grouping unknown dates alone is not evidence of duplication. A more specific check did find
career-wide collection summaries combined with Congress-specific detail terms for the same person/Congress.
For example, A000014 had both `105:lower:1991:2011` and `105:lower:1997:1999`.
The [official House biography](https://history.house.gov/People/Detail/8268) confirms Neil Abercrombie served in
the 105th Congress; it does not justify inventing exact dates from either year-only API representation.

The hydration code unioned collection and detail terms by ID, despite their different identities. Commit
`57d1916` makes the complete member-detail snapshot authoritative. Existing provider-scoped replacement in
`upsertEntitySnapshot` can remove superseded collection terms when those people are replayed. No manual
term deletion, date inference, or person-specific exception was added. A regression test covers a career
summary and its Congress-specific detail, duplicate member input, and preservation of unknown exact dates.

Both runtime corrections deployed successfully to Trigger production **20260908.8**, deployment
[`og3wxg18`](https://cloud.trigger.dev/projects/v3/proj_bsjukvltatwjsyczuatb/deployments/og3wxg18), with 26 tasks.
The earlier 20260908.7 attempt failed on a Depot network timeout and is not accepted as a successful release.
The 16 focused normalization/hydration tests and repository pre-push types passed. Full repository verification
is not a green acceptance gate: an earlier pass failed in scoring, and a later pass was invalidated by overlapping
coverage runs sharing an output directory. An isolated smoke-foundation rerun passed all 51 tests. The final
legislation coverage rerun used a separate report directory and two workers to avoid that collision: **2,438
tests passed, 60 skipped**, across 254 passing files and four skipped files. The four standalone webhook
verification receiver tests also passed. This does not retroactively make the repository-wide run green.

At the initial release, production replay and authenticated response verification remained open: the guard observed the
active Congress wave and prevented overlapping writes. Do not mark the inventory or data repair complete solely
because the importer fixes are deployed. Replay the one vote, affected amendments with full action/text bundles,
and affected people through their standard importers after the wave is idle; verify canonical IDs, unchanged vote
choices, preserved amendment content, and removal of superseded terms. Broader fuzzy/contextual alias checks
remain outside the exact-name census above.

The first Congress child `run_06g84bno61ekhbegv374snak01` completed; the same coordinator subsequently started
`run_06g84ktqa0kpamd6v3stdf2901`, which was still executing at the final replay check. Therefore completion of
the first child alone is not clearance to replay. A fresh Congress.gov member detail read for A000014 returned
the 105th-Congress House term with startYear 1997 and endYear 1999, confirming the regression fixture against
the live primary source.

## Vote-gap diagnosis, September 8

All 432 null links belong to `vote:congress:house-119-2-74`, the February 24, 2026 House vote on H. Res. 1075.
The [official Clerk roll call](https://clerk.house.gov/Votes/202674) reports 208 ayes, 187 noes and 37 not voting.
A fresh Congress.gov detail/member bundle normalized to the same 432 source Bioguide IDs and vote options, with
zero differences from the stored source positions. Every source ID maps exactly to an existing canonical person
whose `upstream_ids.bioguide` agrees; all 432 now pass `isVotePositionPersonLinkable`.

The importer deliberately saves null canonical links when the referenced person does not yet pass canonical
completeness checks. Existing source IDs, names and choices are retained. The current evidence identifies a stale
snapshot which the existing importer can relink; it does not prove exactly which completeness fields were missing
at the original import. No surname matching, person creation or identity-rule change is justified.

Initially, replay through `normalizeCongressHouseVote` and `upsertCongressHouseVoteSnapshot` was prepared, but its pre-write
guard stopped on active Congress wave `run_06g84bm7psjkgjpcqijdah0i01` and bills child
`run_06g84bno61ekhbegv374snak01`. No production changes occurred. Next recheck that the wave is idle, reread the
official bundle, replay only this vote through the standard importer, then verify all 432 links, unchanged choices,
and the authenticated vote-detail response. A replay after civic foundations load should reproduce the same links;
fresh-database loading order remains an operational dependency, not an exception to completeness checks.

## Approved repair and verification, September 8

The user approved temporarily pausing the hourly Congress schedule. Schedule `sched_6usga836c54zq2k4vehqm`
was deactivated, then coordinator `run_06g84bm7psjkgjpcqijdah0i01` and its current bills child
`run_06g84ktqa0kpamd6v3stdf2901` were cancelled. PostgreSQL was checked for residual work before repair.
The committed checkpoint was preserved; no watermark reset or manual lease deletion was used.

| Repair | Production result | Authenticated API evidence |
| --- | --- | --- |
| House vote 119/2/74 | Standard importer restored all 432 exact Bioguide links; zero remaining null links or changed choices. | Detail returned 200; five position pages contained 432 unique positions, all with the expected canonical person ID. Totals remain 208 yes, 187 no, 37 not voting. |
| Amendment sponsor names | All 416 fresh source records normalized successfully; only missing `sponsor_name` and `updated_at` were updated. Zero unnamed nonperson sponsors remain. | All 416 detail responses returned 200 with the exact normalized committee name and a null person, as intended. |
| Member terms | Replayed authoritative Congress detail terms for 1,402 affected people, then five additional House-to-Senate transitions with untitled collection remnants. | Census and deployment verification are recorded below. |

The term repair replaced only each affected person's Congress-provider terms, atomically, using the production
normalizer. Four bounded workers used 15-second statement and five-second lock limits. It did not run a partial
jurisdiction-wide replacement, which would deactivate unrelated people. The amendment repair likewise avoided
replacing incomplete action/text bundles: actions, supporting materials, extracted content and embeddings were untouched.
These are source replays of generic importer corrections, not person-specific identity rules.

The five additional members were Jim Banks (`B001299`), Lisa Blunt Rochester (`B001303`), John Curtis (`C001114`),
Ruben Gallego (`G000574`) and Elissa Slotkin (`S001208`). Fresh Congress member detail explicitly identifies
each one's 119th-Congress Senate term starting in 2025. Year-only facts remain year-only; no exact dates were inferred.

Before resumption, the database contained **10,755 legislative terms**, zero untitled terms, zero reversed exact
date bounds, and zero duplicate person/Congress/chamber groups among Congress terms. Organization memberships
were unchanged at **54,799**, including **3,871 active**. No people were merged or renamed.

The initial 1,402-person API census passed 1,400 records. George E. Brown Jr. (`B000918`) and Floyd Spence
(`S000718`) returned 422 because the deployed API still lacked the `historical_at_first_observation` end reason
already emitted by the importer. Both records passed the current query and canonical projection against production
data. Their memberships were not rewritten to disguise the deployment mismatch. The other five replayed people
also passed API verification, bringing predeployment acceptance to 1,405 of 1,407.

Railway deployment `5b83e53a-7af3-4588-98cd-9e99b4bee9d8`, uploaded from main snapshot `89ec1e7`, reached
terminal **SUCCESS**. It replaces `c5c397c8-4c45-4ff7-9561-9d66da55305d` and includes the already-committed
membership end-reason support. Both previously failing person endpoints now return 200: the combined census
is **1,407 of 1,407 passed**, with zero failed requests remaining. Health, readiness, Abercrombie person detail,
the corrected Rules Committee amendment, and the repaired vote detail each returned 200 after deployment.
The census combines the predeployment checks with targeted postdeployment rechecks; it is not a second full census.

The hourly Congress schedule was reactivated, and exactly one catch-up coordinator was dispatched with idempotency
key `identity-repair-20260908-resume`: `run_06g853d10it3r9rilcrepa7h01`. The saved bills checkpoint retained
watermark `2026-09-04T19:01:36.935Z` and canonical cursor `bill:us:99:sres:492` before resumption. Other previously
inactive Congress schedules were left inactive.
Read-back confirmed the coordinator **EXECUTING on 20260908.8**, with children
`run_06g853f3rh563c7j6lfi3ra601` and `run_06g853f3ptbkuug4v6v08h1p01` executing. This confirms resumption,
not completion of the new recurring wave.

The final focused projection, person-detail and amendment checks passed **27 tests across four files**. A fresh
`pnpm verify` passed its check stage but failed repository-wide coverage: scoring's canonical-corpus scenario test
exceeded its five-second timeout, and web's workflow-deletion confirmation test also failed before Turbo stopped.
Those unrelated failures were not edited or bypassed. Earlier isolated legislation coverage results above remain
separate evidence; the full repository gate is not green.

Broader fuzzy/contextual alias review remains open under IDN-101; the bounded source-backed repairs above do not
claim to resolve every possible identity ambiguity.
