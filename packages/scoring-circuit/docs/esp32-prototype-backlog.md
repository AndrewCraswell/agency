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
- Seven identical common-ground scoring-input channels using the selected
  protection, mux, buffer, reference, and ADS8881 acquisition design.
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
| `P0-02` | active | Finish the complete power design. | `P0-01` | Root accepted the USB-C PD/eFuse/5 V/3.3 V circuit, display branch, and seven-channel analog/reference rail arithmetic after removing the obsolete isolation rail. Nineteen focused tests and package types pass. One non-duplicated 20 V load total and integration into the canonical schematic remain. |
| `P0-03` | active | Finish one exact scoring-input channel and repeat it seven times. | `P0-01` | Root accepted the seven-line acquisition definition after binding GPIO4/5/6 and normalizing `VNEG_ANALOG`. Exact parts, support quantities, ADC order, failure states, and characterization are fixed; the seven repeated circuit cells still need integration. |
| `P0-04` | active | Finish ESP32 support and all non-scoring peripherals. | `P0-01` | Root accepted the exact ESP32 module, all 41 pad dispositions, bypass, EN/BOOT, watchdog/reset, native USB, UART recovery, and integrated-antenna rules. Digital/output circuit review remains active, especially connector/crystal footprints and output-driver simplification. |
| `P0-05` | waiting | Integrate one complete schematic. | `P0-02`, `P0-03`, `P0-04` | Waiting for the three active hardware definitions. Integrate power, seven-channel analog, ESP32, Ethernet, HUB75, IR, USB, weapon interface, and outputs into the canonical circuit source. |
| `P0-06` | waiting | Reconcile BOM and footprints and clear schematic errors. | `P0-05` | Every populated reference must have an exact MPN, quantity, package, placeable footprint, and disposition; no unexplained ERC errors or populated TBDs may remain. |
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
P0-02 + P0-03 + P0-04
          -> P0-05 -> P0-06 -> P0-07 -> P0-08 -> P0-09
P0-09 -> P0-10/P0-11 -> P0-12 -> P0-13 -> P0-14
```

The next concrete milestone is `P0-05`: one complete schematic. Work that does
not help close `P0-02`, `P0-03`, `P0-04`, or integrate `P0-05` is not on the
prototype critical path.

## Retired evidence identifiers

Previous `BP-*` task IDs are evidence labels, not active backlog items. Their
committed documents and tests remain available when they support one of the 14
deliverables above.

<a id="bp-126"></a>

`BP-126` evidence is retained under `P0-04` for encrypted-IR hardware and its
no-scoring-authority adapter boundary.
