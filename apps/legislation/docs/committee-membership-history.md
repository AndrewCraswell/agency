# Committee membership history

## Decision

Federal committee membership history is reconstructed from successive GovInfo Congressional Directory editions. The
system records when a membership first appears and when a later complete edition first omits it. These are detection
dates, not legal appointment or departure dates.

GovInfo is the only approved federal committee source. Open States remains the approved state committee source. Adding
another committee source requires product approval.

## Canonical membership fields

An organization membership may contain both source-effective dates and observation-derived dates:

| Field | Meaning |
| --- | --- |
| `legislativeSessionId` | Congress or state legislative session that scopes the tenure, when known |
| `effectiveStartDate` | Appointment start date explicitly supplied by the source; never inferred |
| `effectiveEndDate` | Appointment end date explicitly supplied by the source; never inferred |
| `detectedStartDate` | Publication date of the first complete source edition in which the tenure appears |
| `detectedEndDate` | Publication date of the first later complete source edition in which the tenure is absent |
| `lastObservedDate` | Publication date of the latest complete edition in which the tenure appears |
| `endedReason` | Defined reason that explains why the tenure is no longer current |
| `tenureOrdinal` | One-based sequence for leave-and-return tenures with the same source relationship identity |

`endedReason` is a database and API enum:

- `roster_removal_detected`: a later complete roster no longer contains the membership; `detectedEndDate` is required.
- `congress_ended`: the membership reached the end of its Congress without a detected removal; the session supplies the
  scope boundary and `detectedEndDate` remains null.

Null `endedReason` means no end condition has been recorded. The public `isCurrent` value is based on the recorded end
state and session boundary; a source retrieval timestamp is never treated as an effective or detected membership date.

## Federal reconstruction

For every Congress, the importer discovers all archived Congressional Directory editions, orders them by publication
date, and applies only editions whose required House and Senate committee sections parse completely. For each person,
committee, and Congress:

| Previous complete edition | Current complete edition | Result |
| --- | --- | --- |
| absent | present | Start a tenure at the current edition's publication date |
| present | present | Preserve the tenure and advance `lastObservedDate` |
| present | absent | End the tenure with `roster_removal_detected` at the current edition's publication date |
| absent | absent | No change |
| present, then absent, then present | present | Start a new tenure with the next `tenureOrdinal` |

Membership identity is unique by organization, person, legislative session, and tenure ordinal. Role is an attribute of
the tenure rather than part of its identity. Role-change history and outbound webhooks are deferred; replaying historical
editions must not send external notifications.

At the end of a historical Congress, every otherwise-open membership in that session is closed with
`congress_ended`. The session end date is a scope boundary, not an inferred departure date. A person listed again in the
next Congress receives a new Congress-scoped tenure.

The 105th Congress onward is the candidate reconstruction window for electronically created directories. Actual
edition availability must be inventoried before promising transitions: live discovery on 2026-09-06 returned one
package each for Congresses 105 and 118. A single retained edition supports a roster snapshot, not a complete sequence
of historical joins and departures. Earlier directories likewise require format validation.

The [live edition inventory](committee-directory-inventory.md) identifies 23 historical editions. The 118th has passed
production import and API verification, as has the 116th. The 117th
and 105th–115th remain gated on the documented source/layout discrepancies. Historical writes preserve current
organization metadata. Do not run a destructive restart across unvalidated editions.

The historical reconstruction command (not yet validated for production) is:

```powershell
pnpm --filter legislation cli govinfo:committees --start-congress 105 --end-congress 119 --restart
```

The end Congress must be advanced as new Congresses begin. `--restart` is an explicit replacement operation for the
requested GovInfo history rather than an incremental polling mode.

## Completeness and replay safety

- A missing required committee section, unmatched person, malformed edition, or failed transaction aborts that edition.
- An incomplete edition never closes memberships.
- Congress replacement is scoped by `legislativeSessionId`; importing one Congress cannot close another Congress.
- Restart deletes and rebuilds only GovInfo committee memberships in the requested Congress range, plus obsolete
  unscoped GovInfo committee memberships from the prototype importer.
- Checkpoints advance only after an edition commits.
- Replaying the same complete edition is idempotent.

## API contract

Membership resources expose `legislativeSessionId`, `effectiveStartDate`, `effectiveEndDate`, `detectedStartDate`,
`detectedEndDate`, `lastObservedDate`, `endedReason`, and `isCurrent`. Federal clients may derive the Congress number from
the referenced session identifier; federal collection filters may also accept `congress` as a convenience filter.

