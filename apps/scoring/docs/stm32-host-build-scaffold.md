# STM32 host-build scaffold

**Delivery-plan task:** M3-03

This is the portable C17 boundary for the future STM32G474 scoring firmware.
It is deliberately a scaffold, not the M3-04 qualification core, an
STM32Cube project, a peripheral implementation, or a target pin configuration.
The authoritative scoring implementation will live in this STM32-only C
boundary. The ESP32 may receive already-authoritative records, but it cannot
link, invoke, or reproduce the scoring core.

## Portable C boundary

`firmware/stm32/include/stm32_scoring_host.h` defines caller-substitutable,
bounded interfaces for the functions reserved by M0-08:

- microsecond clock;
- normalized ADC frames for seven conductors;
- comparator event batches;
- DMA frame batches;
- flash read/write;
- watchdog arming and service; and
- opaque outbound transport bytes.

The interface names a functional role, not a STM32 pin, HAL type, DMA request,
interrupt, clock tree, comparator route, transport frame, or target library.
Those details remain M0-08/CubeMX and M3-05 through M3-07 work. In particular,
the current candidate HRTIM, ADC1/ADC3, COMP1 through COMP7, DMA1, SPI1, and
GPIO assignments are not silently materialized by host code.

The default hardware surface returns `SCORING_STATUS_UNAVAILABLE` from every
operation. A host cannot become ready if the clock or watchdog cannot be
used. Invalid callback surfaces fail at validation, and a producer that claims
more than the fixed DMA or comparator poll bound forces the host back to
`unavailable`. The scaffold does not enable excitation, configure outputs,
send frames, or issue a decision.

That preserves the M0-10 safe-inactive rule and makes absence or failure of a
hardware adapter a scoring-unavailable condition rather than a score or an
inferred no-hit result. The adapter that eventually touches STM32CubeG4
headers stays outside this portable directory.

## Fixture boundary

The checked TypeScript artifact
[`fixtures/golden-vector-export.json`](../fixtures/golden-vector-export.json)
is translated deterministically into the checked C header
`firmware/stm32/generated/stm32_golden_vectors.h`. The generator copies
fixture metadata and each vector's identifier, identity fields, timing values,
sample count, expected hit count, and expected diagnostic count. It contains
no hand-copied timing table. The native C test consumes that header only as a
fixture-shape smoke boundary: metadata, count, timing fields, sample counts,
and expected hit/diagnostic counts. It does not yet carry each normalized
sample or each full expected decision. M3-04 must extend the translation and
consume those full stimuli before claiming golden-vector parity.

Regenerate after an approved TypeScript fixture change:

```text
node firmware/stm32/tools/generate-golden-fixture.mjs
```

Fail when the checked translation is stale:

```text
node firmware/stm32/tools/generate-golden-fixture.mjs --check
```

## Native host build

The CMake project uses C17 with extensions disabled and warnings as errors.
The runner first proves the upstream checked JSON is current with the M3-02
raw-byte check, then proves the generated C header is current before invoking
the available native CMake generator. On Windows it selects the installed
LLVM-MinGW C17 toolchain without assuming a Visual Studio instance; elsewhere
it uses CMake's default native compiler.

```text
node firmware/stm32/tools/test-host.mjs
```

It configures an ignored build directory, builds the portable core, and runs
CTest in a Release configuration. The test checks use a dedicated macro rather
than `assert`, so they remain active with `NDEBUG`. It does not claim a target
build, a pinned STM32CubeG4 release, or a target timing measurement. M3-06 and
M3-07 own those proofs. Address and undefined-behavior sanitizer jobs are
required by the firmware ADR once a pinned Linux host toolchain is added; this
host scaffold does not pretend that a sanitizer ran when one is unavailable.
