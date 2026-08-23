# PCB fabrication constraints and layout contract

**Status:** design contract and release checklist. The current tscircuit output remains an architectural model and is
not a routed PCB, Gerber release, or fabrication approval.

## Decision

Use the production plan's three physical assemblies:

1. A six-layer, 1.60 +/- 0.10 mm scoring I/O board carries the STM32 scoring authority, isolated scoring supply,
   reference, line acquisition/protection, primary lamps/buzzer control, and passive body-cord-module harnesses.
2. A six-layer, 1.60 +/- 0.10 mm application/display carrier carries the ESP32-S3-WROOM-1U, external-antenna feed,
   V5/V3_3 conversion, W5500, storage, audio, HUB75 buffers, and panel power connector.
3. A four-layer, 0.80 +/- 0.08 mm replaceable communications module carries the selected USB-C receptacle,
   connector-side protection, PD controller, eFuse, integrated-magnetics RJ45, field connector, chassis shield bonds,
   and a qualified carrier interconnect. The 0.80 mm construction is controlled by the selected USB-C footprint.

Use high-Tg FR-4 with 2 oz outer copper and 1 oz inner copper on the two six-layer boards. The communications module
needs its own fabricator-approved four-layer construction and current/thermal proof. Passive socket modules transfer
body-cord insertion loads into the chassis and join the scoring I/O board through keyed harnesses; they are not treated
as a fourth logic PCB. Separate six-layer scoring I/O and application/display physical planning models now represent
the two main envelopes. The legacy combined model remains the logical end-to-end connectivity view, not a fabrication
preview. The communications model, released outlines, connector placement, stack-up, routing, and every other evidence
gate remain denied.

The six-layer choices provide two continuous reference layers, a dedicated power-distribution layer, and enough signal
layers to keep the USB2, Ethernet, isolation, analog, and HUB75 paths from borrowing one another's return paths. The
three planning models match their reviewed width, height, and layer-count contracts; that is not evidence that any
model is routed or fabricated.

The executable contract is in [`src/pcb-fabrication-constraints.ts`](../src/pcb-fabrication-constraints.ts), with
regression coverage in [`src/pcb-fabrication-constraints.test.ts`](../src/pcb-fabrication-constraints.test.ts). The
default result now recognizes three separate planning assemblies and the declared six/six/four layer counts. It remains
denied because finished thickness is a contract datum rather than emitted model evidence, critical footprints are
generic or DNP, the isolation endpoints are not a released connector/slot, and routed/DRC/thermal evidence is absent.

## Proposed manufacturer-neutral stack-ups

### Scoring I/O board

| Layer | Copper | Primary use | Reference requirement |
| --- | ---: | --- | --- |
| L1 | 2 oz | Scoring components, connector entry, analog and short scoring signals | L2 reference wherever possible |
| L2 | 1 oz | SCORING_SGND with isolated APP_GND boundary island | No copper across the approved barrier |
| L3 | 1 oz | S3_3, S5, and scoring-domain power | Keep reference and acquisition returns quiet |
| L4 | 1 oz | Acquisition, scoring digital, and isolated-link escape | L5 reference wherever possible |
| L5 | 1 oz | SCORING_SGND reference | No copper across the approved barrier |
| L6 | 2 oz | Secondary scoring signals and test access | Do not create an uncontrolled return shortcut |

### Application/display carrier

| Layer | Copper | Primary use | Reference requirement |
| --- | ---: | --- | --- |
| L1 | 2 oz | Application components, short signals, and high-current V5/GND copper | L2 reference wherever possible |
| L2 | 1 oz | Continuous APP_GND reference | No split under controlled signals |
| L3 | 1 oz | V5, V3_3, and local power distribution | Keep switch-node area tightly bounded |
| L4 | 1 oz | Controlled signals and peripheral escape | L5 reference wherever possible |
| L5 | 1 oz | Continuous APP_GND reference | Preserve return continuity |
| L6 | 2 oz | Secondary signals, test access, and local high-current copper | Do not create an uncontrolled return shortcut |

### Replaceable communications module

| Layer | Copper | Primary use | Reference requirement |
| --- | ---: | --- | --- |
| L1 | 2 oz | USB-C/RJ45/field connectors, protection, PD/eFuse, and controlled signals | L2 reference wherever possible |
| L2 | 1 oz | Continuous APP_GND with bounded chassis-bond voids | No split under USB2/Ethernet pairs |
| L3 | 1 oz | Negotiated/post-eFuse 20 V power and return | Preserve connector-to-carrier current path |
| L4 | 2 oz | Secondary signals, chassis features, and test access | Keep shield currents outside signal returns |

