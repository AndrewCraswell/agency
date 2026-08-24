# BP-124 service headers

BP-124 freezes bench-service access for the exact processors selected by BP-120
and BP-121. It is a schematic-input contract for the one-board prototype, not a
fabrication release. Both headers remain DNP and the fabrication disposition is
`DENY` until footprint, mating, continuity, voltage, and recovery evidence is
archived.

## STM32 SWD

`J_STM_SWD` (the `J_STM32_SWD` BOM row) uses the Samtec
`FTSH-105-01-L-DV-007-K` keyed 10-position, dual-row 1.27 mm header with
Cortex pin 7 omitted. The orderable mating-cable candidate is Samtec
`FFSD-05-D-06.00-01-N`. Pin order is the standard 10-contact Cortex-style
numbering used by the keyed header; pin 7 has no contact:

| Pin | Net | Rule |
| ---: | --- | --- |
| 1 | `SCORING_3V3_SENSE` | target-voltage sense only; never a power input |
| 2 | `SWDIO` | 3.3 V bidirectional debug data |
| 3 | `SCORING_SGND` | probe reference |
| 4 | `SWCLK` | 3.3 V probe output |
| 5 | `SCORING_SGND` | probe reference |
| 6 | `NC_SWD_SWO_RESERVED` | unconnected; SWO is not allocated by BP-120 |
| 7 | omitted | no contact; keyed/polarized position for the Cortex cable |
| 8 | `NC_SWD_RESERVED` | unconnected |
| 9 | `SCORING_SGND` | probe reference |
| 10 | `SCORING_NRST_N` | open-drain sink only; the probe must not drive reset high |

The probe must be 3.3 V-aware and use pin 1 only for target-voltage sensing. It
must not inject power. No 5 V debug adapter is allowed. SWD service is
de-energized: power off, remove USB-C and diagnostic injection, discharge the
board, mate the keyed cable, reapply normal USB-C power only, verify target
sense and zero back-power, program and verify the image, power off and
discharge again, unmate, and then power up normally. Powered mating, powered
unmating, and external probe power are prohibited.

## ESP32 UART and boot service

`J_ESP_SERVICE` (the `J_ESP32_SERVICE` BOM row) uses the Samtec `TSW-106-07-G-S` six-position, single-row
2.54 mm through-hole header. Samtec `SSW-106-01-G-S` is the orderable mating
socket candidate for a short six-conductor service harness. Pin order is:

| Pin | Net | Rule |
| ---: | --- | --- |
| 1 | `APP_GND` | adapter reference |
| 2 | `APP_3V3_SENSE` | target-voltage sense only; never a power input |
| 3 | `UART0_TX` | ESP32 GPIO43, board to adapter |
| 4 | `UART0_RX` | ESP32 GPIO44, adapter to board |
| 5 | `BOOT_N` | open-drain pull low for ROM download mode |
| 6 | `MANUAL_RESET_ASSERT` | 3.3 V control into the local reset-sink stage; never direct `EN_RESET` |

The external adapter must be 3.3 V-compatible and referenced to `APP_GND`.
5 V TTL, RS-232 voltage, and any adapter that sources either sense pin are
prohibited. TSW-106-07-G-S and SSW-106-01-G-S are unkeyed and reversible, so a
fixture-enforced pin-1 key, label, and reversal-prevention feature is a blocking
physical gate before population or energization. To recover the ESP32, power
off and discharge the board, mate the correctly oriented harness, reapply
normal USB-C power only, verify target sense and zero back-power, drive
`BOOT_N` low before and throughout reset, release reset while retaining
`BOOT_N` low for the 10 ms post-release sample interval, then release `BOOT_N`
and transfer and verify the image. Finally power off and discharge, unmate,
and power up normally without the adapter. Powered mating, powered unmating,
and external adapter power are prohibited. `BOOT_N` is the BP-121 GPIO0 strap;
the service header never directly drives `EN_RESET`.

`MANUAL_RESET_ASSERT` drives only the BP-123 `Q_ESP_DEBUG_RESET` BSS138AKA
gate through `R_DEBUG_RESET_GATE` (`RC0603FR-0710KL`) with
`R_DEBUG_RESET_GATE_PD` (`RC0603FR-07100KL`) to `APP_GND`. The transistor source
is `APP_GND`, its drain is `EN_RESET`, and the service header has no direct
connection to `EN_RESET`.

## Required demonstration and release gates

Record de-energized continuity, key and pin-one photographs, target voltage at
both sense pins, no-back-power current, scope traces for reset and boot entry,
adapter voltage, image hashes, and the signed bench log. The STM32 proof must
show SWD identity/program/readback and safe outputs while reset is asserted.
The ESP32 proof must show UART0 traffic, `BOOT_N`, `MANUAL_RESET_ASSERT`, and
`EN_RESET` through a normal ROM-download and normal-boot cycle while the STM32
continues to own scoring.

Footprints, solder lands, courtyard, keying, mating access, continuity, and
the service procedure remain open evidence. Until those gates pass,
`J_STM_SWD` and `J_ESP_SERVICE` are DNP and fabrication remains denied.
