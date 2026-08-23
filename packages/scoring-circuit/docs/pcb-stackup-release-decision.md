# Six-layer PCB stack-up and outline release decision

Status: **DENY for fabrication**. This package is a release gate for the
`SCORING_IO_BOARD` and `APPLICATION_DISPLAY_CARRIER` only. It does not select a
fabricator, create a PCB file, approve a quotation, or authorize fabrication.

## Release target

Both production boards require a supplier-solved six-copper-layer, finished
1.60 mm board. The planning copper order is:

| Layer | Finished copper | Planning role |
| --- | ---: | --- |
| L1 | 2 oz | Components, connector entry, short signals, and high-current copper |
| L2 | 1 oz | Continuous domain-local reference plane |
| L3 | 1 oz | Power distribution and low-current planes |
| L4 | 1 oz | Controlled signals, digital escape, and service access |
| L5 | 1 oz | Continuous domain-local reference plane |
| L6 | 2 oz | Secondary signals, test access, and local high-current copper |

The release record must name the exact laminate and glass/resin system, lot
traceability, minimum Tg of 155 C, finished thickness and tolerance, finished
copper weights, soldermask process and registration limits, and surface finish.
The current design target is high-Tg FR-4, 1.60 +/- 0.10 mm, LPI soldermask,
and ENIG on connector/contact geometry. The fabricator must solve dielectric
thicknesses and confirm that the solver uses the actual finished copper and
soldermask stack.

The following must be present for each board before release:

- a revisioned outline drawing with datum targets and profile tolerance;
- mounting-hole table, board-edge keepouts, component-height zones, tooling
  and panelization plan;
- connector-coordinate table tied to the released chassis and harness drawing;
- a supplier-solved stackup with every dielectric thickness, material, Tg,
  copper weight, and impedance geometry;
- field-solver output and measurable coupons for 90 ohm USB2, 100 ohm
  Ethernet, and any 50 ohm fast single-ended class;
- minimum trace/space, via drill, finished annular ring, hole tolerance,
  soldermask sliver/dam, paste, and registration limits;
- the 4.0 mm isolation slot, 8.0 mm creepage, 4.0 mm clearance, and 4.0 mm
  copper keepout after slot width and slot-position tolerance are included;
- current and thermal evidence for the 5.39 A continuous V5 branch, 6.09 A
  short-screen branch, and 8.12 A hard eFuse bound, including vias, connector,
  harness, plane temperature rise, and the 50 C blocked-vent test;
- supplier DFM acceptance, deviations, inspection method, impedance reports,
  thickness report, and objective acceptance criteria.

The communications module remains a separate 4-layer, 0.8 mm product and is
not silently changed by this six-layer release package.

## Vendor capability comparison

These are capability candidates, not a recommendation. Values were checked
against primary manufacturer pages on 2026-08-23 and are encoded in
`src/pcb-stackup-release.ts` so the decision is testable.

