# BP-033 `U_USB_PORT_PROTECT` TPD4S201 review-only footprint evidence

This is a BP-033 source transcription for the canonical application reference
`U_USB_PORT_PROTECT`. The ledger records `U_USB_CC_SBU_PROTECT` as an explicit
source/ledger alias only. The candidate does not instantiate a board component,
import manufacturer CAD, or authorize placement, routing, assembly, release, or
fabrication.

## Exact identity and retained primary evidence

The exact orderable is Texas Instruments `TPD4S201TRGRRQ1`, device
`TPD4S201-Q1`, exact TI package designation `VQFN (RGR), 20-pin`. TI's package
option addendum on page 21 identifies the orderable as active and production,
VQFN (RGR), 20 pins. The canonical package label is corrected to
`VQFN-20 (RGR), 3.5mm x 3.5mm nominal body`; the former application alias is
not a package designation. The canonical reference is `U_USB_PORT_PROTECT`;
`U_USB_CC_SBU_PROTECT` is an explicit ledger alias only.

The retained manufacturer PDF is:

| Evidence | Repository artifact | Pages used | SHA-256 | Disposition |
| --- | --- | --- | --- | --- |
| TI `TPD4S201-Q1` datasheet, SLVSI17, June 2025 | `docs/evidence/bp-033/ti-tpd4s201-q1-datasheet.pdf` | 1, 3-4, 21, 26-28 | `E5A00ECD4BBAD07C21A92754DA2050950B91EBA32A960381FD5C1DE921B758D5` | retained manufacturer primary source |

The official source is [TI's TPD4S201-Q1 datasheet](https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf).
The source bytes in the repository are hash-checked by the focused test.

## Package, pins, and manufacturer land pattern

Pages 3-4 bind the top-view RGR pin map and functions:

| Pin | Name | TI function boundary |
| ---: | --- | --- |
| 1 | `C_SBU1` | Connector-side SBU1 OVP FET |
| 2 | `C_SBU2` | Connector-side SBU2 OVP FET |
| 3 | `VBIAS` | ESD support capacitor pin |
| 4 | `C_CC1` | Connector-side CC1 OVP FET |
| 5 | `C_CC2` | Connector-side CC2 OVP FET |
| 6 | `RPD_G2` | Dead-battery resistor or GND return |
| 7 | `RPD_G1` | Dead-battery resistor or GND return |
| 8 | `GND` | Ground |
| 9 | `FLT` | Open-drain fault output |
| 10 | `VPWR` | 2.7 V to 4.5 V supply |
| 11 | `CC2` | System-side CC2 OVP FET |
| 12 | `CC1` | System-side CC1 OVP FET |
| 13 | `GND` | Ground |
| 14 | `SBU2` | System-side SBU2 OVP FET |
| 15 | `SBU1` | System-side SBU1 OVP FET |
| 16 | `NC` | No connect; may float or ground |
| 17 | `NC` | No connect; may float or ground |
| 18 | `GND` | Ground |
| 19 | `NC` | No connect; may float or ground |
| 20 | `NC` | No connect; may float or ground |
| 21 | exposed thermal pad | Internally connected to GND |

The RGR0020C package outline on page 26 gives 0.5 mm pitch, 20 perimeter
terminals, a `2.05 mm x 2.05 mm` exposed thermal pad, and a package body from
`3.35 mm` to `3.65 mm` (`3.5 mm` nominal), with a maximum height of `1.0 mm`.
Page 27 gives the manufacturer example copper: `20 x 0.6 mm x 0.24 mm`
perimeter lands on a `3.3 mm x 3.3 mm` land-pattern span and the central
`2.05 mm x 2.05 mm` exposed pad. It also shows the optional `0.2 mm` vias under
the exposed pad. Page 27's preferred non-solder-mask-defined detail shows a
`0.07 mm` maximum mask expansion all around the perimeter copper.

The package body and land span must not be conflated: TI's exact nominal body
is `3.5mm x 3.5mm` (`3.35mm` to `3.65mm`), while `3.3mm` is the land-pattern
span. The artifact records both values and keeps board-fit acceptance denied.

The explicit terminal-to-circuit port aliases are: TI pin 9 `FLT` to circuit
port `FLT_N`; TI pins 8, 13, and 18 `GND` to `GND_8`, `GND_13`, and `GND_18`;
TI pins 16, 17, 19, and 20 `NC` to `NC_16`, `NC_17`, `NC_19`, and `NC_20`; and
exposed pad 21 `GND` to `THERMAL_GND`. Other TI names retain their canonical
names. These aliases are source-controlled review data, not alternate
electrical functions.

## Stencil and orientation disposition

Page 28 is a manufacturer example based on a `0.125 mm` stencil. It shows
twenty `0.56 mm x 0.24 mm` perimeter apertures and four `0.92 mm x 0.92 mm` exposed-pad
apertures, labelled as `81%` printed solder coverage under exposed pad 21.
The source-controlled rendering emits all twenty perimeter apertures at those
exact dimensions. To keep the isolated rendering deterministic, it represents
only the stated exposed-pad area as one symmetric aperture; it does not claim
that TI's four-aperture segmentation or any assembler's process has been
accepted.

The package top view places pin 1 at the upper-left package corner, marked by
the RGR0020C pin-1 index area. Numbering proceeds counter-clockwise in that top
view. The candidate records zero board rotation and the pin-1 coordinate
`(-1.35 mm, +1.00 mm)`, but `independentlyReviewed` and orientation acceptance
remain false.

## CAD, board fit, and release gates

No TI-native ECAD, STEP, or other CAD artifact is retained in this slice. The
PDF is evidence, not CAD; `manufacturerCad.state` is `not-acquired`, its path
and hash are `null`, and its authority is `deny`.

The generated component in
`src/bp033-tpd4s201-rgr-project-footprint.tsx` is an isolated review candidate
only. Its 4.15 mm square courtyard is a project DRC envelope derived from the
maximum package body plus 0.25 mm clearance; TI publishes no courtyard, so it
is not manufacturer data. Project mask, paste segmentation, courtyard, pin-one
orientation, CAD import, board import, board fit, DRC, fabrication, and release
are all denied. The package-label discrepancy must be resolved before any
board-fit or release decision.

Focused validation is in
`src/bp033-tpd4s201-rgr-project-footprint.test.tsx`: it checks the exact source
hash, all 20 pin functions and land coordinates, exposed pad and stencil data,
rendered geometry, and fail-closed authority tampering. This slice does not
approve, mark complete, stage, or commit BP-033.
