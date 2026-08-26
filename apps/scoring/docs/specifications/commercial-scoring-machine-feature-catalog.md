# Commercial scoring-machine feature catalog

**Evidence snapshot:** 2026-08-25  
**Compared products:** Favero FA-15, FA-07, FULL-ARM-05, Virtual Scoring Machine, and Skewered Fencing scoring box

This catalog decomposes the capabilities found in the preserved [manual corpus](manuals/) into stable feature IDs. It
is a product-capability comparison, not an FIE-conformance table. Use the
[FIE traceability matrix](fie-traceability-matrix.md) and
[weapon-scoring programming specification](weapon-scoring-programming-specification.md) for normative scoring
requirements.

## Evidence legend

- ✅ - documented or advertised by the manufacturer.
- ❌ - not found in the reviewed documents. This does not prove that the product cannot do it.
- ➖ - outside the product's stated purpose.

Every product cell is deliberately binary: a documented or advertised capability is `✅`, regardless of whether the
claim comes from a manual or product page. Details and provenance belong in the source locator map and manual corpus,
not in the coverage cells.

## 1. Scoring authority and weapon modes

| ID | Granular capability | FA-15 | FA-07 | FULL-ARM-05 | VSM | Skewered |
| --- | --- | --- | --- | --- | --- | --- |
| `SC-001` | Wired foil scoring | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-002` | Wired epee scoring | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-003` | Wired sabre scoring | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-006` | Foil hit qualification | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-007` | Foil second-hit/lockout window | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-008` | Epee hit qualification | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-009` | Epee second-hit/lockout window | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-010` | Sabre hit qualification | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-011` | Sabre second-hit/lockout window | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-012` | Sabre whipover rejection | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-013` | Foil valid/off-target distinction | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-014` | Grounded-piste rejection | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-015` | Own-weapon/guard suppression | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-016` | Open-circuit/fencer-disconnected handling | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-017` | Automatic rearm after a touch | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SC-018` | Manual rearm | ✅ | ✅ | ✅ | ❌ | ✅ |
| `SC-019` | Multiple timing standards | ❌ | ❌ | ✅ | ✅ | ✅ |
| `SC-020` | Non-standard timing is conspicuously identified | ✅ | ✅ | ✅ | ✅ | ✅ |

## 2. Training and alternate operating modes

| ID | Granular capability | FA-15 | FA-07 | FULL-ARM-05 | VSM | Skewered |
| --- | --- | --- | --- | --- | --- | --- |
| `TR-001` | Rapid-hit epee training mode | ✅ | ✅ | ✅ | ❌ | ❌ |
| `TR-002` | Automatic epee score increment | ✅ | ✅ | ✅ | ✅ | ✅ |
| `TR-003` | Manual epee score mode | ✅ | ✅ | ✅ | ✅ | ✅ |
| `TR-006` | Self-referee clock start | ❌ | ❌ | ❌ | ✅ | ✅ |
| `TR-007` | Fencer-operated score donation | ❌ | ❌ | ❌ | ✅ | ✅ |
| `TR-008` | Alternate league timing preset | ❌ | ❌ | ❌ | ❌ | ✅ |
| `TR-009` | User-defined per-weapon lockout | ❌ | ❌ | ❌ | ✅ | ✅ |

## 3. Bout, score, clock, and referee workflow

| ID | Granular capability | FA-15 | FA-07 | FULL-ARM-05 | VSM | Skewered |
| --- | --- | --- | --- | --- | --- | --- |
| `BT-001` | Two-sided score display/control | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-002` | Score increment and decrement | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-003` | Bout clock start/stop | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-004` | Configurable initial bout time | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-005` | One-minute break | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-006` | One-minute extra time | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-007` | Subsecond display in final 10 seconds | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-008` | Match/period counter | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-009` | Random priority assignment | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-010` | Manual priority assignment/removal | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-011` | Yellow-card state | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-012` | Red-card state with opponent point | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-013` | P-card/passivity-card workflow | ✅ | ✅ | ❌ | ✅ | ✅ |
| `BT-014` | Passivity elapsed-time indicator | ✅ | ✅ | ❌ | ✅ | ✅ |
| `BT-015` | Passivity expiry stops clock and blocks touches | ✅ | ✅ | ❌ | ✅ | ✅ |
| `BT-016` | Medical-break/intervention workflow | ✅ | ✅ | ❌ | ✅ | ✅ |
| `BT-017` | Fencer status: abandon/exclusion/victory/defeat | ❌ | ✅ | ❌ | ❌ | ❌ |
| `BT-018` | Team reserve-fencer state | ❌ | ✅ | ❌ | ❌ | ❌ |
| `BT-019` | Swap left/right scores or fencers | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BT-020` | Undo recent operator actions | ✅ | ❌ | ❌ | ✅ | ✅ |
| `BT-021` | Block destructive controls while clock runs | ✅ | ✅ | ❌ | ✅ | ✅ |
| `BT-022` | Clear/new-bout workflow | ✅ | ✅ | ✅ | ✅ | ✅ |

