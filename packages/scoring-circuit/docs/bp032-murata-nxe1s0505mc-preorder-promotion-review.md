# BP-032 Murata NXE1S0505MC pre-order promotion candidate

This document records a bounded, root-approval-required pre-order candidate
for the canonical isolated-power reference `U_ISO_POWER`. It does not change
the canonical processor-footprint ledger, board, placement, fabrication, or
release state.

The executable candidate is
[`bp032-murata-nxe1s0505mc-preorder-promotion.tsx`](../src/bp032-murata-nxe1s0505mc-preorder-promotion.tsx)
and its focused regression suite is
[`bp032-murata-nxe1s0505mc-preorder-promotion.test.tsx`](../src/bp032-murata-nxe1s0505mc-preorder-promotion.test.tsx).

## Candidate boundary

| Item | State |
| --- | --- |
| Work unit | `BP-032` |
| Canonical reference | `U_ISO_POWER` |
| Exact manufacturer / MPN | Murata Power Solutions / `NXE1S0505MC` |
| Package | `NXE1 SMD 14-position package`; functional lands at 1, 3, 7, and 8; position 14 is NA/no-connect |
| Candidate state | `candidate-unapproved`; root-only promotion decision required |
| Scope | Prototype pre-order project-footprint identity, source binding, corrected pin-one orientation, and existing artwork hash only |
| Accepted | `false`; no canonical application approval is made here |

The candidate is intentionally separate from the existing denied evidence
record at
`bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.tsx`. It
copies that record into a new private frozen baseline, adds the promotion
boundary, and reuses its existing rendered project-review component rather
than creating a second footprint geometry.

## Source and upstream contracts

The retained official Murata PDF is
[`m4-04/murata-nxe1s0505mc-datasheet.pdf`](evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf),
`KDC_NXE1.A01`, SHA-256
`53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40`.
Pages 1, 2, 6, and 7 remain bound for exact orderable/electrical facts,
isolation warnings, package/pin/land guidance, and tape orientation only.

The inherited source contracts remain hash-bound:

| Contract | Source SHA-256 |
| --- | --- |
| BP-122 isolated-power channel | `2809D5E89F235F188296F820A091986F643B0E367E58CFDC3C527F884CDA31A1` |
| BP-125 processor-support boundary | `6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20` |
| Canonical BOM | `E9B80CE4FD71C33DB626AD2F149B05DC1E62354B2C6A961EF5FDEFCD904188F0` |

The promotion candidate is based on integration commit `79d40c1`. The source
contract remains a handoff input; this artifact does not hash or mutate the
canonical ledger.

## Corrected orientation and existing project artwork

The retained Murata page-6 top view is used with `+Y` upward. The corrected
mapping is:

| Pad | Function | Project center (mm) |
| --- | --- | --- |
| 1 | `-Vin` | `(-3.81, -4.70)` lower-left |
| 3 | `+Vin` | `(-1.27, -4.70)` |
| 7 | `-Vout` | `(3.81, -4.70)` |
| 14 | `NA` | `(-3.81, +4.70)` upper-left |
| 8 | `+Vout` | `(3.81, +4.70)` |

The source recommends 2.30 mm x 1.00 mm lands, 7.62 mm outer-column center
span, and 9.40 mm row-center span. Those dimensions remain manufacturer
guidance, not CAD. Existing project-only mask, paste, and courtyard geometry
is reused unchanged: 2.40 mm x 1.10 mm mask openings, 2.20 mm x 0.90 mm paste
openings, and a 13.45 mm x 12.20 mm courtyard with 0.25 mm clearance.

The reused tscircuit 0.0.2271 project-review artwork is bound to SHA-256
`02C8560D829B499945E420E24D225182D52B0A4AF5C4AF5461E52B284E777FFA`.
This is a project-review artifact, not Murata CAD. The candidate keeps its
artwork authority denied and leaves project-artwork and orientation acceptance
false until root makes the promotion decision.

## Denied downstream gates

| Gate | State and reason |
| --- | --- |
| Manufacturer CAD | DENY — no exact-MPN Murata CAD acquired; guidance is not substituted as CAD |
| Board placement / fit | DENY — no board import, neighboring-component, edge, slot, or assembly review |
| Creepage / clearance / slot / copper keepout | DENY — datasheet dielectric testing is not PCB isolation evidence |
| Thermal / load / startup / ripple | DENY — no assembled-board thermal or power validation |
| Schematic integration | DENY — no independent net-map or power-sequence sign-off |
| Fabrication | DENY |
| Release | DENY |
| Physical testing | DENY — no received-part fit, solder, continuity, isolation, thermal, load, startup, ripple, or destructive test |

The validator rejects identity, source, package, lower-left pin-one mapping,
artwork hash, root-approval, descriptor, hidden-key, accessor, prototype,
cycle, alias, and every deny-state drift. Passing the focused suite proves
only that this pre-order candidate is internally consistent; it does not
approve the canonical ledger or authorize any downstream physical gate.
