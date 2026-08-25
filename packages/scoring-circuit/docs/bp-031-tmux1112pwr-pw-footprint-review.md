# BP-031 TMUX1112PWR PW TSSOP-16 candidate-footprint review

## Decision

This is a bounded BP-031 candidate-footprint evidence slice for the exact
Texas Instruments `TMUX1112PWR` orderable in the `PW (TSSOP, 16)` package.
Root review accepts the exact orderable identity, retained TI source pages,
pin functions, seven-reference mapping, and deny-state integrity. The project
geometry and orientation remain review-only and unaccepted, the artifact has
no fabrication authority, and it must not be treated as a generic TSSOP
library footprint.

The implementation is isolated in
[`bp031-ti-tmux1112pwr-pw-footprint-evidence.tsx`](../src/bp031-ti-tmux1112pwr-pw-footprint-evidence.tsx)
with a focused rendering and drift test in the matching `.test.tsx` file. The
BP-031 analog-footprint ledger maps this one candidate to all seven exact
`U_SOURCE_SWITCH_1` through `U_SOURCE_SWITCH_7` references. That mapping
preserves the candidate's source and deny state; it does not accept geometry,
acquire manufacturer CAD, approve a footprint, or authorize a board, release,
or fabrication.

## Exact identity and source binding

| Field | Bound value |
| --- | --- |
| Work unit | `BP-031` |
| Manufacturer | Texas Instruments |
| Exact MPN | `TMUX1112PWR` |
| Package | `PW (TSSOP, 16)` |
| Package drawing | `PW0016A` |
| Standard named by TI | `JEDEC MO-153` |
| Canonical source reference | `U_SOURCE_SWITCH` |
| Replicated reference family | `U_SOURCE_SWITCH_` |
| Source contract | `BP-102` |
| TI document | `SCDS408C`, Rev. C |
| Official source URL | <https://www.ti.com/lit/ds/symlink/tmux1112.pdf> |
| Retained evidence | `docs/evidence/bp-031/ti-tmux1112pwr-pw0016a-datasheet-rev-c.pdf` |
| Retained evidence SHA-256 | `EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D` |
| Upstream source SHA-256 | `496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d` |

The retained PDF is byte-identical to the existing official TI evidence used
by M4-04, but it has a unique BP-031 path and is independently hash-checked by
the focused test. The reviewed pages are page 3 for the PW top-view pin map,
page 33 for the exact TMUX1112PWR orderable and PW package identity, page 41
for the PW0016A package outline, page 42 for the TI land-pattern and
solder-mask examples, and page 43 for the TI stencil example.

## Geometry derived from TI evidence

The source drawing identifies these package limits in millimeters:

- body length: 4.9 minimum to 5.1 maximum
- body width: 4.3 minimum to 4.5 maximum
- overall lead span: 6.2 minimum to 6.6 maximum
- lead pitch: 0.65
- lead width: 0.17 minimum to 0.30 maximum
- lead length: 0.50 minimum to 0.75 maximum
- maximum package height: 1.2

The TI PW0016A example board layout is used as manufacturer guidance for the
project review input:

- sixteen rectangular copper pads, 1.5 by 0.45
- two pad-row centers separated by 5.8
- fourteen inter-pad pitches at 0.65
- preferred non-solder-mask-defined openings with 0.05 per-edge margin,
  giving 1.6 by 0.55 mask openings
- the TI example stencil repeats 1.5 by 0.45 apertures on a 0.125 stencil,
  so this candidate uses zero per-edge paste reduction
- courtyard is not published by TI. The candidate derives a 7.8 by 5.6
  review envelope from the maximum package and pad envelopes plus 0.25
  clearance

Pin one follows the TI top view: the pin-one index area is upper-left, pins 1
through 8 run down the left edge, and pins 9 through 16 return up the right
edge. The project review orientation uses zero degrees and places pin 1 at
`(-2.9, 2.275)` millimeters. This is a source-derived project input pending an
independent orientation review.

## What remains open

The retained TI PDF is not a manufacturer CAD object. No TI-native footprint,
mask layer object, paste layer object, courtyard object, or 3D model is
represented as acquired. The project TSX renders review geometry so that its
dimensions and pin map can be inspected; it does not confer manufacturer-CAD
authority.

The candidate remains denied because independent geometry and orientation
acceptance, fabricator-specific mask and stencil review, package-to-artwork
overlay, assembly inspection, schematic integration, and board-level
clearance review are not complete. The artwork hash is
`9ABFB669F4BE57EED397C1AF2B812653D9B56032F492433BFEAF20EF1F959A7B`; it binds
the rendered review artifact only and is not a fabrication signoff.

Root reviewer `root-final-reviewer` visually inspected retained PDF pages 3,
33, and 41 through 43 on 2026-08-25 and verified the exact `TMUX1112PWR`
orderable, PW TSSOP-16 package, pin map, package outline, example land pattern,
mask guidance, and stencil example. This review does not accept the derived
courtyard, project artwork, board fit, or fabrication release.

## Verification

The focused test checks source bytes and hashes, exact identity and package,
all sixteen pad identities and coordinates, pin-one orientation, copper,
mask, paste, courtyard derivations, rendered tscircuit geometry, source ports,
no tscircuit errors, and fail-closed behavior for identity, source hash, CAD
disposition, courtyard, and acceptance drift.

The isolated worktree was created from `refs/heads/main` at commit
`8c27dd468c3b522f600207405191f136d0e7ee84`. No commit was created.
