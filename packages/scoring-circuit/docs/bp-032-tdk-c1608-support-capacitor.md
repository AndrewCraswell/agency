# BP-032 TDK C1608 support-capacitor candidate

This is a BP-032 review artifact for the exact support-capacitor reference
`C_ESP_EN_DELAY`. It records the existing BP-123 selection and closes the
candidate-to-reference evidence binding without granting release or
fabrication authority.

## Exact mapping

| Reference | Upstream selection | MPN | Value | Package | Population |
| --- | --- | --- | --- | --- | --- |
| `C_ESP_EN_DELAY` | BP-123 reset/watchdog | `C1608X5R1A105K080AC` | 1 uF X5R, 10 V, ±10% | 0603 / C1608 / EIA CC0603 | required |

The BP-125 processor-support contract still carries `C_ESP_EN_DELAY` as
`TBD`; BP-032 reconciles that row to the exact MPN already selected by BP-123.
No BP-125 contract, schematic, board, or plan file is changed by this
artifact.

## Retained manufacturer evidence

- `tdk-c1608x5r1a105k080ac-characterization.pdf` is the exact TDK
  characterization sheet for `C1608X5R1A105K080AC`.
  SHA-256:
  `180BECCB71F93CF9C4E7FDF810F9295BBE2009EF4595D733D32BE9DC4DEFC00D`.
  It identifies TDK, the exact orderable, C1608 / EIA CC0603, 1 uF X5R,
  10 V, ±10%, and the 1.60 mm × 0.80 mm × 0.80 mm nominal body envelope.
- `tdk-c1608-commercial-general-land-pattern.pdf` is TDK family-level
  C1608 / CC0603 land guidance on retained PDF page 13 (printed page 12).
  SHA-256:
  `83CE2395061AB4F3EC0BCF55FC419CA5077FEF4AF13CBF85FBE0B53E4BC80D5C`.
  Reflow A, B, and C are each 0.6 mm to 0.8 mm. A is the terminal-to-
  terminal land gap, B is pad length, and C is pad width.

The exact characterization sheet and the family land guidance are retained
as separate manufacturer-primary records. No exact TDK CAD object was
acquired; the project geometry is therefore a derived review input, not
manufacturer CAD.

## Review-only project geometry and orientation

The candidate renderer uses midpoint reflow values: 0.7 mm pad gap, 0.7 mm
pad length, and 0.7 mm pad width. It emits two 0.7 mm × 0.7 mm rectangular
SMD pads centered at ±0.7 mm, 0.8 mm mask openings, 0.6 mm paste openings,
and a 2.4 mm × 1.3 mm project courtyard. The rendered artwork is identified
as `tdk-c1608-c1608x5r1a105k080ac-project-review`.

The MLCC is non-polar and has no pin-one requirement; 180-degree rotation is
electrically equivalent. Assembly rotation, board-flex direction, local
clearance, solder volume, and independent placement review remain open.

The candidate remains `releaseState: deny`, `fabricationAuthority: deny`,
and `accepted: false`. This evidence closes identity and reference mapping
only; it does not close physical assembly, instrument, or prototype evidence.

Root reviewer `root-final-reviewer` visually inspected the exact one-page TDK
characterization sheet and retained PDF page 13 (printed page 12) of the TDK
commercial-general specification on 2026-08-25. The review accepts the exact
orderable, package envelope, family reflow ranges, and `C_ESP_EN_DELAY`
mapping. It does not accept the project mask, paste, courtyard, placement, or
fabrication assumptions.
