# BP-032 TI reset and watchdog candidate footprints

This is a review-only BP-032 evidence slice for the exact selected parts
`TPS389033DSER` and `TPS3431SDRBR`. It does not change the processor ledger,
board circuit, backlog, or the retained evidence directory. The source and test
are deliberately isolated and are not imported by a board.

## Exact identity and retained evidence

| MPN | TI package | Package drawing | Retained source | SHA-256 |
| --- | --- | --- | --- | --- |
| `TPS3431SDRBR` | VSON-8 (DRB), 3 mm x 3 mm | `DRB0008A` | `docs/evidence/bp-032/ti-tps3431.pdf` | `99BF5DBFFFE06E8F85D9A86CFB777A0151E85B4A103033BC025F4897A0BDC6F3` |
| `TPS389033DSER` | WSON-6 (DSE), 1.5 mm x 1.5 mm | `DSE0006A` | `docs/evidence/bp-032/ti-tps3890.pdf` | `EE79599730E7606BA9718D9820B411020E3DCD9FF7D44572F8EE63FEAD15B9D0` |

The candidate source binds the source URLs, retained artifact paths, SHA-256
digests, and reviewed PDF pages. The focused test hashes both local artifacts
before accepting the evidence slice.

The candidate also binds the four BP-123 references in
`src/bench-prototype-reset-watchdog.ts`: both `U_STM_*` and `U_ESP_*` use one
`TPS389033DSER` supervisor and one `TPS3431SDRBR` watchdog. The retained
BP-123 source digest is
`0F10F1E308C0B3760C38A5A30405D727F1115BFFAC1C3F141D8EAF8789DD7E23`, as
reconciled to integration commit `a84fb13`. The focused test validates the live
BP-123 contract, its exact source bytes, and all four reference-to-MPN bindings.

## TPS3431SDRBR

TI page 3 maps pins 1 through 8 as `VDD`, `CWD`, `EN`, `GND`, `SET1`, `WDI`,
`WDO`, and `ENOUT`. Pages 28 and 29 provide the DRB0008A outline and example
board layout. The candidate transcribes eight 0.6 x 0.31 mm perimeter lands at
0.65 mm pitch, with pin 1 at the upper-left in the TI top view. The center
exposed GND pad is 1.5 x 1.75 mm. TI shows four optional 0.2 mm vias at the
cross locations recorded in the source.

The page-29 mask details record the NSMD preferred option with 0.07 mm maximum
opening expansion and the SMD alternative with 0.07 mm minimum overlap. Page 30
records a 0.125 mm stencil example, including 84% printed coverage for the
exposed pad and its drawn 1.34 x 1.55 mm envelope. The candidate records this
manufacturer example without pretending that its aperture segmentation is a
released CAD shape.

## TPS389033DSER

TI page 3 maps pins 1 through 6 as `SENSE`, `GND`, `MR`, `VDD`, `CT`, and
`RESET`. Pages 24 and 25 provide the DSE0006A outline and example board layout.
The candidate transcribes six 0.7 x 0.25 mm perimeter lands at 0.5 mm pitch,
with pin 1 at the upper-left in the TI top view. No exposed thermal pad is
shown. TI page 25 records SMD mask definition with 0.05 mm minimum overlap for
pads 1-3 and NSMD preferred with 0.05 mm maximum expansion for pads 4-6. Page
26 records six 0.7 x 0.25 mm paste apertures on a 0.125 mm stencil.

## CAD and fabrication disposition

The retained artifacts are official TI datasheet PDFs only. No TI footprint
library, CAD archive, or generated artwork is substituted. Neither datasheet
publishes a courtyard. Therefore the source records copper, mask, and stencil
facts only where the manufacturer drawing provides them; courtyard geometry is
`not-published`, manufacturer CAD state is `not-retained-official-cad`, and
both `accepted` and `fabricationAuthority` remain false/deny. These candidates
require independent CAD overlay, assembly, and fabricator review before any
board use or fabrication decision.
