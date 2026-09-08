# USB scoring platform

Native KiCad engineering prototype, separate from the earlier ESP32/tscircuit board. Open
`usb-scoring-platform.kicad_pro` in KiCad 10; schematic and PCB are the editable source, with no generator required.

**Supplier-review draft, not released for fabrication, sale or connection to fencers.** The
[prioritized design review](design-review.md) is the single record of findings and closure evidence. Do not interpret a
clean ERC/DRC result as electrical safety, firmware readiness or supplier acceptance.

## Current board and power modes

The PCB is **165 x 100mm (approximately 6.50 x 3.94 inches)**, four layers, nominal 1.6mm. The current native export
contains **223 fitted parts** with manufacturer, MPN and footprint fields, plus bare J14 programming pads (224 PCB
footprints total). Use the exported BOM for procurement, not older quotes or component counts.

- **J1 is the only USB-C receptacle**, GCT USB4105-GF-A. It carries computer USB data/power or standalone PD power.
- U1 STM32G474RET6 handles acquisition and USB. The portable C17 scoring core can run on the desktop first and on STM32
  later. U2 ESP32-S3-WROOM-1-N8R8 handles the application/display interfaces.
- U5 STUSB4500QTR and U21 STM32C011F6P6 qualify the source. Laptop mode requires a sufficiently powered USB-C source:
  advertised Type-C current of at least 1.5A, or a validated 5V/1.5A PD contract. This does not promise universal USB-A
  adapter support. Laptop units ship without a connected HUB75 panel; the application branch remains off.
- Standalone display mode requires fresh source capabilities declaring no USB communications, a fixed 20V/3A offer, and
  a validated accepted contract. Voltage or bus silence alone never proves that a source is a charger.
- U19 **LTC3130IMSE-1#PBF**, with L2 **XAL5050-103MEC**, generates fixed 5V in automatic Burst/PWM mode. U18
  **LTM2884IY#PBF** provides isolated USB data/acquisition power. Never connect negotiated 20V directly to U18.
- U20 **TPS259470LRPWR** gates U6 **REC30K-2405SZ** isolated application power. D1/D2 OR the isolated sources into
  CORE_5V. AP2112K supplies CORE_3V3; AP63203 supplies application 3.3V. USB_GND and scoring GND must remain separate.
- U21 controls acquisition enable and application inhibition. It writes/read-backs volatile PDO settings, not boot-time
  NVM updates. Verify U5 POWER_OK_CFG=10b and REQ_SRC_CURRENT=0. See the
  [power-controller firmware and programming instructions](../../../apps/scoring/firmware/power-control/README.md).
- USB suspend can shut down acquisition. Remote wake is unavailable in laptop mode; desktop software must preserve bout
  state but discard the old capture session and reconnect. PB5 senses isolated USB power, not raw computer VBUS.

The [power budget](usb-acquisition-power.md) retains 20mA isolated startup and 75mA acquisition allocations. Whole-input
startup, attached-PD suspend consumption, transitions and thermal behavior remain unmeasured. The regulator's two
nominal manufacturer-model load steps pass; that is not proof of these whole-board conditions.

## Connections and assembly responsibilities

| Connection             | Selected part / interface                     | Purpose and delivery requirement                                                                                                                               |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J1                     | USB4105-GF-A USB-C                            | Computer power/data or standalone PD input; one populated port.                                                                                                |
| J13                    | CETUS J1B1211CCD Ethernet jack with W5500     | Wired network, including Cyrano software integration; cable enters at the bottom edge.                                                                         |
| Favero DATA ports      | Two TE 5520250-2 sockets, optocoupler outputs | FA-05-compatible lamp repeater interface; mouths face the top edge. These are neither Ethernet nor RS-422. Actual repeater loading/timing still needs testing. |
| HUB75 signal and power | Fitted connectors identified in the BOM       | External 64x32 RGB display. Panel, ribbon and power harness are separate from the bare PCB assembly. Do not connect the panel in laptop mode.                  |
| J3 / J4                | HTSW-103-07-L-S, 3-pin internal headers       | Left/right fencer harnesses, on opposite board edges. These are not the external female banana sockets.                                                        |
| J5                     | HTSW-101-07-L-S internal header               | Harness to the metal-piste reference socket; not protective earth.                                                                                             |
| J2                     | HTSW-105-07-L-S                               | STM32 SWD programming access.                                                                                                                                  |
| J6                     | HTSW-106-07-L-S                               | ESP32 UART recovery/programming access.                                                                                                                        |
| J12                    | HTSW-103-07-L-S                               | Primary-side PD service; do not bridge its USB_GND to scoring-side programmer ground.                                                                          |
| J14                    | Bare underside pads, no fitted connector      | U21 pogo programming: VLO reference, USB_GND, SWDIO, SWCLK, NRST.                                                                                              |
| U13 / BZ1              | TSOP38438 / PS1240P02BT                       | 38kHz IR receiver and externally driven sounder. Remote protocol/range and acoustic operation remain bench checks.                                             |

The owner's Ok Fencing cable is already validated; do not reopen that compatibility decision. The mating banana sockets,
harness termination, strain relief and enclosure attachment still need an explicit supplier responsibility and quote. J3
is left and J4 right when viewed from the component side with USB/Ethernet along the bottom. J5 is on the bottom edge.
Internal header pitch is 2.54mm; it does not define the external banana spacing. Physical A/B/C roles are below.

**No-owner-soldering delivery requires more than an SMT quote:**

