# BP-034 prototype direct-wire weapon landing

The owner has validated the existing OK Fencing three-pin weapon cable as
compatible with established scoring boxes. That removes only cable selection
as a prototype blocker. It does not identify an OK Fencing socket SKU, board
socket, mating footprint, dimensions, fabrication geometry, or production
release.

For this prototype only, each insulated weapon socket module may use a short
three-conductor pigtail that is soldered directly to named board landing pads.
The executable contract is
[`src/bench-prototype-direct-wire-weapon-landing.ts`](../src/bench-prototype-direct-wire-weapon-landing.ts).
It is a named-net, assembly, and measurement contract. It deliberately gives
no pad diameter, drill, pitch, spacing, copper, mask, courtyard, footprint, or
board-coordinate claim.

| Side | Conductor | Board net | Landing pad | Test landing | Board label |
| --- | --- | --- | --- | --- | --- |
| Left | A | `LEFT_WEAPON_A` | `P_WEAPON_L_A` | `TP_WEAPON_L_A` | `LEFT WEAPON A` |
| Left | B | `LEFT_WEAPON_B` | `P_WEAPON_L_B` | `TP_WEAPON_L_B` | `LEFT WEAPON B` |
| Left | C | `LEFT_WEAPON_C` | `P_WEAPON_L_C` | `TP_WEAPON_L_C` | `LEFT WEAPON C` |
| Right | A | `RIGHT_WEAPON_A` | `P_WEAPON_R_A` | `TP_WEAPON_R_A` | `RIGHT WEAPON A` |
| Right | B | `RIGHT_WEAPON_B` | `P_WEAPON_R_B` | `TP_WEAPON_R_B` | `RIGHT WEAPON B` |
| Right | C | `RIGHT_WEAPON_C` | `P_WEAPON_R_C` | `TP_WEAPON_R_C` | `RIGHT WEAPON C` |

Each landing is a labeled plated-through-hole landing plus a separate labeled
test landing. The three nets go to the existing per-side A/B/C ESD and analog
front-end path. A/B/C are endpoint identities, not a supply polarity. A cable
or pigtail with those identities reversed is a rejected miswire.

There are exactly three conductors per side. `PISTE`, `PISTE_RETURN`, fixture
and ESD returns awaiting review, `SCORING_SGND`, and `APP_GND` are NC at these
landings. No fourth conductor, ground, shield, return, or piste wire may be
attached. This does not change BP-104's seven-channel fixture header or its
separate return policy.

## Assembly and replacement

Remove every power source and discharge the board before soldering, inspecting,
replacing, mating, or measuring a pigtail. Normal apparatus power remains the
unchanged USB-C PD 20 V, 3 A input; weapon pigtails are not a power input.

The pigtail is replaceable by complete de-energized board rework, not by
field-service insertion. A separate clamp or anchor must carry pull and bend
loads. The solder joints and plated holes are electrical connections, not the
load path. Inspect the insulation, printed labels, clamp engagement, and
separation from conductive panel hardware before electrical checks.

## De-energized acceptance screen

For each side, record each exact socket-to-pad-to-test-pad A/B/C path at no
more than 2 Ohm. Zero the same leads at the landing first; the compensated
residual must be no more than 0.2 Ohm. At 5 V, record at least 10 MOhm for the
A/B, A/C, and B/C pairs.

Record rejected results for an open conductor, every A/B/C swap, and a
polarity-orientation reversal. Also inspect and record that no additional
conductor or prohibited net is present. These are project prototype screens,
not socket or cable ratings.

The production replaceable insulated socket module, keyed board-end harness,
and all received-sample, fit, retention, strain-relief, continuity, and
miswire evidence remain open. `fabricationDisposition: DENY` and
`releaseState: deny` remain unchanged.
