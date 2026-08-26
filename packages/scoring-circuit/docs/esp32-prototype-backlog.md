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
| Produce the prototype PCB | active | The complete minimal schematic renders without circuit or placement errors. Next: route its 97 connections on the two-layer board, export the replacement KiCad project and order files, run basic ERC/DRC, and visually inspect Gerbers and drills before ordering a small batch. |
| Bind firmware to the ordered board | waiting | After the final pinout is fixed, connect the portable C17 scoring core to the real ESP32 acquisition and interface adapters. Avoid firmware for hypothetical hardware. |
| Bring up scoring behavior | waiting | Verify rails and programming, then Ethernet, IR, display, outputs, and all seven conductors. Exercise foil, epee, and sabre timing and resistance behavior and record only faults that require a board or firmware revision. |

## Fixed decisions

- One ESP32-S3 runs the prototype and portable C17 scoring core; there is no STM32 on this board.
- WIZ850io supplies Ethernet.
- USB-C PD remains the normal input through off-board SparkFun and Pololu modules.
- Ok Fencing weapon cables are already accepted; the prototype uses direct solder pads or simple board-side connections.
- Firmware follows the ordered hardware, except for continued development of the hardware-independent scoring logic.
