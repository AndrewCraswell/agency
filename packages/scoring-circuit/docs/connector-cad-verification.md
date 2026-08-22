# Connector CAD and footprint verification

**Task:** M4-11

**Evidence date:** 2026-08-22

**Scope:** selected Ethernet, USB-C service, and 24 V power connectors only.

## Evidence status

This is a drawing-source audit, not physical verification. No manufacturer CAD
file, footprint library, or sample has been downloaded, imported, or reviewed
against a board or enclosure model in this task. Therefore none of the facts
below verifies a released footprint, module outline, panel fit, fastener
engagement, cable load path, or service reach. Those gates remain open.

Only manufacturer-owned pages, drawings, and downloads are cited. Dimensions
are in mm unless stated otherwise. A blank numeric field is intentionally not a
guess: it means the official source exists but its drawing geometry has not yet
been transcribed from a downloaded and model-reviewed file.

## Selected connector audit

### Würth Elektronik 7499011121A, 10/100 RJ45 with integrated magnetics

- **Mounting:** board-mounted through-hole RJ45, not a panel-only connector.
  The manufacturer drawing shows the PCB behind a panel cutout. The enclosure
  still needs a chassis-supported bezel or module so insertion load does not
  rely on solder joints.
- **Envelope and panel interface:** drawing values are 16.0 wide, 21.25 deep,
  and 13.5 high; it also calls out 10.89 and a 3.5 plus or minus 0.5 panel/PCB
  relationship. The recommended panel cutout is 16.76 wide by 14.13 high,
  with the drawing also calling out 0.25 and 2.03 at the panel/PCB interface.
  The drawing does not define a surrounding enclosure clearance keepout;
  M4-12 must reserve connector, plug, harness, and fastener clearance from a
  reviewed STEP assembly rather than inventing one.
- **Exact recommended PCB holes:** 8 x diameter 0.9, 4 x diameter 1.03,
  2 x diameter 1.6, and 2 x diameter 3.25. The same drawing supplies the
  coordinate pattern and a plus or minus 0.10 tolerance unless otherwise
  defined. The 8 signal contacts are not the whole footprint: the drawing also
  contains four LED contacts and two large shell-tab holes.
- **Shield and retention:** brass shield, 50 microinch nickel plating. Treat
  the two diameter-3.25 holes as the drawing's shell-tab features during
  footprint review; do not omit them or substitute them with header pins. The
  package is rated for 750 mating cycles. It is 100BASE-TX, non-PoE in this
  selected part's datasheet, with yellow/green LEDs and a -40 to +85 C
  operating range.
