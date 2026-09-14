# Open States rollout requirements and results

Scope: North Carolina first; validate before adding another jurisdiction. A checkbox means the pilot requirement has
passed real-data validation and required persistence/replay checks, not merely that code exists. No automatic national
rollout. California and credentialed jurisdictions enter last, after their current requirements are checked.

## Data requirements

| Complete | Data type | Pilot acceptance | Historical scope and limitations |
| --- | --- | --- | --- |
| [ ] | People and external identifiers | Current roster, exact OCD person IDs, aliases, deduplication | Import available retired people and identifier history; inventory date coverage first. |
| [ ] | Legislative service and districts | Chamber, district, party, source-supplied terms | Preserve supplied dates; unknown dates remain unknown. |
| [ ] | Committees and subcommittees | Identity, chamber, hierarchy, source links | Inventory prior snapshots; current files do not establish complete history. |
| [ ] | Committee memberships | Every member resolved; separate return tenures; safe departures | Reconstruct only available dated observations; detected dates are not actual appointment dates. |
| [ ] | Bills and resolutions | Current-session extraction and canonical reconciliation | Retained session archives; report available sessions per state. |
| [ ] | Bill actions and status | Ordered actions and source dates | Coverage follows available bill archives. |
| [ ] | Sponsorships | Sponsor relationships resolve to canonical people | Coverage follows available bill archives and identity resolution. |
| [ ] | Votes and individual positions | Roll calls, totals, member votes reconcile | Inventory session coverage and unavailable individual votes. |
| [ ] | Bill versions and documents | Source links, text extraction, OCR when needed, search indexing | Inventory downloadable versions; unavailable source files remain visible gaps. |
| [ ] | Bill relationships | Referrals, related bills, committee links where supplied | Do not infer absent relationships from names alone. |
| [ ] | Meetings and events | Supported event scraper, dates, participants and documents | Measure upstream archive reach; do not promise all past meetings. |
| [ ] | Agenda items | Ordered items and explicit bill relationships | Only source-published agendas; not inferred outcomes. |

## Operational requirements

- [x] Select North Carolina and identify immutable source revisions.
- [x] Compare the retained August 17 nationwide archive manifest against live import checkpoints.
- [x] Complete a validation-only people/committee run with no unresolved relationships.
- [ ] Independently reconcile roster completeness, including the 49-person Senate snapshot.
- [x] Diagnose missing Senate District 1 and reject incomplete or duplicate district coverage.
- [x] Replay the retained pilot offline with file checksums and source-tree completeness checks.
- [x] Inventory all pinned NC retired-person files and report missing service dates without inferring them.
- [x] Check retained historical dates for calendar validity, reversed dates, and strict full-date tenure overlaps.
- [x] Implement immutable archive publication and verify local read-back, idempotency, and corruption rejection.
- [x] Archive the current people/committee pilot in Azure `state-sources` and verify remote read-back and rejection preservation.
- [x] Archive the retired-person history in Azure and reproduce the inventory from checksum-verified remote files.
- [x] Inventory legislative roles from current and retired files together, preserving source paths and unknown dates.
- [x] Run entity transaction integration tests against isolated local PostgreSQL, including historical term protection.
- [ ] Package and validate the upstream bills/events extraction runtime.
- [x] Build the pinned local acceptance image and pass offline startup for both NC lanes.
- [x] Complete real NC event extraction and retain checksummed artifacts in Azure.
- [x] Bound bill attempts to explicit identifiers and complete a real two-bill batch with Azure read-back.
- [ ] Retain raw artifacts durably and make replay reproducible.
- [ ] Promote atomically with correct tenure reconciliation and checkpoint handling.
- [ ] Verify retries, timeouts, publisher throttling, and non-overlap in Trigger.dev.
- [ ] Validate API/MCP reads and representative ID mapping after import.
- [ ] Finish a seven-day single-state observation period before expansion.
- [ ] Inventory ordinary states and onboard them individually after pilot acceptance.
- [ ] Add credentialed jurisdictions and California's special database runtime last.

## Result history

