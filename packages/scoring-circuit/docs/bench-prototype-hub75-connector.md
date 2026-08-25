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

## Received-panel evidence intake

[`bp-143-received-panel-evidence-intake.md`](bp-143-received-panel-evidence-intake.md)
defines the separate, empty-by-default submission schema for the actual
received panel and cables. It binds the exact sample and prototype identities,
calibrated instruments, procedure, and artifact hashes before it will accept
continuity, mating, orientation, current, cable-drop, connector-temperature,
and fit records. A complete intake still leaves every release authority
`deny`; it is not a substitute for downstream schematic, footprint, layout,
or fabrication review.

## Sources

- [Adafruit 2277 panel](https://www.adafruit.com/product/2277)
- [Adafruit 4170 16-pin IDC cable](https://www.adafruit.com/product/4170)
- [Adafruit 4767 replacement panel power cable](https://www.adafruit.com/product/4767)
- [Samtec TST-108-04-G-D-RA](https://www.samtec.com/products/tst-108-04-g-d-ra)
- [Samtec TST-108-04-G-D-RA distributor rating](https://www.digikey.com/en/products/detail/samtec-inc/TST-108-04-G-D-RA/2685833)
- [JST SM connector](https://www.jst.com/products/wire-to-wire-connectors/sm-connector/)
- [JST SM connector drawing and rating](https://www.jst.com/wp-content/uploads/2025/06/eSM.pdf)

## Acquired source snapshots

On 2026-08-24, the manufacturer pages and technical documents below were
downloaded into [`docs/evidence/bp-143`](evidence/bp-143) and SHA-256 hashed.
The executable source record in
[`src/display-panel-readiness.ts`](../src/display-panel-readiness.ts) binds
each acquired byte set to its URL and digest, and the focused readiness test
rehashes the committed files. These snapshots establish source provenance
only. They do not establish receipt, continuity, mating fit, measured current,
temperature, CAD import, fabrication, or physical evidence.

| Exact selection | Manufacturer or vendor source | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| Adafruit product `2277` | [Product page](https://www.adafruit.com/product/2277) | `adafruit-2277.html` | `0C777FFEBB7B17739CCFDF91E3EADAE5AE50769F22C92492D281F4C33AF4EAB7` |
| Adafruit product `4170` | [Product page](https://www.adafruit.com/product/4170) | `adafruit-4170.html` | `9947C756279B91B4416141B4C2D21B53D3C3DA8276AFFA49A95823E170EA3C0F` |
| Adafruit product `4767` | [Product page](https://www.adafruit.com/product/4767) | `adafruit-4767.html` | `93BF82D57B0F6A3009C6BB993E60A422A3F5D091060FAE44B86A6436E1A100D6` |
| Samtec `TST-108-04-G-D-RA` | [Product page](https://www.samtec.com/products/tst-108-04-g-d-ra) | `samtec-tst-108-04-g-d-ra.html` | `6B3FAD6D5B2E2649DEDFD00EE87C68D692C0CFF9ACFBB81A5D584D5F85A85464` |
| Samtec `TST-108-04-G-D-RA` | [TST Series Print](https://suddendocs.samtec.com/prints/tst-1xx-xx-x-x-xx-xx-mkt.pdf) | `samtec-tst-series-print.pdf` | `56AE927287856E76D57FF3B0953D3D4F853183E397794A31EE6DC5D3E07B6059` |
| Samtec `TST-108-04-G-D-RA` | [TST double-row footprint print](https://suddendocs.samtec.com/prints/tss-tstd.pdf) | `samtec-tst-footprint.pdf` | `ED9B9280C24AA99BB4714557997CA5452FE7E245961599A4C39537FEFCD366DC` |
| JST `SMR-04V-N`, `SYM-001T-P0.6`, `SMP-04V-NC`, `SHF-001T-0.8BS` | [SM series specification](https://www.jst.com/wp-content/uploads/2025/06/eSM.pdf) | `jst-esm.pdf` | `05BB0EDE946AB6255692E007706C9AC87EECE07E2ADE4F6DD687723B4A7A3301` |

The existing [DigiKey listing for Samtec `TST-108-04-G-D-RA`](https://www.digikey.com/en/products/detail/samtec-inc/TST-108-04-G-D-RA/2685833)
remains a vendor-listed source for the published per-contact rating in the
contract. It was not hash-bound because the acquisition request returned an
access-denied response. No vendor listing is treated as a physical test or as
panel-power approval.