1. Assemble every fitted BOM reference, including through-hole connectors, headers, modules, IR receiver and sounder.
   Accept appropriate separate assembly processes; do not assume all through-hole parts tolerate SMT reflow.
2. Accept U18's **MSL4 handling and 245 C maximum peak-body reflow** requirement, including SAC305 balls. Review U19/U20
   exposed-pad paste windows and final stencil/process choices.
3. Program U21 using the included HEX and the linked underside-pogo instructions, verify readback, preserve SWD/option
   bytes, and check U5 defaults. Fixture/service acceptance remains outstanding. The owner must not have to solder a
   programming connector to make the power controller usable.
4. Explicitly include any promised external sockets/harnesses and their assembly. A populated PCB alone is not a
   cable-ready enclosed scoring machine.
5. Review component orientation, contact numbering, finished-hole tolerances and placement origins against the final
   native export. Automatic catalog matches are not approved substitutions.

U21's programming file is implemented; the complete scoring/application firmware is not. "Ready to start programming"
must not be represented as a fully functioning or qualified scoring machine.

For ESP32 recovery, J6 pin 3 is the board's TX (connect to programmer RX), pin 4 is board RX (programmer TX), pin 2 is
scoring-side GND, pin 5 EN and pin 6 BOOT. Use 3.3V logic; pin 1 is APP_3V3, not permission to back-power the board.
Power the application branch normally, hold BOOT low while releasing reset, then release BOOT after boot strapping. Keep
this programmer ground separate from primary-side J12/J14 USB_GND. Physical recovery is not yet tested.

## Fabrication and export

For the prototype order choose **standard green solder mask and white silkscreen**. The saved black KiCad rendering does
not set the fabrication color. The crest logo has been removed; retain the existing small text. Do not reuse the earlier
tscircuit fabrication package.

Target stackup: **JLC04161H-7628**, nominal 1.6mm, outer 1oz / inner 0.5oz copper. Top-to-bottom copper/dielectric
thicknesses are 0.035 / 0.2104 / 0.0152 / 1.065 / 0.0152 / 0.2104 / 0.035mm. Prepreg Er is 4.4 and core Er 4.6. Supplier
confirmation of the actual stackup and impedance remains required.

USB trunks target 0.32mm width / 0.25mm gap, with narrower escapes and layer-transition discontinuities. Ethernet
routing and these nominal geometries are not measured impedance or signal-integrity approval. There are no dedicated
chassis mounting holes: connector locating holes are not standoff holes. Use an insulating prototype carrier and keep
conductive mounting hardware away from isolation regions.

Run from this directory:

```powershell
./export-manufacturing.ps1
```

The script creates a new ignored output directory, runs native ERC/DRC with schematic parity and zone refill, checks
assembly ordering fields and reference agreement, and exports:

- `pcb-fabrication.zip`: four copper layers, mask/paste/silkscreen, outline and separate plated/unplated drill files.
- `bom.csv` and `placement.csv`: separate assembly inputs, including through-hole parts but excluding bare J14.
- `programming/U21/`: freshly built controller image and programming instructions.
- `README.md`, `design-review.md` and `usb-acquisition-power.md`: the matching handoff and open findings.

The latest checked board export before this documentation consolidation is `output/isolation-extension-review/`: 223
matching assembly references and zero ERC, DRC, unconnected or schematic-parity findings. An export is a review package,
not authorization to manufacture. Re-export after any subsequent design change.

### Supplier draft status

The JLCPCB draft `0b1adc7b94a34bffbceb890f8951852c` and assisted-request uploads used an older **230-part** design. They
are stale after the U19 migration and copper corrections. Reconcile the current 223-part BOM, Gerbers and placement
files before progressing. The prior sourcing-cart total was a partial, dated quote with minimum packs, not a current
per-board price; no order or payment was submitted in the recorded handoff.

The owner authorized the $10 assisted part-selection service but subsequently paused submission. Do not submit or pay
without renewed direction. Supplier support described a route for through-hole assembly and LTM2884 process review; that
is not acceptance of this board or reflow profile.

C56 now selects **TDK C1608X5R1C475K080AC**; C64/C65 select **Yageo CC0603JRNPO9BN180**. Older capacitor candidates are
superseded. J2/J6 header sourcing quantities remain unresolved. Do not substitute ordinary PBT TSW for high-temperature
LCP HTSW without process review, or automatically replace a specified X7R capacitor with X5R.

## Verification boundaries

Use [design-review.md](design-review.md) for prioritized remaining work, exact part checks and evidence. Local
electrical simulations, native board checks and firmware tests do not establish FIE homologation or safe field use. The
unused isolation pour extensions have been removed; approximate same-layer separation is now 2.50–2.65mm. Required
clearance/creepage basis, cross-layer insulation and physical tests remain separate questions.

Supplier matching, assembly/programming acceptance and final CAM/placement review remain before ordering.
Startup/current/suspend, sensing/timing, USB behavior, repeaters and other physical measurements require the assembled
prototype; they are not a circular requirement to already own the PCB before ordering it. Keep fencers disconnected
until applicable electrical safety checks pass.

Repository verification currently has a separate TypeScript scoring-domain coverage shortfall; the last recorded run
passed 950 tests but did not meet its 100% coverage thresholds. Do not lower thresholds or report a clean full-repo
pass.

Authentic retained CAD sources are listed in [CAD model sources](../assets/cad/SOURCES.md). U18/U19/U20 exact body
models are absent and J13's referenced installed-library model is unavailable. Check drawings and pad geometry where
models are missing; do not invent bodies as proof of mechanical fit.

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
