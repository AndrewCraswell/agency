# BP-031 Vishay CRCW selected-resistor candidate-footprint review

## Decision

This is a bounded BP-031 review-only project-footprint evidence slice for the
four exact Vishay selections used by the analog and protection contracts:

| Canonical reference | Exact MPN | Package and value | Series geometry |
| --- | --- | --- | --- |
| `R_ESD` | `CRCW060322R0FKEAHP` | 0603, 22 ohm, 1 percent | `D11/CRCW0603 e3` |
| `R_SAR` | `CRCW060320R0FKEAHP` | 0603, 20 ohm, 1 percent | `D11/CRCW0603 e3` |
| `R_SOURCE_PD` | `CRCW0603100KFKEAHP` | 0603, 100 kilohm, 1 percent | `D11/CRCW0603 e3` |
| `R_FAULT_GUARD` | `CRCW120656K0FKEAHP` | 1206, 56 kilohm, 1 percent | `D25/CRCW1206 e3` |

The exact MPN rows are bound separately from Vishay's series-only package
drawing. The Vishay PDF does not name these four orderables and does not
provide exact-orderable CAD. No exact MPN is represented as manufacturer-CAD
approved. All project geometry remains review-only, unaccepted, and
fabrication-denied.

## Source binding

The retained official series source is the existing M4-04 artifact:

- Vishay D/CRCW e3 datasheet, document `20035`, revision `14-Apr-2026`
- <https://www.vishay.com/docs/20035/dcrcwe3.pdf>
- retained artifact: `packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf`
- SHA-256: `1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3`
- reviewed pages: 1 and 11

Page 1 establishes the D11 and D25 series designations and package families.
Page 11 supplies the package dimensions and recommended wave and reflow solder
pad dimensions. The exact selected MPN, canonical reference, resistance, and
role rows are independently bound to
`packages/scoring-circuit/src/one-channel-analog-readiness.ts`, whose retained
source hash is
`496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d`. That
project source is identity evidence only, not manufacturer evidence.

The executable evidence retains page claims and byte markers for the two
reviewed pages. The focused test verifies the retained PDF SHA-256, checks
those markers against the PDF bytes and inflated content streams, and rejects
each of the four exact MPN strings in the Vishay source. The source is used for
series geometry only; exact orderable identity comes from the canonical project
row.

## Upstream ledger binding

Each exact MPN and canonical reference carries two immutable upstream
bindings:

| Ledger | Retained source | Per-row binding |
| --- | --- | --- |
| M4-04 | `packages/scoring-circuit/src/m4-04-single-channel-coupon.ts` (`2CBA495FC2746C038FB09A13793B1DBF7F7D0B4D8F55D7F748AD2E0E9E12D0E0`) | exact reference, exact MPN, package, `footprintRelease: deny`, root independent drawing review still pending |
| BP-031 | `packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts` (`3D565A3E71BC53B6182A7DBF80F775D5657A70AB54850CC6F8BCFA8EFDE69EDD`) | `BP-103` replicated row, `BP-102` source subcontract, source base reference, `M4-04:<MPN>` shared source ID, `DNP-unresolved`, PCB eligibility false, release deny |

Focused tests compare all four rows against the canonical BOM, the M4-04
footprint ledger, and the BP-031 replicated-cell ledger, including reference
prefixes. No generic resistor alias or cross-size substitution is accepted.

## Shared series geometry

The drawing's solder-pad diagram defines `G` as the edge gap, `Y` as pad
length along the resistor terminal axis, `X` as pad width across that axis,
and `Z` as the overall exposed-land span. The values reconcile as
`Z = G + 2Y` for both selected reflow patterns.

### D11/CRCW0603 e3

- body length: 1.50 minimum to 1.65 maximum millimeters
- body width: 0.75 minimum to 0.95 maximum millimeters
- body height: 0.40 minimum to 0.50 maximum millimeters
- reflow land pattern: `G 0.75`, `Y 0.75`, `X 1.00`, `Z 2.25` millimeters
- wave land pattern: `G 0.65`, `Y 1.10`, `X 1.25`, `Z 2.85` millimeters
- rendered review copper uses 0.75 millimeter pad length, 1.00 millimeter
  pad width, and 1.50 millimeter pad-center span

### D25/CRCW1206 e3

- body length: 3.00 minimum to 3.30 maximum millimeters
- body width: 1.45 minimum to 1.75 maximum millimeters
- body height: 0.50 minimum to 0.60 maximum millimeters
- reflow land pattern: `G 1.50`, `Y 1.05`, `X 1.80`, `Z 3.60` millimeters
- wave land pattern: `G 1.40`, `Y 1.40`, `X 1.95`, `Z 4.20` millimeters
- rendered review copper uses 1.05 millimeter pad length, 1.80 millimeter
  pad width, and 2.55 millimeter pad-center span

The 0603 and 1206 geometry is shared only within its corresponding Vishay
series family. No cross-package or exact-orderable geometry substitution is
made.

## Review-only mask, paste, courtyard, and orientation

The retained Vishay series drawing supplies copper land guidance but does not
publish solder-mask openings, stencil apertures, or courtyard geometry. The
TSX candidate therefore labels these as project review inputs rather than
manufacturer data:

- solder mask uses a 0.05 millimeter per-edge project margin
- paste uses a 0.05 millimeter per-edge project reduction
- courtyard uses the maximum package and project-pad envelopes plus 0.15
  millimeter review clearance
- 0603 review courtyard: approximately 2.55 by 1.30 millimeters
- 1206 review courtyard: approximately 3.90 by 2.10 millimeters
- both parts are electrically non-polar; pin one is not applicable
- assembly marking orientation and independent review remain open

Manufacturer CAD is explicitly `not-acquired`, with a null artifact path and
`deny` authority for both series families. The rendered artwork hashes are
`EB0DD0D03CD7A003236E3897437CFB241845AF751681D5791A23E34920FEA62D` for the
0603 family and
`51F5C2A3B2D261EF74D4DC67EB7775C9F425E8E2FB863490A726118CFEFED250` for the
1206 family. These hashes bind review rendering only and are not fabrication
approval.

Both resistor families are electrically non-polar. Pin one is not applicable,
and the project orientation state remains `pending-independent-review` with no
assembly rotation recorded. Printed value orientation and assembly marking
are still open. The rendered digest is recomputed from the actual tscircuit
soup elements for each family, including copper, solder-mask margin, paste
apertures, and courtyard rectangle.

## Verification and open gaps

The focused test checks the exact four-MPN set, package and resistance binding,
canonical and upstream ledger hashes, official series-source bytes and page
markers, identity-source bytes and hash, family-specific geometry, copper,
project mask and paste derivations, courtyard, orientation, rendered source
ports, tscircuit errors, actual artwork hashes, and fail-closed drift for MPNs,
source hash, ledger binding, series geometry, CAD authority, orientation,
acceptance, and fabrication authority.

Open evidence includes exact-orderable manufacturer CAD, manufacturer-specific
mask and stencil data, exact package-to-artwork overlay, independent assembly
orientation review, and fabricator/process review. This slice makes no board,
ledger, backlog, acceptance, or fabrication change.
