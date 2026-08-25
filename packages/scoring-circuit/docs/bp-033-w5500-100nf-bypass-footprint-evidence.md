# BP-033 W5500 100 nF bypass footprint evidence

## Scope

This is a review-only geometry record for the exact Murata `GRM188R71C104KA01D` selected by the canonical Ethernet support record for these eight references:

- `C_ETH_AVDD_FERRITE_INPUT`
- `C_W5500_VDD`
- `C_W5500_AVDD_1` through `C_W5500_AVDD_6`

It does not change the W5500 IC, crystal, ferrite, support-network topology, board, application ledger, or backlog.

## Primary-source retention

The retained official Murata reference sheet is [GRM188R71C104KA01-01](evidence/bp-033/murata-grm188r71c104ka01d-reference-sheet.pdf), SHA-256 `A8D9E8E5A06AA235221C7E957837509E64A9F75E42230EE142F51F984B4CFA09`.

- Page 1 identifies `GRM188R71C104KA01_`: 0603 / 1608M, X7R, 0.1 uF, 16 V. The final `D` is the paper-tape packaging suffix.
- Page 26, Table 2, gives the reflow row for GRM code 18, 1.6 x 0.8 mm within +/-0.10: `a` inner gap 0.6 to 0.8 mm, `b` pad length 0.6 to 0.7 mm, and `c` pad width 0.6 to 0.8 mm.
- The same page requires confirmation of suitable land dimensions on the actual set and PCB. It does not supply retained finished CAD for this exact MPN.

## Review geometry

The isolated candidate selects the midpoint of the published reflow ranges: 0.70 mm inner gap, 0.65 mm x 0.70 mm copper pads at X = +/-0.675 mm. It derives 0.75 mm x 0.80 mm solder-mask openings from a 0.05 mm per-edge project margin, 0.55 mm x 0.60 mm paste openings from a 0.05 mm per-edge project reduction, and a 2.50 mm x 1.30 mm review courtyard with 0.25 mm minimum clearance.

These mask, paste, and courtyard values are project review inputs, not a Murata CAD claim.

The canonical isolated render retains the exact soup inventory (17 elements: source
records, one PCB component/group, two SMT pads, two paste elements, one courtyard,
two PCB ports, and one CAD component). The target pad metadata includes top-layer
placement, terminal port hints, uncovered solder mask, and the 0.05 mm solder-mask
margin; the paste and courtyard target metadata are also validated. The independent
artwork digest for the canonical target geometry and mask metadata is
`EEB50A5C36D394B767EAADC5256C8B837DA9AE455AE9F4BCB8BD008D846A1E0A`.

## Denial gates and handoff

The TypeScript artifact records `manufacturerCad.state = not-acquired`, `manufacturerCad.authority = deny`, `boardIntegration = false`, `fabricationAuthority = deny`, `releaseState = deny`, and `accepted = false`. No CAD, board, or release artifact is produced by this slice.

Root must perform any later mapping from this isolated record into the canonical application ledger and release process. That mapping is deliberately not included here.
