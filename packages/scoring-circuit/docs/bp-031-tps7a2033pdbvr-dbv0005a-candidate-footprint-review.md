# BP-031 TI TPS7A2033PDBVR DBV0005A SOT-23-5 candidate footprint

This is a bounded, review-only candidate footprint for the exact Texas
Instruments orderable `TPS7A2033PDBVR`. TI identifies the orderable as the
five-pin SOT-23 package option `DBV` in the [TPS7A20 product part
details](https://www.ti.com/product/TPS7A2033/part-details/TPS7A2033PDBVR).
This artifact does not integrate a board, approve a schematic, release a PCB,
or authorize fabrication.

The candidate is bound to the one active upstream reference `U_3V3` from the
BP-100 selection contract. It is not a substitute for the canonical BOM or
topology source, and no repeated-reference family is asserted for this single
regulator.

The executable record is
[`bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint.tsx`](../src/bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint.tsx),
and its focused contract is
[`bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint.test.tsx`](../src/bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint.test.tsx).

## Retained TI evidence

| Source | Scope used | PDF pages reviewed | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| [TPS7A20 datasheet, Rev. H](https://www.ti.com/lit/ds/symlink/tps7a20.pdf) | Exact `TPS7A2033PDBVR` orderable identity, DBV SOT-23-5 pin map, DBV0005A package drawing, land, mask, and stencil examples | 4, 45, 60-62 | `packages/scoring-circuit/docs/evidence/m4-04/ti-tps7a20-dbvr-datasheet.pdf` | `6EBFF717770572C7E301A5C16345F50A558EF379A727984ED0F3A6B1DCD400D1` |

The retained M4-04 PDF is used as official TI evidence. PDF page 45 is the
`PACKAGE OPTION ADDENDUM` row for the active `TPS7A2033PDBVR` orderable and
records `SOT-23 (DBV) | 5`. PDF page 4 is the DBV top-view pin map. PDF pages
60-62 contain the DBV0005A package outline, example board layout and mask
detail, and example stencil design. The package drawing identifies the
embedded mechanical drawing as `DBV0005A`, `4214839/K`, dated 08/2024. The
source hash and page/addendum binding are checked by the focused test.

## Upstream exact-reference binding

The candidate records integration HEAD
`a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c` and hashes each upstream source
file. The focused test reads those files and fails if any exact-reference
selection drifts.

| Upstream source | SHA-256 |
| --- | --- |
| `packages/scoring-circuit/src/one-channel-analog-readiness.ts` | `496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d` |
| `packages/scoring-circuit/src/one-channel-analog-experiment.ts` | `f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b` |
| `packages/scoring-circuit/src/bench-prototype-analog-topology.ts` | `1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d` |

The canonical source path and reference are
`one-channel-analog-readiness.ts` and `U_3V3`; the exact row is
`Texas Instruments`, `TPS7A2033PDBVR`, `DBV SOT-23-5`.

## Exact package and orientation

The retained DBV0005A drawing gives the following package limits:

- body width: 1.45 to 1.75 mm;
- body length: 2.75 to 3.05 mm;
- overall lead span: 2.60 to 3.00 mm;
- maximum package height: 1.45 mm;
- lead pitch: 0.95 mm;
- lead width: 0.30 to 0.50 mm;
- lead length: 0.30 to 0.60 mm;
- package standard: JEDEC MO-178.

The TI top view identifies pin 1 at the upper-left. Pins 1 through 3 run
top-to-bottom on the left edge; pins 4 and 5 run bottom-to-top on the right
edge. The exact datasheet functions are `1 IN`, `2 GND`, `3 EN`, `4 N/C`, and
`5 OUT`. The project candidate uses zero rotation with pin 1 at
`(-1.30, +0.95)` mm.

## Copper, mask, paste, and courtyard derivation

The DBV0005A example board layout publishes five rectangular exposed-metal
pads, each 1.10 mm in the lead direction by 0.60 mm across the pitch
direction, with a 2.60 mm row-center span and 0.95 mm pitch. The candidate
retains TI's 0.05 mm rounded-corner note as metadata while rendering the
review pads as rectangular SMT pads.

The candidate selects TI's non-solder-mask-defined example. The drawing shows
a 0.07 mm maximum mask opening expansion all around, so the review record
derives 1.24 mm by 0.74 mm openings from the 1.10 mm by 0.60 mm copper. The
DBV0005A stencil example uses 0.125 mm stencil thickness and equal 1.10 mm by
0.60 mm apertures. Paste is therefore recorded with zero edge reduction as a
TI example, not as a universal assembly rule.

TI does not publish a courtyard in the retained drawing. The pad envelope
alone with 0.25 mm clearance is 4.20 mm by 3.00 mm. The larger 3.05 mm
maximum package body length governs the vertical dimension, so the final
project review courtyard is 4.20 mm by 3.55 mm from the maximum package and
pad envelopes plus that clearance. `sourceStatus` remains `not-published` so
this deterministic envelope cannot be mistaken for TI CAD. The mask opening,
paste aperture, and courtyard are project review inputs even though the
selected copper and stencil values are copied from the TI examples.

## Rendered geometry and release state

The focused test renders the isolated tscircuit footprint and hashes the
canonical pad, solder-paste, and courtyard soup geometry. The digest is
`56DB31584BE77A1468001067C9DA285B52D15040790FABBC4FE70E0DBCBCBCD7`, generated
with tscircuit `0.0.2271`. This is generated project review artwork, not
manufacturer CAD, and its authority remains `deny`.

## CAD and release disposition

The retained official PDF supplies the source drawing but no native CAD
object. No partner CAD artifact is represented as TI CAD in this slice. The
source record sets CAD state to `not-acquired`, keeps the retained path and
hash null, and uses `not-acquired-no-substitute`.

The candidate remains `accepted: false`, `releaseState: "deny"`,
`fabricationAuthority: "deny"`, and
`orientationStatus: "pending-independent-review"`. The validator rejects
identity, source, upstream reference, geometry, artwork digest, courtyard,
CAD, or release-state drift before any future consumer could treat this review
artifact as a fabrication release.
