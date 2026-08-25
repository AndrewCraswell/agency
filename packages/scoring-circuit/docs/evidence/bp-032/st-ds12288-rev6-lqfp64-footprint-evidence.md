# ST DS12288 Rev 6 LQFP64 footprint evidence

This evidence record binds the BP-032 candidate footprint for the exact
`STM32G474RET3TR` orderable to the retained STMicroelectronics family
datasheet `DS12288 Rev 6`. The selected order code is decoded by Table 124 on
printed page 232: `R` is 64 pins, `E` is 512 Kbytes, `T` is LQFP, `3` is the
minus 40 to 125 degree C grade, and `TR` is tape and reel. The package drawing
is therefore applicable to the selected orderable's LQFP64 package, but this
record does not claim exact-orderable CAD.

## Retained official source

- Manufacturer: STMicroelectronics
- Document: `STM32G474xB STM32G474xC STM32G474xE`, DS12288 Rev 6
- Official URL: https://www.st.com/resource/en/datasheet/stm32g474re.pdf
- Retained artifact: `packages/scoring-circuit/docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf`
- SHA-256: `B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD`
- Package outline: printed pages 210-211, Figure 62 and Table 115
- Recommended footprint: printed page 211, Figure 63, drawing code `ai14909c`
- Pin-one/top-view marking: printed page 212, Figure 64; package pin order is
  also shown by Figure 63

Figure 63 is the source for the 0.500 mm pitch, 0.300 mm tangential copper
width, 1.200 mm radial copper length, 10.3 mm inner pad-edge span, 12.7 mm
outer copper span, and 7.8 mm tangential outer-edge span. Table 115 supplies
the nominal 10.000 mm body dimensions (`D1` and `E1`) and the 1.350-1.450 mm
body height (`A2`).

## CAD availability disposition

ST's product page for the STM32G474RE family advertises EDA symbols,
footprints, and 3D models through the listed Ultra Librarian and SamacSys
suppliers. No exact-orderable CAD archive was retrieved into this evidence
folder during this review. No supplier model or generic LQFP64 substitute is
used by the candidate. `manufacturerCad` therefore remains `not-acquired` and
the authority remains `deny`.

The mask opening, paste aperture, courtyard, pin-one marker, and rendered
tscircuit geometry in the candidate are project review inputs derived from the
source copper dimensions and stated clearances. They are not manufacturer CAD,
do not supersede Figure 63, and do not authorize fabrication.
