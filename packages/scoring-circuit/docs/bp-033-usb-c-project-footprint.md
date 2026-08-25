# BP-033 `J_USB_C` manufacturer-layout transcription

This is the isolated BP-033 review artifact for the selected Amphenol orderable
`10177070-00011LF`. It does not instantiate a board component, change the
communications-module footprint, or authorize schematic, placement, routing,
assembly, or fabrication work.

## Exact identity and retained drawing

The BP-050 selection remains ledger reference `J_USB_C`, manufacturer
`Amphenol ICC`, MPN `10177070-00011LF`. The current manufacturer surfaces use
the related names Amphenol FCI and Amphenol Communications Solutions; those
aliases are recorded in the project artifact without changing the retained
ledger identity.

The retained primary source is the official [Amphenol FCI product
drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf):

| Evidence | Repository artifact | Revision | SHA-256 | Disposition |
| --- | --- | --- | --- | --- |
| Product drawing 10177070, package identity and recommended layout on pages 1-2 | `docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf` | A, released 2025-06-27 | `A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF` | retained manufacturer source |
| 3D model listed by the product page | [official STP archive](https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip) | not retained | no hash | access-gated; no substitute CAD claimed |

Page 2 identifies a USB TYPE C 16P SMT TYPE and publishes the
`RECOMMENDED PCB LAYOUT (TOP VIEW)`: board thickness `0.80 mm` and default
tolerance `+/-0.05 mm`. The electrical package has 16 source pins but the
recommended layout merges them onto 12 physical copper lands. The page-2
product-edge datum is the horizontal reference line. The dimensioned layout
uses the bottom shell-slot centerline as its coordinate datum; the drawing
does not publish an offset from that datum to the product-edge line.

## Manufacturer land pattern

The source-controlled artifact in
`src/bp033-usb-c-project-footprint.tsx` transcribes the page-2 land row. The
land centers are at `x = -3.20, -2.40, -1.75, -1.25, -0.75, -0.25, 0.25,
0.75, 1.25, 1.75, 2.40, 3.20 mm`. Page 2 dimensioned the 12 land lower and
upper edges at `4.17 mm` and `5.32 mm` from the shell-slot datum, so the
review rendering uses the derived center `4.745 mm` and height `1.15 mm`.

| Physical lands | Width | Source signal assignment |
| --- | ---: | --- |
| `LAND_A1_B12` | 0.60 mm | `A1/B12`, GND |
| `LAND_A4_B9` | 0.60 mm | `A4/B9`, VBUS |
| `LAND_B8` through `LAND_A8` | 0.30 mm each | `B8`, `A5`, `B7`, `A6`, `A7`, `B6`, `B5`, `A8` |
| `LAND_B4_A9` | 0.60 mm | `B4/A9`, VBUS |
| `LAND_B1_A12` | 0.60 mm | `B1/A12`, GND |

This is one row of four combined power/ground lands and eight signal lands,
not two rows of 16 separate pads. The drawing also specifies four shell
mounting slots: two `1.17 mm` by `2.10 mm` slots and two `1.40 mm` by `1.80 mm`
slots, with `4.18 mm` center spacing and `8.64 mm` slot-center spacing. The
page depicts two additional `0.65 mm` diameter holes at `5.78 mm` center
spacing; these are retained as drawing datum holes in the isolated artwork.
The top shell-slot centerline is `4.18 mm` above the bottom shell-slot datum;
the two datum holes are `3.68 mm` above it. The product-edge line is retained
as a source orientation datum, without a guessed coordinate offset.

No mask opening, paste aperture, courtyard, enclosure/chassis support, or CAD
import is inferred. Those remain separate review inputs and are not emitted by
this artifact as accepted manufacturing data.

## Orientation and acceptance

The top-view orientation preserves the source order from the leftmost merged
`A1/B12` land through the rightmost merged `B1/A12` land. Root reviewer
`root-final-reviewer` visually inspected retained drawing pages 1 and 2 on
2026-08-25 and accepts the exact orderable/package, 12-land source-pin/net
order, slot and datum-hole geometry, product-edge wording, and top-view
orientation. The artifact still has no accepted mask, paste, courtyard,
board fit, chassis support, CAD import, release, or fabrication authority.

The ledger maps the exact selection to this artifact through
`projectFootprintMappings[0]`:

| Ledger field | Value |
| --- | --- |
| Reference | `J_USB_C` |
| Candidate artifact kind | `bp033-usb-c-project-footprint` |
| Artwork module | `src/bp033-usb-c-project-footprint.tsx` |
| Review document | `docs/bp-033-usb-c-project-footprint.md` |
| Source artifact | `docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf` |
| Fabrication release | `deny` |

The ledger row is exact-package-identified and remains `DNP-unresolved`. The
candidate marks package-drawing and manufacturer-land-pattern capture true,
but CAD import, independent overlay, orientation, board-edge datum, mask and
paste, courtyard, board fit, chassis support, and fabrication false. BP-033
overall release remains `deny`; no BP-143 or BP-146 dependency is changed by
this slice.
