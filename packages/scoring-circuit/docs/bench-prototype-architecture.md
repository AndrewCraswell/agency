# BP-010 bench-prototype architecture

## Purpose and release status

The first integrated hardware is one deliberately oversized, accessible PCB on
standoffs. It is a bench instrument for electrical, firmware, and
rules-behavior experiments. It is neither a production form-factor preview nor
an order, fabrication, or production release.

The machine-checkable source of this boundary is
`src/bench-prototype-contract.ts`. Its release state is permanently `deny` for
this planning unit. A later schematic, footprint, layout, and independent
order review are still required before any prototype order.

## Required on the one board

- `STM32G474RET3TR` owns acquisition, touch qualification, timing, primary
  lamps, and buzzer in the `SCORING_SGND` domain.
- `ESP32-S3-WROOM-1U-N16R2` owns display, Ethernet services, storage, controls,
  and non-authoritative replay in the `APP_GND` domain.
- `ISO7762FDWR`, `ISO7721FDR`, and `NXE1S0505MC` are the only permitted
  crossings of the visibly marked isolation corridor. The two grounds remain
  separate on every layer.
- The `W5500`, its committed support network, and Würth `7499011121A`
  integrated-magnetics RJ45 are co-located. The MDI pairs never leave the PCB.
- The two `SN74AHCT245PWR` buffers and protected HUB75 connection support the
  external selected panel.

The STM32 must remain functional when the ESP32 is held in reset, unpowered,
malformed, or absent. The application processor cannot qualify a hit or
automatically reset the scoring processor.

## Provisional zoning and access

The planning envelope is 300 mm wide by 160 mm high with a lower-left planning
datum. These coordinates reserve hand and probe space; they are explicitly not
a fabrication outline, mechanical drawing, placement release, or board-size
commitment. The four- or six-layer choice remains evidence-driven.

| Zone | X range | Y range |
| --- | ---: | ---: |
| Fixture entry | 0 to 35 mm | 0 to 160 mm |
| Analog acquisition | 35 to 90 mm | 0 to 160 mm |
| Scoring control | 90 to 145 mm | 0 to 160 mm |
| Isolation corridor | 145 to 165 mm | 0 to 160 mm |
| Application control | 165 to 215 mm | 0 to 160 mm |
| USB-C power and Ethernet edge | 215 to 300 mm | 60 to 160 mm |
| Display edge | 215 to 300 mm | 0 to 60 mm |

The isolation corridor is therefore a provisional 20 mm-wide full-height
reservation. No copper, plane, mounting, or clearance credit follows from the
planning width.

The right-side upper zone contains the USB-C receptacle, PD controller,
protection, eFuse, physical source selector, diagnostic input, W5500 support,
and MagJack. It reaches both `J_USB_C` and `J_ETHERNET_MAGJACK` directly at the
right edge. The HUB75 connector occupies the separate lower-right display zone,
so neither power nor Ethernet routing requires crossing that zone.

| Connector | Planning coordinate | Role |
| --- | --- | --- |
| `J_WEAPON_FIXTURE` | left edge, x = 0, y = 80 mm | Weapon and piste fixture |
| `J_PRIMARY_OUTPUTS` | left edge, x = 0, y = 130 mm | Primary lamps and buzzer |
| `J_USB_C` | right edge, x = 300, y = 90 mm | Normal USB-C PD input and USB 2.0 service |
| `J_ETHERNET_MAGJACK` | right edge, x = 300, y = 130 mm | Ethernet |
| `J_HUB75` | right edge, x = 300, y = 30 mm | External display |
| `J_STM_SWD` | top edge, x = 118, y = 160 mm | STM32 debug |
| `J_ESP_SERVICE` | top edge, x = 192, y = 160 mm | ESP32 recovery |
| `J_LAB_INJECTION` | top edge, x = 235, y = 160 mm | Controlled diagnostic injection that bypasses USB-C PD/eFuse |

Labeled, unobstructed probe zones cover current links, rails, reference,
analog stages, fixture lines, resets, watchdogs, heartbeats, isolated SPI,
Ethernet nodes, and display enable/buffer signals.

## Fixed prototype interfaces

The external display is Adafruit product `2277`, a 64-by-32, 1/16-scan HUB75
panel. The board supplies 13 buffered signals and a separately protected 5 V
branch.

Normal product power enters through Amphenol `10177070-00011LF`. The required
USB-C PD and protection chain includes `TPS25730ADREFR`, `TPD4S201TRGRRQ1`
for CC/SBU only, `TPD2EUSB30DRTR` as the D-/D+ shunt, `TVS2200DRVR`,
`B340A-13-F`, and `TPS259474ARPWR`, plus the complete controller
configuration, CC, VBUS, gate, discharge, eFuse, bypass, and connector-side
protection network. After the shunt, `USB_DN` and `USB_DP` each pass through
one matched 22 ohm series resistor before reaching `ESP32-S3-WROOM-1U-N16R2`
GPIO19 and GPIO20.

`J_LAB_INJECTION` uses Molex `43045-0400`, mate `43025-0400`, and `43030-0007`
terminals with two equal-length 20 AWG positive and two equal-length 20 AWG
return conductors. It may inject regulated 20 V at no more than 2.3 A only at
`LAB_POST_EFUSE_20V` for controlled bring-up. This diagnostic route bypasses
the USB-C PD controller and eFuse and is not a normal product interface. Exact
C&K/Littelfuse `7101SYZQE` provides physical SPDT selection with
`PD_EFUSE_OUT_20V` or `LAB_POST_EFUSE_20V` feeding the common
`V20_TO_V5_BUCK` node. Both sources must be de-energized before switching, and
simultaneous sources are prohibited.

`J_WEAPON_FIXTURE` uses Molex `43045-1200`, mate `43025-1200`, and
`43030-0007` terminals. Pins 1 through 7 are `LEFT_WEAPON_A`,
`LEFT_WEAPON_B`, `LEFT_WEAPON_C`, `RIGHT_WEAPON_A`, `RIGHT_WEAPON_B`,
`RIGHT_WEAPON_C`, and `PISTE`. Pins 8 through 10 reserve `PISTE_RETURN`, a
fixture return requiring review, and an ESD return requiring review. Pins 11
and 12 are NC and remain unpopulated. The fixture connector is not a
production body-cord connector.

The STM32 debug candidate is Samtec `FTSH-105-01-L-DV-K`, exposing SWDIO,
SWCLK, NRST, scoring 3.3 V sense, scoring ground, and keyed orientation. The
sense line never powers the board. The ESP32 service candidate is Samtec
`TSW-106-07-G-S`, exposing 3.3 V-compatible UART RX/TX, `BOOT_N`, active-high
manual reset request, application 3.3 V sense, and `APP_GND`. Use an isolated
or approved-level external adapter; 5 V TTL is prohibited.

## Explicitly deferred

This board does not decide enclosure mechanics, miniaturization, final
three-board production partitioning, a production battery/UPS or charging
subsystem, the standards proposal needed to reconcile FIE supply requirements,
regulatory certification, factory test/DFM, or production release.
Retained production-oriented technical evidence may inform a `BP-*` task, but
it does not govern or add work to the prototype backlog.

Normal prototype operation uses the USB-C PD power-adapter input. The regulated
20 V, 2.3 A maximum diagnostic injection exists only for physically selected,
mutually exclusive staged bring-up after the normal PD/eFuse path. Ethernet is
retained as a product capability and test surface;
production Ethernet EMC, mechanical, and certification closure remain future
gates.
