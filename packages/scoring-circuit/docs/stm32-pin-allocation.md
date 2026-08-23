# STM32G474RET3TR candidate pin allocation

## Status

This M0-08 document is a candidate allocation, not a schematic release, CubeMX project, hardware approval, or fabrication authorization. It audits the selected STM32G474RET3TR, its 64-pin LQFP package, the current circuit architecture, the analog-front-end proposal, and the bench-prototype plan.

The allocation preserves STM32-exclusive acquisition, scoring, lamps, and buzzer. It does not give the ESP32 an unisolated scoring signal or authority to decide a touch.

## Evidence and basis

ST's [STM32G474xB/xC/xE datasheet](https://www.st.com/resource/en/datasheet/stm32g474cb.pdf), DS12288 Rev 6, identifies the RE part as a 512-Kbyte-flash device and documents its LQFP64 pinout, five ADCs, seven comparators, HRTIM, four SPI controllers, 16-channel DMA controller, DMAMUX, and SWD. Pin numbers and the analog assignments below come from its LQFP64 pinout and pin-definition table.

The [STM32G4 reference manual](https://www.st.com/resource/en/reference_manual/rm0440-stm32g4-series-advanced-armbased-32bit-mcus-stmicroelectronics.pdf), RM0440 Rev 9, is the primary source for comparator/DAC routing, ADC and HRTIM triggering, DMA requests, and reset behavior. [STM32CubeMX](https://www.st.com/content/st_com/en/stm32cubemx.html) must solve and validate the package-level peripheral allocation before schematic capture.

The circuit model presently labels functional STM32 nets rather than physical package pins. It now reserves both heartbeat directions and a one-way STM32-to-ESP32 reset assertion. The STM32 portion still does not show physical reference supply pins, switch-enable nets, or primary-output driver circuits; the reset combiner and its bias network are represented at the ESP32-side boundary and remain subject to the power-off and timing gates below.

## Analog acquisition and reference

REF5025AQDRQ1 is the proposed external 2.5 V reference. Route its guarded, decoupled output to VREF+ only after analog review confirms load, startup, and fault behavior. VREF+ is LQFP64 pin 26, VSSA is pin 25, and VDDA is pin 27. VDDA remains filtered 3.3 V and VSSA returns to scoring analog ground.

| External conductor | MCU pad and LQFP64 pin | ADC candidate | Comparator positive input | Constraint |
| --- | --- | --- | --- | --- |
| Left A | PA0, pin 12 | ADC1, ADC12_IN1 | COMP3 INP | Shared analog pad is intentional. |
| Left B | PA1, pin 13 | ADC1, ADC12_IN2 | COMP1 INP | Shared analog pad is intentional. |
| Left C | PA3, pin 17 | ADC1, ADC1_IN4 | COMP2 INP | Keep analog, not USART2 RX. |
| Right A | PB0, pin 22 | ADC1, ADC1_IN15 | COMP4 INP | ADC3_IN12 is also available. |
| Right B | PB13, pin 33 | ADC3, ADC3_IN5 | COMP5 INP | Do not consume for SPI2 SCK. |
| Right C | PB11, pin 29 | ADC1, ADC12_IN14 | COMP6 INP | Do not consume for USART3 RX or LPUART1 TX. |
| Piste | PB14, pin 34 | ADC1, ADC1_IN5 | COMP7 INP | Do not consume for SPI2 MISO or TIM15 CH1. |

Use ADC1 regular ranks for PA0, PA1, PA3, PB0, PB11, and PB14, and ADC3 for PB13. Trigger both from a common HRTIM1 trigger at the weapon-phase cadence. The candidate reserves DMA1 channel 1 for ADC1 and DMA1 channel 2 for ADC3, each in circular mode into an STM32-owned sample ring. DMAMUX selects requests, so the channel labels are a project convention, not fixed routing.

Use HRTIM1 as phase scheduler and fast-event timestamp owner. Reserve DMA1 channel 5 for an HRTIM event-log transfer if the selected capture route exposes a DMA request. The exact comparator-to-HRTIM capture path, concurrent-event capacity, and DMA request must be proven. A one-microsecond timestamp target cannot rely on interrupt latency.

### Comparator thresholds

| Comparator | Positive source | Candidate negative source | Constraint |
| --- | --- | --- | --- |
| COMP1 | Left B, PA1 | Internal DAC1 channel 1 | PA4 is SPI1 NSS. Prove internal DAC routing does not contend with pad mux. |
| COMP2 | Left C, PA3 | Internal DAC1 channel 2 | PA5 is SPI1 SCK. Prove internal DAC routing does not contend with pad mux. |
| COMP3 | Left A, PA0 | Internal DAC3 channel 1 | Verify exact G474 matrix and usable threshold range. |
| COMP4 | Right A, PB0 | Internal DAC3 channel 2 | Verify exact G474 matrix and usable threshold range. |
| COMP5 | Right B, PB13 | Internal DAC4 channel 1 | Verify exact G474 matrix and usable threshold range. |
| COMP6 | Right C, PB11 | Internal DAC4 channel 2 | Verify exact G474 matrix and usable threshold range. |
| COMP7 | Piste, PB14 | Internal DAC4 channel 1 shared with COMP5 | Only valid if their active phases require the same threshold. |

VREFINT and its fractions are not substitutes for REF5025-derived thresholds. The coupon must establish whether internal DAC thresholds are accurate and repeatable enough for fast transition qualification. If not, a protected precision threshold node on unused comparator INM pads or external comparators is required. Neither alternative is selected here.

## Seven-conductor source and sink enables

Each TMUX1112 source/sink channel needs its own enable. These 14 GPIOs provide one source and one sink control per conductor. All switch-enable inputs require physical pulldowns so reset, an unpopulated MCU, or a floating boot pin leaves every switch off.

| Conductor | Source enable | Sink enable | Safe reset state |
| --- | --- | --- | --- |
| Left A | PC0, pin 8 | PC1, pin 9 | Both low through external pulldowns. |
| Left B | PC2, pin 10 | PC3, pin 11 | Both low through external pulldowns. |
| Left C | PB2, pin 24 | PB3, pin 43 | Both low. PB3 cannot be SWO. |
| Right A | PB4, pin 44 | PB5, pin 45 | Both low. PB4 cannot be JTAG reset. |
| Right B | PB6, pin 46 | PB7, pin 47 | Both low through external pulldowns. |
| Right C | PB9, pin 50 | PB10, pin 28 | Both low through external pulldowns. |
| Piste | PB12, pin 32 | PB15, pin 35 | Both low through external pulldowns. |

PB3 and PB4 are available only with production SWD, without JTAG or SWO. PA13 and PA14 remain dedicated to SWD. The electrical design must prove that reset-time debug functions cannot overcome enable pulldowns.

## Lamps, buzzer, watchdog, reset, and SWD

| Function | MCU pad and LQFP64 pin | Role | Safe state |
| --- | --- | --- | --- |
| Red primary lamp | PA8, pin 36 | TIM1 CH1 PWM or GPIO to scoring-domain driver | Driver input has physical pull-down; lamp off until enabled. |
| Green primary lamp | PA9, pin 37 | TIM1 CH2 PWM or GPIO to scoring-domain driver | Same as red. |
| Left white lamp | PA10, pin 38 | TIM1 CH3 PWM or GPIO to scoring-domain driver | Same as red. |
| Right white lamp | PA11, pin 39 | TIM1 CH4 PWM or GPIO to scoring-domain driver | Same as red. |
| Buzzer | PA12, pin 40 | TIM16 CH1 PWM or GPIO to scoring-domain driver | Driver input has physical pull-down; buzzer silent. |
| Watchdog service | PB1, pin 23 | GPIO pulse to STM32-domain TPS3431 WDI | Do not service until RAM, reference, and front-end tests pass. |
| MCU reset | NRST, pin 7 | Dedicated reset input | Combine supervisor, TPS3431, SWD, and isolated reset with reviewed open-drain or equivalent logic. |
| SWD data | PA13, pin 55 | SWDIO | Reserved for service and debug. |
| SWD clock | PA14, pin 54 | SWCLK | Reserved for service and debug. |

MCU reset defaults alone are insufficient. Lamp and buzzer driver pull networks must also keep outputs inactive, and front-end pulldowns must keep source/sink switches off.

## Isolated SPI and control link

SPI1 uses AF5. DMA1 channel 3 is reserved for SPI1 RX and DMA1 channel 4 for SPI1 TX, with DMAMUX selecting the requests. Transfers remain bounded and CRC-checked. Link loss cannot change STM32 acquisition, timing, lamps, or buzzer.

| Isolated net | Direction at STM32 | MCU pad and LQFP64 pin | Role | Reset-safe state |
| --- | --- | --- | --- | --- |
| SCORE_SPI_NSS | STM32 to ESP32 | PA4, pin 18 | SPI1 NSS, AF5 | External pull-up at isolator input deselects the link. |
| SCORE_SPI_SCK | STM32 to ESP32 | PA5, pin 19 | SPI1 SCK, AF5 | External pull-down keeps clock inactive. |
| SCORE_SPI_MISO | ESP32 to STM32 | PA6, pin 20 | SPI1 MISO, AF5 | Receiver-side bias must be defined. |
| SCORE_SPI_MOSI | STM32 to ESP32 | PA7, pin 21 | SPI1 MOSI, AF5 | External pull-down keeps data inactive. |
| STM32_HEARTBEAT | STM32 to ESP32 | PB8-BOOT0, pin 49 | GPIO through ISO7721 | Boot0 has a permanent pull-down; isolator sees inactive state during boot. |
| ESP32_HEARTBEAT | ESP32 to STM32 | PC14, pin 3 | GPIO input through ISO7762 | Consumes an LSE-capable pad. The isolator default and input bias must represent a failed heartbeat. |
| ESP32_RESET_N | STM32 to ESP32 | PC15, pin 4 | GPIO through ISO7762 | Isolator and ESP reset network must be defined when STM32 is unpowered or resetting. |

`ISO7762FDWR` is a fixed four-forward/two-reverse device. Its four STM32-to-ESP32 channels are SPI SCK, MOSI, CS, and the reset assertion. Its two ESP32-to-STM32 channels are SPI MISO and the ESP32 heartbeat. `ISO7721FDR` carries the STM32 heartbeat and retains its reverse channel as an unconnected future service-only spare. There is intentionally no ESP32-to-STM32 automatic reset channel: the ESP32 must never assert `NRST` for an application, link, storage, display, or network fault. STM32 and ESP32 local supervisors, watchdogs, and service interfaces remain independent reset sources in their own domains.

The event interrupt was removed from the physical link to make the allocation conform to the isolator's actual direction count. The STM32 is the SPI master and delivers a bounded frame under `SCORE_CS_N`; the ESP32 treats a complete CRC-checked frame as the only event indication. No interrupt level is authoritative.

PA4, PA5, and PA6 are also DAC output pads. SPI1 on them prevents external DAC output there. CubeMX and RM0440 must prove the selected internal comparator-DAC routes coexist with the pad mux. If they do not, moving SPI1 creates a new collision with the source/sink allocation and requires a revised design.

## Clock, boot, and alternate-function constraints

- Reserve PF0, pin 5, and PF1, pin 6, for HSE until firmware proves internal-clock tolerance meets all scoring and communication requirements.
- PC14 and PC15 are link GPIO in this candidate, so no LSE crystal is allocated. ESP32-side RV-3028 owns wall-clock time. An STM32 LSE or backup-domain requirement creates a conflict.
- PB8 remains a boot strap even as a post-boot heartbeat. Keep its pull-down sized for the boot requirement and isolator leakage. Do not rely on firmware for boot safety.
- PC13 has output-drive and leakage limits that must be checked against the isolator input. It is not a general high-current output.
- Keep PA13, PA14, NRST, and every acquisition pad out of unrelated display, network, or application-controller assignments.

## Required CubeMX, datasheet, and bench verification

1. Solve this exact STM32G474RET3TR LQFP64 configuration in CubeMX with ADC1, ADC3, COMP1 through COMP7, required DACs, HRTIM1, TIM1, TIM16, SPI1, DMA1, SWD, and all named GPIO.
2. Confirm every comparator positive input and selected DAC negative input can operate simultaneously, including PA4 through PA6 configured for SPI1 and DAC4 channel 1 shared by COMP5 and COMP7.
3. Confirm HRTIM comparator-event routing, capture capacity, ADC trigger timing, timestamp resolution, and DMA mapping for all seven inputs.
4. Confirm ADC synchronization, rank ordering, sample time with the 1 kohm and 470 pF input filter, calibration, overrun behavior, DMA circular buffering, and reference startup.
5. Check absolute maximum, injection current, analog-input, VREF+, VDDA, and reset limits against final clamps. The analog document intentionally leaves its clamp network unresolved.
6. Check PB3/PB4 debug release, PB8 boot bias, PC14/PC15 loss of LSE, PA4 through PA6 SPI versus DAC pads, and all listed alternate functions.
7. Use the coupon and fixture to prove reset, brownout, watchdog reset, missing reference, stuck source/sink enable, ADC saturation, and isolator power loss cannot qualify a touch. Capture lamps and buzzer in the same tests.

## Open items and blockers

| Item | Why open | Effect |
| --- | --- | --- |
| Comparator threshold topology | DAC calibration and COMP5/COMP7 threshold sharing are not proven. | Blocks acceptance of comparator allocation. |
| HRTIM event capture matrix | Seven-channel internal capture has not been demonstrated. | Blocks the one-microsecond timestamp claim. |
| Physical reference, supply, and clamp schematic | Circuit model has a VREF label but not VREF+, VDDA, VSSA, or final protection. | Blocks ADC-accuracy and schematic acceptance. |
| Heartbeat and ESP reset electrical implementation | The map now reserves both heartbeats and an active-high one-way reset assertion. The ESP32 side uses the ISO7762F low-default output, 10 kOhm source/gate resistors, 100 kOhm pulldowns, BSS138 low-side sinks, TPS389033 at 3.170 V falling / 3.189 V rising, a 100 nF CT for about 107 ms nominal delay, TPS3431 WDO, and a 10 kOhm plus 1 uF EN network. | Schematic candidate is represented. The application V3_3 regulator is absent from this model and must be specified separately to guarantee 3.30 V +/-1% at the supervisor pins; otherwise select a lower-threshold or adjustable supervisor. ISO output-side rise, power-off injection, reset timing, and unpowered-domain fault tests remain open; see [reset-and-display-safing.md](reset-and-display-safing.md). |
| Output drivers and pull networks | Lamps and buzzer are logical nets only. | Blocks safe-output acceptance. |
| Oscillator decision | HSE is reserved; LSE is displaced; tolerance and startup are unproven. | Blocks target clock configuration. |
| CubeMX package proof | This is manual audit, not solver output. | Blocks declaring AF conflicts closed. |

## Documentation-only acceptance

Every seven-conductor signal maps to a real LQFP64 ADC and comparator positive input. The candidate also maps 14 independent analog switch enables, reference pins, timer roles, DMA roles, isolated SPI, two directional heartbeats, a one-way application-reset assertion, lamps, buzzer, watchdog, reset, and SWD. It explicitly names unresolved alternate-function, schematic, timing, and analog risks and makes no electrical, regulatory, FIE, CubeMX, or fabrication approval claim.
