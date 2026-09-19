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