## 4. Display, sound, and diagnostic feedback

| ID | Granular capability | FA-15 | FA-07 | FULL-ARM-05 | VSM | Skewered |
| --- | --- | --- | --- | --- | --- | --- |
| `UI-001` | Red/green valid-hit lights | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-002` | White off-target lights | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-003` | Ground/fault indicators | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-004` | Graphical strip-event timeline | ❌ | ❌ | ❌ | ❌ | ✅ |
| `UI-005` | Freeze timeline on touch | ❌ | ❌ | ❌ | ❌ | ✅ |
| `UI-006` | Review and scroll prior touch timeline | ❌ | ❌ | ❌ | ✅ | ✅ |
| `UI-007` | Show parry/blade contact | ❌ | ❌ | ❌ | ✅ | ✅ |
| `UI-008` | Show late, whipover, and too-short contacts | ❌ | ❌ | ❌ | ✅ | ✅ |
| `UI-009` | Show second-touch delta from first | ❌ | ❌ | ❌ | ✅ | ✅ |
| `UI-010` | Display rotation | ❌ | ✅ | ❌ | ❌ | ✅ |
| `UI-011` | Adjustable sound volume | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-013` | Distinct end/start/control sounds | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-014` | Local lamp/display self-test | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-015` | Weapon-line short/fault visualization | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-016` | Firmware/version visible to operator | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UI-017` | Remote battery status on apparatus | ✅ | ✅ | ✅ | ❌ | ✅ |

## 5. Remote control, networking, repeaters, and integration

| ID | Granular capability | FA-15 | FA-07 | FULL-ARM-05 | VSM | Skewered |
| --- | --- | --- | --- | --- | --- | --- |
| `IO-001` | Dedicated handheld referee remote | ✅ | ✅ | ✅ | ✅ | ✅ |
| `IO-002` | Remote-to-box association/isolation | ✅ | ✅ | ✅ | ✅ | ✅ |
| `IO-003` | Referee remote usable beyond 20 m | ✅ | ❌ | ❌ | ❌ | ❌ |
| `IO-004` | Phone/tablet remote control | ✅ | ❌ | ❌ | ✅ | ✅ |
| `IO-005` | Read-only wireless state broadcast | ✅ | ❌ | ❌ | ✅ | ✅ |
| `IO-006` | Authenticated/paired wireless control | ✅ | ➖ | ✅ | ✅ | ✅ |
| `IO-007` | Multiple simultaneous wireless clients | ✅ | ❌ | ❌ | ✅ | ✅ |
| `IO-008` | Wired hit-light repeater output | ✅ | ✅ | ✅ | ✅ | ✅ |
| `IO-009` | Wireless scoring-box repeater | ✅ | ❌ | ❌ | ✅ | ✅ |
| `IO-010` | RS422-FPA output | ❌ | ✅ | ❌ | ✅ | ✅ |
| `IO-011` | Cyrano competition integration | ❌ | ✅ | ❌ | ❌ | ❌ |
| `IO-012` | Ethernet/LAN management | ❌ | ✅ | ❌ | ✅ | ❌ |
| `IO-013` | Fencer name/country on finals display | ❌ | ✅ | ❌ | ✅ | ❌ |
| `IO-014` | Video replay integration signal | ❌ | ❌ | ❌ | ✅ | ✅ |
| `IO-015` | Scoring remains independent of wireless link | ✅ | ✅ | ✅ | ✅ | ✅ |
| `IO-016` | Recover stuck wireless subsystem without rebooting scoring | ❌ | ❌ | ❌ | ❌ | ✅ |

## 6. Update, service, power, and mechanical capabilities

