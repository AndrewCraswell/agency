# BP-120 STM32G474RET3TR LQFP64 allocation

## Status

This is the executable, fail-closed BP-120 allocation for the exact
`STM32G474RET3TR` LQFP64 package. It is a pin-allocation contract only. It is
not a schematic release, CubeMX result, board approval, or fabrication
authorization.

It follows the committed BP-100 one-cell decision and BP-103 seven-channel
replication. Seven `ADS8881IDGS` devices share one `CONVST` and one `SCLK` and
use the converter's documented daisy-chain mode; BP-103 does not invent seven
dedicated `DOUT` or `CONVST` GPIO allocations.

The STM32 remains the sole scoring authority. The ESP32 can receive bounded,
CRC-checked records and health information across isolation, but cannot
create, alter, clear, classify, or timestamp a score, nor drive primary lamps,
the buzzer, acquisition, or `NRST`.

## Package basis

Pin names and numbers are from ST DS12288 Rev. 6, Figure 7 and Table 12 for
the LQFP64 package. In particular, `PC4`/`PC5` are pins 22/23 and the supply
positions at 27 through 32 mean the older candidate's PB10-through-PB15 and
PA8-through-PA15 numbering was not correct. The source of truth that tests consume is
[`stm32-pin-allocation.ts`](../src/stm32-pin-allocation.ts).

## Exact pad to net allocation

| Pins | Pads | Nets or policy |
| --- | --- | --- |
| 1 to 7 | VBAT, PC13, PC14, PC15, PF0, PF1, NRST | VBAT ties explicitly to `SCORING_3V3` because no backup supply is allocated; PC13 unconnected; PC14/PC15 unconnected with no LSE; `HSE_IN_RESERVED`, `HSE_OUT_RESERVED`; `SCORING_NRST_N`. |
| 8 to 11 | PC0, PC1, PC2, PC3 | `LEFT_A_SOURCE_EN`, `LEFT_A_SINK_EN`, `LEFT_B_SOURCE_EN`, `LEFT_B_SINK_EN`. |
| 12 to 16 | PA0, PA1, PA2, VSS, VDD | PA0 through PA2 are unconnected analog reserve; `SCORING_DGND`, `SCORING_3V3`. |
| 17 to 24 | PA3, PA4, PA5, PA6, PA7, PC4, PC5, PB0 | PA3 and PA7 are unconnected analog reserve; `SAR0_CONVST_TIM3_CH2`, `SAR0_SCLK_SPI1_SCK`, `SAR0_DOUT_SPI1_MISO`; PC4/PC5 unconnected reserve; `LEFT_C_SOURCE_EN`. |
| 25 to 32 | PB1, PB2, VSSA, VREF+, VDDA, PB10, VSS, VDD | `LEFT_C_SINK_EN`, `RIGHT_A_SOURCE_EN`, `SCORING_AGND`, `SCORING_VREF_2V5`, `SCORING_3V3_ANALOG`, `RIGHT_A_SINK_EN`, `SCORING_DGND`, `SCORING_3V3`. |
| 33 to 41 | PB11, PB12, PB13, PB14, PB15, PC6, PC7, PC8, PC9 | `RIGHT_B_SOURCE_EN`, `RIGHT_B_SINK_EN`, `RIGHT_C_SOURCE_EN`, `RIGHT_C_SINK_EN`, `PISTE_SOURCE_EN`, `PISTE_SINK_EN`; PC7/PC8 unconnected reserve; `SCORING_WATCHDOG_WDI`. |
| 42 to 48 | PA8, PA9, PA10, PA11, PA12, VSS, VDD | `PRIMARY_LAMP_RED_TIM1_CH1`, `PRIMARY_LAMP_GREEN_TIM1_CH2`, `PRIMARY_LAMP_LEFT_WHITE_TIM1_CH3`, `PRIMARY_LAMP_RIGHT_WHITE_TIM1_CH4`, `PRIMARY_BUZZER_TIM16_CH1`, `SCORING_DGND`, `SCORING_3V3`. |
| 49 to 56 | PA13, PA14, PA15, PC10, PC11, PC12, PD2, PB3 | `SWDIO`, `SWCLK`, SPI3 NSS/SCK/MISO/MOSI for the isolated link, PD2 unconnected reserve, `STM32_HEARTBEAT_ISOLATED`. |
| 57 to 64 | PB4, PB5, PB6, PB7, PB8-BOOT0, PB9, VSS, VDD | `ESP32_HEARTBEAT_ISOLATED`, `ESP32_RESET_ASSERT_ISOLATED`, PB6/PB7/PB9 unconnected reserve, permanent BOOT0 pull-down, `SCORING_DGND`, `SCORING_3V3`. |