Date filters operate on effective dates when present and otherwise on detected dates. Responses never collapse these
fields into an ambiguous `startDate` or `endDate`.

## Operational sequencing

Schema work, importer implementation, and local verification were safe to perform while embedding HNSW indexes built.
The index build is now complete. The production historical backfill remains a separate gate because it creates sustained
database writes and still requires a bounded canary with adequate production I/O headroom.

### Current-Congress rollout (2026-09-06)

The live 119th-Congress edition is `CDIR-2026-02-20`. Its text parses into 42 committees and 179 subcommittees.
All 3,875 roster entries match existing Congress.gov people after repairing independently wrapped text columns. The
parser also reconciles the total roster annotations against parsed members so silently omitted entries abort import. Matching
requires a unique normalized full name in the requested Congress and chamber; district annotations are not identity
keys because this edition has inconsistent districts and some canonical at-large terms have no district. The explicit
Thom Tillis alias resolves to `person:congress:t000476`. Ambiguous names still abort the edition.

Membership inserts use batches of 1,000 within the same snapshot transaction to stay below PostgreSQL's bind-parameter
limit. The production canary completed with 3,871 distinct memberships covering 530 people; repeated source entries
collapse to their canonical membership identity. All memberships belong to `session:us:119`, have detected start
`2026-02-20`, and leave unknown effective dates and end reasons null. Historical rollout evidence follows below.

The `govinfo-committee-directory-sync` Trigger task runs at 09:30 UTC daily in production, using
`FEDERAL_END_CONGRESS`. It has concurrency one and retains the database ingestion lease shared with the CLI. Schedule
creation followed the successful canary and API checks. It imports newly dated editions, not historical Congresses.

Same-package revision handling now uses canonical roster fingerprints for the latest imported edition. Identical
rosters skip membership writes even when metadata changes. Changed rosters use a strictly later GovInfo modification
date, never retrieval time. Changes dated after Congress ends or newly discovered editions preceding an already
observed correction require historical replay instead of inventing transitions. Older superseded editions are not
automatically replayed by the daily current-Congress poll.

An existing checkpoint without a fingerprint is initialized only when the published roster matches the source.
Snapshot writes and their observation checkpoint commit atomically. The workstation production canary
`a7b0796a-1221-4d33-a702-28cd5e3549a1` succeeded on 2026-09-06: one edition read, one skipped, zero membership writes.
Trigger correction handling is deployed in `20260906.4`; its current-Congress canary completed with zero writes.
Historical format coverage and backfill remain incomplete.

Release evidence:

- Code: `49e2a8e`, `f9c435b`; Trigger deployment `20260906.1` (`ieo7my8o`).
- Canary: `run_06g7fdvrophjjjne395ctfou01`, `COMPLETED`, no failures. The earlier workstation canary was rolled back
  after the count cross-check identified omitted entries; no partial memberships were published.
- Unchanged rerun: `run_06g7fiv0q3ftn5v1kehnmvj101`, `COMPLETED`, one edition skipped and zero writes.
- Production schedule: `sched_qxezm85n7mjzjt4u7n585`, active; first scheduled run `2026-09-07T09:30:00Z`.
  Its deduplication key is `committee-directory:production:daily`; it is separate from the bill-sync schedule manifest.
- Deployed API smoke: HTTP 200 for Senate Agriculture, House Agriculture, and its Livestock/Dairy/Poultry subcommittee
  detail and member lists; canonical membership detail and person membership history also returned 200. Canonical
  membership IDs and detected/effective date separation were verified. House Agriculture returned 54 members.
- `apps/legislation` verification passed: 1,965 tests plus four webhook-receiver tests; 58 database-dependent tests
  skipped. Root `pnpm verify` remained blocked by unrelated scoring test timeouts; hooks were not bypassed.

### Historical and correction rollout (2026-09-06)

- Code `f34d82e` and `0e381f7` is committed and pushed to main. Trigger `20260906.2` deployed as `x7uyo2g4`;
  `20260906.3` is confirmed live by completed current-Congress canary `run_06g7i56lq218trshdb8cnrnr01`.
  That canary read one edition, skipped one, and wrote zero memberships.
