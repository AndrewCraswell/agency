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
| Add USB-C power | active | The carrier now models an in-stock Adafruit 5991 HUSB238 USB-C PD module set to 20 V and a socketed Pololu D36V50F5 5 V regulator. Exact vendor STEP models, mounting holes, regulator header geometry, wide power connections, and labeled short-wire landings are implemented. Root verification, rendered inspection, routing reconciliation, and commit remain before this row can be marked done. |
| Add red and green scoring lights | waiting | Start after USB-C power is committed. Select the simplest direct prototype indicators that remain visible during scoring tests. |
| Add sound | waiting | Start after the scoring lights are committed. Retain a single transistor-driven sounder path. |
| Add two repeater-light interfaces | waiting | Start after sound is committed. Confirm whether the requested repeaters are wired lamp outputs or Ethernet subscribers before adding hardware; one existing Ethernet port already supports multiple network subscribers through a switch. |
| Order and assemble the board | active | Commits `86c0077` and `75e060b` add real STEP geometry for all 33 populated items and preserve the exact downloaded source bytes. Commit `88c0dea` corrects the vendor-coordinate transforms: the DevKitC socket rows and WROOM module now share the carrier envelope, WIZ850io lies on its board plane, TSOP384xx stands at the board edge, and headers follow their pad rows. Browser review and an executable generated-circuit transform test passed. No fabricated JSCAD boxes remain. The complete DevKitC carrier model is account-gated on public component platforms, so the preview renders its exact WROOM-1 module, exact socket rows, and carrier outline without pretending that combination is a complete carrier model. Upload `../pcb/manufacturing/` to the selected fabricator, confirm the 160 mm by 100 mm preview and drill map, then order a small bare-board batch and hand-assemble it. |
| Bind firmware to the ordered board | waiting | After the final pinout is fixed, connect the portable C17 scoring core to the real ESP32 acquisition and interface adapters. Avoid firmware for hypothetical hardware. |
| Bring up scoring behavior | waiting | Verify rails and programming, then Ethernet, IR, display, outputs, and all seven conductors. Exercise foil, epee, and sabre timing and resistance behavior and record only faults that require a board or firmware revision. |

## Fixed decisions

- One ESP32-S3 runs the prototype and portable C17 scoring core; there is no STM32 on this board.
- WIZ850io supplies Ethernet.
- USB-C PD is the normal input through an Adafruit 5991 module set to 20 V and a Pololu D36V50F5 5 V regulator mounted
  on the prototype carrier.
- Ok Fencing weapon cables are already accepted; the prototype uses direct solder pads or simple board-side connections.
- Firmware follows the ordered hardware, except for continued development of the hardware-independent scoring logic.