USB2, Ethernet, and the post-eFuse 20 V/3 A path cross from the communications module to the application carrier.
Their exact board-to-board connector or cable is unselected and therefore an explicit release gate, not an implied
generic header. The connector must maintain both high-speed channels' return geometry while meeting current, voltage,
temperature, insertion-cycle, creepage, polarization, and hot-plug requirements.

The fabricator must solve the actual dielectric thicknesses and impedance geometry. Nominal layer names and copper
weights do not prove a 90 ohm USB2 or 100 ohm Ethernet pair. The released stack-up drawing must include dielectric
thickness, finished copper, etch compensation, solder-mask assumptions, impedance coupon locations, and the fabricator's
controlled-impedance tolerance.

The cross-vendor six-layer DFM floor is intentionally more conservative than
either candidate's minimum. For both JLCPCB and PCBWay, route at least 0.25 mm
trace and 0.25 mm space on both 2 oz outer and 1 oz inner layers; use a 0.30 mm
finished via/PTH hole, 0.30 mm 2 oz via ring, 0.35 mm 2 oz component-hole ring,
0.75 mm plated slots, and 1.5 mm non-plated slots. Keep copper at least
0.30 mm from a routed edge, preserve a 0.25 mm 2 oz soldermask dam/bridge, and
use rounded slots with a 2:1 length-to-width ratio. The dimensional envelopes
are +/-20% trace-width tolerance, +0.13/-0.08 mm finished PTH-hole tolerance,
 +/-0.10 mm hole-position tolerance, and +/-0.20 mm routed-outline tolerance.
These are design floors and maximum allowed process envelopes, not supplier
acceptance. The exact connector drawing, fabricator CAM review, and final
stackup may require larger values.

