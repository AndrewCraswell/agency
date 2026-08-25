# BP-033 Keystone 5001 test-point evidence candidate

## Scope

This candidate establishes only the exact orderable identity and retained
manufacturer evidence for three canonical references:

- `TP_W5500_RESET_N`
- `TP_W5500_INT_N`
- `TP_IR_RX`

The application-footprint ledger identifies Keystone Electronics `5001` for
all three. The candidate records an explicit root-integration handoff rather
than hashing that mutable ledger. The W5500 references
use the descriptive package text “miniature through-hole black test point,
0.040 inch (catalog 1.0 mm) mounting hole”; the IR reference uses “miniature
through-hole test point, 1.02 mm hole.” Both identify the same selected MPN.

This slice does not change the canonical ledger, backlog, board, nets, or
reference-to-net mapping.

## Retained official evidence

The exact manufacturer catalog is retained at
[`keystone-terminal-test-points.pdf`](evidence/bp-033/keystone-terminal-test-points.pdf),
SHA-256 `00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C`.
Its official source URL is <https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf>.

PDF page 4, printed catalog page 62, identifies black catalog number `5001` in
the miniature color-keyed through-hole test-point family. It shows the
0.040 inch (1.0 mm) mounting-hole callout, a 0.010 inch by 0.020 inch phosphor
bronze terminal with silver or tin plating, a Nylon 46 UL 94V-0 base, and the
illustrated 7.6 mm nominal height, 3.0 mm base diameter, and 2.5 mm and 1.25 mm
loop outer and inner diameters.

## Explicit evidence boundary

The catalog establishes the selected product and its manufacturer drawing
facts. It does not authorize a project drill, annular ring, pad, mask,
courtyard, artwork, board coordinate, orientation, or assembly process.

All project geometry, placement, mechanical sample fit, probe clearance,
manufacturer CAD, fabrication, acceptance, and release gates remain denied.
The candidate is an evidence record only and deliberately produces no footprint
or board artifact.

The source/test pair uses a private independent frozen baseline and a
descriptor-safe validator. It fails closed on changed values, property flags,
hidden fields, symbols, prototype changes, and accessors without invoking
caller-provided getters.
