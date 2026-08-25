# BP-031 Molex 43045-1200 internal fixture-header review

## Decision and interface boundary

This is a bounded, review-only BP-031 candidate for the exact Molex
`43045-1200` 12-position Micro-Fit 3.0 dual-row right-angle through-hole
header at BP-104 `J_WEAPON_FIXTURE`.

The decisive distinction is:

| Interface | What it is | What this candidate may claim |
| --- | --- | --- |
| Internal fixture harness | Molex `43045-1200` board header, mating Molex `43025-1200` receptacle, and BP-104 seven-channel harness | Exact source-bound nominal PCB review geometry only; `J_WEAPON_FIXTURE` remains a bench-fixture interface, not a product-facing weapon socket |
| External weapon mating | Per-side three-banana interface used with the owner-validated OK Fencing three-pin weapon cable | Cable compatibility is accepted as an owner boundary; socket identity, board-end connector, panel carrier, and production mechanical interface remain open |

`43045-1200` is not a three-banana socket, cable, or external weapon mate.
`43025-1200` is only the internal fixture-harness receptacle. No Molex part in
this review represents the external three-banana interface.

The owner-approved boundary is that the existing OK Fencing weapon cable is
compatible with established scoring boxes. That validation does not select or
qualify the board-side socket, a custom panel carrier, a production harness, or
this footprint. Production still requires a mechanically supported custom
mating interface. For a prototype, the external interface may use user-attached
sockets or soldered wires and pigtails under the handoff and strain-relief
rules below. This candidate changes no board, topology, ledger, backlog,
approval, fabrication, or production decision. `accepted` is `false` and all
fabrication, mechanical, physical, and external-mating authority remains
`deny`.

## Retained source and provenance

| Source | Scope | Retained path | SHA-256 |
| --- | --- | --- | --- |
| Molex `SD-43045-001`, rev `H1` | Exact 12-circuit finish-A material row `43045-1200`; circuit-1 mark; contact and retention holes; right-angle body; PCB-edge rule | `packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-drawing.pdf` | `571C8A381BE263CF8F92B064FE18DBC6CE6161E8CB2E931D186E8280B9F8338A` |
| Molex exact CAD preview | Material `430451200`, circuit size 12, visual housing check only | `packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-cad-preview.pdf` | `7EC4BED5FA8DE35DBCF15486EEA86062F9BAAF8CDD2BFC0F4D2126A5D68F65FA` |
| BP-104 fixture contract | Exact `J_WEAPON_FIXTURE`, internal `43045-1200` header, `43025-1200` mate, seven populated pins, five unpopulated pins, labels, continuity, miswire, and strain gates | `packages/scoring-circuit/src/bench-prototype-fixture-harness.ts` | `281E698509CE08CE820436620610182C36DB02529F1A1DD0F510D6E47A369160` |
| BP-031 footprint closure | Current canonical BP-031 import of the BP-104 internal fixture connector record | `packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts` | `4A50698A9344FF2390A12D515F0F964273812A165D3EA3EAF9A5C1E7EDC9BF71` |
| BP-034 external boundary | Owner-validated OK Fencing cable compatibility only; no socket, panel, harness, or board-end identity | `packages/scoring-circuit/src/bench-prototype-connector-preorder.ts` | `9743537C4A33A4208623B5F4CC80DF0469473C2710A960D7482AA0065AA59515` |
| BP-034 prototype handoff | Named per-side A/B/C landing and test points for prototype sockets or soldered pigtails; no footprint geometry | `packages/scoring-circuit/src/bench-prototype-direct-wire-weapon-landing.ts` | `BEF1FF45CEC4887226D9F3D4B8591B6F5266FD1C28D5AD1C923CB9B29A5B5276` |

The Molex drawing is a series drawing whose material table binds the exact
12-circuit finish-A MPN. The exact CAD preview confirms the selected housing
identity but is not a manufacturer footprint release and is not an overlay
approval. The BP-034 source files are used only to preserve the external
boundary and prototype handoff distinction; they do not add a production
connector to BP-031.

## Reviewed manufacturer geometry

The component-side PCB-layout datum is circuit 1 at `(0, 0)` mm. Circuits 1
through 6 run right-to-left on the lower row, and circuits 7 through 12 run
right-to-left on the upper row. Contact holes are `1.02 +/- 0.05` mm at
`3.00 +/- 0.10` mm non-accumulating pitch, with `3.00 +/- 0.10` mm row
spacing.

The two physical retention holes are `3.00 +/- 0.05` mm diameter at
`4.32 +/- 0.08` mm from the contact row. For 12 circuits, the drawing gives a
`10.70 +/- 0.08` mm retention-hole span from the `2.15 +/- 0.05` mm end inset
of the `15.00` mm contact span. The review datum renders them at `(-2.15,
4.32)` and `(-12.85, 4.32)` mm.

