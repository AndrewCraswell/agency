# Independent scoring-box tester roadmap

Research snapshot: 2026-08-22. This is a verification-instrument roadmap, not a
released tester design, schematic, fabrication package, or claim that the scoring
apparatus passes physical qualification.

## Product decision

Build a separate, independently powered scoring-box tester that connects to both
three-contact reel interfaces and the piste/ground reference where present. It must
drive calibrated electrical sequences into a complete scoring machine, observe the
machine's physical outputs, and produce the same evidence vocabulary used by the
canonical bout-test observatory.

The tester is a verification instrument, not part of the scoring authority and not a
subassembly of the scoring box. Its firmware, timebase, power, calibration, and result
storage must remain independent enough that a scoring-box defect cannot make its own
test pass.

This work is a parallel `BT` track. It must not delay initial scoring-box EVT solely
because the tester enclosure or productization is incomplete. A calibrated tester and
correlated result format become required evidence for formal DVT timing and behavioral
qualification.

## Prior-art boundary

The [Skewered scoring-box page](https://skewered-fencing.com/scoring-box) demonstrates
a frozen event timeline around a hit, with separate valid-contact, blade-contact,
fault, short, first-hit, and lockout indications. Its
[browser simulator](https://skewered-fencing.com/scoring-box-sim) exposes plug, hit,
short, and parry controls while running its scoring-box behavior. Its
[box-tester page](https://skewered-fencing.com/box-tester) describes an RP2040-controlled
network of 15 solid-state relays covering all pairwise connections between six fencer
lines, variable resistance, sub-millisecond switching, and Bluetooth configuration.

These are useful capability references, not specifications or design authority. We
will not copy Skewered's display, timeline layout, configuration language, hardware
topology, or implementation. The FIE rules remain normative for regulated behavior;
our approved product requirements and regression corpus remain authoritative for
additional operational behavior.

## Required capability

### Stimulus side

The first tester release must provide:

- two unmistakably keyed three-contact reel cables plus a separately controlled
  piste/ground reference, so all seven declared conductors can be exercised;
- commanded open, closed, grounded, permitted target-context, cross-line,
  disconnected, and fault paths without assuming that a six-line 15-switch network
  is sufficient for our seven-conductor contract;
- calibrated, discrete resistance settings that cover each approved decision boundary
  and selected degraded-cord and lame cases, with stated uncertainty and no hidden
  fixed switch resistance;
- selectable cable-capacitance banks and pulse widths needed by the approved foil,
  epee, and sabre cases;
- deterministic simultaneous transitions, measured make/break delay, jitter, bounce,
  and channel-to-channel skew;
- polarity-independent, floating interfaces that tolerate the declared scoring-box
  line-state and supply envelope without back-powering either product;
- bounded fault injection for shorts, cross-connections, unplug/replug, piste contact,
  brownout coordination, and cable intermittency; and
- a self-test path that detects a welded, open, leaky, or misrouted switch before it
  can issue a passing scoring-box result.

The exact switch count and topology must follow an electrical coverage proof. A full
seven-node pairwise matrix would contain 21 pair relations, but that count alone does
not prove the required grounded, resistive, capacitive, or isolation behavior.

### Observation side

The tester must evaluate the complete apparatus rather than trusting an internal debug
record. It therefore needs independent, timestamped observation of:

- left and right valid-hit lamps;
- left and right off-target, short, and fault indications where applicable;
- buzzer start, duration, and declared acoustic behavior;
- lamp latching and reset behavior;
- extension-lamp or clock outputs when those claims are enabled;
- scoring-box decision records and replay records as secondary correlation evidence,
  never as the sole physical-output oracle; and
- power, reset, watchdog, and unavailable-state behavior for operational scenarios.

Electrical output sensing is preferred where a defined connector exists. Calibrated
photodiodes and an acoustic sensor may verify the user-visible/user-audible result, but
their threshold, placement, ambient rejection, and uncertainty must be controlled.

## Timeline and evidence model

The bout-test observatory is the human review surface for both virtual and physical
runs. Each tester run must retain aligned lanes for:

1. commanded conductor transitions;
2. measured conductor transitions after switch delay and bounce;
3. physical lamp and buzzer observations;
4. emitted decision and replay records;
5. expected events and expected non-events; and
6. pass, fail, skipped, indeterminate, and infrastructure-error evaluations.

Every event needs an integer microsecond timestamp, tester boot/run identity, tester
hardware and firmware revision, scoring-box revision and boot identity, calibration
identity, measured uncertainty, raw-capture reference, and source scenario IDs. The UI
may animate or summarize this evidence, but stored records remain immutable and replay
must not re-decide the bout.

Our timeline must be designed from this event model and our own visual language. It
must not reproduce Skewered's patented-pending timeline presentation or display
arrangement.

## Test layers

| Layer | Purpose | Release meaning |
| --- | --- | --- |
| Virtual corpus | Runs host scoring logic and renders deterministic expected/actual timelines | Finds rule and observatory regressions; no hardware claim |
| Tester self-test | Measures switch topology, resistance, leakage, timing, skew, sensors, and stuck paths | Establishes that the instrument is usable for the declared run |
| Scoring-box behavioral run | Drives both reel interfaces and observes physical output behavior | Verifies one apparatus revision under declared calibration and conditions |
| Golden-unit correlation | Compares multiple testers and scoring boxes against traceable instruments | Bounds tester-to-tester and unit-to-unit variation |
| DVT qualification | Repeats the approved matrix across temperature, supply, cable, reset, and fault conditions | Supports formal product claims within the approved scope |
| Production/service subset | Runs a shorter escape-detection and diagnosis suite | Does not replace DVT or broaden FIE claims |

## Executable BT-01 through BT-05 contracts

The detailed BT-01 through BT-05 behavior is maintained in tested source instead of
separate status documents:

- [`box-tester-requirements-contract.ts`](../src/box-tester-requirements-contract.ts)
  maps every frozen requirement family to an independent stimulus, physical or virtual
  observation, uncertainty statement, and retained evidence class. DUT records remain
  secondary correlation evidence; unavailable participating evidence is indeterminate,
  and infrastructure failure remains distinct from a DUT failure.
- [`box-tester-interface-contract.ts`](../src/box-tester-interface-contract.ts) keeps
  the two keyed three-contact reel interfaces, separate piste reference, independent
  power and timebase, floating polarity-independent boundary, source-envelope limits,
  open-when-unpowered behavior, and no-back-power requirement. It does not authorize an
  energized connection or infer unmeasured DUT limits.
- [`box-tester-dut-limits.ts`](../src/box-tester-dut-limits.ts) requires four-wire
  resistance measurement, calibrated capacitance, measured delay, bounce, skew,
  leakage, isolation, observer uncertainty, and a seven-conductor coverage proof before
  selecting or releasing a switch topology.
- [`box-tester-sequence.ts`](../src/box-tester-sequence.ts) deterministically compiles
  strict accepted scenarios into detached, deeply frozen logical steps while preserving
  authored order and integer-microsecond timestamps. Unknown, unsafe, non-monotonic,
  accessor-backed, duplicate, or over-capacity input fails closed; the compiler never
  supplies scoring decisions or hardware relay instructions.
- [`box-tester-virtual-timeline.ts`](../src/box-tester-virtual-timeline.ts) projects an
  immutable sequence and existing scenario result into fixed command, measurement,
  expected, actual-output, and evaluation lanes. Virtual measurements are explicitly
  not physical observations, and passed, failed, skipped, indeterminate, and
  infrastructure-error outcomes remain distinct.

These contracts are planning and host-validation boundaries only. BT-06 through BT-12
retain ownership of tester hardware, calibration, physical correlation, qualification,
production, and service evidence.

## Milestone plan

| ID | Deliverable | Acceptance |
| --- | --- | --- |
| BT-01 | Tester requirements, independence, and coverage contract | Every normative and product-behavior requirement maps to stimulus, observation, uncertainty, and evidence; unsupported behavior is explicit |
| BT-02 | Reel, piste, output-sensor, and safety interface contract | Connector mapping, voltage/current envelope, floating boundaries, misuse, and no-back-power behavior are reviewed |
| BT-03 | Switch-matrix and programmable-impedance architecture | Coverage proof chooses the minimum justified topology; resistance, leakage, capacitance, timing, skew, and fault energy meet allocated limits analytically |
| BT-04 | Tester sequence language and scenario compiler | Canonical scenarios compile deterministically without copying timing constants; invalid, unsafe, or unsupported steps fail closed |
| BT-05 | Virtual tester and observatory integration | The UI runs virtual cases, animates commands, measurements, and evaluations, and distinguishes pass, fail, skipped, indeterminate, and infrastructure-error results |
| BT-06 | Tester schematic, PCB, harness, and enclosure release | Independent review covers safe defaults, isolation, calibration paths, test access, connectors, strain relief, and fabrication outputs |
| BT-07 | Prototype bring-up and calibration | Incoming inspection, self-test, resistance/capacitance/timing calibration, switch delay/skew, leakage, and sensor thresholds are archived |
| BT-08 | Fault-containment and uncertainty report | Welded/open switch, wrong cable, DUT overvoltage, power loss, communication loss, and sensor failure force an indeterminate or infrastructure-error result before a pass is issued |
| BT-09 | Physical-output observer correlation | Lamp, buzzer, extension, reset, and unavailable observations correlate with traceable electrical/optical/acoustic instruments |
| BT-10 | Golden-scenario hardware correlation | Tester commands, measured line states, physical outputs, records, and host expectations align for all approved three-weapon cases |
| BT-11 | Full operational-behavior qualification suite | Power/reset, degraded cable, replay, display/audio, connectivity coexistence, service, and long-run cases produce reviewable evidence |
| BT-12 | Tester release, service, and correlation program | Multiple instruments reproduce limits; a drift-backed calibration interval, golden unit, firmware update, service, and periodic correlation are controlled |

## Scope guardrails

- BT-01 through BT-05 may proceed before scoring-box PCB fabrication.
- BT-06 must not release hardware until M0-03, M0-10, M4-05, and M4-13 provide
  stable electrical, power, fixture, and harness boundaries.
- M6 may use calibrated laboratory fixtures before BT-12 productization. Formal M7
  timing qualification requires accepted BT-10 correlation, and the DVT release
  decision requires BT-11 operational-behavior evidence.
- The tester does not certify FIE approval by itself. It supplies traceable evidence
  for the declared rule revision and product behavior.
- A tester failure is never silently converted to a scoring-box failure. Instrument,
  setup, DUT, expectation, and infrastructure outcomes remain distinct.
- The production fixture may reuse validated tester modules or protocols, but M8-03
  remains a separate manufacturing-coverage decision.

## Near-term work

The next bounded deliverables are BT-01 and BT-04. They can reuse the current golden
scenario schema and bout-test observatory while the physical analog and connector work
continues. Hardware selection starts only after the seven-conductor interface,
programmable-impedance uncertainty, and output-observation requirements have been
reviewed.
