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
| Build the minimal carrier and fabrication files | done | Commit `a23ca22` is the current root-reviewed board baseline: 51 placed components, 157 declared and routed connections, zero unresolved connections, and zero routing/DRC errors. The editable KiCad project, BOM, placement file, Gerbers, drills, browser schematic, routed PCB, and 51-component 3D assembly are current. |
| Add USB-C power | done | Commits `381df31` and `842faab` provide an Adafruit 5807 HUSB238 breakout fixed at 20 V. Its VOUT and GND pads route directly through the carrier to the socketed Pololu D36V50F5 regulator, and the daughterboard now sits flush on those plated carrier holes instead of floating above them. The terminal block is DNP and there are no power jumpers for the fabricator to install. Root review, routed build, package tests, types, lint, unused-code check, and browser 3D inspection passed. |
| Add scoring lights | done | Commits `381df31` and `a23ca22` provide left red and white plus right green and white 5 mm indicators on dedicated GPIOs. Red and green use direct 3.3 V drive through 330 ohm resistors; each white lamp uses the 5 V rail and a BSS138 low-side switch. Exact lamp geometry and color-correct previews are committed. |
| Add sound | done | Commits `60238b1` and `a23ca22` provide the TDK PS1240P02BT 4 kHz piezo sounder on the 3.3 V rail through a GPIO48 low-side switch. The exact KiCad STEP model and manufacturer footprint are included. |
| Add two repeater-light interfaces | done | Commits `381df31` and `8353782` provide two independent FA-05 DATA-LINE outputs. Each TE 5520250-2 right-angle 6P4C RJ14 socket has its own isolated output circuit. Root review corrected the CAD models from an upside-down transform: both jacks are now upright, their openings overhang the rear board edge, their housing tops are exactly 16.13 mm above the PCB per TE drawing 5520250 D3, and only the contact tails and board locks extend below it. The routed build has zero unresolved or DRC errors; 12 focused tests, types, lint, formatting, unused-code analysis, measured GLB geometry, and multiple low-angle browser views passed. Physical validation with an actual FA-05 repeater remains part of bring-up, not a PCB dependency. |
| Match the OpenPiste conductor topology | done | Commit `a23ca22` connects each of the seven conductors to one bidirectional ESP32 GPIO through one series resistor: 33 ohms for left/right A and 470 ohms for left/right B, left/right C, and piste. The five duplicate sense resistors and their nets are removed. |
| Add the 64x32 HUB75 display interface | done | Commit `a23ca22` adds one Samtec TST-108-02-G-D keyed 2x8 data header and one Würth 645004114822 four-pin 5 V power header for a 64x32, 1/16-scan RGB panel. All 13 HUB75 signals and all data/power grounds are routed. The ESP32-S3-DevKitC-1-N8R2 frees GPIO35 through GPIO37 for the completed pin map. Focused tests, types, lint, formatting, unused-code analysis, fabrication export, exact CAD inspection, and browser review passed. Direct 3.3 V HUB75 signaling remains a bring-up measurement rather than adding an unproven level shifter now. |
| Order and assemble the board | active | Commit `a23ca22` leaves the current 51-component two-layer prototype ready for order preparation with Ethernet, encrypted IR, 64x32 HUB75 data and power, USB-C PD power, four local scoring lamps, sound, two FA-05 DATA-LINE outputs, and the seven OpenPiste-style conductors. All 157 electrical connections are routed with zero unresolved connections and zero routing/DRC errors, and all 51 placed components have rendered CAD bodies. Remaining work is procurement, assembly, and electrical bring-up. |
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
