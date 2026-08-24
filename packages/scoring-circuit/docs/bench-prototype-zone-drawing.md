# BP-010 dimensioned provisional zone drawing

[`bench-prototype-zone-drawing.svg`](bench-prototype-zone-drawing.svg) is the
reviewable one-board zoning aid for the bench prototype. Its sole coordinate
source is [`src/bench-prototype-contract.ts`](../src/bench-prototype-contract.ts),
`benchPrototypeContract.planningDrawing`.

The SVG uses the contract's lower-left planning datum in millimetres. Its
rendered coordinate conversion is `svgX = 160 + 3*x` and `svgY = 660 - 3*y`;
the conversion only makes the planning values visible and creates no physical
board geometry. Zone rectangles and connector markers retain the corresponding
source values as `data-*` attributes, which the focused test compares to the
executable contract.

The drawing reserves a 300 × 160 mm accessible planning envelope, the seven
named zones, the full-height 145–165 mm isolation corridor, and all eight
connector-edge coordinates. It is intentionally not a fabrication outline,
component-placement release, clearance rule, enclosure drawing, mounting-hole
plan, or ordering approval. `releaseState: deny` remains unchanged, and no
DENY or fabrication gate is relaxed by this artifact.
