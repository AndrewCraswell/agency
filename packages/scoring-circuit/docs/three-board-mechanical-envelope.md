# Three-board mechanical envelope contract

## Status

**DENY.** This is a provisional enclosure-planning contract, not a PCB outline, assembly drawing, tolerance stack, or
fabrication release. The repository does not contain released manufacturer geometry for every connector, a measured
panel drawing, or a production enclosure assembly. The numeric board envelopes below are planning maxima that may
shrink or move after CAD overlay; they must not be copied into Gerbers or enclosure tooling.

The communications boundary and connector connectivity are integrated in the architecture model. The physical
three-PCB layout is not fully complete. The scoring I/O and application/display carrier now have separate six-layer
physical planning models. The communications preview is currently 100 mm by 70 mm and four layers, with no modeled
finished thickness; the planned envelope is 110 mm by 55 mm, four layers, and 0.80 mm finished thickness. The main
preview has been replaced with separate 290 mm by 70 mm and 290 mm by 135 mm six-layer planning models that match the
provisional main-board envelope. The circuit renderer does not emit finished thickness. The complete three-board gate
therefore remains false because the communications preview still disagrees and no exact board outline is released.

The common coordinate system is enclosure view: +X right, +Y down, and +Z from the display rear toward the service
cover. Datum A is a provisional rear-envelope face inferred from the panel's published 318 mm by 158 mm by 15 mm
envelope. It is not a manufacturer support plane or released datum. Datums B and C are the left and top enclosure
walls. Released board drawings must derive connector and hole datums from measured parts and the released chassis,
not from this prose.

## Provisional board volumes

| Board | Planning maximum | Committed thickness | Mounting intent |
| --- | --- | --- | --- |
| Scoring I/O | 290 mm by 70 mm | 1.60 +/- 0.10 mm, six layers | Four provisional M3 chassis standoffs. Body-cord sockets and insertion loads stay on replaceable panel modules. |
| Application/display carrier | 290 mm by 135 mm | 1.60 +/- 0.10 mm, six layers | Four provisional M3 chassis standoffs inside the panel shadow. Chassis metal inserts carry VESA 100 loads without loading the PCB. |
| Replaceable communications module | 110 mm by 55 mm | 0.80 +/- 0.08 mm, four layers | Removable chassis tray with positive fasteners and chassis-supported USB-C/RJ45 mating loads. |

No hole coordinate is released. PCB mounting courtyards must retain at least the project 3.0 mm hole courtyard and
1.0 mm copper keepout after the fabricator's finished-hole and outline tolerances are included. Factory registration
holes are separate from enclosure fasteners and cannot weaken the isolation boundary.

## Connector and service zones

The communications module places Amphenol `10177070-00011LF` USB-C and Wurth `7499011121A` RJ45 on the external
chassis edge, in separate left and right sub-zones. Their mating faces follow manufacturer and chassis drawings.
Reserve USB plug overmold and extraction, RJ45 latch operation and cable boot, shell stakes, shield bonds, ESD entry,
inspection, and hand/tool access. `J_PWR`, `J_CTRL`, and `J_USB2` face the opposite internal service edge so they can be
unlatched after external USB-C power is removed without crossing either external plug path.

On the application carrier, the ESP32-S3-WROOM-1U U.FL launch sits in an RF edge zone nearest the eventual antenna
bulkhead. Preserve the module and connector keepouts, selected coax bend radius, mating-tool access, retention, and an
unobstructed path that does not cross display power or switch-node copper. `J_HUB75`, its two buffers, and keyed panel
V5/GND connector sit on the panel-facing edge nearest the purchased panel's input headers. Signal and power harnesses
take separate supported routes and include enough service slack to remove the panel without pulling solder joints.

The scoring I/O board uses opposed left/right entry zones for passive harnesses to the body-cord modules. Stäubli
XUB-G sockets are never PCB mounted: the panel/chassis carries the socket, plug, M4 rear termination, and insertion
load. Reserve the documented 40 mm rear axial envelope plus ring terminal, locking hardware, tool access, flex, and a
harness anchor within 25 mm of the PCB. The exact enclosure bores remain blocked on the selected mounting drawing,
sample measurement, body-cord fit, and panel-thickness stack.

## Isolation and harness continuity

The scoring board retains the project targets of a 4.0 mm routed slot, 8.0 mm creepage, 4.0 mm clearance, and 4.0 mm
copper keepout. The slot and no-copper region must run continuously between released board-edge exclusions. Only the
named `ISO7762`, `ISO7721`, and `NXE1S0505MC` barrier components may bridge it. No hole, boss, fastener, cable anchor,
test point, coating dam, tooling feature, plane, via, trace, or enclosure metal may shorten or bridge the boundary.
The fabrication drawing must include routed-slot position/width tolerances and prove the minimum finished dimensions,
not just the nominal CAD targets.

Internal mating is de-energized service only: remove USB-C, verify `V20_EFUSE_OUT` is discharged, release the harness
anchors, and then unlatch connectors. Harnesses require drawing-controlled clips, abrasion protection, latch access,
and service slack. Each selected cable must supply a manufacturer static/repeated-flex bend radius or pass a recorded
qualification; this contract does not invent a universal bend radius.

## Evidence required before layout or tooling release

1. Change the communications preview to the reviewed 110 mm by 55 mm envelope, model or otherwise control its 0.80 mm
   thickness, then release exact outlines for all three boards. All three model rectangles are planning envelopes, not
   released drawings.
2. Import revision-controlled manufacturer drawings and STEP models for USB-C, RJ45, ECDP/HSEC8, Micro-Fit,
   HUB75, U.FL/coax, Stäubli sockets, and the purchased panel revision.
3. Measure multiple purchased panels: outline, thickness, mounting holes, rear components, connectors, and cable exits.
4. Release PCB outlines, hole tables, board datums, tolerances, height maps, courtyards, tooling rails, and keepouts for
   all three boards.
5. Release chassis CAD proving VESA load bypass, cutouts, plug/latch travel, service tools, cable routing, bend radii,
   strain relief, module extraction, and mis-mate prevention.
6. Review the routed isolation boundary and minimum finished creepage/clearance against fabricator tolerances.
7. Pass a production-equivalent fit build with panel, boards, connectors, harnesses, coax/antenna, socket modules,
   fasteners, covers, and the complete service sequence.
8. Pass insertion, cable-pull, vibration, drop, repeated replacement, thermal, ESD, and spill-path tests without
   solder-joint loading, connector interference, chafing, or isolation-boundary violation.

The executable contract in `src/mechanical-envelope.ts` reports `deny` while any evidence item is absent and keeps
`fabricationApproved` false even when the checklist is complete. Final release remains a separate reviewed decision.

## Controlled inputs

- `pcb-fabrication-constraints.ts`: three-board topology, layer/thickness contract, board-edge and mounting keepouts,
  isolation targets, grounding zones, high-current interface, and connector-load prohibition.
- `interboard-interface.ts`: exact Micro-Fit and Samtec assemblies, de-energized internal service, chassis isolation,
  and communications-module boundary.
- `hub75-panel-selection.md`: provisional Adafruit 2277 318 mm by 158 mm by 15 mm envelope and missing current drawing.
- `reel-socket-selection.md`: XUB-G family geometry, M4 termination, panel support, and unresolved production CAD/fit.
- `production-board-plan.md`: VESA 100 chassis inserts, replaceable connector modules, factory access, and service goals.