| Date | Run or change | Result | Production effect |
| --- | --- | --- | --- |
| 2026-09-14 | Source inventory at people revision `677c6d0a566ad9bd62b6324e502af76acc3d22f3` | 169 NC legislature files and 94 committee files discovered; not yet evidence of complete coverage. | None. |
| 2026-09-14 | Validation-only run `1789397722441-6890806d-c02a-4bdf-92ff-12a390dcaf42` | Passed: 169 people (120 lower, 49 upper), 94 committees, 1,678 memberships, zero unresolved member IDs. Raw YAML and checksums retained. This is identity/structure validation, not independent roster completeness. | No database writes or schedules. |
| 2026-09-14 | Adapter verification | Five focused tests and legislation type checks passed. Root checks passed; full verification stopped on an unrelated Shopify size-chart test timeout (5 seconds). | None. |
| 2026-09-14 | Independent Senate District 1 check | Official NCGA roster and biography list Jerry Tillett, appointed September 3, 2026. The latest pinned Open States snapshot lacks District 1. This is a source omission, not a current vacancy. No identity was invented. | Promotion remains blocked. |
| 2026-09-14 | Completeness gate and offline replay | Seven focused tests passed. Replaying all 263 retained files now correctly returns `rejected`, with `upper/1/count=0`, despite zero unresolved committee member IDs. The earlier validation result covered structure/identity only. | No database writes. |
| 2026-09-14 | Historical file inventory | Pinned NC directory also contains 358 retired-person files. Their term coverage and date ranges are not yet validated; file count is not historical completeness. Four executive and 21 municipal files are outside this legislative pilot. | None. |
| 2026-09-14 | Historical content inventory `1789399573639-94b8a6f2-7157-4ef6-bbe1-5fe10777fc75` | Parsed all 358 retired files: 334 people with 362 NC legislative roles. Earliest supplied start 2003-01-01, latest supplied end 2026-08-24. 114 roles lack starts; zero lack ends; no partial dates or reversed equal-precision dates found. These extrema do not prove continuous coverage since 2003. | Raw files and checksums retained locally; no canonical writes. |
| 2026-09-14 | Activity check | No local pilot process was active before this run. Recent Trigger results showed passage synchronization executing; it was left untouched. Direct PostgreSQL status could not be read because connection/query failed. Only isolated local validation was run. | No remote jobs launched or modified. |
| 2026-09-14 | Historical inventory verification | Four focused history tests passed. Root static checks passed. Legislation suite: 2,643 passed, 74 skipped; four receiver tests passed. Full `pnpm verify` with `TURBO_CONCURRENCY=2` still running (local session 8182); do not start a duplicate verification. Shopify tests passed this run. | No deployment. |
| 2026-09-14 | Verification completion | Previous full `pnpm verify` exited successfully with `TURBO_CONCURRENCY=2`; all nine test tasks passed. Session 8182 is finished. | None. |
| 2026-09-14 | Historical date validation | Eight focused tests passed before final lint correction. Checksum-verified offline re-read of all 358 files found no impossible dates, reversed dates, or strict full-date overlaps in the 362 legislative roles. All 114 unknown starts remain unknown. Same-day transitions are allowed; unknown-date overlap cannot be determined. | No database writes. |
| 2026-09-14 | Date validation final verification | Full `pnpm verify` passed with `TURBO_CONCURRENCY=2`. Legislation: 2,647 tests passed, 74 skipped, plus four receiver tests passed. Session 16696 finished successfully. | No deployment or remote job changes. |
| 2026-09-14 | Archive implementation and local canary | Four archive tests passed. Copied 263 YAML files plus tree/report metadata (265 objects) to an isolated local archive; verified read-back and reproduced the expected missing-seat rejection. No overwrites; a completion manifest is written last. | No canonical writes. Azure verification pending. |
| 2026-09-14 | Azure archive canary | All 265 objects uploaded to the existing `state-sources` container and read back with verified hashes. Completion marker: `openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/entities/1789397722441-6890806d-c02a-4bdf-92ff-12a390dcaf42/complete.json`. Replay correctly remains rejected for missing upper district 1. | New immutable source artifacts only; no canonical database writes, permissions changes, or deployments. |
| 2026-09-14 | Archive final verification | Full `pnpm verify` passed with `TURBO_CONCURRENCY=2`: legislation 2,651 passed, 74 skipped, four receiver tests passed. Session 98539 completed. | No deployment. |
| 2026-09-14 16:30 UTC | Activity check | No local onboarding process was active. Recent Trigger results showed passage synchronization run `run_06ga1g92e5oj044spnf2tp6n01` executing; left untouched. Database activity remains unavailable after connection/query failure. | No remote jobs started or interrupted. |
| 2026-09-14 | Historical Azure archive and replay | Archived 358 retired YAML files plus tree/report metadata, then verified remote checksums and re-ran the inventory: 334 people, 362 roles, 114 unknown starts, no date issues. Seven archive tests passed, including rejection of mixed current/history lanes. Manifest is under `nc/history/1789399573639-94b8a6f2-7157-4ef6-bbe1-5fe10777fc75/complete.json` at the pinned people revision. | Immutable Blob artifacts only; no canonical writes. Historical completeness remains unproven. |

Historical archive final verification: full `pnpm verify` passed with `TURBO_CONCURRENCY=2` on September 14, 2026.
Legislation: 2,654 passed, 74 database-dependent tests skipped, plus four receiver tests passed. Session 94677 finished;
no archive or verification process remains active from this check-in. No deployment or canonical import occurred.

