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
| Replace the oversized carrier | done | Commit `2cc4dea` completes the root-reviewed replacement schematic with 32 electrically connected parts and 97 declared connections. It uses the official 22.86 mm DevKitC socket spacing, seven current-limited conductor drivers, five series-protected direct ADC sense paths, WIZ850io, TSOP38438, one-wire WS2812 display, one buzzer transistor, and minimal power/Ethernet passives. Two focused test files with six tests, package typecheck, lint, formatting, preview build, and visual schematic/placement review passed. |
| Produce the prototype PCB | done | Commits `510a4ce`, `d97d347`, and `555d704` route all 97 declared connections on the two-layer board and export the editable KiCad project, BOM, placement list, both copper layers, masks, paste, silkscreen, board outline, plated drills, and four non-plated mounting holes. The assembly model counts the socketed DevKitC body as the 33rd populated part. The routed board has 66 physical trace segments, a bottom ground pour, zero unresolved nets, and zero routing/DRC errors. The browser preview displays routed copper and assembly envelopes for the DevKitC, WIZ850io, and IR receiver. |
| Add USB-C power | done | Commits `381df31` and `842faab` provide an Adafruit 5807 HUSB238 breakout fixed at 20 V. Its VOUT and GND pads route directly through the carrier to the socketed Pololu D36V50F5 regulator, and the daughterboard now sits flush on those plated carrier holes instead of floating above them. The terminal block is DNP and there are no power jumpers for the fabricator to install. Root review, routed build, package tests, types, lint, unused-code check, and browser 3D inspection passed. |
| Add scoring lights | done | Commit `381df31` provides the required four local indicators: Kingbright WP7113ID left red, WP7113QWC/D left white, WP7113GD right green, and WP7113QWC/D right white. Red and green use direct 3.3 V GPIO drive through 330 ohm resistors; the two white lamps use the 5 V rail with separate BSS138 low-side switches and 100 kohm gate pulldowns. Exact WP7113 geometry and color-correct previews are committed. The package tests, types, lint, formatting, routed build, PCB/3D review, and browser review passed. |
| Add sound | done | Commit `60238b1` replaces the two-pin placeholder with a TDK PS1240P02BT 4 kHz piezo sounder on the 3.3 V rail, retaining the existing GPIO39 low-side MOSFET drive. The exact KiCad STEP model and manufacturer footprint dimensions are used. Two focused test files with 11 tests, package typecheck, lint, formatting, routed build, KiCad/manufacturing export, and browser 3D inspection passed. The board routes all 110 connections with no unresolved or DRC errors. Full-repository verification reached tests but remains blocked only by the unrelated `@repo/shopify-emails` coverage thresholds. |
| Add two repeater-light interfaces | done | Commits `381df31` and `842faab` provide two independent FA-05 DATA-LINE outputs. Each TE 5520250-2 right-angle 6P4C RJ14 socket has its own isolated output circuit. Both housings now sit on the component-side seating plane while only their contacts and board locks pass through the carrier. Root review, routed build, package tests, types, lint, unused-code check, and browser 3D inspection passed. Physical validation with an actual FA-05 repeater remains part of bring-up, not a PCB dependency. |
| Order and assemble the board | active | Commits `381df31`, `36f90a1`, and `842faab` leave a 58-component, two-layer prototype with all requested interfaces: seven scoring conductors, Ethernet, encrypted IR, WS2812 display, direct-solder USB-C PD power, four scoring lamps, sound, and two FA-05 DATA-LINE outputs. The complete DevKitC carrier is aligned to both 22-pin sockets, the USB-C daughterboard is seated on its plated power pads, and both TE 5520250-2 repeater bodies are seated on the component side with only their leads and board locks through the PCB. All 58 placed components have rendered CAD bodies; 52 have explicit manufacturer numbers, while the remaining six are standard DevKitC sockets and direct-wire/display headers. All 145 electrical connections are routed with zero unresolved nets and zero routing/DRC errors. Root review, package tests, types, lint, formatting, routed build, KiCad/manufacturing export, and browser 3D inspection passed. Remaining work is order-package inspection, procurement, assembly, and electrical bring-up. |
| Bind firmware to the ordered board | waiting | After the final pinout is fixed, connect the portable C17 scoring core to the real ESP32 acquisition and interface adapters. Avoid firmware for hypothetical hardware. |
| Bring up scoring behavior | waiting | Verify rails and programming, then Ethernet, IR, display, outputs, and all seven conductors. Exercise foil, epee, and sabre timing and resistance behavior and record only faults that require a board or firmware revision. |

## Fixed decisions

- One ESP32-S3 runs the prototype and portable C17 scoring core; there is no STM32 on this board.
- WIZ850io supplies Ethernet.
- USB-C PD is the normal input through an Adafruit 5807 module fixed at 20 V and a Pololu D36V50F5 5 V regulator mounted
  on the prototype carrier. The modules solder directly to the carrier without loose power wires.
- Ok Fencing weapon cables are already accepted; the prototype uses direct solder pads or simple board-side connections.
- Firmware follows the ordered hardware, except for continued development of the hardware-independent scoring logic.
