# W5500 support-network selection

## Decision

The isolated support-network decision selects exact, orderable parts for the
W5500 clock, bias, reference outputs, local supply filtering, and local
decoupling. The executable record is
`src/ethernet-support-network.ts` and its focused tests are
`src/ethernet-support-network.test.ts`.

This record is now integrated into the communications-module connectivity
model. It remains a selected, unplaced network, not a communications-module
release. `integrationRelease`, `fabricationRelease`, and `releaseState` remain
`false`, `false`, and `deny`.

## Primary-source requirements

WIZnet's W5500 v1.1.0 datasheet specifies:

- 25 MHz crystal operation, ±30 ppm frequency tolerance, 18 pF load capacitance, 7 pF maximum shunt capacitance, a 59.12 uW drive level, and ±3 ppm per year maximum aging at 25 °C.
- 12.4 kOhm, 1% from EXRES1 pin 10 to analog ground.
- 4.7 uF from TOCAP pin 20 with a short trace.
- 10 nF from 1V2O pin 22.
- 2.97 V to 3.63 V supply range and 132 mA normal-operation current at 3.3 V.
- all-capable auto-negotiation when PMODE[2:0] is `111`; this record does not change the module's PMODE integration.

The WIZnet EVB schematic is used only as a reference implementation. It shows
the same EXRES, TOCAP, 1V2O, 18 pF crystal network, an analog-supply ferrite,
and five local 0.1 uF capacitors. It is not treated as a production layout or
as proof that five capacitors are sufficient for this design.

## Selected parts

| Function | Reference | Selected part | Relevant manufacturer limits |
| --- | --- | --- | --- |
| 25 MHz crystal | `Y_W5500` | ECS `ECS-250-18-33B-JGN-TR` | 25.000 MHz, 18 pF, ±20 ppm tolerance, ±30 ppm stability, 2 pF maximum shunt capacitance, 40 Ohm maximum ESR, 200 uW maximum drive, ±2 ppm first-year aging, -40 °C to 85 °C, ECS-33B2 3.2 mm x 2.5 mm x 0.8 mm, 1,000-piece reel |
| Crystal load capacitors | `C_W5500_XI`, `C_W5500_XO` | TDK `CGA3E2C0G1H180J080AA` | 18 pF ±5%, C0G, 50 V, 0603, -55 °C to 125 °C, AEC-Q200 |
| Crystal feedback resistor | `R_W5500_XTAL` | Panasonic Industry `ERJ3EKF1004V` | 1 MOhm ±1%, ±100 ppm/°C TCR, 100 mW, 75 V, 0603, -55 °C to 155 °C, AEC-Q200 |
| Crystal series link | `R_W5500_XO` | Panasonic Industry `ERJ3GEY0R00V` | 0 Ohm chip jumper, 0603, punched tape, -55 °C to 155 °C family category range; the exact product record does not specify jumper tolerance or power, so current and derating remain a review item |
| External reference resistor | `R_W5500_EXRES` | Panasonic Industry `ERJ3EKF1242V` | 12.4 kOhm ±1%, ±100 ppm/°C TCR, 100 mW, 75 V, 0603, -55 °C to 155 °C, AEC-Q200 |
| TOCAP reference capacitor | `C_W5500_TOCAP` | Murata `GRM21BR71C475KA73L` | 4.7 uF ±10%, X7R, 16 V, 0805, -55 °C to 125 °C |
| 1V2O capacitor | `C_W5500_1V2O` | Murata `GRM188R71H103KA01D` | 10 nF ±10%, X7R, 50 V, 0603, -55 °C to 125 °C |
| Ferrite-input decoupler and W5500 VDD and AVDD decouplers | `C_ETH_AVDD_FERRITE_INPUT`, `C_W5500_VDD`, `C_W5500_AVDD_1` through `C_W5500_AVDD_6` | Murata `GRM188R71C104KA01D` | 100 nF ±10%, X7R, 16 V, 0603, -55 °C to 125 °C |
| Ferrite candidate | `FB_W5500_AVDD` | Murata `BLM21PG221SN1D` | 220 Ohm at 100 MHz ±25%, 0.045 Ohm maximum DCR, 2.0 A at 85 °C, 1.25 A at 125 °C, 0805, -55 °C to 125 °C |

The six AVDD pins are treated as six local decoupling locations. The model
therefore connects one selected 100 nF capacitor per AVDD pin, one to VDD, and
one upstream of the AVDD ferrite. Every selected support reference is owned by
the 110 mm by 55 mm, four-layer, 0.8 mm communications module. These are
connectivity references only: no support component emits copper, mask, paste,
or other fabrication artifacts, and none is approved for placement.

