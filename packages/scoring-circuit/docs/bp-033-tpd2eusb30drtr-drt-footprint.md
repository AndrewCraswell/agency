# BP-033 TPD2EUSB30DRTR DRT footprint evidence

This is a bounded BP-033 review-only footprint evidence slice for
`U_USB_DATA_PROTECT`. It binds the exact Texas Instruments orderable
`TPD2EUSB30DRTR` to device `TPD2EUSB30`, package `SOT-9X3 (DRT), 3-pin SOT`,
and TI package drawing `DRT (R-PDSO-N3), DRT0003A`. The canonical circuit and
BOM identity is `U_USB_DATA_PROTECT`; this slice does not approve or release
the footprint, board, schematic, or fabrication records.

The isolated source artifact is
`src/bp033-tpd2eusb30drtr-drt-project-footprint.tsx`, with its focused test in
`src/bp033-tpd2eusb30drtr-drt-project-footprint.test.tsx`. The component is not
imported by a board circuit.

## Retained TI evidence

| Evidence | Official source | Repository artifact | SHA-256 | Pages reviewed |
| --- | --- | --- | --- | --- |
| TPDxEUSB30 datasheet, Rev. G, SLVSAC2G | [TI datasheet](https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf) | `docs/evidence/bp-033/ti-tpd2eusb30a-datasheet.pdf` | `A2C0DD845043A5BBFE610F673879C29E38649544385DEA51DBE0A4C49DF39136` | PDF 1, 3, 12, 15-17 |
| DRT package outline, MPDS340 / DRT0003A | [TI MPDS340](https://www.ti.com/lit/pdf/MPDS340) | `docs/evidence/bp-033/ti-drt0003a-mpds340-package-outline.pdf` | `77A557465D7DB37AEB603EB07930BB3CB5B118ADFA576F5EB1C6F0C0C97CFE73` | PDF 1 drawing; PDF 2 notice |

The two retained PDFs were downloaded from TI URLs, SHA-256 hashed, and read
from the repository by the focused test. TI datasheet pages 1, 3, 12, and
15-17, plus MPDS340 page 1, were rendered to PNG and visually inspected. The
MPDS340 artifact is a two-page TI mechanical drawing: page 1 is the DRT
package outline and page 2 is the Important Notice. The focused test binds
the retained artifact to both pages, the 612-by-792-point drawing page, and
its vector path and line-width structure; it also checks the notice marker on
page 2. This semantic page/geometry check rejects a notice-only replacement,
even if its hash is changed to match source text.

The retained evidence is legible, with no clipping, overlap, or rendering
defect observed.

The datasheet pages bind the device family and orderable identity, the DRT
top-view pin functions, and the package addendum. The package addendum lists
`TPD2EUSB30DRTR` as active production, `SOT-9X3 (DRT)`, three pins, 3,000-piece
large tape and reel. The datasheet's device table gives the nominal DRT body as
`1.00 mm x 0.80 mm`; MPDS340 page 1 gives the corresponding body limits of
`0.95-1.05 mm` by `0.75-0.85 mm`. TI's product page describes the overall
space-saving DRT package as `1 mm x 1 mm`.

## Pin, land, and orientation binding

The TI datasheet maps the DRT pins as follows:

| Pad | TI function | Signal | Review-artifact top-view position |
| --- | --- | --- | --- |
| 1 | D1+ | D+ | `(-0.35, -0.50) mm`, lower-left |
| 2 | D1- | D- | `(+0.35, -0.50) mm`, lower-right |
| 3 | GND | GND | `(0.00, +0.50) mm`, upper-center |

MPDS340 page 1 provides package lead geometry rather than a TI example board
land pattern. Its three lead callouts are 0.10 to 0.20 mm wide with 0.05 to
0.15 mm outward extension, around a 0.95 to 1.05 mm by 0.75 to 0.85 mm body.
The review artifact uses the maximum source width and extension, 0.20 mm by
0.15 mm, for its three source-controlled review pads. The artifact records this as
`source-outline-lead-data-review-only`; it is not a released land pattern.

The top-view datum is the package center. Pin 1 is the lower-left lead beside
the TI pin-one index area, pin 2 is lower-right, and pin 3 is upper-center. The
component records zero board rotation and `independentlyReviewed: false`. The
TI datasheet Figure 5-1 view and MPDS340 top view differ by a 90-degree
clockwise rotation when moving MPDS340 coordinates into datasheet view. The
artifact therefore records a 90-degree counter-clockwise transform from the
datasheet view into the MPDS340 view and uses the latter for its review
coordinates; this is documented, not independently orientation-approved.
The 1.35 mm by 1.15 mm courtyard is an explicit project review envelope with
0.15 mm clearance around the 1.05 mm by 0.85 mm maximum body. TI does not
publish a courtyard for this package.

The rendered review artwork is persisted as the canonical tscircuit soup
geometry digest
`f206c789162f96e38c781ca937d052b48b44bc66a91df41cebd7ad4cc6eff86e`. The
focused test recomputes this digest from the three pads, review courtyard, and
suppressed solder-paste count. The BP-033 application-footprint closure ledger
links this exact candidate, source hash, pin map, and digest under
`U_USB_DATA_PROTECT`; its independent review remains pending and its release
authority remains denied.

TI does not publish a stencil aperture for this package. The review artifact
explicitly suppresses tscircuit's default solder-paste apertures with a -1 mm
paste margin, records paste geometry as null, and keeps stencil selection an
independent review gate.

## CAD and release disposition

No native TI ECAD or 3D artifact is retained or imported. TI's product page
routes the SOT-9X3 CAD link to its sponsored Ultra Librarian endpoint; that
route is recorded as unavailable for this slice and does not provide CAD
acceptance. The rendered artwork is only a source-controlled review input.

The following remain denied and false:

- project geometry acceptance
- independent orientation acceptance
- manufacturer CAD import
- board import and board fit
- courtyard acceptance and DRC acceptance
- fabrication authorization and release

Remaining gates are independent footprint and orientation review, native CAD
acquisition or an explicitly approved alternative, board placement and fit,
schematic and net reconciliation, ERC/DRC, fabrication evidence, and root
release approval. This slice does not approve, mark done, or authorize
fabrication.
