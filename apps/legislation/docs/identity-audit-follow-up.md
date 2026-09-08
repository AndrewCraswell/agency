# Identity audit follow-up

September 8, 2026. This classifies stored identity evidence; it does not authorize name-only merges.

## Post-refresh verification

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
