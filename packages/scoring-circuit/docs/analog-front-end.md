# Three-weapon analog front-end specification

## Scope and status

This document defines the next prototype boundary: protected acquisition of the seven external conductors used by the
left and right A/B/C body-cord sockets and the conductive piste. It supplies values for simulation and fixture design,
but it does not release a schematic or PCB for fabrication.

The FIE source is `apps/scoring/docs/fie-material-rules-2026-08-en.pdf`, August 2026. The local Favero comparison is
`apps/scoring/docs/favero-fa15-t2016-specifications-en.pdf`. Page numbers below are printed PDF page numbers.

## Governing limits

| Behavior | Required boundary | Source |
| --- | ---: | --- |
| Foil contact break | 14 ms +/- 1 ms | FIE pp. 78-79; Favero p. 1 |
| Foil external circuit | valid registration through 500 ohms | FIE p. 78 |
| Foil closed circuit | tolerate 200 ohms without a false off-target indication | FIE p. 78 |
| Foil insulation warning | always on at no more than 450 ohms; always off above 475 ohms | FIE p. 79 |
| Epee contact | reject below 2 ms; register in the 2-10 ms range at 10 ohms | FIE p. 80; Favero p. 1 |
| Epee exceptional circuit | still register at 100 ohms | FIE p. 80 |
| Epee grounded material | reject with as much as 100 ohms in the earth path | FIE p. 80 |
| Sabre contact | capture 0.1-1.0 ms; reject below 0.1 ms | FIE p. 82; Favero p. 1 |
| Sabre exterior circuit | tolerate 100 ohms | FIE p. 82 |
| Sabre control break | more than 250 ohms for 3 ms +/- 2 ms | FIE p. 82 |

The current FIE rules still prescribe a 12 V supply (+/- 5%) and, for official competition, an external battery or UPS
with at least five minutes of backup (FIE pp. 42, 44-45, and 49). That requirement applies to apparatus power, not to
the voltage presented to the weapon conductors. The sensing cell therefore does not depend on a 12 V analog rail: its
protected 2.5 V excitation is derived from a precision reference after the product's regulated power stages.

The product instead uses one USB-PD SPR 20 V, 3 A input. It does not make 12 V or VRLA chemistry an architectural
dependency. See `fie-modern-power-proposal.md` for the proposed standards path and the resulting FIE approval gate.

## Proposed Rev-B sensing cell

Each external conductor gets the same replaceable and calibratable cell:

1. A TPD4E05U06DQAR shunts IEC ESD/EFT energy at the connector to a short, dedicated ESD-return path. Two quad devices
   cover the seven conductors and leave one channel spare.
2. A 22 ohm pulse-rated series resistor separates the connector clamp from the precision node.
3. One active-high TMUX1112PWR channel connects the node to the 2.5 V reference through a 2.49 kohm, 0.05% source
   resistor. A second TMUX1112PWR channel connects it to scoring ground through a matched low-value sink path. Four
   packages provide independently controlled source and sink paths for all seven conductors, with defaults held off by
   hardware pulldowns.
4. A 1 kohm resistor and 470 pF C0G capacitor protect and settle the STM32 ADC input. Low-leakage Schottky clamps protect
   the MCU pin; the final diode and rail-clamp network remains a prototype measurement because leakage and injected
   current affect the 450/475 ohm decision band.
5. STM32G474 ADCs sample the relevant weapon matrix while internal comparators timestamp fast transitions. The target is
   no more than 10 us for the weapon-specific sabre phase set, no more than 25 us for a full diagnostic scan, and 1 us or
   better comparator timestamps.

The 2.49 kohm source resistor limits a normal short to about 1 mA. Because excitation and ADC reference both derive from
REF5025, the resistance calculation is ratiometric and largely rejects reference drift. Firmware subtracts measured
switch and protection resistance using per-channel calibration rather than assuming typical switch resistance.

## Topology decision status

The Rev-B cell remains the baseline model. The bounded topology review in
[`m4-03-minimal-topology-decision.md`](m4-03-minimal-topology-decision.md) found no compliant no-new-rail,
component-only isolation revision. In particular, `ADG7421FBCPZ-RL7` protects a low-voltage source pin to +/-60 V but
guarantees normal operation only from `VSS + 0.1 V`, excluding the normative 0 ohm path on `3V3A`. It is rejected, not a
coupon or production candidate. The smallest credible protected-switch route currently needs a separately supervised
8 V or higher rail, so it is deferred rather than added without a measured necessity case.

## Why this is not over-engineered

- It uses the STM32's existing ADCs, comparators, timers, reference, and DMA instead of adding a precision ADC.
- The current topology avoids a new rail, serial crosspoint, and an SPI-controlled single point of failure.
- One repeated cell covers every weapon; weapon differences live in source/sink patterns and immutable timing tables.
- The model excludes exact clamp diodes, connector contact construction, and extra EMC filtering until fixture evidence
  shows they are necessary.

## Executable model

