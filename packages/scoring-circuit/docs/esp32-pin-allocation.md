# Candidate ESP32-S3 pin and peripheral allocation

## Status and scope

This is the M0-09 candidate allocation for the application carrier's
ESP32-S3-WROOM-1U-N16R2. It reconciles the named nets in
`src/index.circuit.tsx` and the responsibilities in
`docs/production-board-plan.md` with Espressif's module datasheet and hardware
design guidance. It is a review input, not a schematic, firmware pin-config
file, land-pattern approval, or fabrication release.

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

All candidate signal directions below are from the ESP32 perspective. GPIO
matrix routing must be declared in the ESP-IDF board configuration and then
checked against the final electrical schematic. A GPIO's appearance in this
table does not waive its electrical-reset or boot-strap requirements.

## Candidate allocation

### Isolated scoring link

The existing architecture calls this a framed SPI link from the authoritative
STM32. The candidate leaves that bus on a dedicated ESP32 SPI host/peripheral
instance, separate from the Ethernet and F-RAM bus.

| Module pad | GPIO | Candidate function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 4 | 4 | `SCORE_SCK` | input | Isolator output must have a defined inactive level. No local pull may fight it. |
| 5 | 5 | `SCORE_MOSI` | input | Isolator output must have a defined inactive level. |
| 6 | 6 | `SCORE_MISO` | output | High impedance until the STM32 asserts `SCORE_CS`; series resistance and isolator default must prevent a false response. |
| 7 | 7 | `SCORE_CS_N` | input | Pull to inactive high on the receiving side if the isolator does not guarantee it while unpowered. |
| 8 | 15 | `SCORE_EVENT_IRQ_N` | input | Pull inactive high. Treat any boot-time level as non-authoritative until a framed record passes CRC and sequence checks. |
| 9 | 16 | `STM32_LINK_RESET_N` | input | Diagnostic or reset request only. It is not the ESP32 hardware reset. |
| 10 | 17 | `STM32_HEARTBEAT` | input | Pull to the declared failed state. A missing heartbeat records a fault but must not change scoring. |

`STM32_LINK_RESET_N` is deliberately named as an input request, rather than
`EN_RESET`. A true STM32-to-ESP32 reset must reach `EN` through a
reset-qualified, isolated open-drain or transistor stage. It must not be
implemented by firmware observing GPIO16. The supervisor and watchdog must
also be able to pull `EN` low without either processor's cooperation.

### Ethernet and persistent journal SPI

W5500 and CY15B104Q F-RAM may share a non-scoring SPI bus because they have
independent chip selects. The W5500 must not share the isolated scoring link.
This allocation retains the architecture's dedicated W5500 controller while
also supplying the missing F-RAM connection.

| Module pad | GPIO | Candidate function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 11 | 18 | `APP_SPI_SCK` to W5500 and F-RAM | output | Hold low or high impedance until both devices are out of reset. Fit the EMC RC or series footprint required by Espressif. |
| 12 | 8 | `APP_SPI_MOSI` to W5500 and F-RAM | output | Low or high impedance while inactive. |
| 17 | 9 | `APP_SPI_MISO` from W5500 and F-RAM | input | Each slave must be high impedance when its chip select is inactive. |
| 38 | 2 | `ETH_CS_N` | output | External pull-up keeps W5500 deselected through ESP32 reset. |
| 39 | 1 | `ETH_IRQ_N` | input | Pull high. It replaces the current GPIO3 assignment to avoid a boot-strap pin. |
| 24 | 47 | `FRAM_CS_N` | output | External pull-up keeps F-RAM deselected through reset and brownout. |
| 25 | 48 | `ETH_RESET_N` | output | External pull-down holds W5500 reset asserted until application 3.3 V and ESP32 initialization are valid. Confirm W5500 reset timing and polarity from its current data sheet. |

`ETH_RESET_N` may instead be generated by the application-domain supervisor if
the final W5500 reset-duration analysis shows that a GPIO-generated reset is
not sufficiently deterministic. This choice consumes the last unassigned
non-strapping application GPIO, so the schematic review must select one
method, not both.

### USB service and debug

