# BP-121 ESP32-S3 bench-prototype pad allocation

## Status and scope

This is the exact BP-121 module-pad allocation for the one-board bench
prototype's `ESP32-S3-WROOM-1U-N16R2`. It reconciles retained circuit evidence
and the responsibilities in `docs/bench-prototype-plan.md` with Espressif's
module datasheet and hardware design guidance. The executable source of truth
is `src/bench-prototype-esp32-allocation.ts`; it covers all 41 physical module
pads, including power, ground, reset, and the deliberately unconnected GPIO3.
It is a schematic-capture input, not a firmware pin-config file, routed-layout
approval, land-pattern approval, or fabrication release.

The STM32 remains the scoring authority. Every connection crossing the scoring
isolation boundary is a framed-record, fault, or reset-control signal. No
ESP32 pin may directly drive scoring excitation, qualification, lamps, or the
primary buzzer.

The module is the 16 MB Quad-SPI flash and 2 MB Quad-SPI PSRAM `N16R2`
variant. It is rated from -40 C to 85 C. The module exposes 41 pads, including
`EN`, UART0, USB-capable GPIO19/GPIO20, and an exposed ground pad. The
module data sheet specifically reserves GPIO35 to GPIO37 only on its Octal
PSRAM variants, not this R2 variant. GPIO26 to GPIO32 are not exposed by this
module and are connected to flash/PSRAM, so they are unavailable.

## Design sources

| Source | Allocation-relevant finding |
| --- | --- |
| [ESP32-S3-WROOM-1 and WROOM-1U Datasheet v1.8](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf) | Confirms the N16R2 flash/PSRAM configuration, 41-pad map, the GPIO functions, `EN`, strapping pins, and the R2 versus R8 restriction on GPIO35 to GPIO37. |
| [Espressif ESP32-S3 schematic checklist](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html) | Requires review of boot strapping, reset timing, USB, power decoupling, and safe GPIO reset behavior. |
| [Espressif ESP32-S3 PCB layout guidelines](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/pcb-layout-design.html) | Specifies the USB differential-pair, module-power, RF, and IPEX connector layout constraints. |
| [ESP-IDF GPIO guidance](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/gpio.html) | Confirms GPIO matrix routing, strapping pins, USB-JTAG ownership of GPIO19/GPIO20, and the flash/PSRAM reservation warning. |
| [ESP-IDF USB Serial/JTAG guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/usb-serial-jtag-console.html) | Confirms GPIO19 as USB D- and GPIO20 as USB D+ for the fixed-function service console and JTAG interface. |

All signal directions below are from the ESP32 perspective. GPIO
matrix routing must be declared in the ESP-IDF board configuration and then
checked against the final electrical schematic. A GPIO's appearance in this
table does not waive its electrical-reset or boot-strap requirements.

## Exact allocation

### Isolated scoring link

The existing architecture calls this a framed SPI link from the authoritative
STM32. BP-121 leaves that bus on a dedicated ESP32 SPI host/peripheral
instance, separate from the Ethernet and F-RAM bus.

| Module pad | GPIO | Function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 4 | 4 | `SCORE_SCK` | input | Isolator output must have a defined inactive level. No local pull may fight it. |
| 5 | 5 | `SCORE_MOSI` | input | Isolator output must have a defined inactive level. |
| 6 | 6 | `SCORE_MISO` | output | High impedance until the STM32 asserts `SCORE_CS`; series resistance and isolator default must prevent a false response. |
| 7 | 7 | `SCORE_CS_N` | input | Pull to inactive high on the receiving side if the isolator does not guarantee it while unpowered. |
| 8 | 15 | `ESP32_HEARTBEAT` | output | External pull-down holds the inactive failed state while the ESP32 is reset or unpowered. |
| 10 | 17 | `STM32_HEARTBEAT` | input | Pull to the declared failed state. A missing heartbeat records a fault but must not change scoring. |

