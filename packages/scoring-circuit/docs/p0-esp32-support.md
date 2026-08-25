# BP-120 P0 ESP32 support, reset, and recovery reconciliation

This is the canonical support record for the sole P0 processor:
`ESP32-S3-WROOM-1-N16R2`. It reconciles the module selection with the current
BP-121 allocation. It is a schematic-input record only: no schematic, layout,
BOM, board, or fabrication authority is granted.

## Module and supply support

The selected WROOM-1 has its PCB antenna on the module. P0 firmware does not
initialize Wi-Fi or Bluetooth. If a later release enables radio, it must use
that integrated antenna and first close the WROOM-1 edge placement or 15 mm
all-direction antenna clearance, enclosure clearance, throughput, and range
evidence. There is no external antenna connector, cable, or RF matching chain.

| Reference | Exact MPN | Value | Connection and placement |
| --- | --- | --- | --- |
| `C_ESP_3V3_HF` | Murata `GCM188R71H104KA57D` | 100 nF X7R | `APP_3V3` to `APP_GND`, at module pad 2 with the shortest direct ground return |
| `C_ESP_3V3_BULK` | Murata `GCM32EC71A476KE02L` | 47 uF X7S nominal | `APP_3V3` to `APP_GND`, on the local supply island and outside the antenna clearance |

Both parts bypass the single module 3.3 V entry and neither is series-connected.
Module pad 2 is `3V3`; pads 1 and 40 and exposed pad 41 are `APP_GND` returns.
The board still needs an assembled-board measurement of effective capacitance,
rail transient margin, and component placement.

## Boot, common reset, and watchdog

`BOOT_N` is pad 27, GPIO0. `R_ESP_BOOT_PULLUP` is a 10 kOhm
`RC0603FR-0710KL` pull-up. A recovery fixture may sink it only while reset is
asserted and through `EN_RESET` release, then it releases `BOOT_N` for ROM
joint-download boot. Do not fit a high-value capacitor or an active-high driver
on `BOOT_N`.

`EN_RESET` is pad 3. It has the 10 kOhm `R_ESP_EN_PULLUP`
`RC0603FR-0710KL` pull-up and the 1 uF X5R `C_ESP_EN_DELAY`
`C1608X5R1A105K080AC` delay capacitor to `APP_GND`. The TPS389033DSER
supervisor, TPS3431SDRBR watchdog WDO plus ENOUT, manual reset, and a fixture
may only sink the common reset path open-drain. They never drive reset high.
Common reset holds `EN_RESET`, W5500 reset, primary-output disable, and HUB75
safing inactive together.

GPIO12 on pad 20 is `APP_WD_KICK`. It is open-drain, has the specified 100 kOhm
pull-up, and makes one falling-edge kick only after the aggregate acquisition,
frame-queue, reference, primary-output, rail, and watchdog-health epoch passes.
The maximum valid kick interval is 100 ms; the external watchdog timeout and
reset pulse are 170 to 230 ms. A stale, incomplete, high-Z, stuck-high, or
stuck-low source makes no repeated edge and therefore resets the common domain.

GPIO0, GPIO3, GPIO45, and GPIO46 are strapping-sensitive. GPIO3 remains
electrically unconnected and quiet. GPIO45 (`HUB75_D`) and GPIO46
(`HUB75_CLK`) keep their reviewed reset bias and must meet their strap state
before `EN_RESET` releases.

## Service and recovery

Native USB Serial/JTAG is the normal programming and recovery route. Pad 13
GPIO19 is `USB_DN`; pad 14 GPIO20 is `USB_DP`. They use the protected USB-C
path, TPD2EUSB30DRTR protection, and one matched 22 ohm resistor per line on a
90 ohm differential pair. No external JTAG header is allocated.

