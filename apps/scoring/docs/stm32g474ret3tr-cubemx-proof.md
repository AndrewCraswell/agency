# M0-08 STM32G474RET3 CubeMX and alternate-function proof

## Result

The committed `STM32G474RET3` LQFP64 allocation is mechanically checked
against the installed STM32CubeG4 package and CMSIS/HAL headers, but M0-08
remains **blocked**. This is a fail-closed partial proof, not a CubeMX
generated project, a schematic release, or physical evidence.

Run the check from `apps/scoring`:

```text
node scripts/check-stm32g474ret3tr-cubemx-proof.mjs
```

The normal command succeeds only when the evidence matches the committed
partial-proof state. A release gate must use the following command, which
intentionally fails until an exact generated project is available:

```text
node scripts/check-stm32g474ret3tr-cubemx-proof.mjs --require-closure
```

## Checked provenance

The checker reads, rather than copies, the installed inputs at
`firmware/stm32/.cache/STM32CubeG4`:

| Input | Checked fact |
| --- | --- |
| `package.xml` | STM32CubeG4 `FW.G4.1.6.0`, patch `FW.G4.1.6.3`. |
| NUCLEO-G474RE SPI DMA CubeMX sample | `STM32G474RET3`, `LQFP64`, CubeMX 6.10.0, database DB.6.0.100, and SPI1 RX on DMAMUX to DMA1 channel 2. |
| NUCLEO-G474RE TIM3/TIM1 generated HAL examples | PA4 TIM3 CH2 AF2 and PA8 through PA11 TIM1 CH1 through CH4 AF6. |
| `stm32g474xx.h` | SPI1, SPI3, TIM1, TIM3, TIM16, ADC1 through ADC5, COMP1 through COMP7, DMA1/DMA2 channels, and ten DMAMUX1 channels are present for this device variant. |
| `stm32g4xx_hal_gpio_ex.h` | The selected AF macro numbers remain available. |
| `stm32g4xx_hal_dma.h` | The selected SPI and timer DMAMUX request IDs remain distinct and available. |

The pad-to-signal rows below are a narrow transcription of Table 13 in ST
DS12288 Rev. 6. The checker binds each selected function's AF number to the
installed HAL header. The package's existing NUCLEO-G474RE CubeMX examples
also independently exercise the exact part/package and several of the same
TIM1, TIM3, SPI1, and DMA surfaces. The table remains deliberately narrow: it
does not turn unused alternate functions into allocated resources.

## Alternate-function allocation

| LQFP64 pin | Pad | Signal | AF |
| --- | --- | --- | --- |
| 18 | PA4 | TIM3 CH2 conversion strobe | AF2 |
| 19 | PA5 | SPI1 SCK | AF5 |
| 20 | PA6 | SPI1 MISO | AF5 |
| 42 to 45 | PA8 to PA11 | TIM1 CH1 to CH4 primary lamp drivers | AF6 |
| 46 | PA12 | TIM16 CH1 primary buzzer driver | AF1 |
| 49 to 50 | PA13 to PA14 | SWDIO and SWCLK | AF0 |
| 51 to 54 | PA15, PC10 to PC12 | SPI3 NSS, SCK, MISO, MOSI isolated link | AF6 |

The checker reads the canonical allocation without modifying it and rejects a
drift in every selected pad, LQFP64 pin, or net. It also rejects duplicate
LQFP pins, pads, peripheral signals, or overlap between the table and the
committed GPIO-only pads. Plain GPIO remains the allocation for the fourteen
source/sink enables, the piste enables, watchdog input, and isolated
heartbeat/reset lines.

## DMA, ADC, and comparator conflict handling

The prospective requests are mechanically checked as distinct in the installed
DMAMUX table: SPI1 RX 10, SPI3 RX 14, TIM1 CH1 through CH4 42 through 45,
TIM3 CH2 62, and TIM16 CH1 82. No DMA channel is allocated by M0-08. STM32G4
uses DMAMUX, so inventing a fixed channel assignment here would be a false
closure. The bundled SPI1 CubeMX sample proves one valid SPI1 RX choice,
DMA1 channel 2, without claiming it for this board.

No internal ADC or comparator input is allocated to a BP-100 conductor. The
checker establishes that the device exposes ADC1 through ADC5 and COMP1 through
COMP7, then records their intentional non-allocation. A future request to use
one must add its pin, analog switch/routing, trigger, DMA request, and conflict
proof; it cannot inherit an unreviewed reserve pad.

## Explicit remaining blocker

`STM32CubeMX` is not installed on this workstation, and the installed
STM32CubeG4 package does not contain a generated candidate `.ioc` or project.
Consequently, no command has asked the actual CubeMX pin solver to accept all
fourteen AF rows simultaneously, configure the GPIO safe states, select
clock-tree settings, or reserve the eventual DMA channels.

M0-08 can close only after a pinned CubeMX installation imports a candidate
`STM32G474RET3` LQFP64 `.ioc`, generates the project without resolver errors,
and archives the `.ioc`, generated pin/DMA/clock source, tool/database
versions, and a rerun of this checker. The resulting configuration must retain
the existing safe-state policy and must not claim an ADC, comparator, DMA
channel, or physical behavior that has not received its own evidence.
