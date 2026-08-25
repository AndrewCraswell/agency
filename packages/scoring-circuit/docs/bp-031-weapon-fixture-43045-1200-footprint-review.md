# BP-031 Molex 43045-1200 weapon-fixture footprint review

## Decision

This is a bounded, review-only BP-031 project-footprint evidence slice for the
exact Molex `43045-1200` 12-position Micro-Fit 3.0 dual-row right-angle
through-hole header at BP-104 `J_WEAPON_FIXTURE`. It adds no board, ledger,
backlog, approval, or fabrication change. The candidate is unaccepted and
fabrication-denied until root review and the existing BP-104 physical gates.

## Retained source binding

| Source | Scope | Retained path | SHA-256 |
| --- | --- | --- | --- |
| Molex `SD-43045-001`, rev `H1` | 12-circuit finish-A material row `43045-1200`; component-side PCB layout; circuit-1 mark; contact and retention holes; right-angle body; edge rule | `packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-drawing.pdf` | `571C8A381BE263CF8F92B064FE18DBC6CE6161E8CB2E931D186E8280B9F8338A` |
| Molex exact CAD preview | Material `430451200`, circuit size 12, visual right-angle housing check | `packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-cad-preview.pdf` | `7EC4BED5FA8DE35DBCF15486EEA86062F9BAAF8CDD2BFC0F4D2126A5D68F65FA` |
| BP-104 fixture contract | Exact `J_WEAPON_FIXTURE`, `43045-1200`, 12-position, polarized latch/lock, and pin map identity | `packages/scoring-circuit/src/bench-prototype-fixture-harness.ts` | `281E698509CE08CE820436620610182C36DB02529F1A1DD0F510D6E47A369160` |
| BP-031 footprint closure | Canonical import of the BP-104 exact connector record | `packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts` | `AC7A72F68B8D9113B6AD1D161645CC8F8B7062207ABF4FE5411042962E22314C` |

The drawing is a series drawing with the exact 12-circuit finish-A material row.
The CAD preview is exact-MPN evidence, not a manufacturer footprint release or
an overlay approval.

## Reviewed manufacturer geometry

The component-side PCB-layout datum is circuit 1 at `(0, 0)` mm. The two rows
are 3.00 +/- 0.10 mm apart. Circuits 1 through 6 run right-to-left on the
lower row, and circuits 7 through 12 run right-to-left on the upper row.
Contacts use 1.02 +/- 0.05 mm holes at 3.00 +/- 0.10 mm non-accumulating pitch.

The two physical retention holes are 3.00 +/- 0.05 mm diameter at 4.32 +/-
0.08 mm from the contact row. For 12 circuits, their 10.70 +/- 0.08 mm span
comes from the drawing's 2.15 +/- 0.05 mm end inset from the 15.00 mm contact
span. The review datum renders them at `(-2.15, 4.32)` and `(-12.85, 4.32)` mm.

The drawing gives a 21.65 mm 12-circuit header span, 12.24 mm side-profile
depth, and 9.91 mm mating-face-to-rear dimension. Note 7 requires placement
within 10.16 mm maximum of the PCB edge to avoid interference between the
receptacle and PCB. It mates with the BP-104 `43025-1200` receptacle. Those are
manufacturer constraints only; no project board-edge placement or mating
overlay is accepted here.

## Project-only rendering inputs

The isolated TSX artwork renders the manufacturer nominal holes. Its 2.20 mm
rounded copper pad and 0.05 mm mask margin are project review inputs, not
Molex-published copper or mask dimensions. It intentionally defines no
courtyard, paste, fabricator tolerance, stackup, board placement, or CAD
overlay. The rendered contact and retention geometry is SHA-256 bound by the
focused test; its digest is recorded in the executable candidate.

## Remaining gates

Root must review the source-to-artwork overlay and actual board placement. A
received `43045-1200` header and `43025-1200` mate must then demonstrate the
circuit-1 mark, latch/lock, non-forced seating, edge clearance, retention pegs,
and orientation. BP-104 still requires physical fixture evidence, and a
fabricator must approve drill, mask, courtyard, stackup, and assembly rules.
Until then, `accepted` is `false` and fabrication authority is `deny`.