Combined people inventory, September 14, 2026: checksum-verified 169 current and 358 retired files (527 total).
They contain 503 people with 577 NC legislative roles; earliest supplied start is 1996-05-09, not the retired-only
2003 minimum. There are 120 missing starts and 169 open ends, with no date issues. Open ends in current files are
not flagged as retired-source errors. No dates were inferred and no canonical records were written. Ten focused
history tests passed. This confirms why a history import must include current people, not just the retired folder.
Current/retired duplicate identities are rejected for review, and every role retains its source file path.

At the 17:01 UTC activity check, no local onboarding process was running. Recent Trigger results showed
`congress-wave-coordinator` and passage synchronization active; neither was modified. Database activity remained
unavailable. The existing current-person normalizer emits one current term; full source-role promotion is still pending.

Live archive audit, September 14, 2026: `DATABASE_DIRECT_URL` successfully supports read-only queries; the pooled
`DATABASE_URL` returned PostgreSQL `08P01`. The database has 627 non-federal sessions across all 52 supported
jurisdictions. Every one of the 624 archives in Azure
`manifests/openstates/session-json-2017-onward-2026-08-17.json` has a matching `complete: true` checkpoint.
This proves completion against that retained manifest, not against newly published archives or every child record.
The public index returned HTTP 200 but no discoverable archive links, so latest-source comparison remains open.
Do not classify the other checkpoint streams as failed archive imports without identifying their lane.

NC bill counts match all eight completed archive checkpoint indices: 2017=1,953; 2017E1=12; 2017E2=8;
2017E3=9; 2019=2,109; 2021=2,095; 2023=2,005; 2025=2,338. No NC archive reload is indicated by these checks.
There are zero NC legislative-term rows. Nationwide, zero legislative terms and zero organization memberships have
`source_provider = 'openstates'`; source-null rows were not classified by that query. Organization source counts are
OpenStates=1, null=385, Congress=243, GovInfo=850. This distinguishes bill-history completion from entity-history
readiness. No production writes, reloads, or deployments were performed during this audit.

Combined history verification completed successfully: full `pnpm verify`, session 59475, 2,656 legislation tests passed,
74 skipped, four receiver tests passed. Subsequent archive audit changes are documentation-only.

Term mapping implementation, September 14, 2026: `people-term-plan.ts` maps the combined retained sources to 577
canonical term candidates, preserving 120 null starts. Identity excludes the end date and current/retired file location
so closing a term does not create a duplicate. Distinct starts produce separate identities; indistinguishable
unknown-start terms and partial-precision dates block normalization rather than being merged or rounded. Historical
party and office titles remain null until source-backed mapping exists. Three focused tests passed. This is a plan,
not a production import: people persistence and atomic promotion remain unfinished. Corrections to identity-bearing
start dates will require reconciliation, not blind upsert. The archive CLI reports planned term counts for historical
replay. Full verification passed in session 33745: 2,659 legislation tests passed, 74 skipped, and four receiver tests
passed. The session is finished. No production writes occurred.

People import implementation, September 14, 2026: `import:openstates-people` reads the two immutable Azure manifests,
verifies their lanes/checksums, prepares current and retired people plus terms, and defaults to validation-only.
Explicit `--apply` uses the existing transactional snapshot writer only after roster acceptance. People, terms and
checkpoint share one transaction; organization replacement is disabled and unobserved people/terms are preserved.
Protected term imports take a transaction advisory lock and reject reactivation of an existing ended term. Three
focused import tests passed. A database integration test covers preservation and ended-term rejection but requires an
isolated test database; it must never be pointed at production.

The real Azure dry run prepared 503 people and 577 terms, then exited 1 with `upper/1/count=0` and
`canonicalWrites=false`. This is the expected safety rejection, not a completed import. Atomic database integration
and positive production/API acceptance remain open. The directory-specific upstream committee history contains 51
commits at the pinned revision, from 2021-05-06 through 2026-08-27 (2021:8, 2023:2, 2024:15, 2025:16, 2026:10).
Commit dates are repository observations, not appointment dates; renamed/older paths and snapshot semantics still need
review before this becomes a historical-membership import. No committee history was written.
The oldest directory snapshot (`eb1a5ec1e1e3c137eac8bd869efea92e09241440`) has 60 committee files in a non-truncated
tree. Its sampled Agriculture file uses `parent: lower`, lacks the current jurisdiction/chamber fields, and contains
at least one `person_id: null` entry (B. Jones). Historical parsing therefore needs an explicit source-format adapter
and unresolved-ID reporting; the current snapshot validator cannot simply be reused, and name-only matching is forbidden.
This is one sampled file, not an all-committee historical audit.

Import implementation verification finished: full `pnpm verify` passed in session 51957, with 2,662 legislation tests
passed, 75 database-dependent tests skipped, and four receiver tests passed. No positive database-import acceptance
is claimed; the Azure rejected-source dry run completed without writes. Production remains gated by roster completeness
and isolated database integration verification.

