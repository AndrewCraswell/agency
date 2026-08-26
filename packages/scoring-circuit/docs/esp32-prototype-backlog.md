# ESP32 scoring-machine prototype

## Goal

Produce one orderable, bring-up-ready ESP32-S3 scoring-machine PCB. It must
acquire all seven weapon conductors, run the portable C17 scoring core, and
provide Ethernet, HUB75 display, encrypted IR remote input, USB service, and
protected lamp/buzzer outputs.

This is a prototype plan. Production certification, enclosure design,
automated manufacturing tests, and component cost optimization begin only
after this board proves the architecture.

## Prototype architecture

- One `ESP32-S3-WROOM-1-N16R2`; no STM32 or processor-isolation subsystem.
- USB-C PD at 20 V is the normal power input.
- Seven phased conductors using one selected source, one selected sink, five protected B/C/piste sense nodes, and one
  shared ADS8881/reference chain. The A conductors are excitation-only; no ESP32 internal ADC decides scoring.
- W5500 Ethernet, reset-safe HUB75 output, TSOP38438 IR, native USB/UART
  recovery, and protected lamp/buzzer outputs.
- Six labeled plated-through weapon-wire landings plus a separate piste
  landing. The owner-validated OK Fencing cable is accepted; a production
  socket is not required for this prototype.
- The portable C17 core remains the only scoring authority. ESP-IDF code is a
  hardware adapter and cannot delegate scoring decisions to network, display,
  storage, or remote-control services.

## Status

`active` means implementation or root review is underway. `ready` means work
can start now. `waiting` means the named dependencies are incomplete. `done`
means implementation, verification, root approval, and commit are complete.
The root agent alone approves, commits, and changes task status.

| ID | Status | Deliverable | Dependencies | Latest state |
| --- | --- | --- | --- | --- |
| `P0-01` | done | Freeze the single-ESP32 prototype architecture and reusable foundations. | None | The clean-sheet board scaffold, minimal population policy, electrical rules, weapon/piste landings, encrypted-IR receiver, display-power contract, target-neutral HAL, and C/C++ coverage gate are committed. |
| `P0-02` | done | Finish the complete power design. | `P0-01` | Commit `99a74c6` integrates the USB-C PD/eFuse/5 V/3.3 V chain and display branch. Commits `3cb9461` and `8d3322c` correct the analog budget for one active phased source/sink path, one ADC/reference, five buffers, three muxes, two control registers, and the three mux-enable pulldowns. Root review, focused tests, package types/lint/format, and commit hooks passed. |
| `P0-03` | done | Finish the exact phased seven-conductor acquisition circuit. | `P0-01` | Commit `3cb9461` replaces the incorrect seven-identical-ADC model with three 8:1 source/sink/sense muxes, five protected B/C/piste buffers, one ADS8881/reference chain, and reset-safe phase control. Commit `8d3322c` adds independent hardware pulldowns so the muxes remain disabled while the phase-register outputs are high-impedance. The design now has a controlled sink needed for resistance measurement. The OpenPiste files remain read-only prior art and specifications were untouched. Root verification passed. |
| `P0-04` | done | Finish ESP32 support and all non-scoring peripherals. | `P0-01` | Commit `99a74c6` integrates the ESP32 support/reset/recovery block, W5500 with exact MagJack and crystal geometry, HUB75, IR, protected primary outputs, and simplified source driver. Root review and focused verification passed. Exact fabrication footprint overlay remains correctly scoped to `P0-06`. |
| `P0-05` | done | Integrate one complete schematic. | `P0-02`, `P0-03`, `P0-04` | Commits `99a74c6`, `3cb9461`, and `8d3322c` integrate the complete corrected schematic. The canonical render contains 256 components, down from 321, including the three required mux-enable hardware pulldowns, and reports zero circuit errors. Root verification passed focused circuit tests, package types, lint, and format. |
| `P0-06` | active | Reconcile BOM and footprints and clear schematic errors. | `P0-05` | Root is reconciling the 256-component integrated design. Eight bounded units are checking acquisition, USB/power, digital, ESP32, output/display/IR footprints, the exact BOM, integrated inventory gates, and obsolete legacy tests. No fabrication approval is implied until root reviews the delivered evidence and clears every populated TBD, placeholder footprint, duplicate reference, and schematic error. |
| `P0-07` | waiting | Place the complete PCB. | `P0-06` | Place connectors and strain relief first, then power, analog, ESP32/RF, Ethernet, HUB75, IR, outputs, probes, and mounting features with reviewed clearances. |
| `P0-08` | waiting | Route and review the PCB. | `P0-07` | Route power/thermal paths, analog/reference returns, ADC timing, USB, Ethernet, clocks, RF keepout, and remaining digital signals; finish with zero unexplained DRC or unrouted nets. |
| `P0-09` | waiting | Generate and approve the manufacturing package, then order boards. | `P0-08` | Review Gerbers and drills, IPC-356, BOM, centroid, assembly drawings, stack-up, board renders, digests, and supplier constraints before root grants prototype-order authority. |
| `P0-10` | waiting | Implement ESP32 acquisition, scoring-core integration, watchdog, and safe outputs. | `P0-09` | Start only after the PCB package fixes the real hardware boundary. Keep and rename the 100%-covered portable scoring core; retire STM32 target/startup/transport code and build the ESP-IDF acquisition/output adapter against the final schematic. |
| `P0-11` | waiting | Implement Ethernet, HUB75, encrypted IR, USB diagnostics, and recovery adapters. | `P0-09` | Start only after the PCB package fixes the real peripherals and pins. Replace the dual-MCU receiver/service scaffold with narrow ESP-IDF adapters; peripheral failures, flood traffic, display work, recovery, and remote input must never alter scoring authority. |
| `P0-12` | waiting | Bring up power, ESP32, recovery, and peripherals on assembled boards. | `P0-09`, `P0-10`, `P0-11` | Record as-built identity, unpowered checks, controlled first power, rails/ripple/temperature, reset/watchdog, USB/UART recovery, Ethernet, HUB75, IR, and output fault behavior. |
| `P0-13` | waiting | Characterize all seven scoring channels and validate foil, epee, and sabre behavior. | `P0-12` | Measure resistance/capacitance/temperature, settling, leakage, overload recovery, ordering, crosstalk, simultaneous events, opens/shorts, and native/ESP/WASM scoring parity against the corpus. |
| `P0-14` | waiting | Close prototype findings and issue the production-transfer record. | `P0-13` | Record tested hardware/firmware digests, accepted limitations, fixes for the next revision, and the explicit work needed for production and FIE homologation. |

## Current critical path

```text
P0-01 -> P0-02/P0-03/P0-04 -> P0-05 -> P0-06 -> P0-07 -> P0-08 -> P0-09
P0-09 -> P0-10/P0-11 -> P0-12 -> P0-13 -> P0-14
```

The next concrete milestone is `P0-06`: reconcile the smaller 256-component integrated design into one exact BOM and
placeable footprint set.

## Retired evidence identifiers

Previous `BP-*` task IDs are evidence labels, not active backlog items. Their
committed documents and tests remain available when they support one of the 14
deliverables above.

<a id="bp-126"></a>

`BP-126` evidence is retained under `P0-04` for encrypted-IR hardware and its
no-scoring-authority adapter boundary.
