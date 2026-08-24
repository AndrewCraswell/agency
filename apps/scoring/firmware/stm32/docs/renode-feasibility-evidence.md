# STM32 Renode feasibility disposition

**Task:** M3-12

## Decision

Renode is declined as a dependency for the STM32G474RE firmware. This is an
accepted no-go disposition for the feasibility spike, not evidence that the
target or board behavior is complete.

The audit is pinned to [Renode v1.16.1][renode-release], release commit
[`d66b0c2aa3d420408eccecfd1d3bab0fd702a6db`][renode-tree]. The release tree
contains zero paths matching `stm32g4` or `stm32g47`; consequently it contains
no STM32G4 or STM32G474 platform definition. A stock release cannot execute the
candidate target as the target device.

## What the audit found

The closest included family definition is
[`platforms/cpus/stm32g0.repl`][stm32g0-platform]. It is not a substitute:

- it declares a Cortex-M0 CPU, while STM32G474RE is Cortex-M4;
- its GPIO register range starts at `0x50000000`, while STM32G474 GPIO starts
  at `0x48000000`; and
- it explicitly documents an EXTI compatibility workaround.

The candidate STM32 target directly uses G474 reset/clock, GPIO, MPU, IWDG,
vector-table, and flash state. The forthcoming acquisition implementation also
needs G4-specific ADC, comparator, DMA/DMAMUX, timer or HRTIM, and SPI3
behavior. None may be inferred from a different-family `.repl` file.

| Area | Renode v1.16.1 evidence | Disposition |
| --- | --- | --- |
| Cortex-M4 execution and NVIC | Generic models exist, but no G474 machine binds them to the target map. | Not target evidence |
| G474 flash, vector table, and reset | No G474 platform definition. | Unsupported |
| G4 RCC, clock switching, and HSE | No G474 peripheral model. | Unsupported |
| GPIO reset values, alternate functions, and safe-output latches | No G474 GPIO model or board wiring. | Unsupported |
| MPU and watchdog reset behavior | Generic CPU or watchdog behavior cannot establish the G474 integration. | Unsupported |
| ADC, comparators, DMA or DMAMUX, timers or HRTIM | No G474 machine or peripheral configuration. | Unsupported |
| SPI3 transport interrupt and DMA behavior | No G474 machine or link electrical model. | Unsupported |
| Supervisor, output drivers, analog front end, and USB-C PD power path | These are board-level circuits, not emulator peripherals. | Hardware only |

A custom `.repl` that maps memory or stubs registers would only recreate the
native host fakes while concealing unmodelled peripheral behavior. It therefore
does not provide value beyond the existing host seam and static target checks,
and it must not be added as a permanent dependency.

## Replacement verification lanes

The retained verification model is deliberately layered:

1. Native C17 tests substitute clock, ADC, comparator, DMA, flash, watchdog,
   and transport interfaces. They establish fail-closed behavioral contracts.
2. The pinned Arm GNU Toolchain and STM32CubeG4 build link the G474 target ELF,
   emit a map, and run static checks for bounded symbols, no dynamic allocation,
   no ESP32 control path, and inactive output latching before output mode.
3. After M0-08, M0-10, and M3-07 provide the actual allocation and adapters,
   on-board SWD and hardware-in-the-loop checks establish clocks, interrupts,
   acquisition timing, safe outputs, supervisor behavior, and electrical
   behavior. They remain separate from this disposition.

These lanes do not claim target peripheral execution in an emulator. They keep
the STM32 as the sole scoring authority and never replace board evidence with
an ESP32 or host result.

## M3-14 handoff

M3-14 may proceed without a Renode lane. Its native dual-firmware runner must
compose one bounded opaque STM32 transport frame with the ESP32
receiver/journal/replay path and verify duplicate, corruption, ordering,
backpressure, reset, and power-loss behavior. The runner must list every
platform fake, including the STM32 clock, acquisition peripherals, watchdog,
flash, and link, rather than implying target support. It is not a Renode test
or a hardware test.

## Non-claims, risks, and re-open condition

This disposition does not close M3-06, M3-07, M0-08, M0-10, analog timing,
safe-output, USB-C PD, or board validation gates. Renode can gain support after
this release, so the conclusion is limited to the pinned release and commit.

Re-open M3-12 only when either:

1. a pinned upstream Renode release includes an STM32G474 platform with the
   required memory map and peripherals; or
2. a separately reviewed custom G474 model demonstrates its exact register,
   interrupt, clock, DMA, and peripheral behavior against target and hardware
   evidence.

Until then, no generic Cortex-M4, STM32G0, mapped-memory, or Python-stub model
is acceptable as STM32G474 evidence.

[renode-release]: https://github.com/renode/renode/releases/tag/v1.16.1
[renode-tree]: https://github.com/renode/renode/tree/d66b0c2aa3d420408eccecfd1d3bab0fd702a6db
[stm32g0-platform]: https://github.com/renode/renode/blob/d66b0c2aa3d420408eccecfd1d3bab0fd702a6db/platforms/cpus/stm32g0.repl
