# BP-125 processor support contract

P0 has one controller: `ESP32-S3-WROOM-1U-N16R2`. It runs the ESP-IDF target
adapter and portable C17 scoring core. This is a schematic-input contract, not
a schematic, layout, power-up, RF, or fabrication approval. The executable
contract is `src/bench-prototype-processor-support.ts`.

## Selected processor support

| Reference | Exact MPN | P0 role |
| --- | --- | --- |
| `R_ESP_BOOT_PULLUP` | Yageo `RC0603FR-0710KL` | 10 kOhm GPIO0 `BOOT_N` pull-up |
| `R_ESP_EN_PULLUP` | Yageo `RC0603FR-0710KL` | 10 kOhm `EN_RESET` open-drain pull-up |
| `C_ESP_EN_DELAY` | TDK `C1608X5R1A105K080AC` | 1 uF X5R enable delay |
| `C_ESP_3V3_HF` | Murata `GCM188R71H104KA57D` | 100 nF local 3.3 V bypass |
| `C_ESP_3V3_BULK` | Murata `GCM32EC71A476KE02L` | 47 uF nominal local 3.3 V reservoir |

Place the bypass and bulk parts at the module supply entry with a direct
`APP_GND` return. Final effective capacitance, ripple, transient behavior,
reset timing, and placement are still physical evidence gates.

## Required boundaries

- GPIO0 is pulled high. A recovery fixture may hold it low only across
  `EN_RESET` release. Every reset source may only sink `EN_RESET`.
- Native USB Serial/JTAG uses GPIO19 and GPIO20 through the protected USB-C
  path and its matched 22 ohm series pair. UART0 plus labeled test pads are
  the only other recovery route. No populated programming header is used.
- GPIO4, GPIO5, and GPIO6 are the dedicated SPI3/GDMA acquisition signals.
  GPIO35 is input-only `IR_RX` for the TSOP38438. W5500 uses SPI2 and is
  polled. GPIO7, GPIO10, GPIO11, GPIO15, and GPIO17 directly feed the one
  protected primary lamp and buzzer driver, whose hardware enable holds every
  output off before firmware and during faults. HUB75 remains blank until
  external hardware sees a complete safe frame. No serialized output latch or
  SPI2 shift-register is part of P0.
- Wi-Fi and Bluetooth remain disabled without a reviewed populated antenna.
  No flash, NVS, OTA, filesystem, or log erase/write is permitted while
  scoring acquisition is active. The listed spare pins remain reserved.

STM32, processor isolators and cross-domain reset, F-RAM, RTC, secure element,
audio, speaker, and external antenna are not P0 hardware. Schematic, rail,
reset, RF, and fabrication authority remain denied pending their independent
evidence.