- **Official design data:** [datasheet and recommended hole/panel drawings](https://www.we-online.com/components/products/datasheet/7499011121A.pdf),
  [STEP](https://www.we-online.com/components/products/download/7499011121A%20%28rev1%29.stp),
  [IGES](https://www.we-online.com/components/products/download/7499011121A%20%28rev1%29.igs),
  and the manufacturer [KiCad EDA library](https://www.we-online.com/components/products/download/KiCad_WE-RJ45LAN%20%28rev26b%29.zip).
  Availability is verified from the manufacturer catalog; imported/reviewed
  status is **open**.

### Amphenol Communications Solutions 10177070-00011LF, USB-C receptacle

- **Mounting:** right-angle, surface-mount, 16-position USB 2.0 receptacle;
  the official product page specifies a 0.80 PCB thickness. It is a
  board-mounted connector, not a panel receptacle. The communications module
  must provide the panel opening and an independent cable-load path.
- **Envelope, footprint, and keepout:** the official two-page product drawing
  is available at the link below, but its body outline, contact-pad locations,
  shell-stake locations, paste apertures, and plug/enclosure keepout have not
  been transcribed from a downloaded drawing or an imported STEP model. They
  are **not verified** and must not be copied from a generic USB-C footprint.
  The only accepted numeric board constraint at this stage is the stated
  0.80 PCB thickness.
- **Shell and retention:** the official page specifies `Shield: Yes`, SMT
  termination, and IR reflow. The exact number and geometry of shell/stake
  pads must be taken from the product drawing during import review. The part is
  rated 20,000 mating cycles, 5 A, 20 V, 500 V AC dielectric withstand, and
  -40 to +105 C. This high cycle rating is not evidence that the panel, module,
  or internal harness has equivalent endurance.
- **Official design data:** [product page](https://www.amphenol-cs.com/product/1017707000011lf.html),
  [product drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf),
  [manufacturer 3D-model ZIP](https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip),
  and [USB-C product specification](https://cdn.amphenol-cs.com/media/wysiwyg/files/documentation/gs-12-1351.pdf).
  Amphenol lists the drawing and STP model, but notes that login is required to
  download the 3D model. CAD and footprint availability are therefore
  manufacturer-confirmed, while acquisition and review are **open**.

### Neutrik NC4MD-LX, locking power inlet

- **Mounting:** four-pole male, D-shape chassis receptacle with solder cups.
  It is panel-mounted and must be wired to an internal keyed harness; it has no
  PCB footprint. The manufacturer describes an all-metal housing, latch lock,
  duplex ground contact between chassis and mating cable connector, and an
  optional connection from pin 1 to chassis ground.
- **Panel, fasteners, and keepout:** the official dimensional PDF, DXF, and
  STEP are available below, but the D-cutout contour, mounting-hole diameter
  and spacing, rear depth, fastener type, and tool clearance have not been
  measured from a downloaded/model-reviewed source. They remain **open**.
  Do not substitute a generic three-position header or assume M3 threads: M3
  threaded holes are specified for the separate `NC4MD-LX-M3` variant, not for
  the selected `NC4MD-LX` page.
- **Ratings:** 10 A per contact, rated voltage below 50 V, contact resistance
  at most 5 milliohm, dielectric strength 1.5 kVdc, more than 1,000 mating
  cycles, and latch locking. Maximum wire size is 1.5 mm2 (16 AWG); operating
  range is -30 to +80 C; protection class is IP40. The selected 24 V use fits
  the stated voltage limit but does not close the product's supply-temperature,
  miswiring, bonding, or access gates.
- **Official design data:** [product page](https://www.neutrik.com/en/product/nc4md-lx),
  [dimensional data sheet](https://www.neutrik.com/media/8420/download/nc4md-lx-2.pdf?v=1),
  [DXF](https://www.neutrik.com/media/11869/download/nc4md-lx-3.dxf?v=1),
  and [STEP](https://www.neutrik.com/media/12908/download/3-D%20NC4MD-LX.stp?v=2).
  These files are manufacturer-published and available; their import and
  enclosure review are **open**.

## Current manifest and circuit-model comparison

The source-of-truth readiness register is
[`src/part-readiness.ts`](../src/part-readiness.ts). It correctly leaves every
selected connector unapproved, but the M4-11 source audit exposes the following
gaps that M4-14 must reconcile rather than masking them with a generic model.

| Reference | Current representation | Required selected-part representation | Status |
| --- | --- | --- | --- |
| `J_ETHERNET_MAGJACK` | Generic eight-pin `pinheader` with logical TX, RX, LED, shield, and chassis labels | 7499011121A THT footprint: eight signal holes, four LED holes, two additional diameter-1.6 features, and two diameter-3.25 shell-tab holes, plus panel cutout | **Mismatch.** The header cannot represent the manufacturer hole pattern, LED pins, or shell tabs. |
| `J_USB_C` | Generic `connector` with `standard="usb_c"`; no selected MPN footprint or shell geometry | 10177070-00011LF right-angle SMT footprint, its exact contact pads, all shield/stake pads, and 0.80 board-thickness constraint | **Mismatch.** A generic USB-C symbol/shape is not its footprint or retention strategy. |
| `J_POWER_24V` | Generic three-pin `pinheader` with `V24_IN`, `GND`, and `CHASSIS` | NC4MD-LX four-pole D-size, panel-mounted solder-cup connector and keyed internal harness; shell/duplex ground treated as a mechanical and bonding interface | **Mismatch.** Three PCB pins cannot model four power contacts, D-panel cutout, latch, fasteners, or chassis shell. |

The readiness manifest labels the RJ45 and USB-C CAD as `pending`; that remains
accurate because no file was imported or independently reviewed. It labels the
power inlet CAD and footprint `not-applicable`, which is only correct for PCB
placement. It is **not** correct for M4-11 mechanical CAD: the selected
NC4MD-LX has official STEP and DXF files that must be used for the chassis,
cutout, fastener, harness, and service review.

## Verification checklist and open gates

- [ ] Download the exact selected-part source files above, record URL, file
  revision/date, checksum, and acquisition date under immutable evidence.
- [ ] Import the Würth recommended hole pattern and its exact STEP; review
  all 16 holes/features, board edge, panel cutout, LED clearance, shell tabs,
  chassis/ESD connection, magnetics return strategy, and mating-plug envelope.
- [ ] Obtain the Amphenol drawing and STP through the manufacturer access path;
  compare every signal, shell/stake, paste, and board-edge feature against the
  actual 10177070-00011LF footprint. Check the 0.80 board requirement against
  the selected communications-module stack-up.
- [ ] Import the Neutrik DXF and STEP; measure selected-variant cutout,
  fastener, rear-depth, latch, mating-cable, tool, bend-radius, and service
  clearances. Select and document actual fasteners; do not inherit M3 hardware
  from the `-M3` variant.
- [ ] Build an enclosure/module assembly that transfers RJ45 and USB-C plug
  loads to chassis supports and verifies that the NC4MD-LX panel fasteners,
  not solder cups or internal harness conductors, carry insertion/cable load.
- [ ] Perform sample plug-fit, repeated insertion, cable-pull, harness
  bend/strain-relief, and module-replacement trials before production approval.
- [ ] Review the four-pole power pinout, keying, pin-1/chassis option, shell
  bonding, fault current, temperature rise, and service-safe disconnect
  sequence with M4-13.

**M4-11 disposition:** documentation evidence identifies the exact selected
parts and manufacturer design sources, but CAD import, footprint comparison,
physical plug fit, chassis strain relief, and service access are still open.
No connector is fabrication-approved or physically verified by this document.
