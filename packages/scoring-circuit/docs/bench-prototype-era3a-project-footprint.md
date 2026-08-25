# BP-031 ERA3AEB2491V project footprint

This is an isolated tscircuit review artifact for `R_SOURCE_1` through
`R_SOURCE_7`. It is not instantiated on a board and does not approve a PCB
release.

The only manufacturer inputs are Panasonic's [ERA A type datasheet,
AOA0000C309](https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf)
and [surface-mount resistor land-pattern guidance,
DMM0000COL20](https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/DMM0000COL20.pdf).
AOA0000C309 defines ERA3A as the 1608 (0603) 1.60 plus-or-minus 0.20 mm by
0.80 plus-or-minus 0.20 mm package. DMM0000COL20 supplies the high-precision
ERA 1608 rectangular-land row: `a` is 0.7 to 0.9 mm, `b` is 2.0 to 2.2 mm,
and `c` is 0.8 to 1.0 mm. The project selection is `a` = 0.8 mm pad length,
`b` = 2.1 mm overall land span, and `c` = 0.9 mm pad width. Its derived pad
gap is `b - 2a` = 0.5 mm and its pad centers are at plus-or-minus 0.65 mm.

The retained manufacturer sources are hash-bound in code: `panasonic-era3aeb2491v-datasheet.pdf`
is `FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79`, and
`panasonic-resistor-land-pattern.pdf` is
`65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D`.

The code names the two terminals `A` and `B`: they are non-polar, so this is
not a pin-one assertion. Copper is selected within the manufacturer guidance;
the 0.05 mm mask expansion, 0.05 mm per-edge paste reduction, and 2.40 mm by
1.30 mm courtyard are conservative project review inputs, not Panasonic CAD.

Manufacturer CAD is unavailable. Orientation review remains pending.
Fabrication authority is denied, and `accepted` is false. A future layout
review must select the orientation in its local circuit context and verify the
actual board's fabrication rules before any board instantiation or release.
