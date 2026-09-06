# USB scoring platform

Separate native KiCad engineering draft. The existing ESP32 prototype, browser preview, and fabrication files are
unchanged. Open `usb-scoring-platform.kicad_pro` in KiCad 10. The schematic and PCB files are editable source; no
generator is needed to maintain this project. Project-local footprints reference the existing package's retained STEP
models without changing or duplicating them in Git. The new RECOM module has its own retained manufacturer STEP under
`models/recom-rec30k.step`. Other existing model sources and license notes are in
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
- **J1 is the only USB-C receptacle**, for laptop power/data or standalone PD power. U5 **STUSB4500QTR** replaces the
  Adafruit connector module. U19 **LMR36510ADDAR** and L2 **XAL5050-223MEC** provide a nominal 5.016V primary supply for
  **LTM2884IY#PBF**; raw negotiated VBUS must never reach that isolator. U6 **REC30K-2405SZ**, behind U20
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
- **Mode configuration:** program and read back U5's NVM before bring-up. Full-system profile: PDO1 5V/0.5A, PDO2
  20V/3A, two PDOs, POWER_OK_CFG=10b, USB_COMM_CAPABLE=1, REQ_SRC_CURRENT=0. Laptop-only units use a PDO1-only profile,
  with no HUB75 connected and the application branch off. Q4/Q5 require both the PDO2 power flag and the VBUS-path
  enable flag before releasing U20; its nominal UVLO is 18.0V, OVLO 21.84V and current limit 2.43A. A 20V contract is
  **not** proof of a charger: a laptop can also offer PD. USB enumeration, not bus silence or PD voltage, establishes a
  data session. NVM programming and firmware behavior are not implemented or tested here.
- **Low-voltage caveat:** U19 is a buck, not a boost converter. At approximately 5V input it operates in dropout; U18
  still needs at least 4.4V at its own pins. Target at least 4.75V at J1 for initial bench work and measure the loaded
  drop and transitions. The earlier assumption that 4.4V at J1 is sufficient is no longer established. Do not claim all
  laptop/cable combinations are supported; resolve this corner before releasing the power design.
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
  the final capacitor MPN still need selection. The data protector is independent of raw VBUS, but U18 must receive
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
error. Conductor routing remains unfinished; completed power routing is not a measured operating result.

## Current state and remaining work

The current draft contains **200 components**, twelve functional/support sheets plus the cover, and 187 named nets
(including explicit no-connect nets) on the unchanged **160 x 100mm**, four-layer PCB. The shared USB-C schematic,
footprints and initial power placement are present. The new converter's secondary output and local bypass connect to the
retained display/application/core distribution. U19's input bypass, switch/inductor, bootstrap, internal-supply bypass,
output capacitors and feedback divider are now locally connected. U5's local supply, internal-regulator bypass, CC/CCDB
pairs, sensing, discharge and I2C service port are connected. Both PD flags reach Q4/Q5 and U20's enable pin. U20's
input bypass, protected output to U6, voltage dividers, current limit and soft-start components are locally connected.
**J1-to-controller CC, primary input distribution and the U19-to-U18 supply feeder are now connected through a left-edge
primary corridor.** Primary ground returns join through that corridor without joining board ground. The shared-input
layout is connected, but power behavior and safety remain unverified. The acquisition buffers now have connected
supplies, local bypass and all seven reset-default resistor networks. All fourteen STM32 drive/enable signals reach
those buffers and resistors. The remaining 89 unrouted items concern other unfinished connections, principally the
conductor/sense interface and remaining support resistors.

The existing USB data/protection, isolated output and USB-present sensing remain routed, along with the STM32 regulator,
crystal, boot pull-down, reset network/button and programming header. The 5V distribution to both HUB75 power contacts,
display buffers and application regulator remains connected. Sensing placement is still provisional. The ESP32 supply,
local bypass, enable/boot networks, buttons and manual UART programming header are also routed. The two-way processor
UART, its translators, four bypass capacitors and idle pulls are connected. The IR receiver's filtered supply, ground
and output to ESP32 GPIO42 are routed. The WIZ850io Ethernet supply, SPI bus, reset and interrupt are also connected.
All thirteen HUB75 buffer outputs now reach the display connector, together with the local buffer-disable and
panel-blanking network. The one-way display buffers and thirteen input pull-downs now have defined reset defaults. The
ESP32 input bus, display-enable line, sounder and both Favero repeater circuits are also routed. Conductor interfaces
remain unfinished.

