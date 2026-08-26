# ESP32 scoring prototype backlog

## Goal

Order and bring up a simple module-based carrier so firmware development can proceed on real scoring hardware.

`active` means work is underway. `ready` means it can start. `waiting` means a named dependency is incomplete. `done`
requires implementation, focused verification, root review, and a commit.

| Deliverable | Status | Depends on | Latest state |
| --- | --- | --- | --- |
| Simplified carrier definition | done | None | Commit `8a2937f` rewrites the root-reviewed prototype boundary around ESP32-S3, WIZ850io Ethernet, an STUSB4500 PD module, a 5 V regulator module, and the retained custom scoring front end. The previous production-style routing and release gates are retired. |
| Portable scoring core | done | None | The C17 scoring core remains target-neutral and is covered at 100% line, function, and branch coverage; other first-party C/C++ meets the 80% gate. |
| Minimal carrier schematic | done | Simplified carrier definition | Commits `214548c`, `c94df08`, `55f9a63`, and `6d19856` remove the external supervisor/watchdog, replace discrete Ethernet with WIZ850io, and reduce power to one fused 5 V input from an off-board PD/buck assembly. The integrated 162-component carrier renders without circuit or placement errors; 11 focused tests and package typecheck pass. |
| Prototype PCB and order files | ready | Minimal carrier schematic | Use the roomy 250 mm by 180 mm four-layer starting outline; ease of routing, probing, and hand modification matters more than area. Route in a conventional PCB editor, clear its DRC, review Gerbers/drills/BOM/centroid, and order a small batch. Do not make completion depend on the tscircuit autorouter. |
| ESP32 hardware adapters | waiting | Minimal carrier schematic | Bind acquisition timing, ADC transfers, Ethernet SPI, HUB75, IR RMT, USB diagnostics, lamps, buzzer, reset, and safe-enable behavior to the final carrier pins. No scoring rewrite is required. |
| Board bring-up | waiting | Prototype PCB and order files, ESP32 hardware adapters | Verify rails, USB recovery, Ethernet, display, IR, outputs, reset-safe behavior, and basic acquisition on assembled boards. Record only failures that affect the next revision or firmware work. |
| Scoring validation | waiting | Board bring-up | Run foil, epee, and sabre corpus/parity tests plus practical resistance, timing, simultaneous-hit, open/short, and recovery checks. This validates the development prototype; it is not FIE homologation. |

## Immediate sequence

1. Commit this simplified definition.
2. Replace commodity discrete blocks with the three modules.
3. Produce and order the carrier PCB.
4. Finish firmware against the board that was actually ordered.
5. Bring it up and validate scoring behavior.

Production design, certification, enclosure, automated fixtures, production sourcing, and cost reduction are a
separate project after the prototype proves the architecture.
