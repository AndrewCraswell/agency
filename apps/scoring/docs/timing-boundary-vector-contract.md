# Generated timing-boundary vectors

**Task:** M1-08

[`src/timing-boundary.ts`](../src/timing-boundary.ts) is the deterministic
generator and rule-revision handoff for the M1-08 suite. The all-weapon
boundary corpus loads `timing-1` directly and validates any explicitly
supplied table before reading values. The separate rule-revision resolver maps
only the currently committed epee golden-corpus identity
`fie-2026-epee` to `timing-1`; every other identity fails closed with
`unknown-rule-revision`. Future foil and sabre golden identities require
review before they can be added to that mapping.

## Ordering and coverage

`generateTimingBoundaryVectors` emits definitions in the order below. For
each definition it emits `left`, then `right`, and for each side it emits
`below`, `at`, then `above`. A runtime vector's `elapsedUs` is one microsecond
below, equal to, or one microsecond above the selected scalar. The generated
corpus contains 80 vectors: 54 runtime vectors and 26 reference vectors.

| Weapon | Boundary | Selected value | Kind | Vectors |
| --- | ---: | ---: | --- | ---: |
| Epee | contact minimum | 2,000 us | runtime | 6 plus 2 reference envelope vectors |
| Epee | double-hit window | 45,000 us | runtime | 6 plus 4 reference envelope vectors |
| Foil | contact-break minimum | 13,000 us | runtime | 6 plus 2 reference envelope vectors |
| Foil | lockout | 300,000 us | runtime | 6 plus 4 reference envelope vectors |
| Sabre | minimum contact | 100 us | runtime | 6 |
| Sabre | blade registration latest | 5,000 us | runtime | 6 |
| Sabre | blade recovery | 20,000 us | runtime | 6 |
| Sabre | control-break duration | 3,000 us | runtime | 6 plus 4 reference envelope vectors |
| Sabre | lockout | 170,000 us | runtime | 6 plus 4 reference envelope vectors |
| Sabre | sensitivity test point | 1,000 us | reference | 6 |

Reference vectors retain the published FIE envelope endpoints that are not
the selected runtime endpoint, plus the published sabre sensitivity point.
They do not turn a reference into a new expiry timer or alter scoring
semantics. Runtime vectors pass the same loaded table to the epee, foil, and
sabre scorers and assert the selected endpoint behavior for both sides. The
suite keeps side ordering and within-sample hit ordering deterministic.

## Deliberate exclusions

The generator does not create meanings for unresolved or non-timing values:

- epee exceptional 100-ohm duration has no published upper endpoint;
- foil insulation resistance and warning policy belong to M1-04;
- audio duration is not in the released timing table;
- the sabre blade-interruption count is a count guard, not a timing boundary;
- published FIE tolerance endpoints remain references unless `timing-1`
  selects them as runtime values; no alternate in-envelope value is inferred.

Property testing, release packaging, physical acquisition, virtual apparatus,
transport, and UI evidence remain outside M1-08.
