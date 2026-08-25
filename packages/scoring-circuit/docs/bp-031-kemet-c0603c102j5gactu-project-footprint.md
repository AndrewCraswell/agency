# BP-031 KEMET C0603C102J5GACTU project-footprint review

## Decision

This is a bounded BP-031 review-only candidate for the exact KEMET
`C0603C102J5GACTU` SAR filter capacitor, replicated as `C_SAR_1` through
`C_SAR_7`. It is not a generic 0603 library footprint, is not accepted, and
has no fabrication or release authority.

The implementation is isolated in
[`bp031-kemet-c0603c102j5gactu-project-footprint.tsx`](../src/bp031-kemet-c0603c102j5gactu-project-footprint.tsx)
with a focused source, geometry, render, hash, and drift test in the matching
`.test.tsx` file. No board, ledger, backlog, or approval record is changed.

## Exact identity and replicated source binding

| Field | Bound value |
| --- | --- |
| Work unit | `BP-031` |
| Source contract | `BP-102` |
| Role | SAR filter capacitor |
| Canonical reference | `C_SAR` |
| Replicated references | `C_SAR_1` through `C_SAR_7` |
| Manufacturer | KEMET |
| Exact MPN | `C0603C102J5GACTU` |
| Package | EIA 0603 / IEC 1608 |
| Dielectric | C0G |
| Capacitance | 1000 pF |
| Tolerance | ±5% |
| Rated voltage | 50 VDC |

The exact source row in
`packages/scoring-circuit/src/one-channel-analog-readiness.ts` binds
`C_SAR` to KEMET, `C0603C102J5GACTU`, and 0603. The experiment source binds
the 1000 pF SAR filter selection, and the topology source binds the replicated
`C_SAR` reference identity. Their SHA-256 values are recorded and checked in
the candidate:

| Upstream source | SHA-256 |
| --- | --- |
| `src/one-channel-analog-readiness.ts` | `496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d` |
| `src/one-channel-analog-experiment.ts` | `f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b` |
| `src/bench-prototype-analog-topology.ts` | `1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d` |

The source-control basis is `refs/heads/main` at commit
`0f9e3f5a3a0aa8183b5bc71ca2b553445a462dbc`.

## Official KEMET evidence

Both retained evidence files are official KEMET-hosted PDFs. The focused test
hashes their bytes. The first source is exact-part identity evidence; the
second is KEMET family-level IPC land-pattern guidance and is explicitly not
claimed as exact-orderable CAD.

| Source | Pages and use | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| `CER ENG KIT 29`, dated 2023-10-02 | Pages 1-2: exact `C0603C102J5GACTU` row, 0603/1608 package, 1000 pF, ±5%, 50 V, C0G, and 0.80 ±0.07 mm thickness | `packages/scoring-circuit/docs/evidence/bp-031/bp031-kemet-c0603c102j5gactu-cer-eng-kit-29.pdf` | `73A53686BECC6EE192B0D265C22752E17B9F1E3DE2E979E6964470E005EE7596` |
| `C1091_C0G_ESD`, dated 2025-02-26 | Pages 9-10: standard-termination 0603 dimensions and Table 4 IPC-7351 density-level-B copper and V1/V2 grid-placement courtyard guidance | `packages/scoring-circuit/docs/evidence/bp-031/bp031-kemet-c0603c102j5gactu-c0g-esd-land-pattern.pdf` | `E7A71BB470BBC82E77E3ECBFCE7749D3F5C963985E62D4494AD52DE285945189` |

Official URLs are
<https://content.kemet.com/datasheets/CER_ENG_KIT_29.pdf> and
<https://content.kemet.com/datasheets/KEM_C1091_C0G_ESD.pdf>.

## Package and manufacturer land-pattern guidance

The exact-part kit supplies the identity and nominal thickness. KEMET’s C1091
standard-termination 0603 dimensions supply the package envelope used for
review: length 1.60 ±0.15 mm, width 0.80 ±0.15 mm, terminal bandwidth 0.35
±0.15 mm, and minimum terminal separation 0.50 mm. The exact kit supplies
0.80 ±0.07 mm nominal thickness for this orderable.

KEMET C1091 Table 4 density level B is the median/nominal IPC-7351 guidance:

| Manufacturer parameter | Value | Meaning in the source figure |
| --- | ---: | --- |
| `C` pad gap | 0.80 mm | Copper gap between the two lands |
| `Y` pad length | 0.95 mm | Land dimension along the capacitor long axis |
| `X` pad width | 1.00 mm | Land dimension across the package |
| `V1` grid-placement courtyard | 3.10 mm | Long-axis courtyard dimension |
| `V2` grid-placement courtyard | 1.50 mm | Across-package courtyard dimension |

These are manufacturer guidance values, not an acquired CAD object. The
candidate records `manufacturerCad.state` as `not-acquired`, with a null
artifact path and denied authority.

## Project derivation

The review candidate selects KEMET’s density-level-B values directly for the
project copper: two rectangular 0.95 mm by 1.00 mm pads with a 0.80 mm gap.
The pad centers are at ±0.875 mm on the local long axis, for a 1.75 mm
center-to-center span and a 2.70 mm copper envelope.

KEMET does not publish an exact-orderable solder-mask opening or stencil
aperture in the retained sources. Those layers are therefore explicit project
inputs:

- solder mask: 0.05 mm per-edge expansion, producing 1.05 mm by 1.10 mm
  openings;
- paste: 0.05 mm per-edge reduction, producing 0.85 mm by 0.90 mm apertures;
- courtyard: 3.10 mm by 1.50 mm, adopting KEMET’s density-level-B V1/V2
  grid-placement guidance. Relative to the larger copper and package
  envelopes, this leaves 0.20 mm long-axis and 0.25 mm across-axis review
  clearance.

The mask and paste dimensions are not manufacturer-CAD claims and require
fabricator and assembly review.

## Non-polar orientation

`C0603C102J5GACTU` is a two-terminal non-polar ceramic capacitor. There is no
pin-one or polarity datum. The candidate uses arbitrary review endpoints `A`
and `B`; 180-degree rotation is functionally equivalent. Assembly rotation
remains pending because placement, transient stress, effective capacitance at
the applied bias, and board-level clearance have not been independently
closed.

## Release disposition and open gaps

The candidate remains `releaseState: deny`, `fabricationAuthority: deny`, and
`accepted: false`. No KEMET-native footprint, mask object, paste object,
courtyard object, or 3D model was acquired. The rendered tscircuit artifact
is review geometry only.

Remaining gates include exact-orderable package-to-artwork overlay, independent
assembly orientation and placement review, fabricator-specific mask and
stencil review, effective capacitance and DC-bias evidence, electrical stress
review, schematic integration, and board-level clearance review.

## Verification

The focused test checks the seven-reference scope, exact source row, both
official KEMET PDF hashes, all three upstream hashes, package identity and
dimensions, manufacturer-versus-project geometry distinction, two-pad render,
project mask and paste, courtyard, source ports, non-polar orientation, no
tscircuit errors, canonical rendered geometry hash, and fail-closed behavior
for identity, scope, source, geometry, orientation, CAD, acceptance, and
courtyard drift.

No commit was created.
