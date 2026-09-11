# Identity audit follow-up

September 8, 2026. This classifies stored identity evidence; it does not authorize name-only merges.

## Post-refresh verification

September 10 follow-up: the recurring member refresh populated 1,110 Congress aliases and 555 Bioguide
identifiers across 555 people. Large change-log fields now use explicit content digests; deployment
`20260910.1` recovered 44 previously rejected bills, leaving seven record failures.

Direct Congress.gov bill-detail checks confirmed duplicated primary sponsor observations on 118th Congress
S.38 (D000622, Tammy Duckworth), S.873 (M001183, Joe Manchin), S.1469 (E000295, Joni Ernst),
S.2185 (C000141, Benjamin Cardin), and S.2611 (S001181, Jeanne Shaheen). Each pair had the same
Bioguide ID and printed name. Normalization now collapses identical canonical sponsor observations by ID;
conflicting names or roles remain explicit failures rather than last-write-wins corrections.
The two remaining provider failures, 111-S-3605 and 113-S-1997, are Congress.gov HTTP 500 responses.
Full-wave acceptance remains pending.

Coordinator `run_06g853d10it3r9rilcrepa7h01` uses Trigger `20260908.8`. Member child
`run_06g853f3rh563c7j6lfi3ra601` completed with 558 attempts. After that refresh, production retained 10,755
terms, zero untitled terms, zero duplicate Congress person/Congress/chamber groups, zero person/term jurisdiction
mismatches, zero missing links on House vote 119/2/74, and zero unnamed nonperson amendment sponsors.
The bills child was still executing. Full-wave acceptance remains pending; member-child completion is not wave completion.

## Collision classification

The read-only scan grouped names and source aliases within jurisdiction after lowercasing and stripping ASCII
punctuation/spacing. This is a broad candidate detector, **not** a resolver or Unicode identity key.
It returned 17 groups, below the 100-group output bound, so the result was not truncated:

- One federal group is the distinct Payne father/son pair (`P000149`, `P000604`), checked against the official
  House biography in [the repair inventory](identity-link-inventory.md).
