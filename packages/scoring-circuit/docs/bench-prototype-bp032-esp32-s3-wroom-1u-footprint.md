# BP-032 ESP32-S3-WROOM-1U-N16R2 candidate footprint evidence

This review-only slice binds the exact selected `ESP32-S3-WROOM-1U-N16R2` to
Espressif's retained v1.8 datasheet, official WROOM-1U DXF, and official STEP
model. It is not imported by a board circuit. `accepted` is false and
fabrication authority is denied.

## Exact identity and source binding

The candidate is the external-antenna `ESP32-S3-WROOM-1U-N16R2` module: 16 MB
Quad-SPI flash, 2 MB Quad-SPI PSRAM, 40 perimeter terminals, and exposed ground
pad 41. The selected identity is bound to the BP-121 allocation source:

| Source | SHA-256 |
| --- | --- |
| `src/bench-prototype-esp32-allocation.ts` | `F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B` |

The source is recorded as an exact-selection input only. BP-032 does not modify
the BP-121 allocation, processor-support contract, board model, or processor
footprint ledger.

This binding was reconciled to integration commit `a84fb13`; the focused test
validates the live BP-121 contract, its exact source bytes, and the selected
module MPN before it accepts this candidate record.

## Retained Espressif evidence

| Artifact | Review scope | SHA-256 |
| --- | --- | --- |
| [`espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf`](evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf) | v1.8 pp. 3, 10, 42, 43, 45, and 46: exact series variant, module body, pin-one view, connector, ground-pad pattern, and recommended WROOM-1U land pattern | `27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435` |
| [`espressif-esp32-s3-wroom-1u-pcb-footprint-official.dxf`](evidence/bp-032/espressif-esp32-s3-wroom-1u-pcb-footprint-official.dxf) | Espressif `PART_TOP_COPPER_01`, `PADS_TOP`, and `SOLDERMASKTOP_P` source geometry | `986C1AB9B0956A0B824BE1E51AA10C006F2A1554438DC9DC2459F14AF3AED0D0` |
| [`espressif-esp32-s3-wroom-1u-3d-model-official.step`](evidence/bp-032/espressif-esp32-s3-wroom-1u-3d-model-official.step) | Exact WROOM-1U mechanical reference for body and integrated connector envelope | `7BE82BDAFECE2891B297546EB0643FF254E3D8161074EBDC972E0D78E79A4BDB` |

The v1.8 datasheet is the manufacturer drawing authority for the nominal
18 mm by 19.2 mm by 3.2 mm module body. The official DXF is retained as the
CAD authority for copper and top solder-mask openings. The STEP is a mechanical
reference only; it does not create a board footprint release.

## Candidate geometry

Coordinates use the nominal module body center and the datasheet top view. Pin
1 is the upper-left perimeter land. The candidate derives:

- 14 left lands, 12 bottom lands, and 14 right lands, for 40 total;
- perimeter land pitch of 1.27 mm and side-row span of 16.51 mm;
- side-row centers at x = ±8.75 mm and bottom-row center at y = -9.5 mm;
- 3 by 3 exposed-ground-pad via array centered at (-1.5, +0.5) mm;
- 0.9 mm square thermal copper around 0.5 mm finished drills at 1.4 mm pitch;
- 3.7 mm by 3.7 mm nominal thermal-array copper envelope.

The values above are encoded and tested in
[`bench-prototype-bp032-esp32-s3-wroom-1u-footprint.tsx`](../src/bench-prototype-bp032-esp32-s3-wroom-1u-footprint.tsx). They are a bounded
candidate renderer, not a board placement or a fabrication artifact.

## Mask, paste, and courtyard disposition

The retained DXF has a `SOLDERMASKTOP_P` layer. Its measured openings are
recorded without expanding or shrinking them: 40 perimeter openings at
1.5 mm by 0.9 mm and nine exposed-ground-pad openings at 0.9 mm by 0.9 mm.
The DXF also contains one legend swatch; it is excluded from these footprint
counts as non-footprint graphic geometry.
This is source geometry evidence, not fabricator-specific mask approval.

Espressif's v1.8 land-pattern drawing and retained DXF do not publish a stencil
paste aperture policy or a dimensioned assembly courtyard. The candidate
therefore contains no paste geometry and no courtyard geometry. It does not
infer either from copper, mask, or the nominal body envelope. A future release
must acquire or formally define those two fabrication inputs, then independently
review stencil windowing, mask expansion, assembly density, and component
clearance.

## External antenna and orientation implications

The WROOM-1U has an integrated first-generation external-antenna connector, not
the WROOM-1 PCB antenna. Espressif lists U.FL, MHF I, and AMC-compatible mates;
the module does not ship with an external antenna. The connector envelope is
part of the module mechanical reference and is not a host-board connector
footprint.

The WROOM-1U pin diagram explicitly has no WROOM-1 PCB-antenna keepout zone.
That does not waive RF clearance: the host board must reserve the connector,
cable exit, installed antenna, enclosure, and nearby copper volume. Espressif's
datasheet does not publish a universal host-board clearance dimension, so this
candidate records the requirement and leaves the dimension open. No host-board
RF trace, antenna part, cable bend, enclosure clearance, or connector-retention
approval is claimed.

Nominal orientation is the datasheet top view with pad 1 at the upper-left and
the integrated connector toward the upper-right. Pin-one marking, assembly
datum, placement rotation, cable exit, and enclosure orientation still require
an independent overlay before any board or RF review.

## Gate status

| Gate | Status |
| --- | --- |
| Exact MPN and BP-121 source binding | Retained and hash-bound |
| Espressif copper and top-mask CAD | Retained candidate geometry |
| Paste aperture | Not published, deny |
| Courtyard | Not published, deny |
| Antenna, cable, enclosure, and retention review | Pending, deny |
| Schematic integration, board placement, RF approval, and fabrication | Denied |
| Accepted | `false` |
