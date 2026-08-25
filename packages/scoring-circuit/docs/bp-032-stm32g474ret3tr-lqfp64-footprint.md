# BP-032 STM32G474RET3TR LQFP64 candidate footprint

This is a bounded, review-only footprint candidate for the exact
`STM32G474RET3TR` orderable. It does not modify the existing BP-032 processor
ledger, processor-support contract, board model, or fabrication release.

The candidate is executable in
[`bp032-stm32g474ret3tr-lqfp64-footprint.tsx`](../src/bp032-stm32g474ret3tr-lqfp64-footprint.tsx)
and is tested by
[`bp032-stm32g474ret3tr-lqfp64-footprint.test.tsx`](../src/bp032-stm32g474ret3tr-lqfp64-footprint.test.tsx).
The retained-source record is
[`st-ds12288-rev6-lqfp64-footprint-evidence.md`](evidence/bp-032/st-ds12288-rev6-lqfp64-footprint-evidence.md).

## Exact source binding

| Field | Bound value |
| --- | --- |
| Manufacturer | STMicroelectronics |
| Exact MPN | `STM32G474RET3TR` |
| Package | `LQFP64` |
| Official source | [ST DS12288 Rev 6](https://www.st.com/resource/en/datasheet/stm32g474re.pdf) |
| Retained bytes | `docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf` |
| SHA-256 | `B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD` |
| Package identity | Table 124, printed page 232 |
| Package outline | Figure 62 and Table 115, printed page 210 |
| Recommended footprint | Figure 63, printed page 211, drawing code `ai14909c` |
| Pin-one marking | Figure 64, printed page 212, with Figure 63 pin order |

The ordering-code table binds the orderable to the 64-pin LQFP package. The
package drawing is family-level evidence applicable to the selected package;
it is not an exact-orderable CAD archive.

## Geometry derived from the official drawing

The source gives 64 pads arranged as four rows of 16, with 0.500 mm pitch.
Figure 63 gives 0.300 mm tangential copper width, 1.200 mm radial copper
length, 10.3 mm inner pad-edge span, 12.7 mm outer pad-edge span, and 7.8 mm
tangential outer-edge span. The candidate places pad centers at +/-5.75 mm in
the radial direction and -3.75 mm through +3.75 mm in the tangential
direction. Pin 1 is the lower-left pad at (-3.75, -5.75) mm for the candidate's
zero-degree top-view orientation; numbering then proceeds counterclockwise.

The nominal package body is 10.0 mm by 10.0 mm from Table 115 (`D1` and
`E1`). The candidate uses these project-derived review inputs:

- solder-mask margin 0.05 mm per edge, yielding 0.400 mm by 1.300 mm openings
  for a tangential pad and 1.300 mm by 0.400 mm openings for a side pad;
- paste reduction 0.05 mm per edge, yielding 0.200 mm by 1.100 mm apertures
  for a tangential pad and 1.100 mm by 0.200 mm apertures for a side pad;
- a 13.2 mm by 13.2 mm courtyard, which leaves 0.25 mm beyond the larger of
  the 10.0 mm body and 12.7 mm copper envelope; and
- a project pin-one silkscreen circle outside the pad field.

The mask, paste, courtyard, and marker choices are not claimed by ST and must
be independently checked against the PCB tool output, assembly process, and
the final land-pattern review.

## CAD and release disposition

ST's [STM32G474RE product page](https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html)
lists EDA suppliers Ultra Librarian and SamacSys. No exact-orderable CAD file
was retained in this slice, and no generic LQFP64 or supplier substitute is
silently imported. The candidate records `manufacturerCad.state` as
`not-acquired` and all fabrication authority as `deny`.

Acceptance, board integration, orientation sign-off, solder-mask and stencil
release, schematic sign-off, and fabrication authorization remain false.
