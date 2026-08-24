# Scoring

The executable scoring specification and two-processor device emulator. The scoring state machine is independent of
vendor SDKs so its timing rules can be replayed deterministically on a developer machine and in CI.

See `docs/device-delivery-plan.md` for the coordinated implementation plan from executable rules and emulation through
fabrication readiness, EVT, DVT, FIE evidence, and production validation.

The canonical virtual processor path is split across the scoring authority, binary processor link, and application
receiver:

- [`src/virtual-stm32.ts`](src/virtual-stm32.ts) consumes trusted front-end snapshots, owns the selected weapon scorer,
  and emits immutable authoritative outcomes.
- [`src/virtual-processor-link.ts`](src/virtual-processor-link.ts) carries bounded binary transport frames with
  deterministic delay, loss, duplication, reordering, corruption, and connection faults.
- [`src/virtual-esp32.ts`](src/virtual-esp32.ts) accepts validated [`DecisionRecord`](src/decision-record.ts) payloads
  from STM32, preserves them for display and storage, and never re-decides a touch.

The virtual STM32 delays an authoritative outcome only according to the selected scorer and virtual clock. The canonical
decision-record schema carries the qualified, rejected, diagnostic, calibration, reset, or uncertainty outcome together
with capture bounds and firmware, rule, timing, line, and calibration provenance. The receiver rejects corrupt,
duplicated, unordered, wrong-direction, forged, or structurally invalid records; it does not reconstruct or re-decide
the touch. The transport uses the fixed binary frame defined in [`transport-frame.ts`](src/transport-frame.ts), while
the decision-record payload remains independently validated by `decision-record.ts`.

The virtual path is a deterministic host model and does not claim physical front-end, processor-peripheral, or
hardware-in-the-loop evidence. Native C17 and WebAssembly implementations must preserve the same authority and record
boundaries before hardware release.

## Golden scenario runner

Run one M0-07 scenario or the corpus manifest after building the package:

```text
pnpm run:scenarios -- docs/golden-scenario-manifest.json
pnpm run:scenarios -- docs/golden-scenarios/epee-contact-boundaries.json
```

The command writes one deterministic JSON report to standard output. Exit code `0` means every selected expectation
passed, `1` means a scorer result differed from an expectation, and `2` means the input path or contract was invalid.
The runner executes the selected host weapon scorer; it does not claim physical hardware evidence or replay stored
decision records.

## Emulation layers

1. Run Vitest for exhaustive timing, transport, duplication, and fault scenarios.
2. Compile the portable scoring core as an STM32 host test, then run STM32 firmware in Renode for peripherals and
   interrupt behavior.
3. Boot the ESP-IDF application in Espressif QEMU for tasks, timers, UART/SPI adapters, flash, networking, and OTA
   behavior.
4. Run both virtual devices together with a socket or pseudo-terminal standing in for SPI.
5. Use Wokwi only for optional interactive ESP32 UI and wiring smoke tests.
6. Use a hardware-in-the-loop jig for final analog thresholds, ESD behavior, and microsecond timing. Software emulation
   cannot prove the electrical front end.