| Module pad | GPIO | Candidate function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 13 | 19 | USB D- to the service USB-C receptacle | bidirectional | Reserve 22 or 33 ohm series footprints and optional shunt-capacitor footprints at the module side. Do not share with Ethernet. |
| 14 | 20 | USB D+ to the service USB-C receptacle | bidirectional | Route as a 90 ohm differential pair with a continuous reference plane, matched lengths, and minimal vias. |
| 36 | 44 | UART0 RX, service-header receive | input | Keep the existing six-pin service-header function. Use a high-impedance header/bridge so it cannot disturb boot. |
| 37 | 43 | UART0 TX, service-header transmit | output | Fit the Espressif-recommended TX series resistor and keep the trace short. |
| 3 | `EN` | hardware reset input | input | 10 kOhm pull-up and local reset timing network, short trace, supervisor and watchdog open-drain pulls, and physical service reset access. Never leave floating. |
| 27 | 0 | `BOOT_N`, service-header only | input at reset | Pull up. Physical service control may pull low only while `EN` is held low to enter download mode. Do not attach a functional load. |

USB Serial/JTAG is the normal factory and development JTAG path. It is a fixed
function interface, not a general application USB device. USB-OTG and USB
Serial/JTAG share the internal PHY, so a later OTG product feature needs an
external PHY or a deliberate service-mode tradeoff. The production plan calls
USB-C a service/data port, not a power source; the connector's CC, VBUS sense,
ESD, shield, and 5 V isolation/protection details remain a separate schematic
decision.

External JTAG on GPIO39 to GPIO42 is not allocated. Those four pads are needed
for HUB75 output. Do not burn JTAG-selection eFuses merely to recover this
header: eFuses are irreversible and the USB Serial/JTAG service path exists.

### I2C, watchdog, and controls

| Module pad | GPIO | Candidate function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 18 | 10 | `I2C_SDA` for RV-3028, STSAFE-A110, INA238, and TPS55288 telemetry/configuration | bidirectional open-drain | One pull-up domain and capacitance calculation. All devices must release SDA while reset. |
| 19 | 11 | `I2C_SCL` for the same bus | output open-drain | One pull-up domain. Bus recovery must not change scoring behavior. |
| 20 | 12 | `APP_WD_KICK` to TPS3431 | output | The watchdog must time out and pull `EN` low if this GPIO is high impedance, stuck, or firmware is absent. |

The current circuit traces only the RTC and secure element to I2C. The power
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

TAS2505-Q1 requires a digital audio stream. The existing one-net `AUDIO`
mapping is insufficient because the amplifier model also exposes `DIN` and
`SCLK`, and I2S additionally requires a word-select signal.

| Module pad | GPIO | Candidate function | Direction | Reset-safe requirement |
| --- | ---: | --- | --- | --- |
| 28 | 35 | `I2S_BCLK` to TAS2505-Q1 | output | Hold low until audio is configured; series footprint near source. |
| 29 | 36 | `I2S_WS` to TAS2505-Q1 | output | Hold low until audio is configured; series footprint near source. |
| 30 | 37 | `I2S_DOUT` to TAS2505-Q1 `DIN` | output | Hold low until audio is configured; amplifier must remain muted/reset while clocks are absent. |

These pads are permitted on the N16R2 module. They would not be available on
an R8 or R16 variant that uses Octal PSRAM. The selected module part number
must therefore remain locked to an R2 configuration unless this allocation is
reworked.

### HUB75 display

The carrier's current model contains only `DISPLAY_DATA` to one buffer input
and one `R1` connector trace. A real HUB75 interface requires the six RGB data
signals, four row-address signals for the present 16-pin connector, clock,
latch, and output-enable. The following is the minimal 13-signal candidate for
that connector. It assumes the final panel does not need row address `E`.

| Module pad | GPIO | HUB75 signal | Reset-safe requirement |
| --- | ---: | --- | --- |
| 21 | 13 | `R1` | Buffer disabled and panel blanked until application output state is configured. |
| 22 | 14 | `G1` | Buffer disabled and panel blanked until application output state is configured. |
| 23 | 21 | `B1` | Buffer disabled and panel blanked until application output state is configured. |
| 31 | 38 | `R2` | Buffer disabled and panel blanked until application output state is configured. |
| 32 | 39 | `G2` | Buffer disabled and panel blanked until application output state is configured. |
| 33 | 40 | `B2` | Buffer disabled and panel blanked until application output state is configured. |
| 34 | 41 | `A` | Buffer disabled and panel blanked until application output state is configured. |
| 35 | 42 | `B` | Buffer disabled and panel blanked until application output state is configured. |
| 26 | 45 | `C` | GPIO45 strap must remain low throughout reset. Use a weak external pull-down and a high-impedance buffer input. |
| 16 | 46 | `D` | GPIO46 strap must remain low throughout reset. Use a weak external pull-down and a high-impedance buffer input. |
| 24 | 47 | `CLK` | Conflict: GPIO47 is already required for F-RAM chip select. Not allocated. |
| 25 | 48 | `LAT` | Conflict: GPIO48 is already required for W5500 reset. Not allocated. |
| 17 | 9 | `OE_N` | Conflict: GPIO9 is already required for shared SPI MISO. Not allocated. |