`spice/line-sense.cir` models the reference, source resistor, switch resistance, connector protection resistance, cable
capacitance, ADC isolation resistor, C0G filter, and a timed external contact. `pnpm analog:simulate` runs a bounded
transient audit matrix rather than a few representative examples:

| Case family | Coverage | Acceptance purpose |
| --- | --- | --- |
| Resistance boundary | 0, 10, 95/100/105, 195/200/205, 245/250/255, 445/450/455, 470/475/480, and 495/500 ohms | Exercise the rule boundaries and their +/- 5 ohm fixture points |
| Line capacitance | 0.5, 2, 5, and 10 nF at 100 and 500 ohms | Bound fast sabre/epee paths and the high-resistance foil path |
| Pulse width | 50 us, 100 us, 1 ms, 2 ms, 10 ms, and 14 ms | Prove that the analog node settles for sub-rule stress pulses and all relevant rule-scale pulses |
| Selected-device bounded series screen | 100, 250, 450, 475, and 500 ohms at -40 C and 125 C, with 3V3A at 3.135 V and 3.465 V | Screen the published TMUX and selected resistor bounds without calling them a full-corner pass |

Sabre-relevant paths at or below 100 ohms get a 10 us response budget; higher-resistance foil diagnostic paths get a
50 us budget. Every case also compares the settled voltage with the resistor-network calculation within 2 mV. Applying
the sabre budget to the foil-only resistance range would add bandwidth without improving conformance.

The selected-device screen uses the published `TMUX1112PWR` 9.8 ohm maximum at 3.3 V +/-10% and -40 C to 125 C, plus
the selected `CRCW060322R0FKEAHP` and `CRCW06031K00FKEAHP` 1% tolerance and 100 ppm/C TCR. It also records the
`TPD4E05U06DQAR` 10 nA maximum leakage at 2.5 V as an input, but the transient netlist has no justified low-voltage
clamp model. Both declared 3V3A endpoints share the same worst-case TMUX RON envelope; they are coverage labels, not
independent supply-transfer simulations. The 2.49 kohm source-resistor candidate is a declared 0.05%, 10 ppm/C
constraint, not a released manufacturer selection. The 470 pF C0G capacitor likewise has no selected MPN or applicable
tolerance in the netlist.

Consequently, the generated `dist/analog-sim/summary.json` has two separate outcomes: `transientScreen` can pass its
response and nominal-voltage checks, while `m401Closure.status` is mechanically `DENY` and `fullCornerPass` is `false`.
No consumer may promote the bounded series screen to a temperature, supply, or tolerance full-corner pass. The report
lists the exact cases, inputs, limitations, and coupon-only gates: low-voltage clamp leakage and external-clamp priority,
LQFP64 ADC residual and sampling kickback, assembled PCB/cable parasitics, and MCU injection/cross-channel crosstalk.

This is a topology and timing model. It does not prove ESD survival, ADC accuracy, switch charge injection, cable
coupling, or all three-weapon classification sequences. Low-voltage diode behavior, ADC effects, rail injection, and
assembled parasitics are coupon gates unless an applicable package-and-condition vendor maximum becomes available.

## Socketed fixture plan

Build one reusable fixture before the scoring PCB:

- six 3-pin body-cord connectors plus a piste terminal, wired as two fencers and a scoring-box port;
- Kelvin-characterized resistance paths at 0, 10, 100, 200, 250, 450, 475, and 500 ohms;
- switchable 0.5, 2, 5, and 10 nF line-capacitance banks;
- a pulse generator producing 50 us, 100 us, 1 ms, 2 ms, 10 ms, 13 ms, 14 ms, and 15 ms contacts;
- break-before-make relays whose closed resistance and bounce are recorded separately from the simulated external path;
- oscilloscope points at the connector, protected node, ADC pin, comparator output, reference, and scoring ground;
- a calibrated negotiated 20 V USB-PD input at its declared tolerance limits, brownout ramps, external-UPS transfer, and scoring-domain
  current measurement.

The fixture first validates one sensing cell on a socketed coupon. Only after its threshold error is within +/- 5 ohms
from 0 to 500 ohms across the selected temperature range do we populate all seven cells. ESD, EFT, surge, sweat/salt,
and cable-fault testing occur on sacrificial coupons before they are allowed near a scoring MCU.

## Acceptance matrix

1. Every resistance boundary is tested at nominal, boundary - 5 ohms, and boundary + 5 ohms.
2. Every timing boundary is tested at boundary - fixture uncertainty, boundary, and boundary + fixture uncertainty.
3. Open, short, cross-line, blade/guard, opponent target, self-lame, and piste combinations are exercised for both sides.
4. Results are repeated at minimum, room, and maximum qualified ambient temperature and at the declared 20 V PD input
   tolerance limits. The simulation's two endpoints do not replace this coupon requirement.
5. No single open switch-control line, stuck switch, ADC saturation, missing reference, or MCU reset may produce a
   qualified touch; faults must become diagnostics or a safe unavailable state.

Passing this fixture plan opens detailed schematic capture. It does not by itself open PCB fabrication.
