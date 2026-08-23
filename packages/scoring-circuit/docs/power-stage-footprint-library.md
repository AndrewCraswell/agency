# Power-stage footprint evidence library

`src/power-stage-footprints.ts` is a drawing-traceability library for the
selected USB-PD to V5 and V5 to V3_3 power path. It does not create physical
PCB copper and every entry is intentionally `deny` for fabrication release.
The existing DNP and fabrication gates remain authoritative.

## What is encoded

The library records the primary drawing, drawing pages, package body,
manufacturer land dimensions, terminal mapping, orientation, paste guidance,
solder-mask guidance, thermal features, and courtyard status for these parts:

| Part | Source status | Why it remains denied |
| --- | --- | --- |
| TI `LMR43620MSC3RPERQ1` | RPE0009A land, mask, stencil, and HotRod guidance transcribed | Assembly courtyard, locked compound CAD artwork, and board evidence remain open |
| Coilcraft `XGL4030-222MEC` | Exact two-pad land is transcribed | Source does not give paste, mask, or courtyard rules |
| TI `TPS56A37RPAR` | RPA0010A land, mask, stencil, and HotRod guidance transcribed | Assembly courtyard, locked heterogeneous CAD artwork, and board evidence remain open |
| Würth `744325330` | Exact two-pad land is transcribed | Source does not dimension its dashed courtyard or define paste and mask rules |
| Bourns `CRE2512-FZ-R002E-3` | Exact R001-R004, including R002, two-pad land is transcribed | Source does not define paste, mask, or courtyard rules; Kelvin escape still needs CAD review |
| Vishay `T55A106M010C0200` | Current Polymer Guide 40076 revision 20-May-2026, page 12, controls the Case-A copper pattern | Source does not define paste, mask, or courtyard rules; the T55 data sheet separately controls case height and polarity |
| KEMET `T523H107M035APE070` | H-case density-B copper and courtyard are transcribed | Source does not prescribe a stencil or mask rule |
| Selected V5 / V3_3 MLCCs | Exact part numbers and body case are recorded | A manufacturer part-specific land pattern has not yet been imported, so no tentative generic footprint is emitted |

## Coordinate and polarity convention

The source drawing controls package orientation. For the polarized polymer
capacitors, pad 1 is the anode beneath the supplier's plus mark and pad 2 is
the cathode. The passive inductors and shunt are electrically symmetric, but
the Coilcraft inductor's marked short-lead side is intentionally oriented to
the high dV/dt switch node for EMI.

The TI regulators are not generic QFN footprints. Their compound high-current
lands, thermal terminals, mask rules, and stencils must be imported together
from the named TI drawing. In particular, do not mirror the `TPS56A37` RPA
pattern or simplify the `LMR43620` RPE HotRod ground geometry.

## Primary sources

- [TI LMR43620-Q1 data sheet, RPE0009A](https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf)
- [Coilcraft XGL4030 data sheet, document 1575-4](https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf)
- [TI TPS56A37 data sheet, RPA0010A](https://www.ti.com/lit/ds/symlink/tps56a37.pdf)
- [Würth 744325330 data sheet](https://www.we-online.com/components/products/datasheet/744325330.pdf)
- [Bourns CRE2512 data sheet](https://www.bourns.com/docs/product-datasheets/cre.pdf)
- [Vishay Polymer Guide 40076](https://www.vishay.com/docs/40076/polymerguide.pdf)
- [Vishay T55 data sheet 40174](https://www.vishay.com/docs/40174/t55.pdf)
- [KEMET T523/T548 high-energy application data sheet](https://content.kemet.com/datasheets/KEM_T2079_SSD.pdf)

## Remaining release work

1. Import the named source geometry into the PCB CAD system with a recorded
   source revision and independent overlay review.
2. Define mask, paste, and courtyard features where the component supplier
   does not provide them; review the resulting manufacturing rule set.
3. Complete power-stage layout, assembly, load-step, thermal, and EMC
   qualification. This library cannot replace those measurements.
