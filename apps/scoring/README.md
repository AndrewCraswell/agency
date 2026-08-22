# Scoring

The executable scoring specification and two-processor device emulator. The scoring state machine is independent of
vendor SDKs so its timing rules can be replayed deterministically on a developer machine and in CI.

See `docs/device-delivery-plan.md` for the coordinated implementation plan from executable rules and emulation through
fabrication readiness, EVT, DVT, FIE evidence, and production validation.

`src/device.ts` models the production boundary:

- A virtual STM32G474 consumes protected electrical readings, owns the scoring state, and emits versioned, sequenced hit
  events.
- A virtual ESP32-S3 accepts those events for display, storage, identity, and cloud work. It never re-decides a touch.

The emulator delays a decision record for a bounded post-touch capture window. Each immutable record includes packed
input samples, the qualified hit, capture bounds, timing-table revision, firmware digest, scoring boot ID, sequence
range, and CRC-32C. The ESP32 rejects corrupt, duplicated, unordered, or structurally invalid records; it does not
reconstruct or re-decide the touch. The current event encoding is newline-delimited JSON because it is easy to inspect
and fuzz. Production firmware will use a fixed binary frame while preserving the versioned decision-record semantics.

This increment records qualified epee touches. Rejected-touch and line-fault records, application-controller boot IDs,
and RTC uncertainty belong to the next transport/persistence increment; they are target-model fields, not claims about
the current emulator.

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