Historical committee parser and real-data runs, September 14, 2026: raw files and checksums are retained under
`artifacts/openstates-committee-history/`. The parser supports explicit old `parent` chamber values, preserves multiple
different roles for one person, rejects exact duplicate assignments, and never derives departures or effective dates.
Missing person IDs are reported, not guessed. Year samples are not a complete replay of the 51 commits:

| Snapshot | Commit | Committees | Role entries | Missing person IDs |
| --- | --- | --- | --- | --- |
| 2021 | `eb1a5ec1e1e3c137eac8bd869efea92e09241440` | 60 | 1,027 | 12 |
| 2023 | `42887e2ad272ebee1461c831e9edd857a0987acd` | 93 | 1,522 | 142 |
| 2024 | `3f463a03b5bba4684badf4fd4d7528a4a335031d` | 98 | 1,507 | 0 |
| 2025 | `3bb3a7e04b87ec19a64f02718c88dd4a39d2579b` | 88 | 1,515 | 0 |
| 2026 | `cec7dd8d4a9febc709b07513823c84fb2e4fa36f` | 94 | 1,678 | 0 |

The 2023 initial parser rejected Norman W. Sanderson's separate co-chair and ex officio roles. After correcting that
assumption, checksum-verified replay of all retained files produced the above counts. Its original failure marker
remains; no successful download report was fabricated. Presence of person IDs is not canonical identity reconciliation.
Full `pnpm verify` passed after the correction (session 80730). All inventory processes finished; no production writes.

Read-only coverage audit: NC has 30,315 processed bill documents and one unsupported document, but zero legislative
events. State events exist in 14 other jurisdictions; federal events number 33,164. The pinned NC event scraper reads
the current legislative calendar and has no historical-window argument; it is not evidence of past-meeting coverage.

Local database verification remains blocked: test connection returns `ECONNREFUSED`. Starting Docker Desktop and
`docker desktop start` both failed to make the Linux engine available. Docker's backend log reports inability to rename
`sailor-ingest.sock` (Windows error 1920); moving that temporary socket failed and removal was blocked by execution
policy. No Docker reset, volume deletion, or database deletion occurred. User requested local Docker rather than an
external temporary database. Do not provision an external test database under the earlier unanswered request.

Docker recovery follow-up, September 14, 2026: after the user reopened Docker, engine 29.7.2 responded. Started the
repository's local pgvector PostgreSQL service with Compose; verified the target database was local `legislation_test`
with no other sessions before running the destructive test-fixture setup. All 20 entity integration tests passed.
The first pass exposed interference from the new test's unnecessary committee fixture; changing it to a people-only
fixture removed that interference. Existing membership tests and the new ended-term/absence safeguards all pass.
Only isolated test schemas were created/dropped; no production rows or Docker volumes were deleted. The local database
is left running for subsequent tests. Positive end-to-end source import is still blocked by the incomplete NC roster.
Final repository verification also passed: 2,667 legislation tests passed and 75 database-dependent tests were skipped
in the default run; the 20 entity integration tests were separately run with the local database enabled and all passed.
Session 3972 completed successfully. Four receiver tests passed as well.