Remaining before fabrication:

1. Finish the sensing design: check the MCU clamp-rail/unpowered path and establish a sampling/excitation schedule that
   preserves the required contact-duration boundaries. The seven-input settled stress now passes, but timing, full
   weapon behavior and physical leakage margin remain unproven. Keep the 220-ohm excitation resistors and 3.3k sense
   dividers as the current candidate; BAT54S protection still needs review. Do not infer patent clearance from component
   selection or this topology.
2. **Next: review remaining support resistors and resolve the sensing-protection decision before final conductor
   routing.** STM32's seven drive and seven output-enable signals, buffer supplies, bypass and local reset defaults are
   connected. Keep the unfinished conductor/clamp paths separate from these completed routes. The USB primary corridor
   is connected; resolve the buck's low-input-voltage corner and program/read back U5 before powered bring-up. Use the
   [20mA startup / 75mA acquisition budget](usb-acquisition-power.md) when implementing USB acquisition. Bench-check
   startup/current/suspend behavior, supply handover, and the electrical safety boundary for USB, PD, Ethernet, piste,
   and weapon conductors. The integrated isolator and all-layer copper keepouts separate computer ground from board
   ground; acquisition and application still share board ground. The keepout spans the gap between the module's primary
   and secondary ball rows. This is not complete board safety proof.
3. Finish the remaining local placement, decoupling, connector access, mounting, antenna clearance, and power/current
   paths. Review every retained footprint and 3D transform against its exact part drawing. Resolve the USB connector's
   tight pad-to-locating-hole clearance with the fabricator; do not move its mechanical holes or suppress the warning.
4. Complete routing, define the manufacturing stackup/net classes, run schematic-to-PCB parity and DRC, inspect 3D and
   manufacturing outputs, and then perform hardware bring-up. Conductor connections still need routing. USB impedance
   must be checked against the selected fabricator stackup before release. No purchase or assembly release has been
   performed.

## Checks performed

The latest native KiCad 10.0.6 checks reported zero ERC violations and zero schematic-to-PCB parity mismatches. Netlist
export and connected-pin transfer checks succeeded. DRC reports **89 unrouted items** and **four other findings**, all
at J1. GCT's USB4105 drawing matches the existing land pattern, including 0.65mm locating holes and 0.6 x 1.15mm outer
ground pads; its resulting 0.1944mm pad-to-hole clearance is below the 0.25mm board rule and JLCPCB's published 0.2mm
NPTH-to-track figure. Retain the manufacturer's geometry pending fabrication review or a justified connector change. No
DRC exclusions or severity reductions were added. Module symbols use passive pins where detailed electrical pin types
are unavailable, limiting ERC's fault detection.

