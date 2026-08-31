# ESP32 scoring prototype work

## Goal

Order a deliberately simple ESP32-S3 scoring board that unlocks firmware development. The board is a hand-built
prototype, not a production design.

The retired 164-component carrier is not the implementation baseline. Its generated PCB, routing, BOM, and placement
outputs must not be advanced or ordered. Useful verified knowledge may be reused selectively in the replacement.

## Working rules

- The root agent performs all work; do not delegate prototype tasks to subagents.
- Start from a blank schematic and add only hardware required by
  [Minimal ESP32 scoring prototype](./clean-sheet-board-architecture.md).
- Do not route until every active IC and connector has a concrete prototype justification.
- Prefer modules, headers, solder pads, jumpers, and off-board power assemblies.
- Do not create validators, evidence packages, qualification artifacts, or production processes.
- Keep `Latest state` accurate whenever work is reviewed or committed.
- `done` requires implementation, focused verification, root review, and a commit.

## Remaining work

| Deliverable | Status | Latest state |
| --- | --- | --- |
| Build the minimal carrier and fabrication files | done | Root re-audited all 39 placed bodies individually against their actual footprints and retained STEP datums. The pass corrected the ESP32 pin-row midpoint by 3.3005 mm, the WIZ850io pin-row midpoint by 6.10 mm, the HUB75 power-header row by 3.625 mm, the IR receiver from its body-edge datum to its lead-row datum, and all three Pololu regulator mounting holes. The external-connector review rotated the complete WIZ850io and both Favero assemblies 180 degrees at the PCB-footprint level. A follow-up underside review found that the Favero contact rows and board-lock holes were mirrored; the current footprint now matches TE drawing 5520250 D3, anchors the retained STEP at the contact-row midpoint, and places the mating faces at the rear board edge. Rebuilt top, edge, and underside views confirm that every body is on the top side, every intended through-hole lead and board lock enters its matching hole, daughterboards sit above the carrier, and external connector openings face outward without overlap. The routed board remains 135/135 with zero unresolved connections and zero routing/DRC errors. Package tests, types, lint, unused-code analysis, formatting, five ngspice models, and live browser review pass. |
| Add USB-C power | done | Commits `381df31` and `842faab` provide an Adafruit 5807 HUSB238 breakout fixed at 20 V. Its VOUT and GND pads route directly through the carrier to the socketed Pololu D36V50F5 regulator, and the daughterboard sits flush on those plated carrier holes. The latest geometry audit aligns the regulator's three 21.082 mm-spaced mounting holes and asymmetric 25.4 mm module outline to the official module datum. The terminal block is DNP and there are no power jumpers for the fabricator to install. |
| Add sound | done | Commits `60238b1` and `a23ca22` provide the TDK PS1240P02BT 4 kHz piezo sounder on the 3.3 V rail through a GPIO48 low-side switch. The latest geometry audit confirms the two 5 mm-spaced leads enter their carrier holes, the body is above the PCB, and only the leads extend below it. |
| Add two repeater-light interfaces | done | Commits `381df31`, `8353782`, and `0ff3fa0` provide two independent FA-05 DATA-LINE outputs. Each TE 5520250-2 right-angle 6P4C RJ14 socket has its own isolated output circuit. Root review corrected the CAD models from an upside-down transform and rotated the complete footprints so both openings face outward. The final drawing-based correction uses 1.27 mm contact pitch, 2.54 mm staggered contact rows, 0.89 mm terminal drills, two 3.25 mm board-lock holes spaced 10.16 mm apart, and a 7.62 mm lock-to-contact-row midpoint. The retained STEP is anchored to the same datum, the mating face is flush with the rear board edge, and live underside views show all four populated contact tails and both board locks entering their holes on each jack. Both jacks are upright, their housing tops are exactly 16.13 mm above the PCB per TE drawing 5520250 D3, and neither overlaps its support circuit. Ngspice found that the original 330 ohm optocoupler input supplied only 4.3 mA, below the 10 mA condition for the 4N32M guaranteed transfer ratio. Both channels now use 82 ohm inputs, producing 12.4 mA modeled LED current, 24.9 mA loop current, and 64.72 microsecond release. Physical validation with an actual FA-05 repeater remains part of bring-up, not a PCB dependency. |
| Match the OpenPiste conductor topology | done | Commit `a23ca22` connects each of the seven conductors to one bidirectional ESP32 GPIO through one series resistor: 33 ohms for left/right A and 470 ohms for left/right B, left/right C, and piste. The five duplicate sense resistors and their nets are removed. |
| Add the 64x32 HUB75 display interface | done | Commit `a23ca22` adds one Samtec TST-108-02-G-D keyed 2x8 data header and one Würth 645004114822 four-pin 5 V power header for a 64x32, 1/16-scan RGB panel. All 13 HUB75 signals and all data/power grounds are routed. The latest geometry audit confirms all 16 data pins and all four power pins enter their matching holes, both bodies are upright, and their courtyards and bodies do not overlap. The active N8R8 controller reserves GPIO35 through GPIO37 and uses GPIO20, GPIO47, and GPIO39 for Ethernet. Direct 3.3 V HUB75 signaling remains a bring-up measurement. |
| Validate carrier electronics | done | Commit `0ff3fa0` established five ngspice models for the scoring conductors, combined 5 V and 4.2 A HUB75 load, IR filter, sounder driver, and FA-05 transmitter. The current gate enforces 27 limits, including FIE 500 ohm external continuity, 100 ohm earth continuity, and 0/450/475 ohm insulation-fault current stress. Routed fabrication export now runs the complete tscircuit placement, netlist, pin, and routing checks and rejects new warnings outside the reviewed component metadata set. Circuit tests reject any direct application net on the connector side of either FA-05 optocoupler. All focused limits and checks pass; the generated board remains 135/135 routed with zero unresolved or DRC errors. Firmware classification at FIE boundaries, purchased-module internals, the final HUB75 panel profile, isolation resistance, dielectric withstand, UPS transfer, EMC, ESD, thermal behavior, and physical FA-05 operation remain bring-up or SEMI evidence rather than invented simulation claims. |
| Order and assemble the board | active | The order BOM now includes all 39 populated parts across 24 line items, quantity-one USD estimates, extended prices, a 2026-08-27 check date, and source links. The estimated populated-component total is $104.14 before PCB fabrication, assembly, shipping, tax, and off-board equipment. The active N8R8 controller and in-stock active 10 V bulk capacitor replace obsolete selections; Ethernet was rerouted away from the N8R8 module's reserved GPIO35 through GPIO37 pins. The board remains 135/135 routed with zero unresolved connections and zero routing/DRC errors. Before ordering the complete system, select the exact HUB75 panel and matching power budget, USB-C PD supply, off-board Ok Fencing socket harnesses, and display/repeater cables. |
| Bind firmware to the ordered board | waiting | After the final pinout is fixed, connect the portable C17 scoring core to the real ESP32 acquisition and interface adapters. Avoid firmware for hypothetical hardware. |
| Bring up scoring behavior | waiting | Verify rails and programming, then Ethernet, IR, display, outputs, and all seven conductors. Exercise foil, epee, and sabre timing and resistance behavior and record only faults that require a board or firmware revision. |

## Fixed decisions

- One ESP32-S3 runs the prototype and portable C17 scoring core; there is no STM32 on this board.
- WIZ850io supplies Ethernet.
- USB-C PD is the normal input through an Adafruit 5807 module fixed at 20 V and a Pololu D36V50F5 5 V regulator mounted
  on the prototype carrier. The modules solder directly to the carrier without loose power wires.
- Ok Fencing weapon cables are already accepted; the prototype uses direct solder pads or simple board-side connections.
- The seven conductor circuits follow the OpenPiste board topology: one bidirectional GPIO and one series resistor per
  conductor.
- The display is one 64x32, 1/16-scan HUB75 RGB panel with separate data and 5 V power connectors.
- Firmware follows the ordered hardware, except for continued development of the hardware-independent scoring logic.
