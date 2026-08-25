# BP-033 `D_SOURCE_SELECTOR` B340A-13-F review footprint

This is an isolated BP-033 review artifact for the exact Diodes Incorporated
orderable `B340A-13-F`. It does not change the BP-033 ledger or shared USB-PD
footprint library, instantiate a board component, or authorize placement,
routing, assembly, release, or fabrication.

## Exact source and identity

The retained official source is the [Diodes Incorporated B320A-B360A
datasheet](https://www.diodes.com/datasheet/download/B340A.pdf), document
`DS30891 Rev. 19-2`, April 2026:

| Evidence | Repository artifact | Pages | SHA-256 | Disposition |
| --- | --- | ---: | --- | --- |
| B340A family identity, SMA package, cathode-band polarity, electrical selection, package outline, and suggested pad layout | `docs/evidence/bp-033/diodes-b340a-datasheet.pdf` | 1, 2, 6 | `453CBD34D996482ABD07AC694C4E2D812D26B1D679D05EE325ACC5C3EEB79917` | retained manufacturer-primary source |

Page 1 identifies the `B3XXA-13-F` tape-and-reel orderable pattern and gives
`B320A-13-F` as its example; the exact `B340A-13-F` selection follows the
documented `XX = device type` construction and the canonical BP-033 row. It identifies the package as SMA and the
polarity as a cathode band. Page 2 selects B340A at 40 V reverse-repetitive
voltage with a 0.50 V maximum forward drop at 3 A. Page 6 gives the SMA
package outline and the suggested pad layout.

## Source land pattern

`src/bp033-b340a-project-footprint.tsx` transcribes only the page-6 suggested
copper layout in the package-center top-view frame. It uses named pads because
this is a polarized two-terminal diode, not a numbered IC:

| Pad | Role | Center (mm) | Copper (mm) |
| --- | --- | ---: | ---: |
| `A` | anode | `(-2.00, 0.00)` | `2.50 x 1.70` |
| `K` | cathode | `(2.00, 0.00)` | `2.50 x 1.70` |

The source dimensions are center spacing `C = 4.00 mm`, pad gap `G = 1.50
mm`, pad length `X = 2.50 mm`, overall copper span `X1 = 6.50 mm`, and pad
width `Y = 1.70 mm`. The source package outline is retained as limits: body
`A 2.29-2.92 mm`, `B 4.00-4.60 mm`, `C 1.27-1.63 mm`, `D 0.15-0.31 mm`, `E
4.80-5.59 mm`, `G 0.05-0.20 mm`, `H 0.76-1.52 mm`, and `J 1.96-2.40 mm`.

The artifact binds the cathode band to pad `K` and carries a zero-degree
nominal board rotation. This is a source identity and orientation input, not
an independent received-reel or CAD overlay acceptance. Assembly must match
the physical band on the exact reel to `K` before any future release review.

## Explicitly unearned data and gates

The Diodes PDF is not an ECAD or 3D-CAD deliverable. No official CAD artifact
is retained. The PDF does not publish solder-mask expansion, stencil aperture
reduction, or courtyard geometry. The review component therefore emits only
the two copper pads, suppresses inferred paste apertures, and emits no
courtyard. The zero mask margin in the render is a neutral review placeholder,
not a released mask rule.

The following remain denied in the source artifact:

- independent orientation overlay and project geometry acceptance;
- official CAD import;
- board import, board fit, edge or keepout review;
- solder-mask, solder-paste, and courtyard acceptance;
- electrical validation of forward drop, current, surge, thermal behavior, or
  source-selector transients;
- release and fabrication authorization.

The rendered copper geometry is source-controlled with SHA-256
`87a6f500c01f3c0cdc8e00948aec189c899a3a6a63b8026f8098dd073dab8d0b`. This
hash covers the two rendered rectangular copper pads and their coordinates,
dimensions, and neutral mask margin; it is not a fabrication approval.
