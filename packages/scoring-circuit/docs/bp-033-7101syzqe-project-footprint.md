# BP-033 S_SOURCE_SELECTOR C&K 7101SYZQE review slice

This page records the bounded source and review-artwork slice for the exact
`S_SOURCE_SELECTOR` manufacturer part number `C&K 7101SYZQE`. It does not
change the BP-033 canonical ledger, BOM, board, backlog, or release state.

## Source resolution

The official [C&K 7101SYZQE product page](https://www.ckswitches.com/products/switches/product-details/Toggle/7000/7101SYZQE/)
was consulted for the product-page facts below, but no local product-page
snapshot was acquired. Those page-only facts are therefore conditional and
are not retained evidence:

| Property | Resolved value |
| --- | --- |
| Circuit | SPDT, one pole and two throws |
| Function | On-None-On (also confirmed by retained datasheet) |
| Termination | Z solder lug (also confirmed by retained datasheet ordering code) |
| Mounting | Rear panel mount with threaded bushing (conditional page-only fact) |
| Bushing | 1/4-40 UNS-2A, 0.350 inch high keyway (conditional page-only/drawing fact) |
| Panel cutout | Circular, 0.250 inch diameter (6.35 mm), conditional page-only fact |
| Actuator | Standard round, 0.420 inch high (10.67 mm), confirmed by retained datasheet |
| CAD availability | Conditional page-only statement: exact part has not been modeled yet |

The current official product page also exposes `On-On` and `Unsealed` fields,
while its terminal specification separately lists epoxy. Those page fields
conflict with the retained datasheet's `On-None-On` function and epoxy seal for
this exact orderable. The page was not retained locally, so these values remain
conditional metadata; the retained datasheet is the authority for the exact
configuration.

The exact orderable construction is `7101|S|Y|Z|Q|E`: switch function 7101,
0.420-inch actuator S, 0.350-inch keyway bushing Y, solder lug Z, silver
contact Q, and epoxy seal E. The omitted bushing finish defaults to nickel on
all bushings; the omitted actuator finish defaults to bright chrome.

The retained official C&K/Littelfuse datasheet is
[`ck-7000toggle-7101syzqe-datasheet.pdf`](evidence/bp-033/ck-7000toggle-7101syzqe-datasheet.pdf).
The retained PDF bytes are revision `CM.10/15/24`, with pages 1-4 reviewed.
The mutable datasheet URL currently exposes revision `CM.05/30/25`; that URL
revision drift is recorded but is not substituted for the retained bytes. The
retained-byte revision remains authoritative. Its SPDT drawing and
function table resolve the reference terminal map:

- terminal `2` is common;
- `POS. 1` connects `2-3` and is `ON`;
- `POS. 2` is `NONE` with no connection;
- `POS. 3` connects `2-1` and is `ON`;
- the top-view terminal order is `1` lower, `2` center, `3` upper;
- the terminal pitch is `.185 inch` (4.70 mm), and the solder-lug width is
  `.080 inch` (2.03 mm); the `.030 inch` (0.76 mm) terminal thickness is also
  captured as source geometry;
- the keyway is shown at 25 degrees, but its width and depth are not
  dimensioned in the retained drawing.

The datasheet explicitly labels the terminal numbers as “for reference only.”
They are therefore a source orientation/connection map, not a claim that the
switch exposes PCB pin numbers or a ready-made land pattern.

`S_SOURCE_SELECTOR` is an explicit project refdes convention. C&K does not
publish a source refdes, and the retained drawing's terminal numbers are not
PCB pin-number authority. The project keeps this warning explicit and denies
primitive and board integration until root review. The isolated artwork keeps
the generic chip wrapper; it does not introduce the tscircuit switch primitive,
whose schematic and simulation behavior would expand this footprint-only slice.

## Review artwork and denied decisions

[`bp033-7101syzqe-project-footprint.tsx`](../src/bp033-7101syzqe-project-footprint.tsx)
renders an isolated review candidate. It contains one conditional 6.35 mm
non-plated panel-cutout hole and source-outline/terminal datums on silkscreen.
The emitted Circuit JSON does not mark these rectangles as dashed; the artwork
does not claim dash segments.
The body and terminal rectangles intentionally emit `pcbX=0` and use only the
source Y datums. This is an explicit visual approximation, not source-accurate
X placement; placement authority remains denied.
terminal lugs are not rendered as copper, plated holes, solder mask, or paste:
the exact Z solder-lug termination has no C&K PCB land pattern or finished drill
specification in the retained source.

The following remain denied and unselected: terminal landings, courtyard,
board placement, board fit, clearance, enclosure/panel fit, actuator travel,
mechanical load path, CAD import, board import, release, and fabrication. No
panel thickness, nut/washer stack, board edge, neighboring component, or
service-access datum is assumed. The panel cutout and CAD-status claims remain
conditional because their product-page source is not locally retained. This
slice is not a board-placement decision and cannot authorize fabrication.
