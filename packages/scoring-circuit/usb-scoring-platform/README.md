# USB scoring platform

Separate native KiCad engineering draft. The existing ESP32 prototype, browser preview, and fabrication files are
unchanged. Open `usb-scoring-platform.kicad_pro` in KiCad 10. The schematic and PCB files are editable source; no
generator is needed to maintain this project. Project-local footprints reference the existing package's retained STEP
models without changing or duplicating them in Git. Their sources and license notes are in
[CAD model sources](../assets/cad/SOURCES.md). Native library parts require the installed KiCad footprint and 3D
libraries.

**Not ready for fabrication, sale, or connection to fencers.** The schematic is a candidate circuit and the PCB is an
unrouted floorplan, not a completed design. This folder is not consumed by the existing prototype export commands.

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
- **USB power limits:** the module can supply up to 200mA at 5V from a 4.4-5.5V bus, not enough for the ESP32, Ethernet,
  and HUB75 stack. Keep those on PD. Follow the manufacturer's less-than-25mA isolated-load guidance before enumeration
  to stay within 100mA host input: low-power MCU startup, excitation disabled, sound and Favero outputs off. A USB
  configuration requests up to 500mA host current; retain output-current headroom after configuration. Measure startup,
  configured load, suspend current, and USB/PD handover before use. This is a firmware and bench requirement, not an
  already-proven power budget or USB compliance claim. Never apply the 20V PD rail to LTM2884.