The WIZnet reference clock network uses a 1 MOhm feedback resistor and a 0 Ohm
series link. The selected Panasonic parts preserve those reference values. The
0 Ohm part is recorded as a jumper because the manufacturer's product record
does not publish a jumper power or tolerance rating. The Panasonic ERJ thick-film
datasheet provides the -55 °C to 155 °C category range for the 0603 jumper family,
but the delivery or approval sheet and layout current estimate must still be
verified before release.

## Crystal calculation

The former `ECS-250-18-33Q-DS-TR3` selection is rejected because its ±5 ppm
first-year aging exceeds WIZnet's ±3 ppm-per-year limit. The executable
qualification compares every published candidate characteristic. The selected
`ECS-250-18-33B-JGN-TR` passes the paper comparison: 25 MHz equals 25 MHz,
20 ppm is no greater than 30 ppm, 18 pF equals 18 pF, 2 pF is no greater than
7 pF, 200 uW is no less than 59.12 uW, its 40 Ohm maximum ESR is published,
and its ±2 ppm first-year aging is below 3 ppm. This paper qualification does
not release the oscillator or establish long-term assembled-product aging.
The executable result therefore reports `publishedSpecificationPass: true`
while both `releasePass` and `overallPass` remain `false`.

The selected crystal and capacitors match WIZnet's 18 pF reference values, but
the effective load still depends on the board's parasitic capacitance. For
equal capacitors:

```text
Ceffective = (C1 x C2) / (C1 + C2) + Cstray
```

With 18 pF capacitors at ±5% and an explicit 9 pF stray-capacitance assumption,
the calculated effective window is 17.55 pF to 18.45 pF, containing WIZnet's
18 pF target. The 9 pF term is an engineering assumption; it is not a measured
property of the future PCB. Layout extraction and oscillator bring-up must
replace it before release.

The selected crystal's 200 uW maximum drive exceeds the W5500 datasheet's
59.12 uW drive-level value by 140.88 uW, or 3.383 times. This is a component
rating comparison only. It does not measure the oscillator's actual drive.

WIZnet does not publish a negative-resistance limit in the cited datasheet.
The production criterion therefore requires measured negative-resistance
magnitude of at least five times the crystal's maximum ESR: 5 x 40 Ohm, or
200 Ohm. That margin must hold across supply voltage, temperature, component
tolerance, and every released layout variant. The model keeps the ESR gate
unverified until controlled measurements demonstrate that margin; a result
merely above 40 Ohm is not a pass.

## Open closure gates

- Confirm the actual W5500 package revision and release its copper, mask, paste, courtyard, and thermal-pad treatment.
- Release exact footprints, copper, mask, paste, courtyard, placement, and return paths for the crystal, capacitors, resistors, and ferrite. Do not infer a released 0603 or 0805 land pattern from a package label.
- Place the crystal and both load capacitors according to the WIZnet guidance; extract or measure the resulting stray capacitance.
- Measure startup, steady-state clock amplitude, frequency, drive level, and at least 200 Ohm negative-resistance magnitude across temperature, supply, tolerance, and released-layout corners.
- Validate AVDD/VDD impedance, ferrite current and heating, W5500 supply ripple, PHY emissions, Ethernet SI, ESD, surge, and common-mode behavior on the intended four-layer 0.8 mm stack-up.
- Keep integration and fabrication denied until the circuit review, footprint review, layout review, and bench evidence are complete.

## Sources

- [WIZnet W5500 Datasheet v1.1.0](https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf)
- [WIZnet W5500 EVB v1.0 schematic](https://docs.wiznet.io/img/products/w5500/w5500_evb/w5500_evb_v1.0_140527.pdf)
- [ECS ECS-250-18-33B-JGN-TR](https://ecsxtal.com/products/crystals/surface-mount-crystals/ecs-250-18-33b-jgn-tr/) and [ECS-33B2 datasheet](https://www.ecsxtal.com/store/pdf/ECS-33B2.pdf)
- [TDK CGA3E2C0G1H180J080AA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=CGA3E2C0G1H180J080AA)
- [Panasonic Industry ERJ3EKF1242V](https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1242V)
- [Panasonic Industry ERJ3EKF1004V](https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1004V)
- [Panasonic Industry ERJ3GEY0R00V](https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3GEY0R00V)
- [Panasonic ERJ thick-film chip resistor datasheet](https://industrial.panasonic.com/cdbs/www-data/pdf/RDA0000/AOA0000C301.pdf)
- [Murata MLCC part list](https://www.murata.com/-/media/webrenewal/tool/library/common-pdf/dynamic-model/component-list-d-mlcc-2504.ashx?cvid=20250523010405000000&la=en)
- [Murata BLM21PG221SN1D product record](https://www.murata.com/en-global/products/productdetail?partno=BLM21PG221SN1%23)