| ID | Granular capability | FA-15 | FA-07 | FULL-ARM-05 | VSM | Skewered |
| --- | --- | --- | --- | --- | --- | --- |
| `SV-001` | Field firmware update | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SV-002` | Recovery firmware-update entry | ✅ | ✅ | ✅ | ❌ | ✅ |
| `SV-003` | Published release/change history | ❌ | ❌ | ✅ | ✅ | ✅ |
| `SV-004` | Local serial number and firmware display | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SV-005` | Mains operation | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SV-006` | External battery operation | ✅ | ✅ | ✅ | ✅ | ❌ |
| `SV-007` | Documented battery endurance | ✅ | ✅ | ✅ | ❌ | ✅ |
| `SV-008` | Low-battery indication | ✅ | ✅ | ✅ | ❌ | ✅ |
| `SV-009` | Table-top installation | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SV-010` | Wall installation | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SV-012` | Transport case | ✅ | ✅ | ✅ | ❌ | ❌ |
| `SV-013` | Drop-resistance claim | ✅ | ❌ | ❌ | ❌ | ❌ |
| `SV-014` | Isolated weapon circuit | ✅ | ✅ | ✅ | ❌ | ❌ |
| `SV-015` | Documented safety, disposal, and service constraints | ✅ | ✅ | ✅ | ❌ | ✅ |

## 7. Repeater and companion-display feature set

The repeater manuals add capabilities that should be treated as downstream presentation, never as scoring authority:

| ID | Capability | Documented | Evidence |
| --- | --- | --- | --- |
| `RP-001` | Repeat red, green, and both white hit lights at long distance | ✅ | Lights Repeater manual, English pp. 3-4 |
| `RP-002` | Cascade/branch multiple repeaters | ✅ | FA-07 manual pp. 14-15; FULL-ARM manuals; Lights Repeater manual |
| `RP-003` | Large finals display of score, clock, match, cards, priority, fencer identity, and nationality | ✅ | FR240 manual, English pp. 2, 8-9 |
| `RP-004` | RS422-FPA input and regenerated output | ✅ | FR240 manual, English pp. 8-9 |
| `RP-005` | Receive fencer names/countries through the FA-07 Cyrano path | ✅ | FR240 manual, English p. 9 |
| `RP-006` | Standalone computer injection of fencer identity where Cyrano is unavailable | ✅ | FR240 manual, English p. 9 |
| `RP-007` | Repeater LED self-test and missing-data indication | ✅ | FR240 manual, English p. 9 |

## Source locator map

The most frequently used source locations are:

| Source | Relevant locations |
| --- | --- |
| FA-15 user manual | English pp. 5-11 for product, panel, remote, clock, score, cards, passivity, priority, and app; pp. 12-17 for installation, pairing, master/slave, wired and wireless repeaters |
| FA-15 T2016 specifications | English p. 1 for protected program identity and all three weapon timing ranges |
| FA-07 user manual | pp. 3-8 for power, displays, weapon modes, score/clock/referee workflow and remote; pp. 9-10 for programming/self-tests; pp. 11-15 for LAN, central competition, serial ports, and repeaters |
| FA-07 T2016 technical information | English p. 1 for program identity and weapon timing ranges |
| FULL-ARM-05 user manual | English pp. 4-7 for power, modes, score, clock, cards, priority, remote, tests, disconnect suppression, and repeaters |
| FULL-ARM-05 software versions | English p. 1 for T2016 final-clock precision, sabre, epee auto-count, remote selection, and one-minute extra-time changes |
| VSM program manual, Release J5 | pp. 17-23 for scoring display, diagnostics, self-start, auto-score, and controls; pp. 30-44 for timing identity, bout workflow, replay, team mode, sound, repeaters, parameters, hardware timing, and diagnostics |
| VSM product page | Custom remote, USB repeater, Tournament version, and current product claims; reviewed 2026-08-25 |
| Skewered quick-start guide | p. 1 for physical controls, timeline, remote, score, clock, cards, priority, review, and undo |
| Skewered HTML manual | `Configuration Menu`, `Remote`, `Bluetooth`, `Updating the scoring machine firmware`, and `Firmware releases`, snapshot 2026-08-25 |

## Product-level conclusions

1. The Favero range separates product tiers. FULL-ARM-05 provides conventional scoring and bout workflow, FA-07 adds
   competition networking and extensive configuration, and FA-15 combines a compact apparatus, app control, and wired
   or wireless downstream repeater modes.
2. VSM provides the broadest software-defined workflow in this comparison: editable weapon parameters with visible
   non-standard status, self-start and fencer scoring, event replay, team mode, extensive remote choices, scalable
   displays, repeaters, and tournament/video integrations. These are manufacturer claims, not evidence of current FIE
   homologation.
3. Skewered exposes unusually deep observability and recoverability: event timelines, review, late/short contact
   annotations, undo, local configuration, explicit non-FIE-mode warnings, Bluetooth role separation, and update
   recovery. These are strong product requirements but do not replace electrical or FIE validation.
4. No reviewed public manual fully specifies the internal analog front end, resistance thresholds,
   or a complete executable conformance suite. Those remain bench-measurement and project-verification work.
5. Manufacturer workflows and convenience modes must remain downstream of the deterministic weapon-scoring authority.
   A remote, app, repeater, or protocol receiver may edit bout state but must not create or reclassify a physical hit.
