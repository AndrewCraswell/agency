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
| [JLCPCB 6-layer capability](https://jlcpcb.com/resources/6-layer-pcbs), [rigid PCB capability](https://jlcpcb.com/capabilities/pcb-capabilities/), and [copper-weight guide](https://jlcpcb.com/help/article/jlcpcb-copper-weight) | Current rigid capability covers up to 32 layers. Six-layer service includes 1.60 mm, 2 oz outer and 1 oz inner copper, high-Tg options, impedance control, and ENIG. The copper-dependent multilayer 2 oz minimum is published as 0.15/0.15 mm trace/space on the capability page, while the copper guide gives 0.16/0.16 mm. Multilayer 2 oz PTH annular ring is 0.254 mm. The minimum non-plated slot is 1.0 mm with +/-0.2 mm slot-size tolerance. | The 0.254 mm 2 oz annular-ring rule exceeds the current 0.10 mm project rule, and the two official trace/space pages require supplier reconciliation. The published +/-0.16 mm thickness band exceeds the +/-0.10 mm project target. No isolation-slot position tolerance is published. |
| [PCBWay standard capability](https://www.pcbway.com/capabilities.html) and [advanced capability](https://www.pcbway.com/advanced-pcb-capabilities.html) | Six layers are within the standard 1-14 layer range; 1.60 mm; standard +/-10% thickness tolerance and advanced 1.0-2.5 mm +/-7%; 0.15 mm CNC hole; LPI; ENIG; sourced high-Tg options; controlled impedance +/-10%. For conventional 70 um outer copper, the published rule is 7/8 mil trace/space with a 7 mil via ring and 12 mil component ring; medium capability is 6/7 mil with a 6 mil via ring. The minimum non-plated slot is 0.8 mm. | Both conventional and medium 2 oz geometry exceed at least one current 0.15 mm trace/space or 0.10 mm annular-ring project rule. The thickness tolerance is wider than +/-0.10 mm, and no isolation-slot position tolerance is published. The supplier must accept exact geometry, stackup, slot/creepage, coupons, and outline/DFM evidence. |

The model therefore compares both candidates and leaves `vendor: null` in the
current release input. Selecting a vendor requires a recorded decision and a
supplier-reviewed quote/stackup; changing the default to a vendor is not
permitted as an implementation shortcut.

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