UART0 is the fallback route: pad 36 GPIO44 is `UART0_RX`; pad 37 GPIO43 is
`UART0_TX`. Six labeled test pads are exactly `UART0_RX`, `UART0_TX`, `BOOT_N`,
`EN_RESET`, `APP_3V3`, and `APP_GND`. Use a keyed 3.3 V-logic pogo or clip
fixture only. `APP_3V3` is sense-only and `APP_GND` is the reference; the
fixture never powers the target or presents 5 V TTL or RS-232 levels.

With USB-C disconnected and `APP_3V3` discharged, attach the fixture, apply
normal target power, hold `BOOT_N` low, sink then release `EN_RESET`, release
`BOOT_N`, program over UART0 or native USB, verify the image hash, then remove
target power before removing the fixture. No permanent service header is fitted.

## Exact 41-pad policy

Every module pad is assigned below. `reserved` means no circuit, pull, test
pad, or firmware claim in P0. `reserved-nc` is deliberately electrically quiet.

| Pad | Module pin | P0 signal | Disposition |
| ---: | --- | --- | --- |
| 1 | GND | APP_GND | ground |
| 2 | 3V3 | APP_3V3 | power |
| 3 | EN | EN_RESET | reset |
| 4 | GPIO4 | SAR_SCLK | assigned |
| 5 | GPIO5 | SAR_DOUT | assigned |
| 6 | GPIO6 | SAR_CONVST | assigned |
| 7 | GPIO7 | LAMP_RED | assigned |
| 8 | GPIO15 | LAMP_GREEN | assigned |
| 9 | GPIO16 | HUB75_R2 | assigned |
| 10 | GPIO17 | LAMP_WHITE_LEFT | assigned |
| 11 | GPIO18 | APP_SPI_SCK | assigned |
| 12 | GPIO8 | APP_SPI_MOSI | assigned |
| 13 | GPIO19 | USB_DN | assigned |
| 14 | GPIO20 | USB_DP | assigned |
| 15 | GPIO3 | NC_STRAP_QUIET | reserved-nc |
| 16 | GPIO46 | HUB75_CLK | assigned |
| 17 | GPIO9 | APP_SPI_MISO | assigned |
| 18 | GPIO10 | LAMP_WHITE_RIGHT | assigned |
| 19 | GPIO11 | BUZZER | assigned |
| 20 | GPIO12 | APP_WD_KICK | assigned |
| 21 | GPIO13 | HUB75_R1 | assigned |
| 22 | GPIO14 | HUB75_G1 | assigned |
| 23 | GPIO21 | HUB75_B1 | assigned |
| 24 | GPIO47 | P0_SPARE_GPIO47 | reserved |
| 25 | GPIO48 | HUB75_LAT | assigned |
| 26 | GPIO45 | HUB75_D | assigned |
| 27 | GPIO0 | BOOT_N | assigned |
| 28 | GPIO35 | IR_RX | assigned |
| 29 | GPIO36 | P0_SPARE_GPIO36 | reserved |
| 30 | GPIO37 | P0_SPARE_GPIO37 | reserved |
| 31 | GPIO38 | HUB75_G2 | assigned |
| 32 | GPIO39 | HUB75_B2 | assigned |
| 33 | GPIO40 | HUB75_A | assigned |
| 34 | GPIO41 | HUB75_B | assigned |
| 35 | GPIO42 | HUB75_C | assigned |
| 36 | GPIO44 | UART0_RX | assigned |
| 37 | GPIO43 | UART0_TX | assigned |
| 38 | GPIO2 | ETH_CS_N | assigned |
| 39 | GPIO1 | HUB75_OE_N | assigned |
| 40 | GND | APP_GND | ground |
| 41 | GND_EP | APP_GND | ground |

GPIO26 through GPIO32 are consumed by in-package flash and PSRAM. GPIO33 and
GPIO34 are not module-exposed. The only raw P0 spares are GPIO36, GPIO37, and
GPIO47 on pads 29, 30, and 24 respectively; they remain reserved.

The executable record and focused verification are
[`src/p0-esp32-support.ts`](../src/p0-esp32-support.ts) and
[`src/p0-esp32-support.test.ts`](../src/p0-esp32-support.test.ts).
