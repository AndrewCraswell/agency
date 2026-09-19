# Washington onboarding

Washington is the next user-selected jurisdiction. Reuse the shared retained-source, batch ownership, promotion,
document/OCR, embedding and search pipelines. Do not activate schedules until the complete acceptance gate passes.
Initial extraction concurrency is one; retain the existing global content-worker ceiling and publisher limits while
North Carolina drains. No new provider, database or embedding model is approved by this onboarding.

## Requirements and evidence

| Complete | Requirement | Evidence or remaining work |
| --- | --- | --- |
| [x] | Inspect production archive baseline | September 19 2026 read-only query: 16,753 bills across five sessions below; historical-import runs exist for each |
| [ ] | Reconcile the complete published archive inventory | Compare the current archive catalog and checksums; stored counts alone do not prove archive completeness |
| [x] | Review pinned scraper and live source access | Pinned revision `d43f853796ceeeb49205f7d144790647764ce105` has bill and event scrapers; both 2025 and 2026 official bill inventory requests returned HTTP 200 without credentials |
| [x] | Freeze bounded current-session bill inventory | Both annual XML sources retained and replayed; 3,411 unique bills in 342 disjoint batches, with validated exclusions and source hashes |
| [ ] | Add Washington to shared extraction and promotion | Extend reviewed jurisdiction profiles and source policy, not a parallel ingestion engine; validate source/dispatch/build fingerprints |
| [x] | Run isolated bounded bill extraction in both chambers | HB 1000 and SB 5000 retained successfully; this is source extraction only, not canonical promotion or hosted activation |
| [ ] | Validate bill actions, documents and individual votes | Compare retained cases from both chambers to official pages, including substitutions, engrossments, resolutions and amendments |
| [ ] | Import and validate people and service history | Use retained Open States people data; represent two House seats per district without dropping one or guessing seat identity; quarantine conflicts |
| [x] | Validate current people/committee snapshot with reusable district capacities | Shared validator accepts 98 House members, 49 senators, 51 committees and 609 membership assertions; zero unresolved member references; source snapshot, not production import |
| [ ] | Import committees and memberships | Resolve member dependencies; incomplete rosters cannot imply departures or complete membership coverage |
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