The U19 primary buck now has 54 additional tracks/vias. Nine local support placements were tightened around its input,
BOOT/VCC and feedback pins, following the
[TI LMR36510 layout guidance, pages 26-28](https://www.ti.com/lit/ds/symlink/lmr36510.pdf). The fast input/switch paths
stay on top copper; a short output-sense trace runs on the back beneath the uninterrupted In1 USB_GND plane. Local
ground stitching and the existing package thermal holes connect the returns. Native checks passed all seven local net
groups and **768 prior pad-continuity comparisons**, with all **1377 previous tracks/vias** unchanged. No parts, values,
nets, connectors, isolation keepouts or branding were added or changed. Actual copper layers and the native 3D render
were inspected; a resistor courtyard conflict was corrected before acceptance. Unrouted items fell from 221 to 202, with
no new ERC, parity or DRC finding. This does not qualify regulation, dropout, transient response, effective capacitance,
copper weight or temperature; the low-input-voltage concern remains unresolved.

The STUSB4500 local control wiring adds 108 tracks/vias and moves only C36/C37/R88/R89. Both internal-regulator outputs
have their own bypass capacitor and no external load. Reset, address straps and unused VSYS return to primary ground.
J12 exposes primary ground, SDA and SCL; the external 3.3V programmer must supply I2C pull-ups. POWER_OK2 and
VBUS_EN_SNK independently control the two default-on enable clamps, following the
[ST pin functions and power-flag guidance, pages 4-10](https://www.st.com/resource/en/datasheet/stusb4500.pdf). No
component, net, external connector, isolation boundary or crest geometry changed. Native continuity passed all 15 local
control net groups and 768 previous pad comparisons; all 1431 earlier tracks/vias stayed fixed. Copper and native 3D
views were inspected, and the overlapping same-ground pours were merged before acceptance. Unrouted items fell from 202
to 172 with no new ERC, parity or DRC finding. This is local wiring, not working PD negotiation or NVM programming; the
connector feeds remain unfinished.

U20's eFuse power and support network adds 80 tracks/vias and C50, a 100nF/50V input bypass. Eight existing support
parts moved locally; Q5's printed reference moved clear of the resistors. Both ends of each narrow power land escape to
nearby vias and top/back copper areas. C46/C47 bypass the protected output feeding U6. ILM and dVdt have short top-side
routes and a shared ground branch at U20; divider returns use the primary ground plane. This follows the
[TI input bypass and layout guidance, pages 62-63](https://www.ti.com/lit/ds/symlink/tps25947.pdf). All seven local net
groups and 768 previous pad-continuity comparisons pass, with all 1539 previous tracks/vias unchanged. Native schematic,
copper and 3D views were reviewed; trace/via crossings, courtyard clearances and a label overlap were corrected before
acceptance. Unrouted items fell from 172 to 154 with no new ERC, parity or DRC finding. The crest, external connectors,
processors and isolation keepouts stayed fixed. Final capacitor selection, copper weight/current capacity, temperature,
inrush/short-circuit transients and actual converter startup remain unverified; these local routes do not close the
power-system bring-up or safety requirements.

The primary corridor adds 77 tracks/vias and connects both J1 VBUS contact groups, U5/U19/U20 input branches, CC1/CC2
and every U18 primary-supply pad. Four existing short 5V back-layer tracks were widened to 0.6mm for the added feeder
load; all 1619 prior track/via paths remain in place. Native continuity passes every pad on the five completed primary
nets and 770 earlier pad comparisons. No part, net or value was added. J3 moved 7mm inward, still on the left, and the
unrouted R24/D9 moved clear of it. Other component positions, connector orientations and the crest stayed fixed.

The two primary ground areas now join along the left edge. The old lower horizontal keepout was reshaped into a
continuous all-copper exclusion beside that corridor; the actual U18 and U6 isolation-barrier keepouts are unchanged.
The corridor's exclusion is 2.8mm wide along its straight section and 2mm at the existing lower horizontal boundary.
These are provisional layout dimensions, **not qualified creepage, clearance or FIE safety ratings**. Do not route
weapon/board-ground copper into the primary corridor. No signal trace was added to In1.Cu. Root review of front/back/
inner copper and the native 3D render caught and corrected new crossings and via clearances. Final ERC and parity are
clean; DRC fell from 154 to 141 unrouted items with only the same four J1 findings. Copper thickness, feeder heating/
drop, CC noise susceptibility, loaded regulation, negotiation and isolation testing remain open.

The application buck section retains its local routing. U7, L1 and C4-C7 are grouped below the ESP32 antenna keepout.
The 5V feeder connects U6's isolated output to C5; short top-layer connections close the input, switch and bootstrap
paths. C6/C7 connect the inductor output to ground, and a separate feedback route returns from C6 on In2.Cu beneath
In1.Cu ground. Ground stitching connects the input/output capacitor returns, U7 ground and U6's isolated return. Native
KiCad connectivity confirms every local regulator pin reaches its intended parts; placement, copper and 3D exports were
visually checked. This follows the
[AP63203 layout guidance, page 15](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), not a
measured supply qualification: effective capacitor values, final copper weight, startup, load-step and thermal behavior
still need verification. The ESP32 and its peripherals are connected to this output; the replacement primary supply is
unverified on hardware.

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

The retained USB data routing connects both USB-C data-contact copies through U3 to U18. U18's isolated 5V output
reaches D1 and the R3/R4 USB-present divider at the STM32. Its VLO output drives ON/SPNDPWR only; VLO2 stays unused.
R1/R2 have been removed: U5's local CC/CCDB pairs are joined for the sink terminations, but their traces to J1 are not
yet routed. The old raw-VBUS feed to U18 was removed for the required regulated supply. Native copper comparisons
confirm the retained data, isolated-output and PB5 connections; they do not establish continuity of the new primary
power.

Separate host-ground and board-ground pours retain the USB isolation boundary. Ground-ball rows escape to vias outside
the BGA pads. This follows the
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

The shared-input replacement removes the Adafruit PD connector module, Pololu converter and external CC resistors.
Native continuity comparisons passed for **634 retained pads**; **1365 previous tracks/vias** stayed geometrically
unchanged and **34 obsolete input/module stubs** were removed. The replacement U6 secondary, C48/C49 and existing
PANEL_5V distribution are connected, including the U7/D2 feeder formerly linked through the old module's pads. The
primary island and its feeds are now routed. The later corridor adjustment moves only J3/R24/D9 among the non-power
parts; pin assignments remain unchanged. Dense power-support references are on F.Fab for assembly inspection.

The new [RECOM REC30K-2405SZ](https://recom-power.com/en/rec-s-REC30K.html) footprint follows its six-pin top-view
pattern. The retained manufacturer STEP uses rotation `(90, 0, 0)` and offset `(0, 0, 0.6108)` mm. A native KiCad STEP
export places all six model pin axes within 0.000003mm of their corresponding hole centres. The model's SHA-256 is
`4dd6309726ab6e64aac9acbfc641f70db7001182d952ef02c4de8f90458b2559`. No substitute geometry was invented. This is a
model/footprint consistency check, not physical sample-fit approval. The module's 2000VDC, one-minute basic-isolation
rating does not establish board safety or FIE approval.

U5's QFN and U20's RPW land patterns were reviewed against the manufacturer drawings:
[STUSB4500](https://www.st.com/resource/en/datasheet/stusb4500.pdf),
[TPS25947](https://www.ti.com/lit/ds/symlink/tps25947.pdf). U19 uses the native TI HTSOP thermal-via footprint and the
[LMR36510 reference circuit](https://www.ti.com/lit/ds/symlink/lmr36510.pdf). U20's current-limit value is nominal, not
an absolute peak-current guarantee. Startup slew, loaded PD negotiation, detach, current-limit tolerance, capacitor
effective values, isolation, thermal behavior and full-white panel load remain untested. The source must offer 20V/3A
for full-system operation; a 5V-only source leaves that branch disabled.

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
STM32 acquisition, not this ESP32 programming port. The peripheral routing described below is retained.

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

The WIZ850io interface is routed without adding parts: U12 contacts 3/4/5/6/11/12 connect to ESP32 module pads
21/22/32/33/34/31 for MOSI/clock/chip-select/interrupt/reset/MISO respectively. Both 3.3V contacts and all three ground
contacts are connected; contact 10 stays NC. C28/C29 moved beside the power header, outside the module outline. The
module, all external connectors and all 584 prior tracks/vias stayed fixed. Native continuity, copper and 3D review
passed, including the earlier circuits and isolation boundaries. The
[WIZnet module schematic](https://docs.wiznet.io/assets/files/wiz850io_sch_v110-3fcc19fc2acaf16f15c5f08f9c8330cb.pdf)
already contains 4.7k pull-ups on chip-select, interrupt and reset; do not duplicate them on the carrier. Follow the
[module startup requirement](https://docs.wiznet.io/Product/ioModule/WIZ850io): assert reset for at least 500us, then
wait at least 50ms after release before SPI access. Begin bench bring-up at a conservative 1MHz SPI clock and verify
waveforms before increasing it; these routes do not establish the chip's maximum SPI rate. Ethernet is application/PD
powered only. Physical link, Cyrano traffic, simultaneous display activity and power/reset recovery remain untested.

The HUB75 output-side routing connects U14's eight outputs and U15's five used outputs to all thirteen J7 signal
contacts, preserving their pin order. Q1, R33/R34 and both buffer-enable pins are connected; R35 pulls panel OE high
while the buffer outputs are disabled. The existing 5V distribution, bypass and connector grounds remain connected. The
five inner-layer control traces run beside, not through, the high-current 5V strip. A short enable-control crossover
uses In1.Cu; the surrounding ground remains connected. No part, connector, footprint, net or prior track/via moved.
Native continuity checked every output and the earlier USB, power, processor, Ethernet and IR circuits; copper layers
and the actual KiCad 3D render were reviewed. This slice reduced unrouted items from 208 to 188 with no new DRC finding.

U14/U15 are now **SN74AHCT541PWR one-way buffers**, not bidirectional AHCT245 transceivers. Their 20-pin TSSOP footprint
and all data/output pin positions are unchanged; pin 1 is now grounded OE1 rather than a 5V direction input. R74-R86 are
thirteen 10k, 1% input-to-ground pulls. These keep every used buffer input defined while the ESP32 is in reset; U15's
three unused inputs remain grounded and its unused outputs remain NC. R34 still pulls OE2 high, Q1/R33 disable the
buffers by default, and R35 pulls panel OE high. This follows the
[TI pinout, control table and input guidance, pages 3-8](https://www.ti.com/lit/ds/symlink/sn74ahct541.pdf). Each high
3.3V signal draws about 0.33mA through its pull; this is on the PD-only application branch, not the laptop acquisition
budget. No new processor, power rail or interface was added.

The thirteen resistors sit beside the buffers. The still-unwired BZ1/Q2/R36/R37 sound group moved into the free
lower-right area to provide assembly clearance. Six obsolete DIR-feed track segments were removed and one shared supply
stub shortened; all other 772 prior tracks/vias, external connectors, processors and keepouts are unchanged. Native
ERC/parity, all bias/output/prior-circuit continuity checks, and copper/schematic/3D review passed, with no new DRC
finding. Unrouted count remains 188 because this change resolves input defaults, not the processor bus.

The ESP32 display bus is now routed: module pads 4-12 and 17-20 reach all thirteen buffer inputs and their pull-downs;
pad 23 reaches Q1's DISPLAY_ENABLE gate and R33. Top/back routes use inner-layer crossovers outside the power pours; no
signal trace was added to the In1.Cu ground layer. All 832 previous tracks/vias, parts, connectors and keepouts stayed
fixed. Native continuity of the complete input/buffer-output wiring and earlier circuits passed; copper and native 3D
views were inspected. This reduced unrouted items from 188 to 174 without a new ERC, parity or DRC finding.

**Display bring-up:** configure all display signals with RGB_OE high before asserting DISPLAY_ENABLE; deassert
DISPLAY_ENABLE before releasing GPIOs. The input routes are not delay-matched or timing-qualified. That firmware
sequence, startup and brownout blanking, display timing and cable signal integrity still require implementation and
physical verification. Next board routing: sensing connections.

The sounder is routed from STM32 pad 42 through R36 to Q2, with R37 holding the gate low during reset. BZ1 remains the
PS1240P02BT on CORE_3V3. R87 adds the missing 1k parallel discharge path from BUZZER_LOW to CORE_3V3, following
[TDK's operating-circuit guidance, page 2](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/sw_piezo/piezo-buzzer/catalog/piezoelectronic_buzzer_ps_en.pdf).
C35 provides 100nF local supply bypass, and ground extends beneath the sounder without entering the Favero output
region. All 1126 prior tracks/vias and existing component positions stayed fixed. Native continuity, ERC/parity, copper,
schematic and 3D review passed; unrouted items dropped from 174 to 167 with no new DRC finding. Drive with 4kHz PWM,
then stop low; holding the gate high is not a tone. R87 draws about 3.3mA while Q2 is on, plus the piezo's transient
charging current. Keep sound disabled in laptop acquisition mode. Output amplitude, acoustic level, supply disturbance
and scoring-timing interaction still need bench checks; the wiring is not an acoustic or FIE qualification.

Both Favero circuits are routed after correcting the draft against the
[FA-05/FA-07 interface drawing, page 2, mirrored by Super Fencing System](https://superfencingsystem.com/Favero_Serial.pdf):
each socket's outer contacts 2+5 join through its 82-ohm resistor to the collector; centre contacts 3+4 join the
emitter. The 680k resistor belongs between base and emitter, not between base and an outer contact. The 1N4004 cathode
connects to collector and anode to emitter. The two repeater-supplied loops have no connection to one another or board
ground. The same earlier wiring error remains in the separate, unchanged tscircuit prototype; do not manufacture that
older repeater circuit without correcting it too.

STM32 pad 14 drives Q3 and its 100k reset pull-down. The two 220-ohm optocoupler input resistors now use PANEL_5V,
making the LED drive PD-only in hardware. Their current does not consume the laptop acquisition allocation. The twelve
existing support parts moved into two local groups, with output pins facing the sockets and input pins facing the
controller. No parts were added; socket bodies, holes, models and all 1194 previous tracks/vias stayed fixed. Native
continuity confirms all contact pairs, protection/bias paths, the common driver and prior circuits. ERC/parity are
clean; DRC is down from 167 to 141 unrouted items with no new finding. Copper, schematic and native 3D views were
reviewed. The optocoupler's specified transfer ratio does not guarantee saturation or release time at our actual loop
conditions; 2400-baud waveform/polarity, two real repeaters, cable length and isolation withstand still require bench
verification. The old prototype's behavioral simulation is not verification of this corrected native circuit.

The acquisition buffers U8/U9 now have CORE_3V3 and ground, with C19/C20 beside their supply pins. All seven 10k
output-enable pull-ups and seven 10k input pull-downs are connected to their buffer pins and local rails. U8's unused
fourth channel has its enable high, input low and output NC, matching the
[Nexperia pinout and control table, pages 3-4](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf). The two
capacitors and fourteen resistors moved; no chip, connector, model, net, part value or earlier track/via changed. The
board-side ground extends beneath this section. A short front-layer supply crossover joins the CORE_3V3 pour across the
retained isolated-5V feeder; continuity review caught and corrected that initially split pour. Native checks passed all
770 earlier pad-connectivity comparisons and the new supply/default connections, with all 1696 earlier tracks/vias
intact and 190 added. ERC/parity are clean; unrouted items fell from 141 to 103 with only the same four J1 findings.
Copper layers and native top/underside 3D renders were reviewed. MCU control routes, conductor paths, startup behavior,
scan timing and physical protection remain unfinished; this wiring is not a passed sensing system.

The following controller-routing slice connects all seven STM32 drive outputs and seven active-low enables to their
matching buffer input/enable and pull resistor. All fourteen three-pad control nets pass native copper continuity, along
with 770 retained-pad comparisons; all 1886 prior tracks/vias, component positions, models and isolation barriers remain
unchanged. The 288 added track/via items use only front/back signal traces, with no signal routed through the
crystal/load-capacitor region or on either inner plane. Copper layers and the native 3D render were reviewed. ERC and
parity remain clean; unrouted items fell from 103 to 89 with only the four existing J1 findings. Configure all enables
high and drive data low before starting acquisition. This routing does not implement firmware, prove edge timing, or
close the unpowered clamp issue; conductor/sense connections remain unfinished.

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
establish placement/connectivity consistency, not fabrication approval. The display-buffer replacement preserves its
footprint and signal positions; pin 1 changes from the old 5V direction input to a grounded output-enable input.

All seven models' acceptance limits pass, including the corrected seven-input settled leakage stress; this remains
bounded simulation, not a passed physical operating corner. The five older models concern the original prototype only.
The enlarged branding passed native KiCad rendering and silkscreen Gerber export. The USB protection update changed U3's
protector/land pattern, its local USB traces and C1's voltage rating. U3 has no VBUS connection. The following
processor-link, IR, Ethernet, HUB75, sounder and Favero routing is retained. The local buck, PD-control and eFuse
circuits and the primary corridor complete the shared-input routing. Acquisition-buffer power and reset defaults are
also connected, together with their fourteen STM32 control lines. The current unconnected count is 89. Schematic, copper
and native 3D renders were reviewed; ERC is clean, and DRC retains four USB connector hole-clearance findings and zero
schematic-parity issues. The latest repository verification passed formatting, lint, types and unused-code checks but
failed three scoring tests: a mutation timeout, a canonical-corpus failure and a 29-versus-28 scenario-count assertion
(770 scoring tests passed). The run stopped before every other package completed. These tests are outside the board
edits; none was suppressed or modified. Physical USB signal, surge and ESD testing remain required; native connectivity
and the protector's component ratings do not establish board-level immunity.

Reference component data: [STM32G474](https://www.st.com/resource/en/datasheet/stm32g474re.pdf),
[Nexperia 74LVC125A](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf),
[BAT54S](https://assets.nexperia.com/documents/data-sheet/BAT54S.pdf),
[SN74AXC1T45](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf),
[AP63203](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), and
[XAL5030-472](https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xal/xal5030-472/).