Every source/sink enable has an external pulldown. Every lamp/buzzer driver
input has an external inactive pull. This makes reset, a missing MCU, and a
floating reset-stage pad fail safe without relying on firmware.

## BP-100 one-channel ADS8881 interface

| Signal | STM32 pad and LQFP64 pin | Role |
| --- | --- | --- |
| `SAR0_CONVST` | PA4, 18 | TIM3 CH2 candidate conversion strobe. |
| `SAR0_SCLK` | PA5, 19 | SPI1 SCK. |
| `SAR0_DOUT` | PA6, 20 | SPI1 MISO receive. |
| `SAR0_DIN` | No MCU pad | Static mode strap only; its approved operating mode must be captured in the BP-103/firmware interface review. |

TI specifies `CONVST`, `DOUT`, `SCLK`, and `DIN` as the relevant digital
signals. It lists up to 70 MHz SCLK and a 1 microsecond minimum conversion
period, but neither figure proves the final MCU waveform, receiver margin, or
DMA behavior. TIM3/SPI1 synchronization, the safe static DIN level, trace
loading, and end-to-end jitter remain measured acceptance items.

The internal ADCs and comparators are intentionally not presented as the
primary BP-100 path: PA0, PA1, PA2, PA3, and PA7 are left as analog reserve,
and no `COMP1` through `COMP7` positive or negative input is connected to a
BP-100 conductor. HRTIM1 can be evaluated as an internal scheduler/timebase,
but no HRTIM-to-pad or comparator capture claim is closed by this allocation.

## BP-103 seven-channel serialization

BP-103 selects the ADS8881 daisy chain without a busy indicator. `PA4/TIM3_CH2`
drives all seven `CONVST` inputs, `PA5/SPI1_SCK` drives every clock input, and
ADC 7 `DOUT` reaches `PA6/SPI1_MISO`. ADC 1 `DIN` is grounded and each preceding
`DOUT` feeds the next `DIN`, so the host receives ADC 7 through ADC 1. The
selected arithmetic screen uses a 20-MHz SCLK.

Selection does not authorize integration or scoring. Exact schematic review,
126-bit framing, timing margin, crosstalk, power/reference disturbance, parser,
and bench evidence remain open, and the release state remains `deny`.

## Isolated scoring-to-application link

SPI3 is separate from the ADS8881 SPI1 interface:

| Net | Pad and pin | Direction at STM32 |
| --- | --- | --- |
| `SCORE_CS_N` | PA15, 51 | STM32 to ESP32 |
| `SCORE_SCK` | PC10, 52 | STM32 to ESP32 |
| `SCORE_MISO` | PC11, 53 | ESP32 to STM32 |
| `SCORE_MOSI` | PC12, 54 | STM32 to ESP32 |
| `STM32_HEARTBEAT` | PB3, 56 | STM32 to ESP32 |
| `ESP32_HEARTBEAT` | PB4, 57 | ESP32 to STM32 |
| `ESP32_RESET_ASSERT` | PB5, 58 | STM32 to ESP32 only |

The isolator direction and default levels remain BP-122 work. There is no
ESP32-to-STM32 reset path. Link failure leaves acquisition and primary outputs
under STM32 safe-state control.

## Clock, boot, debug, and unused-pad policy

PF0/PF1 are reserved for HSE. Before release, populate and validate an HSE
solution or prove the internal clock tolerance for all scoring and transport
timing. PC14/PC15 are unconnected, so any STM32 LSE or backup-domain timing
requirement is a new allocation conflict.

PB8-BOOT0 has a permanent pull-down. PA13, PA14, and NRST are service-only;
production SWD means neither JTAG nor SWO is required. No unused GPIO has an
external functional net. Firmware must apply the low-leakage safe state after
reset, and hardware must preserve every external safe pull while a pad is
floating.

## Required closure evidence

1. CubeMX/package proof for SPI1, SPI3, TIM3 CH2, TIM1 CH1 through CH4,
   TIM16 CH1, SWD, HSE, and every GPIO.
2. Bench timing for ADS8881 `CONVST`, SCLK, DOUT, receiver setup/hold, DMA,
   timestamp jitter, and power/reference disturbance.
3. BP-103 channel-by-channel converter, data, conversion-strobe, crosstalk,
   and power allocation. No generic replication block is sufficient.
4. BP-122 isolator direction/default-level and powered/unpowered truth table.
5. Reset, watchdog, missing-clock/reference, driver-pull, BOOT0, and
   disconnected-isolator tests showing a touch cannot be qualified unsafely.
