# USB scoring platform

Separate native KiCad engineering draft. The existing ESP32 prototype, browser preview, and fabrication files are
unchanged. Open `usb-scoring-platform.kicad_pro` in KiCad 10. The schematic and PCB files are editable source; no
generator is needed to maintain this project. Project-local footprints reference the existing package's retained STEP
models without changing or duplicating them in Git. The new RECOM module has its own retained manufacturer STEP under
`models/recom-rec30k.step`. Other existing model sources and license notes are in
[CAD model sources](../assets/cad/SOURCES.md). Native library parts require the installed KiCad footprint and 3D
libraries.

**Ready for prototype supplier review, not released for fabrication, sale, or connection to fencers.** Local electrical
paper and assembly-layout reviews are complete for the passive-cable bench prototype. Supplier part matching, process
acceptance and final placement/CAM review are still required before ordering. Finished scoring firmware and physical
measurements are not prerequisites to ordering the prototype needed for that development. This folder is not consumed by
the existing ESP32 prototype export commands.

## Current manufacturing export

The sensing-resistor repair was re-exported to `output/manufacturing-20260907-011820/`: native ERC, DRC,
unconnected-item and schematic-parity counts are zero; the 230-reference BOM contains the fourteen updated resistor
ordering codes. PCB diff review confirms only value/ordering properties changed, with no geometry changes. The fresh
black-board 3D render was inspected; the previously noted missing body models remain, not newly removed parts. All seven
electrical models and the C/C++ coverage gate pass; both the new contact filter and existing scoring core have 100%
line/function/branch coverage. The filter also compiles for Cortex-M4 as a freestanding object, not a complete
acquisition firmware image. The subsequent scan driver, conductor decoder and corrected startup adapter also compile as
freestanding Cortex-M4 objects against the pinned ST CMSIS headers. Decoder/core/filter line, function and branch
coverage is 100%; driver coverage is 98.21% lines and 100% functions/branches. The C/C++ coverage gate passes. The
latest `pnpm verify` passed its check stage and all seven electrical models, then failed in concurrently edited
`fc-theme-base` size-chart Liquid tests (timeouts). Unrelated files and coverage thresholds were not changed to bypass
it.

Run `./export-manufacturing.ps1` in this directory with KiCad 10 installed. It checks native ERC/DRC and schematic
parity, then exports the four-layer Gerbers, separate plated/unplated drills, BOM and all-component placement files. It
stops on missing ordering fields or mismatched assembly references. Through-hole parts are included; bare J14 service
pads are excluded. Generated files go into a new ignored `output/` directory, never the earlier prototype's
manufacturing folder. The ZIP contains PCB fabrication layers only; BOM and placement are separate assembly inputs.

The current assembly export has **230 populated references**, each with manufacturer, MPN and footprint. There are 231
board footprints including J14. This replaces earlier export counts below. No substitutions or supplier part matches are
approved by this export. Specify **black solder mask** separately in the fabricator's order options; a KiCad 3D color
does not set the order color. Review supplier rotation conventions, through-hole assembly, U18 handling and programming
before submitting an order. Do not use the older tscircuit fabrication package for this design.

The current export passed ERC, DRC and native schematic parity with zero reported violations/unconnected items under the
saved project rules. This pass corrected J14's missing ordering metadata and KiCad's escaped name for unused U21 pad 17;
no copper geometry or component placement changed. The drill report contains **774 plated holes (four slots) and eight
unplated holes**. The ZIP was inspected for eleven layer files, both drill files and the Gerber job file. Its nominal
board is 165 x 100mm, 1.6mm, four copper layers. Supplier stackup approval and placement-preview review remain separate.
The saved rules ignore missing courtyards and several footprint advisories, so a clean DRC is not proof of every
component's mechanical clearance. Repository verification still stops at the existing scoring-domain TypeScript coverage
shortfall; no threshold was lowered.

## Current power decision and progress

### Electrical and assembly review outcome