- The 118th backfill `run_06g7i13co48jljhahd9u9uo401` completed successfully. Its 3,670 source entries reduce to
  3,669 distinct memberships across 222 organizations. All historical memberships have session `session:us:118`,
  detected start `2024-04-25`, `endedReason=congress_ended`, `isCurrent=false`, and no invented detected end date.
  The duplicate is Juan Ciscomani on House Appropriations / State, Foreign Operations, and Related Programs;
  both printed entries have identical identity, district, and role.
- Both current-roster fingerprints were unchanged after import: 221 active organizations
  (`e812699a8fe9960e07779433fa580ce2`) and 3,871 119th memberships (`cd1930c034a3ad02ed39aa07149304ab`).
- Authenticated deployed person membership history and organization member lists returned HTTP 200. Following the
  returned historical membership `canonicalUrl` also returned HTTP 200 with matching ID, session, detected date,
  and Congress-end semantics. Membership detail is organization-scoped, not `/api/memberships/{id}`.
- The 116th import `run_06g7i596qkn4k2lf1rtcln6701` completed successfully: 3,678 memberships across 215 organizations
  and 531 people. Database verification on 2026-09-07 confirmed detected start `2020-07-22`, all rows inactive with
  `congress_ended`, and no detected end dates. Both 119th fingerprints above remain unchanged. Deployed person history
  and its returned organization-scoped membership canonical URL passed HTTP 200 and historical-field assertions.
- The 118th unchanged rerun `run_06g7i5dnnrs89n46ilvj8ip601` completed successfully: one edition skipped, zero writes.
  The 116th unchanged rerun `run_06g7llrsemli8bbavset1ura01` also completed successfully with one edition skipped
  and zero writes.
- Schedule readback on 2026-09-07 confirmed the production daily schedule remains active. Its first scheduled run is
  still due at 09:30 UTC on 2026-09-07; a successful manual canary is not evidence that this scheduled run has fired.
- Verification: 2,033 legislation tests and four receiver tests passed; 60 database-dependent tests skipped.
  Lint, types, and unused-code checks passed. Latest root `pnpm verify` failed on two unrelated
  `@repo/fc-theme-base` size-chart Liquid test timeouts; an earlier run failed that package's coverage thresholds.
  Git hooks were not bypassed.

Final review also tightened historical publication: incoming memberships for ended Congresses are closed before
the snapshot/checkpoint transaction, avoiding a temporary active state if follow-up cleanup is interrupted.
The cleanup remains for recovery of older rows; current-Congress membership behavior is unchanged.
This safeguard is committed as `c63d24a`, pushed to main, and deployed in Trigger `20260906.4` (`gd3wutzu`).
The deployed current-Congress canary `run_06g7i6u9hho6slbl3qcq11gs01` completed successfully with one edition skipped
and zero membership writes.

### Follow-up verification (2026-09-07)

The 116th and 118th imports and their unchanged reruns are verified above. Code `364211a` adds bounded historical
layout fixes and the corroborated 117th state-suffix normalization; Trigger `20260907.1` deployed as `5enfmwcu`.
Code `b2c8460` adds strict string-or-string-array GovInfo names and corroborated July 2018 printed-name corrections.
July 2018 now reconciles fully without production writes; October still blocks the 115th import. Other older-edition
source/parser gates remain in the [inventory](committee-directory-inventory.md).

The full repository verification on this date is blocked by unrelated `apps/scoring` coverage thresholds; legislation
lint, types, and focused parser/name tests passed. No hooks were bypassed.

Final deployment: Trigger `20260907.2` (`6h6szqlk`) from `b2c8460`. Current-Congress smoke
`run_06g7lojvhe8kll1kqhc9a14001` completed with one edition skipped and zero writes. Final legislation tests passed
in split runs: 1,788 tests plus 256 Next router acceptance tests and four receiver tests; 60 database-dependent tests
remain skipped. The router suite initially collided with a concurrent Next build, then passed when rerun alone.

### Prevalidation release and scheduled execution (2026-09-07)

Code `5d19822` is committed and pushed; Trigger `20260907.3` deployed successfully as `yhrw1lnq`.
All pending historical editions are now parsed and identity-validated before the first roster publication.
Final legislation coverage run passed 2,068 tests plus four receiver tests; 60 database-dependent tests skipped.
Root verification passed format, lint, types and unused-code checks but stopped on three unrelated Shopify Liquid
test timeouts. Pre-commit and pre-push hooks passed without bypass.