The STM32-to-ESP32 reset assertion does not consume an ESP32 GPIO. It exits
the fourth STM32-to-ESP32 channel of `ISO7762FDWR` at the architectural
`RESET_REQUEST` test point. The request is active high before the isolator so
the selected F-option output defaults low when the STM32 side is absent. A
`BSS138AKA` low-side sink, driven through 10 kOhm with a 100 kOhm gate
pulldown, joins that request to the ESP32 `EN_RESET` node without tying a
push-pull isolator output directly to the open-drain reset sources. The ESP32
supervisor and watchdog assert the same active-low node independently. A
firmware-observed reset request is prohibited because wedged firmware could
ignore it. See [reset-and-display-safing.md](reset-and-display-safing.md) for
the component values and the power-off test boundary.

`ISO7762FDWR` has four STM32-to-ESP32 and two ESP32-to-STM32 channels. The
four forward channels are SCK, MOSI, CS, and reset assertion. The reverse
channels are MISO and `ESP32_HEARTBEAT`. `ISO7721FDR` carries
`STM32_HEARTBEAT` in its forward direction; its reverse channel is reserved
for service-only expansion and is not connected to `NRST`. The former event
interrupt is deliberately removed: the STM32, as SPI master, presents each
bounded frame under CS and the ESP32 accepts only a complete CRC-checked
frame. No link level is an authoritative scoring event.

### Ethernet and persistent journal SPI

W5500 and CY15B104Q F-RAM may share a non-scoring SPI bus because they have
independent chip selects. The W5500 must not share the isolated scoring link.
This allocation retains the architecture's dedicated W5500 controller while
also supplying the missing F-RAM connection.

| Module pad | GPIO | Function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 11 | 18 | `APP_SPI_SCK` to W5500 and F-RAM | output | Hold low or high impedance until both devices are out of reset. Fit the EMC RC or series footprint required by Espressif. |
| 12 | 8 | `APP_SPI_MOSI` to W5500 and F-RAM | output | Low or high impedance while inactive. |
| 17 | 9 | `APP_SPI_MISO` from W5500 and F-RAM | input | Each slave must be high impedance when its chip select is inactive. |
| 38 | 2 | `ETH_CS_N` | output | External pull-up keeps W5500 deselected through ESP32 reset. |
| 24 | 47 | `FRAM_CS_N` | output | External pull-up keeps F-RAM deselected through reset and brownout. |
| W5500 `RSTn` | n/a | supervisor-controlled hardware reset | input at W5500 | The application supervisor holds `RSTn` low through brownout and its reset delay. Firmware performs any later W5500 recovery through its documented SPI reset command. |

`INTn` is intentionally not connected to an ESP32 GPIO. The application polls
the W5500 status and socket state; Ethernet is non-authoritative, so the
bounded polling load cannot affect scoring. `INTn` receives its required
inactive pull-up at the W5500 and is available as a local test point. This
frees GPIO1 for display output and removes the former GPIO3 strap conflict.

### USB service and bench debug

| Module pad | GPIO | Function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 13 | 19 | USB D- to the required USB-C power/service receptacle | bidirectional | Route through exact `TPD2EUSB30DRTR` and exactly one module-side 22 Ohm series resistor matched to the D+ part. Do not share with Ethernet. |
| 14 | 20 | USB D+ to the required USB-C power/service receptacle | bidirectional | Route through the other `TPD2EUSB30DRTR` channel and exactly one module-side 22 Ohm series resistor matched to the D- part. Route the pair at 90 Ohm differential impedance over a continuous reference plane with matched lengths and minimal vias. |
| 36 | 44 | UART0 RX, service-header receive | input | Keep the existing six-pin service-header function. Use a high-impedance header/bridge so it cannot disturb boot. |
| 37 | 43 | UART0 TX, service-header transmit | output | Fit the Espressif-recommended TX series resistor and keep the trace short. |
| 3 | `EN` | hardware reset input | input | `R_ESP_EN_PULLUP` 10 kOhm to `V3_3`, `C_ESP_EN_DELAY` 1 uF to GND, supervisor and watchdog open-drain pulls, reset-combiner sink, and physical service reset access. Never leave floating. |
| 27 | 0 | `BOOT_N`, service-header only | input at reset | Pull up. Physical service control may pull low only while `EN` is held low to enter download mode. Do not attach a functional load. |