- Sixteen groups contain only `person:openstates-voter-name:*` stubs: FL (Edwards-Walpole, Lopez J),
  ID (Van Orden), IL (Du Buclet), MT (Running Wolf Tyson T), NM (Hernandez JF/JN, O'Malley, Romero GA),
  NY (D'Urso), OK (O'Donnell and the apparent motion text “Amd CA1 Adopted”), SD (Smith VJ), TN (Van Huss),
  and TX (JD, JE). These labels do not establish which real person voted. Accent loss, initials and motion-like
  text make normalization-based merging unsafe.

There are **17,893 name-only vote stubs**, none with complete provenance or known activity. `listPeople` excludes
them; canonical projection remains fail-closed. All 1,623 source-complete person rows are Congress records;
18,087 rows have no source provider. Those totals do not represent 19,710 verified officials.

`person_aliases` and `person_external_identifiers` both contain zero rows. Their zero-conflict result is vacuous.
Source-backed identifiers currently live in `people.source_id` and `upstream_ids`. Exact provider-ID/Bioguide
checks and this normalized-name classification complete the bounded inventory, not statewide identity resolution.
Retain source names and acquire stable IDs from the approved self-hosted OpenStates pipeline before reconciliation.
No additional provider, identity merge or state-data rewrite was performed.

## Prevention and release ordering

`GET /ready` advertises `ingestionContract.membershipEndReasons` from the enum used by canonical projection.
`pnpm --filter legislation trigger:deploy` first checks the deployed API at `LEGISLATION_PUBLIC_API_BASE_URL`.
It refuses an old/missing contract, unavailable API, HTTP errors, redirects or network failures, with a 15-second
deadline. Deploy the API first, verify readiness and affected authenticated routes, then deploy ingestion.
Do not bypass the gate with raw `trigger deploy`. This protects membership end reasons, not every schema change;
extend contract coverage when another persisted enum or shape is introduced.

The gate blocks deployment, not an already-running worker or an unsafe later API rollback. Rollbacks must retain
support for values already written. No importer deployment or database write is needed to introduce this check.
Replay regression coverage checks stable member-term keys and provider-scoped replacement without duplicate terms.

## Roadmap reconciliation

Reuse `person_aliases`, `person_external_identifiers`, `person_details`, `person_jurisdictions` and `legislative_terms`.
Do not create parallel alias/identifier tables from the old plan. Office identities, versioned district geometries,
and entity mentions remain separate future capabilities. The roadmap distinguishes implemented schemas and clients
from missing production population, unverified archival behavior and unimplemented office/geography work.

Remaining gates: terminal full-wave verification; approved OpenStates stable-ID acquisition and state reconciliation;
source-backed alias/identifier population. These are explicit gaps, not reasons to merge ambiguous records today.

## Verification

### Bills scan continuation correction

The September 8 bills child consumed 3,250 requests in about 37 minutes and returned `incomplete`. Its successor
started listing the same range again. Previously every reference downloaded its bundle before checking for unchanged
data; the canonical-ID/date checkpoint was not a safe resume position because the provider does not promise ID
ordering among tied dates.

The scan now persists a fixed `pendingScan` date range and successful reference receipts in the existing checkpoint.
Receipts contain the canonical bill ID and source update value, are recorded only after successful processing, and
are discarded when that scan finishes. Continuations still enumerate the source list, but skip bundle downloads for
receipted references regardless of order. Failed records and changed update values are fetched again. Later scans and
explicit date-range replays do not inherit completed-scan receipts. Existing deferred source-gap handling remains.
This trades temporary checkpoint growth proportional to the scan's processed references for avoiding repeated bundle
requests; it does not promise to eliminate listing requests or establish an ETA from request count alone.
Receipt checkpoints are batched every 100 successes and flushed at budget handoff and range completion. An abrupt
process loss may replay up to 99 successfully processed references; it cannot skip an uncommitted record.

Focused continuation, synchronization and coordinator coverage passed 19 tests; service and web types passed.
The already-running worker remains on its original deployment. Production continuation behavior must be verified
on a run using the corrected code before this gate is considered complete.

Commit `6f14a11` was pushed and deployed successfully as Trigger `20260908.10`, deployment `j733552e` (26 tasks),
after the live API contract check passed. Repository verification passed checks but remains blocked by unrelated
scoring coverage thresholds. The isolated legislation run exposed a replay-test flake comparing HTTP `Date` across
a second boundary (2,450 tests passed, one failed, 61 skipped). Replay assertions now permit only the generated Date
header to differ; response status, body and every other header remain compared. No webhook runtime behavior changed.
After the assertion correction, isolated `pnpm test:coverage` completed successfully: 2,451 Vitest tests passed,
61 skipped, and all four webhook receiver tests passed. PostgreSQL integration tests remain among the skips;
this does not establish live continuation or production identity-population acceptance.

### Approved production handoff (2026-09-08)

With explicit user approval, coordinator `run_06g853d10it3r9rilcrepa7h01` and bills worker
`run_06g85c072clbgudo71eii3gn01` were canceled. Both reached `CANCELED`; PostgreSQL then showed no non-idle
session or index build. No checkpoint was deleted or rewritten. Exactly one replacement coordinator,
`run_06g85oh7uodjjsfv32j65hoi01`, started on `20260908.10` using idempotency key
`bill-scan-continuation-handoff-20260908-2117`.

The first replacement bills child safely deferred with zero provider attempts until `2026-09-08T21:22:01.641Z`,
respecting the previous job's lease. The new member refresh is executing; amendments, events, House votes and
committee reports completed. Resumable scan initialization and population verification remain pending; do not
bypass the lease or launch another coordinator to accelerate the handoff.

On September 9, the corrected bills scan had persisted 16,200 successful reference receipts across multiple
budget handoffs, with the fixed cutoff still `2026-09-08T21:22:07Z`. Completion remains pending. The identity tables
were still empty: investigation found the recurring entity synchronization adapter still discarded aliases and
identifiers, although CLI and historical range composition were wired. That adapter now passes through the hydrated
records and Congress alias-provider scope; its existing daily-route test asserts both alias forms and Bioguide ID.
This correction requires a new-version member refresh before production population can be accepted.

### Federal identity population implementation (2026-09-08)

Congress member detail hydration now emits the published Bioguide identifier and distinct collection,
direct-order and inverted-order names into the existing identifier and alias tables. No name is inferred from
first/last-name components and no name-only identity merge is performed. Untrusted source URLs do not authorize
alias replacement or emit identifiers. CLI and Trigger range ingestion both deduplicate these records across
Congress snapshots. Alias replacement is provider-scoped, preserving OpenStates rows during Congress refreshes.

Focused normalizer, hydration and range tests pass 18 tests. A new PostgreSQL case checks repeated identity
replacement, stale Congress alias removal and preservation of another provider's aliases/identifiers; all 19
database integration tests remain skipped because Docker Desktop cannot start/report a working engine.
Service and web TypeScript checks pass. Production population is not yet verified: the existing Congress wave
is still running, so no competing backfill was launched. State identity acquisition remains gated on self-hosted
OpenStates. The zero-row counts above are the earlier inventory, not a post-deployment population result.

Implementation commit `73fa795` was pushed to `main` and deployed successfully as Trigger `20260908.9`
(deployment `10103jza`, 26 tasks), after the live API contract gate passed. The isolated legislation coverage
command passed 2,449 tests, skipped 61, and passed all four webhook receiver tests. Repository verification
passed checks but failed on unrelated scoring coverage thresholds; a web workflow deletion test also failed.
The full repository gate remains red.

Docker's backend log identifies its startup failure as an inaccessible runtime socket at
`C:/Users/andcra/AppData/Local/Docker/run/dockerInference`. A recoverable rename of that exact file failed with
the same Windows error. No runtime file was removed, and no Docker volume or database was reset. Local
database replay execution remains blocked on Docker Desktop recovery, not a passing integration result.

Focused contract/readiness/member/amendment checks passed 22 tests. The 18 PostgreSQL entity integration tests,
including the strengthened persistence replay case, were skipped: the local Docker daemon is unavailable and no
test database was configured. They were not pointed at production. Service and Next type checks passed.
The deployment gate rejected the pre-contract production API as intended before the new API was uploaded.

After correcting lint errors in the new guard, `pnpm verify` passed its check stage but stopped at unrelated
scoring coverage thresholds (lines 96.09%, functions 99.79%, statements 95.44%, branches 93.78%, against 100%).
The repository-wide verification gate is not green; the interrupted legislation coverage run is not a complete pass.

Railway deployment `57197853-4d0e-4072-8e9f-d27ca154adeb`, source commit `5548045`, reached **SUCCESS**.
The live release gate then passed against the new `/ready` contract. Authenticated person details returned 200 for
Brown (`B000918`, 18 terms), Spence (`S000718`, 16), Abercrombie (`A000014`, 11), and Slotkin (`S001208`, 4).
The preceding successful API artifact was `5b83e53a-7af3-4588-98cd-9e99b4bee9d8`; it lacks the advertised
contract and would intentionally block subsequent gated importer deployment until the API is brought forward again.
No Trigger redeploy or interruption of the running sync was necessary.

The local Docker startup attempt did not expose a working engine within the bounded check. Persistence regression
execution therefore remains unverified. The resumed full wave also remains pending; do not treat these release and
member-refresh checks as a terminal result for bills, amendments or the entire recurring coordinator.

### Failed-record isolation and historical identity refresh (2026-09-11)

Congress bill synchronization now persists failed bundle references in `recordRetries` on the existing stream
checkpoint. A completed listing advances `scannedThrough` and releases its fixed scan cutoff even when individual
records fail. Failures remain failures in that attempt's counts and report; no synthetic bill or success receipt is
created. Subsequent scans prioritize fresh changes, then retry at most 25 due records, including records no longer
returned by the listing. Unchanged failed revisions back off from one hour to a maximum of 24 hours; changed revisions
and explicit replay may retry immediately. Request-budget handoffs retain the durable retry entries. The
`record_retry_backlog` event and checkpoint entries disclose unresolved records even when a later scan succeeds.
Successful scans must not be described as complete historical coverage while that ledger or listing gaps remain.

The singleton Congress wave coordinator accepts `kind: "entities"` with an inclusive `startCongress`/`endCongress`
range. It uses the same global allocation and child lease machinery as other Congress work, but launches only the
existing hydrated entity-range importer. It does not fan out unrelated historical bills, events, or votes. This enables
historical alias/Bioguide population without competing independent API-budget allocators. Deployment and production
acceptance for these changes is tracked below.

Commit `6201055` was pushed and deployed as Trigger `20260911.1` (`6ejl9t6f`, 26 tasks). Production canary
`run_06g91rprq88c48dvn7c1d8eb01` released the old fixed cutoff and advanced the watermark from September 4 to
September 8. Both upstream failures (111/S/3605 and 113/S/1997) remain explicit retry entries; no source records were
fabricated. The next scan began at September 8 20:22 UTC through September 11 14:47 UTC. The coordinator subsequently
completed all six recurring scopes; the checkpoint advanced through September 11 15:28 UTC with no pending scan.
By 16:10 UTC, 119/HR/1004 had recovered, leaving only the two upstream MemberTerm errors in the retry ledger.

The identity audit also verified Congress.gov's live `officialWebsiteUrl` field using member `L000491`. The importer
previously read `officialUrl`, silently losing the published website. The source parser and regression input now use
the actual field; the canonical API output remains `officialUrl`. Historical refresh must use this corrected version.

The 19 focused retry/coordinator tests passed. Repository verification passed its check stage, then failed in unrelated
scoring `observatory-integration.test.ts` on a five-second timeout; it is not a green full-repository result.

Website mapping and acceptance reconciliation commit `2230505` is pushed to `main` and deployed as Trigger
`20260911.2` (`zo107nt5`, 26 tasks). The identity normalization/hydration/range suite passed 18 tests. The isolated
legislation suite passed 2,459 tests with 61 skips, plus all four receiver tests; the latest repository verification
again failed on the unrelated scoring observatory timeout.

As of the September 11 follow-up, item 1's isolation and forward handoff are accepted and item 4's API-ledger
reconciliation is complete (77 accepted, nine data gates, two search timeouts). Item 3's historical population is
**not complete**: the last completed population audit had Congress aliases/identifiers for 555 of 1,623 Congress-backed
people. After confirming no active Congress wave, the identity-only coordinator was launched as
`run_06g92gni459kkd7i3g6vnhqk01` with `kind: "entities"`, `startCongress: 105`, `endCongress: 119`, and idempotency key
`historical-identity-population-105-119-20260911`. Its child is `run_06g92gnpa4ehabsdr958llei01`.
That attempt failed closed on the HTTPS-only `officialWebsiteUrl` parser before replacing the snapshot. The parser
and person-details constraint now accept HTTP/HTTPS official-site metadata without rewriting the source URL;
unsafe schemes remain rejected, and Congress API provenance/fetch rules remain HTTPS-only. The baseline migration
and schema snapshot match the corrected constraint, which was applied and validated in production with a two-second
lock timeout and no row rewrite. Parsing errors now identify the Bioguide member to make future source defects actionable.
Do not launch an overlapping identity wave. Verify the resulting people coverage, inspect any
remaining missing identities, and smoke historical alias/identifier/website projection before closing item 3.
The stopped Codex follow-up remains paused. No new source, MCP cutover, or rate limiter was introduced.

The corrected importer shipped as Trigger `20260911.3` (`k3ajaw8t`) from pushed commits `13f6aa6` and `600f348`.
Coordinator `run_06g92mg3gt79lp6ths8481q901` and child `run_06g92mh3pqqkreemn4hr18e901` both completed successfully:
1,668 source requests, 12,378 people/term records processed, zero failures, Congresses 105–119 complete. Production
now has 1,623 complete Congress profiles, aliases, and identifiers, with 544 published websites. The sole HTTP website
is Christian D. Menefee (`M001245`), verified directly against Congress.gov as `http://menefee.house.gov/` and returned
unchanged by the authenticated person-detail API. Brown and Abercrombie historical detail requests also returned
source-backed records successfully. The earlier import failure was not limited to an old member's website.

Do not confuse range completion with every stored person being hydrated: the database contains 2,135 Congress-prefixed
identities, of which 512 still lack complete aliases/identifiers. Sample residuals include Abdnor, Abourezk, Adams,
Addabbo, and Aiken, with null source-provider attribution. Their complete coverage has not been audited; no records were
deleted or merged to hide the gap. The approved 105–119 population run is complete, while this residual is a separate
remaining coverage question.

Verification: 79 focused tests and service/web types passed; isolated legislation coverage passed 2,465 tests with
61 skips, plus all four receiver tests. Full `pnpm verify` remains red in the unrelated scoring suite (including
worker-termination/time-limit failures); it is not a green repository-wide result.

API deployment attempts `a2a11fd4-23d6-4cb7-8730-1a95a106acbb` and `b7c1fe2c-b525-402d-98d4-a551bcb554f2`
timed out during upload and remained `INITIALIZING`, without a build for the first attempt. The active successful API
release remains `57197853-4d0e-4072-8e9f-d27ca154adeb`; the new search pagination code is committed/pushed but its API
deployment is not verified. Do not label either search timeout gate closed.
