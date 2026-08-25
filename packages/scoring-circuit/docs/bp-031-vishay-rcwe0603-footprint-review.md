# BP-031 Vishay Dale RCWE0603 candidate-footprint review

## Decision

This is a bounded BP-031 review-only project-footprint evidence slice for the
exact Vishay Dale `RCWE0603R220FKEA` selected for the seven replicated reference
resistors `R_REF_SAR_1` through `R_REF_SAR_7`. The canonical project source
binds the exact MPN and replication set; the retained Vishay source supplies
series and global-part-number evidence only. It does not name the exact
orderable and does not provide exact-orderable CAD.

The candidate remains unaccepted and fabrication-denied. No board, ledger,
backlog, or approval state is changed by this artifact.

## Source binding

The retained official Vishay Dale source is:

- document `20019`, revision `24-Oct-2023`
- <https://www.vishay.com/docs/20019/rcwe.pdf>
- retained artifact: `packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf`
- SHA-256: `5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374`
- reviewed pages: 1-2

Page 1 establishes the RCWE0603 family and the 0.033 ohm to 0.976 ohm
resistance range that contains the selected 0.22 ohm value. Page 2 establishes
the global part-number fields, including `R220` as a decimal resistance value,
`F` as 1% tolerance, `K` as +100 ppm/C TCR, and `EA` as lead-free tape/reel
packaging. Page 2 also supplies the 0603 body dimensions and the 0.033 ohm to
0.976 ohm solder-pad row.

The exact identity is separately bound to
`packages/scoring-circuit/src/one-channel-analog-readiness.ts`, SHA-256
`496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d`. That
project source identifies `R_REF_SAR` and `RCWE0603R220FKEA`; it is identity
and replication evidence only, not manufacturer evidence or CAD.

## Exact selected part and replication

| Canonical reference | Exact MPN | Value | Tolerance | TCR | Package | Replicas |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `R_REF_SAR` | `RCWE0603R220FKEA` | 0.22 ohm | 1% | +100 ppm/C | 0603 | `R_REF_SAR_1` through `R_REF_SAR_7` |

The Vishay source does not name the exact `RCWE0603R220FKEA` orderable. The
source record therefore keeps `exactMpnNamedInManufacturerSource: false` and
does not promote series geometry to exact-orderable CAD.

## Manufacturer-derived package and copper

For the RCWE0603 row covering 0.033 ohm to 0.976 ohm, the Vishay drawing gives:

- body length: 1.50 to 1.70 mm from 1.60 +/- 0.10 mm
- body width: 0.75 to 0.95 mm from 0.85 +/- 0.10 mm
- body height: 0.40 to 0.60 mm from 0.50 +/- 0.10 mm
- terminal lengths T1 and T2: 0.10 to 0.50 mm from 0.30 +/- 0.20 mm
- reflow `a`: 0.70 mm, interpreted as pad length along the terminal axis
- reflow `b`: 1.00 mm, interpreted as pad width across the terminal axis
- reflow `l`: 0.80 mm inner gap

The rendered project copper uses the manufacturer table values: two rectangular
0.70 mm by 1.00 mm pads, 0.80 mm inner gap, 1.50 mm pad-center span, and 2.20
mm overall copper span. This is a project rendering of series guidance, not a
manufacturer exact-orderable footprint release.

## Project-derived mask, paste, courtyard, and orientation

The Vishay source does not publish solder-mask openings, stencil apertures, or
courtyard geometry. The candidate labels these as project review inputs:

- solder mask: 0.05 mm margin per edge, opening 0.80 by 1.10 mm
- paste: 0.05 mm reduction per edge, opening 0.60 by 0.90 mm
- courtyard: maximum package and pad envelopes plus 0.15 mm clearance, 2.50 by
  1.30 mm
- orientation: electrically non-polar; pin one is not applicable; value-marking
  direction and independent assembly review remain open

Manufacturer CAD is explicitly `not-acquired`, with null artifact and `deny`
authority. The rendered project artwork is hash-bound for review only and also
has `deny` authority.

## Verification and gaps

The focused test verifies the exact MPN, seven replicated references, source
bytes and hashes, reviewed page mapping, package and resistance binding,
manufacturer copper interpretation, project mask/paste/courtyard derivations,
non-polar orientation, rendered pads and ports, artwork hash, and fail-closed
drift for identity, source, geometry, CAD authority, and acceptance.

Remaining evidence gaps are exact-orderable manufacturer CAD, manufacturer
mask and stencil data, exact package-to-artwork overlay, independent assembly
orientation review, and fabricator/process review.
