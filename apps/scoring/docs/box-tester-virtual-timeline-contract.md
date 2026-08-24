# Box tester virtual timeline contract

**Contract:** BT-05

BT-05 projects a BT-04 immutable sequence and an already-produced M2-12 result
into a detached, immutable virtual evidence timeline. Its source is
[`../src/box-tester-virtual-timeline.ts`](../src/box-tester-virtual-timeline.ts).
It does not invoke a weapon scorer, derive a decision, complete an authored
expectation, select a timing threshold, or claim a physical observation.

## Shared timeline

Each event has a non-negative safe integer `atUs` timestamp and belongs to one
of five lanes. Equal timestamps have fixed lane order: `command`, `measurement`,
`expected`, `actual-output`, then `evaluation`. Source order breaks remaining
ties. The result is deeply frozen and detached from caller-owned data.

- **Command:** BT-04 authored stimulus.
- **Measurement:** a virtual command mirror with the authored transition
  uncertainty. It is explicitly not a relay, conductor, lamp, or buzzer
  measurement.
- **Expected:** BT-04 authored decision, non-decision, uncertainty,
  classification, or diagnostic evidence. No event is manufactured.
- **Actual output:** a decision, uncertainty, classification, or diagnostic
  record copied from M2-12. BT-05 does not synthesize an output when no record
  exists.
- **Evaluation:** one outcome after the last retained event.

## Outcome boundary

`passed` and `failed` preserve the M2-12 comparison result. A failed virtual
evaluation is a DUT-versus-authored-expectation mismatch, not an instrument
failure. `skipped` names an intentionally non-executable case.

`indeterminate` is used when the immutable sequence cannot be paired with an
accepted authoritative output, including a scenario identity mismatch. An
`infrastructure-error` is a separately constructed operational failure such as
an unavailable runner or read failure. Neither state is converted to a DUT
failure. No BT-05 outcome constitutes physical-output, calibration, hardware,
or apparatus-qualification evidence.
