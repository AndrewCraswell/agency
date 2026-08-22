# STM32 target-startup safety boundary

**Task:** M3-06

## Result

This increment supplies a host-compiled, fail-closed startup-gate model for the
candidate `STM32G474RET3TR`. It establishes the required ordering for a future
STM32CubeG4 adapter:

1. assert safe outputs;
2. configure the MPU;
3. configure the clock tree;
4. validate local reset and rail supervision;
5. validate firmware integrity;
6. validate acquisition and line safety;
7. prove that outputs remain safe inactive; and
8. arm the local watchdog.

The model enters `ready` only after every gate succeeds. It has exactly one
output state, `safeInactive`; it has no hit, no-hit, lamp-on, or buzzer-on
reset value. A reset or any failed gate leaves the model unavailable and safe
inactive. A watchdog is not armed after an earlier failure.

The Release host test exercises the normal order, every gate failure, reset,
and missing-adapter cases. It is static behavioral evidence only. It does not
drive a lamp, buzzer, source, sink, pin, or peripheral register.

## Target build

The local cache supplies Arm GNU Toolchain `14.2.Rel1` and the official
STM32CubeG4 `v1.6.3` source at pinned commits. Their archive digest, tag, and
commits are recorded in `target/toolchain-manifest.json`; the complete source
cache is ignored and is not vendored. `tools/test-target.mjs` configures a
bare-metal STM32G474RE CMake build using ST's CMSIS device header, system
source, and GCC startup object. It links 512 KiB flash plus the documented
80 KiB SRAM1, 16 KiB SRAM2, and 32 KiB CCMSRAM regions, writes a linker map,
and runs static checks that require no undefined
symbols, no dynamic allocation, no ESP control path, and inactive output latch
configuration before output mode.

The target adapter configures the documented reset HSI source, an MPU SRAM
execute-never region, and the independent watchdog interface. It records reset
flags as the available supervisor observation. Since M0-10 has not selected a
readable supervisor-good signal, that supervisor gate deliberately returns
`unavailable`. The acquisition gate also returns `unavailable` pending M0-08
and M3-07. Thus the linked target image cannot become scoring-ready and cannot
drive a scoring indication.

Correct vector-table placement is only a prerequisite. Until a separately
reviewed firmware identity and image-integrity policy exists, the target's
integrity gate also returns `unavailable`; a mismatched vector placement returns
an integrity failure.

This is target integration evidence, not M3-06 completion. The candidate pin
allocation, output-driver pull networks, supervisor circuit, HSE suitability,
and CubeMX peripheral proof remain outside this increment and block a hardware
safe-output claim.

ST's current product page documents the STM32G474xB/xC/xE 170 MHz Cortex-M4
with MPU. STM32CubeG4 is ST's MCU package for the G4 HAL, LL APIs, and CMSIS.
The checked source links are [the STM32G474 product page](https://www.st.com/en/microcontrollers-microprocessors/stm32g474rb.html),
[STM32CubeG4](https://www.st.com/en/embedded-software/stm32cubeg4.html), and
[RM0440](https://www.st.com/resource/en/reference_manual/rm0440-stm32g4-series-advanced-armbased-32bit-mcus-stmicroelectronics.pdf).

## Hardware blockers retained from M0-08 and M0-10

- The GPIO/ADC/comparator/timer/DMA allocation is a candidate, not CubeMX
  solver output. Comparator routing, HRTIM capture, DMA mapping, and
  alternate-function coexistence remain open.
- HSE is reserved but its tolerance and startup are unproven. LSE is displaced
  by candidate link pins.
- Lamp, buzzer, and source/sink outputs use one candidate GPIO table: PA8 through
  PA12, PB2 through PB7, PB9, PB10, PB12, PB15, and PC0 through PC3. The adapter
  latches each low before enabling push-pull output mode and verifies low output
  latches. This is not electrical proof: drivers and physical pull networks
  remain unverified, so firmware cannot prove an unpowered/reset MCU is inactive.
- The supervisor, watchdog, output-latch behavior, and reverse-reset paths are
  not yet electrically proven. A warm STM32 reset remains an unavailable fault
  and is not a primary-indication clear.

No ESP32 path is added or required by this startup boundary. The STM32 remains
the sole owner of scoring availability, excitation, and primary outputs.

## Re-run

From the repository root:

```text
node apps/scoring/firmware/stm32/tools/bootstrap-target-dependencies.mjs
node apps/scoring/firmware/stm32/tools/test-host.mjs
```

The bootstrap downloads only the manifest-pinned Arm archive and the
STM32CubeG4 checkout plus its CMSIS-device submodule into the ignored `.cache`
directory. It verifies the archive SHA-256 and both Git commits before reuse.
It never vendors the dependencies. The target build uses Ninja; install
`Ninja-build.Ninja` version `1.13.2` with winget, or set `SCORING_NINJA` to its
executable if it is not discoverable. The combined runner configures a C17
Release host build with warnings treated as errors, then runs the pinned target
compile, link, map, and static check.
