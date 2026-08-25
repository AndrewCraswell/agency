# BP-124 ESP32 service access

The P0 board has no populated programming header. Native ESP32-S3 USB is the
normal programming and recovery interface. Six labeled test pads expose
`UART0_TX`, `UART0_RX`, `BOOT_N`, `EN_RESET`, `APP_3V3`, and `APP_GND` for a
keyed pogo or clip fixture when native USB recovery is insufficient.

Both the former STM32 SWD header and the proposed ESP32 pin header are DNP.
This removes two connector families, mating-access constraints, and a
reversal hazard while retaining recoverability.

The fixture must use 3.3 V logic, may only sink `BOOT_N` and `EN_RESET`, and
must never power the target. Attach and remove it only with USB-C disconnected
and `APP_3V3` discharged. Fabrication remains denied until pad placement,
fixture orientation, continuity, no-back-power, and recovery evidence exists.
