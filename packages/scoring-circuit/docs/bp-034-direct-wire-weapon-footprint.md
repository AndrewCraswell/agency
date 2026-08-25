# BP-034 direct-wire weapon footprint

This is an isolated, project-derived review footprint for the owner-approved
temporary direct-wire weapon option. It derives its six electrical endpoints
from the executable
[`bench-prototype-direct-wire-weapon-landing`](../src/bench-prototype-direct-wire-weapon-landing.ts)
contract without changing that contract, the schematic, any board model, or
normal USB-C PD power.

It is not manufacturer CAD. No cable, socket, harness, enclosure, board
location, board-edge relationship, assembly method, or fabricator capability
is claimed. The source is
[`bp034-direct-wire-weapon-footprint.tsx`](../src/bp034-direct-wire-weapon-footprint.tsx),
and its rendering and contract test is
[`bp034-direct-wire-weapon-footprint.test.tsx`](../src/bp034-direct-wire-weapon-footprint.test.tsx).

## Electrical endpoints

The footprint has six separate plated-through-hole solder landings and six
separate plated-through-hole test points. The test point is on the same named
net as its landing, but is physically separate. The final board import must
place top-side silkscreen with each listed label; this isolated component also
carries the labels as footprint port labels for rendering and review.

| Side | Conductor | Board net | Solder landing | Test point | Landing label | Test label |
| --- | --- | --- | --- | --- | --- | --- |
| Left | A | `LEFT_WEAPON_A` | `P_WEAPON_L_A` | `TP_WEAPON_L_A` | `LEFT WEAPON A` | `LEFT WEAPON A TEST` |
| Left | B | `LEFT_WEAPON_B` | `P_WEAPON_L_B` | `TP_WEAPON_L_B` | `LEFT WEAPON B` | `LEFT WEAPON B TEST` |
| Left | C | `LEFT_WEAPON_C` | `P_WEAPON_L_C` | `TP_WEAPON_L_C` | `LEFT WEAPON C` | `LEFT WEAPON C TEST` |
| Right | A | `RIGHT_WEAPON_A` | `P_WEAPON_R_A` | `TP_WEAPON_R_A` | `RIGHT WEAPON A` | `RIGHT WEAPON A TEST` |
| Right | B | `RIGHT_WEAPON_B` | `P_WEAPON_R_B` | `TP_WEAPON_R_B` | `RIGHT WEAPON B` | `RIGHT WEAPON B TEST` |
| Right | C | `RIGHT_WEAPON_C` | `P_WEAPON_R_C` | `TP_WEAPON_R_C` | `RIGHT WEAPON C` | `RIGHT WEAPON C TEST` |

## Project geometry and assumptions

These are conservative project planning values, selected from the existing
PCB-rule contract rather than a manufacturer drawing:

| Feature | Planning geometry | Project-derived rationale |
| --- | --- | --- |
| Solder landing | 1.30 mm finished PTH, 2.80 mm circular-equivalent copper pad, 0.75 mm annular ring | Targets a 22 AWG stranded pigtail and leaves an annular ring well above the project component floor. The intended review range is 20 to 24 AWG pending a received-cable strip and solder trial. |
| Landing pitch | 3.81 mm A/B/C center pitch per side | Gives 1.01 mm copper-to-copper clearance and 0.91 mm solder-mask web with 0.05 mm mask expansion. |
| Test point | 1.00 mm finished PTH, 2.40 mm circular-equivalent copper pad, 0.70 mm annular ring | Separate top-side-accessible point per net with 2.40 mm copper clearance to its solder landing, above the project 2.00 mm test-probe keepout. |
| Anchor pair | Two 3.20 mm NPTHs per pigtail, 7.62 mm span, 2.5 mm maximum cable-tie assumption | The holes are non-electrical. Their 1.00 mm clearance to landing copper meets the project's mounting-hole copper-keepout planning value. |
| Courtyard | One 12.82 by 13.80 mm review courtyard per side, 1.00 mm clearance | Encloses the three solder pads, three test pads, and two mechanical anchors. It is a review keepout, not an enclosure or board-placement claim. |

The anchor's required load path is pigtail jacket to cable tie or equivalent
retention method to the two NPTHs. No pull or bend load is assigned to solder
joints or plated holes. Actual tie selection, cable jacket diameter, board
thickness, bend radius, pull load, and retention must be physically proven.

## Denied authority and open gates

`boardImport.state`, `fabricationAuthority`, and `releaseState` are all
`deny`. The production socket selection remains open. Physical evidence is
also open: received cable and socket samples, stripped-wire fit, solder trial,
top-side probe access, de-energized continuity and isolation, miswire
rejection, pull and bend retention, insulation clearance, and enclosure
interaction. This footprint does not authorize fabrication, release, or a
production socket/harness decision.

## Root review

Root reviewer `root-final-reviewer` accepts this artifact on 2026-08-25 as the
prototype-only pre-order board interface. The accepted scope is the exact six
A/B/C landing nets, separate labeled test points, project copper and
orientation, the mechanical load path through two anchor holes per pigtail,
the direct-wire disposition, and unchanged USB-C PD power. Received-cable
strip/solder fit, probe access, pull/bend retention, insulation and enclosure
clearance, board placement, fabrication, and any production socket remain
downstream physical or production gates.
