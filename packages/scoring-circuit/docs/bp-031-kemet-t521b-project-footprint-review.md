# BP-031 KEMET T521B106M025ATE100 project-footprint review

Status: root-review candidate only. The artifact is not a board footprint, is
not an order or fabrication release, and remains unaccepted.

## Exact identity and source binding

The candidate is scoped to exactly these seven physical references:

`C_REF_REG_1`, `C_REF_REG_2`, `C_REF_REG_3`, `C_REF_REG_4`,
`C_REF_REG_5`, `C_REF_REG_6`, and `C_REF_REG_7`.

The canonical source is `C_REF_REG` in
`packages/scoring-circuit/src/one-channel-analog-readiness.ts`. Its exact
orderable is KEMET `T521B106M025ATE100`, package `1411 / 3528 B case`, used as
the REF5025A-Q1 local output stabilizer under BP-101. The M4-04 source registry
is `packages/scoring-circuit/src/m4-04-single-channel-coupon.ts`, key
`T521B106M025ATE100`.

The retained manufacturer-primary artifact is
`packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf`.
Its SHA-256 is
`8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD`.
Page 1 is the reviewed page. It visibly contains the exact orderable and
package identity, cathode-negative and anode-positive end views, bottom view,
package dimensions, terminal dimensions, electrical rating, and ESR. No PCB
land pattern or manufacturer CAD is published by this retained source.

The candidate records the c6a0723 integration basis and byte hashes for both
the canonical readiness source and the M4-04 source registry. The private
expected baseline is a separately cloned and frozen data graph, so validator
success does not depend on comparing an object with itself.

## Manufacturer dimensions and project geometry

The retained page-1 dimensions are:

- body: `L 3.5 +/- 0.2 mm`, `W 2.8 +/- 0.2 mm`, `H 1.9 +/- 0.1 mm`
- terminal length `S 0.8 +/- 0.3 mm`
- terminal width `F 2.2 +/- 0.1 mm`
- terminal gap `A 1.9 mm minimum`
- electrical identity: 10 uF, 20%, polymer tantalum, 25 VDC at 105 C,
  16.75 VDC at 125 C, 100 mOhm maximum ESR at 100 kHz and 25 C

No manufacturer land pattern is claimed. The project review selection is
explicitly derived from the terminal dimensions:

- two rectangular SMT copper pads, each `1.0 mm x 2.2 mm`
- copper gap `1.9 mm`, overall land span `3.9 mm`, pad centers at `-1.45 mm`
  and `+1.45 mm`
- project solder-mask openings `1.1 mm x 2.3 mm`, with `0.05 mm` per-edge
  expansion
- project paste openings `0.9 mm x 2.1 mm`, with `0.05 mm` per-edge reduction
- project review courtyard `4.2 mm x 3.3 mm`, with `0.15 mm` minimum review
  clearance

Mask, paste, courtyard, and all rendered geometry are project inputs. They are
not manufacturer CAD and do not imply assembly, board-fit, or fabrication
acceptance.

## Polarity and orientation provenance

The retained page-1 cathode-negative and anode-positive views establish the
component polarity datum. The candidate maps project-local pad 1 to the
cathode-negative side and project-local pad 2 to the anode-positive side. The
source does not establish a board-origin pin number or assembly rotation, so
the candidate records the pad numbering as a project-local datum only.

Independent polarity-stripe, pin-number, rotation, placement, clearance,
rail-stress, derating, ripple, and assembly review remain pending. The
candidate's `orientation` and `stressOrientationReview` state therefore remain
`pending-review`.

The rendered review artwork is tscircuit `0.0.2271`, represented as the two
SMT pads, two solder-paste openings, and one review courtyard rectangle. Its
canonical rendered-geometry SHA-256 is
`43EBA95B452F5F82802DC15C153A4E2555D591177A216923D3E2A1CFA8F3B3A1`.
Artwork authority remains denied.

## Validator and gates

`validateBenchPrototypeKemetT521bProjectFootprint` compares descriptor values
against the private frozen baseline without reading accessor values. It catches
unknown values, symbols, non-plain prototypes, source and reference forgery,
aliases, cycles, proxy traps, and authority escalation, returning a non-empty
error list for every mismatch. An omitted argument validates the frozen
candidate; an explicitly supplied `undefined` is rejected.

The candidate keeps manufacturer CAD approval, project-artwork approval,
orientation approval, footprint-closure authorization, schematic integration,
procurement, fabrication, acceptance, and release denied. The candidate is not
imported by a board and does not edit or extend the canonical BP-031 closure or
ledger.

## Verification

Focused verification for this artifact:

- focused Vitest: 11 tests passed
- package TypeScript check: passed
- targeted oxlint: passed
- oxfmt: passed on the two source/test files
- `git diff --check`: passed

Root review and commit are intentionally separate from this candidate work.
