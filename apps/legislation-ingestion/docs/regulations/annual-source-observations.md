# Annual package observations and revision dates

Owner: ING-04 in the [production backlog](ingestion-production-tasks.md). The parser's printed revision date,
the publisher's package year and legal currency are separate facts. A later package can contain old bytes.

The normalized importer now resolves a date-blocked annual volume only when a matching revision-year volume has
already passed complete-title atomic publication. Matching requires the same title and volume, exact raw artifact
hash, parser implementation, consistent printed revision date and a single available published anchor. Unknown,
conflicting, newer-than-package or unparsed dates remain blocked, as do other parser warnings. The source and anchor
must retain active rights. An active anchor writer or ambiguous candidates prevents resolution.

Before accepting the observation, the resolver compares every staged record against the anchor at its original
source locator, including body, blocks, heading, ordinal, section identity and parent locator. Only acquisition-local
keys, structural native-ID prefixes and provenance differ. Canonical anchor text, blocks and parent membership are
checked independently. Matching artifact hashes or row totals alone do not establish publication eligibility.

The transaction writes `legal_annual_source_observations` and moves the source import to `observed`. It preserves
the original manifest, source URL, package year, source warnings and full staged payloads, and records the anchor
edition, actual revision date and date-disposition evidence. It creates no edition, title head, passage or derived
outbox event. `observed` is terminal source accounting, not published coverage for the later package year.

`readAnnualCfrSourceObservation` exposes the package year alongside the actual revision date and anchor edition,
with `canCreatePackageYearEdition: false`. It does not add observations to edition selectors. It hides observations
whose source/anchor rights are inactive or whose anchor no longer has published annual membership. Replay reuses
the existing observation; a previously blocked copy can be retried after its anchor's complete title publishes.

Migration 0048 is the current unreleased baseline. Use a fresh isolated local database for this schema; retained
eCFR/Title 2/Title 5 pilots are not reset or upgraded by this change. Recurring collection and embedding rebuilds
remain disabled. Public HTTP/MCP exposure and full-release date reconciliation are separate gates.

## Retained Title 1 smoke

The earlier title-1 source audit found identical XML under GovInfo's 2023, 2024 and 2025 package labels, all printing
January 1, 2023. The official [2024 PDF](https://www.govinfo.gov/content/pkg/CFR-2024-title1-vol1/pdf/CFR-2024-title1-vol1.pdf)
and [2025 PDF](https://www.govinfo.gov/content/pkg/CFR-2025-title1-vol1/pdf/CFR-2025-title1-vol1.pdf) print that same revision.
`assessAnnualCfrDates` distinguishes absent, contradictory and mismatched dates, never promoting a folder year to legal
currency. The observation policy above resolves only its explicitly qualified cases; other mismatches stay gated.

The fresh local pilot on port 55446 imported the retained 814,725-byte artifact with SHA-256
`443032797d95acd1d1f338e5f6252544b97ec35bd12e6fc0979d3773f9913595` under all three original package observations.
The 2023 volume passed atomic annual publication, yielding edition `ee639bb8-0497-4a04-b961-b4d834dc0f28` and annual
edition `64371e67fc7490ee29fca58ddc0f2c9be8828b936f874bfc66f55328e691f2eb`. Both 2024 and 2025 imports resolved
to this anchor with revision January 1, 2023; their source date warnings remain unchanged.

Initial import and replay verified all 368 records in each copied volume against the staged and canonical anchor.
After replay: one annual edition, one volume edition, 368 canonical memberships, 1,104 staged source records, two
observations, one lexical outbox event, zero later-year editions and zero current-code heads. Observation replay
rechecks anchor availability and content before returning the existing observation. The anchor lookup uses a partial
index over artifact hash, parser hash and native volume identity for published annual generations.

Evidence under `artifacts/regulatory-backfills/`: `annual-title1-anchor-publication.json`,
`annual-title1-observation-import.json`, `annual-title1-observation-replay.json`,
`annual-title1-observation-audit.json` and `annual-title1-observation-normalized/`.
Focused real PostgreSQL/date checks passed 58 tests; four unrelated search-copy tests were skipped because their
separate search database was not selected. The new observation cases ran, including delayed anchors, corruption,
replay, rights withdrawal and no duplicate editions/events. Log: `%TEMP%/rostra-annual-observation-final-tests.log`.