| Candidate | Useful published capability | Release gap that prevents silent selection |
| --- | --- | --- |
| [JLCPCB 6-layer capability](https://jlcpcb.com/resources/6-layer-pcbs) and [current rigid PCB capability](https://jlcpcb.com/capabilities/pcb-capabilities/) | Current rigid capability covers up to 32 layers, six-layer 1.60 mm, 2 oz outer and 1 oz inner copper, LPI, ENIG, and controlled impedance. For the relevant multilayer 2 oz class it publishes 0.15/0.15 mm trace/space, 0.254 mm PTH annular ring, 0.15 mm minimum finished/drill hole, 0.20 mm routed-edge copper clearance, 0.20 mm 2 oz soldermask bridge, 0.35 mm plated slot, 1.0 mm non-plated slot, and +/-0.2 mm non-plated slot-size tolerance. It publishes +/-0.13/-0.08 mm through-hole size, +/-0.05 mm hole position, and +/-0.2 mm regular routed-outline tolerance. | The cross-vendor project floor is intentionally larger than each minimum. JLCPCB still does not publish a positional tolerance for the routed isolation slot, and its published +/-10% 1.60 mm thickness band is wider than the project +/-0.10 mm target. The exact dielectric build and impedance coupon remain open. |
| [PCBWay standard capability](https://www.pcbway.com/capabilities.html), [advanced capability](https://www.pcbway.com/advanced-pcb-capabilities.html), and [manufacturing tolerances](https://www.pcbway.com/pcb_prototype/PCB_Manufacturing_tolerances.html) | Six layers are within the standard 1-14 layer range; 1.60 mm, 2 oz outer and 1 oz inner copper, LPI, ENIG, and controlled impedance are published. For 70 um outer copper, the conventional rule is 7/8 mil trace/space, 7 mil via ring, and 12 mil component ring; the standard tolerance page also publishes 0.15 mm 2 oz trace/space. It publishes 0.15 mm minimum CNC/finished hole, +/-0.08 mm PTH hole size, +/-0.075 mm hole position, 0.30 mm normal CNC profile-to-copper spacing with 0.25 mm as the published minimum, 5 mil 2 oz soldermask bridge, 0.5 mm plated slot, 0.8 mm non-plated slot, and +/-0.2 mm CNC outline tolerance. | The cross-vendor project floor is intentionally larger than each minimum. PCBWay does not publish a positional tolerance for the routed isolation slot or a slot-specific width tolerance. Its standard +/-10% 1.60 mm thickness band is wider than the project +/-0.10 mm target. The exact dielectric build and impedance coupon remain open. |

### Cross-vendor geometry contract

The following floors are the geometry allowed in either six-layer 1.60 mm
board. They are project rules, not claims that a vendor has accepted the
routed design. The values are deliberately above the published minima where a
larger rule improves yield or avoids a narrow process class.

| Rule | JLCPCB published reference | PCBWay published reference | Project floor or envelope |
| --- | --- | --- | ---: |
| 2 oz outer trace and space | 0.15 / 0.15 mm multilayer | 7 / 8 mil conventional 70 um outer | 0.25 / 0.25 mm |
| 1 oz inner trace and space | 0.09 / 0.09 mm multilayer | 5 / 6 mil conventional 35 um inner | 0.25 / 0.25 mm |
| Finished via/PTH hole | 0.15 mm minimum | 0.15 mm minimum | 0.30 mm minimum |
| 2 oz via annular ring | 0.254 mm | 7 mil conventional | 0.30 mm minimum |
| 2 oz component-hole ring | 0.254 mm PTH rule | 12 mil conventional | 0.35 mm minimum |
| Plated slot width | 0.35 mm multilayer | 0.50 mm | 0.75 mm minimum |
| Non-plated slot width | 1.0 mm | 0.8 mm, machine slot above 1.0 mm | 1.5 mm minimum |
| Copper to routed edge | 0.20 mm | 0.30 mm normal CNC profile rule; 0.25 mm published minimum | 0.30 mm minimum |
| 2 oz soldermask dam/bridge | 0.20 mm | 5 mil | 0.25 mm minimum |
| Trace-width tolerance | +/-20% | +/-20% normal-width class | +/-20% maximum |
| Finished PTH-hole tolerance | +0.13 / -0.08 mm | +/-0.08 mm | +0.13 / -0.08 mm maximum |
| Hole-position tolerance | +/-0.05 mm | +/-0.075 mm | +/-0.10 mm maximum |
| Routed board-outline tolerance | +/-0.2 mm regular CNC | +/-0.2 mm CNC | +/-0.2 mm maximum |

All slots use rounded ends and a length-to-width ratio of at least 2:1. A
rectangular slot without rounded corners is not accepted by the JLCPCB
capability page. The 4.0 mm project isolation slot therefore exceeds both
published non-plated-slot widths, but its positional tolerance is still an
open supplier gate. `geometryFit` is true only when every row above is
source-backed by both candidates; it does not select a vendor or authorize
fabrication.

The model therefore compares both candidates, reports cross-vendor
`geometryFit: true`, and leaves `vendor: null` in the current release input.
Selecting a vendor requires a recorded decision and a supplier-reviewed
quote/stackup; changing the default to a vendor is not permitted as an
implementation shortcut.

The 4.0 mm isolation slot is wider than both published minimum slot widths.
That width check is separate from slot location: neither candidate publishes a
specific positional tolerance for the routed isolation slot, so the creepage
stack remains open until the selected supplier supplies and accepts one.

## Board-specific physical evidence

The current planning envelopes are 290 x 70 x 1.60 mm for the scoring I/O
board and 290 x 135 x 1.60 mm for the application/display carrier. These are
planning maxima, not released outlines. A release revision must resolve:

- measured board outline and profile tolerance relative to chassis datum A/B/C;
- M3 mounting-hole coordinates, finished hole size/tolerance, copper and
  courtyard keepouts, and load-bypass evidence;
- USB2, Ethernet/field, scoring harness, isolated-boundary, HUB75, V5/GND,
  RF/coax, and service connector coordinates;
- connector plug/latch travel, cable bend radius, strain relief, panel access,
  and enclosure cutout tolerance;
- the slot path, slot tooling method, edge exits, and the worst-case creepage
  calculation after all manufacturing tolerances.

## Decision function and verification

`evaluateStackupRelease` is deliberately fail-closed. It returns `deny` until
the vendor, vendor-solved stackup, supplier review, both board outline records,
and the isolation tolerance are explicit. It always returns
`fabricationApproved: false`; the final authorization remains a human
engineering and supplier decision after routed Gerbers/ODB++, drill, drawing,
and inspection evidence exist.

Run the focused package tests with:

```text
pnpm --filter @repo/scoring-circuit test -- pcb-stackup-release.test.ts
pnpm --filter @repo/scoring-circuit check:types
pnpm --filter @repo/scoring-circuit lint
pnpm exec oxfmt --check packages/scoring-circuit/src/pcb-stackup-release.ts packages/scoring-circuit/src/pcb-stackup-release.test.ts
```

This package does not claim that a vendor is selected, that the stackup is
solved, or that either board is ready to send to fabrication.
