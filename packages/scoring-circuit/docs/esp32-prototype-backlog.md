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
| Replace the oversized carrier | done | Commit `2cc4dea` completes the root-reviewed replacement schematic with 32 populated parts and 97 declared connections. It uses the official 22.86 mm DevKitC socket spacing, seven current-limited conductor drivers, five series-protected direct ADC sense paths, WIZ850io, TSOP38438, one-wire WS2812 display, one buzzer transistor, and minimal power/Ethernet passives. Two focused test files with six tests, package typecheck, lint, formatting, preview build, and visual schematic/placement review passed. |
| Produce the prototype PCB | done | Commit `510a4ce` routes all 97 declared connections on the two-layer board and exports the editable KiCad project, BOM, placement list, both copper layers, masks, paste, silkscreen, board outline, plated drills, and four non-plated mounting holes. The routed board has 32 populated parts, 66 physical trace segments, a bottom ground pour, zero unresolved nets, and zero routing/DRC errors. Root visual review of the routed copper, board outline, and drill coordinates passed. Focused circuit tests passed 6/6; package typecheck, lint, format, preview build, and repeatable route/export also passed. |
| Order and assemble the board | active | Upload the files in `../pcb/manufacturing/` to the selected board fabricator, confirm the 160 mm by 100 mm two-layer preview and drill map, and order a small bare-board batch. Populate headers and passives by hand, then socket the DevKitC, WIZ850io, and IR receiver. The package-wide legacy test suite still has 26 failures tied to the retired STM32/precision-analog design and deleted evidence; those tests are cleanup work, not board blockers. |
| Bind firmware to the ordered board | waiting | After the final pinout is fixed, connect the portable C17 scoring core to the real ESP32 acquisition and interface adapters. Avoid firmware for hypothetical hardware. |
| Bring up scoring behavior | waiting | Verify rails and programming, then Ethernet, IR, display, outputs, and all seven conductors. Exercise foil, epee, and sabre timing and resistance behavior and record only faults that require a board or firmware revision. |

## Fixed decisions

- One ESP32-S3 runs the prototype and portable C17 scoring core; there is no STM32 on this board.
- WIZ850io supplies Ethernet.
- USB-C PD remains the normal input through off-board SparkFun and Pololu modules.
- Ok Fencing weapon cables are already accepted; the prototype uses direct solder pads or simple board-side connections.
- Firmware follows the ordered hardware, except for continued development of the hardware-independent scoring logic.
