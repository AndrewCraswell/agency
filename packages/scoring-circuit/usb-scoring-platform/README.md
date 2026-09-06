# USB scoring platform

Separate native KiCad engineering draft. The existing ESP32 prototype, browser preview, and fabrication files are
unchanged. Open `usb-scoring-platform.kicad_pro` in KiCad 10. The schematic and PCB files are editable source; no
generator is needed to maintain this project. Project-local footprints reference the existing package's retained STEP
models without changing or duplicating them in Git. Their sources and license notes are in
[CAD model sources](../assets/cad/SOURCES.md). Native library parts require the installed KiCad footprint and 3D
libraries.

**Not ready for fabrication, sale, or connection to fencers.** The schematic is a candidate circuit and the PCB is a
partially routed engineering draft, not a completed design. This folder is not consumed by the existing prototype export
commands.

## Board appearance and ordering

Use **black solder mask on both sides and white silkscreen**. These colors are saved in the native board; in KiCad's 3D
viewer enable **Use board stackup colors**. The component side carries `Fencing Club` text. The underside carries the
user's supplied crest, traced from `Fencing Club-09.png` into a native silkscreen graphic with its transparent cutouts
preserved. It is rotated 90 degrees along the board's long axis and uniformly enlarged to 108 x 88.8mm, without changing
the logo's proportions. The artwork spans pads and holes, with 0.3mm ink clearances around exposed back-side pads and
their holes. It is grouped as `Fencing Club crest`, reads normally from below, and adds no component or electrical
connection. The original logo file is not needed to open the board or export its silkscreen.

