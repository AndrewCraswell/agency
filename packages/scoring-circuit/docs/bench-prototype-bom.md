# ESP32-only bench prototype BOM baseline

This BP-020 baseline applies the rule that every populated component must
support a required P0 function. It is not an order BOM or fabrication release.
The executable source is `src/bench-prototype-bom.ts`.

## Required populated functions

| Function | Required implementation |
| --- | --- |
| Sole processor | Exact `ESP32-S3-WROOM-1-N16R2` with integrated PCB antenna, running a target adapter and portable C17 core. |
| Analog acquisition | Protected seven-channel AFE, `REF5025AQDRQ1`, and ADS8881 chain. Exact active references remain BP-103/BP-111 work. |
| Wired network | Exact `W5500`, all required manufacturer support parts, and Würth `7499011121A` MagJack. |
| Remote | Exact `TSOP38438`, four support passives, and `TP_IR_RX`. |
| Power/service | USB-C receptacle, TPS25730A PD sink, CC/SBU and USB2 protection, VBUS protection, eFuse, TPS56A37 5 V conversion, application 3.3 V conversion, and required support networks. |
| Display | Two `SN74AHCT245PWR` buffers, protected display-power branch, HUB75 connector, and external Adafruit 2277 panel. |
| Primary outputs | Five direct ESP32 GPIOs into one protected, hardware-default-off load-driver stage and the lamp/buzzer connector. No serialized latch is populated. |
| Recovery and safety | Native USB, ESP32 UART/boot/reset access, exact `TPS389033DSER` supervisor, exact `TPS3431SDRBR` health watchdog, their five required support passives, removable current links, and labeled test points. |
| Weapon connection | Owner-approved OK Fencing socket pigtails soldered into six labeled plated-through board landings, with probe points and separate mechanical strain relief. The landings are PCB features, not BOM connectors. |

## Removed from populated P0

The following rows remain explicit `DNP` records so they cannot return through
an old schematic or lane merge:

- STM32, its regulator, watchdog, supervisor, and SWD header;
- ISO7762, ISO7721, isolated-link power, isolated SPI, and dual-domain support;
- the NXE1S0505 analog isolation converter and its isolated-domain support;
- permanent V5 telemetry, duplicate eFuse-output bulk storage, and unused
  eFuse/V5 power-good indication networks;
- alternate laboratory power connector and source selector;
- external F-RAM, RTC, secure element, audio amplifier, and speaker connector;
  and
- the prototype weapon harness connector, because six direct-wire landing
  holes and a separate strain anchor replace it; and
- battery/UPS hardware, which remains a production/FIE power decision rather
  than dormant P0 circuitry.

Encrypted-remote identity and replay counters use ESP32 eFuses and encrypted
NVS. Flash writes are prohibited while scoring acquisition is active until the
loaded timing tests prove a safe alternative.

## Integrated-antenna placement

The selected WROOM-1 module supplies its own PCB antenna. Place the antenna
outside the base-board edge with its feed point near that edge when practical.
Otherwise, preserve at least 15 mm clearance in all directions around the
antenna area: no copper, routing, or components. Keep metal housing away and
verify finished-product throughput and communication range. This is a
placement and RF-validation gate, not a populated antenna BOM row.

## Open selections

`TBD` is allowed only where the function is required but the exact orderable
part still needs engineering evidence. Current examples are the detailed
analog-cell rows and the primary-output driver and connector. The application
regulator, supervisor, watchdog, HUB75 connectors, PD straps and capacitors,
and native-USB series pair now have exact selected rows. A `TBD` row cannot
enter an order-candidate BOM.

The component audit distinguishes architectural choices from mandatory support.
The USB-C/PD chain legitimately needs eleven TPS25730A configuration resistors,
seven local or protected-CC capacitors, and two native-USB series resistors;
they implement the selected 20 V/3 A input rather than optional features. The
primary-output latch did not pass that test: five GPIOs were available, so it
was removed instead of being selected merely to preserve an older topology.

The application rail enumerates all ten physical references from the reviewed
BP-142 contract: the LMR43620, inductor, input capacitor, local and bootstrap
capacitors, VCC capacitor, three output capacitors, and discharge resistor.
The former aggregate `U_APP_REG` placeholder is removed; a selected regulator
without its mandatory support network is not a valid BOM entry.

The 20 V protection and V5 conversion path now follows the same rule. Eight
exact TPS259474A support rows retain local input bypass, UVLO, OVLO, current
limit, transient blanking, and controlled slew. Twelve exact populated
TPS56A37 support rows retain its inductor, input/output/BOOT capacitors, MODE,
feedback, and EVM feed-forward network. The redundant buck EN divider,
external SS capacitor, unused PG/PGTH indication parts, duplicate eFuse output
capacitor, INA238, and full-rail telemetry shunt are explicit DNP rows.

The USB-C path is the only populated power input. Bench diagnosis uses labeled
test pads and removable links under a USB-disconnected, de-energized procedure;
it does not receive a second connector or selector.

The two HUB75 buffers share one hardware output-enable gate. The selected
support inventory is sixteen reset-default resistors, one panel-side OE
pull-up, two buffer bypass capacitors, one `BSS138AKA` sink, two 10 kOhm gate
network resistors, and one 100 kOhm gate pulldown. A second enable transistor
and duplicated gate network do not earn P0 population.

## Release boundary

The object remains `isOrderBom: false`, `fabricationRelease: false`, and
`releaseState: "deny"`. BP-035 and BP-303 must prove that every active
reference in the schematic matches this minimal population, every required
support component is present, and every removed row is absent or DNP before an
order can be reviewed.
