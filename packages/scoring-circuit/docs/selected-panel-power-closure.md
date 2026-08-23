# Selected panel power closure

**Status:** the selected Adafruit product ID `2277` passes the arithmetic
power-fit screen under the current provisional assumptions. This is not a
production approval, a thermal sign-off, or a fabrication release. The panel's
published approximately 4 A full-white figure is an EVT input, not a measured
worst-case trace.

The executable model is
[`src/selected-panel-power-budget.ts`](../src/selected-panel-power-budget.ts),
with regression coverage in
[`src/selected-panel-power-budget.test.ts`](../src/selected-panel-power-budget.test.ts).
It deliberately sits beside the generic allocation model: the generic model's
maximum display allocation remains a separate denied screen.

## Selected configuration

The selected configuration is:

- USB-PD SPR input: 20 V, 3 A, 60 W. No 5 A cable, EPR contract, battery, or
  charging path is introduced by this calculation.
- Adafruit `64x32 RGB LED Matrix - 5mm pitch`, product ID `2277`, at the
  published approximately 20 W / 4 A, 5 V full-white condition.
- The selected `LMR43620MSC3RPERQ1` application rail using its 0.85 efficiency
  floor for the existing 2.60 W continuous and 3.20 W 100 ms local-load
  allocations.
- The selected `TPS56A37RPAR` V5 buck using the 0.85 efficiency floor.
- The selected 2 mOhm V5 telemetry shunt, whose I-squared-R loss is charged to
  the buck and the upstream eFuse.
- The existing 1 W USB-PD/eFuse path-loss allowance before the V5 buck.

The eFuse-bounded V5 ceiling is **40.60 W after the shunt**. It is derived from
the worst-low approximately 2.40 A eFuse current limit, the 20 V input, the
0.85 V5 conversion floor, and the 2 mOhm full-rail shunt. The calculation does
not treat the 2.99 A worst-high eFuse limit as usable capacity.

## Executable result

The 100 ms line is a short screen for an already-running rail. It is not an
approval of panel startup or inrush.

| Quantity | Continuous | 100 ms screen |
| --- | ---: | ---: |
| USB-PD source envelope | 48.00 W / 2.40 A | 54.00 W / 2.70 A |
| Selected panel load | 20.00 W / 4.00 A at 5 V | 20.00 W / 4.00 A at 5 V |
| Application local load | 2.60 W at 3.3 V | 3.20 W at 3.3 V |
| Application load at V5 input, using 0.85 efficiency | 3.06 W | 3.76 W |
| Direct V5 fixed loads | 3.90 W | 6.70 W |
| Total V5 load after shunt | **26.96 W** | **30.46 W** |
| V5 load current after shunt | 5.39 A | 6.09 A |
| Telemetry-shunt loss | 0.058 W | 0.074 W |
| V5 load before shunt | 27.02 W | 30.54 W |
| V5 buck conversion loss at 0.85 floor | 4.77 W | 5.39 W |
| USB-PD/eFuse path-loss allowance | 1.00 W | 1.00 W |
| USB-PD source demand | **32.78 W / 1.64 A** | **36.93 W / 1.85 A** |
| Worst-low eFuse current limit | 2.40 A | 2.40 A |
| eFuse current headroom | 0.76 A | 0.55 A |
| Guaranteed post-shunt ceiling | 40.60 W | 40.60 W |
| Post-shunt power headroom | 13.64 W | 10.14 W |
| Arithmetic selected-configuration fit | **PASS** | **PASS** |

The selected panel therefore fits the current guaranteed post-shunt ceiling in
both the continuous and 100 ms arithmetic screens. The source-demand lines
also remain below both source-utilization envelopes and the worst-low eFuse
current limit. The source demand includes the 1 W pre-buck USB-PD/eFuse path
allowance; the buck loss and shunt loss are shown separately so that no loss is
silently hidden in the panel allocation.

## Generic maximum remains denied

This selected-panel result does not loosen the generic design envelope. The
unselected display allocation still reports **34.79 W** for the 100 ms peak,
but the eFuse-bounded maximum display allocation is only **30.34 W** after the
generic peak fixed loads. Therefore the generic maximum-allocation screen
remains **DENY**. The PASS above applies only to the presently selected 20 W
EVT panel under its published approximation.

## Open startup, inrush, and thermal gates

The model intentionally returns `releaseState: "deny"` and an explicit
`startupInrush.status: "unmeasured-gate"`. The panel's 20 W steady figure does
not describe its turn-on current or duration, and the 100 ms screen must not be
used as an inrush rating. Before production approval:

1. Capture panel startup with the exact 2277 revision attached to the released
   V5 output capacitor, eFuse, USB-C adapter, cable, and HUB75 harness.
2. Record peak current, duration, output-capacitor droop, eFuse behavior, USB-C
   source response, panel-end voltage, cable drop, and connector temperature.
3. Repeat after warm-up at the declared maximum brightness and refresh setting,
   with audio, Ethernet, Wi-Fi, and scoring loads active.
4. Confirm the repeated blocked-vent 50 C thermal test for the TPS56A37,
   inductor, shunt, eFuse, USB-C connector, application regulator, panel
   harness, and PCB copper.
5. Keep `productionApproved: false` until the exact panel revision, CAD,
   connector assembly, logic thresholds, signal integrity, and these electrical
   and thermal measurements are evidenced.

The panel remains an EVT selection and the carrier remains a design candidate;
this closure prevents a known product-load conflict from being hidden, but it
does not waive the physical verification gates.

## Related records

- [HUB75 panel selection](hub75-panel-selection.md)
- [Generic USB-C power budget](usb-c-power-budget.md)
- [V5 power-stage and eFuse coordination](v5-power-stage.md)
- [Application V3_3 rail](application-3v3-rail.md)
- [Reset and display safing](reset-and-display-safing.md)