When ordering, explicitly select **Black** for PCB color and **White** for silkscreen in
[JLCPCB's quote](https://jlcpcb.com/help/article/instructions-for-ordering). The silkscreen Gerbers contain the
lettering/artwork, but ordinary Gerber layers do not select solder-mask ink color. Include both silkscreen layers and
inspect the fabrication preview, particularly the crest's fine details. Confirm the final black-mask manufacturing
clearances with the fabricator; this appearance change is not fabrication approval. The stackup color entries do not
specify the still-unconfirmed copper/dielectric construction.

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
- Keep the WIZ850io Ethernet module, TSOP38438 receiver, two TE 5520250-2 Favero DATA-LINE connectors with optocoupler
  outputs, HUB75 signal/power connectors, and sounder from the prototype. Favero ports are not Ethernet or RS-422.
  Ethernet accepts its cable from the bottom edge; both Favero sockets accept theirs from the top edge. The native RJ14
  footprint's mirrored contact/board-lock Y coordinates and STEP transform were corrected together using the
  [TE 5520250 D3 component-side drawing](https://www.te.com/commerce/DocumentDelivery/DDEController?Action=srchrtrv&DocFormat=pdf&DocLang=English&DocNm=5520250&DocType=Customer+Drawing&PartCntxt=5520250-2).
  Keep the drawing's contact numbering; rotating a model alone must never be used to conceal a hole-pattern mismatch.
- Separate USB-C connectors serve computer USB and USB-C PD power. **LTM2884IY#PBF** supplies isolated USB full-speed
  data and 5V acquisition power. It replaces ADuM3160 and its external termination/bypass parts. D1 and D2 (SS14) OR the
  isolated USB output and the PD-derived 5V rail into CORE_5V without backfeeding either source. AP2112K supplies
  CORE_3V3; the module's auxiliary 3.3V LDOs are not MCU supplies. Host USB ground remains separate from board ground.
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
- **Single-receptacle status:** the agreed shared power/data USB-C conversion is not yet implemented. The current two
  connectors and nonisolated PD converter cannot simply be joined without bypassing computer isolation. The laptop
  budget above does not select or implement the replacement isolated full-display power path.
- U18 uses the manufacturer's 44-ball, 15 x 15mm BGA land pattern with 1.27mm pitch and 0.63mm copper lands. The custom
  footprint follows the
  [05-08-1881 Rev B package drawing](https://mds.analog.com/api/public/content/BGA_44_05-08-1881_Rev_B.pdf), including
  top-view A1 orientation. Its manufacturer STEP model has not been obtained; the 3D view deliberately has no invented
  placeholder body for this part. Footprint and reflow-process review remain necessary for assembly.
- J1 uses GCT USB4105-GF-A for computer USB: a documented 16-contact USB 2.0 receptacle with a matching native KiCad
  footprint and STEP model. It replaces the initial HRO candidate in this new design only. See the
  [manufacturer drawing](https://gct.co/files/drawings/usb4105.pdf).
- U3 is **TPD2E2U06DCKR**, a supply-independent two-channel USB ESD protector. Pin 1 protects D+, pin 2 protects D-, and
  pin 3 returns to USB_GND. There is no VBUS supply/clamp pin. Its SC70-3 footprint uses TI's DCK0003A lands: 0.95 x
  0.4mm, 2.2mm row spacing and 1.3mm pin-1/pin-2 pitch. See the
  [TI pinout and package drawing](https://www.ti.com/lit/ds/symlink/tpd2e2u06.pdf). It replaces USBLC6-2SC6 and its VBUS
  trace branch; C1 remains input decoupling, with its required rating raised from 10V to 50V. Effective capacitance and
  the final capacitor MPN still need selection. This prepares the data protection for shared USB-C PD power; it does
  **not** make U18 or the existing two-input power circuit tolerant of raw 20V.
- Retain Adafruit 5807 configured to request 20V/3A and Pololu D36V50F5 modules initially. Use AP63203 with a Coilcraft
  XAL5030-472MEC inductor for application 3.3V. Module substitutions remain possible if footprint, power, cost, and
  availability justify them; this is not a locked procurement BOM.
- J3/J4 are three-wire harness landings for off-board female banana sockets, not banana receptacles themselves. J5 is
  the metal-piste reference connection, not protective earth. The user's compatible Ok Fencing cable remains unchanged.
  Viewed from the component side with computer USB/Ethernet along the bottom edge, J3 is on the left and J4 on the
  right, 150mm apart. J5 is on the bottom edge. The enclosure's banana sockets must follow this same left/right
  arrangement with room to grip both plugs; do not group the two fencer sockets together. Silkscreen identifies LEFT,
  RIGHT and PISTE. This placement does not change A/B/C pin assignments or establish the off-board socket spacing.

## Sensing checkpoint

Each conductor uses a 220-ohm excitation resistor, a 3.3k series sense resistor, and a 3.3k sense pull-down, all 1%.
Excitation input pull-downs and output-enable pull-ups are 10k. U8/U9 are **Nexperia 74LVC125APW**, replacing TI
SN74LVC125APWR; R7/R10/R13/R16/R19/R22/R25 change from 330 to 220 ohms. The manufacturer's
[Rev. 12 data sheet](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf), pages 3, 5, 6 and 10, confirms
matching pin functions and the TSSOP14 package, a 2.25V minimum high output at 18mA with a 3V supply through 125 C, and
specified power-off output leakage. No components, nets or footprint positions were added or moved.

The model requires CORE_3V3 to be at least 3V during acquisition; invalidate observations during startup/brownout. At
3.6V and minimum resistor tolerance, a grounded conductor draws 16.53mA, below the 18mA condition used for the
high-output bound. Opposed outputs draw 8.26mA. These are own-board low-voltage cases, not arbitrary external faults.

The seven comparator positive inputs are already correctly assigned: COMP1/2/3/4/5/6/7 use
PA1/PA3/PA0/PB0/PB13/PB11/PB14 respectively, for LEFT_A/LEFT_B/LEFT_C/RIGHT_A/RIGHT_B/RIGHT_C/PISTE. The continuity
candidate uses internal VREFINT/2 and the lowest nonzero hysteresis setting (HYST=1). Allow 200us reference-scaler
startup plus 5us comparator startup before accepting observations. A conservative threshold envelope is 0.556-0.651V,
including reference variation, scaler offset, comparator offset and hysteresis from DS12288 Rev 6, tables 20 and 79.

Run `pnpm --filter @repo/scoring-circuit simulate`. The [pair/reset model](../simulation/stm32-sensing-interface.cir)
checks:

- Disconnected input: 0.403V with a chosen 121uA leakage stress, below the 0.556V low boundary.
- 500-ohm contact: 0.748V with weak 2.25V excitation, resistor tolerance and opposing leakage stress, above 0.651V.
- Reset enable/input levels: 2.798V and 0.202V.
- Chosen 10nF cable load: active-low discharge crossed the low boundary after 4.35us. Passive contact release left a
  **68.33us tail**, so observation blanking and deliberate discharge must be included in scan timing.

The [seven-conductor model](../simulation/stm32-conductor-scan.cir) adds foil rest/target/off-target/piste paths, both
epee tip contacts, tip-plus-piste, sabre target/blade/reciprocal contacts, and a seven-way short. It clears all seven
conductors low, disables all outputs, then sources exactly one conductor while the others remain high impedance. The
next slot repeats the clear before selecting another source. Nominal cases pass the comparator envelope, including
unrelated lines after source handover. The seven-way short passes with each of the seven sources selected; peak modeled
source current is 15.00mA. A separate 2.25V source/tolerance case with a chosen 4uA load per input reads 0.866V at the
observation point and clears below 0.381V. These are modeled results, not bench measurements.

**The settled leakage-stress gap is corrected:** with the same 121uA-per-input load, weak 2.25V source and resistor
tolerances, seven shorted inputs now settle at **0.664V**, above the unchanged 0.651V criterion. The 13mV margin is
small, and this result does not establish settling time under that leakage or a guaranteed hot-temperature envelope. The
scan model's 50us slots take 350us per sweep and can miss contacts between observations. This characterization schedule
is **not approved scoring firmware timing**; qualifying pulse-duration boundaries needs the actual acquisition/capture
algorithm, not settled voltages alone.

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
blades can join all six cord wires. Scoring interpretation and the physical-to-core adapter remain unimplemented.

**Power-off protection is not closed.** The selected buffer specifies at most 20uA power-off leakage per input/output at
5.5V and 125 C; that protects its output path, not the whole conductor interface. D3-D9 still connect the sense nodes to
CORE_3V3 through BAT54S clamps. An externally driven conductor can inject into that rail when it is off, and AP2112K
must not be assumed to sink that current. Review that path before powered external-fault or fencer testing. Neither the
buffer's power-off specification nor the clamps authorize applying 20V PD to any conductor.

All seven selected comparator pins are STM32 **TT_a analog inputs**, not power-off-tolerant digital inputs. Their
operating input ceiling follows the analog supply; the absolute-maximum table does not grant normal operation while
unpowered. AP2112's typical 60-ohm output discharge applies with EN low, not as a guaranteed rail clamp after input
power disappears. Keep passive-cable power-down and sustained external-voltage fault tests separate. Do not substitute a
generic diode simulation for those guarantees. See STM32 DS12288 tables 15/17 and
[AN4899 section 5.2.1](https://www.st.com/resource/en/application_note/DM00315319-.pdf), and
[AP2112 electrical characteristics](https://www.diodes.com/datasheet/download/AP2112.pdf).

Leakage and capacitance are chosen stresses, not guaranteed worst cases or FIE evidence. BAT54S hot-leakage curves are
typical, not maximum ratings. The models do not prove exhaustive contacts, resistance diagnostics, clamp behavior or
capture timing. Do not treat continuity as a 450/475-ohm diagnostic or the passive-release tail as acceptable scoring
error. Most PCB routing remains unfinished.

## Current state and remaining work

The current draft contains 155 components across eleven functional/support sheets plus the cover. Every component has a
footprint, and all 160 schematic nets were transferred to the 160 x 100mm, four-layer PCB. The application 3.3V
regulator section and its 5V feed are routed, as are the STM32 regulator, PD-derived supply branch and local bypass
capacitors. Computer USB power, protection, isolation, data and USB-present sensing are routed, along with the STM32
crystal, boot pull-down, reset network/button and programming header. The PD input and 5V distribution to both HUB75
power contacts, both display buffers and their supply-side pull-ups are now routed. Most other parts remain in
provisional positions. The ESP32 supply, local bypass, enable/boot networks, buttons and manual UART programming header
are also routed. The two-way processor UART, its translators, four bypass capacitors and idle pulls are connected. The
IR receiver's filtered supply, ground and output to ESP32 GPIO42 are routed; the other peripheral interfaces remain
unfinished.

Remaining before fabrication:

1. Finish the sensing design: check the MCU clamp-rail/unpowered path and establish a sampling/excitation schedule that
   preserves the required contact-duration boundaries. The seven-input settled stress now passes, but timing, full
   weapon behavior and physical leakage margin remain unproven. Keep the 220-ohm excitation resistors and 3.3k sense
   dividers as the current candidate; BAT54S protection still needs review. Do not infer patent clearance from component
   selection or this topology.
2. Use the [20mA startup / 75mA acquisition budget](usb-acquisition-power.md) when implementing USB acquisition, and
   finish the shared USB-C conversion while preserving isolation. Bench-check startup/current/suspend behavior, supply
   handover, and the electrical safety boundary for USB, PD, Ethernet, piste, and weapon conductors. The integrated
   isolator and all-layer copper keepouts separate computer ground from board ground; acquisition and application still
   share board ground. The keepout spans the gap between the module's primary and secondary ball rows. This is not
   complete board safety proof.
3. Finish the remaining local placement, decoupling, connector access, mounting, antenna clearance, and power/current
   paths. Review every retained footprint and 3D transform against its exact part drawing. Resolve the USB connector's
   tight pad-to-locating-hole clearance with the fabricator; do not move its mechanical holes or suppress the warning.
4. Complete routing, define the manufacturing stackup/net classes, run schematic-to-PCB parity and DRC, inspect 3D and
   manufacturing outputs, and then perform hardware bring-up. The remaining peripheral supply distribution and other
   signal interfaces still need routing. USB impedance must be checked against the selected fabricator stackup before
   release. No purchase or assembly release has been performed.

## Checks performed

The latest native KiCad 10.0.6 checks reported zero ERC violations and zero schematic-to-PCB parity mismatches. Netlist
export and connected-pin transfer checks succeeded. DRC reports **220 unrouted items** and **four other findings**, all
at J1. GCT's USB4105 drawing matches the existing land pattern, including 0.65mm locating holes and 0.6 x 1.15mm outer
ground pads; its resulting 0.1944mm pad-to-hole clearance is below the 0.25mm board rule and JLCPCB's published 0.2mm
NPTH-to-track figure. Retain the manufacturer's geometry pending fabrication review or a justified connector change. No
DRC exclusions or severity reductions were added. Module symbols use passive pins where detailed electrical pin types
are unavailable, limiting ERC's fault detection.

The application buck section retains its 31 track segments and eight 0.6/0.3mm vias. U7, L1 and C4-C7 are grouped below
the ESP32 antenna keepout. The 5V feeder connects both U6 output pins to C5; short top-layer connections close the
input, switch and bootstrap paths. C6/C7 connect the inductor output to ground, and a separate feedback route returns
from C6 on In2.Cu beneath In1.Cu ground. Ground stitching connects the input/output capacitor returns, U7 ground and U6
ground pins. Native KiCad connectivity confirms every local regulator pin reaches its intended parts; placement, copper
and 3D exports were visually checked. No parts, pad assignments or connector positions changed. This follows the
[AP63203 layout guidance, page 15](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), not a
measured supply qualification: effective capacitor values, final copper weight, startup, load-step and thermal behavior
still need verification. The ESP32 is now connected to its 3.3V output; peripheral loads remain unfinished.

The STM32 supply routing adds 62 track segments and 29 ordinary 0.6/0.3mm vias. D2 now branches from PANEL_5V; both
diode cathodes feed C2 and U4's input/enable pins. U4's output reaches C3, C14 and all seven MCU supply pins through an
In2.Cu CORE_3V3 pour. The existing In1.Cu/back-layer ground pours extend beneath this section; supply and ground vias
sit off component pads. Native connectivity confirms each MCU supply/ground pin and all twelve local capacitor returns
reach the intended rail. Copper, component placement and the edited schematic were visually checked using native KiCad
exports.

C8-C11 provide one 100nF bypass per VDD pin. VDDA uses C12 **10nF** plus new C33 **1uF**; VREF+ uses C13 **100nF** plus
C15 **1uF**. New C34 **100nF** bypasses VBAT, which remains tied to CORE_3V3 without a battery. These follow
[DS12288 Rev 6, Figure 16, page 81](https://www.st.com/resource/en/datasheet/stm32g474re.pdf) and
[AN5093 Rev 2, section 1.1.2](https://www.st.com/resource/en/application_note/an5093-getting-started-with-stm32g4-series--hardware-development-boards-stmicroelectronics.pdf).
Keep **VREFBUF disabled** because VREF+ is externally supplied; the comparator's internal VREFINT selection is separate.
The SWD header, reset switch and one crystal capacitor moved locally to clear this routing; processors and external
connectors did not move. Other acquisition loads remain unrouted. This is not an operating supply qualification: exact
capacitor selection/effective capacitance, regulator current/thermal margin, startup and handover still need
verification.

The USB routing connects both USB-C data-contact copies through U3 to U18, each CC pull-down independently, and all
VBUS/ground contacts. U18's isolated 5V output reaches D1 and the R3/R4 USB-present divider at the STM32. Its VLO output
drives ON/SPNDPWR only; VLO2 stays unused. No components, values, pad assignments or external connector positions
changed. U3, C1, R1/R2 and R3/R4 moved locally; one neighboring silkscreen label moved for clearance. Native copper
connectivity confirms every USB pin, the regulator feed and PB5 sensing; host/board grounds remain separate.

After the IR routing, the board has 444 track segments, 140 ordinary 0.6/0.3mm vias and twelve copper zones. The prior
power/USB routing and isolation/antenna keepouts are unchanged. Separate host-ground pours and the extended board-ground
pours provide return paths without crossing the barrier. Ground-ball rows escape to vias outside the BGA pads. This
follows the
[LTM2884 layout guidance, page 17](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf),
including its integrated bypass/termination, and keeps the
[TPD2E2U06 protection](https://www.ti.com/lit/ds/symlink/tpd2e2u06.pdf) close to the connector. Native top-copper,
ground-layer and 3D exports were visually reviewed; U18 still has no retained 3D body, as noted above.

The board-side USB pair uses 0.20mm traces with 0.25mm edge spacing on its main top-layer run. Short back-layer
crossovers resolve the connector/package pin order. U18-to-STM32 path lengths are approximately 78.03mm D+ and 81.18mm
D-, including two 1.6mm via traversals on D-. These are routing measurements, not an impedance or eye-diagram pass.
Confirm the 90-ohm differential target with the fabricator's actual stackup, then verify enumeration, signal integrity,
ESD, current, suspend/resume and USB/PD handover on hardware. Firmware and physical USB operation remain unverified.

The STM32 support routing connects Y1/C17/C18 to PF0/PF1, R6 to PB8/BOOT0, and R5/C16/SW1/J2 to NRST. J2's five pins are
**1 target 3.3V reference, 2 SWDIO, 3 SWCLK, 4 GND, 5 NRST**; this is a custom header, not a standard keyed debug
connector. Use the reference as a programmer voltage sense, not a competing supply. SWD is unisolated service access:
disconnect fencers/piste and use bench-only programming, since a grounded debugger bypasses computer-USB isolation. Keep
NRST in reset mode and retain SWD access in firmware/option bytes; programming and recovery are not bench-proven.

Y1 and both load capacitors moved beside the oscillator pins. HSE_IN/HSE_OUT remain top-layer-only, approximately
4.75/11.51mm from MCU to crystal, with a grounded guard and uninterrupted In1 ground beneath the loop. No unrelated
signal crosses beneath it. C16/R5 moved nearer the MCU and R6 beside BOOT0; C8/C34 labels moved, but their parts and the
existing 256 power/USB tracks/vias did not. Native copper connectivity checked both clock branches, the boot pull-down,
every reset/programming connection and all returns, including both reset-button ground pads. Top/back copper and native
3D renders were visually reviewed; no components, values, footprints, nets, processors or connectors changed.

The [Abracon ABM3B](https://abracon.com/Resonators/abm3b.pdf) crystal remains the 8MHz/18pF candidate. The existing two
27pF capacitors imply 18pF loading only with about 4.5pF stray capacitance; they remain tuning values. Placement follows
[ST's oscillator/reset guidance, Figures 21 and 27](https://www.st.com/resource/en/datasheet/stm32g474re.pdf), not a
clock qualification. Confirm startup margin, crystal drive, frequency across supply/temperature and the final load
capacitors on hardware. No speculative oscillator model or extra support parts were added.

The PD/display power routing connects U5 V+ to both U6 VIN contacts with a 2mm top trace. A dedicated In2.Cu 5V pour,
mostly 6mm wide, connects both U6 output contacts to both J8 positive contacts; it does not send display current through
the earlier 1mm application-buck feeder. In1/back ground extends to U5, the display header and panel return contacts,
without entering the Favero output-side region or changing USB/antenna keepouts. Power-contact thermal spokes are 0.8mm;
the crowded HUB75 ground contacts use diagonal spokes. C31/C32 now sit beside U14/U15 supply pins, with local ground
vias; R34 moved clear of them. No connector, module, pad/hole position, part value or net assignment changed.

Native copper checks confirm all sixteen PANEL_5V pad endpoints, both PD input contacts and the panel/buffer grounds;
the prior 330 tracks/vias and three board/footprint keepouts are unchanged. Filled power/ground layers, display-buffer
placement and the native 3D render were inspected. U6's retained manufacturer STEP is now right-side up. Its native
KiCad transform is rotation `(180, 0, 270)` and offset `(-11.43, -12.7, 7.5748)` mm; all eight electrical pads remain
fixed. The three carrier mounting holes were corrected to local `(-9.271, -10.541)`, `(-9.271, 10.541)` and
`(11.811, 10.541)` mm, including the previously mirrored third hole. Measurements of the native KiCad STEP export
confirm all eight power-pin centres and three mounting-hole centres coincide within 0.001mm. The library footprint and
board agree. This matches the [manufacturer's VOUT/GND/GND/VIN row order](https://www.pololu.com/product/4091), not a
physical assembly approval. The model assumes 6mm clearance between carrier top and module PCB underside; select
matching header/spacer hardware and confirm seating and fastening on the real module. No STEP geometry was altered or
invented.

For full-system bring-up, use a USB-PD adapter supporting 20V/3A and a 3A cable. On U5, open every voltage jumper and
both current jumpers, as described in the
[Adafruit pinout guide](https://learn.adafruit.com/adafruit-husb238-usb-type-c-power-delivery-breakout/pinouts). This
requests 20V/3A, not a guaranteed 20V output: the adapter can supply a lower available voltage. A 5V-only source does
not meet the D36V50F5's 5.5V minimum input. U6 remains enabled by default and retains its built-in reverse-input,
overcurrent, short-circuit, thermal and soft-start protection; unused VRP/EN/PG module contacts stay unpopulated. Use
both pins of each power pair (3A per pin, 6A per pair). Final copper weight, thermal necks, module temperature, adapter
negotiation, panel/cable current and full-white display load still require verification; these routes do not establish a
5A continuous system rating. Computer USB still powers acquisition only, not the panel.

The ESP32 routing adds 55 track segments, 21 ordinary vias and an In2.Cu APP_3V3 pour. C22 (10uF) and C27 (100nF) sit
next to the module supply pad with short ground returns; R28 (10k) and C21 (1uF) provide the existing enable delay, and
R29 (10k) pulls GPIO0 high. These follow the
[Espressif supply and reset guidance](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html).
The antenna keepout, processors, external connectors and all 366 prior tracks/vias are unchanged. Only those five
support parts moved; L1's label moved for clearance. Native copper checks confirm the supply, every module
ground/thermal pad, enable/reset, boot and programming connections; top/back/inner copper and 3D placement were visually
reviewed. Supply startup, RF-current transients, reset timing and actual programming still need bench verification.

J6 is a custom unisolated service header: **1 target 3.3V reference, 2 GND, 3 ESP32 TX, 4 ESP32 RX, 5 EN/reset, 6
GPIO0/BOOT**. Cross TX/RX to a 3.3V USB-UART adapter; do not apply 5V logic or power the board from the adapter's
reference connection. Power the application from PD, hold SW3/BOOT while pressing and releasing SW2/RESET, then release
BOOT to enter the ROM downloader. This is manual recovery, without an added auto-reset circuit. Disconnect fencers and
piste before service: adapter ground bypasses the isolated computer-USB path. The main computer USB connector belongs to
STM32 acquisition, not this ESP32 programming port. Remaining peripheral interfaces are still unrouted.

The processor link now connects STM32 PA9/TX (U1.43) through U10 to ESP32 GPIO48/RX (U2.25), and ESP32 GPIO47/TX (U2.24)
through U11 to STM32 PA10/RX (U1.44). U10 DIR is tied to CORE_3V3; U11 DIR is grounded. C23-C26 sit beside their
respective supply pins, with short ground returns. R72/R73 add 10k transmit idle pulls on each local rail so processor
reset does not leave translator inputs floating; the existing 47k receive pulls retain idle levels when the opposite
rail is off. This follows the
[TI pin, power-down and layout guidance](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf). The added acquisition-side
pull is included in the unchanged 20mA/75mA power targets. Native copper checks confirm both directions, all translator
supply/ground/direction pins, bypass and bias connections, with no rail or UART0-recovery bridge. Only eight existing
link components moved; every previous track/via and the processors/connectors stayed fixed. No galvanic isolation was
added by these translators. Firmware framing, baud rate, reset/reconnect behavior and physical power-off leakage and
signal testing remain unfinished.

The TSOP38438 receiver now connects pin 1 OUT to ESP32 GPIO42 (U2.35), pin 2 to board ground, and pin 3 to APP_3V3
through the existing R32 (100 ohms), with C30 (100nF) beside the receiver. Only R32/C30 moved; the receiver, connectors
and all 552 previous tracks/vias stayed fixed. This follows the
[Vishay pinout and supply-filter topology, page 2](https://www.vishay.com/docs/82491/tsop382.pdf); the existing filter
values remain candidates, not measured noise rejection. Ground extends beneath the route without grounding Favero's
output pins or crossing USB isolation. Native continuity and copper/3D review passed. The active-low output is a
demodulated 38kHz signal, not decrypted commands: firmware must decode and authenticate it. Keep GPIO42 input-only with
its internal pull-up disabled, so it does not bypass the filtered supply through the receiver output. IR remains off in
laptop acquisition-only mode. Remote burst/gap compatibility, enclosure sightline, range and operation during full
display/Ethernet activity still need hardware verification.

The ESP32 thermal holes remain 0.2mm inside 0.6mm copper lands (0.2mm nominal annular ring). The minimum drill setting
is now 0.2mm, supported by [JLCPCB's multilayer drilling capabilities](https://jlcpcb.com/capabilities/Capabilities);
ordinary routing vias remain 0.6/0.3mm. This resolves the previous twelve drill-setting findings without changing the
ESP32 footprint. Nine silkscreen findings were corrected by relocating the Favero labels, optocoupler/buzzer pin-1
markers, and U14/D2 references off pads or neighboring outlines. The three project-local footprint masters match the
board. Native KiCad copper/silkscreen exports were visually reviewed; these edits do not move any component, hole or
model and do not establish solder-paste/thermal-via assembly acceptance.

KiCad loaded the current schematic/PCB and rendered the assembly. Native 3D cable-side and underside views confirmed
Favero openings toward the top edge and Ethernet toward the bottom; measured CAD tail/board-lock centres match their
holes. Left/right harnesses are separated and piste is on the bottom edge. No footprint bounding boxes collide, but
enclosure cutouts, real plug/latch access, complete pin seating and electrical design still need review. These checks
establish placement/connectivity consistency, not fabrication approval. The buffer/resistor substitutions preserve
placement, footprint geometry and every pad's net assignment.

All seven models' acceptance limits pass, including the corrected seven-input settled leakage stress; this remains
bounded simulation, not a passed physical operating corner. The five older models concern the original prototype only.
The enlarged branding passed native KiCad rendering and silkscreen Gerber export. The USB protection update changed U3's
protector/land pattern, its local USB traces and C1's voltage rating. U3 has no VBUS connection. The following
processor-link and IR routing reduced unconnected items from 250 to 220, with no new DRC findings. Schematic, copper and
native 3D renders were reviewed; ERC is clean, and DRC retains four USB connector hole-clearance findings and zero
schematic-parity issues. The latest repository verification passed formatting, lint, types and unused-code checks but
failed three scoring tests: a mutation timeout, a canonical-corpus failure and a 29-versus-28 scenario-count assertion
(770 scoring tests passed). The previously failing live-rebuild and workflow-deletion tests passed this run. These tests
are outside the board edits; none was suppressed or modified. Physical USB signal, surge and ESD testing remain
required; native connectivity and the protector's component ratings do not establish board-level immunity.

Reference component data: [STM32G474](https://www.st.com/resource/en/datasheet/stm32g474re.pdf),
[Nexperia 74LVC125A](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf),
[BAT54S](https://assets.nexperia.com/documents/data-sheet/BAT54S.pdf),
[SN74AXC1T45](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf),
[AP63203](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), and
[XAL5030-472](https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xal/xal5030-472/).
