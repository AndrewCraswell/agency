# STM32 scoring-core host evidence

M3-04 implements the SDK-free C17 scoring core for the STM32 authority. It
consumes trusted normalized samples, not raw ADC values, and contains no ESP32,
display, network, storage, or target-peripheral dependency.

## Golden handoff

`tools/generate-golden-fixture.mjs` translates the checked M3-02 artifact into
`generated/stm32_golden_vectors.h`. The generated header carries all 54 vectors,
every normalized sample, every expected hit field, sabre white-diagnostic state,
and a deterministic M0-05 decision-record envelope for every emitted hit or foil
off-target decision. The generator rejects unsupported normalized values instead
of silently mapping them.

`tests/test_stm32_scoring_core.c` replays every sample through the C core and
compares:

- hit count, side, classification, start time, and qualification time;
- both sabre white-diagnostic states; and
- every generated decision-record envelope, capture, provenance, signal, and
  outcome field.

The record context supplies immutable capture and firmware identities. It cannot
change the core-selected weapon, side, classification, or timestamps. Golden
records use one bounded acquisition-capture reference. The M1-08 source corpus
does not emit rejection, reset, calibration, uncertainty, or line-fault records;
their schema validation remains covered by M0-05 and their production creation
belongs to the acquisition/fault adapters.

## Timing and bounds

The core uses 64-bit monotonic microseconds, fixed two-hit storage, four-sample
golden vectors, exact `timing-1` endpoints, and normalized binary contact fields.
It rejects null arguments, an unknown weapon, non-monotonic timestamps, and
out-of-vocabulary normalized fields. Integer overflow while deriving a lockout
endpoint fails closed.

The host test command is:

```text
node apps/scoring/firmware/stm32/tools/test-host.mjs
```

The Release build compiles with C17, warnings as errors, regenerates both checked
fixture headers, and runs all CTest cases. This is host behavioral evidence. It
does not claim STM32 target startup, peripheral routing, acquisition latency,
interrupt budget, physical output behavior, target WCET, or board timing. M3-06,
M3-07, M4, and M6 retain those gates.
