# BP-031 Panasonic ERA3AEB2491V project-footprint review

This is a bounded, review-only footprint candidate for exactly
`R_SOURCE_1` through `R_SOURCE_7`. It is not imported into a board model and
does not authorize schematic integration, fabrication, or release.

## Exact identity and retained sources

The selected orderable is Panasonic Industry `ERA3AEB2491V`, the exact
`ERA3A / 1608 (0603)` resistor used by the canonical `R_SOURCE` row. The
retained exact-product HTML capture is
`packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-product.html`
with SHA-256
`BB9C4A4BE74D7F700378C41A63089E158FFE929FA6EA3943427C27AD89BC6048`.
It records 2.49 kilohm, 0.1 percent, 0.1 W, 25 ppm/K, and the 0603 /
1.6 x 0.8 mm package identity.

The retained Panasonic ERAA package PDF is
`packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf`,
document `AOA0000C309`, SHA-256
`FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79`.
Pages 2 and 3 bind the ERA3A family and body/terminal drawing. The retained
Panasonic land-pattern PDF is
`packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf`,
document `DMM0000COL20`, SHA-256
`65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D`.
Page 1 supplies the high-precision ERA 1608 row: `a` = 0.7 to 0.9 mm,
`b` = 2.0 to 2.2 mm, and `c` = 0.8 to 1.0 mm. These PDFs are manufacturer
source evidence and guidance, not exact-orderable ECAD or released artwork.

The candidate freezes the canonical source bindings at basis commit
`c6a0723a719551c1632ff2eff5b528409b4cac57`, including the retained hashes
for `one-channel-analog-readiness.ts`, `bench-prototype-seven-channel-analog.ts`,
and `m4-04-single-channel-coupon.ts`. The validator treats these as immutable
provenance claims; it does not silently hash mutable live files at runtime.

## Review geometry and orientation

The project selects the midpoint values `a` = 0.8 mm, `b` = 2.1 mm, and
`c` = 0.9 mm. The derived pad gap is `b - 2a` = 0.5 mm and pad centers are
at x = -0.65 mm and +0.65 mm. Project-only mask, paste, and courtyard inputs
are respectively 0.05 mm expansion per edge, 0.05 mm reduction per edge,
and a 2.4 mm by 1.3 mm review courtyard.

The two terminals are explicitly non-polar. `A` and `B` are arbitrary review
endpoints; pin one is not applicable and 180-degree rotation is electrically
equivalent. Assembly marking direction and independent placement review remain
open. No polarity or pin-one claim is made by the rendered overlay.

The tscircuit render is hash-bound as canonical review geometry only. The
current digest is
`06D522D5384717F820A4BEF38F828012E0735506126039442373BA74CEC9B967`.

## CAD and deny gates

The retained Panasonic CAD-status capture is
`packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-cad.html`
with SHA-256
`ADA48ECB98E85E4C346D9365C1C6BC7FED81504131E1B761854AD664D960A93D`.
It states that CAD data is unavailable for the exact product and exposes only
third-party links. Therefore `manufacturerCad` is `not-acquired` with
`not-published` availability, the retained status capture is provenance only,
and authority is `deny`. No third-party CAD substitute is imported.

The executable evidence and its validator keep all of these gates explicit:

- manufacturer CAD imported: false
- independent orientation accepted: false
- project artwork accepted: false
- fabrication authorized: false
- project-footprint acceptance: false
- release state: `deny`
- fabrication authority: `deny`

The exported graph is deeply frozen. Validation clones through own data
descriptors, rejects getters, hidden or symbol properties, prototypes, cycles,
and aliases without invoking getters, and compares against an independent
frozen baseline. Focused tests mutate identity, all seven-reference scope,
source hash and page, package, geometry, orientation, CAD provenance, artwork,
and every deny gate to prove fail-closed behavior.

Open work includes exact-orderable manufacturer CAD (if Panasonic publishes
it), independent assembly orientation, board-fit and courtyard review, and
fabricator/process acceptance. This artifact makes no closure, ledger,
backlog, stage, approval, or fabrication change.
