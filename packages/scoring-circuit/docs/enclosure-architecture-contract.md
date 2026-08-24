# M4-12 enclosure architecture and board-envelope contract

**Disposition:** planning-only and fabrication denied.

The existing three-board mechanical model records provisional board envelopes,
coordinate datums, connector service zones, the VESA load-bypass rule, and a
de-energized service order. This M4-12 contract makes the remaining backlog
acceptance areas explicit without turning a planning rectangle or prose
assumption into an enclosure drawing.

## Current planning inputs

- Three physical planning models remain: scoring I/O, application/display
  carrier, and replaceable communications module.
- The published `318 mm` by `158 mm` by `15 mm` panel envelope is retained as
  a planning reference only. It is not a selected enclosure, support plane, or
  tolerance datum.
- VESA 100 metal inserts belong to the chassis. The PCB and its solder joints
  must not carry VESA or connector insertion loads.
- USB-C PD remains the sole external apparatus power input. The internal
  locking carrier-power connector is not an external inlet.

## Acceptance map

| M4-12 area | Current state | Required closure evidence |
| --- | --- | --- |
| Board outlines and keepouts | Planning rectangles only; no released outlines, holes, datums, or height maps | Dimensioned outlines, hole tables, datums, tolerances, height maps, courtyards, tooling rails, and keepouts |
| VESA mounting | Rule recorded; no released chassis | Dimensioned chassis load path proving metal inserts bypass every PCB |
| Antenna clearance | Unverified; no numeric clearance claimed | Exact antenna, coax, module keepout, enclosure material, bend radius, and detuning overlay |
| Encrypted-IR optical window and field of view | Unverified; field-of-view and pointing values intentionally null | Receiver/emitter identities, window material and aperture, FOV, pointing tolerance, venue-light and display/PWM interference evidence |
| Airflow and thermal assumptions | Not established; no vent or fan model is released | Component-height map, blocked-vent assumptions, thermal model, ambient range, and measured enclosure temperature rise |
| Display and speaker | Planning references only | Purchased-part measurements, mounting, rear volume, acoustic opening, cable exits, retention, and service access |
| Connector modules | Service zones are planned; exact cutouts and overlays are absent | Checksummed manufacturer CAD/drawings, cutouts, shell support, latch travel, tool access, and chassis load paths |
| Harness bend radii | Generic radius is explicitly prohibited | Manufacturer static and repeated-flex radii or documented qualification, clips, abrasion protection, and strain relief |
| Service sequence fit | De-energized order is recorded; fit is unverified | Installed sequence demonstration with boards, panel, cover, connectors, anchors, tools, and cable slack |

The executable record is `src/enclosure-architecture.ts`. Its current evidence
record has only `planningModelsRecorded` true. Every physical and release gate
remains false, and the evaluator cannot authorize fabrication even when a
future complete evidence record is supplied. The evaluator's
`evidence-complete` status means only that all listed evidence booleans are
true; `fabricationApproved` remains permanently false and a root mechanical
review is still required.

## Required next handoff

1. Select and measure the production-intent enclosure and purchased display.
2. Obtain and checksum exact connector, antenna, coax, panel, and fastener
   drawings or CAD through authorized manufacturer sources.
3. Build the dimensioned assembly with board datums, cutouts, clearances,
   heights, cable paths, VESA inserts, and service tooling.
4. Add thermal, optical, harness, fit, service, and environmental evidence.
5. Have the root reviewer independently compare the assembly and evidence
   against M4-10, M4-11, M4-12, and the dependent M4-13 harness contract.

No physical fit, enclosure, thermal, optical, or fabrication approval is
claimed by this contract.
