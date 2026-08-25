# BP-144 simplified reset-safe HUB75 path

`BP-144` freezes the smallest P0 display-safing circuit that still guarantees a
blank, high-impedance display path while the application is in reset. It is an
executable schematic-input contract, not layout, footprint, bench, or
fabrication approval.

## Populated circuit

The path retains two exact `SN74AHCT245PWR` devices at
`V5_DISPLAY_LIMITED`. Both `DIR` inputs are hard-wired A-to-B. Together they
carry the 13 HUB75 signals from the sole ESP32-S3 to the panel header:

- R1, G1, B1, R2, G2, B2, A, and B use buffer A.
- C, D, CLK, LAT, and OE use buffer B.

The contract freezes each ESP32 GPIO, AHCT A/B lane, actual TSSOP pin, and
panel pin. The 12 data/address/clock/latch inputs, the OE input, and the three
unused buffer-B inputs use the shared exact 10 kOhm `R_HUB75_SIGNAL_DEFAULTS`
selection (16 physical resistors). The three unused B outputs are NC. Panel OE
has one exact 10 kOhm `R_HUB75_PANEL_OE_PULLUP` to
`V5_DISPLAY_LIMITED`. Each AHCT device has one exact 100 nF
`C_HUB75_BUFFER_BYPASS` local bypass capacitor (two physical capacitors).

The two AHCT pin-19 `BUFFER_ENABLE_N` inputs are tied together as one
`DISPLAY_ENABLE_N` net. This net has exactly one low-side `BSS138AKA`
(`Q_DISPLAY_ENABLE`) sink, one shared 10 kOhm resistor row for the common
`V5_DISPLAY_LIMITED` pull-up and the `APP_RESET_N`-to-gate series resistor,
and one exact 100 kOhm gate pulldown. `APP_RESET_N` is the only reset input
consumed by BP-144.

There is no firmware-controlled display-enable GPIO, watchdog feedback,
panel feedback, reset-source authority, or separate per-buffer enable circuit.
BP-144 does not drive or fan out `APP_RESET_N`, `APP_SUPERVISOR_RESET_N`,
`SCORING_NRST_N`, or the ESP32 reset/enable state.

## Required state behavior

When `APP_RESET_N` is low, absent, or the ESP32 is in reset, the BSS138 sink
holds `DISPLAY_ENABLE_N` low. Both AHCT outputs are high impedance and panel
OE is held blank by its V5 pull-up. Data defaults low and OE input defaults
high. When `APP_RESET_N` is released high with both rails valid, normal ESP32
HUB75 operation is permitted, but only after the listed bench gates pass.

V3_3-off/V5-on and V5-off/V3_3-on states remain explicitly denied until
back-power, leakage, input thresholds, and injected-current measurements are
captured. The same denial applies to reset, brownout, cable insertion or
removal while de-energized, panel disconnection, display-branch inrush, and
signal-integrity measurements.

## Evidence boundary

The executable artifact binds the active BP-020 BOM rows, BP-121 ESP32 pad
allocation, BP-143 HUB75 header map, and the BP-123 `APP_RESET_N` contract.
BP-032/BP-033 still own exact manufacturer footprint, orientation, and CAD
evidence. BP-300 still owns schematic/ERC integration. No source or test in
this contract grants fabrication authority; `releaseState` remains `deny`.