USB Serial/JTAG is an implemented fixed-function bench service path, not a
general application USB device. USB-OTG and USB Serial/JTAG share the internal
PHY, so a later OTG product feature needs an external PHY or a deliberate
service-mode tradeoff. The bench prototype also retains the UART0, `EN`, and
`BOOT_N` service header as an independent recovery path. The required USB-C
receptacle is the normal PD power input and carries this native USB2 service
pair through independently reviewed power and data protection paths.

`TPD4S201TRGRRQ1` belongs only to the receptacle's CC1, CC2, SBU1, and SBU2
protection path. USB D-/D+ do not pass through it: they use exact
`TPD2EUSB30DRTR`, then one matched 22 Ohm resistor per line before GPIO19 and
GPIO20. There is no second series resistor or alternate data-protection path
on either line.

External JTAG on GPIO39 to GPIO42 is not allocated. Those four pads are needed
for HUB75 output. Do not burn JTAG-selection eFuses merely to recover this
header: eFuses are irreversible. The bench board retains both USB Serial/JTAG
and the selected UART0, `EN`, and `BOOT_N` service header.

### I2C, watchdog, and controls

| Module pad | GPIO | Function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 18 | 10 | `I2C_SDA` for RV-3028, STSAFE-A110, INA238, and TPS55288 telemetry/configuration | bidirectional open-drain | One pull-up domain and capacitance calculation. All devices must release SDA while reset. |
| 19 | 11 | `I2C_SCL` for the same bus | output open-drain | One pull-up domain. Bus recovery must not change scoring behavior. |
| 20 | 12 | `APP_WD_KICK` to TPS3431 | output | The watchdog must time out and pull `EN` low if this GPIO is high impedance, stuck, or firmware is absent. |

Retained circuit evidence traces only the RTC and secure element to I2C. The power
monitor and buck-boost controller have unconnected `SDA`/`SCL` pins, so this
table adds them as intended bus members but does not claim that their voltage,
address, pull-up, or wake behavior has been approved.

No raw expansion GPIO remains after the present display, audio, Ethernet,
storage, and service requirements. Any additional buttons, LEDs, panel
controls, low-rate sensors, or identification lines must use a reset-safe I2C
expander on the existing bus, or a reviewed change to the display/audio
architecture. A future expander must default its external loads inactive and
must not be allowed to pull a strapping pin.

### Audio I2S

`TAS2505TRGERQ1` requires a digital audio stream. The existing one-net `AUDIO`
mapping is insufficient because the amplifier model also exposes `DIN` and
`SCLK`, and I2S additionally requires a word-select signal.

| Module pad | GPIO | Function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 28 | 35 | `I2S_BCLK` to TAS2505-Q1 `BCLK` | output | Hold low until audio is configured; series footprint near source. |
| 29 | 36 | `I2S_WS` to TAS2505-Q1 `WCLK` | output | Hold low until audio is configured; series footprint near source. |
| 30 | 37 | `I2S_DOUT` to TAS2505-Q1 `DIN` | output | Hold low until audio is configured; amplifier must remain held reset while clocks are absent. |

The same I2C bus configures the amplifier through its `SCL/SSZ` and `SDA/MOSI`
pins with `SPI_SEL` strapped for I2C. The application supervisor holds the
amplifier reset pin low during brownout/reset. These pads are permitted on the
N16R2 module. They would not be available on an R8 or R16 variant that uses
Octal PSRAM. The selected module part number must therefore remain locked to
an R2 configuration unless this allocation is reworked.

### HUB75 display

BP-121 names the complete 13-signal interface: six RGB data
signals, four row-address signals for the present 16-pin connector, clock,
latch, and output-enable. It assumes the final panel does not need row address
`E`.

