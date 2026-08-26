# BP-143 HUB75 connector and panel power mating contract

**Status:** exact BP-143 selection frozen for schematic input; physical sample,
continuity, fit, current, temperature, footprint, layout, and fabrication
evidence remain open. Fabrication is **DENY**.

The executable contract is [`src/bench-prototype-hub75-connector.ts`](../src/bench-prototype-hub75-connector.ts), with focused tests in [`src/bench-prototype-hub75-connector.test.ts`](../src/bench-prototype-hub75-connector.test.ts).
The contract validates the retained BP-020 baseline, BP-050 display branch,
and BP-121 ESP32 allocation before accepting its own canonical value. It does
not change the retained BP-020 `J_HUB75` row, which remains `TBD` until the
later footprint and schematic integration gate.

## Frozen selections

| Function | Selected item | Contracted identity and rating |
| --- | --- | --- |
| Carrier signal header `J_HUB75` | Samtec `TST-108-04-G-D-RA` | 16 positions, 2 rows, 2.54 mm pitch, right-angle through-hole, four-wall shroud with polarization key, 3.4 A per contact listing. This current rating is not panel-power allocation. |
| Signal cable | Adafruit product `4170` | 12 inch, 16-line 0.05 inch ribbon, keyed 2x8 IDC sockets on both ends, 0.1 inch connector pitch, white pin-1 stripe. Use the panel `INPUT` header only. |
| Panel power cable | Adafruit product `4767` | Approximately 500 mm, two four-conductor panel plugs, two red and two black conductors per plug in the product photos. The cable wire gauge is not published by Adafruit and is not credited until the received cable is inspected. |
| Panel-side power mate | JST `SMR-04V-N` with `SYM-001T-P0.6` pin contacts | Planned pin-contact housing to mate the Adafruit cable's `SMP-04V-NC` socket housing. The purchased panel's actual housing remains an inspection gate. |
| Cable-side power mate | JST `SMP-04V-NC` with `SHF-001T-0.8BS` socket contacts | White, 4-position JST SM cable housing. JST rates the SM contact system at 3 A AC/DC maximum. |

The Adafruit 2277 page says the panel includes an IDC cable and a plug-in
power cable, requires regulated 5 V, and may have one or two power connections.
The #4170 and #4767 items are the repeatable purchased mating articles for the
bench harness; their product pages are not evidence that the current workspace
already purchased or received them.

## Pin contracts

### Signal

The cable is straight-through by cable pin number. The carrier and panel
`INPUT` pin labels are:

| IDC pin | Label | Type |
| ---: | --- | --- |
| 1 | `R1` | buffered signal |
| 2 | `G1` | buffered signal |
| 3 | `B1` | buffered signal |
| 4 | `GND1` | logic reference only |
| 5 | `R2` | buffered signal |
| 6 | `G2` | buffered signal |
| 7 | `B2` | buffered signal |
| 8 | `GND2` | logic reference only |
| 9 | `A` | buffered row address |
| 10 | `B` | buffered row address |
| 11 | `C` | buffered row address |
| 12 | `D` | buffered row address |
| 13 | `CLK` | buffered clock |
| 14 | `LAT` | buffered latch |
| 15 | `OE` | buffered active-low output enable |
| 16 | `GND3` | logic reference only |

The 13 driven signals are the complete BP-121 allocation: six RGB data
signals, four address signals `A` through `D`, `CLK`, `LAT`, and `OE`. There is
no `E` address line. The three IDC ground pins are not a substitute for the
separate high-current power return.

### Power

The declared power map for each of the two four-conductor branches is:

| JST SM contact | Expected conductor | Net | Purpose |
| ---: | --- | --- | --- |
| 1 | red | `V5_DISPLAY_LIMITED` | panel 5 V |
| 2 | red | `V5_DISPLAY_LIMITED` | panel 5 V |
| 3 | black | `APP_GND` | panel power return |
| 4 | black | `APP_GND` | panel power return |

JST's 3 A maximum contact rating and the two parallel contacts per polarity
provide a connector contact screen above the Adafruit 2277 page's published
approximately 4 A panel maximum. This is not a cable ampacity, current
sharing, inrush, voltage-drop, or thermal proof. Both panel power branches and
all four contacts in each branch must be present and continuous before power
is applied. A missing or swapped contact is a stop condition.

## Power path and release gates

Panel power is separate from the 16-pin signal cable:

`V5_DISPLAY_LIMITED` → `J_DISPLAY_DISCONNECT` → `J_LINK_DISPLAY` →
`J_DISPLAY_POWER_PIGTAIL` → Adafruit #4767 → panel `V5`/`APP_GND`

`J_DISPLAY_DISCONNECT` and the BP-050 `J_LINK_DISPLAY` remain accessible and
removable only while both possible input sources are de-energized. The
display-connected permit remains `deny-until-inrush-measured`; measure panel
startup/inrush, panel-end voltage, cable drop, branch sharing, connector and
cable temperature, and current at the declared image before closing the gate.

The executable evidence record deliberately remains open:

- no panel receipt, serial, PCB revision, or included-cable identity is claimed;
- no signal or power continuity has been measured;
- no mating/orientation or strain-relief record exists;
- no current, cable-drop, inrush, or temperature measurement exists;
- no footprint, layout, schematic, or fabrication approval is granted.

## Sources

- [Adafruit 2277 panel](https://www.adafruit.com/product/2277)
- [Adafruit 4170 16-pin IDC cable](https://www.adafruit.com/product/4170)
- [Adafruit 4767 replacement panel power cable](https://www.adafruit.com/product/4767)
- [Samtec TST-108-04-G-D-RA](https://www.samtec.com/products/tst-108-04-g-d-ra)
- [Samtec TST-108-04-G-D-RA distributor rating](https://www.digikey.com/en/products/detail/samtec-inc/TST-108-04-G-D-RA/2685833)
- [JST SM connector](https://www.jst.com/products/wire-to-wire-connectors/sm-connector/)
- [JST SM connector drawing and rating](https://www.jst.com/wp-content/uploads/2025/06/eSM.pdf)