- U18 uses the manufacturer's 44-ball, 15 x 15mm BGA land pattern with 1.27mm pitch and 0.63mm copper lands. The custom
  footprint follows the
  [05-08-1881 Rev B package drawing](https://mds.analog.com/api/public/content/BGA_44_05-08-1881_Rev_B.pdf), including
  top-view A1 orientation. Its manufacturer STEP model has not been obtained; the 3D view deliberately has no invented
  placeholder body for this part. Footprint and reflow-process review remain necessary for assembly.
- J1 uses GCT USB4105-GF-A for computer USB: a documented 16-contact USB 2.0 receptacle with a matching native KiCad
  footprint and STEP model. It replaces the initial HRO candidate in this new design only. See the
  [manufacturer drawing](https://gct.co/files/drawings/usb4105.pdf).
- Retain Adafruit 5807 fixed-20V PD and Pololu D36V50F5 modules initially. Use AP63203 with a Coilcraft XAL5030-472MEC
  inductor for application 3.3V. Module substitutions remain possible if footprint, power, cost, and availability
  justify them; this is not a locked procurement BOM.
- J3/J4 are three-wire harness landings for off-board female banana sockets, not banana receptacles themselves. J5 is
  the metal-piste reference connection, not protective earth. The user's compatible Ok Fencing cable remains unchanged.
  Viewed from the component side with computer USB/Ethernet along the bottom edge, J3 is on the left and J4 on the
  right, 150mm apart. J5 is on the bottom edge. The enclosure's banana sockets must follow this same left/right
  arrangement with room to grip both plugs; do not group the two fencer sockets together. Silkscreen identifies LEFT,
  RIGHT and PISTE. This placement does not change A/B/C pin assignments or establish the off-board socket spacing.

## Sensing checkpoint

Each conductor now uses the existing 330-ohm excitation resistor, a 3.3k series sense resistor, and a 3.3k sense
pull-down, all 1%. This replaces the weak 1-megohm pull-down and produces approximately half the conductor voltage at
the MCU. Excitation input pull-downs and output-enable pull-ups are now 10k, keeping the buffers disabled during reset
even with their specified input leakage. No components were added and no footprint positions changed.

The seven comparator positive inputs are already correctly assigned: COMP1/2/3/4/5/6/7 use
PA1/PA3/PA0/PB0/PB13/PB11/PB14 respectively, for LEFT_A/LEFT_B/LEFT_C/RIGHT_A/RIGHT_B/RIGHT_C/PISTE. The continuity
candidate uses internal VREFINT/2 and the lowest nonzero hysteresis setting (HYST=1). Allow 200us reference-scaler
startup plus 5us comparator startup before accepting observations. A conservative threshold envelope is 0.556-0.651V,
including reference variation, scaler offset, comparator offset and hysteresis from DS12288 Rev 6, tables 20 and 79.

Run `pnpm --filter @repo/scoring-circuit simulate`. The [pair/reset model](../simulation/stm32-sensing-interface.cir)
checks:

- Disconnected input: 0.403V with a chosen 121uA leakage stress, below the 0.556V low boundary.
- 500-ohm contact: 0.714V with weak 2.25V excitation, resistor tolerance and opposing leakage stress, above 0.651V.
- Opposed board outputs: 5.51mA; reset enable/input levels: 2.798V and 0.202V.
- Chosen 10nF cable load: active-low discharge crossed the low boundary after 6.23us. Passive contact release left a
  **66.29us tail**, so observation blanking and deliberate discharge must be included in scan timing.

The [seven-conductor model](../simulation/stm32-conductor-scan.cir) adds foil rest/target/off-target/piste paths, both
epee tip contacts, tip-plus-piste, sabre target/blade/reciprocal contacts, and a seven-way short. It clears all seven
conductors low, disables all outputs, then sources exactly one conductor while the others remain high impedance. The
next slot repeats the clear before selecting another source. Nominal cases pass the comparator envelope, including
unrelated lines after source handover. The seven-way short passes with each of the seven sources selected; peak modeled
source current is 10.00mA. A separate 2.25V source/tolerance case with a chosen 4uA load per input reads 0.762V at the
observation point and clears below 0.387V. These are modeled results, not bench measurements.

**The leakage stress exposes insufficient margin:** applying the previous 121uA-per-input load to all seven shorted
inputs gives only **0.572V even after settling**, inside the 0.556-0.651V uncertainty band. The runner labels this
`OBSERVE`, not `PASS`; the single-pair result is not a seven-channel worst-case guarantee. Separately, the model's 50us
slots take 350us per sweep and can miss contacts between observations. That characterization schedule is **not approved
scoring firmware timing**. Qualification of pulse-duration boundaries requires the actual acquisition/capture algorithm,
not just settled voltages or an assumption that every short pulse must produce a hit.

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

Leakage and capacitance are chosen stresses, not guaranteed worst cases or FIE evidence. BAT54S hot-leakage curves are
typical, not maximum ratings. Neither model proves external-overvoltage clamps, unpowered rail injection, exhaustive
contact combinations, accurate resistance diagnostics, or capture timing. The smaller sense resistor increases
external-fault injection relative to the former 10k part; that protection review remains open. Do not treat continuity
as a 450/475-ohm diagnostic or the passive-release tail as acceptable scoring error. No new parts were added for this
simulation checkpoint, and the PCB remains unrouted.

## Current state and remaining work

The current draft contains 151 components across eleven functional/support sheets plus the cover. Every component has a
footprint, and all 160 schematic nets were transferred to the initial 160 x 100mm, four-layer PCB. Most components are
passive support, clamps, decoupling, and defined reset-state resistors; their physical arrangement is still provisional.

Before routing and fabrication:

1. Finish the sensing design: resolve the seven-input leakage margin and establish a sampling/excitation schedule that
   preserves the required contact-duration boundaries. Basic simultaneous-contact paths now have electrical fixtures,
   but full weapon behavior and capture timing are unproven. The 330-ohm excitation resistors, 3.3k sense dividers and
   BAT54S clamps remain candidates. Check clamp-rail injection and unpowered faults. Do not infer patent clearance from
   component selection or this topology.
2. Validate single-cable USB acquisition power, startup/current/suspend behavior, supply handover, and the electrical-
   safety boundary for USB, PD, Ethernet, piste, and weapon conductors. The integrated isolator and all-layer copper
   keepouts separate computer ground from board ground; acquisition and application still share board ground. The
   keepout spans the gap between the module's primary and secondary ball rows. This is not complete board safety proof.
3. Finish local placement, decoupling, connector access, mounting, antenna clearance, and power/current paths. Review
   every retained footprint and 3D transform against its exact part drawing. Resolve the ESP32 footprint's 0.2mm thermal
   drills versus the current 0.3mm board rule with the intended fabrication process; do not merely suppress the warning.
4. Route the board, define stackup/net classes, run schematic-to-PCB parity and DRC, inspect 3D and manufacturing
   outputs, and then perform hardware bring-up. No routing, purchase, or assembly release has been performed.

## Checks performed

The latest native KiCad 10.0.6 checks reported zero ERC violations and zero schematic-to-PCB parity mismatches. Netlist
export and connected-pin transfer checks succeeded. DRC still reports **449 unrouted items** and **25 other findings**:
12 ESP32 thermal-drill size errors, four USB connector hole-clearance errors, and nine silkscreen warnings. The USB
connector's 0.1944mm pad-to-hole clearance is below the default 0.25mm rule and needs fabricator review. None is waived.
Module symbols use passive pins where detailed electrical pin types are unavailable, limiting ERC's fault detection.

KiCad loaded the current schematic/PCB and rendered the assembly. Native 3D cable-side and underside views confirmed
Favero openings toward the top edge and Ethernet toward the bottom; measured CAD tail/board-lock centres match their
holes. Left/right harnesses are separated and piste is on the bottom edge. No footprint bounding boxes collide, but
enclosure cutouts, real plug/latch access, complete pin seating and electrical design still need review. These checks
establish placement/connectivity consistency, not fabrication approval. The scan-model update does not change CAD.

Focused electrical simulation, package type-check and runner lint pass. All seven models' acceptance limits pass; the
seven-input leakage result remains an observation with insufficient threshold margin, not a passed operating corner. The
five older models concern the original prototype only. The latest repository verification passed formatting, lint, types
and unused-code checks but failed three unchanged scoring tests: a mutation-test timeout and canonical-corpus failure in
`scenario-runner.test.ts`, plus a 29-versus-28 scenario-count assertion in `observatory-integration.test.ts` (770
passes, three failures). No failures are suppressed or repaired by the hardware work.

Reference component data: [STM32G474](https://www.st.com/resource/en/datasheet/stm32g474re.pdf),
[SN74LVC125A](https://www.ti.com/lit/ds/symlink/sn74lvc125a.pdf),
[BAT54S](https://assets.nexperia.com/documents/data-sheet/BAT54S.pdf),
[SN74AXC1T45](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf),
[AP63203](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), and
[XAL5030-472](https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xal/xal5030-472/).
