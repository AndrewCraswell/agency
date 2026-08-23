# USB-C and PD footprint library

`src/usb-pd-footprints.ts` is an import-ready, source-controlled land-pattern
library for the selected USB-C power path. It records the top-view coordinate
frame, pad centers and dimensions, pin role, orientation, thermal pad, mask
intent, paste evidence, and courtyard evidence. It is deliberately separate
from `index.circuit.tsx`: no part is made placeable by this library.

## Release state

Every record remains `deny` for fabrication. A verified copper land pattern is
not a fabrication release. The assembler, board stackup, copper spreading,
mask expansion, paste apertures, high-current return path, panel module, and
thermal results must be reviewed together before any DNP gate changes.

The Amphenol `10177070-00011LF` record is more restrictive. The project has
the official drawing URL, but the manufacturer CDN returned an access-control
failure during this review. It therefore has no generated pads, orientation, or
pin mapping. It remains deny until the drawing and STEP file are acquired and
overlaid in CAD.

## Primary evidence

| MPN | Manufacturer primary drawing | Copper evidence | Specific hold point |
| --- | --- | --- | --- |
| `10177070-00011LF` | [Amphenol drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf) | Not available to this project | Acquire drawing and STEP. Verify contacts, shell stakes, board edge, 0.80 mm board, paste, courtyard, and chassis support. |
| `TPS25730ADREFR` | [TI TPS25730A data sheet](https://www.ti.com/lit/ds/symlink/tps25730a.pdf), REF0038A pp. 61-63 | Verified | Review the documented thermal-pad stencil coverage, two thermal pad networks, optional vias, PPHV and VBUS copper, surge behavior, and thermal path. |
| `TPD4S201TRGRRQ1` | [TI TPD4S201-Q1 data sheet](https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf), RGR0020C pp. 26-28 | Verified | Qualify the TI 0.125 mm stencil example with 81% exposed-pad coverage and release the connector-side CC escape and surge return. |
| `TVS2200DRVR` | [TI TVS2200 data sheet](https://www.ti.com/lit/ds/symlink/tvs2200.pdf), DRV0006A pp. 18-20 | Verified | Qualify the TI 0.125 mm stencil example with 88% exposed-pad coverage, then validate the VBUS surge return and chip-pin waveform. |
| `TPS259474ARPWR` | [TI TPS25947 data sheet](https://www.ti.com/lit/ds/symlink/tps25947.pdf), RPW0010A pp. 72-74 | Verified | Qualify the TI 0.100 mm stencil example with 93% coverage on pads 1, 4, 7, and 10 and 82% on HotRod pads 5 and 6. Validate heat spreading and fault current. |
| `B340A-13-F` | [Diodes B320A-B360A data sheet](https://www.diodes.com/datasheet/download/B340A.pdf), p. 6 | Verified | Define stencil and courtyard. Match the cathode band to pad K on the received reel. |
| `T523H107M035APE070` | [KEMET T52X/T530 data sheet](https://content.kemet.com/datasheets/KEM_T2076_T52X-530.pdf), pp. 37 and 41 | Verified | Apply the published H-case density-B copper and courtyard. Qualify stencil, polarity, ripple, surge, and temperature. |
| `T55A106M010C0200` | [Vishay T55 data sheet](https://www.vishay.com/docs/40174/t55.pdf), p. 2, and Polymer Guide p. 26 | Verified | Apply the case-A pad geometry. Qualify stencil and match the anode belt to the positive pad. |

## Geometry policy

Coordinates are millimetres and use the package top view with positive X to the
right and positive Y upward. The numbered QFN patterns preserve the
manufacturer pin-one convention. The B340A uses named A and K pads because the
manufacturer suggested-layout drawing specifies the cathode band but does not
assign numeric pad identifiers.

The KEMET H-case capacitor uses its manufacturer density-B geometry: 2.37 mm
by 4.13 mm pads, 3.87 mm inner spacing, and a 9.12 mm by 6.80 mm courtyard.
The Vishay case-A capacitor uses its manufacturer guide: 1.35 mm by 1.35 mm
pads with a 1.10 mm maximum gap and 3.80 mm minimum end-to-end pattern.

This file supersedes no component gate. It gives CAD a primary-source basis
for import and review while making unsupported assumptions visibly fail closed.