| Module pad | GPIO | HUB75 signal | Reset-safe requirement |
| --- | ---: | --- | --- |
| 21 | 13 | `R1` | Requires an external pull-down to hold black data while the ESP32 is reset. |
| 22 | 14 | `G1` | Requires an external pull-down to hold black data while the ESP32 is reset. |
| 23 | 21 | `B1` | Requires an external pull-down to hold black data while the ESP32 is reset. |
| 9 | 16 | `R2` | Requires an external pull-down to hold black data while the ESP32 is reset. |
| 31 | 38 | `G2` | Requires an external pull-down to hold black data while the ESP32 is reset. |
| 32 | 39 | `B2` | Requires an external pull-down to hold black data while the ESP32 is reset. |
| 33 | 40 | `A` | Requires an external pull-down to select row zero while the ESP32 is reset. |
| 34 | 41 | `B` | Requires an external pull-down to select row zero while the ESP32 is reset. |
| 35 | 42 | `C` | Requires an external pull-down to select row zero while the ESP32 is reset. |
| 26 | 45 | `D` | Requires a weak external pull-down to establish the low strap; the AHCT input must be high impedance at reset. |
| 16 | 46 | `CLK` | Requires a weak external pull-down to establish the low strap; the AHCT input must be high impedance at reset. |
| 25 | 48 | `LAT` | Requires an external pull-down to prevent a latch pulse while the ESP32 is reset. |
| 39 | 1 | `OE_N` | Requires an external pull-up to keep the panel blanked while the ESP32 is reset, brownout-reset, or absent. |

Two SN74AHCT245 devices carry the 13 signals. Their directions and active-low
enables are named in the architecture model. Each data, address, clock, and
latch input now has a 10 kOhm pulldown to GND; `OE_N_IN` has a 10 kOhm pull-up
to `V3_3`; panel `OE_N_OUT` has a 10 kOhm pull-up to `V5`. Each buffer enable
has a 10 kOhm pull-up to `V5` and a reset-gated BSS138 sink, so reset or an
absent ESP32 leaves the buffers high impedance. The reset-safety contract
defines the schematic default state, while exact panel power sequencing and SI
remain open. This allocation uses GPIO45 and GPIO46 only with their required weak
pulldowns and only with the selected 3.3 V flash configuration. GPIO3 remains
unused at reset and GPIO39 through GPIO42 remain unavailable for external JTAG.

The exact panel scan ratio, current, buffer drive/series values, pull values,
and display DMA peripheral are still schematic and layout gates. They do not
change the now-complete GPIO allocation.

## Strapping, reset, and reserved-resource rules

| Resource | Required disposition | Current-map effect |
| --- | --- | --- |
| GPIO0 | Keep pulled high. Expose only as physical `BOOT_N` with controlled reset sequencing. | BP-121 connects it to the debug header's `BOOT` pin, not a product function. |
| GPIO3 | Keep electrically quiet at reset because it selects the JTAG source when the relevant eFuse is used. | Reserved and unconnected. External JTAG and its selection eFuse are not part of this product allocation. |
| GPIO45 | Default weak pull-down selects 3.3 V VDD_SPI when eFuse forcing is not used. | Drives HUB75 `D` only after reset. The pull-down and a high-impedance AHCT input preserve the required strap. |
| GPIO46 | Default weak pull-down participates in boot mode and ROM-message controls. | Drives HUB75 `CLK` only after reset. The pull-down and a high-impedance AHCT input preserve the required strap. |
| GPIO19/GPIO20 | Dedicated to USB D-/D+ and USB Serial/JTAG. | The bench board routes these pads to the required USB-C power/service receptacle and uses separate GPIOs for Ethernet. |
| GPIO26 to GPIO32 | Not exposed and occupied by flash/PSRAM. | Never allocate. |
| GPIO35 to GPIO37 | Available on N16R2 but unavailable on Octal-PSRAM R8/R16 modules. | BP-121 uses them for audio; module substitutions require a pin-map review. |
| `EN` | Hardware reset only, held high only after 3.3 V is stable. | `EN_RESET` is pulled up with 10 kOhm and delayed with 1 uF; TPS389033 (3.170 V falling / 3.189 V rising, 100 nF CT about 107 ms) and TPS3431 open-drain outputs, a BSS138 service sink, and the isolated active-high STM32 request sink it independently. No GPIO16 reset request exists. |

