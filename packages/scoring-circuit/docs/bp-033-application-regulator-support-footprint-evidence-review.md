# BP-033 application-regulator support footprint evidence review

## Scope and outcome

This candidate covers only the five populated BP-033 application-regulator
support references below. Every listed exact orderable has primary-manufacturer
proof. The evidence establishes identity and bounded package or land-pattern
facts for review; it does not approve CAD, board placement, physical isolation,
assembly, fabrication, or release.

| Reference | Exact MPN | Primary evidence | Reviewed page(s) | Package or geometry boundary |
| --- | --- | --- | --- | --- |
| U_APP_REGULATOR | LMR43620MSC3RPERQ1 | TI LMR43620-Q1 datasheet | PDF 50, 54-56 | Exact 9-pin RPE orderable and RPE0009A outline, land, mask, and stencil drawings. Compound copper is not simplified or emitted as a project footprint. |
| L_APP_REGULATOR | XGL4030-222MEC | Coilcraft XGL4030 datasheet | PDF 1, 4 | The order code maps the `XGL4030-222ME_` row to E tin-silver termination plus C reel. Page 4 gives 0.98 x 3.40 mm pads and 2.37 mm inner gap. |
| C_APP_REG_IN | C2012X7R1E475K125AB | TDK Product Center exact page | HTML capture | Exact MPN, 0805 envelope, 4.7 uF, 25 VDC, X7R and PA/PB/PC reflow ranges. TDK does not label those axes as a finished CAD pad mapping. |
| C_APP_REG_VCC | 885012206052 | Würth exact-order-code datasheet | PDF 1 | Exact 0603 1 uF, 16 V X7R order code and reflow land pattern: 2.3 mm overall, 0.7 mm gap, 0.8 mm pad width. |
| R_APP_REG_DISCHARGE | RC0603FR-071KL | Yageo exact product specification | PDF 1 | Exact 1 kOhm, 1 percent, 0603 / 1608 orderable and package dimensions. No manufacturer land pattern is published. |

The retained source hashes are immutable candidate bindings:

| Artifact | SHA-256 |
| --- | --- |
| `docs/evidence/bp-033/ti-lmr43620-q1-datasheet.pdf` | `DB767B9234F756C358C8254E682B917F16381EB0DB649A2936833E15EB8037FD` |
| `docs/evidence/bp-033/coilcraft-xgl4030-datasheet.pdf` | `34BB1C739914FC2114653D5B3D5893E90501129D5C2AF8A152E546B8068B72E5` |
| `docs/evidence/bp-033/tdk-c2012x7r1e475k125ab-product-page-capture.md` | `BFCA5B5FA3A61383D54E9DF3AC784B571747A28D3E8ADA7410DE2391C3A40A93` |
| `docs/evidence/bp-033/wurth-885012206052-datasheet.pdf` | `459D7762A62A7A4BF66BDA7F96D4306A1EFFCCA85C8BB68F7B8444D5BBAFEA0F` |
| `docs/evidence/bp-033/yageo-rc0603fr-071kl-datasheet.pdf` | `81CC922D526F75AC7B479167DC5BC3B6A46618F09A7F8BEB2C5E309767E596CB` |

## Geometry and orientation boundary

The source keeps package facts separate from `projectReviewGeometry`.

- The TI RPE layout is a published compound-copper, mask, and stencil example.
  It remains drawing-trace-only until a single locked CAD import and independent
  board review exist. Pin 1 is the lower-left top-view index; pin 9 is central
  ground.
- Coilcraft's short-lead marked side is assigned to the switch node in the
  review coordinate convention. The part is electrically symmetric, but that
  EMI direction is not optional in the eventual board review.
- TDK's exact page supplies PA, PB, and PC ranges but not a CAD-axis mapping.
  It deliberately produces no pad coordinates.
- Würth's two pads are source-derived review coordinates only. Mask, paste, and
  courtyard remain unpublished.
- The Yageo resistor uses 0.9 mm square-pad and 0.5 mm-gap project inputs only;
  neither is misrepresented as a Yageo recommendation.

## Fail-closed controls

The exported evidence graph and the private baseline are independently built,
then separately frozen. The validator requires exact prototypes, own property
sets, data descriptors including enumerable/configurable/writable flags, and
non-aliased acyclic topology. It rejects null-prototype substitution, accessors,
symbols, descriptor drift, aliases, cycles, and reflection-trapping proxies.
No JavaScript reflection routine can generally identify a fully transparent
proxy, so the control is intentionally limited to fail-closed trapped proxy
access rather than an unsupported claim of universal proxy detection.

All gates remain denied: manufacturer CAD is not acquired; board placement,
clearance, switching-loop and thermal performance, and assembly process are not
reviewed; fabrication and release are deny; `accepted` is false.

## Remaining work before a physical decision

Import and lock the TI compound RPE CAD geometry; map the TDK PA/PB/PC axes into
the selected CAD system; establish paste, mask, and courtyard policies where
the manufacturers do not publish them; then perform placement, clearance,
switching-loop, thermal, and assembly review on the actual board. Those are
deliberately separate from exact-orderable proof.
