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

The 105th Congress onward supports the useful reconstruction window because GovInfo publishes electronically created
editions and retains interim revisions. Earlier directories can provide Congress-level snapshots when parsable, but do
not promise detected transitions. The initial supported reconstruction range is therefore the 105th Congress through
the current Congress.

The historical reconstruction command is:

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

Schema work, importer implementation, and local verification may proceed while embedding HNSW indexes build. The
production historical backfill is a separate gate because it creates sustained database writes. It starts only after the
active index build completes or production metrics demonstrate sufficient I/O headroom for a bounded canary.