The drawing gives a `21.65` mm header span, `12.24` mm side-profile depth, and
`9.91` mm mating-face-to-rear dimension. Note 7 requires the header within
`10.16` mm maximum of the PCB edge to avoid receptacle interference. These are
manufacturer constraints only. No board-edge placement, courtyard, mating
envelope, or fabrication output is accepted here.

## Prototype handoff and safe solder points

The external interface is per-side A/B/C: `LEFT_THREE_BANANA` maps to
`J_WEAPON_HARNESS_L` and fixture pins 1-3; `RIGHT_THREE_BANANA` maps to
`J_WEAPON_HARNESS_R` and fixture pins 4-6. BP-104 pin 7 is the separate `PISTE`
fixture conductor and is not one of the three external banana contacts. Pins
8-12 remain unpopulated or review-only according to the BP-104 contract.

For prototype assembly only, the named handoff points are:

| Side | External conductor | Board net | Prototype landing | Test point |
| --- | --- | --- | --- | --- |
| Left | A | `LEFT_WEAPON_A` | `P_WEAPON_L_A` | `TP_WEAPON_L_A` |
| Left | B | `LEFT_WEAPON_B` | `P_WEAPON_L_B` | `TP_WEAPON_L_B` |
| Left | C | `LEFT_WEAPON_C` | `P_WEAPON_L_C` | `TP_WEAPON_L_C` |
| Right | A | `RIGHT_WEAPON_A` | `P_WEAPON_R_A` | `TP_WEAPON_R_A` |
| Right | B | `RIGHT_WEAPON_B` | `P_WEAPON_R_B` | `TP_WEAPON_R_B` |
| Right | C | `RIGHT_WEAPON_C` | `P_WEAPON_R_C` | `TP_WEAPON_R_C` |

These are handoff references from the prototype direct-wire contract, not
additional pads in the `43045-1200` footprint. Use only the named A/B/C points,
with the board fully de-energized and discharged. Do not solder a three-banana
socket or weapon cable to the 43045 footprint, and do not land a return,
ground, shield, piste, or fourth conductor on an A/B/C point. A temporary
pigtail is not a field-service or production connector.

## Strain-relief and miswire gates

Both sides require an independent mechanical load path. The internal fixture
harness needs a fixture clamp or approved harness relief that bypasses
`43030-0007` crimp terminals and PCB solder joints. An external prototype
socket carrier, panel bracket, or pigtail clamp must carry cable pull and bend
loads; solder is electrical only. The status of both records is `open`, and
acceptance is denied until the load path is photographed and physically
verified.

All continuity and miswire work is de-energized and discharged. Use Molex
`44242-0005` as the continuity test plug, never `43045-1200`. The BP-104
screen remains required: seven named end-to-end readings, all 66 unique
pin-pair isolation readings at 5 V with at least 10 Mohm acceptance, five
intentional-open readings for pins 8-12, and rejected `BP104-NEG-SWAP`,
`BP104-NEG-OPEN`, `BP104-NEG-RETURN-BOND`, and `BP104-NEG-REVERSED-MATE`
captures. Swaps, opens, return bonds, reversed, offset, and half-seated mates
must be rejected before energization. These physical records remain open.

## Project-only rendering inputs

The isolated TSX artwork renders the manufacturer nominal contact and
retention holes. Its `2.20` mm rounded copper pad and `0.05` mm mask margin are
project review inputs, not Molex-published copper or mask dimensions. The
candidate intentionally defines no courtyard, paste, fabricator tolerance,
stackup, board placement, or CAD overlay. The rendered geometry is SHA-256
bound by the focused test. The executable module keeps its frozen review
baseline private and exports a separately cloned, deep-frozen public graph;
validation compares those independent graphs and rejects cycle, alias, or
field drift.

## Acceptance gates

The candidate remains denied pending all of the following:

- Root review of the source-to-artwork overlay and actual board placement.
- Received `43045-1200` and `43025-1200` non-forced fit, circuit-1 mark,
  latch/lock, edge clearance, retention-peg, and orientation evidence.
- BP-104 fixture physical evidence, including terminal retention, continuity,
  negative miswire, and strain-relief records.
- Exact per-side external socket identity, cable fit, custom mechanical carrier,
  and mechanically independent strain relief for any production direction.
- Prototype A/B/C handoff continuity, isolation, intentional opens, swaps,
  reversal, and de-energized rework evidence.
- Fabricator approval of drill, copper, mask, courtyard, stackup, assembly, and
  mechanical constraints.

Until those gates are independently accepted, `accepted` is `false`,
fabrication authority is `deny`, mechanical authority is `deny`, physical
authority is `deny`, and external-mating authority is `deny`.
