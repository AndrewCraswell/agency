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

The [live edition inventory](committee-directory-inventory.md) identifies 23 historical editions. None yet passes the
whole-package ingestion path: older editions need granule-based parsing, and the 118th needs layout support. Do not run
a destructive restart before these format gates and current-organization preservation are verified.

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
`2026-02-20`, and leave unknown effective dates and end reasons null. Historical Congresses are not yet imported.

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
Trigger rollout of the correction handling is pending. Historical format coverage and backfill remain incomplete.

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
