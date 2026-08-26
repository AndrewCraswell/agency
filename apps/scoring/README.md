# Scoring

The executable scoring specification and two-processor device emulator. The scoring state machine is independent of
vendor SDKs so its timing rules can be replayed deterministically on a developer machine and in CI.

See `docs/device-delivery-plan.md` for the coordinated implementation plan from executable rules and emulation through
fabrication readiness, EVT, DVT, FIE evidence, and production validation.

The canonical two-processor path is `src/virtual-stm32.ts`, `src/virtual-processor-link.ts`, and `src/virtual-esp32.ts`:

- The virtual STM32G474 consumes trusted front-end snapshots, owns scoring, and emits immutable scorer-origin outcomes.
- `src/decision-record.ts` defines the M0-05 immutable decision-record payload that represents those outcomes.
- `src/transport-frame.ts` carries the payload on the M0-06 fixed binary STM32-to-ESP32 frame with sequence, length, and
  CRC-32C validation.
- The virtual ESP32-S3 accepts valid records exactly once for display, storage, identity, and cloud work. It never
  reconstructs or re-decides a touch.

The virtual link and ESP32 receiver reject corrupt, duplicated, unordered, wrong-direction, and structurally invalid
deliveries. The package has no JSON scoring-event protocol or `scoring/device` compatibility API.

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
