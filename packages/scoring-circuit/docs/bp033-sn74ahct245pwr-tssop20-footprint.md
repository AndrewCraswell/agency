# BP-033 SN74AHCT245PWR TSSOP-20 display-buffer candidate

This review-only slice binds both canonical display-buffer references,
`U_DISPLAY_BUFFER_A` and `U_DISPLAY_BUFFER_B`, to the exact active production
Texas Instruments orderable `SN74AHCT245PWR`. The executable candidate is
[`src/bp033-sn74ahct245pwr-tssop20-footprint.tsx`](../src/bp033-sn74ahct245pwr-tssop20-footprint.tsx)
with focused coverage in
[`src/bp033-sn74ahct245pwr-tssop20-footprint.test.tsx`](../src/bp033-sn74ahct245pwr-tssop20-footprint.test.tsx).
It is not imported by a board or schematic and grants no fabrication or release
authority.

## Exact identity and retained source

| Field | Frozen value |
| --- | --- |
| References | `U_DISPLAY_BUFFER_A`, `U_DISPLAY_BUFFER_B` |
| Manufacturer | Texas Instruments |
| Exact orderable | `SN74AHCT245PWR` |
| Package | `PW` TSSOP, 20 pins (`TSSOP-20`) |
| Orderable state | Active production; 2000-piece large tape and reel |
| Retained source | [`evidence/bp-033/ti-sn74ahct245-datasheet-official.pdf`](evidence/bp-033/ti-sn74ahct245-datasheet-official.pdf) |
| Official URL | <https://www.ti.com/lit/ds/symlink/sn74ahct245.pdf> |
| SHA-256 | `9E7C1B200CDEFD3DC72CD0E8B9019059FED2833B1B15AC80E97E099DFCAC93D7` |
| Reviewed pages | PDF pages 1, 3, 13, and 20 |

Page 1 identifies the SN74AHCT245 family and PW TSSOP-20 package with nominal
6.50 mm by 4.40 mm body dimensions. Page 3 gives the 20-pin top view, pin-one
index area, and pin-function table. Page 13 identifies `SN74AHCT245PWR` as an
active TSSOP (PW) 20-pin orderable. PDF page 20 is the TI `PW0020A` package
outline.

The retained PDF was visually inspected at pages 1, 3, 13, and 20. The
inspection confirms the package table, upper-left pin-one index, complete
pin numbering, active PWR row, and the PW0020A mechanical outline. TI's
retained datasheet does not publish a PCB land-pattern recommendation; the
PW0020A drawing is mechanical package information only.

## Manufacturer facts

The candidate retains the TI pin map exactly:

| Pin | Name | Function |
| ---: | --- | --- |
| 1 | `DIR` | Direction input; project direction is hard-tied A-to-B |
| 2-9 | `A1`-`A8` | A-side bus inputs/outputs |
| 10 | `GND` | `APP_GND` logic reference |
| 11-18 | `B8`-`B1` | B-side bus inputs/outputs |
| 19 | `OE` | Active-low output enable |
| 20 | `VCC` | `V5_DISPLAY_LIMITED` |

The PW0020A facts are 0.65 mm terminal pitch, 20 terminals, 4.30-4.50 mm
body width, 6.20-6.60 mm body length, 1.20 mm maximum height, and
0.19-0.30 mm terminal width. These are manufacturer package facts, not a
released copper pattern.

## BP-144 interface binding

The candidate carries an independent snapshot of the BP-144 signal map. Buffer
A maps `HUB75_R1`, `HUB75_G1`, `HUB75_B1`, `HUB75_R2`, `HUB75_G2`, `HUB75_B2`,
`HUB75_A`, and `HUB75_B` through A1-A8 to B1-B8. Buffer B maps `HUB75_C`,
`HUB75_D`, `HUB75_CLK`, `HUB75_LAT`, and `HUB75_OE_N` through A1-A5 to B1-B5;
A6-A8 and B6-B8 remain explicitly NC with their reset pulldowns. Both DIR
inputs are A-to-B, both VCC pins use `V5_DISPLAY_LIMITED`, both GND pins use
`APP_GND`, and both OE/enable paths remain reset-gated. The focused test compares
the snapshot with the current BP-144 contract and hashes its source bytes.

## Project geometry and artwork boundary

The project geometry uses a package-center top view with pin 1 at the
upper-left and nominal zero-degree rotation. It renders only a 4.40 mm by
6.50 mm package-outline silkscreen rectangle and a pin-one marker as review
datums for both references. It emits zero SMT pads, plated holes, paste
apertures, or courtyards because TI does not publish a land pattern in the
retained source. No copper, solder mask, paste, courtyard, keepout, or board
placement is inferred from PW0020A.

## Fail-closed gates

The candidate has a private independently frozen baseline. Its validator reads
data descriptors only, checks exact enumerable/configurable/writable flags,
prototypes, own keys, and graph structure, and catches proxy failures. Cycles,
aliases, sparse arrays, accessor descriptors, descriptor-flag changes, symbol
properties, prototype substitutions, source drift, map drift, and gate drift
fail closed.

| Gate | Status |
| --- | --- |
| Exact identity and retained TI evidence | Recorded and hash-bound |
| Manufacturer CAD import | DENY; only mechanical package outline retained |
| Manufacturer land-pattern approval | DENY; not published |
| Pin-one independent overlay | DENY, pending |
| Board placement and fit | DENY |
| Schematic/ERC integration | DENY |
| Paste, courtyard, and assembly approval | DENY |
| Fabrication authority | DENY |
| Release authority | DENY |
| Acceptance | `false` |

This slice does not edit the canonical ledger, backlog, board, convergence or
closure records, existing shared contracts, or BP-144 source.
