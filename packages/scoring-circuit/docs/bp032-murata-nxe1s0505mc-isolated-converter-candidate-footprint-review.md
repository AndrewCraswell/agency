# BP-032 Murata NXE1S0505MC isolated-converter candidate

This is a prototype-first, review-only candidate for the one canonical
isolated-power reference `U_ISO_POWER`. It binds the exact Murata Power
Solutions orderable `NXE1S0505MC` and does not authorize schematic capture,
board placement, fabrication, or release.

The executable candidate is
[`bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.tsx`](../src/bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.tsx)
and the focused regression suite is
[`bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.test.tsx`](../src/bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.test.tsx).

## Canonical identity and source contracts

The selected mapping is one-to-one:

| Reference | Exact manufacturer | Exact MPN | Package identity |
| --- | --- | --- | --- |
| `U_ISO_POWER` | Murata Power Solutions | `NXE1S0505MC` | Surface-mount 14-position package; five lands at 1, 3, 7, 8, and 14; pin 14 is NA/no-connect |

The source contract is based on integration commit
`8f0739b9d4ff3a8d19bc211c07490c94c7cdca12`. The identity is carried by the
stable BP-122 isolated-power channel and checked alongside the stable BP-125
processor-support boundary. The candidate also records the stable canonical
BOM source. It does not hash the mutable BP-032 processor-footprints ledger.
Instead, `U_ISO_POWER` is a root-integration handoff: the canonical ledger
validator must enforce exactly one row with this exact MPN and package when
the candidate is integrated.

| Contract | Retained source | SHA-256 |
| --- | --- | --- |
| BP-122 isolation channel | `src/bench-prototype-isolation-channel.ts` | `2809D5E89F235F188296F820A091986F643B0E367E58CFDC3C527F884CDA31A1` |
| BP-125 processor-support boundary | `src/bench-prototype-processor-support.ts` | `6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20` |
| Canonical BOM | `src/bench-prototype-bom.ts` | `E9B80CE4FD71C33DB626AD2F149B05DC1E62354B2C6A961EF5FDEFCD904188F0` |

## Exact manufacturer evidence

The candidate reuses the retained primary Murata PDF; no duplicate PDF is
created under BP-032:

[`m4-04/murata-nxe1s0505mc-datasheet.pdf`](evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf)

SHA-256:
`53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40`

The source is `KDC_NXE1.A01` / revision A01 and is retained from the official
Murata URL:
<https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf>.

The page binding is deliberately explicit:

| Page | Manufacturer fact used by this candidate |
| --- | --- |
| 1 | Exact `NXE1S0505MC` order code; 5 V nominal input and output; 200 mA output; 1 W rated power; 4.5–5.5 V continuous input range; 64% minimum efficiency; 3 kVDC one-second isolation test and 10 GOhm minimum isolation resistance are listed in the source tables. |
| 2 | Murata’s isolation-test warning and statement that the part is not a safety-isolation element; SELV and system-level barrier requirements remain applicable. |
| 6 | 12.70 mm x 10.41 mm nominal body, ±0.25 mm dimensions, 4.80 mm maximum height, 2.54 mm pin pitch, pin map, and recommended five-land dimensions. |
| 7 | Tape-and-reel pin-1 orientation only; it does not close PCB assembly rotation or a board datum. |

The manufacturer pin map is `1 = -Vin`, `3 = +Vin`, `7 = -Vout`, `8 =
+Vout`, and `14 = NA` (not available for electrical connection).

## Manufacturer guidance versus project geometry

The page-6 recommended footprint is recorded as manufacturer guidance only:
2.30 mm pad length, 1.00 mm pad width, 7.62 mm outer-column center span, and
9.40 mm row center span. It is not an exact-orderable CAD object, and no CAD
file is treated as present.

The project review geometry uses those dimensions as an explicitly provisional
input. It renders five rectangular SMT pads at the source-backed centers:

| Pad | Function | Project center (mm) |
| --- | --- | --- |
| 1 | `-Vin` | (-3.81, -4.70) |
| 3 | `+Vin` | (-1.27, -4.70) |
| 7 | `-Vout` | (3.81, -4.70) |
| 14 | `NA` | (-3.81, 4.70) |
| 8 | `+Vout` | (3.81, 4.70) |

The project-only solder-mask openings are 2.40 mm x 1.10 mm with 0.05 mm
margin per edge; project-only paste openings are 2.20 mm x 0.90 mm with
0.05 mm reduction per edge; and the project-only courtyard is 13.45 mm x
12.20 mm with 0.25 mm minimum clearance. The rendered artwork hash is
`02C8560D829B499945E420E24D225182D52B0A4AF5C4AF5461E52B284E777FFA`.

The artwork is generated project-review geometry, not Murata CAD. In the
chosen +Y-up coordinate system, the retained page-6 top view places pin 1 at
the lower-left (`(-3.81, -4.70)`) and pin 14 at the upper-left
(`(-3.81, +4.70)`). The candidate retains that view without a transform and
leaves final assembly rotation, marking, and board datum pending independent
layout review.

## Isolation boundary

The manufacturer’s dielectric test is not PCB creepage or clearance evidence.
The intended project boundary is `APP_GND / V5` on the input side and
`SCORING_SGND / SCORING_5V_ISOLATED` on the output side; no ground crossing is
permitted. Slot, creepage, clearance, copper keepout, and the physical
isolation corridor remain unreviewed and denied.

## Gate state

| Gate | State |
| --- | --- |
| Exact orderable and package facts | Reviewed from retained manufacturer source |
| Manufacturer CAD | DENY — not acquired; no substitute geometry |
| Project artwork | DENY — generated review-only candidate |
| Orientation | DENY — independent assembly/layout review pending |
| Placement and board fit | DENY — no board integration reviewed |
| Physical isolation / slot / creepage / clearance | DENY — no PCB evidence |
| Thermal / load / startup / ripple | DENY — no assembled-board evidence |
| Schematic integration | DENY — no net-map or power-sequence sign-off |
| Fabrication | DENY |
| Release | DENY |

The private frozen baseline uses one canonical graph comparator. It rejects
identity, source, geometry, gate, prototype, key, enumerable/configurable/
writable descriptor, hidden-property, symbol, accessor, proxy, sparse-array,
null-prototype, cycle, and alias drift. Passing the focused tests only proves
internal consistency of this denied candidate; it does not close any CAD,
placement, physical-isolation, thermal, schematic, fabrication, or release
gate.
