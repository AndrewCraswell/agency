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
| Add USB-C power | done | Commit `8deff2e` adds an in-stock Adafruit 5991 HUSB238 USB-C PD module set to 20 V and a socketed Pololu D36V50F5 5 V regulator. Exact vendor STEP models, mounting holes, regulator header geometry, 1 mm power routes, labeled 18 AWG short-wire landings, editable KiCad files, and fabrication exports are committed. All 104 connections route with zero unresolved nets and zero routing/DRC errors. Nine focused tests, package type-check, lint, formatting, root PCB/3D inspection, and desktop/mobile browser acceptance passed. The repository verification reached only the unrelated `@repo/shopify-emails` coverage-threshold failure. |
| Add red and green scoring lights | active | The root-reviewed implementation adds one Kingbright WP7113ID red LED on GPIO42 and one WP7113GD green LED on GPIO41, each with a 330 ohm resistor and the exact manufacturer WP7113 STEP geometry. All 110 connections route with zero unresolved nets and zero routing/DRC errors, and visual review caught and corrected the manufacturer model's board-normal axis. Focused verification, export reconciliation, and commit remain. |
| Add sound | waiting | Start after the scoring lights are committed. Retain a single transistor-driven sounder path. |
| Add two repeater-light interfaces | waiting | Start after sound is committed. Confirm whether the requested repeaters are wired lamp outputs or Ethernet subscribers before adding hardware; one existing Ethernet port already supports multiple network subscribers through a switch. |
| Order and assemble the board | active | The current working board has 38 modeled source components, including the exact Adafruit USB-C PD, Pololu regulator, and Kingbright LED assemblies. Exact manufacturer STEP geometry is used for every populated item and no fabricated JSCAD boxes remain. Do not order yet: red/green indicator verification, sound, and repeater-light interfaces remain. |
| Bind firmware to the ordered board | waiting | After the final pinout is fixed, connect the portable C17 scoring core to the real ESP32 acquisition and interface adapters. Avoid firmware for hypothetical hardware. |
| Bring up scoring behavior | waiting | Verify rails and programming, then Ethernet, IR, display, outputs, and all seven conductors. Exercise foil, epee, and sabre timing and resistance behavior and record only faults that require a board or firmware revision. |

## Fixed decisions

- One ESP32-S3 runs the prototype and portable C17 scoring core; there is no STM32 on this board.
- WIZ850io supplies Ethernet.
- USB-C PD is the normal input through an Adafruit 5991 module set to 20 V and a Pololu D36V50F5 5 V regulator mounted
  on the prototype carrier.
- Ok Fencing weapon cables are already accepted; the prototype uses direct solder pads or simple board-side connections.
- Firmware follows the ordered hardware, except for continued development of the hardware-independent scoring logic.
