# P0 phased seven-conductor acquisition

Status: active schematic correction. Fabrication, measured scoring readiness, and FIE conformance remain denied.

## Correction from OpenPiste prior art

The pinned OpenPiste revision 1.2 PCB and firmware show an important conductor-model correction: the connector has
seven conductors, but those conductors are not seven independent voltages that should be converted simultaneously.
The apparatus selects named source, sink, and read relationships. Its A conductors are driven while B, C, and piste are
the five analog sense nodes.

We adopt that conductor-role insight, not the OpenPiste circuit. The prototype does not copy its direct ESP32 GPIO
exposure, internal-ADC thresholds, resistor values, firmware, PCB geometry, or conformance claims. The pinned files
remain read-only GPL-3.0 prior art under `apps/scoring/docs/specifications/boards/open-piste/`.

## Simplified protected topology

The revised prototype uses:

- seven external conductors: left A/B/C, right A/B/C, and piste;
- three `TMUX1208PWR` 8:1 multiplexers selecting exactly one source, one sink, and one sense node per phase;
- two reset-cleared `SN74HCS595PWR` registers for the complete phase word;
- five `ADA4177-1ARZ` protected sense buffers for B, C, and piste;
- one shared `ADS8881IDGS` converter and one shared `REF5025AQDRQ1` reference;
- two TPD4E05U06 ESD arrays and one 22-ohm series resistor per external conductor; and
- calibrated 470-ohm source and sink paths on every conductor.

The source and sink paths create a measurable divider through the selected external relationship. The selected protected
sense node is then digitized. This fixes the previous design's central flaw: seven high-impedance ADC inputs with source
switches but no controlled sink could not establish a defined resistance-measurement current path.

The active-high mux enables default low because both shift registers clear on `APP_RESET_N`. Their hardware output enable
is pulled high, so reset, boot, and watchdog recovery leave source, sink, and sense disconnected. Firmware must latch the
whole phase before enabling it, and source and sink may never select the same conductor.

## Timing and evidence boundary

At 20 MHz the single 18-bit ADC word shifts in 0.9 microseconds. The paper phase budget is 3 microseconds settling plus
the ADS8881 0.71-microsecond maximum conversion interval and 0.9 microseconds readout, or 4.61 microseconds. Firmware will
sample the two weapon-critical relations on every fast cycle and interleave target, guard, piste, leakage, and health
relations. It will not wait for an atomic all-relations snapshot.

The 4.61-microsecond figure is a design budget, not measured proof. Before ordering, P0-06 must close the exact TMUX1208
footprint and schematic details. Bring-up must measure settling, source/sink resistance, ADC/reference recovery,
crosstalk, open-circuit behavior, overload recovery, and the FIE 0/100/200/250/450/475/500-ohm regions with uncertainty.

The executable contract and circuit are
[`p0-seven-line-acquisition.ts`](../src/p0-seven-line-acquisition.ts) and
[`p0-seven-line-acquisition.circuit.tsx`](../src/p0-seven-line-acquisition.circuit.tsx).
