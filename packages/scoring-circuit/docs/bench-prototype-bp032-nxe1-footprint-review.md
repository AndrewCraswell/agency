# BP-032 Murata NXE1S0505MC footprint candidate review

This bounded BP-032 slice adds one isolated, review-only tscircuit candidate
for the exact Murata Power Solutions `NXE1S0505MC` orderable. It is not
imported by a board, isolation contract, or BP-032 ledger.

| Exact orderable | Package identity | Candidate export | Status |
| --- | --- | --- | --- |
| `NXE1S0505MC` | NXE1 SMD 14-position package | `BenchPrototypeBp032Nxe1Footprint` | accepted false, fabrication deny |

## Retained Murata evidence

The candidate reuses the already retained M4-04 primary artifact:

- Artifact: `packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf`
- Document: `KDC_NXE1.A01`, reviewed page 6 for package and recommended footprint details
- Canonical URL: <https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf>
- SHA-256: `53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40`

The focused test hashes the retained bytes, checks source markers from the
compressed PDF content, and checks the exact-orderable, document, source-page,
and recommended-footprint applicability metadata. The candidate geometry test
then checks the rendered dimensions against those source-backed values. No new
copy of the source PDF is created for this slice.

## Source-backed package and land guidance

Murata page 6 identifies the surface-mount package with nominal mechanical
dimensions of 12.70 mm by 10.41 mm and a maximum height of 4.80 mm. The
all-dimensions tolerance is ±0.25 mm. The package has 14 positions on a 2.54
mm nominal pitch, but only five solder lands:

| Pin | Function | Candidate position (top-view convention) | Role |
| ---: | --- | ---: | --- |
| 1 | `-Vin` | X = -3.81, Y = -4.70 | input negative |
| 3 | `+Vin` | X = -1.27, Y = -4.70 | input positive |
| 7 | `-Vout` | X = +3.81, Y = -4.70 | output negative |
| 8 | `+Vout` | X = +3.81, Y = +4.70 | output positive |
| 14 | `NA` | X = -3.81, Y = +4.70 | no-connect |

The retained drawing's recommended footprint gives five nominal 2.30 mm by
1.00 mm rectangular pads, a 7.62 mm outer-column center span, and a 9.40 mm
row-center span. The source diagram does not number the recommended pads, so
the candidate documents a 180-degree review transform from the page-6
mechanical arrangement: pin 1 is upper-left, pins 1, 3, and 7 are the top row,
and pins 14 and 8 are the bottom row. This is a review mapping, not final
assembly-orientation approval.

The candidate renders the source-dimensioned copper pads and records explicit
project review inputs for the categories Murata does not specify in the
retained drawing:

- solder-mask opening: 1.10 mm by 2.40 mm, 0.05 mm per-edge expansion;
- paste aperture: 0.90 mm by 2.20 mm, 0.05 mm per-edge reduction;
- courtyard: 13.45 mm by 12.20 mm, with 0.25 mm stated project clearance.

These mask, paste, and courtyard values are not Murata guidance. They are
rendered only so the review artifact can be inspected and tested; they do not
grant fabrication authority.

## Open gates and non-claims

- The retained PDF is exact-drawing-hash-bound source evidence, not a CAD
  object. `manufacturerCad.state` is `not-acquired` with disposition
  `not-acquired-no-substitute`; no third-party or generic CAD substitute is
  represented.
- The recommended five-pad pattern is marked
  `manufacturer-recommended-guidance-not-cad`.
- Pin-one mapping is source-backed as a review convention, while final PCB
  assembly orientation remains `pending-layout-review`.
- Package geometry and the five-pad layout do not approve creepage,
  clearance, isolation slots, copper keepouts, routing, contamination limits,
  or safety compliance. Those are separate board and safety reviews.
- Pin 14 remains `NA` and `no-connect`; it is not treated as a fourth power
  connection or as a fabricated functional landing beyond the source-backed
  five-land pattern.
- No BP-032 ledger, isolation contract, board, backlog, or fabrication release
  is changed. The candidate remains `accepted: false` and
  `fabricationAuthority: "deny"`.

Focused verification from this worktree:

```text
pnpm --filter @repo/scoring-circuit test -- bench-prototype-bp032-nxe1-footprint.test.tsx --run
Test Files  1 passed (5)
Tests       5 passed (5)
```
