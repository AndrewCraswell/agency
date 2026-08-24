# M4-13 harness pinout and release boundary

**Disposition:** the M4-13 reconciliation is implemented as a fail-closed
review record. It does not authorize a harness build, connector procurement,
PCB placement, enclosure release, or fabrication.

The executable record is
[`production-harness-release.ts`](../src/production-harness-release.ts), with
focused regression coverage in
[`production-harness-release.test.ts`](../src/production-harness-release.test.ts).
It derives the selected connector, housing, terminal, cable, pin, and rating
identities from the existing production harness selection so the M4-13 record
does not create a second component-selection authority.

## Reconciled physical map

| Board reference | Connector | Pin | Logical line | FIE socket position | State |
| --- | --- | ---: | --- | --- | --- |
| `J_WEAPON_HARNESS_L` | Molex `43650-0300` | 1 | `left.A` | outer-near, 15 mm from centre | proposed, not physically verified |
| `J_WEAPON_HARNESS_L` | Molex `43650-0300` | 2 | `left.B` | centre | proposed, not physically verified |
| `J_WEAPON_HARNESS_L` | Molex `43650-0300` | 3 | `left.C` | outer-far, 20 mm from centre | proposed, not physically verified |
| `J_WEAPON_HARNESS_R` | Molex `43650-0400` | 1 | `right.A` | outer-near, 15 mm from centre | proposed, not physically verified |
| `J_WEAPON_HARNESS_R` | Molex `43650-0400` | 2 | `right.B` | centre | proposed, not physically verified |
| `J_WEAPON_HARNESS_R` | Molex `43650-0400` | 3 | `right.C` | outer-far, 20 mm from centre | proposed, not physically verified |
| `J_PISTE_HARNESS` | Molex `43650-0200` | 1 | `piste` | not applicable | selected logical boundary |
| `J_PISTE_HARNESS` | Molex `43650-0200` | 2 | `piste-return` | not applicable | selected ESD-return boundary |

The A/B/C assignments are the M4-13 proposal against the M0-03 logical names;
they are not treated as a received-plug or panel measurement. The exact FIE
three-contact geometry remains the M4-10 source contract, and the physical
position map cannot be released until the selected socket, actual plug,
panel stack-up, labels, and harness are inspected together.

The right weapon header's fourth cavity is intentionally empty: it has no
terminal and no conductor. The empty cavity is not treated as the sole keying
feature. The different circuit counts and distinct harness labels are
planning constraints that still require physical mating and service checks.

## Bonding, power, and ratings

- Weapon harnesses have no cable shield or chassis bond. Their conductors stay
  in the connector-side ESD clamp and analog fault path.
- `J_PISTE_HARNESS` pin 2 is `PISTE_RETURN` to `ESD_RETURN`; it is not a shield
  termination, protective earth, chassis, or processor-ground connection.
- `J_PRIMARY_OUTPUTS_HARNESS` has a dedicated scoring-domain return and no
  cable shield or chassis bond claim.
- USB-C PD remains the sole normal external apparatus-power input. The harness
  connectors are not external power inlets, and destructive power application
  through them is forbidden until an independent fault review permits it.
- Molex component ratings are recorded as 7 A per Micro-Fit contact and 9 A
  per Mini-Fit Jr. contact. These are not system current approvals. Branch
  current, temperature, voltage drop, cable length, ambient, fault, crimp,
  EMC, and service evidence remain required.

## Dependencies and blockers

M0-03 and M0-10 are accepted logical and power/reset contracts. M4-10 remains
blocked on plug fit, retention, contact resistance, cycle, salt, and panel
evidence. M4-11 remains blocked on configured connector CAD, overlays, shell
bonding, and strain relief. M4-12 remains blocked on socket length, enclosure
clearance, connector overlays, thermal and cable-bend evidence. Therefore the
M4-13 record remains `releaseState: deny` with all authority flags false.

Before root can approve this unit, the remaining release record must include a
controlled harness drawing, exact crimp process and pull criteria, keyed
left/right service interfaces, physical pin-one and label inspection, chassis
load path, current/temperature evidence, ESD/EMC review, and independent
approval. None of those gates is inferred by this contract.
