# Scoring circuit

A tscircuit Rev-A carrier for a deterministic STM32G474 scoring controller and a separate ESP32-S3 application
controller. It exposes A, B, and C for each fencer through current-limiting and RC filtering, routes the six protected
lines only to the STM32 side, and connects STM32 to ESP32 through SPI, interrupt, heartbeat, and reset signals.

The first physical prototype uses a `NUCLEO-G474RE` and an ESP32-S3 development board on the two headers. That lets us
validate firmware and the analog topology before committing the exact STM32G474RET6 support circuit and ESP32-S3 module
to a fabrication-ready integrated PCB.

Run `pnpm --filter @repo/scoring-circuit build` to generate `dist/circuit.json`, or use `dev` to regenerate it while
editing. The Circuit JSON can be inspected with tscircuit-compatible schematic, PCB, and 3D viewers. Run the package
tests to verify that both processor interfaces and both fencing channels remain present.

## Ownership boundary

- STM32G474: electrical acquisition, hardware timestamps, hit qualification, primary lights, and buzzer.
- ESP32-S3: display, fencer identity, BLE/Wi-Fi, local storage, cloud sync, and OTA.
- The ESP32 displays STM32 decisions; it does not decide whether a contact scores.

## Prototype limits

This is a bench prototype, not a fabrication-ready competition scoring apparatus. The resistor and capacitor network
demonstrates the topology but does not yet implement the complete resistance classification, programmable excitation,
comparator thresholds, or transient protection required for all three weapons. Before fabrication, choose real
FIE-spaced body-cord sockets, design and simulate those analog stages, add IEC-rated ESD protection, run PCB DRC, and
verify every threshold and timing with physical weapons, cords, guards, lamés, and a conductive piste.
