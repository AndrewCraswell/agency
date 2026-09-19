# Washington onboarding

Washington is the next user-selected jurisdiction. Reuse the shared retained-source, batch ownership, promotion,
document/OCR, embedding and search pipelines. Do not activate schedules until the complete acceptance gate passes.
Initial extraction concurrency is one; retain the existing global content-worker ceiling and publisher limits while
North Carolina drains. No new provider, database or embedding model is approved by this onboarding.

## Requirements and evidence

| Complete | Requirement | Evidence or remaining work |
| --- | --- | --- |
| [x] | Inspect production archive baseline | September 19 2026 read-only query: 16,753 bills across five sessions below; historical-import runs exist for each |
| [x] | Reconcile the complete published archive inventory | All five catalog sessions have retained archives with verified stored checksums; refreshed current-session release compared across all 3,413 bills. This proves inventory coverage, not historical database field parity |
| [x] | Review pinned scraper and live source access | Pinned revision `d43f853796ceeeb49205f7d144790647764ce105` has bill and event scrapers; both 2025 and 2026 official bill inventory requests returned HTTP 200 without credentials |
| [x] | Freeze bounded current-session bill inventory | Both annual XML sources retained and replayed; 3,411 unique bills in 342 disjoint batches, with validated exclusions and source hashes |
| [ ] | Add Washington to shared extraction and promotion | Extend reviewed jurisdiction profiles and source policy, not a parallel ingestion engine; validate source/dispatch/build fingerprints |
| [x] | Run isolated bounded bill extraction in both chambers | HB 1000 and SB 5000 retained successfully; this is source extraction only, not canonical promotion or hosted activation |
| [ ] | Validate bill actions, documents and individual votes | Compare retained cases from both chambers to official pages, including substitutions, engrossments, resolutions and amendments |
| [ ] | Import and validate people and service history | Production import and replay verified for 336 people and 367 accepted terms; 20 historical conflicts remain quarantined. Current 147-member roster is complete; history acceptance remains open |
| [x] | Validate current people/committee snapshot with reusable district capacities | Shared validator accepts 98 House members, 49 senators, 51 committees and 609 membership assertions; zero unresolved member references; source snapshot, not production import |
| [x] | Import committees and memberships | Production import/replay verified for 51 committees and 609 current membership assertions. This does not establish complete committee detail profiles or historical memberships |
| [ ] | Import meetings and agenda items | Bound event windows, preserve Pacific time, stable source IDs and cancellation evidence; validate related bills/committees |
| [ ] | Complete document content pipeline | Extract text, OCR only when needed, preserve versions and source evidence, process eligible remaining content |
| [ ] | Complete embeddings and search synchronization | Reuse the existing approved model and shared pipeline; verify missing/stale vectors, lexical parity and canonical mapping |
| [ ] | Prove replay and recovery | Same inputs produce no duplicate entities; interrupted work resumes exactly; continuation chains retain their deployment version |
| [ ] | Verify authenticated API/MCP | Real Washington cases: bill, person, organization bills/meetings, meeting/agenda detail and lexical/semantic/hybrid retrieval |
| [ ] | Enable and observe regular syncing | Only after acceptance; verify a subsequent scheduled delta run, source failures and freshness reporting |

## Production baseline (2026-09-19 05:01 UTC)

| Session | Stored bills |
| --- | ---: |
| 2017-2018 | 3,953 |
| 2019-2020 | 3,972 |
| 2021-2022 | 2,322 |
| 2023-2024 | 3,093 |
| 2025-2026 | 3,413 |

The current-session official inventory returns 3,359 records for 2025 and 3,941 for 2026. Applying the pinned scraper's
scope (exclude gubernatorial appointments and initiatives, normalize bill versions) yields 3,411 unique bill identities.
Every one already exists in the database. `HB 3992` and `SB 7991` exist only in the database comparison and require
source/provenance review; do not delete them based on absence from this inventory. This comparison establishes identity
presence, not current actions, votes, documents or text freshness. The next import is a refresh, not an empty-state backfill.

## Source review and implementation hazards

