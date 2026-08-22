# Virtual front-end contract

**Contract:** M2-02

`src/virtual-front-end.ts` is the deterministic logical acquisition boundary
for the emulator. It accepts timestamped, complete phase snapshots over the
seven M0-03 conductors: `left.A`, `left.B`, `left.C`, `right.A`, `right.B`,
`right.C`, and `piste`.

## Scope

The module retains relation readings, resistance measurements, measured
intervals, provenance, faults, phase status, and changes between snapshots. A
relation always identifies two distinct canonical conductors in lexical order.
Its state is `open`, `closed`, `grounded`, `crossLine`, `outOfRange`,
`indeterminate`, or `unavailable`. A zero milli-ohm value is measured data,
not absence. A missing measurement is represented only by a pair of `null`
values.

An `open` relation with no fault is a normal observed open. An `open` relation
may instead carry the M0-05 `open-circuit` diagnostic, which retains the
line-fault evidence without changing the relation into a scoring outcome.
`open-circuit` is invalid for every other relation state.

Resistance is represented in integer milli-ohms. The output derives only the
structural buckets `not-measured`, `exact`, and `interval`, plus inclusive
integer interval bounds. It does not apply a threshold, calibration curve, or
weapon rule.

Every relation carries a deterministic source ID and a scoring-clock
`observedAtUs`. The source timestamp cannot be after its snapshot. A source
may provide multiple relations in one snapshot. Repeated relation IDs model
transitions; different IDs for the same endpoints preserve contradictory raw
observations. An open and closed or grounded observation for the same
endpoints makes the snapshot `indeterminate`, without discarding either
reading.

## Phase safety

The phase IDs and required perspectives are exactly the M0-03 phase profiles.
The caller explicitly supplies side, availability, excitation state, and
`safeInactive`. Active excitation has exactly one declared conductor owner;
inactive excitation has none. An `indeterminate` or `unavailable` phase must
be safe inactive with no active excitation. A `crossLine` or `outOfRange`
reading carries its matching diagnostic fault code. The front end records this
evidence but does not decide its persistence, impact on a candidate, or output
behavior.

## Determinism and bounds

The caller supplies integer, monotonic `atUs` values. The module never reads a
wall clock or schedules work. Relations and transitions are sorted by stable
canonical identifiers. Snapshots retain a bounded history (64 by default),
and each snapshot is bounded to 32 relations by default. Callers may use
smaller or larger positive safe-integer limits.

M2-03 may consume a snapshot only through an explicit weapon input adapter.
That adapter owns phase completeness for a proposed input and any selected
weapon-table projection. This module never determines hits, qualification,
lockout, target context, or analogue threshold outcomes.

## Canonical snapshot validation

`validateVirtualFrontEndSnapshot` is the M2-02 authority check for a snapshot
leaving this boundary. It reuses the front-end normalizer and rejects a shape
that does not exactly preserve canonical phase/excitation, conductor relations,
provenance, resistance bucket/interval, fault state, contradiction IDs, trust,
and transition evidence. Transition entries must be bounded, ordered, and
consistent with their current or removed relation. Without a prior snapshot,
this stateless check cannot authenticate a transition's historical `previous`
relation. M2-03 relies only on the current canonical phase and relations for a
weapon decision; historical capture remains M2-04. It does not define a second
partial front-end schema.
