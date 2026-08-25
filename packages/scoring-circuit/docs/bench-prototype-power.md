# BP-050 simplified P0 power

P0 has one populated input: sink-only USB-C PD at 20 V, 3 A, 60 W. The chain
is `10177070-00011LF` → `TPD4S201TRGRRQ1` and `TPD2EUSB30DRTR` protection →
provisional `TVS2200DRVR`/`B340A-13-F` VBUS protection →
`TPS25730ADREFR` → `TPS259474ARPWR` → `TPS56A37RPAR` 5 V conversion.

There is no laboratory power connector or source selector. Diagnostic current
measurements use labeled test pads and removable links. USB-C must be removed
and all rails discharged before installing a meter or shunt; the links and
test pads are never power-injection points.

The known ESP32-only load excluding the AFE is 23.86 W continuous and 24.96 W
for 100 ms, approximately 1.46 A and 1.52 A at the 20 V source. This retains
about 0.87 A against the current eFuse worst-low screen, but is not the final
rail budget. Exact AFE/reference/ADC, radio, primary-output, conversion-loss,
startup, and thermal loads remain open.

The 5 V stage retains `TPS56A37RPAR`, `744325330`, two
`GRM32ER7YA106KA12L` input capacitors, `885012206095` bypass, and two
`GRM32ER71E226KE15L` output capacitors. The display branch retains its
`TPS259474ARPWR`, 698 ohm ILM resistor, `045106.3MRL` fuse, and physical
disconnect.

Release remains denied for four explicit reasons: the TVS2200 worst-case clamp
must be proven safe for the TPS25730A or replaced; the complete ESP32/AFE rail
budget must pass; PD/inrush/load-step/cable-drop/trip/thermal/shutdown evidence
must be measured; and USB-C 20 V plus external five-minute backup still needs
separate FIE acceptance. P0 does not add dormant battery circuitry to hide the
last production-compliance decision.
