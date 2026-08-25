# BP-033 `D_VBUS_TVS` TVS2200DRVR review-only footprint

This bounded artifact covers the exact BP-033 VBUS transient suppressor
reference `D_VBUS_TVS`: Texas Instruments orderable `TVS2200DRVR`, package
`DRV WSON-6 2x2 mm`, package drawing `DRV0006A`. The candidate is isolated and
review-only. It does not modify the BP-033 canonical ledger or BOM, instantiate
a board component, approve electrical placement, or authorize layout, release,
fabrication, or assembly.

The canonical BP-033 ledger reference is `D_VBUS_TVS`; the active board-level
reference is `D_USB_PD_VBUS_TVS`. This isolated candidate records that board
reference as an alias for identity reconciliation only. It does not import or
authorize the board component.

## Exact identity and retained primary source

The retained official TI datasheet is:

| Source | Artifact | SHA-256 | Reviewed content |
| --- | --- | --- | --- |
| TI TVS2200 datasheet | `docs/evidence/bp-033/ti-tvs2200-datasheet.pdf` | `E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801` | Pages 1 and 14 bind the exact `TVS2200DRVR` active orderable to WSON (DRV), 6 pins. Page 3 gives the electrical pin map in bottom view. Pages 18-20 give DRV0006A outline, copper land pattern, mask options, optional thermal vias, and the 0.125 mm stencil example. |

The retained PDF is 21 pages. The source URL is
<https://www.ti.com/lit/ds/symlink/tvs2200.pdf>. The focused test hashes the
retained bytes before accepting this record. No distributor page or generic
WSON footprint is used as an identity substitute.

## Package and pin mapping

TI lists a nominal 2 mm by 2 mm DRV WSON package with 0.8 mm maximum height.
The exposed thermal pad is pad 7 and is GND. Pads 1-3 are GND and pads 4-6
are the protected `IN` channel. The source-controlled pin map is:

| Pin | Name | Function | Review land position in TI board top view (mm) |
| ---: | --- | --- | ---: |
| 1 | GND | ground | `(-0.975, 0.65)` |
| 2 | GND | ground | `(-0.975, 0.00)` |
| 3 | GND | ground | `(-0.975, -0.65)` |
| 4 | IN | ESD and surge protected channel | `(0.975, -0.65)` |
| 5 | IN | ESD and surge protected channel | `(0.975, 0.00)` |
| 6 | IN | ESD and surge protected channel | `(0.975, 0.65)` |
| 7 | GND | exposed thermal pad | `(0.00, 0.00)` |

The six perimeter lands are 0.45 mm by 0.30 mm with 0.65 mm row pitch and
1.95 mm row-center spacing, or 0.975 mm absolute row-center X when centered.
The exposed pad is 1.00 mm by 1.60 mm. TI's
page-3 functional drawing is explicitly a bottom view: its pin 1 appears at
the bottom-left and its right row reads 4, 5, 6 top-to-bottom. The page-19
board land-pattern view is the mirrored top view used by the review artifact:
pin 1 is upper-left, pins 1-3 run down the left row, and pins 4-6 run up the
right row. The renderer uses zero nominal board rotation and records that
orientation as pending independent review.

## Manufacturer land, mask, thermal, and paste guidance

The candidate retains the TI guidance as evidence, not release instructions:

- TI's DRV0006A page-19 board layout shows 0.05 mm typical copper corner
  radius, the dimensions above, and two optional 0.2 mm thermal vias at
  `(0, -0.55)` and `(0, 0.55)` mm. Via use depends on the application.
- The evidence object retains those two source-coordinate vias as optional
  metadata with 0.20 mm drill guidance. The review renderer intentionally emits
  no `pcb_plated_hole` or `pcb_hole` records: no annular ring or fabricator rule
  has been selected, and a zero-annulus representation is prohibited. The
  thermal layout gate remains denied.
- The source copper corner radius is retained as `R0.05 TYP`. Because the
  review renderer only emits rectangular tscircuit pads, its rectangles are an
  explicit bounded approximation of that source radius, not an exact rounded
  copper release.
- TI shows non-solder-mask-defined metal as preferred, with a maximum 0.07 mm
  opening expansion all around. Solder-mask-defined metal is an alternative,
  with a minimum 0.07 mm overlap all around. The isolated renderer displays
  the preferred 0.07 mm NSMD value as review geometry; it is not a selected
  fabricator rule.
- TI's page-20 example is based on a 0.125 mm stencil and splits exposed pad 7
  into two 1.00 mm by 0.70 mm apertures centered at `Y = ±0.45 mm`. The
  resulting geometric area is 87.5 percent, stated by TI as 88 percent
  printed coverage. The tscircuit
  preview uses one symmetric area-equivalent aperture measuring
  `0.9239281024635393 x 1.5239281024635393 mm`, with an exact
  `0.038035948768230354 mm` per-edge margin and 88 percent area coverage so
  the source area can be measured in the render; that is not a released
  stencil or an acceptance of the source segmentation.
- TI publishes no courtyard. The 2.6 mm square in the artifact is an explicit
  project DRC review envelope with 0.3 mm clearance around the nominal body,
  not manufacturer CAD.

The source-controlled renderer is
`src/bp033-tvs2200-project-footprint.tsx`. Its rendered copper and courtyard
geometry is hash-bound in the focused test as:

`949e1e7985bcc8011cd08791432306987193015e3792a836b4f454100ba95476`

The hash covers the seven rendered rectangular copper pads, all generated paste
geometry including the exact exposed-pad margin, solder-mask margins, and
review courtyard. It deliberately contains no drilled or plated-hole geometry;
it does not turn the renderer into a board-library release.

## CAD disposition and gates

No official TI ECAD, STEP, or 3D CAD artifact was acquired or retained for this
slice. `manufacturerCad.state` is `not-acquired`, its artifact is `null`, and
its authority is `deny`. The PDF-derived candidate is not a CAD import.

The following gates remain denied and must not be inferred from the evidence:

- electrical placement relative to the USB-C VBUS path, controller pin, and
  surge-return loop;
- exposed-pad thermal and via layout, copper spreading, and current/thermal
  behavior;
- independent pin-one orientation review and board fit or courtyard review;
- board import, DRC, assembly-process qualification, release, and fabrication
  authorization.

The executable acceptance object keeps `electricalPlacementAccepted`,
`thermalLayoutAccepted`, `boardFitAccepted`, and `fabricationAuthorized` false,
with `releaseState` set to `deny`. This artifact is evidence for a future
review, not approval of `D_VBUS_TVS`.
