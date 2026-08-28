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
| Build the minimal carrier and fabrication files | done | Commits `27d23bd`, `c5ea82a`, `a6a9f72`, and `90a1f8a` are the current root-reviewed board baseline: 39 placed components, 135 declared and routed connections, zero unresolved connections, and zero routing/DRC errors. Root reviewed every unique CAD family against its footprint and courtyard. The ESP32 carrier now sits above its mating sockets without a body collision and presents its programming USB connector at the lower board edge; the IR receiver faces from the upper edge. No unintended component-body overlaps remain. Green solder mask and white silkscreen are explicit in the source, while the physical pigment remains a fabrication-order selection. The obsolete on-board lamps remain absent and HUB75 is the sole local scoring display. RunFrame uses local STEP bodies. Focused build, tests, types, lint, unused-code analysis, formatting, simulation, and browser review passed. |
| Add USB-C power | done | Commits `381df31` and `842faab` provide an Adafruit 5807 HUSB238 breakout fixed at 20 V. Its VOUT and GND pads route directly through the carrier to the socketed Pololu D36V50F5 regulator, and the daughterboard now sits flush on those plated carrier holes instead of floating above them. The terminal block is DNP and there are no power jumpers for the fabricator to install. Root review, routed build, package tests, types, lint, unused-code check, and browser 3D inspection passed. |
| Add sound | done | Commits `60238b1` and `a23ca22` provide the TDK PS1240P02BT 4 kHz piezo sounder on the 3.3 V rail through a GPIO48 low-side switch. The exact KiCad STEP model and manufacturer footprint are included. |
| Add two repeater-light interfaces | done | Commits `381df31`, `8353782`, and `0ff3fa0` provide two independent FA-05 DATA-LINE outputs. Each TE 5520250-2 right-angle 6P4C RJ14 socket has its own isolated output circuit. Root review corrected the CAD models from an upside-down transform: both jacks are now upright, their openings overhang the rear board edge, their housing tops are exactly 16.13 mm above the PCB per TE drawing 5520250 D3, and only the contact tails and board locks extend below it. Ngspice then found that the original 330 ohm optocoupler input supplied only 4.3 mA, below the 10 mA condition for the 4N32M guaranteed transfer ratio. Both channels now use 82 ohm inputs, producing 12.4 mA modeled LED current, 24.9 mA loop current, and 64.72 microsecond release. Physical validation with an actual FA-05 repeater remains part of bring-up, not a PCB dependency. |
| Match the OpenPiste conductor topology | done | Commit `a23ca22` connects each of the seven conductors to one bidirectional ESP32 GPIO through one series resistor: 33 ohms for left/right A and 470 ohms for left/right B, left/right C, and piste. The five duplicate sense resistors and their nets are removed. |
| Add the 64x32 HUB75 display interface | done | Commit `a23ca22` adds one Samtec TST-108-02-G-D keyed 2x8 data header and one Würth 645004114822 four-pin 5 V power header for a 64x32, 1/16-scan RGB panel. All 13 HUB75 signals and all data/power grounds are routed. The active ESP32-S3-DevKitC-1-N8R8 replaces the obsolete N8R2; the carrier reserves its GPIO35 through GPIO37 octal-PSRAM pins and moves the Ethernet signals formerly using them to GPIO20, GPIO47, and GPIO39. Direct 3.3 V HUB75 signaling remains a bring-up measurement rather than adding an unproven level shifter now. |
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
