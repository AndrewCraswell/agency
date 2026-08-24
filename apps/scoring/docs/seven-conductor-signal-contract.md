# Seven-conductor logical signal contract

**Contract:** M0-03
**Status:** review draft. This is not a wiring release, fabrication approval, analogue schematic, calibration, or scoring rule table.
**Executable form:** [`../src/virtual-front-end.ts`](../src/virtual-front-end.ts)

## Boundary

The exact logical conductors are `left.A`, `left.B`, `left.C`, `right.A`,
`right.B`, `right.C`, and `piste`, as defined by the root-approved M0-02
glossary. `left` and `right` are apparatus positions. `piste` is the measured
conductive-piste reference, not protective earth, chassis, or processor ground.

`A`, `B`, and `C` are logical identities only. The BP-103 uppercase net labels
are deliberately exported as one-way physical aliases only:

| Logical ID | BP-103 physical alias |
| --- | --- |
| `left.A`, `left.B`, `left.C` | `LEFT_WEAPON_A`, `LEFT_WEAPON_B`, `LEFT_WEAPON_C` |
| `right.A`, `right.B`, `right.C` | `RIGHT_WEAPON_A`, `RIGHT_WEAPON_B`, `RIGHT_WEAPON_C` |
| `piste` | `PISTE` |

Aliases cannot be supplied as logical relation endpoints. They do not assign a
connector contact, source polarity, sense impedance, analogue threshold, or
fabrication-ready harness. BP-103 remains separately gated for schematic and
fabrication review.

## Phase identity and derived weapon

The earlier draft described a `weapon` field while the front-end frame contained
only a weapon-prefixed phase ID. The executable contract resolves that mismatch
by carrying **no caller-supplied weapon field**. The profile selected by `phaseId`
derives the weapon exactly, so a contradictory `weapon: "foil"` with an epee
phase cannot be encoded.

Each profile fixes perspective, one authorized logical source conductor, required
relation count, and legal endpoint templates. `own` is the record side and
`opposing` is the other apparatus position.

| Weapon | Phase ID | Perspective | Authorized source | Required relations |
| --- | --- | --- | --- | --- |
| Foil | `foil-circuit-integrity` | acting-side | own A | own A to own B |
| Foil | `foil-target-context` | acting-side | own A | own A to opposing C; own A to piste |
| Foil | `foil-insulation-diagnostic` | affected-side | own A | own A to own C |
| Epee | `epee-tip-loop` | affected-side | own A | own A to own B |
| Epee | `epee-ground-reference` | affected-side | own A | own A to piste |
| Epee | `epee-line-integrity` | affected-side | own A | own A to own B; own A to own C; own B to own C |
| Sabre | `sabre-target-contact` | acting-side | own A | own A to opposing C |
| Sabre | `sabre-own-equipment` | affected-side | own A | own A to own C |
| Sabre | `sabre-blade-contact` | acting-side | own B | own B to opposing B |
| Sabre | `sabre-bc-control` | affected-side | own B | own B to own C |

These are named logical observations, not a second scoring implementation.
M1 still owns contact duration, resistance boundaries, qualification, lockout,
and classification. A confirmed grounded-material relation is legal,
non-scoring evidence; it is never converted to a hit.

## Acquisition command and ordering

`VirtualFrontEndCycleCommand` is an exact seven-field machine record:
`atUs`, `cycleId`, `phaseId`, `relations`, `side`, `source`, and `stage`. `atUs` is an
integer microsecond instant validated by M0-02. Only `observe` can carry an
array of relations; every other stage requires `relations: null`.
The `safe-inactive` receipt status is distinct from `released`: the former
proves the pre-excitation guard state, while the latter records completion of a
previously observed phase.

For a single `cycleId`, `phaseId`, and `side`, the only legal order is:

1. `safe-inactive`
2. `select-source`
3. `settle`
4. `observe`
5. `release`, or `fault`

Timestamps must strictly increase. `safe-inactive` and `release` have no
active logical source. `select-source`, `settle`, and an available `observe`
carry a source witness that must exactly equal the profile's source conductor. A different source is unauthorized
excitation. A complete `observe` has exactly the profile's required relation
count and one reading for every listed endpoint template. The contract deliberately states no settle duration or sample period;
those require the M4 measured analogue contract.

The legacy timestamped snapshot helper remains the M2 acquisition container and
preserves its prior raw-relation semantics. Automatic profile-based cross-line
detection is deliberately limited to the new complete cycle command. New
producers must use the cycle command.

## Canonical relation and fault handling

A relation has two lexically ordered canonical endpoints, a named state,
provenance timestamp, optional resistance plus uncertainty, and an optional
diagnostic. Resistance values are integer milli-ohms or both `null`; zero is a
measurement, not absence. Extra fields, unknown conductors, unordered
endpoints, future provenance, malformed units, or unknown phase IDs are
validation errors and are never treated as a quiet open circuit.
Cycle-command preflight accepts only plain objects with own enumerable data
properties and dense ordinary arrays. It rejects inherited properties,
accessors, symbols, hidden keys, sparse arrays, array subclasses, and aliased
relation values before evaluating any command value.

The front end automatically converts an otherwise ordinary relation outside the
active profile's legal endpoint set into `crossLine` with diagnostic
`cross-line`. It does not require a caller to recognize its own fault. A
cross-line, out-of-range measurement, unavailable sample, sample overrun, or
unauthorized excitation forces a safe-inactive fault result. Multiple open,
closed, or grounded readings for one endpoint pair are retained as
contradictory evidence and force `indeterminate`, not a guessed state.

`advanceVirtualFrontEndCycle` maps valid but unusable evidence fail-closed:

| Condition | Receipt diagnostic | Result |
| --- | --- | --- |
| Missing, wrong-cycle, wrong-phase, or skipped stage | `cycle-incomplete` | `fault`, safe inactive |
| Non-increasing timestamp | `stale-sample` | `fault`, safe inactive |
| Cross-line relation | `cross-line` | `fault`, safe inactive |
| Out-of-range relation | `out-of-range-resistance` | `fault`, safe inactive |
| `sample-overrun` evidence | `sample-overrun` | `fault`, safe inactive |
| Contradictory or uncertain evidence | `uncertain-evidence` | `fault`, safe inactive |
| Explicit fault command or unsafe acquisition state | `safe-state` | `fault`, safe inactive |
| Unauthorized source selection | `unauthorized-excitation` | `fault`, safe inactive |

No unavailable, uncertain, cross-line, out-of-range, incomplete, stale, or
contradictory record creates or continues a candidate. The fault receipt keeps
the phase identity and derived weapon but has no scoring output. It cannot
clear a previously latched signal; scoring authority and output reset ownership
remain M0-04 and M0-10 decisions.

## Non-goals and gates

This contract does not release connector contacts, bodywire colors, wiring,
source amplitude/current, ADC thresholds, isolation, calibration, fixture
limits, analogue topology, or fabrication. It does not duplicate foil, epee,
or sabre scoring logic.

Before hardware release, software and electrical owners must review the phase
profile against the physical map, analog safety, measurement uncertainty, and
the BP-103 gates. M1 must then bind these observations to weapon rule tables,
including grounded-material rejection and legal non-scoring outcomes.
