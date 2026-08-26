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
| `P0-02` | done | Finish the complete power design. | `P0-01` | Main commits `25b3062`, `640aa4f`, and `3dc77bd` integrate the USB-C PD/eFuse/5 V/3.3 V chain and correct the analog budget for one active phased source/sink path, one ADC/reference, five buffers, three muxes, two control registers, and hardware-disabled mux enables. Root review and focused verification passed. |
| `P0-03` | done | Finish the exact phased seven-conductor acquisition circuit. | `P0-01` | Main commits `640aa4f` and `3dc77bd` implement three 8:1 source/sink/sense muxes, five protected B/C/piste buffers, one ADS8881/reference chain, a controlled resistance-measurement sink, reset-safe phase control, and independent mux-enable pulldowns. The OpenPiste files remain read-only prior art and specifications were untouched. Root verification passed. |
| `P0-04` | done | Finish ESP32 support and all non-scoring peripherals. | `P0-01` | Main commits `7d08ed1`, `18bfb6b`, and `25b3062` integrate ESP32 support/reset/recovery, W5500 Ethernet, HUB75, IR, protected primary outputs, and the simplified source driver. Root review and focused verification passed; exact footprint approval followed in `P0-06`. |
| `P0-05` | done | Integrate one complete schematic. | `P0-02`, `P0-03`, `P0-04` | Main commits `25b3062`, `640aa4f`, and `3dc77bd` integrate the complete corrected schematic. The canonical render contains 250 populated source components, including the required mux-enable hardware pulldowns, and reports zero circuit errors. Root verification passed. |
| `P0-06` | done | Reconcile BOM and footprints and clear schematic errors. | `P0-05` | Main commits `f6122e1`, `2041b39`, `8de752e`, `14ead29`, and `f781df5` reconcile the WROOM-1, direct landings, acquisition, Ethernet/HUB75, and ESP32-support families. Commits `e8626c2` and `3784d20` approve USB/power and output/display/IR footprints; `5086460` enforces the integrated 250-reference inventory; `3a498d1` records root closure. Commit `ff77b04` restores the exact retained evidence required by the active footprint tests and decouples the P0 direct-wire interface from retired BP validation. All 17 clean-sheet/P0 suites pass, 72 tests total; focused lint and format pass. Whole-board placement is intentionally owned by `P0-07`. |
| `P0-07` | done | Place the complete PCB. | `P0-06` | Commit `fb52a79` places all 250 populated components on a 360 mm by 200 mm bench board using explicit cable-facing islands and deterministic grids. The strict build reports zero inter-component footprint, pad-clearance, courtyard, or placement failures and zero automatically packed components. All 17 focused prototype suites pass, 75 tests total; package types, focused lint, format, commit hooks, and root browser review of PCB, schematic, 3D, and external-I/O views pass. Routing remains explicitly disabled and all 708 source connections are handed to `P0-08`. |
| `P0-08` | ready | Route and review the PCB. | `P0-07` | Placement is closed by `fb52a79`. Route power/thermal paths, analog/reference returns, ADC timing, USB, Ethernet, clocks, RF keepout, and remaining digital signals; finish with zero unexplained DRC or unrouted nets. |
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

The next concrete milestone is `P0-08`: route the placed board in electrical-priority order and clear every design-rule
violation and unrouted connection before manufacturing output begins.

## Retired evidence identifiers

Previous `BP-*` task IDs are evidence labels, not active backlog items. Their
committed documents and tests remain available when they support one of the 14
deliverables above.

<a id="bp-126"></a>

`BP-126` evidence is retained under `P0-04` for encrypted-IR hardware and its
no-scoring-authority adapter boundary.
