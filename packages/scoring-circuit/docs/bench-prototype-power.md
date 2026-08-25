# BP-050 simplified P0 power

P0 has one populated input: sink-only USB-C PD at 20 V, 3 A, 60 W. The chain
is `10177070-00011LF` → `TPD4S201TRGRRQ1` and `TPD2EUSB30DRTR` protection →
provisional `TVS2200DRVR`/`B340A-13-F` VBUS protection →
`TPS25730ADREFR` → `TPS259474ARPWR` → `TPS56A37RPAR` 5 V conversion.

The controller support inventory is now explicit rather than represented by
three aggregate TBD rows. The eleven 0402, 1% Yageo straps are:

| Reference | Value | Orderable MPN |
| --- | ---: | --- |
| `R_USB_PD_ADCIN1_UP` | 24.9 kOhm | `RC0402FR-0724K9L` |
| `R_USB_PD_ADCIN1_DOWN` | 10.0 kOhm | `RC0402FR-0710KL` |
| `R_USB_PD_ADCIN2_UP` | 10.0 kOhm | `RC0402FR-0710KL` |
| `R_USB_PD_ADCIN2_DOWN` | 68.1 kOhm | `RC0402FR-0768K1L` |
| `R_USB_PD_ADCIN3_UP` | 162 kOhm | `RC0402FR-07162KL` |
| `R_USB_PD_ADCIN3_DOWN` | 38.3 kOhm | `RC0402FR-0738K3L` |
| `R_USB_PD_ADCIN4_UP` | 191 kOhm | `RC0402FR-07191KL` |
| `R_USB_PD_ADCIN4_DOWN` | 9.53 kOhm | `RC0402FR-079K53L` |
| `R_USB_PD_PD5VMAX` | 10.0 kOhm | `RC0402FR-0710KL` |
| `R_USB_PD_RESERVED_26` | 10.0 kOhm | `RC0402FR-0710KL` |
| `R_USB_PD_RESERVED_36` | 10.0 kOhm | `RC0402FR-0710KL` |

The remaining controller-local capacitors are also explicit: Murata
`GCM188R71H104KA57D` (100 nF, 50 V, X7R) at `C_USB_PORT_PROTECT_BIAS`,
`GCM188R71H105KA64D` (1 uF, 50 V, X7R) at `C_USB_PORT_PROTECT_VPWR`,
`GRM21BR71A106KA73K` (10 uF, 10 V, X7R) at both `C_USB_PD_LDO_1V5` and
`C_USB_PD_VIN_3V3`, `GRM21BR71H475KA73L` (4.7 uF, 50 V, X7R) at
`C_USB_PD_VBUS`, and `GCM1555C1H331JA16D` (330 pF, 50 V, C0G) at both
protected CC pins. Native USB D-minus and D-plus each use Yageo
`RC0402FR-0722RL`, 22 Ohm, 1%, at `R_USB_DN_SERIES` and
`R_USB_DP_SERIES` respectively. These are selection records, not a
fabrication or layout release; effective capacitance, tolerance, routing, and
PD interoperability remain verification gates.

Manufacturer sources for the resistor family are the corresponding Yageo
RC0402 product specifications, for example
[`RC0402FR-0722RL`](https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0722RL).
The capacitor selections are bound to the corresponding Murata product pages
in the executable BP-050 contract.

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
