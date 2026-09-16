# Committee membership history

This contract defines reconstruction and coverage. The recorded acceptance below is dated; refresh it before a new import.

## Decision

Federal committee membership history is reconstructed from successive GovInfo Congressional Directory editions. The
system records when a membership first appears and when a later complete edition first omits it. These are detection
dates, not legal appointment or departure dates.

GovInfo is the only approved federal committee source. Open States remains the approved state committee source. Adding
another committee source requires product approval.

## Canonical membership fields

Use [C's canonical fields, enum and tenure identity](../../../../packages/legislation-core/docs/engineering/committee-membership-history.md).

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
pnpm --filter legislation-ingestion cli govinfo:committees --start-congress 105 --end-congress 119 --restart
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

See [W membership projection and historical warning behavior](../../../legislation-web/docs/engineering/committee-membership-history.md).


## Source exceptions

Use the [reconciliation policy](committee-reconciliation.md) and [reviewed source decisions](../../src/ingestion/govinfo/review-data/source-decisions.md).
Unexpected unmatched cells fail closed. Quarantine coverage is committed with the per-Congress roster checkpoint and
survives unchanged reruns. An absent assessment means unknown; W owns its public projection.