The table intentionally exposes that the proposed full HUB75 interface does
not fit alongside the selected peripheral set. It is not an approved mapping.
GPIO45 and GPIO46 are shown only to establish the tightest possible candidate;
their strapping loads and the 5 V level-shifter input behavior need electrical
review before use. The current `SN74AHCT245` symbol has no complete mapping of
its two output banks, direction controls, or active-low output enables.

One of the following architecture decisions is required before a real display
allocation can be made:

1. Select a display interface/driver that reduces the ESP32 pin count.
2. Move display refresh to a dedicated controller with a bounded command bus.
3. Remove, relocate, or multiplex a non-display peripheral only after proving
   the reset and timing implications.
4. Add a reviewed GPIO expander only for low-rate controls. It cannot drive
   HUB75 pixel timing.

The default-off requirement is separate from GPIO numbering. The level-shifter
output enables and panel `OE_N` need hardware that keeps every display output
disabled or blanked during power-up, watchdog reset, brownout, and ESP32
boot. GPIO46's default low strap state cannot by itself satisfy that safety
requirement. The selected panel, refresh rate, current draw, and exact buffer
topology must be decided before DMA/I2S/LCD-CAM usage or display signal
integrity can be verified.

## Strapping, reset, and reserved-resource rules

| Resource | Required disposition | Current-map effect |
| --- | --- | --- |
| GPIO0 | Keep pulled high. Expose only as physical `BOOT_N` with controlled reset sequencing. | Existing model exposes it unnamed; it must connect to the debug header's `BOOT` pin, not a product function. |
| GPIO3 | Keep electrically quiet at reset because it selects the JTAG source when the relevant eFuse is used. | Existing model assigns W5500 IRQ here. Move that IRQ to GPIO1. |
| GPIO45 | Default weak pull-down selects 3.3 V VDD_SPI when eFuse forcing is not used. | Existing model leaves it unused. Do not use it until the R2 module's flash-voltage/eFuse production policy and display-buffer load are verified. |
| GPIO46 | Default weak pull-down participates in boot mode and ROM-message controls. | Existing model drives display data from it. This is an unresolved strap and display-safe-state conflict. |
| GPIO19/GPIO20 | Reserved for USB D-/D+ and USB Serial/JTAG. | Existing model assigns W5500 MISO/CS here and does not wire USB-C. Reassign Ethernet as above. |
| GPIO26 to GPIO32 | Not exposed and occupied by flash/PSRAM. | Never allocate. |
| GPIO35 to GPIO37 | Available on N16R2 but unavailable on Octal-PSRAM R8/R16 modules. | Candidate uses them for audio; module substitutions require a pin-map review. |
| `EN` | Hardware reset only, held high only after 3.3 V is stable. | Existing model labels `EN_RESET` but requires a real reset network, not GPIO16. |

The external watchdog and supervisor must both assert the same active-low
hardware-reset path to `EN` through open-drain compatible circuitry. The
STM32-controlled reset channel requires an electrically independent path to
that same node if the ownership contract requires it. Reset sources must not
back-power the ESP32, its isolator channel, USB host, or an unpowered scoring
domain.

## RF antenna and layout constraints

`WROOM-1U` has an external antenna connector rather than the on-module PCB
antenna, so the module drawing does not prescribe the WROOM-1 antenna keepout.
That does not remove RF placement work. The carrier must:

- place the module and external RF connector at a carrier edge with a short,
  unbranched, outer-layer 50 ohm RF route;
- keep the IPEX connector clear on every copper layer as Espressif specifies,
  avoid vias in the RF path, and use the manufacturer reference layout;
- keep USB, UART header, display clocks, W5500, switching power loops, and
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

## Current architectural conflicts and missing connections

