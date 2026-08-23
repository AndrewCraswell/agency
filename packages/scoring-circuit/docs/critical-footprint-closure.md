# Fabrication-critical footprint closure

The selected MPN is not sufficient for fabrication. The circuit model has no
approved custom-land-pattern importer, so a generic tscircuit footprint can
silently generate wrong copper. The components below are deliberately DNP in
the generated PCB output. They remain a fabrication **DENY** until an exact
manufacturer pattern is imported into the release CAD and independently
reviewed.

| Selected part | Package evidence | Release evidence required |
| --- | --- | --- |
| Coilcraft XGL4030-222MEC | 2-terminal XGL4030, 4.3 mm maximum square body | Coilcraft land pattern; terminal copper, mask, paste, courtyard, and 50 C thermal test |
| Amphenol 10177070-00011LF | 16-contact Type-C receptacle, 0.80 mm PCB | Drawing and STEP overlay; contact and shell-stake pads; paste, board edge, courtyard, mating axis, and chassis load path |
| TI TPS25730ADREFR | 38-terminal DRE WQFN, 6 mm by 4 mm, exposed thermal pad | TI package pattern; pin-1, all terminals, pad/via/paste/mask/courtyard, and PD/surge layout review |
| TI TPS259474ARPWR | 10-terminal RPW VQFN-HR, exposed thermal pad | TI package pattern; pin-1, terminals, thermal-pad via/paste/mask/courtyard, and 20 V/3 A thermal fault test |
| TI TPS56A37RPAR | 10-terminal RPA VQFN-HR, 3 mm by 3 mm, exposed thermal pad | TI package pattern; pin-1, terminals, thermal-pad via/paste/mask/courtyard, and switching/thermal validation |
| Würth Elektronik 744325330 | 2-terminal WE-HCI high-current shielded inductor | Exact Würth drawing and land pattern; terminal copper, mask, paste, courtyard, switching-loop, bias, and thermal validation |
| Bourns CRE2512-FZ-R002E-3 | 2-terminal 2512, 3 W current shunt | Exact copper/paste/courtyard; high-current path and Kelvin escape; terminal-temperature validation |
| Vishay T55A106M010C0200 | 2-terminal polarized 1206 polymer tantalum | Exact case drawing; polarity, paste, courtyard, and assembly orientation |
| TI LMR43620MSC3RPERQ1 | 9-terminal RPE VQFN-HR, 2 mm by 2 mm, HotRod thermal copper | TI package pattern; pin-1, terminals, thermal copper/via/paste/mask/courtyard, and switching/thermal validation |
| KEMET T523H107M035APE070 | 2-terminal polarized H-case polymer tantalum, EIA 7360-20 | Exact case drawing; polarity, paste, courtyard, and ripple/surge-temperature validation |

The executable contract is in
[`fabrication-footprint-gates.ts`](../src/fabrication-footprint-gates.ts). Its
tests require every gated reference to have no generic footprint, no generated
SMT pads, and `doNotPlace: true`. The DNP state must only be removed as part of
a focused CAD-import change that adds the exact pad geometry and records the
independent review.

Primary sources:

- [Coilcraft XGL4030 data sheet](https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf)
- [Amphenol 10177070 drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf)
- [TI TPS25730A data sheet](https://www.ti.com/lit/ds/symlink/tps25730a.pdf)
- [TI TPS25947 data sheet](https://www.ti.com/lit/ds/symlink/tps25947.pdf)
- [TI TPS56A37 data sheet](https://www.ti.com/lit/ds/symlink/tps56a37.pdf)
- [Würth Elektronik 744325330 data sheet](https://www.we-online.com/components/products/datasheet/744325330.pdf)
- [Bourns CRE data sheet](https://www.bourns.com/docs/product-datasheets/cre.pdf)
- [Vishay T55 data sheet](https://www.vishay.com/docs/40030/t55.pdf)
- [TI LMR43620-Q1 data sheet](https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf)
- [KEMET T523 data sheet](https://content.kemet.com/datasheets/KEM_T2076_T52X-530.pdf)
