# Committee membership history

This contract defines reconstruction and coverage. The recorded acceptance below is dated; refresh it before a new import.

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
- `historical_at_first_observation`: explicitly historical at first encounter; inactive, session-scoped, with null detected start/end and last-observed dates. Effective dates remain independently nullable.
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

The latest recorded September 8 acceptance imported all fourteen historical Congresses, 105–118.
Thirteen have complete reviewed roster coverage; the 117th has an explicitly quarantined Udall cell and remains incomplete.
This is roster acceptance, not complete transition history or a new live coverage check. The 113th import and unchanged
rerun passed; its separate authenticated historical API smoke still needs verification. Current-Congress preservation
and unchanged reruns are required for every future historical import.

The historical reconstruction command is shown below. Validate source editions, quarantine and current database readiness before selecting a range:

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


## Source exceptions

Use the [reconciliation policy](committee-reconciliation.md) and [reviewed source decisions](../../src/ingestion/govinfo/review-data/source-decisions.md).
Unexpected unmatched cells fail closed. Quarantine coverage is committed with the per-Congress roster checkpoint and
survives unchanged reruns. An absent assessment means unknown. Organization and person membership reads disclose the
applicable historical warning even when a filtered page is empty; current-only reads do not inherit an old Congress warning.
