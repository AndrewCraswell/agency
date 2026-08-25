# BP-031 TPS60400DBVR DBV0005A candidate-footprint review

## Decision

This is a bounded BP-031 review-only candidate for the exact Texas Instruments
`TPS60400DBVR` orderable in the `DBV0005A (SOT-23-5)` package. It is not an
accepted footprint, has no fabrication authority, and must not be treated as a
generic SOT-23 library footprint.

The implementation is isolated in
[`bp031-ti-tps60400dbvr-dbv-footprint-candidate.tsx`](../src/bp031-ti-tps60400dbvr-dbv-footprint-candidate.tsx)
with a focused render, source-hash, and drift test in the matching `.test.tsx`
file. No board, ledger, backlog, or approval record is changed by this slice.

## Exact identity and source binding

| Field | Bound value |
| --- | --- |
| Work unit | `BP-031` |
| Manufacturer | Texas Instruments |
| Exact MPN | `TPS60400DBVR` |
| Package | `DBV0005A (SOT-23-5)` |
| Package drawing | `DBV0005A` |
| Package standard named by TI | `JEDEC MO-178` |
| Canonical physical reference | `U_NEGATIVE_RAIL` |
| Replicated reference family | `U_NEGATIVE_RAIL_` |
| Source contract | `BP-100` |
| Canonical source | `packages/scoring-circuit/src/one-channel-analog-readiness.ts` |
| Pin-map source | `packages/scoring-circuit/src/one-channel-analog-experiment.ts`, `physicalPinMaps.tps60400Dbv` |
| Canonical source SHA-256 | `496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d` |
| Pin-map source SHA-256 | `f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b` |
| Integration basis | `a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c` |

The canonical readiness source binds `U_NEGATIVE_RAIL` to Texas Instruments
`TPS60400DBVR`, `DBV SOT-23-5`, and the official datasheet URL. The experiment
source independently binds `physicalPinMaps.tps60400Dbv` to the exact pin map:

| Pin | TI function |
| ---: | --- |
| 1 | `OUT` |
| 2 | `IN` |
| 3 | `CFLY-` |
| 4 | `GND` |
| 5 | `CFLY+` |

The candidate records both upstream file hashes and integration HEAD
`a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c`. The validator fails closed if the
identity, exact source references, source paths, source hashes, addendum
orderable/page, or pin map drift.

## Retained official TI evidence

The source is the existing M4-04 retained TI PDF. It is reused by path and
verified by bytes; no duplicate evidence file is added for this slice.

| Field | Bound value |
| --- | --- |
| Document | `SLVS324C`, Rev. C, revised October 2020 |
| Official URL | <https://www.ti.com/lit/ds/symlink/tps60400.pdf> |
| Retained artifact | `packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf` |
| Retained artifact SHA-256 | `B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347` |
| Retained artifact size | 1,405,440 bytes |
| Reviewed pages | `3, 23, 30-32` |

Page 3 provides the DBV device table, including `TPS60400DBV` and TI's note
that the `R` suffix orders 3,000-piece reels. The exact orderable is bound
again on PDF page 23, `Addendum-Page 1`, dated 9-Jan-2026:

| Addendum field | Bound value |
| --- | --- |
| Orderable part number | `TPS60400DBVR` |
| Status and material type | `Active`, `Production` |
| Package and pins | `SOT-23 (DBV) \| 5` |
| Package quantity and carrier | `3000 \| LARGE T&R` |
| Operating temperature | `-40 to 85 C` |
| Part marking | `PFKI` |

The same page 3 provides Figure 6-1's DBV five-pin top view and Table 6-1's
function names. Page 30 is the TI `DBV0005A` package outline. Page 31 is the
example board layout and preferred NSMD mask detail. Page 32 is the example
stencil design based on a 0.125 mm stencil. The retained PDF hash binds all
of these page claims to one immutable artifact.

## Geometry derived from TI evidence

The DBV0005A package outline gives these millimeter limits:

- body length: 2.75 minimum to 3.05 maximum
- body width: 1.45 minimum to 1.75 maximum
- overall lead span: 2.6 minimum to 3.0 maximum
- lead pitch: 0.95
- lead width: 0.30 minimum to 0.50 maximum
- lead length: 0.30 minimum to 0.60 maximum
- maximum package height: 1.45

The TI DBV0005A example board layout supplies the project review copper
geometry:

- five rectangular pads, each 1.1 mm by 0.6 mm
- left and right pad-row centers separated by 2.6 mm
- two 0.95 mm pitches place pins 1, 2, and 3 on the left row
- pin 4 is lower-right and pin 5 is upper-right
- preferred NSMD solder-mask opening uses 0.07 mm maximum per edge, giving
  1.24 mm by 0.74 mm openings
- the TI stencil example repeats 1.1 mm by 0.6 mm apertures on a 0.125 mm
  stencil, so this candidate has zero paste reduction per edge

Coordinates use the review convention of positive X to the right and positive
Y toward the top of the TI top view. The project rotation is zero degrees:

| Pin | Function | X (mm) | Y (mm) |
| ---: | --- | ---: | ---: |
| 1 | `OUT` | -1.3 | 0.95 |
| 2 | `IN` | -1.3 | 0 |
| 3 | `CFLY-` | -1.3 | -0.95 |
| 4 | `GND` | 1.3 | -0.95 |
| 5 | `CFLY+` | 1.3 | 0.95 |

The TI top view's pin-one index is upper-left. The candidate records that
datum and places pin 1 at `(-1.3, 0.95)` millimeters. Independent orientation
review remains pending.

TI does not publish a courtyard in the retained package, board-layout, or
stencil pages. The candidate therefore derives a 4.2 mm by 3.55 mm review
envelope from the maximum TI lead/body envelope and project pad envelope, plus
0.25 mm clearance. This is project geometry, not manufacturer CAD.

## CAD and release disposition

No TI-native footprint, mask-layer object, paste-layer object, courtyard, or
3D model was acquired. `manufacturerCad.state` is `not-acquired`, its artifact
path is `null`, and its authority is `deny`. The rendered tscircuit artwork is
only a review representation.

The candidate remains `releaseState: deny`, `fabricationAuthority: deny`, and
`accepted: false`. Open gates include independent pin-one review,
package-to-artwork overlay, fabricator-specific mask and stencil review,
assembly inspection, schematic integration, and board-level clearance review.
No approval is implied by the source hash, rendered geometry, or this review.

## Verification

The focused test verifies the retained PDF bytes and hash, both canonical
source hashes, exact MPN and package identity, the page-23 addendum binding,
TI page scope, all five pin identities and coordinates, copper, mask, paste,
and courtyard derivations, rendered pads and source ports, absence of
tscircuit errors, a bound rendered geometry hash, and fail-closed behavior for
identity, substitution, page, pin-map, source-hash, CAD, guidance,
orientation, acceptance, and courtyard drift.

The worktree is prepared against integration HEAD
`a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c`. No commit was created.
