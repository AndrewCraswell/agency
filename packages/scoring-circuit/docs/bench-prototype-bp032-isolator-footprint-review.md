# BP-032 TI isolator footprint candidate review

This bounded BP-032 evidence slice contains two isolated, review-only
tscircuit candidates:

| Exact orderable | TI package | Candidate export | Status |
| --- | --- | --- | --- |
| `ISO7762FDWR` | `DW (SOIC-16 wide)` | `BenchPrototypeBp032Iso7762Footprint` | accepted false, fabrication deny |
| `ISO7721FDR` | `D (SOIC-8)` | `BenchPrototypeBp032Iso7721Footprint` | accepted false, fabrication deny |

The implementation is in
`src/bench-prototype-bp032-isolator-footprints.tsx` and is intentionally not
imported by a board, isolation contract, or BP-032 ledger. The focused test
renders each candidate and checks the actual Circuit JSON pads, solder paste,
solder-mask margin, pin pitch, pin-one mapping, and courtyard.

## Retained TI evidence

The exact manufacturer URLs, retained bytes, and SHA-256 digests are bound in
the source and checked by the focused test.

| Exact part | Retained artifact | TI document | Reviewed pages | SHA-256 |
| --- | --- | --- | --- | --- |
| `ISO7762FDWR` | `docs/evidence/bp-032/ti-iso7762.pdf` | `SLLSER1H`, `https://www.ti.com/lit/ds/symlink/iso7762.pdf` | 1, 4, 38, 42, 44, 45, 46, 47, 48 | `FC874E117FFEFC489C82677A76580002A55C9DFD0BEC7C800AF8300DBBF8FF22` |
| `ISO7721FDR` | `docs/evidence/bp-032/ti-iso7721.pdf` | `SLLSEP3G`, `https://www.ti.com/lit/ds/symlink/iso7721.pdf` | 1, 5, 34, 35, 36, 37, 38, 41, 43 | `FB039C00CEB601B93618004839B2108D3358777A019F2526BCA427B7F6C0649C` |

The reviewed-page binding now records the purpose of each required citation:

| Exact part | Exact-orderable purpose | Package/body evidence | Pin-one/source view |
| --- | --- | --- | --- |
| `ISO7721FDR` | Active SOIC(D)-8 exact orderable on page 37, repeated on pages 38, 41, and 43 | Package evidence pages 34-37; HV/isolation example page 35 | Figure 5-4, D/DWV 8-pin top view, page 5 |
| `ISO7762FDWR` | Exact orderable on page 38, repeated on pages 42 and 44 | Package and land/stencil evidence pages 45-48; HV/isolation example page 47 | Source pin-one view page 4 |

The source applicability object and validator require these exact-orderable,
package, and pin-one pages to be included in the retained-page list and tied
to the matching MPN, artifact, document, and digest. These retained PDFs are
primary evidence, not CAD archives.

## Derived project geometry

All dimensions are millimeters. The local top-view convention places TI pin 1
at the upper-left: the left row numbers increase top-to-bottom, and the right
row numbers increase bottom-to-top. In the rendered candidate, the left row is
at negative X and the top row is at negative Y.

| Field | `ISO7762FDWR`, DW-16 HV/isolation example | `ISO7721FDR`, D-8 HV/isolation example |
| --- | ---: | ---: |
| Nominal body length × width | 10.30 × 7.50 | 4.90 × 3.91 |
| Maximum body length × width | 10.50 × 7.60 | 5.00 × 3.98 |
| Maximum body height | 2.65 | 1.75 |
| Pin count and pitch | 16, 1.27 | 8, 1.27 |
| TI HV/isolation row-center span | 9.75 | 5.50 |
| Project copper pad length × width | 1.65 × 0.60 | 1.40 × 0.60 |
| Rendered pad row centers | X = ±4.875 | X = ±2.750 |
| Pin-sequence center span | 8.89 | 3.81 |
| Copper outer span, X × Y | 11.40 × 9.49 | 6.90 × 4.41 |
| Solder-mask definition | SMD, 0.07 inset per edge | SMD, 0.07 inset per edge |
| Rendered mask opening length × width | 1.51 × 0.46 | 1.26 × 0.46 |
| TI stencil thickness | 0.125 | 0.127 |
| Rendered paste aperture length × width | 1.65 × 0.60 | 1.40 × 0.60 |
| Project courtyard length × height | 11.90 × 9.99 | 7.40 × 4.91 |

The project courtyard is an explicit review overlay, not a TI claim. Its
minimum clearance input is 0.25 around the greater of the rendered copper
outer span and the package body envelope. `solderPasteMargin="0mm"` is used so
the rendered paste artifacts match the cited TI stencil examples; the
assembly site may choose a different stencil design.

## Open gates and non-claims

- `manufacturerCad.state` is `not-acquired` with disposition
  `not-acquired-no-substitute`. No CAD, library export, or third-party
  substitute is represented.
- The HV/isolation land patterns are marked
  `manufacturer-example-not-cad`. The rendered copper, mask, paste, and
  courtyard are project review inputs only.
- Pin-one mapping is source-backed, but assembly orientation remains
  `pending-layout-review`.
- Package geometry is not a creepage or clearance approval. The TI diagrams'
  clearance/creepage captions are not converted into a board isolation rule;
  board corridor, routing, layer, slot, contamination, and safety review are
  outside this slice.
- No candidate changes the existing BP-032 ledger, isolation contract, board
  placement, or fabrication release. Both candidates remain `accepted: false`
  and `fabricationAuthority: "deny"`.

Focused verification from this worktree:

```text
pnpm --filter @repo/scoring-circuit test -- bench-prototype-bp032-isolator-footprints.test.tsx --run
Test Files  1 passed (1)
Tests       5 passed (5)
```
