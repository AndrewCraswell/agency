# BP-031 TI REF5025AQDRQ1 D SOIC-8 candidate footprint

This is a bounded, review-only candidate footprint for the exact Texas
Instruments orderable `REF5025AQDRQ1`. TI identifies the orderable as SOIC
package `D`, 8 pins, in the [REF5025A-Q1 part details](https://www.ti.com/product/REF5025A-Q1/part-details/REF5025AQDRQ1).
This artifact does not integrate a board, approve a schematic, release a PCB,
or authorize fabrication.

The executable record is
[`bp031-ref5025aqdrq1-d-soic8-candidate-footprint.tsx`](../src/bp031-ref5025aqdrq1-d-soic8-candidate-footprint.tsx),
and its focused contract is
[`bp031-ref5025aqdrq1-d-soic8-candidate-footprint.test.tsx`](../src/bp031-ref5025aqdrq1-d-soic8-candidate-footprint.test.tsx).

## Retained TI evidence

| Source | Scope used | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| [REF50xxA-Q1 datasheet, Rev. H](https://www.ti.com/lit/ds/symlink/ref5025a-q1.pdf) | Exact `REF5025AQDRQ1` orderable identity, D SOIC-8 package designation, and datasheet top-view pin map | `packages/scoring-circuit/docs/evidence/bp-031/ti-ref50xxa-q1-ref5025aqdrq1-datasheet-rev-h.pdf` | `908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B` |
| [TI D0008A package outline, MSOI002K](https://www.ti.com/lit/pdf/MSOI002K) | D SOIC-8 body and lead dimensions, example exposed-metal land, solder-mask examples, and stencil example | `packages/scoring-circuit/docs/evidence/bp-031/ti-d0008a-soic8-package-outline-rev-k.pdf` | `E064777954A2161CFB76C801A7F699EEC23A9FB4434ACF27A9DC37E57FF39655` |

The package-outline PDF identifies the embedded drawing as `D0008A`,
`4214825/C`, dated 02/2019. The retained URL is TI's current
`MSOI002K` document. The test hashes both local artifacts at runtime and
requires the hashes above.

## Exact package and orientation

The retained D0008A drawing gives the following package limits:

- body width: 3.81 to 3.98 mm;
- body length: 4.81 to 5.00 mm;
- overall lead span: 5.80 to 6.19 mm;
- maximum package height: 1.75 mm;
- lead pitch: 1.27 mm;
- lead width: 0.31 to 0.51 mm;
- lead length: 0.41 to 1.27 mm.

The TI datasheet and D0008A top views both identify pin 1 at the upper-left.
Pins 1 through 4 run top-to-bottom on the left edge; pins 5 through 8 run
bottom-to-top on the right edge. The project candidate uses zero rotation and
retains the datasheet functions: `1 DNC`, `2 VIN`, `3 TEMP`, `4 GND`, `5
TRIM/NR`, `6 VOUT`, `7 NC`, and `8 DNC`.

## Copper, mask, paste, and courtyard derivation

The D0008A example board layout publishes eight exposed-metal rectangles,
each 1.55 mm in the lead direction by 0.60 mm across the pitch direction,
with a 5.40 mm row-center span and 1.27 mm pitch. The candidate renders those
dimensions directly, with the TI example's 0.05 mm corner-radius note retained
as metadata.

The candidate selects TI's non-solder-mask-defined example. The drawing shows a
0.07 mm maximum mask opening expansion all around, so the review record derives
1.69 mm by 0.74 mm openings from the 1.55 mm by 0.60 mm copper. TI also shows a
solder-mask-defined alternative with 0.07 mm minimum coverage; that alternative
is recorded as a source option but is not silently mixed into this candidate.

The D0008A stencil example is based on a 0.125 mm stencil and shows 1.55 mm by
0.60 mm apertures. The rendered paste therefore has zero edge reduction and is
explicitly labelled as a TI example, not a universal assembly rule. TI notes
that an assembly site may use a different stencil recommendation.

TI does not publish a courtyard in the retained documents. The rendered pad
envelope alone would produce a 7.45 mm by 4.91 mm envelope with the stated
0.25 mm clearance. The larger 5.00 mm maximum package body length governs the
vertical dimension, so the review record derives a final 7.45 mm by 5.50 mm
project courtyard from the maximum package and pad envelopes plus that
clearance. `sourceStatus` remains `not-published` so this deterministic
envelope cannot be mistaken for TI CAD.

## CAD and release disposition

TI's product page lists Ultra Librarian as a CAD provider for the D package,
but no TI-native or partner CAD object is retained in this slice. The source
record sets CAD state to `not-acquired`, keeps the retained path and hash null,
and uses `not-acquired-no-substitute`; no CAD, courtyard, mask, paste, or
silkscreen geometry is invented from a partner link.

The candidate remains `accepted: false`, `fabricationAuthority: "deny"`, and
`orientationStatus: "pending-independent-review"`. The validator rejects
identity, source, geometry, courtyard, CAD, or release-state drift before any
future consumer could treat this review artifact as a fabrication release.
