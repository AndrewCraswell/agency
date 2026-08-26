# ESP32 scoring prototype backlog

## Goal

Order a working ESP32-S3 carrier as quickly as practical so firmware can be written and tested on real scoring hardware.
This is a hand-assembled development board, not a production design or an FIE homologation submission.

## Scope rule

A task belongs here only when it is required to make the first boards electrically functional, orderable, programmable,
or useful for scoring development. Production qualification, certification, enclosure design, manufacturing fixtures,
long-term sourcing, cost reduction, per-part evidence packages, backlog validators, and automated release gates are out
of scope. A future production project may add them after this board proves the scoring architecture.

`active` means work is underway. `waiting` means the named dependency is incomplete. `done` requires implementation,
focused verification, root review, and a commit.

| Deliverable | Status | Latest state |
| --- | --- | --- |
| Close the carrier design | done | Commit `c9f3659` connects all seven weapon/piste landings, IR, and the five primary outputs; adds simple zero-ohm analog power/ground links; and restores usable ESP32 paste apertures. Root review, 18 focused tests, package typecheck, lint, and formatting passed. The WIZ850io may be directly soldered for this hand-built prototype. |
| Produce and order the PCB | active | Commit `0071570` adds the editable four-layer KiCad project and a repeatable placement/netlist exporter. The full 164-component, 489-connection board is now in `packages/scoring-circuit/pcb`; routing is active. Next: finish copper, run basic ERC/DRC, inspect Gerbers and drills, generate the BOM and placement file, and order a small batch. No production optimization gates apply. |
| Bind firmware to the ordered board | waiting | After the final pinout is known, connect the portable C17 scoring core to ESP32 acquisition, Ethernet, HUB75, IR, USB diagnostics, lamps, buzzer, and safe-enable adapters. Do not build firmware for hypothetical hardware. |
| Bring up and validate scoring | waiting | On assembled boards, check rails and programming first, then interfaces and outputs, then foil/epee/sabre timing and resistance behavior. Record faults that require a board revision or firmware change; do not create a production qualification dossier. |

## Already settled

- One ESP32-S3 runs the firmware and the portable C17 scoring core.
- WIZ850io provides Ethernet.
- USB-C PD remains the normal input through an off-board SparkFun PD module and Pololu 5 V regulator.
- The carrier retains the scoring front end, direct-wire weapon/piste landings, HUB75, encrypted IR, USB recovery,
  lamps, and buzzer.
- The prototype uses a roomy 250 mm by 180 mm four-layer outline so it is easy to route, probe, and modify.

No additional architecture work is needed before closing the listed connections and producing the PCB.
