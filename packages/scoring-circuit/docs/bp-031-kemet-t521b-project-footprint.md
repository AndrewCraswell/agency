# BP-031 KEMET T521B106M025ATE100 project-footprint candidate

This isolated tscircuit review artifact covers the seven exact BP-031
REF5025A-Q1 local-output references `C_REF_REG_1` through `C_REF_REG_7`. It is
not instantiated on a board and does not approve schematic integration,
layout, procurement, fabrication, or release.

## Exact source binding

The candidate is compared with current main `7a3566bfcdffb1db64310e4731038f08cac40305` and is bound to the exact M4-04 selection retained for the canonical `C_REF_REG` row in
`one-channel-analog-readiness.ts`. BP-103 repeats that identity as
`C_REF_REG_1` through `C_REF_REG_7`; the repeated references do not authorize a
different MPN, package, or footprint.

The exact retained manufacturer evidence is:

| Evidence | Retained artifact and SHA-256 | Use |
| --- | --- | --- |
| Exact-part drawing | `packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf` `8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD` | Exact MPN, 1411 / 3528 B-case identity, polarity end views, package dimensions, terminal dimensions, and electrical ratings. The drawing does not publish a PCB land pattern or manufacturer CAD. |

Source URL: [KEMET T521B106M025ATE100 specification](https://search.kemet.com/download/specsheet/T521B106M025ATE100).

The canonical source bytes used for binding are also hash-checked in the
focused test:

| Upstream source | SHA-256 |
| --- | --- |
| `packages/scoring-circuit/src/one-channel-analog-readiness.ts` | `496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d` |
| `packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts` | `ac7a72f68b8d9113b6ad1d161645cc8f8b7062207abf4fe5411042962e22314c` |

## Manufacturer package and polarity evidence

The retained page 1 identifies KEMET T521, polymer tantalum, 10 uF, 25 VDC,
20 percent, low ESR, non-combustible, 1411 / 3528 B case. Its mechanical
dimensions are:

- `L = 3.5 +/- 0.2 mm`, `W = 2.8 +/- 0.2 mm`, and `H = 1.9 +/- 0.1 mm`;
- terminal length `S = 0.8 +/- 0.3 mm` along the long axis;
- terminal width `F = 2.2 +/- 0.1 mm` across the package;
- terminal gap `A = 1.9 mm minimum`.

The same page shows separate cathode-negative and anode-positive end views.
Those views establish that the part is polarized, but they do not establish a
board-origin numbering or assembly rotation for this project. This candidate
therefore uses a local top-view datum: pad 1 on the left is `K` / cathode
negative, and pad 2 on the right is `A` / anode positive. Independent
orientation review remains required.

No manufacturer PCB land pattern or CAD artifact was retained. The code uses
`manufacturerCad.state = "not-acquired"` with `authority = "deny"`; this means
CAD was not acquired or retained and makes no claim about whether KEMET offers
an external file.

## Project-review geometry

The two rectangular copper pads are a project candidate derived from the
retained drawing, not a KEMET recommendation:

- copper pad length along X = `1.0 mm`, selected within the drawing's
  `S = 0.8 +/- 0.3 mm` terminal-length envelope;
- copper pad width along Y = `2.2 mm`, the drawing's nominal `F` terminal
  width;
- copper gap = `1.9 mm`, with `1.45 mm` pad centers and `3.9 mm` overall land
  span. This meets the drawing's `A = 1.9 mm` minimum terminal-gap dimension
  without claiming a manufacturer land pattern;
- mask openings = `1.1 mm x 2.3 mm`, using a `0.05 mm` per-edge project
  expansion;
- paste openings = `0.9 mm x 2.1 mm`, using a `0.05 mm` per-edge project
  reduction;
- courtyard = `4.2 mm x 3.3 mm`, using `0.15 mm` minimum clearance around the
  larger of the maximum package envelope (`3.7 mm x 3.0 mm`) and selected land
  span (`3.9 mm x 2.2 mm`).

The focused test renders and checks the actual tscircuit `pcb_smtpad`,
`pcb_solder_paste`, `source_port`, and `pcb_courtyard_rect` elements, including
their polarity hints, and rejects any tscircuit error elements. The canonical
rendered-soup geometry digest is recorded in the TSX artifact after rendering.
It identifies only generated project-review artwork and is not a manufacturer
CAD digest.

## Remaining gates

Manufacturer CAD and a manufacturer PCB land-pattern recommendation remain
not acquired/retained. Independent cathode/anode-to-pad numbering and assembly
rotation review remain open. REF5025A-Q1 rail stress, tantalum derating, ripple,
placement, paste/assembly process, courtyard fit, board-level clearance, and
fabrication review remain open. The candidate has `orientation.state` and
`stressOrientationReview.state` set to `pending-review`, `accepted = false`,
`releaseState = "deny"`, and `fabricationAuthority = "deny"`. No board
integration, fabricated result, physical measurement, or approval is claimed.
