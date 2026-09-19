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
| [ ] | Freeze bounded current-session bill inventory | Normalize both years, retain source hashes and exclusion counts, partition exact disjoint batches; fail on malformed or unexpected records |
| [ ] | Add Washington to shared extraction and promotion | Extend reviewed jurisdiction profiles and source policy, not a parallel ingestion engine; validate source/dispatch/build fingerprints |
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