The input-side allocation and passive-cable protection disposition are recorded in
[the power review](usb-acquisition-power.md#input-side-review) and the sensing section below. Retain the clamps for
passive-cord bench work; powered external conductors and shared/externally driven pistes are outside that disposition.
No protection component was removed. Suspend acceptance is source-dependent, not a universal 2.5mA number; U21 now
avoids continuous I2C traffic after qualification. Actual input/inrush/suspend power still needs bench measurement.

The acquisition review now has a concrete modeled implementation: 390-ohm/1k sensing, 40us source slots, 120us frames
and a tested C input filter before the existing weapon core. It repairs the demonstrated interrupted- contact case
without adding parts or changing routes. See the sensing section for limits and integration rules. The electrical paper
review and assembly-layout pass are complete for the passive-cable prototype scope. Physical acquisition-driver timer
integration and bench measurements remain; this is not finished scoring firmware. The register-level scan driver and
conservative frame decoder are now implemented as described below.

Assembly inspection found a real solder-wicking risk: C69's ground via was inside its paste land. It is now outside the
land at (57.9,136.85)mm with a 0.5mm diameter/0.2mm drill and a short 0.2mm ground trace. It uses existing process
dimensions, not a new filled-via requirement. Fresh DRC/parity pass with zero violations or unconnected items. All 230
populated footprints have courtyards; pairwise inspection found no courtyard collisions. J14 alone has no courtyard
because it is bare underside service pads. No via centres remain inside top SMD paste pads after the fix. That check
does not replace solder-mask/stencil review or three-dimensional cable-envelope checks.

The native 3D render was inspected for overall placement, connector access and antenna space. Ethernet's body model is
unavailable in the installed library; U18 and U20 also lack body models, so their empty render locations are not
evidence of physical clearance. U18's retained manufacturer drawing was inspected: 15x15mm body, 5.22mm maximum height,
44 lands at 1.27mm pitch and 0.63mm nominal pad diameter match its native footprint. Do not invent replacement bodies.
Reserve those actual envelopes during enclosure design. The existing antenna keepout is retained. The board has no
chassis standoff holes: use an insulating prototype carrier, not connector locator holes or conductive supports over the
isolation regions. Supplier review must explicitly cover LTM2884 MSL-4/245 C handling, exposed-pad soldering,
through-hole connectors, and footprint-origin versus pick-and-place-centre conventions. This review does not approve
supplier substitutions or claim a completed enclosure.

The owner removed the $36 savings target on 2026-09-06: finish the reliable one-port board rather than add circuitry to
meet that estimate. **Keep LTM2884 USB isolation and REC30K application power.** The cheaper discrete USB-isolator
proposal is not selected. The direct W5500 Ethernet change is retained.

U19 is now **LTC3115IDHD-1#PBF**, a 5V buck-boost regulator replacing the buck-only LMR36510. The schematic, support
parts and local PCB routing are implemented. Its 10uH/750kHz reference network follows the
[ADI datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ltc3115-1.pdf), not an improvised
dropout workaround. C44 is removed; C66-C68 and R108-R110 complete the replacement network. Exact ordering fields are
included for all 15 parts in this section. Low-input regulation still requires measurement on the assembled prototype.

The power-control hardware is routed: U21 **STM32C011F6P6**, Q6 application inhibit, six bias resistors, three
bypass/reset capacitors and J14 underside programming pads. U21 is powered from LTM2884's primary-side VLO and controls
power only, not scoring. Reset defaults hold acquisition off and application power inhibited. The board is now **165 x
100mm**; the USB-side edge extends 5mm while existing connector positions remain unchanged. There is still one USB-C
port.

Native ERC and DRC pass with zero violations and zero unconnected items. All **231 footprints / 879 schematic pin
assignments** match the PCB; J14 is bare service pads, not an installed connector. The primary USB ground remains
isolated. This is a layout checkpoint, not powered validation or fabrication approval.

The circuit package type-check and 13 tests pass. A fresh native KiCad 3D render was inspected; the previously missing
U18 and J13 body models remain absent, so this does not establish their mechanical fit. `pnpm verify` passed its check
stage but stopped on the existing scoring TypeScript coverage thresholds (95.98% lines versus 100% required); no
repository-wide pass is claimed. Those executable sources were not changed by this hardware checkpoint.

**Implemented:** automatic source-power qualification and application-branch control in the
[U21 firmware](../../../apps/scoring/firmware/power-control/README.md), with native policy/driver tests and an ARM
cross-build. **Still outstanding:** assembled-board startup/suspend measurements and final manufacturing review. One
USB-C port, one population and no physical mode switch remain the requirements. See
[power design](usb-acquisition-power.md).

The owner approved replacing WIZ850io with direct W5500 Ethernet. The Ethernet schematic now contains the W5500,
reference termination/filtering and crystal circuit, with the existing ESP32 SPI/reset/interrupt nets retained. J13 is a
CETUS J1B1211CCD magnetic RJ45, matching WIZnet's reference circuit and KiCad's existing exact-part footprint. Its
separate centre taps and LED polarities are mapped explicitly. C52/C53 are now correctly in series with the receive
pair: chip RX+/RX- connect through 6.8nF to jack pins 4/6. Jack pin 5 connects to the R101/R102 termination junction and
C54, not to the capacitor outputs. This corrects the earlier erroneous shunt connection; the old ERC/DRC pass did not
establish circuit correctness. The corrected schematic/PCB passes native ERC and DRC with zero violations and zero
unconnected items, with all 214 components and 815 schematic pin/net assignments matching. The ABM8 crystal is an
18pF-load part; the two 18pF external capacitors follow WIZnet's reference circuit, with final frequency/startup to be
checked on the assembled board. W5500 reserved pin 23 is grounded as required; reserved pins 38-42 remain unconnected.
Its internal CS/reset pull-ups are retained; firmware must assert reset for at least 500us and wait at least 1ms after
releasing it before SPI access. New Ethernet resistors use R99-R107 to avoid the existing R84-R98 components. The PCB
now replaces the WIZ850io module with this circuit. The routed checkpoint passes native KiCad ERC and DRC with zero
violations and zero unconnected items; all 214 components and 815 schematic pin/net assignments match. The existing 753
non-U12 pad positions/net assignments are preserved. The filtered analog supply uses a local inner-power-layer pour,
leaving the inner ground-reference layer intact. These checks establish connectivity and clearance, not Ethernet signal
integrity or fabrication approval. An all-layer copper-plane keepout covers the magnetic jack body. Differential
impedance/skew, final shield coupling, exact jack availability and mechanical review remain open. The TX+ fanout now
runs entirely on F.Cu. The receive fanout and both paired routes have now been reworked: all six data nets stay on F.Cu
with no vias and unchanged polarity. Seven local support parts moved; the PHY, jack and every external connector retain
their positions. TX end-to-end copper lengths are 30.268mm / 30.268mm; RX paths are 32.422mm / 32.422mm, including the
same 1.55mm pad-centre span through each series capacitor. These are connected-path measurements, excluding termination
branches, not sums of every track on a net. Tuning brings geometric mismatch below 0.01mm. Main tracks use 0.25mm width
and nominal 0.25mm pair gap, with 0.20mm package/contact escapes; the Ethernet net class retains those editing defaults.
The contact fanouts and tuning sections are not uniformly coupled. Native DRC reports zero violations and zero
unconnected items; all 214 components and 815 schematic pin/net assignments match. The 857 pads outside the seven moved
parts retain their locations and nets. Native 3D inspection covers the changed support-part placement, not the absent
jack model. The [WIZnet layout guide](https://docs.wiznet.io/Design-Guide/hardware_design_guide) remains the design
basis. This closes the layer-change and routed-length work, not Ethernet electrical qualification: final 100-ohm
impedance confirmation against the fabricator's stackup and a powered link test still remain. The all-layer magnetics
plane keepout is retained. Do not swap differential polarity merely to simplify routing.

The local `ScoringPlatform:J1B1211CCD` footprint derives from KiCad's exact-part `Connector_RJ:RJ45_Cetus_J1B1211CCD`,
under the [KiCad library license](https://www.kicad.org/libraries/license/). Pads, mounting holes and fabrication
outline are unchanged; front silkscreen stops before the board edge where the connector mouth overhangs. Its referenced
stock STEP file is absent from the installed library. Do not mistake the missing jack in a 3D render for an omitted
footprint or claim that its 3D mechanical fit has been verified.

The earlier discrete-USB savings estimate is not a BOM reduction. The owner permits a powered USB-C requirement for
laptop mode; ordinary USB-A adapter compatibility is no longer required. Implement detection of adequate advertised
Type-C current or an appropriate PD contract before enabling the replacement supply. A USB-C connector alone is not
sufficient. Follow advertised-current changes and PD suspend flags; do not assume every USB-C port waives suspend
limits. See the
[USB-IF power precedence and suspend assertions](https://www.usb.org/sites/default/files/USB%20Type%20C%20Functional%20Test%20Specification%202024%2003%2003.pdf),
pages 25-26. This is an approved requirement change, not an implemented replacement. R05C1TF05S is not a solution for
the existing 5V rail's low-input problem: its 3V input headline applies to 3.3V output; the manufacturer's 5V-output
specification requires at least 4.5V input. Preserve USB suspend/startup behavior and the isolation barrier when
choosing the replacement. REC30K application power is retained. ISOUSB111 cannot simply replace the USB data portion
while leaving an always-on isolated converter: its specified L2 suspend maxima are 1.55mA upstream and 7.5mA downstream,
before converter losses or board load. A complete bus-powered design must address that budget rather than assuming the
isolator's upstream-only suspend compliance covers both sides.

**Confirmed: one populated board must operate in both laptop and standalone-display modes.** Retain one USB-C port; do
not split component populations or require component swaps to change modes. The replacement must control actual
negotiated power and suspend behavior; STUSB4500's static flags do not expose both. Its
[programming guide](https://www.st.com/resource/en/user_manual/um2650-the-stusb4500-software-programing-guide-stmicroelectronics.pdf)
describes reading source capabilities through I2C. The 5V-only STUSB4500L alternative is rejected. Keep the application
and display branch off until full-display mode and sufficient source power are both established; a 20V contract alone
does not distinguish a charger from a laptop. Implement the necessary power control with the simplest suitable circuit.
The product-mode decision is resolved; component selection and implementation remain open, not awaiting another mode
decision. Do not mark the USB replacement complete. See [the current power handoff](usb-acquisition-power.md).

Reference circuits reviewed:
[W5500 magnetic-RJ45 reference](https://docs.wiznet.io/Product/Chip/Ethernet/W5500/ref-schematic),
[CETUS J1B1211CCD drawing](https://docs.wiznet.io/img/products/w5500/2.j1b1211ccd.pdf),
[W5500 pin and timing requirements](https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf) and
[RECOM RxxC1TFxxS](https://recom-power.com/en/rec-s-RxxC1TFxxS.html), plus
[ISOUSB111 electrical characteristics](https://www.ti.com/lit/ds/symlink/isousb111.pdf). The verification records below
describe the previous routed checkpoint, not completion of these replacements. Do not export an order package from this
mixed checkpoint.

## Board appearance and ordering

Use **black solder mask on both sides and white silkscreen**. These colors are saved in the native board; in KiCad's 3D
viewer enable **Use board stackup colors**. Keep the small `Fencing Club` text on the component side. The user requested
removal of the crest and will design a replacement; there is currently no logo on either side. Do not restore the old
crest or generate a replacement without their direction.

When ordering, explicitly select **Black** for PCB color and **White** for silkscreen in
[JLCPCB's quote](https://jlcpcb.com/help/article/instructions-for-ordering). The silkscreen Gerbers contain the
lettering, but ordinary Gerber layers do not select solder-mask ink color. Include both silkscreen layers and inspect
the fabrication preview. Confirm the final black-mask manufacturing clearances with the fabricator; this appearance
change is not fabrication approval. The manufacturing target below supplies the copper/dielectric construction; ordering
must explicitly select that stackup, not an unspecified four-layer build.

### Manufacturing target and USB routing

Use JLCPCB's standard **JLC04161H-7628**, nominal 1.6mm, outer 1oz and inner 0.5oz copper. KiCad now retains the
[published stackup](https://jlcpcb.com/impedance): top to bottom, copper/dielectric thicknesses in mm are **0.035 /
0.2104 / 0.0152 / 1.065 / 0.0152 / 0.2104 / 0.035**. Prepreg is 7628 (Er 4.4); core Er is 4.6. These published layers
sum to 1.5862mm before mask; the calculator labels the finished build 1.59mm +/-10% under its nominal 1.6mm option. Keep
the manufacturer dimensions rather than inventing a thicker core to force a nominal sum. Black mask and white printing
remain unchanged. Mask thickness in the 3D file is illustrative, not a process tolerance. KiCad's saved loss tangent of
0.02 is its default, not a manufacturer-qualified material value.

On 2026-09-06 the [JLCPCB calculator](https://jlcpcb.com/pcb-impedance-calculator), set to four layers, nominal 1.6mm,
1oz outer / 0.5oz inner, returned **12.58mil (0.3195mm) width** for a **90-ohm non-coplanar differential pair** on L1
referenced to L2 with 9.8425mil (0.25mm) edge spacing. The `USB data` net class therefore uses a rounded **0.32mm width
/ 0.25mm gap** for both host and isolated data nets. This is the next routing target, not a measurement or a
manufacturing impedance guarantee. The calculator's displayed solver tolerance is not a fabrication tolerance.

**Both USB trunks have been revised to the routing target; electrical qualification remains open.**

| Net         | F.Cu length | B.Cu length |                   Existing width |
| ----------- | ----------: | ----------: | -------------------------------: |
| USB_HOST_DP |    11.140mm |     6.062mm | 0.32mm, 0.20mm connector escapes |
| USB_HOST_DM |     7.564mm |     9.118mm | 0.32mm, 0.20mm connector escapes |
| USB_DP      |    78.362mm |           0 |     0.32mm trunk, 0.20mm escapes |
| USB_DM      |    74.363mm |     3.746mm |     0.32mm trunk, 0.20mm escapes |

Lengths above total all track branches and exclude vias and pad-internal paths; they are not end-to-end pair skew. The
host trunk now runs on B.Cu with 0.32mm width / 0.25mm gap above the existing In2 USB_GND plane. The selected stackup is
symmetric, so the same outer-layer geometry applies to L4/L3. A local B.Cu pour-only keepout removes nearby same-layer
ground around that trunk, and two primary-ground stitching vias support the layer transitions. Native filled-copper
sampling confirms the shared horizontal trunk's reference plane; the terminal via antipads and unpaired
USB-C/protection/isolator escapes remain discontinuities, not a uniform 90-ohm line. No components, isolation barriers,
or non-host signal routes moved. All four USB-C data contacts still reach U3 and U18.

The isolated-side F.Cu trunks now use 0.32mm width / 0.25mm gap, including their diagonal section, referenced to In1
GND. Approximately 62mm of each path uses that geometry. Native filled-copper checks covered the center and both edges
of every wide segment: 3,765 samples, with no missing reference copper. The 0.20mm MCU/isolator fanouts and the 3.746mm
bottom D- crossover remain explicit discontinuities. A ground stitching via was added beside the isolator crossover; the
existing ground via at its other end remains connected. The copper layout and all non-USB routes are otherwise
preserved. There are no new parts or board-size changes.

This does not establish uniform 90-ohm impedance through the fanouts, an eye-diagram pass, or enumeration reliability.
Inspect the final manufacturing geometry and validate the assembled interface, including nearby conductor-trace
coupling. Bottom-layer escapes reference In2 rather than In1; preserve their local GND return and the isolation gap. The
non-coplanar calculator does not model every adjacent trace, pad, via or package discontinuity.

### Assembly BOM fields

**U18 assembly instruction:** the selected LTM2884IY#PBF is MSL 4 with SAC305 balls and a **245 C peak body reflow
limit** ([ADI Rev. D, page 2](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf)). The
assembler must follow its moisture handling and reflow requirements rather than a generic 260 C profile. Its 44 lands
were checked against drawing 05-08-1881 Rev B: 0.63mm circles, 1.27mm pitch, rows A/B/K/L only. The native 90-degree
placement keeps A1 at board coordinates (75.65, 146.35)mm. The page-8 functions match all 44 assigned pads: host data
A1/A2, ON/suspend tied to VLO, separate upstream/downstream grounds, regulated primary input A7-A11 and isolated output
L8-L11. L5 is intentionally unused. No pad or circuit change was needed. The manufacturer body model remains missing;
this land/pin review does not replace the assembly process or whole-board isolation review.

All 187 components now export separate manufacturer and part-number fields. For the processors, ICs, modules and
remaining connectors, this normalizes the already-selected part numbers from their labels; it does not substitute
components or approve their footprints. Keep the connector function labels readable. U8/U9 now specify the complete
**74LVC125APW,118** ordering code in every schematic unit and the PCB. Nexperia lists this TSSOP14/SOT402-1 option as
active (12NC 935231720118); the older ,112 option is discontinued. See the
[manufacturer ordering table](https://www.nexperia.com/products/analog-logic-ics/logic/buffers-inverters-transceivers/buffers/serie/74lvc125a/),
checked 6 September 2026. This resolves packaging identity without changing the device, lands, models or circuit.
Availability, assembly sourcing and the remaining mechanical/electrical review are still separate from a nonempty BOM.

### Service and harness headers

The six single-row headers now have explicit Samtec ordering fields: J2 uses **HTSW-105-07-L-S** (STM32 SWD), J6
**HTSW-106-07-L-S** (ESP32 UART recovery), J3/J4/J12 **HTSW-103-07-L-S** (left/right cord harnesses and PD service), and
J5 **HTSW-101-07-L-S** (piste harness). These are straight, 2.54mm-pitch headers with 0.635mm square posts, 5.84mm
exposed mating length and approximately 2.54mm solder tails. The high-temperature LCP HTSW series supports lead-free
processing; do not substitute the ordinary PBT TSW series without checking the assembly process. See the
[Samtec catalogue](https://suddendocs.samtec.com/catalog_english/tsw_th.pdf) and
[series print](https://suddendocs.samtec.com/prints/htsw-xxx-xx-xxx-x-xx-xx-xx-mkt.pdf), revision BQ, sheets 1, 2 and 6.

Local footprints retain the existing pin centres and 1.7mm copper lands, but use the manufacturer's
[1.02mm hole recommendation](https://suddendocs.samtec.com/prints/htsw-xxx-xx-xxx-x-xx-xx-xx-footprint.pdf), revision B,
sheet 1. All 21 affected holes were previously 1.00mm. No routes, net assignments or connector positions move. The
retained stock KiCad header models are illustrative, not exact Samtec bodies. The existing body outline is conservative
relative to the 2.489mm nominal single-row width. Confirm finished-hole tolerance with fabrication. These unkeyed
internal headers require correctly oriented harnesses and strain relief; J3/J4 are not the external banana sockets, and
their 2.54mm pitch does not specify the enclosure socket spacing. J12 is on USB primary ground: do not attach its
programmer ground to the isolated scoring-side headers.

### Resistor ordering selections

All 83 populated resistors now have exact `Manufacturer`, `MPN` and `Datasheet` properties in the native schematic and
PCB, using 16 ordering codes. Export these fields with the BOM. Values, footprints, models and routing are unchanged.
Ordinary 0603 resistors use YAGEO RC, 1%, 0.1W at 70 C; the four precision protection-divider resistors use YAGEO RT,
0.1%, 25ppm/C. R88/R89 use
[RC2512FK-071KL](https://www.yageogroup.com/component-documentation/download/specsheet/RC2512FK-071KL), 1k, 1%, 1W at 70
C, in their existing 2512 footprints. These ratings require temperature derating, not constant power through the entire
operating-temperature range.

The nine 220-ohm excitation/optocoupler resistors use Panasonic **ERJPA3F2200V**; the two 82-ohm repeater resistors use
**ERJPA3F82R0V**. The
[manufacturer ratings and derating curves](https://industrial.panasonic.com/cdbs/www-data/pdf/RDO0000/AOA0000C331.pdf),
pages 2-3, specify 0.25W at 105 C ambient or 0.33W at 130 C terminal temperature, with derating to 155 C. This improves
margin without larger footprints. A grounded conductor at 3.6V dissipates at most approximately 60mW in its 220-ohm
resistor before temperature-coefficient allowance. External repeater fault loads, discharge pulses and assembled
temperatures still need their circuit-specific checks; choosing these parts does not close those electrical findings.
Full assembly review is still open.

### Small-capacitor ordering selections

Another 28 capacitors have exact TDK ordering fields in schematic and PCB, with no capacitance, footprint or routing
changes. The voltage shown in the existing value is the design minimum; the selected part may have a higher rating.

| Quantity | Existing function/value          | Selected MPN                                                                                                                    |
| -------: | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
|       22 | 100nF bypass/bootstrap, 0603     | [C1608X7R1H104K080AA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C1608X7R1H104K080AA), 50V X7R, 10%  |
|        2 | 100nF primary input bypass, 0805 | [C2012X7R2A104K125AA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7R2A104K125AA), 100V X7R, 10% |
|        2 | 10nF timing/bypass, 0603         | [C1608X7R1H103K080AA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C1608X7R1H103K080AA), 50V X7R, 10%  |
|        2 | 27pF crystal loads, 0603         | [CGA3E2C0G1H270J080AA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=CGA3E2C0G1H270J080AA), 50V C0G, 5% |

Manufacturer pages list these four parts in production. The commercial C1608C0G1H270J080AA candidate is obsolete and was
not selected. The crystal's existing `tune` note remains: ordering a 27pF part does not validate oscillator margin or
frequency. TDK's 0603 X7R characteristic sheet was visually reviewed; its bias curves are typical, not guaranteed
effective-capacitance bounds. Existing IPC footprints are retained, not represented as exact manufacturer land patterns.
C1 was selected previously. C2/C3/C15/C21/C33/C37/C38/C41 now also use its **C1608X7R1H105K080AB** ordering code: 1uF,
50V, X7R, 10%, 0603. These eight local-supply/reset positions operate on the approximately 1.2-5V rails or ESP_EN, not
raw 20V VBUS. The [TDK characteristic sheet](https://www.farnell.com/datasheets/4491452.pdf), page 2, shows typical
capacitance near nominal at these low biases, unlike its substantial loss at 20V. That curve is not a guaranteed minimum
across tolerance, temperature and ageing. Nominal values, reset timing targets and land patterns are unchanged;
regulator stability and reset/startup timing still require bench checks. Reusing C1's part avoids another ordering code.
The raw-input parts C36/C39/C40 now also have exact ordering fields: respectively
[C2012X7R1H105K125AB](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7R1H105K125AB),
[C3216X7R1H225K160AB](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C3216X7R1H225K160AB) and
[C2012X7R1H224K125AA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7R1H224K125AA). These
are TDK X7R, 50V, 10% parts matching the existing 1uF/0805, 2.2uF/1206 and 220nF/0805 positions. Their manufacturer
pages list them in production. This selects nominal parts, not guaranteed effective capacitance at 20V: those bias
curves have not been visually verified, and input ripple, hot-plug/inrush and PD-transition review remain open. No
value, land, model, placement or routing changed.

**All 50 capacitors now have exact ordering fields.** The final ten bulk positions use the following parts; this closes
nominal BOM selection, not the electrical or full assembly review. Existing schematic voltages remain minimum ratings.

| Positions  | Selected part                                                                                                                            | Rating and existing package |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| C5/C22/C28 | [TDK C1608X5R1C106M080AB](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C1608X5R1C106M080AB)                     | 10uF, 16V, 20%, X5R, 0603   |
| C14        | [TDK C1608X7S1A475K080AC](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C1608X7S1A475K080AC)                     | 4.7uF, 10V, 10%, X7S, 0603  |
| C6/C7      | [Murata GRM32ER71E226KE15L](https://www.murata.com/en-global/api/pdfdownloadapi?cate=luCeramicCapacitorsSMD&partno=GRM32ER71E226KE15%23) | 22uF, 25V, 10%, X7R, 1210   |
| C47        | [TDK C3225X7R1H106K250AC](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C3225X7R1H106K250AC)                     | 10uF, 50V, 10%, X7R, 1210   |
| C49        | [TDK C3216X7R1C106K160AC](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C3216X7R1C106K160AC)                     | 10uF, 16V, 10%, X7R, 1206   |

The two retained 22uF positions share one code. C43 now uses TDK C4532X5R1A476M280KA, 47uF/10V/1812; C44 was removed
with the old regulator. Murata's
[manufacturer sheet mirrored by Farnell](https://www.farnell.com/datasheets/3799575.pdf), pages 1-2, was visually
reviewed: the L/K suffix changes reel packaging, not the 3.2 x 2.5 x 2.5mm nominal body or electrical rating. That
retained online sheet is dated 2022; recheck current availability before ordering. TDK's pages list the four selected
TDK parts in production. No component position, net, nominal capacitance, footprint or model changed.

**Outstanding electrical limits:** X5R C5/C22/C28 have an 85 C component-temperature limit, including local heating;
this is not an 85 C ambient product rating. C14's X7S temperature allowance is +/-22%, not X7R's +/-15%. All bulk parts
still require effective-capacitance review at their actual bias, including tolerance/temperature/ageing, against the
regulator requirements. Do not assume the two 22uF parts supply 44uF under bias or use the nominal BOM to approve
stability, startup or load steps. Exact 3D height/assembly clearance and procurement review remain open.

### Diode selection

All eleven diodes have exact ordering fields in both native files: D1/D2 use Vishay **SS14-E3/61T** (40V SMA), D3-D9 use
Nexperia **BAT54S,215** (dual-series SOT23), and D10/D11 retain Vishay **1N4004-E3/54** (400V DO-41). Manufacturer
package/polarity drawings were visually reviewed. Native pad connections match: SS14 cathodes join CORE_5V; BAT54S pin 1
is GND, pin 2 CORE_3V3, pin 3 the respective sense input; repeater diode cathodes join their isolated collector nodes.
No footprint, pin assignment, component position or routing changed.

The [SS14 sheet](https://www.vishay.com/doc?88746), pages 1-2, specifies 0.50V maximum at a pulsed 1A/25 C test and
reverse leakage up to 0.2mA at 25 C or 6mA at 100 C at rated reverse voltage. Those conditions do not establish our
low-current forward drop or actual off-rail leakage. The
[BAT54S sheet](https://assets.nexperia.com/documents/data-sheet/BAT54S.pdf), pages 1-3, confirms pin polarity and 30V
rating, not protection against an unspecified external source. Existing unpowered backfeed and power-budget findings
remain open. The [1N4004 sheet](https://www.vishay.com/docs/88503/1n4001.pdf), pages 1-2, binds the existing part and
cathode band; this does not qualify repeater waveforms.

### Low-voltage switches

Q1-Q5 now specify **Diodes Incorporated DMN2056U-7**, replacing BSS138 selections whose low-voltage on-resistance was
not established. The [manufacturer sheet](https://www.diodes.com/datasheet/download/DMN2056U.pdf), pages 1-3, binds the
orderable SOT-23 part, G/S/D orientation, 20V drain rating, +/-8V gate rating and maximum on-resistance of 45 milliohms
at 2.5V gate drive (85 milliohms at 1.5V), at the stated pulsed 25 C test conditions. Gate/source/drain remain pads
1/2/3; existing footprints, models, holes, positions and copper are unchanged.

| Switch | Function and load bound                                                                                                | Gate supply                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Q1     | Pull HUB75 buffer enable low; under 0.56mA through its 10k pull-up at 5.5V, excluding input leakage                    | ESP32 3.3V                                          |
| Q2     | Drive the piezo sounder; under 3.64mA through its parallel 1k resistor at 3.6V, plus piezo charging current            | STM32 3.3V through 1k                               |
| Q3     | Sink both Favero optocoupler LEDs; under 50.6mA at 5.5V even ignoring LED forward drops, with two 220-ohm 1% resistors | STM32 3.3V                                          |
| Q4/Q5  | Inhibit the PD eFuse; each can sink the entire 140k feed (under 0.18mA even at 24V)                                    | Regulated primary 5V through 100k, not raw USB VBUS |

These normal-load bounds are small relative to the part's capability; they are not fault or temperature qualification.
At the stated 2.5V/25 C on-resistance, Q3's conservative load gives about 2.3mV drain drop. The 20V drain rating is
adequate for these local low-voltage nodes, not permission to connect a drain or gate directly to raw PD power. The
symbol graphic retains the pin-compatible BSS138 library identifier; **Value and MPN fields select DMN2056U-7**.

**Open timing check:** typical input capacitance is 339pF, so Q4/Q5's 100k pull-ups give an indicative 34us RC time
constant. This is not a maximum switching-time guarantee: nonlinear capacitance, threshold spread, primary-rail ramp and
STUSB4500 output timing must be checked together before accepting eFuse startup/disconnect behavior. Also check Q2 piezo
edge current and Q3 repeater waveforms on the assembled prototype. No new routing or protection circuit was added merely
to close the part-selection gap.

### Power inductors

L1 **Coilcraft XAL5030-472MEC** (4.7uH) and L2 **XAL5050-223MEC** (22uH) now have explicit Manufacturer/MPN fields in
both schematic and PCB; their existing values and placement are retained. The
[manufacturer drawing](https://www.coilcraft.com/getmedia/49bc46c8-4b2c-45b9-9b6c-2eaa235ea698/xal50xx.pdf) (908,
revised 2026-02-26, pages 1/4) matches both boardside land patterns: 1.18 x 4.70mm pads, 3.31mm centre spacing. Maximum
body heights are 3.1mm and 5.1mm respectively. These are non-polarized; place the marked short winding end toward the
switch node for the manufacturer's preferred EMI orientation (pad 1 on both footprints).

At 25 C, maximum DCR is 40/99.65 milliohms respectively. Listed 30%-inductance-drop currents are 6.7/3.6A, and 20 C-rise
currents 4.3/2.5A. These reference test values are not guaranteed in-board thermal limits: ripple, converter
current-limit tolerance, loss and temperature still need the power review. Neither inductor was downsized or rerouted.

### Service buttons

SW1 (STM reset), SW2 (ESP reset) and SW3 (ESP boot) specify **E-Switch TL3342F160QG**, retaining their readable function
labels. The
[manufacturer drawing P010632 Rev J](https://configured-product-images.s3.amazonaws.com/2D/specs/TL3342F160QG.pdf) was
visually checked against all three native footprints: four 1.7 x 1.0mm pads on 6.3 x 3.8mm centres, matching the 8.0 x
4.8mm outer land envelope. Its circuit joins the two legs in each row internally; the footprint groups those rows as
pads 1 and 2, rather than using the drawing's four reference terminal numbers. One row joins the reset/boot signal and
the other GND, so the existing wiring does not short the signal without a press.

This is a normally-open, momentary 160gf button rated 50mA at 12VDC, with 1.5mm nominal overall height. No button,
model, label or copper moved. The drawing supplies nominal package fit, not an enclosure-access or assembly trial.

### Crystal, IR receiver and sounder

Y1 **Abracon ABM3B-8.000MHZ-B2-T**, U13 **Vishay TSOP38438** and BZ1 **TDK PS1240P02BT** now have explicit
Manufacturer/MPN fields. No component, model, hole or routing changed.

- [Abracon Rev U](https://abracon.com/Resonators/abm3b.pdf), pages 1-3: 8MHz fundamental, standard 18pF load; B selects
  -20 to +70 C and 2 selects +/-20ppm initial tolerance. Pads 1/3 join HSE_IN/HSE_OUT, 2/4 GND. The 1.8 x 1.2mm lands on
  4.0 x 2.4mm centres match the drawing. Two nominal 27pF loads give 13.5pF series capacitance; reaching 18pF assumes
  another 4.5pF effective stray load. That is an assumption, not a measurement: retain the tune note and verify startup
  margin, drive level and frequency on the prototype.
- [Vishay 82491](https://www.vishay.com/docs/82491/tsop382.pdf), pages 1/7: TSOP38438 is the 38kHz receiver; pin 1 OUT
  joins IR_RX, pin 2 GND, pin 3 supply joins filtered IR_3V3. The drawing's 2.54mm lead spacing matches the three 1.1mm
  drill holes. Its 0.7 x 0.5mm maximum lower lead section has a 0.86mm diagonal before hole tolerance. Keep the larger
  lead shoulder above the PCB. Receiver selection does not validate remote protocol, range or ambient-light immunity.
- [TDK's product page](https://product.tdk.com/en/search/sw_piezo/sw_piezo/piezo-buzzer/info?part_no=PS1240P02BT)
  identifies the sounder as a production, externally driven 4kHz part with a 3V(0-p) rating and wave-solder assembly.
  The [TDK drawing retained by Farnell](https://www.farnell.com/datasheets/2820462.pdf), page 4, dated 2019-04-11, was
  visually reviewed: 5mm nominal lead spacing, 12.2mm nominal diameter and 6.5mm height match the retained footprint and
  model. The lower lead section is at most 0.65 x 0.45mm (0.79mm diagonal), compatible nominally with the existing 1mm
  holes; the flexible leads have a +/-0.5mm pitch tolerance and may need forming. No holes or parts moved. This closes
  the drawing check, not acoustic performance or assembly-process qualification. Keep its opening clear and do not send
  it through SMT reflow by assuming it is reflow-compatible.

## Low-volume build scope

Design for **3-10 units per month**. Prioritize dependable operation, straightforward assembly and repair, and
inexpensive design changes. A higher module cost is acceptable when it saves meaningful engineering, assembly, or
support effort.

- Keep the agreed STM32 acquisition / ESP32 application split and existing required interfaces. No extra processor,
  redundant supply, or speculative expansion interface without a concrete need.
- Prefer proven, available modules and manufacturer reference circuits. Replace a module with discrete circuitry only
  for a demonstrated electrical, mechanical, availability, or overall cost benefit at this sales volume.
- Desktop acquisition uses **one computer USB cable for both power and data**, through the integrated LTM2884 module. PD
  powers the full display system. Computer sleep may shut off acquisition; reconnecting after wake is accepted.
  Laptop-only units ship **without a HUB75 panel connected**. The laptop provides the display; the populated ESP32,
  Ethernet and IR application branch stays unpowered in acquisition-only mode.
- Each added component must serve a required function, satisfy an applicable requirement, or address a specific failure
  mode. Keep necessary protection, decoupling, reset defaults, isolation, and practical programming access; low volume
  does not reduce electrical-safety or scoring-correctness requirements.
- Concentrate verification on the actual circuit: pin/footprint fit, ERC/DRC, power behavior, sensing and timing, and
  end-to-end operation. Keep the existing scoring-logic tests. Do not add documentation/BOM validators, speculative
  qualification frameworks, or elaborate automated factory fixtures for this build.
- Maintain this short design note and the native KiCad source. Prefer changes that remain easy to inspect and repair;
  propose any substantial increase in parts, custom circuitry, or assembly steps before implementing it.

## Design decisions

- STM32G474RET6 handles excitation, seven internal comparator inputs, timestamps, and native USB. Desktop software runs
  the portable C17 scoring core first; standalone scoring can subsequently use the same core on STM32. Firmware is not
  implemented here. Internal comparators avoid adding a separate comparator bank, but the sensing circuit still needs
  threshold and timing characterization.
- ESP32-S3-WROOM-1-N8R8 handles the HUB75 display, Ethernet, and IR. Two SN74AXC1T45 UART translators separate powered
  and unpowered logic rails. These are **not galvanic isolators**.
- Keep direct W5500 Ethernet, TSOP38438 receiver, two TE 5520250-2 Favero DATA-LINE connectors with optocoupler outputs,
  HUB75 signal/power connectors, and sounder from the prototype. Favero ports are not Ethernet or RS-422. Ethernet
  accepts its cable from the bottom edge; both Favero sockets accept theirs from the top edge. The native RJ14
  footprint's mirrored contact/board-lock Y coordinates and STEP transform were corrected together using the
  [TE 5520250 D3 component-side drawing](https://www.te.com/commerce/DocumentDelivery/DDEController?Action=srchrtrv&DocFormat=pdf&DocLang=English&DocNm=5520250&DocType=Customer+Drawing&PartCntxt=5520250-2).
  Keep the drawing's contact numbering; rotating a model alone must never be used to conceal a hole-pattern mismatch.
- **J1 is the only USB-C receptacle**, for laptop power/data or standalone PD power. U5 **STUSB4500QTR** replaces the
  Adafruit connector module. U19 **LTC3115IDHD-1#PBF** and L2 **XAL5050-103MEC** provide a nominal 5.016V primary supply
  for **LTM2884IY#PBF**; raw negotiated VBUS must never reach that isolator. U6 **REC30K-2405SZ**, behind U20
  **TPS259470LRPWR**, replaces the nonisolated Pololu converter with isolated display/application power. D1/D2 retain
  the isolated-source OR into CORE_5V and AP2112K supplies CORE_3V3. USB_GND remains separate from board GND. **The
  shared USB power circuits, connector feeds, CC lines and U19-to-U18 supply feeder are routed. Regulation, negotiation,
  current limits and safety have not been demonstrated. Do not power or manufacture this draft.**
- **Accepted sleep behavior:** SPNDPWR is high, so USB idle/suspend shuts off the module's isolated output. With USB
  alone, acquisition powers down. Host resume requires USB re-enumeration; remote wake is unavailable in this mode.
  Desktop software must preserve bout state but discard the previous capture session and reconnect before accepting new
  observations. If PD keeps the STM32 alive, PB5 must still detect loss of USB_ISOLATED_5V and disable its USB D+
  pull-up. The 100k/150k divider senses the board-side isolated output, never computer VBUS. Firmware is not implemented
  in this hardware change. See the
  [manufacturer's suspend and compliance notes, pages 15-17](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf).
- **USB power budget:** target 20mA isolated load before configuration and 75mA during acquisition, against U18's 200mA
  bus-powered output rating. The [laptop acquisition budget](usb-acquisition-power.md) accounts for the MCU, all seven
  comparators, one high excitation source, bias resistors, translators and regulator overhead, with explicit margin.
  Host limits remain 100mA before configuration and 500mA afterward; the isolated-output allocation does not prove those
  input limits. Keep sound/Favero off and the ESP32/Ethernet/IR/HUB75 branch on PD only. Firmware enforcement and
  physical startup/current/suspend/handover checks remain unfinished. Never apply the 20V PD rail to LTM2884.
- **Mode configuration:** U21 writes/read-backs volatile PDO1 5V/1.5A and PDO2 20V/3A profiles, enabling PDO2 only after
  fresh source capabilities declare no USB communications and sufficient fixed 20V power. The accepted RDO is validated
  before outputs are enabled. Q4/Q5 retain the PDO2/VBUS hardware gates and Q6 adds default-on inhibition. Verify U5
  factory POWER_OK_CFG=10b and REQ_SRC_CURRENT=0; no boot-time NVM writes or separate board populations. U20 nominal
  UVLO is 18.0V, OVLO 21.84V and current limit 2.43A. Laptop mode leaves the populated application branch off, with
  HUB75 disconnected and automatic USB suspend shutdown enabled. Voltage or bus silence never proves a charger.
- **Low-voltage regulation:** U19 now bucks or boosts to supply U18, which needs at least 4.4V at its pins. The ADI
  reference is rated for 5V/1A output above 3.6V input. This removes the previous buck-only topology limitation; measure
  startup, ripple, loaded voltage and 5V/20V transitions before claiming supported laptop/cable combinations.
- U18 uses the manufacturer's 44-ball, 15 x 15mm BGA land pattern with 1.27mm pitch and 0.63mm copper lands. The custom
  footprint follows the
  [05-08-1881 Rev B package drawing](https://mds.analog.com/api/public/content/BGA_44_05-08-1881_Rev_B.pdf), including
  top-view A1 orientation. Its manufacturer STEP model has not been obtained; the 3D view deliberately has no invented
  placeholder body for this part. The land/pin review is complete; the assembler must still accept the documented MSL-4
  handling and 245 C peak-body reflow requirement.
- J1 uses GCT USB4105-GF-A for computer USB, with project-local `USB4105_GF_A` footprint and the existing STEP model.
  The [manufacturer drawing](https://gct.co/files/drawings/usb4105.pdf), Rev B4, retains authority for contact
  numbering, connector position, shell slots and locating holes; none of these moved. To clear the locating holes, the
  two outer ground lands (A1/B12 and A12/B1) use 0.60 x 1.10mm copper with 0.30mm corner radius, centred 0.025mm away
  from the holes. The rear extent stays unchanged; the hole-facing toe retreats 0.05mm. Width and length remain within
  the drawing's +/-0.05mm layout dimensions, but the rounded solder-area shape is an engineering adaptation, not a
  manufacturer-approved copy. Nominal copper-to-hole separation is approximately 0.280mm, exceeding the unchanged 0.25mm
  board rule. Other contacts, mounting features, paste/mask policy, nets and routes are unchanged. Assembly inspection
  must still check wetting of the ground contacts; a clean clearance check is not a solder-joint test.
- U3 is **TPD2E2U06DCKR**, a supply-independent two-channel USB ESD protector. Pin 1 protects D+, pin 2 protects D-, and
  pin 3 returns to USB_GND. There is no VBUS supply/clamp pin. Its SC70-3 footprint uses TI's DCK0003A lands: 0.95 x
  0.4mm, 2.2mm row spacing and 1.3mm pin-1/pin-2 pitch. See the
  [TI pinout and package drawing](https://www.ti.com/lit/ds/symlink/tpd2e2u06.pdf). It replaces USBLC6-2SC6 and its VBUS
  trace branch; C1 remains input decoupling and now specifies TDK **C1608X7R1H105K080AB**, 1uF, 50V, X7R, +/-10%, 0603.
  The exact MPN and manufacturer link are retained in both schematic and PCB properties, without moving or rerouting it.
  Its [manufacturer data](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C1608X7R1H105K080AB) and
  [TDK characteristic sheet](https://www.farnell.com/datasheets/4491452.pdf), pages 1-2, show the rated dimensions and
  substantial DC-bias loss: roughly half nominal capacitance at 20V in the reference curve. That is typical data, not a
  guaranteed effective-capacitance minimum. The existing IPC nominal 0603 footprint is retained; its lands are not
  claimed to reproduce TDK's recommended reflow geometry exactly. C36/C39/C40 ordering codes are now selected; aggregate
  input behavior and assembly review remain open. The data protector is independent of raw VBUS, but U18 must receive
  regulated USB_PRIMARY_5V, never negotiated 20V.
- Retain AP63203 with Coilcraft XAL5030-472MEC for application 3.3V. The replacement REC30K's 30W/6A rating is a module
  rating, not a measured full-board load allowance. U20 limits input current and startup slew; test converter startup
  under the actual load before enabling the panel. Component substitution remains possible when justified by footprint,
  power, availability and low-volume cost; this is not a released procurement BOM.
- J3/J4 are three-wire harness landings for off-board female banana sockets, not banana receptacles themselves. J5 is
  the metal-piste reference connection, not protective earth. The user's compatible Ok Fencing cable remains unchanged.
  Viewed from the component side with computer USB/Ethernet along the bottom edge, J3 is on the left and J4 on the
  right, 150mm apart. J5 is on the bottom edge. The enclosure's banana sockets must follow this same left/right
  arrangement with room to grip both plugs; do not group the two fencer sockets together. Silkscreen identifies LEFT,
  RIGHT and PISTE. This placement does not change A/B/C pin assignments or establish the off-board socket spacing.

## Sensing checkpoint

Each channel now uses **220-ohm excitation, 390-ohm sense series and 1k sense pull-down**, all 1%.
R8/R11/R14/R17/R20/R23/R26 use
[YAGEO RC0603FR-07390RL](https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07390RL);
R65-R71 use [RC0603FR-071KL](https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-071KL). Only
fourteen existing resistor values/order codes changed: no added components, pads, routes or placement changes. The lower
sense impedance shortens cable discharge; the unchanged excitation resistors still bound a grounded 3.6V source to
16.53mA. Keep the BAT54S clamps and require CORE_3V3 >=3V.

U8/U9 remain Nexperia 74LVC125APW. Its
[Rev. 12 datasheet](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf) specifies 2.25V minimum high output
at 18mA with VCC=3V through 125 C. COMP1-7 receive PA1/PA3/PA0/PB0/PB13/PB11/PB14, respectively: LEFT_A/B/C, RIGHT_A/B/C
and PISTE. Use VREFINT/2 and HYST=1, with 200us reference-scaler plus 5us comparator startup. The unchanged 0.556-0.651V
threshold envelope includes reference, offset and hysteresis allowances from DS12288 Rev 6.

### Acquisition timing

Use **40us slots**: clear every output low for 10us, disable for 1us, enable one high source for 28us, disable for 1us.
Sample all seven receivers 38us into each slot. Foil/sabre source order is LEFT_B, RIGHT_B, PISTE; epee uses LEFT_A,
RIGHT_A, PISTE. This is **120us per source-identified frame**. The 280us seven-source sweep is for characterization
only. Never power both fencers' sources simultaneously: that loses piste-side discrimination.

Preserve source identity and timestamps; decode only complete frames and never mix guard/piste data across frames.
Guard/piste inhibition acts immediately, not through the positive-contact filter. Brownout, capture loss, invalid frames
and ambiguous topology inhibit scoring and reset qualification.

The [C contact filter](../../../apps/scoring/firmware/stm32/core/stm32_contact_filter.c) requires at least 250us of
asserted input before passing it to the existing weapon core. False inputs reset immediately. Invalid, duplicate or
backward timestamps reset it; sample intervals above 125us restart qualification. **Do not backdate filtered
assertions.** The core then applies its existing 100us sabre, 2ms epee and 13ms foil minimum.

Native tests exercise both fencers at every integer-microsecond phase for frame periods 120-125us. They reject 99us
sabre, 1,999us epee and 12,999us foil pulses, and register 1ms sabre, 10ms epee and 15ms foil pulses before they end.
Rejection includes 30us analog release extension; detection includes 120us onset/frame-assembly delay. Repeated 60us
contacts with 165us gaps never qualify, including that tail. This is a bounded filter-plus-core timing test, not a full
electrical-to-weapon decoder or proof against arbitrarily short interruptions.

Run `pnpm --filter @repo/scoring-circuit simulate`. The pair/reset and seven-conductor models cover rest, target,
off-target, piste, reciprocal targets, crossed blades, seven-way shorts, source changes and both leakage directions.
With 10nF cable/30pF input stress, the weak seven-short sample is 0.6715V and settled value 0.6784V. The
positive-leakage clear case reaches 0.5498V, the 500-ohm pair 0.8543V, and disconnected input 0.1222V. The 3.6V
positive-leakage release tail is 20.72us, below the timing test's 30us allowance. The original 60us/165us interrupted
fixture now produces high/low/high rather than hiding the interruption.

**The 121uA leakage and 10nF capacitance are chosen stresses, not guaranteed temperature limits.** Clear margin is only
6mV under that stress. Characterize real cables, thresholds, capture latency, leakage and current on the prototype. The
filter is implemented and host-tested. These checks are not FIE approval or safe externally powered/shared-piste
operation.

The [STM32 scan driver](../../../apps/scoring/firmware/stm32/target/stm32g474_acquisition.c) now configures the seven
comparators and performs the clear/break/source/sample/release sequence. It returns only complete three-source frames
after releasing the outputs. A late transition, backward clock, lost supply permission, locked comparator or timestamp
overflow shuts down the drive outputs; it never fabricates missed samples. Calls must be serialized and scheduled from
an actual hardware timer at the returned deadline. Interrupt latency and sequential comparator-read skew still require
measurement; this is not a claim that a desktop poll loop can meet those deadlines.

The [conductor decoder](../../../apps/scoring/firmware/stm32/core/stm32_conductor_decode.c) maps complete frames to raw
epee, foil and sabre observations. It rejects missing source responses, incorrect timing/source order, nonreciprocal
readings and ambiguous crossed-blade/target networks. Guard and piste readings inhibit immediately. Its output still
requires the existing positive-contact filter before scoring; invalid frames require resetting qualification. This
conservative prototype interpretation can suppress ambiguous legitimate contacts and is not complete FIE behavior.

Startup output masks were also corrected to match this PCB: PC0-PC6 drive low, PC7-PC12 and PD2 hold active-low buffer
enables high, and PA2/PA8 hold Favero/audio inactive. USB, UART, SWD and comparator pins are not driven as outputs. The
previous masks came from an obsolete board and included current USB/comparator pins. The normal target entry point still
fails closed at its unimplemented startup checks; neither this driver nor decoder is silently enabled in a customer
firmware image. Hardware-timer dispatch, measured supply validation and USB capture delivery remain integration work. ST
register selections follow the pinned CMSIS device header and
[ST's comparator input definitions](https://github.com/STMicroelectronics/stm32g4xx-hal-driver/blob/master/Inc/stm32g4xx_ll_comp.h).

Use physical cord roles when implementing acquisition; older software's abstract conductor names are not a pinout:

| Harness pin | Our physical name                     | Foil / sabre                 | Epee            |
| ----------- | ------------------------------------- | ---------------------------- | --------------- |
| 1           | A, outer contact 15mm from the centre | Conductive jacket            | First tip wire  |
| 2           | B, centre contact                     | Foil tip wire / sabre weapon | Second tip wire |
| 3           | C, outer contact 20mm from the centre | Guard / weapon return        | Guard           |

Foil normally closes B-C and opens it when the tip is pressed; a target connects B to the opposing A. Epee closes A-B at
the tip. Sabre uses B-C for the weapon and opposing A for the jacket. PISTE is a separate observed conductor, not board
ground. The foil/epee contact roles and unequal spacing follow m.29.2(a) and m.31.3 in the retained
[FIE material rules](../../../apps/scoring/docs/specifications/fie-material-rules-2026-08-en.pdf). The fixtures
establish reachable paths, not which redundant physical contact caused them: reciprocal sabre targets plus crossed
blades can join all six cord wires. The decoder rejects that ambiguous topology rather than attributing a hit without
sufficient evidence.

**Prototype decision: retain and wire the existing BAT54S clamps for passive-cable bench development.** No extra
fault-protection subsystem is added. This is a circuit-selection decision, not power-off/ESD qualification or approval
to connect fencers. It covers the intended passive cord/contact network, not conductors powered by another apparatus,
externally charged/shared piste networks, or accidental USB/PD contact. Those cases still need an explicit electrical
envelope and protection review before field use. The
[Nexperia BAT54S pin table](https://assets.nexperia.com/documents/data-sheet/BAT54S.pdf) identifies pin 1 as the lower
diode anode, pin 2 as the upper diode cathode, and pin 3 as their junction; the wired GND/CORE_3V3/SENSE assignments
match that arrangement.

The existing chosen cable stress of seven 10nF capacitances charged to 3.6V holds at most 0.252uC and 0.454uJ. This
finite stored charge is different from a continuously powered external conductor; it does not establish real cable
capacitance, ESD immunity or the rail's discharge behavior. C14 is nominally 4.7uF, but its effective capacitance and
the actual power-down waveform still require checking. Do not count typical regulator discharge as protection.

**Power-off protection is not qualified.** The selected buffer specifies at most 20uA power-off leakage per input/output
at 5.5V and 125 C; that protects its output path, not the whole conductor interface. D3-D9 still connect the sense nodes
to CORE_3V3 through BAT54S clamps. An externally driven conductor can inject into that rail when it is off, and AP2112K
must not be assumed to sink that current. Review that path before powered external-fault or fencer testing. Neither the
buffer's power-off specification nor the clamps authorize applying 20V PD to any conductor.

All seven selected comparator pins are STM32 **TT_a analog inputs**. The
[STM32 DS12288 Rev 6](https://www.st.com/resource/en/datasheet/stm32g474re.pdf), tables 14-17, distinguishes the 4.0V
absolute input limit from the TT_xx operating ceiling of VDD + 0.3V; comparator operation also requires its specified
analog supply and input range. Table 15's zero positive-injection entry is not evidence of an internal upper clamp:
footnote 3 says positive injection does not occur below the specified maximum input voltage. Neither statement qualifies
comparator operation while unpowered. The identified rail-feed path is the **external BAT54S upper diode**, not an
assumed STM32 protection diode. Removing that diode alone would not establish a protected interface.

AP2112's typical 60-ohm output discharge applies with EN low, not as a guaranteed rail clamp after input power
disappears. Keep passive-cable power-down and sustained external-voltage fault tests separate. The former has finite
stored cable charge; the latter can continuously raise CORE_3V3 through D3-D9 even with series resistance. Before
choosing replacement protection, specify the external fault voltage, source resistance, polarity and duration; the
existing own-board short-circuit model supplies none of those requirements. Do not add a fault-protection IC or rail
shunt against an invented fault envelope. Do not substitute a generic diode simulation for those guarantees. See
[AN4899 section 5.2.1](https://www.st.com/resource/en/application_note/DM00315319-.pdf), and
[AP2112 electrical characteristics](https://www.diodes.com/datasheet/download/AP2112.pdf).

Leakage and capacitance are chosen stresses, not guaranteed worst cases or FIE evidence. BAT54S hot-leakage curves are
typical, not maximum ratings. The models do not prove exhaustive contacts, resistance diagnostics, clamp behavior or
capture timing. Do not treat continuity as a 450/475-ohm diagnostic or the passive-release tail as acceptable scoring
error. The seven upper-clamp rail connections are now routed; completed routing is not a measured operating result.

## Current state and remaining work

The current draft contains **231 footprints**, twelve functional/support sheets plus the cover, on a **165 x 100mm**,
four-layer PCB. J14 is unpopulated service pads. The shared USB-C schematic, footprints and initial power placement are
present. The new converter's secondary output and local bypass connect to the retained display/application/core
distribution. U19's input bypass, switch/inductor, bootstrap, internal-supply bypass, output capacitors and feedback
divider are now locally connected. U5's local supply, internal-regulator bypass, CC/CCDB pairs, sensing, discharge and
I2C service port are connected. Both PD flags reach Q4/Q5 and U20's enable pin. U20's input bypass, protected output to
U6, voltage dividers, current limit and soft-start components are locally connected. **J1-to-controller CC, primary
input distribution and the U19-to-U18 supply feeder are now connected through a left-edge primary corridor.** Primary
ground returns join through that corridor without joining board ground. The shared-input layout is connected, but power
behavior and safety remain unverified. The acquisition buffers now have connected supplies, local bypass and all seven
reset-default resistor networks. All fourteen STM32 drive/enable signals reach those buffers and resistors. Thirteen
redundant, unconnected display pull-downs have been removed; the connected 10k pull-downs beside the display buffers
remain. All seven buffer outputs now reach their existing 220-ohm series resistors. All seven 1k sense pull-downs now
have ground returns, and all seven comparator inputs reach those pull-downs. Both fencer headers and the piste header
now reach their excitation/sense resistor junctions. Every sense series resistor connects to its BAT54S signal pad and
its own MCU/pull-down path; all seven clamp ground returns are connected. D3-D9's upper-clamp CORE_3V3 connections are
now routed too: **zero unrouted items remain**. The circuit retains the passive-cable prototype candidate described
above; protection, timing and manufacturing checks are still open.

The existing USB data/protection, isolated output and USB-present sensing remain routed, along with the STM32 regulator,
crystal, boot pull-down, reset network/button and programming header. The 5V distribution to both HUB75 power contacts,
display buffers and application regulator remains connected. Sensing placement is still provisional. The ESP32 supply,
local bypass, enable/boot networks, buttons and manual UART programming header are also routed. The two-way processor
UART, its translators, four bypass capacitors and idle pulls are connected. The IR receiver's filtered supply, ground
and output to ESP32 GPIO42 are routed. The direct W5500 Ethernet supply, SPI bus, reset and interrupt are also
connected. All thirteen HUB75 buffer outputs now reach the display connector, together with the local buffer-disable and
panel-blanking network. The one-way display buffers and thirteen input pull-downs now have defined reset defaults. The
ESP32 input bus, display-enable line, sounder and both Favero repeater circuits are also routed.

Remaining before ordering the prototype:

1. Obtain supplier acceptance of the stackup, LTM2884 MSL-4/245 C handling, exposed pads, through-hole assembly and
   placement-origin conventions. Use an insulating prototype carrier, not connector locator holes as mounts.
2. Match every supplier component to the exact BOM MPN/package and review the final Gerber/drill/placement preview
   against the current native export. Confirm black mask, white silkscreen, four layers and nominal 1.6mm thickness in
   the order itself. Local ERC/DRC/parity and assembly review do not approve substitutions or constitute an order. No
   order has been submitted. Follow
   [JLCPCB's BOM/CPL requirements](https://jlcpcb.com/help/article/advice-for-bom-and-cpl-files-preparation) when
   importing the native assembly exports; imported footprint origins still need supplier placement review.

The electrical paper and assembly-layout tasks are complete for the passive-cable prototype scope, including the
resistor/timing repair and C69 via correction. Do not reopen them solely because firmware integration or measurements on
an assembled board are unfinished. New concrete electrical or layout findings still require correction. This local
review is not patent clearance, FIE approval or permission to connect fencers.

After the assembled prototype arrives, flash U21, verify U5 configuration defaults and bring up the supplies under
controlled bench conditions. Measure startup/current/suspend behavior, USB enumeration and signal integrity, supply
handover, sensing/leakage/timing, protection and the application interfaces. Use the
[20mA startup / 75mA acquisition budget](usb-acquisition-power.md). Those measurements are not prerequisites to ordering
the prototype needed to perform them; they remain prerequisites to claims about validated operation, safety or sale.
Keep fencers disconnected until the appropriate electrical checks pass. Acquisition and application share board ground;
the computer side is isolated by the modules and copper keepouts, which alone are not complete board safety proof.

## Checks performed

### Resolved owner decisions

Use a sufficiently powered USB-C source, one port and one component population. The owner permits higher cost to finish
a reliable design; there is no fixed $36 savings target. U19 now uses a buck-boost regulator. No further owner approval
is needed for those choices. The power-control circuit and U21 firmware are implemented; physical qualification remains.

### Earlier component-review checkpoints

The native BOM exports manufacturer and part-number fields for all 187 components, with no blank ordering fields. This
includes all 83 resistors, 50 capacitors, 11 diodes and five transistors. Q1-Q5 now export DMN2056U-7, matching the PCB
fields. Both retained Coilcraft inductors also have explicit ordering fields and manufacturer-matched pad geometry. All
three service buttons now export TL3342F160QG; their land geometry and internal contact grouping were reviewed. Crystal,
IR and sounder ordering fields are now explicit; their drawing/pad reviews are complete. This does not finish the
remaining component or electrical review.

After the header ordering/footprint update, KiCad reports **zero ERC violations, zero DRC violations, zero unrouted
items and zero schematic-parity issues**. All six header ordering codes export correctly. All 744 retained
pad-continuity checks and 2,843 tracks/vias pass unchanged; only the 21 header drill diameters change to 1.02mm. Pad
centres, copper lands, other holes, component/model positions and isolation rules are preserved. The fresh native 3D
rendering was visually inspected. U18's missing body model remains visible as an empty footprint; no placeholder or
placement change was introduced.

Repository `pnpm verify` passed its check stage and all 950 scoring-domain tests after restoring the missing scenario
manifest entry and replacing the ineffective batched mutation test with independent rejection cases. The three prior
test failures are resolved. Verification now stops at the scoring-domain 100% coverage gate: 95.98% lines, 95.34%
statements, 93.62% branches and 99.79% functions. No thresholds were lowered or checks suppressed; the full repository
run is not clean and did not complete all other packages. The board is not yet released for fabrication.

A temporary manufacturing export successfully produced all four copper layers, both mask/silkscreen/paste layers, the
outline, and separate plated/unplated drill files. The drill report contains 642 plated holes (including four slots) and
six unplated holes; all 21 revised header holes appear as 1.02mm. GerbView loaded all eleven Gerber layers and both
drill files. The outline, four separate copper layers and top silkscreen were visually inspected. A magnified
top-mask/PTH/NPTH overlay showed the two Favero connector contact and locating-hole patterns registered without a layer
shift. This does not establish every pad's annular ring or solderability. The outputs remain temporary review files, not
a released order package or completed assembly review.

The J1 close-up was also inspected in GerbView with top copper, top mask, plated slots and non-plated locating holes
toggled separately. Its four shell slots register inside their copper lands, with nominal 0.20mm radial copper margin;
both locating holes remain clear of the adjacent rounded ground lands. The 0.50mm-pitch signal lands are 0.30mm wide,
leaving 0.20mm between them. Native J1 mask expansion is zero, so these exported mask gaps are also 0.20mm. This exceeds
JLCPCB's currently published 0.13mm pad-spacing minimum for black/white mask with 1oz copper; their multilayer LDI
process supports 1:1 mask openings. See [capabilities](https://jlcpcb.com/capabilities/pcb-capabilities/) and
[mask process guidance](https://jlcpcb.com/blog/basic-design-of-solder-mask), checked 6 September 2026. No pad, hole,
mask or routing change was required. Supplier CAM must retain or explicitly review these openings; nominal geometry does
not guarantee mask registration, stencil paste volume or finished solder-joint quality.

The open PCB/3D editor had retained an obsolete in-memory board with two USB connectors and unrouted nets. It was closed
without saving the board and reopened from the current source, displaying 187 nets and zero unrouted items. Closing that
stale session nevertheless wrote obsolete project settings (a 0.3mm drill minimum and missing USB data netclass). After
exiting the entire project, the committed settings were restored exactly, not relaxed; fresh native ERC, DRC,
unconnected and schematic-parity checks all returned zero. Restart KiCad after external project-file edits so cached
settings cannot overwrite reviewed rules on exit. The refreshed 3D view uses the saved black stackup colors, one USB-C
port and current component placement. Ethernet and Favero cable mouths face their respective board edges. U18 still has
no body model. There are no dedicated chassis mounting holes; the six unplated holes are connector locating features,
not standoff positions. Prototype support and enclosure mounting must not place conductive hardware across the isolation
regions.

The temporary all-component placement CSV contains exactly the same 187 unique references as the BOM, all on top. Every
exported coordinate, rotation and side matches the native board (CSV Y is negated to use Cartesian coordinates).
Through-hole parts are included rather than silently omitted by an SMD-only export. These are footprint origins;
supplier-specific placement centres and rotation conventions still need the assembler's preview review.

Reference component data: [STM32G474](https://www.st.com/resource/en/datasheet/stm32g474re.pdf),
[Nexperia 74LVC125A](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf),
[BAT54S](https://assets.nexperia.com/documents/data-sheet/BAT54S.pdf),
[SN74AXC1T45](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf),
[AP63203](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), and
[XAL5030-472](https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xal/xal5030-472/).