The external watchdog and supervisor both assert the same active-low
hardware-reset path to `EN` through open-drain outputs. The STM32-controlled
reset channel is an electrically independent BSS138 low-side path to that
same node. The source-side series and pulldown resistors and the isolated
output-side gate keep a reset source from sourcing the ESP32 rail. Power-off
injection and ISO output-side rise are still bench gates; no unpowered-domain
limit is waived by the topology.

The service header's reset control is active-high `MANUAL_RESET_ASSERT`, not
`EN_RESET`: it drives `Q_ESP_DEBUG_RESET` through a 10 kOhm gate resistor and
100 kOhm pulldown. Its drain alone reaches `EN_RESET`, so a programmer or
cable may command reset but cannot source or fight the ESP32 EN rail. The
service fixture must constrain this input to the approved 3.3 V logic level or
an isolated dry-contact driver.

## RF antenna and layout constraints

`WROOM-1U` has an external antenna connector rather than the on-module PCB
antenna, so the module drawing does not prescribe the WROOM-1 antenna keepout.
That does not remove RF placement work. The carrier must:

- place the module and external RF connector at a carrier edge with a short,
  unbranched, outer-layer 50 ohm RF route;
- keep the IPEX connector clear on every copper layer as Espressif specifies,
  avoid vias in the RF path, and use the manufacturer reference layout;
- keep USB2, the UART header, display clocks, W5500, switching power loops, and
  their test points away from the RF trace and external antenna volume;
- preserve continuous adjacent ground reference, dense ground vias around the
  RF route where specified, and the module exposed-pad ground-via pattern;
- review the installed enclosure, cable path, antenna part/gain, connector
  retention, coexistence with Ethernet/display emissions, and any changed
  certification obligations.

The present placement model puts the module in the carrier interior and does
not contain a routed IPEX connection, RF matching/ESD decision, antenna part,
or enclosure clearance drawing. It therefore does not demonstrate compliance
with these constraints.

## Resolved allocation decisions and remaining gates

| ID | BP-121 allocation decision | Remaining proof before schematic acceptance |
| --- | --- | --- |
| ESP-01 | GPIO19/GPIO20 are dedicated to USB D-/D+; W5500 and F-RAM use GPIO18/GPIO8/GPIO9 with GPIO2 and GPIO47 chip selects. | Complete exact receptacle, `TPD2EUSB30DRTR`, one matched 22 Ohm resistor on each D-/D+ line, differential-pair, shield, PD-power coexistence, and service-mode review; keep `TPD4S201TRGRRQ1` limited to CC/SBU. |
| ESP-02 | W5500 `INTn` is locally pulled inactive and polled; GPIO3 is reserved for its strap. | Verify W5500 polling latency/load and `INTn` bias against the selected W5500 revision. |
| ESP-03 | The complete 13-signal HUB75 bus is routed through two AHCT245 buffers with 10 kOhm input pulldowns, a 10 kOhm `OE_N_IN` pull-up to `V3_3`, reset-gated buffer enables, and a 10 kOhm panel `OE_N_OUT` pull-up to `V5`. | Verify the exact panel power return, scan/DMA choice, current, buffer drive, ghosting, cable behavior, and SI on EVT. |
| ESP-04 | GPIO45 is `D` and GPIO46 is `CLK`; both have 10 kOhm pulldowns and high-impedance AHCT loading at reset. | Verify resistor leakage, flash-voltage/eFuse policy, strap levels, and boot measurements on the exact N16R2 module. |
| ESP-05 | GPIO35/GPIO36/GPIO37 provide BCLK/WCLK/DIN; the audio codec control bus and reset are now named. | Verify audio clock plan, reset/mute, power rails, speaker load, and fault reporting. |
| ESP-06 | The STM32 reset assertion exits isolation at active-high `RESET_REQUEST`, not GPIO16 or `EN`, and drives a BSS138 low-side sink into `EN_RESET`. | Prove ISO output-side rise, injected current, reset release, and no unpowered-domain back-powering in the power-off test before schematic acceptance. |
| ESP-07 | Both heartbeat directions are allocated. STM32-to-ESP32 reset is one-way; no ESP32 automatic `NRST` path exists. | Freeze failure polarity, timeout, bias, and isolator power-loss behavior in the reset schematic and bench plan. |
| ESP-08 | Shared SPI now reaches F-RAM and W5500; I2C reaches RTC, secure element, monitor, converter, and audio codec; W5500 reset follows the application supervisor. | Check bus voltage, addresses, capacitance, pull-ups, W5500 reset timing, and application brownout ordering. |
| ESP-09 | USB Serial/JTAG and UART0/`EN`/`BOOT_N` are independent bench recovery paths; GPIO39-GPIO42 stay assigned to HUB75. | Complete both service-path reviews and do not burn JTAG-selection eFuses. |
| ESP-10 | Audio allocation locks the ESP32-S3-WROOM-1U-N16R2 module configuration. | Any module substitution requires pin, temperature, and RF review. |
| ESP-11 | None. | The module, W5500, connectors, land patterns, RF route, Ethernet physical layer, and mechanical interfaces still need their M4/M5 evidence. |