Independent validation references (not additional ingestion providers):
[NC Senate roster](https://www.ncleg.gov/Members/MemberTable/S) and
[Jerry Tillett biography](https://www.ncleg.gov/Members/Biography/S/1003).
Do not bypass the incomplete-roster gate or fabricate an OCD identifier. Continue independent runtime/history work
while the approved Open States source is missing the member. A confirmed vacancy also needs an explicit reviewed
coverage policy; the validator does not silently interpret an absent district as vacant.

Run locally from `apps/legislation`:

```sh
pnpm eval:openstates-pilot
pnpm replay:openstates-pilot artifacts/openstates-pilot/<run>
pnpm eval:openstates-history
pnpm archive:openstates-pilot artifacts/openstates-pilot/<run> artifacts/openstates-archive-canary
pnpm archive:openstates-pilot artifacts/openstates-history/<run> azure history
```

Output is under ignored `artifacts/openstates-pilot/<run>/`. `report.json` reports validation and unresolved identities;
`failure.json` records interrupted downloads. The command has a ten-minute source deadline and 30-second request
timeouts. It calls the pinned Open States people repository, not the hosted Open States API. It cannot promote data.
The snapshot is current-state only; this first adapter does not yet import historical terms or retired people.
The separate history command inventories retired YAML into ignored `artifacts/openstates-history/<run>/report.json`,
including every source role and missing-date counts. It is not a history import and does not close the historical
coverage requirement. Historical party alignment and completeness still require review; overlap cannot be established
where source dates are missing. Date checks do not independently prove the source's assertions match real events.

The archive command also accepts `azure` as its destination and uses the existing `AZURE_STORAGE_ACCOUNT`, default
Azure credential chain, and `state-sources` container. It does not provision a container or change permissions.
The source run must have a complete tree/report and valid checksums; a rejected roster may be archived for diagnosis.
Objects use `openstates/people/<revision>/nc/entities/<run>/files/` and an immutable `complete.json` marker. Retry the
same run safely: identical objects are reused, conflicting bytes fail, and incomplete uploads have no new completion
marker. Read-back verifies the marker, file sizes, hashes, revision and tree coverage before running validation again.
Cloud archive success does not authorize canonical promotion or close roster completeness.
The optional `history` lane archives only retired-person files under `nc/history/<run>/`; replay selects the historical
inventory validator rather than the current-roster validator. Both lanes enforce complete source-tree coverage and
reject files from the other lane. Historical files and metadata are now durably retained, but importing their roles
and verifying historical coverage remain separate requirements.

See [the rollout milestones](../engineering/self-hosted-openstates-milestones.md) for the full activation gates. Election results,
candidates, and inferred committee outcomes are not added to scope by this checklist.

### Full people-import database verification (2026-09-14)

- [x] All 21 entity PostgreSQL integration tests passed against the isolated local `legislation_test` database.
- [x] The full North Carolina importer persisted 170 synthetic current people and one retired person with 171 terms.
- [x] Unknown start dates stayed null; the ended term stayed inactive; repeat import retained the same term IDs.
- [x] Removing a current seat rejected the subsequent import and left stored terms and the checkpoint unchanged.
- [ ] Production promotion remains blocked by the pinned source snapshot's missing upper-chamber district 1 member.

These are synthetic transaction tests, not evidence of historical source completeness. No production import was run.

### Historical committee identity audit (2026-09-14, 18:30 UTC)

No local onboarding command or database index build was active. The bounded Trigger query returned no executing or
queued runs. Existing services were left untouched. Checksummed committee samples were compared with all 503 retained
NC legislative people, using exact primary IDs only:

| Snapshot | Committee role entries | Missing member IDs | Non-null IDs absent from primary people IDs |
| --- | --- | --- | --- |
| 2021 | 1,027 | 12 | 22 entries across four people |
| 2023 | 1,522 | 142 | 4 entries for one person |
| 2024 | 1,507 | 0 | 5 entries for one person |
| 2025 | 1,515 | 0 | 0 |
| 2026 | 1,678 | 0 | 0 |

The retained Bobby Hanig and Sarah Crawford files explicitly declare two of the older IDs in `other_identifiers`.
The people importer now preserves that source field alongside `identifiers`, deduplicated by scheme and value.
This is source-declared identity evidence, not name matching. It does not yet resolve or promote historical committee
memberships; ambiguous identifiers must fail reconciliation. Three other distinct absent primary IDs remain to research.

- [x] Audit sampled historical committee references against retained people IDs.
- [x] Implement retention of source-declared former identifiers.
- [ ] Resolve remaining historical IDs and validate uniqueness before committee promotion.

Verification: four focused importer tests passed; full `pnpm verify` passed (2,668 legislation tests passed,
76 database-dependent tests skipped, four receiver tests passed). No production import or deployment occurred.

### Former legislators in other office folders (2026-09-14)

All three remaining non-null sampled committee IDs are explained by the pinned source: Jeff Jackson's primary ID is
in `executive`, Rachel Hunt's primary ID is there too, and Hunt's `other_identifiers` explicitly supplies her former ID.
No name-only mapping or manually invented identity was used. The history collector, validator and archive completeness
gate now include `retired`, `executive`, and `municipalities`; only NC upper/lower legislative roles become terms.

The complete replacement history inventory is
`artifacts/openstates-history/1789411587916-8396c068-c0e1-4b61-9ecf-dc93be49f6e5`: 383 files, including 358 retired,
four executive and 21 municipal files. Combined with current legislators, 552 files contain 506 people with 581
legislative roles, 122 unknown starts and 169 open ends, with no date issues or conflicting source-declared person IDs.
The 21 municipal files add no NC legislative roles at this revision. These counts supersede the earlier 503/577 totals.

The older 358-file history archive and intermediate 362-file archive remain evidence, but do not satisfy the expanded
source-tree coverage gate and must not be used for promotion. Neither archive was overwritten or deleted.

- [x] Include former legislative service retained in other office folders.
- [x] Explain the three remaining non-null IDs using exact source IDs and declared former identifiers.
- [ ] Resolve committee entries with absent source IDs; historical completeness remains unproven.
- [ ] Promote current NC data only after the missing current Senate seat is resolved.

Twenty-two focused tests passed. Full `pnpm verify` passed: 2,669 legislation tests passed, 76 database-dependent
tests skipped, and four receiver tests passed. All 383 history files were archived in the existing Azure `state-sources`
container and remotely read back with verified checksums. The replacement manifest is
`openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/history/1789411587916-8396c068-c0e1-4b61-9ecf-dc93be49f6e5/complete.json`.
No canonical database writes or deployment occurred.

### Six-item automated NC closeout

The approved closeout covers the NC pilot, not nationwide activation. Keep each gate open until operational evidence
exists; a passing unit test is not a production import or seven days of observation.

| Gate | Required machine-checkable outcome | Status |
| --- | --- | --- |
| Source coverage | Complete current district roster; every historical discrepancy explicitly classified | Blocked on current source omission; historical identity reconciliation implemented |
| Historical committees | Repeatable exact-ID reconciliation; missing/ambiguous IDs reported; dated observations preserved | Implementation in progress |
| Production import | Canonical records and checkpoint commit together; replay stable; ended tenures protected | Local transaction tests passed; production not run |
| Extraction runtime | Pinned extraction-only build; bounded requests/runtime; immutable output and validation | Not deployed; user confirmed GPL review resolved |
| Recurring sync and reads | Lease/retry/failure drills and authenticated API/MCP acceptance on imported records | Pending runtime and import |
| Seven-day observation | Actual scheduled-run history satisfies the documented canary acceptance gate | Not started |

The user confirmed on September 14, 2026 that the planned deployment's GPL review is resolved. This clears the review
dependency, not the implementation obligations: retain notices/license, pinned corresponding source and modifications,
and apply the reviewed distribution policy to the scraper artifact. Runtime build and activation tests remain pending.

Historical identity reconciliation is now executable, not a manual correction list:

```powershell
node --env-file=.env --import tsx scripts/reconcile-openstates-committees.ts <committee-directory> <current-manifest> <history-manifest>
```

The command verifies committee source-tree coverage and hashes, remotely verifies both people archives, and resolves
only primary or explicitly declared former Open States IDs. It reports `missing_person_id`, `unknown_person_id`,
`ambiguous_person_id`, or `no_legislative_service`; unresolved output returns exit code 1. It never writes canonical data
or infers departures. It requires a successful retained committee report, not an incomplete failed download.

Real reconciliation canary: the retained May 6, 2021 snapshot, replayed against both checksum-verified Azure people
archives, resolved 1,015 of 1,027 role entries automatically. The remaining 12 have no source person ID and produce
`needs_review` with exit code 1. No database writes occurred. This replaces manual investigation for repeatable ID
matching, but does not yet implement membership promotion or establish complete historical coverage.

Reconciliation verification completed: three focused tests passed; full `pnpm verify` passed on retry with 2,672
legislation tests passed, 76 database-dependent tests skipped, and four receiver tests passed. The preceding coverage
run failed because its temporary coverage directory disappeared; no test failure was reported by that run.

### Extraction process boundary

`python/openstates_runner.py` adds the NC-only extraction launcher. It forces `--scrape`, an explicit bill session,
the pinned scraper revision, and a maximum 1,500-second runtime. Event extraction accepts no historical session claim.
The child receives an environment allowlist rather than database/cloud/Trigger credentials, runs in a private work
directory and Linux process group, and is killed with its descendants on timeout. Raw stdout/stderr are not forwarded
to task logs. An attempt result is retained; callers must archive and validate output before promotion or cleanup.

This is not yet a packaged upstream runtime: the pinned dependency build, build provenance verification, publisher
request hardening, artifact integration and Trigger wiring remain pending. `UPSTREAM_REVISION` is a build stamp checked
by the launcher, not independent proof of all packaged source bytes. Test with `pnpm test:openstates-runner`; real
subprocess tests require Linux and use a local fixture module, not the NC publisher or production data.

Linux runner evidence: all five tests passed with networking disabled in
`python@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea`.
The tests exercised real child-process success, nonzero exit, and a one-second deadline, plus input validation and
credential exclusion. The disposable test container was removed; the downloaded base image remains locally cached.

### Pinned build inputs and output integrity

The [build preparer](openstates-runtime-build.md) retained 494 checksummed files locally in
`artifacts/openstates-runtime/locked-build-inputs`, including the complete pinned upstream archive, license,
source, dependency lock, and hash-locked requirements export. No upstream source was added to the TypeScript package.
An earlier preparation directory is incomplete and lacks `build-inputs.json`; it must not be deployed.

The runner now retains startup failures, rejects exit-zero attempts with missing or unsafe output, inventories output
hashes and byte counts, and keeps semantic acceptance explicitly false. This is not production import completion.

Build verification encountered external download failures: the configured npm registry returned HTTP 401, a public
npm metadata attempt failed its TLS handshake, and the isolated Linux pip dependency dry run exhausted retries with
a TLS handshake failure to `files.pythonhosted.org`. TLS verification was not disabled. Python dependencies and
the Trigger Python extension were not installed; image startup and deployment remain unverified.

Verification for this unit: all 12 Python build-input/runner tests passed in the network-disabled Linux container.
Full `pnpm verify` passed with all nine coverage task groups successful. This verifies local implementation, not a
live scraper build, production import, or the seven-day scheduled observation gate.

### Offline build replay verification

Package downloads were retried: Linux pip still failed TLS negotiation with `files.pythonhosted.org`, and a direct
Windows HTTPS request to public npm also failed SSL negotiation. No TLS checks or version pins were relaxed.

Added offline verification that reconstructs expected source and requirement files from the digest-pinned archive.
Missing, extra, linked, modified, and falsely re-checksummed files are rejected. Generated files now use identical
UTF-8/LF bytes on Windows and Linux. The portable build inputs are retained at
`artifacts/openstates-runtime/verified-build-inputs`. Cross-platform replay caught and fixed an additional difference:
path ordering now uses explicit POSIX-relative strings rather than platform-specific path comparison. Earlier
`portable-build-inputs` and `locked-build-inputs` directories predate the final portable manifest contract.
The real 494-file bundle prepared on Windows passed offline reconstruction and verification in Linux. All 15 Linux
tests passed; Windows passed 11 applicable tests with four Linux-only tests skipped. This does not clear the runtime
installation or deployment gates.

Full `pnpm verify` passed on retry with all nine coverage task groups successful. The first attempt failed when
Vitest's temporary coverage directory disappeared; no overlapping test process was found before retrying. The cause
of that intermittent coverage-directory loss remains undiagnosed and is not a scraper-runtime failure.

### Approved feed authentication and archive handoff

The user confirmed that the machine intentionally blocks public npm and approved refreshing the configured private
feed sign-in. The installed Microsoft `ado-npm-auth` tool refreshed Azure Artifacts authentication successfully.
The approved feed then returned and installed `@trigger.dev/python@4.5.10`. No registry change, public-feed bypass,
TLS weakening, or token disclosure was used. The user will provide the approved Python feed details; Python package
installation remains pending that information.

Trigger configuration now packages the standard-library adapter through the official Python extension. It does not
yet install upstream scraper dependencies, package the upstream source, or activate scraper tasks/schedules.

Added the TypeScript scraper-attempt archive/replay handoff and CLI. It validates lane/session ownership and runner
status, rejects unsafe/duplicate paths and checksum mismatches, verifies create-only uploads, and retains failure
status without advancing canonical checkpoints. Six focused archive tests passed. A live Azure failure-fixture
retention and replay succeeded twice at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/fixture-retention-20260914/retained.json`.
This fixture has zero raw files and is explicitly failed; it proves archive plumbing and identical retry behavior,
not a successful source scrape or production import.

A fresh GitHub check found the last NC legislature-source change still dated August 31, 2026. The current-roster
source omission therefore remains open; no identity was invented or coverage gate bypassed.

Verification: eight focused archive/configuration tests passed; full `pnpm verify` passed with 2,679 legislation tests
passed, 76 database-dependent tests skipped, and four receiver tests passed. No production deployment, canonical
import, or schedule activation occurred. Pending external input: approved Python package feed and authentication.

### Approved Python feed discovery and NC request hardening

The machine-wide `C:/ProgramData/pip/pip.ini` already configures the approved Microsoft Python feed at
`https://packagefeedproxy.microsoft.io/pypi/simple/`. Docker did not inherit that configuration. Explicitly passing
the existing feed allowed the locked package downloads, including the source-only `sgmllib3k==1.0.0` package.
The earlier pending-feed note is superseded: no additional feed information is required for this tested environment.
TLS verification and runtime dependency hashes remained enabled. A dedicated local Docker pip cache was retained.

The dependency dry run now exposes an upstream compatibility failure rather than a network failure:
`textract==1.6.5` declares `extract-msg (<=0.29.*)`, which pip 25.0.1 rejects as invalid metadata. Installation did not
complete. No older installer, unchecked install, or silently modified third-party distribution was substituted.
Source-only package build dependencies also need a pinned build toolchain before claiming reproducible installation.

Build preparation now applies exact-match reviewed changes to NC events and shared HTML helpers: verified TLS,
10-second connection and 60-second read timeouts, HTTP error rejection, and no insecure certificate-error retry.
NC bill-link requests use the scraper session rather than a separate unbounded request. Original upstream source
remains retained in the digest-pinned archive, and offline verification reconstructs the hardened source.
The current bundle is `artifacts/openstates-runtime/hardened-build-inputs`; the older `verified-build-inputs` bundle
predates the request policy and is not the current deployment candidate. All 494 hardened files verified in Linux.

The runtime installation, live source canary, production import, recurring activation, and seven-day observation gates
remain open. These changes do not resolve the current NC roster omission or authorize incomplete-roster promotion.

Verification: all 18 Python tests passed in network-disabled Linux; Windows passed 14 applicable tests with four
Linux-only skips. Full `pnpm verify` passed: all nine coverage task groups successful, 2,679 legislation tests passed,
76 database-dependent tests skipped, and four receiver tests passed. No production deployment or canonical writes.

### Installed runtime and live event extraction

The `textract` dependency blocker is resolved by a deterministic, checksum-gated metadata repair matching the retained
Poetry lock (`extract-msg <=0.29`). Original distribution bytes are retained. Executable code, package versions, and
licenses are unchanged; the derived wheel has its own build tag, RECORD, checksum, and replay-verifiable manifest.
The entire locked dependency graph installed successfully and `pip check` passed. Source-only builds use the pinned
setuptools bootstrap with build isolation disabled, not unpinned build dependencies.

Actual startup testing found Python 3.12 incompatible with upstream `six==1.12.0`. The Python 3.11 acceptance image
uses base digest `9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534` and successfully loaded the real
Open States 6.25.5 CLI plus both NC lanes. Its parser verified explicit scrape-only actions. The clean Dockerfile build
also succeeded, and its startup test passed with networking disabled. All 22 then-current Python tests passed in that
image. This is local runtime acceptance, not a Trigger deployment.

Two real NC event scrapes completed with three meetings each. The first exposed upstream's colon-containing metadata
filename, which the Windows-portable archive contract rejected. The runner now renames that exact known file before
inventory without changing its JSON bytes, rejecting collisions and unsafe names. The second scrape's seven files
were retained and read back from Azure at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/events/nc-events-live-20260914/retained.json`.
No canonical writes occurred. The raw event IDs are per-scrape UUIDs, and committee references can be unresolved name
expressions; these must not be treated as durable upstream entity identifiers during canonical promotion.

The existing 15-minute onboarding follow-up remains active. Current-roster completeness, historical committee
promotion, stable scraper normalization, Trigger deployment/activation, authenticated acceptance, and the seven-day
observation period remain open. The successful events extraction does not close those requirements.

The bill-lane canary uncovered a second source-routing issue: requesting `2025E1` returned a feed containing 1,092
Senate bills, including `S1092` filed July 27, 2026. The executable pilot now accepts only regular session `2025`;
unverified special/historical session routing is rejected before starting a child. The earlier special-session attempt
failed, retained four metadata files in Azure at `nc/bills/nc-bills-live-20260914/retained.json` under the same scraper
revision prefix, and performed no canonical writes. Direct diagnostics observed read timeouts; a separate bounded
request subsequently returned HTTP 200 and the mismatched feed. Successful transport did not establish session validity.

A regular `2025` canary extracted 51 bills and 23 votes plus four metadata files before its deliberate 90-second
deadline. One inspected example, SB 1092, retained 20 actions, one sponsorship, and six versions with the official
`https://www.ncleg.gov/BillLookUp/2025/S1092` source. All 78 files were archived and read back at
`nc/bills/nc-bills-regular-canary-20260914/retained.json` under the same revision prefix. The attempt remains timed out,
not complete, and was not promoted. No scraper container remained active afterward; the local test database stayed
healthy. This confirms extraction and timeout retention, not whole-session completeness. Recurring bill work requires
bounded batches rather than treating an entire large session as one short scheduled task.

### Bounded bill extraction verified

The executable pilot now rejects whole-session bill attempts. Each request specifies 1–10 unique bill IDs from one
chamber, and only regular session `2025` is accepted. The reviewed source patch requires every selected ID to appear
exactly once in the feed before yielding selected bills, then uses numeric ordering. A new filing cannot shift an
offset-based boundary because no feed offsets are used. Request IDs remain in retained attempt metadata. Timeouts
still fail safely; successful batches are not whole-session completion or canonical promotion.

The rebuilt local image passed dependency verification, `pip check`, network-disabled startup, and 27 Python tests.
Its image config digest is `f2444588e2eb3e50dd9bda285f421c4b7643138326ec2888e1b93786cc0cfe79`.
The current source manifest SHA-256 is `d332b3722b6718ff379f8b65c15ae2c78b5654081bafd326593f6776ae468b6b`.
The dependency manifest SHA-256 is `6bcf77e389439a651c714b122f1ac30bbb2fad4eded24f54aabd0db992342119`.
These bundles reside in `artifacts/openstates-runtime/batched-build-inputs` and `batched-dependency-inputs`.

A live batch requesting `S1091` and `S1092` completed with exit zero inside its 180-second deadline. Its two bill
records are SJR 1091 (22 actions) and SB 1092 (20 actions), both session 2025, with the corresponding official NCGA
BillLookUp source URLs. All 10 output files were archived and verified by read-back at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/nc-bills-batch-canary-20260914/retained.json`.
Local evidence: `artifacts/openstates-runtime/live-canary/openstates-nc-e42pidjp`.

The archive suite passed 13 tests. Final root `pnpm verify` passed: legislation 2,686 tests passed, 76
database-dependent tests skipped, and four receiver tests passed. The initial lint failure for a missing expected
error message in a new test was corrected before this successful verification. No production deployment or canonical
writes occurred. Remaining work includes durable whole-session discovery/scheduling, stable raw-record normalization,
historical committee promotion, deployed Trigger safeguards, authenticated reads, source roster completeness, and
the seven-day observation period. The existing 15-minute continuation schedule remains active; none was duplicated.