| ID | Conflict or omission | Consequence | Required resolution |
| --- | --- | --- | --- |
| ESP-01 | GPIO19 and GPIO20 are assigned to W5500 MISO and CS while the plan calls USB-C a service/data port. The USB-C connector has no traces. | USB Serial/JTAG cannot be used as designed. | Reserve GPIO19/GPIO20 for USB and move W5500 MISO/CS. Add the complete USB-C service schematic. |
| ESP-02 | W5500 IRQ is on GPIO3, a strapping pin. | External reset or eFuse policy can be disturbed by the Ethernet controller. | Move IRQ to GPIO1 with an inactive-state pull-up. |
| ESP-03 | One `DISPLAY_DATA` net drives one buffered `R1`; the remaining HUB75 signals are absent. | No functional display interface or safe default state is defined. | Select a complete display architecture and prove all signals, output enables, level translation, timing, panel current, and reset blanking. |
| ESP-04 | GPIO46 drives display data despite being a strapping pin. | Display buffer loading and reset behavior can affect boot; default-low boot state is not equivalent to display blanking. | Avoid the pin or prove strap loading and add hardware default-off gating. |
| ESP-05 | The audio mapping contains one `AUDIO` GPIO while TAS2505 needs an I2S data stream and clocks. | The amplifier cannot receive the specified digital audio protocol. | Allocate and route BCLK, WS, and DOUT, plus amplifier reset/mute and fault handling. |
| ESP-06 | The isolated `S_RESET` signal lands on ESP GPIO16, not `EN`. The current net label suggests a hardware reset that the electrical path cannot perform. | An STM32 request can be ignored by wedged ESP32 firmware. | Route the isolated reset through a reset-qualified transistor/open-drain stage to `EN`; retain a separate GPIO only for diagnostic acknowledgement if needed. |
| ESP-07 | The plan says two heartbeats and independently controlled resets, but the model presents one STM32-to-ESP32 heartbeat and no explicit ESP32-to-STM32 heartbeat/reset path. | Fault-containment contract cannot be tested. | Define directions, fail levels, pulse timing, isolation channels, and destination circuitry in M0-04/M0-10. |
| ESP-08 | F-RAM SPI pins, W5500 reset, W5500 power/reset timing, power-monitor I2C, and buck controller I2C are not fully connected in the model. | Storage, network recovery, and rail telemetry cannot be implemented from the drawing. | Choose the shared-SPI reset topology and complete these nets in the later schematic task. |
| ESP-09 | External JTAG pads GPIO39 to GPIO42 collide with a full HUB75 allocation. | The current debug-header definition does not match a usable external JTAG implementation. | Make USB Serial/JTAG the approved debug path and use UART0 header plus `EN`/`BOOT_N` recovery. |
| ESP-10 | `N16R2` is a -40 C to 85 C R2 module, while GPIO35 to GPIO37 are only free because it does not use Octal PSRAM. | A substitution to an R8/R16 module can silently invalidate the audio allocation and change the temperature rating. | Lock the approved module configuration and require a new pin/thermal review for every substitution. |
| ESP-11 | The module, W5500, and external connectors remain do-not-place or footprint-pending in the production plan/readiness register. | There is no fabrication-ready land pattern, RF route, Ethernet physical layer, or mechanical proof. | Complete the M4/M5 evidence gates and independent reviews. |

## Required verification before detailed schematic capture

1. Confirm the exact W5500 reset, interrupt electrical type, SPI frequency,
   crystal, analog supply, magnetics, termination, ESD, and shield/chassis
   scheme against the current WIZnet documentation.
2. Review Espressif's current WROOM-1U land pattern, exposed-pad via/paste
   arrangement, 3.3 V decoupling/LC filtering, `EN` timing, and external
   antenna connector reference layout against the actual stack-up.
3. Build a reset-state table for every ESP32-attached device at cold boot,
   watchdog reset, supervisor brownout, STM32-requested reset, USB insertion,
   and application firmware absence. Check that every output is inactive,
   especially W5500 CS/reset, F-RAM CS, display enables, I2S, and the isolated
   link MISO output.
4. Resolve the display architecture and repeat the allocation. A 16-pin HUB75
   connector uses 13 timing/data signals; do not treat a single GPIO as an
   interface placeholder.
5. Confirm I2C pull-up voltage, addresses, bus capacitance, recovery policy,
   RTC backup domain, secure-element provisioning, and whether rail telemetry
   must remain reachable during watchdog handling.
6. Verify ESP-IDF peripheral routing and simultaneous DMA load for the two SPI
   buses, USB Serial/JTAG, I2C, I2S, radio, W5500 traffic, display refresh,
   and PSRAM. Software scheduling must not be used as evidence of scoring
   timing because scoring remains isolated on the STM32.
7. Execute RF, USB, Ethernet, display-emissions, audio, thermal, ESD/EFT,
   brownout, and recovery measurements on EVT hardware. These are later
   evidence gates, not assumptions discharged by this document.

## M0-09 acceptance record

This note identifies a real pad for the isolated link, W5500 SPI, journal SPI,
USB/debug, I2C, watchdog, UART recovery, and candidate audio signals. It also
documents why the current display allocation is over-subscribed and cannot be
accepted. The strapping, flash/PSRAM, `EN`, and RF constraints are recorded
with their required verification actions.

M0-09 should remain in review until the display decision, reset/heartbeat
directions, USB-C service circuit, and shared-peripheral connection omissions
are resolved. Nothing in this document establishes fabrication readiness.