## Required verification before detailed schematic capture

1. Confirm the exact W5500 reset, interrupt electrical type, SPI frequency,
   crystal, analog supply, magnetics, termination, ESD, and shield/chassis
   scheme against the current WIZnet documentation.
2. Review Espressif's current WROOM-1U land pattern, exposed-pad via/paste
   arrangement, 3.3 V decoupling/LC filtering, `EN` timing, and external
   antenna connector reference layout against the actual stack-up.
3. Build a reset-state table for every ESP32-attached device at cold boot,
   watchdog reset, supervisor brownout, STM32-requested reset, USB insertion,
   USB service use, UART service-header use,
   and application firmware absence. Check that every output is inactive,
   especially W5500 CS/reset, F-RAM CS, display enables, I2S, and the isolated
   link MISO output.
4. Verify the selected display architecture against the fixed allocation. A
   16-pin HUB75 connector uses all 13 timing/data signals listed above; any
   panel requiring row address `E` requires a reviewed BP-121 change.
5. Confirm I2C pull-up voltage, addresses, bus capacitance, recovery policy,
   RTC backup domain, secure-element provisioning, and whether rail telemetry
   must remain reachable during watchdog handling.
6. Verify ESP-IDF peripheral routing and simultaneous DMA load for the two SPI
   buses, USB Serial/JTAG, UART recovery, I2C, I2S, radio, W5500 traffic, display refresh,
   and PSRAM. Software scheduling must not be used as evidence of scoring
   timing because scoring remains isolated on the STM32.
7. Execute RF, USB, Ethernet, display-emissions, audio, thermal, ESD/EFT,
   brownout, and recovery measurements on EVT hardware. These are later
   evidence gates, not assumptions discharged by this document.

## BP-121 acceptance record

BP-121 fixes a unique physical pad for the isolated link, W5500 and journal
SPI, USB service, I2C, watchdog, UART recovery, I2S, and every HUB75 signal.
It also fixes GPIO3 as `NC_STRAP_QUIET`, records GPIO26 through GPIO32 as
internal flash/PSRAM resources that are not module allocations, and leaves no
raw expansion GPIO. Strapping, flash/PSRAM, `EN`, and RF constraints retain
their required verification actions.

The allocation resolves USB, Ethernet, straps, HUB75, audio, reset, and
heartbeat collisions at the architectural-net level. It remains a
schematic-capture input until the listed electrical, firmware-routing, RF,
mechanical, and bench gates pass. Nothing in this document establishes layout
acceptance or fabrication readiness.
