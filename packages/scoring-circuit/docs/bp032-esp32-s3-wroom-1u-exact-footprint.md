# BP-032 exact ESP32-S3-WROOM-1U-N16R2 candidate

This review-only slice binds the single canonical application ESP32 reference
`U_APP` to the exact orderable `ESP32-S3-WROOM-1U-N16R2` from Espressif
Systems. The executable candidate is
[`src/bp032-esp32-s3-wroom-1u-exact-footprint.tsx`](../src/bp032-esp32-s3-wroom-1u-exact-footprint.tsx)
and its focused test is
[`src/bp032-esp32-s3-wroom-1u-exact-footprint.test.tsx`](../src/bp032-esp32-s3-wroom-1u-exact-footprint.test.tsx).
The candidate is independent of the existing shared BP-032 renderer and is not
imported by a board, schematic, placement, fabrication, or release path.

## Exact identity and source binding

| Field | Frozen value |
| --- | --- |
| Canonical reference | `U_APP` |
| Manufacturer | Espressif Systems |
| Exact orderable | `ESP32-S3-WROOM-1U-N16R2` |
| Package | ESP32-S3-WROOM-1U module |
| Flash and PSRAM | 16 MB Quad SPI and 2 MB Quad SPI |
| Antenna variant | External antenna connector |
| Candidate source | `src/bp032-esp32-s3-wroom-1u-exact-footprint.tsx` |
| BP-121 source | `src/bench-prototype-esp32-allocation.ts` |
| BP-121 source SHA-256 | `F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B` |
| BP-125 source | `src/bench-prototype-bp125-processor-footprint-reconciliation.ts` |
| BP-125 source SHA-256 | `3FF36883B336525E50503DF8F45E70F6E6CD453A9FE57070470C597FDD5130C1` |
| Reviewed integration basis | `8f0739b9d4ff3a8d19bc211c07490c94c7cdca12` |

The candidate carries a private, independently frozen baseline. Its BP-121
snapshot contains all 41 module pads, including pads 1 through 40 as the
perimeter terminals and pad 41 as `GND_EP` on `APP_GND`. The snapshot records
the existing assignments, reserved NC pads, and unavailable-resource boundary;
it does not replace or edit BP-121.

## Retained Espressif primary evidence

| Retained source | Pages or layers | SHA-256 |
| --- | --- | --- |
| `evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf` | Exact variant p. 3; pins and supply pp. 10-12; EPAD and pinout p. 41; dimensions and connector pp. 42-43; land pattern pp. 45-46 | `27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435` |
| `evidence/bp-032/espressif-esp32-s3-wroom-1u-pcb-footprint-official.dxf` | `PART_TOP_COPPER_01`, `SOLDERMASKTOP_P`, `PADS_TOP` | `986C1AB9B0956A0B824BE1E51AA10C006F2A1554438DC9DC2459F14AF3AED0D0` |
| `evidence/bp-032/espressif-esp32-s3-wroom-1u-3d-model-official.step` | Mechanical identity and connector envelope | `7BE82BDAFECE2891B297546EB0643FF254E3D8161074EBDC972E0D78E79A4BDB` |

The v1.8 datasheet identifies the N16R2 WROOM-1U row as 16 MB Quad SPI flash,
2 MB Quad SPI PSRAM, and 18.0 mm by 19.2 mm by 3.2 mm. Figure 10-2 records
the WROOM-1U body and EPAD topology. Figure 10-3 records the first-generation
external connector, compatible with U.FL series, MHF I, and AMC mates. Figures
11-1 and 11-2 are kept distinct: the latter is the WROOM-1U recommended land
pattern.

## Manufacturer facts and project geometry

Manufacturer facts are stored separately from the project candidate geometry.
The retained facts are a 18 mm by 19.2 mm by 3.2 mm body envelope with
tolerances of plus or minus 0.2 mm, plus or minus 0.2 mm, and plus or minus
0.15 mm; 40 perimeter terminals; pad 41 as the exposed ground pad; 1.27 mm
perimeter pitch; and a 3.7 mm by 3.7 mm exposed-ground copper envelope with
nine 0.9 mm copper, 0.5 mm finished-drill vias at 1.4 mm pitch. The official
DXF is the source for the retained copper and top-mask layer names and counts.
Espressif does not publish a paste aperture or host-board courtyard in these
sources, so neither is inferred.

The project candidate uses the datasheet top-view coordinate system with the
nominal module body center as origin and zero-degree nominal rotation:

- 40 explicit perimeter lands: pads 1-14 on the left at x = -8.75 mm, pads
  15-26 on the bottom at y = -9.5 mm, and pads 27-40 on the right at x = 8.75
  mm. The pad dimensions are 1.5 mm by 0.9 mm on the side rows and 0.9 mm by
  1.5 mm on the bottom row.
- Nine explicit EPAD vias for pad 41 centered at (-1.5 mm, 0.5 mm), with
  x = -2.9, -1.5, -0.1 mm and y = -0.9, 0.5, 1.9 mm.
- Pin 1 is pad 1 at (-8.75 mm, 8.255 mm), the upper-left top-view land. The
  integrated connector is the upper-right mechanical boundary.
- The PCB antenna keepout is not applicable to WROOM-1U. Host-board
  connector, cable-exit, installed-antenna, enclosure, and RF-clearance
  dimensions are not published by this retained module source and remain
  pending review.

The renderer emits 40 top copper `smtpad` entities and nine plated-hole EPAD
via entities. The zero solder-mask margin preserves the retained top-mask
openings. A negative paste margin suppresses generated paste artifacts because
the manufacturer does not publish apertures; it is not a stencil recommendation.
No courtyard is emitted. This is candidate artwork provenance only, not CAD
approval or fabrication data.

## Fail-closed boundary

The validator compares data descriptors, including enumerable, configurable,
and writable flags, prototypes, own keys, and graph structure against the
private frozen baseline. It never reads properties with `Reflect.get` or
invokes accessors. Cycles, aliases, sparse arrays, symbols, proxies with
throwing traps, accessor descriptors, prototype changes, selection drift,
pad-map drift, geometry drift, and authority drift fail closed.

All downstream gates remain denied:

| Gate | Status |
| --- | --- |
| Exact identity and retained source binding | Recorded and hash-bound |
| Independent CAD overlay | DENY, pending |
| Placement and orientation approval | DENY, pin-one overlay pending |
| RF measurement, antenna, cable, and enclosure review | DENY, pending |
| Schematic integration and sign-off | DENY |
| Paste, courtyard, and assembly approval | DENY; source not published |
| Fabrication authority | DENY |
| Release authority | DENY |
| Acceptance | `false` |

This slice does not edit the canonical ledger, convergence or closure records,
backlog, board, BP-121 allocation, BP-125 reconciliation, or existing shared
contracts.