The source-backed basis is the current [JLCPCB rigid capability page](https://jlcpcb.com/capabilities/pcb-capabilities/)
and the current [PCBWay capability page](https://www.pcbway.com/capabilities.html),
[advanced capability page](https://www.pcbway.com/advanced-pcb-capabilities.html),
and [manufacturing-tolerance page](https://www.pcbway.com/pcb_prototype/PCB_Manufacturing_tolerances.html),
retrieved 2026-08-23. JLCPCB publishes 0.15/0.15 mm multilayer 2 oz trace/space,
0.254 mm 2 oz PTH annular ring, 0.15 mm minimum hole, 0.20 mm routed-edge
clearance, 0.20 mm 2 oz soldermask bridge, 0.35 mm multilayer plated slot,
and 1.0 mm non-plated slot. PCBWay publishes conventional 70 um outer 7/8 mil
trace/space, 7 mil via ring, 12 mil component ring, 0.15 mm CNC/finished hole,
0.30 mm normal CNC profile-to-copper spacing with 0.25 mm as the published
minimum, 5 mil 2 oz soldermask bridge,
0.50 mm plated slot, and 0.80 mm non-plated slot. Both publish CNC outline
tolerance of +/-0.20 mm; their hole-size and hole-position tolerances are
covered by the project envelopes above.

## Functional zoning and placement order

Place by current ownership and return path, not by visual symmetry:

1. Put USB-C, protection, PD controller, and eFuse in the communications-module power-entry subzone. Carry only the
   protected post-eFuse 20 V rail through the qualified carrier interconnect. Put the V5 buck, shunt, and their
   capacitors in the application-carrier power subzone. Each high di/dt loop must be compact and remain outside analog.
2. Put the isolated scoring supply and digital isolators at the scoring-to-application assembly boundary. Keep the
   scoring side and application side ground planes separate on every layer. The physical interconnect may carry only the
   named isolated power/link conductors and must not create an accidental ground or shield bond.
3. Put body-cord and piste protection at the external edge, followed by the unresolved analog acquisition circuitry,
   then the STM32, reference, watchdog, and primary lamp/buzzer drivers. Keep clamp and ADC returns on the scoring island.
4. Put the ESP32-S3-WROOM-1U, W5500, F-RAM, RTC, secure element, and service interfaces in the application zone. This
   module uses an external antenna: place its RF connector for accessible coax mating and strain relief, then qualify
   the selected coax, bulkhead, antenna, enclosure spacing, radiated performance, and coexistence as one assembly.
5. Put AHCT245 buffers beside the HUB75 connector. Put the panel V5/GND branch at the connector edge with a defined,
   keyed harness and a dedicated return conductor. Keep HUB75 clocks and output-enable signals short and away from
   analog inputs.
6. Put RJ45, USB-C, and field connectors on the defined replaceable communications module. Qualify the power, USB2,
   Ethernet PHY, field, chassis, and control interconnect between it and the application carrier. Plug, latch, insertion,
   and cable loads must reach chassis fasteners rather than relying on SMT pads or a generic PCB header.

The legacy 160 mm by 100 mm logical board rectangle is not a physical-board preview, enclosure dimension, mounting-hole
callout, connector panel drawing, or final board outline. The separate physical planning models use only the provisional
290 mm by 70 mm scoring and 290 mm by 135 mm application envelopes; they are not released outlines.

## Grounding, isolation, and ESD contract

- In this contract, `APP_GND` is the application-side `GND` net used by the current circuit model, and `SCORING_SGND`
  is the scoring-side `SGND` net. The names are intentional domain classes; the physical layout must preserve the
  separation rather than silently shorting the two names in a global pour.
- `APP_GND` is the application reference for USB service data, PD/eFuse/V5 power, ESP32, W5500, FRAM, RTC, secure
  element, audio, and HUB75 logic. It must remain continuous under high-speed application signals.
- `SCORING_SGND` is the scoring reference for the STM32, reference, line protection, acquisition, scoring watchdog,
  primary lamps, and the scoring side of the isolated link. It must not be used as a display or Ethernet return.
- The project target around ISO7762, ISO7721, and NXE1S0505MC is a 4.0 mm slot, 4.0 mm clearance, 8.0 mm creepage, and
  4.0 mm copper keepout. These are conservative layout targets for fault containment, not a reinforced-insulation,
  working-voltage, pollution-degree, or standards-compliance claim. The safety assessment and exact package approvals
  control the released values. No plane, via, test pad, or pour may bridge the approved barrier.
- Shielded USB-C, RJ45, and field-interface shells enter a `CHASSIS_OR_ESD_RETURN` region at the communications-module
  edge. The release must choose and document a short, low-inductance chassis bond strategy for those interfaces. ESD
  current must not be routed through `SCORING_SGND`, `APP_GND`, `REF5025`, or an ADC return. A floating shield and an
  undocumented multi-point bond are both release failures.
- Body-cord and piste sockets do not receive chassis-shield credit. Their connector-adjacent clamps and `ESD_RETURN`
  path remain a separate analog fault/EMC gate and must not be silently merged with chassis or either logic ground.
- The USB-C CC/data protector stays connector-side. The VBUS TVS return, shell return, and PD chip-pin surge waveform
  require a pin-level review. A schematic TVS symbol is not credit for a safe PCB return.

## High-speed and high-current routing

### USB 2.0

Route D+ and D- as one 90 ohm differential pair with a +/-10 percent fabricator-controlled tolerance. Keep both traces
on one layer over an uninterrupted `APP_GND` reference, maintain the pair through the connector escape and 22 ohm
series resistors, avoid stubs and plane changes, and keep intra-pair skew inside the fabricator's pair-matching rule.
Do not cross the isolation slot, switch-node keepout, or shield/ESD return. Confirm the Amphenol contact assignment and
0.80 mm carrier geometry from the exact manufacturer drawing. The connector/cable crossing from the communications
module to the application carrier is part of the 90 ohm channel and must be selected, modeled, and TDR-qualified.

### Ethernet

Route W5500 TX/RX PHY pairs as 100 ohm differential pairs with +/-10 percent controlled-impedance tolerance. Keep each
pair over a continuous application reference, avoid vias and stubs where practical, match the pair geometry, and place
the integrated-magnetics RJ45 according to its exact drawing. Do not place the PHY pairs through the HUB75 current return,
under the RF exclusion region, or across a plane split. The RJ45 shield and magnetics return require the same chassis/ESD
review as the USB-C shell. The carrier interconnect between the W5500 and communications-module magnetics is part of
the 100 ohm channel and requires the exact connector/cable loss, return, skew, crosstalk, and TDR evidence.

### HUB75 and V5 branch

The selected panel is an approximately 4 A full-white EVT input. The selected total post-shunt V5 rail is 5.39 A
continuous and 6.09 A during the 100 ms screen, and the upstream eFuse bounds the allowed post-shunt rail at no more
than 8.12 A. Use a keyed locking harness, separate V5 and GND conductors, a connector rated for at least 10 A at the
declared ambient, and chassis strain relief. The 10 A value is connector derating headroom, not an operating or transient
current claim.
Route the V5 trunk and its return as adjacent, wide copper or planes on 2 oz outer copper. Do not route signal traces
between the high-current pair. Validate connector, harness, cable-drop, panel-end voltage, inrush, and temperature on the
assembled system. A ribbon signal connector is not evidence of a safe power connector.

Keep HUB75 data, clock, latch, and OE paths short from the ESP32/AHCT245 region to the panel connector. Use the local
buffer power and blanking network, maintain a defined return directly below the signals, and review edge-rate, ringing,
and simultaneous-switching noise on the exact harness. The 50 ohm local fast-signal target is optional and must not be
claimed unless the fabricator's stack-up solver closes it; otherwise use a short-length and signal-integrity gate.

## RF, thermal, mechanical, and service constraints

- The ESP32-S3-WROOM-1U uses an external antenna. Reserve the module RF connector mating volume and coax bend/strain-
  relief path, select the exact coax, bulkhead, and antenna, and validate insertion loss, connector retention, enclosure
  detuning, radiation, coexistence, ESD, and regulatory configuration. Do not apply an onboard PCB-antenna keepout to
  this module or claim RF closure from its footprint alone.
- Keep TPS25730, TPS259474, TPS56A37, their capacitors, inductor, and shunt in a compact power cluster. Use the exact
  manufacturer thermal-pad and via/paste pattern; no generic QFN/VQFN pattern receives fabrication credit. Keep the SW
  node no closer than 2.0 mm to quiet analog copper and never route it under an antenna.
- Validate all power parts, the USB-C connector, shunt, inductor, and HUB75 harness at 50 C ambient with blocked vents,
  full-white panel, maximum audio, Ethernet traffic, radio traffic, and continuous scoring. The 0.85 efficiency and 60 W
  input numbers are allocations, not thermal proof. Require at least the product derating margin below the exact part
  rating and record the measured copper, connector, and panel-end temperatures.
- Reserve chassis fastener and mounting-hole courtyards before placement. Keep copper at least 1.0 mm from finished
  mounting holes and components at least 3.0 mm from the hole courtyard. Do not finalize enclosure dimensions here.
- Expose labeled top-side test pads with at least 2.0 mm probe keepout for the PD/eFuse/V5 rails, both grounds, both
  processor resets, USB2, and HUB75 OE. Do not hide factory-critical pads under modules, panel connectors, or shields.
- Every exact footprint must include manufacturer courtyard, paste, mask, pin-1/polarity, shell stake, and board-edge
  geometry. Generic footprints are denied even if a 3D body renders correctly.

## Fabrication release checklist

The board remains **DENY** until each item has a dated artifact and independent review:

- [ ] Three physical assemblies are released: scoring I/O board, application/display carrier, and communications module.
- [ ] Both six-layer 1.60 +/- 0.10 mm boards and the four-layer 0.80 +/- 0.08 mm communications module have signed fabricator stack-ups.
- [ ] Power, isolation, reset, scoring, display, USB2, Ethernet, field, chassis, and service ownership is reviewed at every assembly boundary.
- [ ] Exact board-to-board/cable interconnects are selected; USB2 and Ethernet channel impedance, return, skew, crosstalk, and loss are qualified.
- [ ] Exact manufacturer land patterns are imported for all selected critical parts; all current DNP/generic gates are closed.
- [ ] Board outline, mounting holes, connector panel cutouts, chassis supports, cable bend radii, and assembly keepouts are released.
- [ ] Safety review accepts or revises the project's 4.0 mm slot/clearance and 8.0 mm creepage targets; released barriers are present on every copper layer.
- [ ] `APP_GND`, `SCORING_SGND`, and chassis/ESD return are reviewed as distinct return systems with no forbidden crossings.
- [ ] USB2 90 ohm and Ethernet 100 ohm pairs are solved by the fabricator and verified on coupons or equivalent TDR evidence.
- [ ] V5 harness carries 5.39 A continuous and 6.09 A short-screen load within the hard 8.12 A bound; the 10 A-rated connector, adjacent return, panel-end voltage, inrush, and cable drop are tested.
- [ ] HUB75 signal integrity, blanking, simultaneous switching, and high-current return are measured with the exact panel harness.
- [ ] WROOM-1U RF connector, selected coax/bulkhead, external antenna, chassis geometry, detuning, coexistence, and regulatory configuration are qualified.
- [ ] Thermal test passes at 50 C blocked vents for power parts, connector, shunt, inductor, panel harness, and panel end.
- [ ] ERC, DRC, creepage, courtyard, drill, annular ring, paste, and assembly-rule checks are clean.
- [ ] Factory test-point access is verified with the real probe and fixture; SWD, reset, power, USB2, and ground points are labeled.
- [ ] Independent mixed-signal, power-integrity, EMC, and manufacturing reviews sign the release package.

Passing this contract still does not waive the unresolved analog front end, FIE compatibility review, safety assessment,
EMC testing, or the selected-panel EVT and inrush gates. It defines what the routed design must prove before fabrication;
it does not claim that those proofs exist today.
