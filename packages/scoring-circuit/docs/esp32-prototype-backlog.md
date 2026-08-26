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
| Replace the oversized carrier | active | Commits `8513c96` and `c4935f1` retire the previous architecture and generated PCB/order outputs. Commit `af15f3e` replaces the build entry point with a new 160 mm by 100 mm, two-layer carrier containing only eleven controller, Ethernet, power, conductor, display, IR, and buzzer interfaces; its three focused tests, package typecheck, lint, formatting, and preview build pass. Next: add the discrete conductor circuit, HUB75 buffers, IR receiver, buzzer transistor, and power passives while staying below 60 populated parts. |
| Produce the prototype PCB | waiting | Starts only after root simplicity review of the replacement schematic. Place and route the smallest practical board, run basic ERC/DRC, inspect Gerbers and drills, and order a small batch. Delete or replace obsolete generated outputs from the retired carrier. |
| Bind firmware to the ordered board | waiting | After the final pinout is fixed, connect the portable C17 scoring core to the real ESP32 acquisition and interface adapters. Avoid firmware for hypothetical hardware. |
| Bring up scoring behavior | waiting | Verify rails and programming, then Ethernet, IR, display, outputs, and all seven conductors. Exercise foil, epee, and sabre timing and resistance behavior and record only faults that require a board or firmware revision. |

## Fixed decisions

- One ESP32-S3 runs the prototype and portable C17 scoring core; there is no STM32 on this board.
- WIZ850io supplies Ethernet.
- USB-C PD remains the normal input through off-board SparkFun and Pololu modules.
- Ok Fencing weapon cables are already accepted; the prototype uses direct solder pads or simple board-side connections.
- Firmware follows the ordered hardware, except for continued development of the hardware-independent scoring logic.
