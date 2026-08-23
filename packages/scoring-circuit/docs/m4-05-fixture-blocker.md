# M4-05 dependency audit and bounded blocker

## Decision

M4-05 is **blocked**. This record is a dependency audit only; it does not release a
fixture design, a component list, a calibration procedure, or fabrication work. M4-06
and later physical work must not start from the current analog evidence.

## Dependency status

| Dependency | Result | Evidence | Consequence |
| --- | --- | --- | --- |
| M0-07 golden scenario format and corpus manifest | Satisfied for the current dependency scope | `apps/scoring/docs/golden-scenario-contract.md` defines the schema and acceptance; the manifest contains seven active epee scenarios; the scenario-runner test passes 62 tests and the manifest run passes all 7 scenarios | The fixture may reference the current logical scenario contract after an analog release; the contract does not claim a physical pin map or three-weapon corpus |
| M4-01 analog simulation audit | **Not satisfied** | The executable audit passes its nominal 36-case transient screen, but its own summary uses resistance-corner proxies instead of vendor temperature models. `analog-front-end.md` explicitly says the proxy cannot close M4-01 and leaves switch, clamp, protection, ADC kickback, PCB parasitics, and cable coupling open | M4-05 cannot yet be reviewed as covering an accepted analog model. Fixture metrology can be designed independently; it must remain distinct from later DUT correlation |

M0-07 is only satisfied for its declared current scope. It contains an epee-only active
corpus, while foil and sabre rows remain planned. That limitation does not by itself
block this audit, because the blocking gap is M4-01's analog evidence.

## Blocking findings

1. **Temperature is not modeled.** The slow corner is a resistance proxy, not a
   temperature simulation. The current model has a source-resistor TCR calculation, but
   no full-corner switch, clamp, protection, reference, ADC, leakage, or input-voltage
   behavior. M4-01 requires declared tolerances and temperature coverage; the current
   result cannot establish them.
2. **The DUT error budget remains open, but that is not a fixture-accuracy blocker.**
   The M4-03 record reports a 7.17 ohm baseline screen at 125 C after a 25 C calibration
   against a 5.00 ohm target, with switch, board, reference, and ADC terms still open.
   This is context for later DUT correlation, not a reason to prevent an independently
   calibrated resistance, capacitance, and timing fixture. The fixture's standard,
   instrument, relay/contact, temperature, and repeatability uncertainty must be
   budgeted and reported separately from DUT classification error.
3. **The M4-01 table and later fixture bullet list have different timing scope.** The
   executable M4-01 table lists 50 us, 100 us, 1 ms, 2 ms, 10 ms, and 14 ms. The later
   socketed-fixture plan adds 13 ms and 15 ms for the foil 14 ms +/- 1 ms acceptance
   boundary, while the governing matrix also names the sabre 0.1 ms and 1 ms endpoints.
   The M4-01 task row does not enumerate those exact pulse points, so their absence is
   a requirement-allocation discrepancy to resolve, not an additional M4-01 failure.
4. **The model is not a DUT-claim model.** It omits PCB/cable parasitics, ADC sampling
   kickback, ESD clamp behavior, charge injection at full corners, and MCU rail
   injection. A fixture can still be designed around its own traceable standards and
   instruments, but its eventual DUT-correlation claim must wait for the missing analog
   model terms.

## Required unblock evidence

M4-01 can be re-audited when the following are archived with the model revision:

- the normative M4-01 resistance and capacitance boundary cases, plus a reviewed
  representative/property sweep over interior values and resistance-capacitance
  interactions; this does not require simulating every integer resistance;
- declared resistor, switch, clamp, protection, reference, ADC, and supply tolerances
  with vendor-guaranteed or reviewed modelled temperature and input-voltage corners
  sufficient for the M4-01 simulation audit;
- explicit simulation cases for the M4-01 table's declared pulse widths (50 us, 100 us,
  1 ms, 2 ms, 10 ms, and 14 ms), with the model assumptions and limitations retained
  in the generated evidence.

The 13 ms, 15 ms, and sabre endpoint cases in the later fixture plan, and fixture
uncertainty itself, are M4-05 work after this dependency is accepted. They are not
prerequisites for re-auditing M4-01.

## M4-05 work after unblock

After M4-01 is accepted, M4-05 must resolve the timing-scope discrepancy and decide
whether 13 ms, 15 ms, and the 0.1 ms and 1 ms sabre endpoints belong in the fixture
acceptance only or should also be added to the analog audit. It must then create a
separate fixture uncertainty budget for the 5.00 ohm measurement allocation, covering
the calibration standard, relay/contact, instrument, temperature, repeatability, and
phase/bounce terms. That budget must state fixture uncertainty separately from DUT
classification error and must not present either as achieved physical evidence before
M4-07.

## Downstream DUT timing context

The current M4-03 screen records 9.96 us for the 100 ohm/10 nF sabre path and 31.44 us
for the 500 ohm/10 nF full diagnostic path before comparator and phase-mask uncertainty.
This belongs to M4-03, M3-07, and later DUT timing work; it is not an M4-01 or M4-05
dependency gate.

## Explicit non-goals

This blocker does not select relay, resistor, capacitor, pulse-generator, connector,
instrument, shield, guard, or safety parts. It does not define the socket topology,
calibration steps, fault-injection wiring, or operator procedure. Those are M4-05
deliverables after M4-01 is accepted. It does not authorize M4-06 fabrication readiness.