- [Official legislative web services](https://wslwebservices.leg.wa.gov/) publish legislation, sponsors, committees,
  committee meetings, amendments and document links. Public access was verified, but endpoint availability is not
  evidence that the Open States scraper extracts every exposed field.
- The pinned bill scraper accepts `chamber` and `session`, not the shared runner's `bill_ids` parameter. Add bounded
  selection in the reviewed source policy before executing; never silently fall back to a full-session extraction.
- Current scraper session is `2025-2026`; the publisher's biennium is `2025-26`. Keep these distinct and validated.
- The bill scraper accumulates identities across chambers and later calls `scrape_bill` using the final loop chamber.
  Bounded extraction must determine each bill's chamber from its validated identity, not that stale loop variable.
- Bills use `US/Eastern` in the pinned scraper while events use `US/Pacific`. Inspect each timestamp's source semantics
  before changing normalization; do not invent precise times for date-only actions.
- Events default to today through the next 30 days and skip cancelled meetings. This is not a historical meeting import
  or sufficient cancellation reconciliation. Define explicit windows and retained observations before activation.
- Shared people coverage now uses configured district capacities: Washington has two House members and one senator
  per district; NC/AK retain capacity one. Identity uniqueness and missing/excess occupant checks remain enforced.
  Capacity does not infer House position numbers or resolve historical role conflicts.
- Many execution, archive, people, content and schedule boundaries explicitly allow only NC/AK. Extend each reviewed
  boundary with tests; a new profile is not implicit authorization to execute or schedule it.

No Washington production writes, new schedules or scraper runtime activation were performed during this baseline audit.

## Shared foundation validation (2026-09-19)

Washington acquisition, immutable archive/replay, current roster validation and history preparation now use the same
people profile/schema and functions as NC/AK. Hosted activation remains separate and unchanged. Thirty-one focused
tests passed, including complete multi-member coverage, missing/excess occupants, duplicate identities/paths and
checksum-preserving Washington replay. Existing NC and Alaska coverage behavior remains tested.

Live repository revision `677c6d0a566ad9bd62b6324e502af76acc3d22f3` was retained under
`artifacts/openstates-washington-foundation`. Both archive manifests use
`openstates/people/<revision>/wa/{entities,history}/source-677c6d0a566ad9bd/complete.json` and replayed successfully:
198 current files and 261 historical files. Current snapshot validation found 147 legislators, 51 committees and
609 membership assertions, with no coverage or unresolved-reference issues.

History preparation accepted 336 people and 367 terms while quarantining 20 people for overlapping roles, ambiguous
term identities or reversed dates. This is a partial preparation, not canonical import. Review source precision and
generic period handling before considering source corrections; do not add person-name exceptions to the engine.
The retained `reports/foundation-validation.json` includes each quarantined path and content hash. No production
people/committee changes or schedules were made.

## Frozen bill discovery (2026-09-19)

The shared discovery entry point now supports Washington's two annual XML inventories. Its source adapter validates
the biennium, chamber, bill number and legislation type before combining carryovers/substitutions into canonical bill
identifiers. Appointments and initiatives remain explicitly outside this bill-scraper lane. Unknown or conflicting
identities stop discovery instead of silently reducing coverage.

All three states now share immutable source/plan publication, ten-item single-chamber partitioning, exact-batch scope
checks and checksum replay. Reviewed bill sessions/identifier patterns live in one capability profile; this does not
enable hosted activation. Runtime extraction, normalization and downstream acceptance still require Washington work.

Live acquisition retained 3,411 unique bills (1,904 House, 1,507 Senate), in 342 batches of at most ten, under
`artifacts/openstates-washington-bills/openstates/scraper-plans/wa/2025-2026/wa-bills-971060d118727f4b4dc6195f4b5b7fc7/plan.json`.
Inventory ID: `093b6b38e2ef0dbb94458f1a3048605297487bc46085f42cf402bcd28c168517`.
Replay reconstructed the exact plan from retained publisher XML. No scraper execution or canonical writes occurred.

## Isolated runtime canaries (2026-09-19)

The shared Python runner now admits Washington bill-only batches for session 2025-2026. Events remain disabled.
The digest-verified source policy accepts 1-10 unique, single-chamber bill IDs, bypasses upstream full-session
discovery, resets document/version collections per attempt and sets a 60-second source timeout. No new dependencies
were installed. The acceptance image reuses the inspected existing dependency image and passes offline startup checks.

An initial House attempt failed on a missing digest directory instead of silently truncating document discovery.
The publisher's parent directory lists only Senate digests. The revised adapter checks the published parent listing,
records each advertised/absent child directory in retained `document_directories.json`, and propagates transport
failures or unrecognized listing pages. There is no hardcoded House/digest skip.

Retained successful attempts under `artifacts/openstates-washington-canary`:

- `openstates-wa-r03x544f`: HB 1000, 3 actions, 8 sponsors, 1 version with HTML/PDF links.
- `openstates-wa-w0wnezva`: SB 5000, 22 actions, 1 version, 1 supporting document, 2 roll calls.

Both use build-input hash `35cb745c411e7c08bcfe35d0b18762380480da69e406615263ee52afeccbd653` and the local
`legislation-openstates-adapter:washington-directory-aware` image. Both ran sequentially, with one CPU, 1 GiB memory
and a 300-second attempt deadline; neither had database/cloud credentials. The 28 runner/source-policy tests passed
inside the network-disabled image without skips. Existing failed artifacts remain untouched.

Fresh official roll-call XML matched both SB 5000 vote dates, motions, source chambers, totals and all 49 named
positions per vote. The comparison and XML are retained in `source-comparisons/sb5000-rollcalls.{json,xml}`.
This does not approve the upstream majority-inferred outcomes, broad vote coverage, identity resolution, canonical
normalization, duplicate-free database replay, hosted deployment or content/search completion; those gates remain open.

Repository `pnpm verify` passed for this slice, including 1,929 ingestion tests and 122 Python tests (7 platform/runtime
skips on Windows, with the 28 relevant runner/policy cases passing unskipped in Docker). Unconfigured database suites
and the optional positive disposable-corpus acceptance were skipped, not evidence of Washington database readiness.

## Shared canonical preparation (2026-09-19)

Washington bill archives now use the same checksum-verified archive reader, exact batch scope, canonical bill mapper
and dispatch preparation as North Carolina and Alaska. Only source-specific roll-call evidence parsing is separate.
Vote identity uses biennium, bill, source chamber, date and source sequence rather than temporary scraper UUIDs,
motion wording or tallies. Named positions must reconcile with the published yes/no/other counts.

The upstream majority-derived result is discarded. A final-passage outcome requires one matching official action on
the same date and chamber with exact counts; other outcomes remain unknown. Unknown outcomes remain incomplete in
the canonical mapper, even when vote counts reconcile. Date-only source records never receive invented instants.

Both retained successful canaries normalized and replayed identically through the shared pipeline without database
writes. HB 1000 yielded no votes; SB 5000 yielded two upper-chamber passed votes with source sequences 19 and 17.
Focused tests cover identity, source mismatches, incomplete positions, ambiguous outcomes, archive replay and build
approval. This is preparation evidence, not duplicate-free database replay or permission to activate hosted syncing.

The retained canaries were also imported twice using the shared production writer into the new isolated local
`washington_scraper_replay_20260919` database. Both passes retained exactly the same IDs and counts: 2 bills,
25 actions, 10 document records, 23 sponsor observations, 2 votes and 98 vote positions. Evidence is retained in
`artifacts/openstates-washington-canonical-replay/reports/database-replay.json`. Production was not changed.
This proves replay for these two cases, not nationwide/archive-to-scraper reconciliation, interrupted-run recovery,
resolved person identities, full-session coverage or document content readiness.

The same isolated database then replayed the retained foundation through `importArchivedStateFoundation`:
336 people, 367 terms, 51 organizations and 609 committee memberships retained identical IDs/counts on repeated
imports. Current active service covers 98 House members and 49 senators. The existing shared current-roster path
preserves validated current identities/terms while holding conflicting older histories; no person-specific exceptions
were added. All 51 current committee rosters passed dependency checks. The 20 historical quarantines remain open.
Reports: `artifacts/openstates-washington-foundation/reports/isolated-foundation-replay.json` and
`isolated-membership-replay.json`. These local checks do not establish production import or complete service history.

The cloud bill-request boundary also uses the shared session/identifier profiles. Washington bill requests pass the
same unique-ID, single-chamber and ten-item limits; Washington events remain rejected. Focused cloud tests and
ingestion type-checking passed. This does not change hosted activation, approved deployment fingerprints or schedules.

Washington content processing is now admitted to the existing extraction/OCR/embedding worker behind its existing
explicit activation guard. Default sessions and continuation/predecessor identities share one resolver using the
reviewed bill profiles; Washington defaults to 2025-2026, never Alaska's 34. Historical explicit sessions remain
supported. Sixteen focused content/policy tests and ingestion type-checking passed; no hosted settings changed.

The first full ten-bill House canary (HB 1000-1009) stopped after HB 1002 with `source_http_server_error`, before its
25-minute deadline. The failed attempt is retained under
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/wa/bills/wa-frozen-house-canary-20260919/retained.json`
in the local Washington bill store. Canonical preparation rejected it as incomplete; no partial batch was promoted.
Fresh checks of the HB 1003 summary, roll calls and status-change endpoints returned HTTP 200, but the bounded error
category does not establish which request originally failed. A fresh bounded retry is still required.

An isolated SB 5000 content canary used the shared worker, existing provider configuration and one bill at a time.
Two bounded passes processed all eight linked document records without extraction failures or OCR demand. Database
inspection confirmed one `voyageai/voyage-4` bill embedding (1024 dimensions) and eight
`openai/text-embedding-3-small` section embeddings (1536 dimensions). The second pass skipped the three existing
vectors instead of storing them again. Retained job reports are under
`artifacts/openstates-washington-content-canary/reports/sb5000-content-{canary,remainder}.json`.
This proves text extraction and embedding for this bill only. Local OCR credentials were unavailable, no OCR call
was exercised, and lexical synchronization, index usage and authenticated API/MCP retrieval remain unverified.

The shared-executor retry exposed a stale NC/AK-only filesystem artifact validator. The directory reader now uses
the manifest's single shared path contract; 20 focused archive/path tests and ingestion type-checking passed.
The retained attempt was recovered without repeating extraction. It too contains an upstream server error (two
completed bill records), not a complete batch, and remains unpromoted. Evidence is retained as
`wa-frozen-house-retry-20260919` in the same local archive store. Investigate source diagnostics/retry policy before
increasing concurrency; neither failure authorizes partial promotion or claims a complete Washington refresh.

## Full-batch retry and meeting-source audit (2026-09-19)

The pinned runtime already configures three source retries with exponential waits of 10, 20 and 40 seconds.
An isolated ten-bill diagnostic retry completed HB 1000-1009 successfully with 25 retained files, using the same
runtime and no additional retry layer. Its archive is `wa-frozen-house-diagnostic-20260919` in the Washington bill
store. Checksum-verified canonical preparation returned all ten requested bills and replayed deterministically.
This is evidence of intermittent upstream failure, not identification of the original failing endpoint or sustained
source reliability. No concurrency increase or hosted activation was made.

The shared production writer then replayed the complete batch in the isolated local database. Two consecutive
passes retained identical IDs/counts: 11 total bills (including the earlier Senate canary), 162 actions, 70 document
records, 12 votes and 882 named positions. HB 1000 overlapped the earlier canary without becoming a duplicate.
Reports are `artifacts/openstates-washington-bills/reports/house-batch-{diagnostic,database-replay}.json`.
This does not replace archive-to-scraper parity, production acceptance, or full-session ingestion checks.

A live read of the official `CommitteeMeetingService.asmx/GetCommitteeMeetings` endpoint for January 13-19, 2025
returned 77 meetings with 77 distinct agenda IDs across House and Senate, including one cancelled meeting.
The pinned upstream event scraper currently discards cancellations and agenda entries without bill IDs, fetches the
same inventory once per chamber, and defaults to a future-only window. Before activating Washington events, preserve
cancellations and non-bill agenda entries, use explicit bounded windows and stable agenda identities, and validate
Pacific timestamps. Reuse the canonical event writer and existing cancellation status mapping; no separate event
database or Washington-specific persistence pipeline is needed. Events remain disabled.

The preceding full `pnpm verify` run completed successfully. Its optional positive disposable-corpus API acceptance
was skipped; this is not proof of authenticated Washington retrieval.

## Meeting extraction acceptance (2026-09-19)

The source adapter now requires explicit windows of at most seven inclusive days, reuses one inventory per scrape,
preserves cancellations and agenda items without bill links, and exports the publisher agenda ID. Invalid cancellation
values, invalid agenda IDs, out-of-window records and ambiguous/nonexistent Pacific local times fail closed.
These changes are applied to the digest-verified pinned source, not a separate persistence implementation.

Twenty-six focused Python tests passed inside the existing dependency runtime, including tests exercising the real
patched scraper and Open States event objects. An offline image rebuild passed source verification and startup smoke.
The new local runtime is `legislation-openstates-adapter:washington-meeting-fidelity`; it is not a hosted deployment.

A bounded live canary for January 13-19, 2025 extracted 77 distinct agenda IDs, one cancelled meeting and 287 agenda
items, including 122 items without bill links. Comparison against all retained official XML responses found zero
meeting identity differences and exact agenda totals. The scraper made 78 requests: one inventory and one per agenda.
Source bodies, response hashes, extracted events and counts are retained under
`artifacts/openstates-washington-meeting-canary/`. No canonical database writes were performed.

This closes source-extraction fidelity for that window, not Washington event onboarding. The shared execution boundary,
immutable window planning, canonical identity/relationship mapping, duplicate-free database replay, hosted deployment
and recurring event sync remain open. The full repository verification is running after this implementation.

## Canonical meeting replay (2026-09-19)

The adapter now retains every publisher host committee's numeric ID, chamber, code and name. Canonical preparation
uses the stable agenda ID (not the extraction UUID), verifies exact official source URLs and Pacific clocks, and
passes explicit bill selectors through a helper shared with Alaska. Foundation import derives committee codes from
retained official committee URLs; the existing relationship resolver rejects missing or ambiguous matches without
name-based fallback. Current and retained publisher URL layouts are both supported.

The complete 78-response canary was replayed offline through the rebuilt pinned source. Its 77 events and 287 agenda
items then passed through the existing canonical event writer in `washington_scraper_replay_20260919`. Repeated imports
retained identical identities/counts. All 77 event-to-committee links resolved, including the cancelled meeting, with
zero unresolved hosts. Twelve agenda bill links resolved against the deliberately small 11-bill local corpus;
remaining bill relationships are not claimed complete. Evidence: `database-replay.json` and
`host-relationship-replay.json` under `artifacts/openstates-washington-meeting-canary/`.

The prior full repository verification passed (optional unconfigured database/corpus cases skipped). Focused mapper,
committee and Alaska regression checks cover the new shared preparation. Washington's execution-window contract,
durable dispatch/continuation and production acceptance still need implementation before enabling event sync.

## Shared meeting execution boundary (2026-09-19)

Washington event windows now use the shared Python runner, Docker shutdown/resource safeguards, cloud-request
validation and immutable attempt archive. One strict window contract is reused by TypeScript admission, archive
reading and canonical preparation. The approved source emits an inventory receipt only after complete traversal;
preparation requires exact agreement between its agenda IDs and retained events. Valid empty windows are permitted,
but never interpreted as a complete statewide snapshot or permission to delete meetings.

A real runner canary exposed Open States' UTC serialization: a 4pm Pacific meeting serialized at midnight the next
UTC day. The adapter now preserves the original offset timestamp in source extras. Preparation verifies equal instants
and the Pacific offset, retaining the publisher's calendar date. A focused regression covers this boundary.

The corrected local image `legislation-openstates-adapter:washington-publisher-clocks` passed offline startup checks.
Build-input digest: `3556d11cfa4010e0e8909e14b551f054e2b84a3d7deb0a242d62101e5bc8156e`.
The shared runner's 600-second canary extracted and archived all 11 meetings for January 13, 2025. Canonical preparation
accepted the exact inventory; replay through the existing writer left the prior 77 meetings and 287 agenda IDs/dates
unchanged, including across a second replay. Reports are under
`artifacts/openstates-washington-event-windows/reports/`; the successful attempt is `wa-meeting-clock-canary-20260919`.

Forty focused TypeScript tests, fifty Python tests inside the pinned dependency runtime, ingestion type-check and lint
passed. Full verification encountered the unrelated `browserTelemetry.ts` route-template type error. Durable window
planning, leases, continuation and hosted acceptance are still open; neither cloud-request support nor this local
canary activates production jobs or schedules.

## Immutable calendar planning

The jurisdiction-independent event-window planner partitions inclusive dates into bounded windows, hashes the cycle,
scope and each work item, and validates the exact partition on reload. Retention checks existing content rather than
assuming an existing path is correct. Every fresh sync cycle has a distinct identity, allowing previously empty dates
to be revisited. Calendar arithmetic is independent of daylight-saving offsets.

Washington preparation can now bind retained evidence to a specific planned window before publication. Wrong-window
archives and unknown work items fail, including for empty inventories. Eleven focused tests passed, as did ingestion
type-check and lint. This is planning and preparation only: durable ownership, transactional completion receipts
(including verified-empty windows), resumable dispatch, and hosted activation remain open.

## Owned window execution and empty receipts

The Washington window coordinator now uses existing batch ownership, cloud dispatch and canonical event persistence.
Each work item checks its immutable receipt before admission and again after acquiring ownership, binds retained
extraction to the plan, and commits either canonical rows plus a receipt or an owned empty-work receipt. New cycles
cannot overlap unresolved ownership from an earlier cycle. Verified-empty windows never delete canonical events.

Shared cloud dispatch now treats connection loss during submission or result observation as uncertain shutdown,
preserving ownership for all callers. This closes a gap where a queued scraper could outlive an observation error.
Invalid requests and credential failures before submission still fail without dispatching work.

Fourteen focused coordinator/dispatch/NC regression tests and fourteen real isolated PostgreSQL receipt tests passed.
Ingestion type-check passed. The PostgreSQL checks include concurrent identical empty receipts, missing ownership,
and conflicting replay. Hosted execution has not been activated; continuation task wiring, production acceptance,
and the other Washington coverage/content/readiness gates remain open.

## Bounded continuation wiring

`openstates-event-windows` processes one pending Washington window per invocation using the shared receipt inspector.
It rereads committed state after execution and refuses continuation without the selected completion receipt. A replay
of an already completed plan does no extraction. The continuation key binds the exact plan and next window; database
ownership remains the cross-process authority. The dedicated task queue has concurrency one, a one-hour timeout,
and no automatic retry while worker shutdown might be uncertain. Database pools close before continuation dispatch.

The task has no cron and requires explicit Washington activation. Its build is pinned to the locally validated
candidate; existing NC/AK build approval is unchanged. This code is not evidence of a deployed or scheduled job.
Nine coordinator/activation tests and three registered-task execution tests passed, including disabled activation,
receipt-less success rejection, completion replay, failure cleanup and exact continuation dispatch. Hosted deployment,
runtime approval and end-to-end acceptance remain required before enabling regular Washington sync.

## Live archive and runtime audit (September 19)

Azure authentication succeeded. The existing event job remains pinned to image digest
`cd41549d55377efdd0ce8637bda9800f74b546d2791cb0dc083d132776938369`; it has not been replaced with the Washington
candidate. The five most recent returned executions succeeded. No job, queue, schedule or activation settings changed.

The signed-in [publisher catalog](https://open.pluralpolicy.com/data/session-json/) lists exactly the five Washington
sessions already retained in `state-sources`, from 2017-2018 through 2025-2026. All five retained source objects were
read and their SHA-256 and byte counts matched their stored metadata. The four older catalog URLs match retained
provenance. The current-session catalog URL changed to the August 24 release, while our retained archive was acquired
August 17. The new archive was acquired only into `artifacts/openstates-washington-archive-audit`, hash
`e137e5c6b580da502be19f3ca5f09c6aac5f89d32d3fa834a0a091bf940b3945`, with 3,413 records and 97,348,364 bytes.

Comparison found no added or removed bill identities. Differences were confined to document/vote arrays; recursively
ignoring array order produced no differences for any bill. This is diagnostic evidence of reordering, not proof that
ordered relations have equivalent semantics or that database content is current. Reports are
`reports/current-session-record-parity.json` and `reports/current-session-order-insensitive-parity.json` in that store.
No canonical writes were performed. Archive-to-database field parity remains open.

Washington continuations now pin `ctx.deployment.version` through the SDK's existing `version` option, matching the
shared content worker pattern. Three task tests and ingestion type-check passed. Full verification now encounters
unrelated syntax errors in the web app's `src/modules/conversations/telemetry.test.ts`; those edits were left untouched.

## Archive vote identity correction

Canonical comparison of both current-session releases exposed a shared importer defect: archive votes without IDs
were keyed by date and array position. Reordering changed the roll call attached to 300 identities across 46 bills.
The bulk archive's `organization__classification` field was also being discarded.

The shared normalizer now preserves that chamber and derives unidentified vote identities from date, organization,
roll-call identifier, motion and sorted source URLs, not array position or mutable outcomes/counts. Explicit publisher
IDs remain authoritative. The complete 3,413-bill comparison produced 2,306 votes with no identity collisions and no
canonical differences after excluding source sequence. Evidence is
`artifacts/openstates-washington-archive-audit/reports/stable-vote-canonical-parity.json`. Fifty-eight focused archive,
normalizer and Washington scraper tests passed. This is archive-to-archive proof, not database acceptance.

Existing database rows created with ordinal identities must be inventoried and reconciled before replaying with the
corrected normalizer; otherwise the new IDs could create additional rows. No production deployment or archive replay
has been performed for this correction. Ambiguous unidentified repeated observations and cross-source identity
reconciliation remain part of the database acceptance gate.

### Database replay preflight

Read-only production inspection found exactly 2,306 current-session Washington votes, all matching the identities
from the retained August archive, with no extra or missing IDs. Motions and yes/no counts match. All 2,306 still carry
raw `pass`/`fail` outcomes rather than the canonical vocabulary, and lack the archive-supplied chamber and date.
The corrected normalizer supplies those facts. No Washington votes have meeting outcome/evidence references in the
queried database. Reports are `production-vote-identity-inventory.json` and `production-vote-field-inventory.json` in
the archive audit store. Production was not mutated.

Inspection confirmed that the existing shared aggregate writer replaces each supplied bill vote snapshot within its
transaction, cascading removal of old positions. Therefore a separate identity migration is not required for this
snapshot writer. A real isolated PostgreSQL regression verifies replacement, a duplicate-free second replay, and
rollback of both votes and positions when a replacement fails; all 15 receipt integration tests passed. Production
refresh still needs an explicitly bounded snapshot replay and post-write comparison, including resolved-link handling.

### Full isolated current-session replay

The complete August 24 archive was normalized and persisted twice in the Washington acceptance database, using the
existing aggregate writer with batches of ten and `preserveResolvedLinks`. Both passes finished with 3,413 bills and
2,306 votes; vote IDs and facts were identical across passes. All 171,876 named vote positions exactly matched the
normalized source (vote ID, source identity/name, option and person linkage). The archive supplies 19,498 document
identities; the database retains 70 additional document identities from earlier live scraper acceptance runs, for
19,568 total. That count is not a document deduplication acceptance claim.

Evidence is `full-current-session-database-replay.json` and `full-current-session-position-parity.json` in the archive
audit reports directory. Production still has 171,876 positions attached to name-only placeholder person records;
those are not verified links to canonical people. A production refresh must preserve the named votes while avoiding
retention of fabricated person associations. No production rows were changed by this isolated replay.

The full verification command completed with ingestion/core/MCP coverage, type checks and lint passing, but failed on
two tests in the separately modified web `src/modules/evaluations/evaluation.test.ts` (public `conflict` and
`precondition_failed` message validation). Downstream Python/database/acceptance stages were not reached by that
command. The focused 15-test PostgreSQL integration run passed separately.

### Bounded production vote refresh underway

A complete read-only preflight verified all 954 bills with archived votes against the retained source. The saved
before-state includes all vote rows and all 171,876 positions, with plan SHA-256
`c1d376bbaeb9d362ef4211a97df1fe066c2bb119db3109374f574165e4c5b67e`. The maintenance execution uses the shared aggregate
writer with current database parent records and only the vote collection supplied, leaving other bill collections,
documents and vectors untouched. It runs one connection, ten bills per transaction, checks the locked before-state
and absence of meeting references, and checks exact resulting vote/position facts before committing. Shared immutable
promotion receipts bind the plan and batch, permitting an interrupted execution to skip already committed work.

The first 40 bills committed and passed their in-transaction checks. This is not a completion claim: all 954 bills and
the final global comparison still require confirmation. Runtime evidence and the scoped maintenance script are in
`artifacts/openstates-washington-archive-audit`; the before-state is `reports/production-vote-refresh-plan.json`.
Old vote rows/positions are atomically replaced; their complete before-state is retained there. Placeholder person
records themselves are not deleted, but the replacement positions do not assert unsupported person matches.

## Historical-role source review

The quarantines are not all parser failures. The pinned Chris Gildon YAML contains an upper-chamber role for
2019-01-14 through 2021-01-10 overlapping his lower-chamber role. His
[official biography](https://chrisgildon.src.wastateleg.org/about/) explicitly places his first two legislative years
in the House and his Senate service starting in 2021, contradicting that extra upper-chamber interval.

Jeff Holy's YAML contains a second upper-chamber interval beginning 2019-01-14 and ending 2019-01-13. His
[official January 2019 announcement](https://jeffholy.src.wastateleg.org/senator-jeff-holy-takes-oath-office-olympia/)
confirms his first Senate term began January 14, 2019, after three House terms. His
[official January 2013 newsletter](https://jeffholy.src.wastateleg.org/holy_jan2213_enewsletter/)
explicitly dates his House swearing-in to January 14, 2013. These establish source errors and missing House history;
they are not permission to reverse dates mechanically or infer all term boundaries. Reviewed correction evidence must
remain separate from the shared importer, bind the exact source identity/hash, and pass the same period validation.
No historical-role corrections have been applied from this review yet.

## Conflicting vote observation admission

The shared normalizer now refuses conflicting observations with the same vote identity, including source-ID collisions
and indistinguishable unidentified roll calls. It still collapses identical duplicate observations, independently of
vote/position array order. This prevents silent first-record-wins loss; it does not invent identities from vote tallies.
Sixty focused normalizer/scraper tests passed, and all 3,413 current archive bills still normalize to 2,306 votes under
the stricter rule. A new full verification run was started after this change.

## Shared content audit scope

The content-status and embedding-freshness command-line audits now obtain admitted states and default sessions from
`state-content-scope`, matching the processing pipeline. Washington no longer fails an NC/AK-only enum or defaults
to Alaska's session 34. The all-state status report uses the same capability list; admission remains separate from
hosted activation. Washington's production content-status audit is read-only and was started without triggering
document processing, OCR or embeddings.

The production audit at 2026-09-19T07:52:25Z found all 3,413 current-session bills with routed embeddings, 19,491
processed documents, seven unsupported documents, and 92,930 sections with no missing routed embeddings. There were
zero processed documents without sections, zero OCR-processed documents and zero documents currently flagged as
unresolved OCR. Both bill and document-section HNSW indexes were valid and ready. These are existence/status checks,
not proof of embedding input freshness or extraction completeness. A separate freshness audit and review of the seven
unsupported sources remain open. The shared scope regression tests (three) and ingestion type-check passed.

All seven unsupported sources belong to archive training/test bills HB 3992 and SB 7991: five House bill/amendment
links and two Senate bill links. Fresh HTTPS GET requests at 2026-09-19T07:54:41Z returned HTTP 404 for every link,
matching their persisted `not-found` categories. Evidence is `reports/training-document-source-status.json` in the
archive audit store. This accounts for the two bill identities absent from the live scraper inventory without deleting
their archive records or creating name-specific download exceptions. These seven failures are missing publisher
resources, not evidence of OCR or embedding failure; recurring source availability remains subject to normal policy.

## Production verification closure

At 2026-09-19T08:02:37Z, an independent read-only snapshot verified all 2,306 votes and 171,876 positions against
every normalized canonical field from the retained source archive. All 96 transaction receipts cover the 954 bills
with votes. The refresh completed; no second import was required when the initial broad verification query timed out.
Bounded reads of 25 vote identities completed the check. Evidence is `reports/production-vote-refresh-verification.json`
in the archive audit store, alongside the retained pre-change plan and completion receipt.

The embedding-freshness snapshot at 2026-09-19T07:52:55Z also passed: all 3,413 bill vectors and 92,930 document-section
vectors match their current input hashes, with zero missing or stale vectors. No re-embedding was necessary for this
archive snapshot. This does not close live scraper acceptance, lexical/API search acceptance, historical field parity,
or scheduled synchronization. People/committee promotion and the 20 quarantined historical records remain separate gates.

Washington continues to use shared canonical persistence, replay receipts, source observation admission, content processing,
and embedding audits. Washington-specific adapters interpret publisher formats; they do not duplicate those lifecycle rules.

## Production people and committee promotion

The shared `importArchivedStateFoundation` boundary imported the pinned current/history pair into production on
2026-09-19, then replayed the same pair successfully. The second persisted verification at 08:05:28Z confirmed
336 expected people, including all 147 active legislators, 51 committees and 609 active membership identities.
Selected identity, relationship, chamber, district, role, activity and date fields matched the prepared snapshots;
all 367 expected legislative-term identities were present with matching checked fields. The replay did not create
extra people or active membership identities within the inspected source scope. This is not a claim that unrelated
legacy identities or all historical legislative terms have been reconciled.

Twenty source-history records remain quarantined; their disputed history was not promoted. The validated current
directory supplies current identities independently, so those history issues do not suppress verified current committee
relationships. Reports are `production-foundation-promotion.json` and `production-foundation-verification.json` in
the foundation artifact store. No Washington scraper schedule was activated.

The final repository verification passed check/coverage and Python tests (123 run, eight skipped), then failed web
acceptance startup: `/health` returned 500 because the instrumentation hook rejected a telemetry first-party URL.
Database suites without configured databases were skipped; this run does not replace the earlier isolated PostgreSQL
replay checks. The telemetry changes belong to separate work and were not modified for Washington onboarding.

## Production meeting canary

At 2026-09-19T08:07:38Z, the retained approved runner extraction for January 13, 2025 was promoted through
`prepareWashingtonEventWindow` and the shared `upsertEventSnapshots` writer. Production contained all 11 expected
meetings and 35 agenda items, with 11 resolved committee links and zero incomplete host relationships. Checked names,
statuses, start instants, publisher-local dates and timezones matched preparation. A repeated call with the same
immutable receipt was a no-op. Evidence is `reports/production-canary.json` in the event-window artifact store.

This is a bounded production canary, not full calendar coverage, cancellation coverage for this particular day,
or proof that every agenda bill relationship resolves. The prior isolated multi-day fixture covers cancellation behavior.
Hosted execution, complete planned windows, authenticated retrieval and recurring synchronization remain open.

## Authenticated MCP smoke findings

The connected production MCP returned Washington active people, lexical bill search, lexical passage search, all eleven
canary meetings and House Housing meeting detail on September 19. Meeting date filters require UTC ISO timestamps
(`Z`); date-only and offset timestamps were rejected by the deployed tool schema. Passage results retained canonical
Washington bill/document/section identities and source URLs. This is positive authenticated retrieval evidence, not a
complete API/MCP acceptance pass.

Two acceptance failures remain actionable:

- Semantic and hybrid passage searches for `affordable housing development`, scoped to Washington's 2025-2026 session,
  returned retryable `dependency_unavailable` errors after approximately 15.7 and 31.2 seconds, respectively.
- House Housing meeting `event:openstates:wa-agenda-32398` returns three agenda items with `billIds: null`.
  The API intentionally hides relationships unless `billRelationsComplete` is true. The shared agenda bill resolver
  currently resolves identifiers without updating that completeness assertion, and the Washington adapter supplies
  explicit bill references without establishing source completeness. Fix must distinguish fully resolved explicit
  references from malformed/missing source references, rather than unconditionally setting the flag or guessing from prose.

Do not activate recurring Washington synchronization until these and the remaining ingestion gates pass.

The agenda fix now separates source-reference completeness from successful canonical resolution. The shared selector
parser reports malformed, missing and inconsistent references without discarding valid siblings. Washington propagates
that assertion to the shared resolver, which marks the collection complete only when every explicit reference resolves
uniquely in its jurisdiction/session. Existing adapters retain their prior completeness claims unless they explicitly
opt into the verified-list contract. Nineteen focused tests, ingestion type-check and scoped lint passed; full repository
verification is running. Production replay/API verification of this fix remains pending.

Production replay of that fix passed at 2026-09-19T08:14:06Z: 11 meetings, 35 agenda items, 11 committee links and
13 bill links; all 35 agenda bill-reference collections were complete, including source-declared empty collections.
Authenticated `get_event` then returned the House Housing agenda's exact canonical bill IDs: HB 1003, HB 1096 and
HB 1217. The correction replay has its own immutable receipt and a second invocation was a no-op. Evidence is
`reports/production-agenda-resolution.json` in the event-window artifact store. This closes the observed canary agenda
exposure defect, not full-calendar ingestion or all relationship acceptance cases.

A sequential semantic passage request scoped to HB 2266 alone also failed after approximately 16 seconds. The failure
is therefore not limited to concurrent Washington-wide searches. Inspection of `buildSemanticPassageSearchQuery` shows
bill/document filters are applied after a global bounded nearest-neighbor candidate scan; a bill-scoped request does not
first restrict the vector population to that bill. Query-plan and latency evidence are still needed before selecting a
replacement strategy. Do not mask the failure by raising timeouts or claim the cause proven from code inspection alone.

A bounded production read-only EXPLAIN ANALYZE comparison reproduced the global candidate timeout (15,281 ms,
PostgreSQL 57014) and completed a bill-restricted exact-vector query in 532 ms. Both used the same synthetic nonzero
1536-dimensional vector and existing model/contract; this measures query execution, not semantic relevance or full HTTP
latency. Plans are retained in `reports/semantic-selectivity-plan.json` in the archive audit store.

The shared query builder now has an explicit bill/document-scoped exact-ranking path with all filters before ranking
and pagination. Computed distance ordering prevents use of the global nearest-neighbor index for this exact path.
Numeric `.offset(0)` was found to be omitted by the ORM and its typed API does not accept SQL offsets, so that approach
was removed. Five generated-query tests cover the path. Actual generated-query execution,
broader correctness/pagination checks, full verification and deployment remain pending; statewide search is unchanged.

The actual generated query was executed in a production read-only transaction. Bill scope, second-page scope,
conflicting jurisdiction and document scope all passed: three lookahead rows for matching scopes, zero rows for the
conflicting jurisdiction, no overlap between the two returned page prefixes, and all records mapped to HB 2266.
Combined EXPLAIN ANALYZE plus query times were 1,045 / 669 / 545 / 531 ms respectively. The synthetic vector tests
execution and filter behavior, not semantic relevance. Evidence: `reports/semantic-generated-query.json`.

The whole-session exact-ranking alternative did not pass: its bounded read timed out at 15,584 ms (57014).
Evidence: `reports/semantic-session-plan.json`. Do not extend the explicit-parent exact path to whole sessions based
on the successful small-parent benchmark. Statewide semantic acceptance requires a different measured strategy.
The verification run started before the query edit captured intermediate failing query assertions; those five focused
tests subsequently passed after correction. A fresh full verification is required against the final code.

The session-filtered existing HNSW diagnostic returned three rows in 4,708 ms, using
`document_section_embeddings_hnsw_idx` rather than exact-scoring the whole session. The shared builder now derives a
safe canonical session prefix and requests only the page/lookahead population when no additional relational filters
remain. Conflicting jurisdiction/session pairs, wildcard-bearing sessions and multi-scope requests do not receive this
optimization. All relational filters remain present after candidate selection; no index or embedding was rebuilt.

Actual generated-query replay returned three Washington 2025-2026 sections in 442 ms after the diagnostic had warmed
the index. Treat that as a warm observation, not a latency guarantee. Explicit bill/document scopes and page isolation
also passed again. Evidence: `semantic-session-graph-plan.json` and `semantic-generated-session-query.json` under the
archive audit reports. Seven query tests and web type-check passed. Semantic relevance, deeper session pagination,
full verification, deployment and authenticated post-deployment search remain required.

Three-page validation with a retained HB 2266 housing passage vector exposed a planner regression: page one retrieved
the source passage at distance zero, but page two chose a parallel sequential embedding-table scan and timed out.
The captured plan is in `semantic-pagination.json`. An index-preferred transaction completed all three pages without
duplicate IDs. The shared ANN path now sets `enable_seqscan=off` locally within its transaction; explicit-parent exact
ranking retains ordinary planner settings. This does not change a database-wide setting.

The actual implementation, without a diagnostic planner override, then completed pages in 1,958 / 1,941 / 1,911 ms.
All 15 results belonged to Washington's current session; the known passage ranked first and no page IDs overlapped.
Evidence is `semantic-pagination-implementation.json`. This is a self-retrieval/pagination check, not a held-out relevance
evaluation or proof of deep-pagination stability under concurrent corpus changes. Seven focused tests and web type-check
passed. Deployment and post-deployment authenticated semantic/hybrid checks remain open.

## Additional authenticated relationship acceptance (2026-09-19)

The full `pnpm verify` process completed successfully (session 80295), including 239 web acceptance tests,
built MCP acceptance and the separate-audience API/MCP boundary checks. Database suites without a supplied
disposable database and the positive disposable-corpus boundary case were explicitly skipped; this is not proof
of those integration cases. Focused production read-only evidence above remains separate.

Live authenticated `get_person` returned Adam Bernbaum with his canonical Washington district 24 term and three
committee memberships, all with source provenance. Organization-filtered `search_events` returned the expected
House Housing meeting `event:openstates:wa-agenda-32398` within the January 13 Pacific-day window.
`read_record_collection(meeting-agenda)` returned its three agenda items with complete bill relationships;
amendment and material relationships remain explicitly incomplete. Collection order is ID-based, not agenda order;
consumers must use the supplied ordinal when presenting the agenda.

`get_organization` for House Housing returned `unprocessable`: no source-complete detail profile. This is a real
remaining acceptance gap, not a failed committee import. The shared repository committee importer deliberately sets
`detailFactsComplete` and `childRelationsComplete` false, while marking memberships complete only after dependency
resolution. Existing tests explicitly assert that policy for Alaska and North Carolina. Do not flip those flags simply
to make the endpoint succeed: obtain and retain the missing profile/hierarchy facts through a shared source adapter,
or explicitly revise the public partial-detail contract with its coverage semantics. Washington regular-sync acceptance
remains open. No production settings or schedules were changed by these checks.

## Isolated search release and live acceptance (2026-09-19)

Railway deployment `3cb2b61c-7302-4797-98bf-25352cca12a6` reached `SUCCESS`. Its source is the previous production
baseline `71562dd` plus exactly `search.ts` and `semantic-passage-query.test.ts` from `d4faba9`, exported into
`.codex-deploy/washington-search-d4faba9`. The runtime search blob is
`c18b92b1cbd563aab4400372810973c4c9ba648e`. Unrelated staged/unstaged telemetry and evaluation work was not uploaded.
The remote build compiled and type-checked successfully; production `/health` and `/ready` returned HTTP 200.

Authenticated MCP `search_bill_text`, query `housing affordability and residential zoning`, limit three:

| Scope and mode | Observed wall time | Result |
| --- | ---: | --- |
| HB 2266, semantic | 2,097 ms | Three canonical HB 2266 passages, embedding and reranking providers completed |
| Washington 2025-2026, semantic | 10,730 ms | Three correctly scoped passages, no warnings |
| Washington 2025-2026, hybrid | 6,789 ms | Three correctly scoped passages, no warnings |
| Washington 2025-2026, lexical | 511 ms | Three correctly scoped passages, no warnings |
| Same statewide semantic query, returned page-two cursor | 1,998 ms | Three passages, no overlap with page one |
| Same statewide hybrid query, returned page-two cursor | 1,544 ms | Three passages, no overlap with page one |

Results include canonical bill/document/section IDs and URLs. These requests close the reproduced post-deployment
semantic/hybrid timeout cases; they are bounded smoke evidence, not a throughput SLA or held-out relevance benchmark.
No embeddings or indexes were rebuilt. Hosted scraper activation, full-calendar ingestion and scheduled-delta acceptance
remain separate open gates. The official CommitteeService `GetCommittees?biennium=2025-26` was also inspected: it supplies
standing committee identifiers, chamber, names, acronym and phone, but does not establish a complete child hierarchy.
Do not use that response alone to assert full committee-detail completeness.

## Hosted extraction canary (2026-09-19)

The existing Azure job supports per-execution image and environment overrides. This was used instead of replacing
the shared production template. A cloud layer built on the verified Washington adapter passed runtime startup checks
and was pushed as immutable image
`acrr2jsh7uot4legdev.azurecr.io/openstates-scraper@sha256:0696a3f2801ded36d29364040d9c308b181b5484fa266384bd5d2c2d15ec2f75`.
Its source-input approval remains `3556d11cfa4010e0e8909e14b551f054e2b84a3d7deb0a242d62101e5bc8156e`.

A separate `openstates-scraper-canary` queue was created in the existing storage account. The shared dispatcher submitted
only HB 1000 with a 600-second deadline. Execution `leg-dev-openstates-scraper-vy3vrgq` ran from 08:48:00 to 08:48:42 UTC
and reached `Succeeded`. The shared worker retained six checksum-verified files in the existing `state-sources` container
and emitted a queue-deletion settlement for `wa-hosted-house-canary-20260919`. The shared archive reader and normalizer
accepted exactly `bill:wa:2025-2026:hb:1000`: three actions, two documents and no votes. Repeated normalization was identical.
Manifest SHA-256: `c7f560a60da24eacd36669f33a8fe9da9940a0eec34a5134877acfab99624af1`.
Local verification report: `artifacts/openstates-washington-hosted/house-canary.json`.

Read-back confirmed the persistent production job still uses image `sha256:cd41549d55377efdd0ce8637bda9800f74b546d2791cb0dc083d132776938369`
and queue `openstates-scraper-dispatch`. The canary has no database credentials and performed no canonical writes.
This proves hosted House extraction, identity-based queue/blob access, retention, settlement and deterministic normalization;
it does not prove Senate/vote extraction, hosted event windows, canonical promotion, full-session refresh or regular syncing.
The canary queue has no automatic scaler; future canaries require explicit one-off executions.
