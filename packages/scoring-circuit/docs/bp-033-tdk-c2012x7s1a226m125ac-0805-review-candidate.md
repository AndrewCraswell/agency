# BP-033 TDK C2012X7S1A226M125AC 0805 review candidate

## Scope

This review-only candidate covers exactly these canonical references, without
changing them or their board mapping:

- `C_DISPLAY_IN`
- `C_DISPLAY_OUT`
- `C_APP_REG_OUT_A`
- `C_APP_REG_OUT_B`
- `C_APP_REG_OUT_C`

The candidate carries an explicit root-integration handoff for
`packages/scoring-circuit/src/bench-prototype-application-footprints.ts`: root
must enforce exactly those five rows with manufacturer TDK, MPN
`C2012X7S1A226M125AC`, and package 0805. The mutable canonical ledger is not
hashed and this candidate does not authorize changing it.

The stable selection contracts remain hash-bound: BP-050
`bench-prototype-power.ts` SHA-256
`9771B1F071ABC5E16614E6B989D5C7A9FEAD8A7DCE7FD444D8D3B3D60A22DDA5`
covers the two display rows, and BP-142 `bench-prototype-application-rail.ts`
SHA-256 `ED4BFC8B752BE974323BF7ED95B1B5718C1C2F1D903B6444E652245326F35E67`
covers the three application-regulator output rows. This slice does not modify
the application ledger, convergence records, backlog, board, or any placement.

## Retained manufacturer evidence

The retained official TDK Product Center capture is
[`tdk-c2012x7s1a226m125ac-product-page-capture.md`](evidence/bp-033/tdk-c2012x7s1a226m125ac-product-page-capture.md),
SHA-256 `60F2B7B008453D3BE7F5501C7904E54911D422BB068EC8296DA876D47D4A511E`.
Its source URL is <https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7S1A226M125AC>.

The source identifies the exact orderable part as C2012 [EIA 0805], 22 uF
plus or minus 20%, 10 VDC, X7S, -55 to 125 C, with 2.00 mm plus or minus
0.20 mm by 1.25 mm plus or minus 0.20 mm by 1.25 mm plus or minus 0.20 mm
body dimensions. These are part characteristics, not a released project land
pattern.

## Family guidance versus project review input

The exact-MPN page also publishes reflow “Recommended Land Pattern” ranges:
PA 0.90 to 1.20 mm, PB 0.70 to 0.90 mm, and PC 0.90 to 1.20 mm. The page
labels that material as recommended land pattern and does not retain a
manufacturer CAD model, finished footprint, stencil, mask, courtyard, or
placement orientation for this review.

The isolated candidate therefore treats the PA/PB/PC mapping and midpoint
choice as project review inputs only: PA 1.05 mm pad length, PB 0.80 mm inner
gap, PC 1.05 mm pad width, two pads at X = plus or minus 0.925 mm, 0.05 mm
per-edge project mask margin, 0.05 mm per-edge project paste reduction, and a
3.40 mm by 1.75 mm project-review courtyard. No TDK CAD authority is asserted.

The capacitor is non-polar, so pin one and an electrically mandatory rotation
do not apply. That does not authorize a board placement: flex-stress direction,
clearance, and assembly orientation remain independent review inputs.

## Denied gates and root handoff

The candidate has a private, independent frozen baseline and a descriptor-safe
validator. It rejects changed values, keys, property flags, hidden fields,
symbols, prototype changes, and accessor properties without reading supplied
getters. Its focused tests include adversarial cases for each category.

`manufacturerCad`, project-CAD import, board placement, geometry acceptance,
orientation acceptance, fabrication, and release are all explicitly denied;
`accepted` remains false. The generated two-pad artwork is isolated review
input, not a board or fabrication artifact.

Root review must decide whether to map this record into the application ledger
and any later CAD, placement, acceptance, fabrication, or release workflow.
Those actions are deliberately outside this candidate.