The first actual scheduled execution, `run_06g7mcvghtduksemlkqnq8b801`, completed at the September 7 09:30 UTC
schedule on version `20260907.2`. Its payload identifies schedule `sched_qxezm85n7mjzjt4u7n585`; it read one edition,
skipped it unchanged, and reported zero writes and zero failures. The next execution is September 8 at 09:30 UTC.
This closes the first-scheduled-run verification gate.

The 114th backfill `run_06g7n0k81r2g3nnrddsggdt501` completed on `20260907.3`. Database verification confirms
210 organizations, 3,546 memberships and 534 people; all memberships are inactive with `congress_ended`, detected
start `2016-02-12`, and null detected end. Both current-Congress fingerprints recorded above remain unchanged.
Deployed person history and LoBiondo's recovered CIA chair canonical membership detail returned HTTP 200 and
passed role, session/date and historical-closure assertions.

Code `5125ae3` is committed and pushed; Trigger `20260907.4` deployed successfully as `1tj08lv5`. Final legislation
coverage passed 2,078 tests and four receiver tests, with 60 database-dependent tests skipped. Root verification
again stopped on three unrelated Shopify Liquid test timeouts; hooks passed normally.

The 114 unchanged rerun `run_06g7n588c9r763fetruvt2k901` completed on `20260907.4`: one edition read and skipped,
zero writes, zero failures. This closes the 114th import verification gate.

The following jobs were dispatched to the backfill task's concurrency-one queue. Completion is not yet verified:

- 110, both fully reconciled editions: `run_06g7n589dc4hcob593mhsr6n01`.
- 111, fully reconciled 218 organizations / 3,896 memberships: `run_06g7n58abmjnfvn5vipq50qj01`.

### Reconnected release and 110th import (2026-09-07)

Trigger builds `20260907.5` and `20260907.6` failed during remote build-context transfer with connection reset /
keepalive timeout errors. After reconnection, code `0a74690` deployed successfully as `20260907.7` (`s0nzpv0l`).
The release includes the final same-edition-corroborated October 2018 Cardin/Tillis corrections.

The 110th run `run_06g7n589dc4hcob593mhsr6n01` completed on `20260907.4`, processing both editions without failures.
Database checks confirm 3,742 memberships across 217 organizations and 531 people, detected start `2007-08-09`,
all inactive with `congress_ended`, and zero detected end dates. The 119th membership fingerprint remains unchanged.
Deployed API smoke and unchanged rerun `run_06g7nf9430qlok3er69bnqet01` remain verification gates.

The validated 115th import `run_06g7nfjouuouo0uhpf0uudlo01` is queued behind the 111th import and 110th rerun.
No queued run is recorded as completed until its terminal result and database/API checks are verified.

The 111th run `run_06g7n58abmjnfvn5vipq50qj01` completed: database verification confirms 3,896 memberships,
218 organizations and 535 people, detected start `2009-12-01`, all inactive with `congress_ended`, and zero detected
end dates. Its unchanged rerun is `run_06g7nouklut7lkj4fm212t3r01` (not yet verified).
The 110th unchanged rerun completed on `20260907.7`, skipped both editions and wrote zero rows.
After one transient Railway credential-refresh failure, authenticated API verification passed for both Congresses:
Daniel Lipinski's person history and each returned canonical membership detail returned HTTP 200 with matching IDs,
expected detected starts, `congress_ended`, `isCurrent=false`, and null detected ends. The 110th verification gate is closed.

The 111th unchanged rerun completed on `20260907.7`, skipped its edition and wrote zero rows. Its verification gate
is closed. The 115th import also completed on `20260907.7`; database checks confirm 3,643 memberships across
210 organizations and 530 people, detected start `2018-07-27`, all closed with `congress_ended`, and no detected end
dates. The 119th fingerprint remains unchanged. Authenticated Cardin history and canonical detail checks passed
HTTP 200 with the expected historical fields. The 115th unchanged rerun is `run_06g7nqsi3iqbieu5jj1jmgmg01`;
it completed, skipped both editions and wrote zero rows. The 115th verification gate is closed.

The follow-up edition-year identity and corroborated early-spelling batch passes all 244 executed legislation test
files plus four receiver tests; four database-dependent files remain skipped. One earlier coverage attempt lost
a temporary coverage artifact and had a router assertion failure; the full isolated rerun passed. Root verification
remains blocked in the unrelated Shopify package. No hooks were bypassed.
