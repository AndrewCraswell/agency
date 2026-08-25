# Connector CAD and footprint verification

**Task:** M4-11

**Evidence date:** 2026-08-22

**Scope:** selected Ethernet and USB-C PD power/service connectors only.

The manufacturer product pages and primary downloads were rechecked on
2026-08-23. No source-access or CAD-import status changed; the dated hashes
below remain the acquired-file record.

## 2026-08-24 source reconciliation

The later M4-11 executable audit retained the Würth `7499011121A` datasheet
with SHA-256
`05B718A55907F45D2388BEA0EBEAADB60C7C93CE2C4C5CA582637936E890E350`
and STEP rev1 with SHA-256
`A4968DA8AC85C413990CD4F1F20600BFDB07F30005A4503DA7484651E38C386C`.
These bytes establish source identity only; they still grant no project import,
overlay, enclosure, or fabrication approval.

USB-C PD through Amphenol `10177070-00011LF` remains the sole normal external
apparatus power input and USB 2.0 service port, with a planned 20 V, 3 A request.
Molex `43045-0400` (`J_PWR_CARRIER`) is only the locking internal carrier-power
harness header; its exact mate is `43025-0400` with `43030-0007` female crimp
terminals. Manufacturer product and drawing records identified those parts, but
the M4-11 snapshot did not retain the Molex downloads and granted no harness,
crimp-tooling, strain-relief, bend-radius, or fit credit. Later BP-033 USB-C
footprint evidence is governed by the canonical prototype backlog and does not
retroactively turn this source audit into physical approval.

## Evidence status

This is a drawing-source audit, not physical verification. The exact Würth
STEP file was acquired and identity-checked on the evidence date. It was not
imported into a board
or enclosure assembly, and no manufacturer footprint library or sample was
reviewed. Amphenol's drawing and 3D download remained access-controlled from
this review environment. Therefore none of the facts below verifies a released
footprint, module outline, panel fit, fastener engagement, cable load path, or
service reach. Those gates remain open.

Only manufacturer-owned pages, drawings, and downloads are cited. Dimensions
are in mm unless stated otherwise. A blank numeric field is intentionally not a
guess: it means the official source exists but its drawing geometry has not yet
been transcribed from a downloaded and model-reviewed file.

## Acquired source record

The following SHA-256 values identify the exact manufacturer files retrieved
on 2026-08-22. The files are deliberately not vendored: the source URL remains
the manufacturer-controlled record, and a later import must compare its hash
before using it. A successful download proves file identity only. It is not a
CAD-overlay, footprint, or enclosure approval.

| Selected part | Manufacturer source | SHA-256 | Result |
| --- | --- | --- | --- |
| Würth 7499011121A | [STEP, rev1](https://www.we-online.com/components/products/download/7499011121A%20%28rev1%29.stp) | `44143609DA5D63A01551C85B343134BA5F027136C04CEBEFEA9ABA05AE6AFCD1` | File identifies `7499011121A`; not imported. |
| Würth 7499011121A | [datasheet](https://www.we-online.com/components/products/datasheet/7499011121A.pdf) | `05B718A55907F45D2388BEA0EBEAADB60C7C93CE2C4C5CA582637936E890E350` | Drawing revision 2023-07-11; not overlaid. |
| Amphenol 10177070-00011LF | [drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf) | Not acquired: manufacturer CDN returned HTTP 403. | **DENY.** No checksum or import evidence. |

The Würth drawing's product identifier and recommended-hole drawing were
inspected. The current
tscircuit model contains no imported source geometry to compare with them, so
that inspection can only establish the mismatch described below.

## Supply and lifecycle gate

No purchase-time lifecycle or supply approval was produced by this task. The
static `active` labels in `src/component-decisions.ts` are a research snapshot,
not confirmation of factory allocation, authorized distribution stock, lead
time, last-time-buy status, or an approved alternate. In particular, the Würth
datasheet directs customers to verify availability with its sales channel at
design-in and before ordering. The Amphenol 403 response also prevents treating
a public product page as a deliverable CAD source. M4-14 must retain both
connectors as non-production-approved until a dated authorized-source and
PCN/PTN review is recorded with the approved manufacturing BOM.

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

## Current manifest and circuit-model comparison

The source-of-truth readiness register is
[`src/part-readiness.ts`](../src/part-readiness.ts). It correctly leaves every
selected connector unapproved, but the M4-11 source audit exposes the following
gaps that M4-14 must reconcile rather than masking them with a generic model.
Its `physical` records now carry the manufacturer-published contact, cycle,
shield, and retention claims without turning those claims into product
qualification. `panel-chassis` is used for the XUB-G sockets;
`pcb-with-chassis-support` is used for the RJ45 and USB-C board parts. Every
external-panel record carries physical evidence. Current records retain
non-empty `openGates`; a reviewed record may clear them only with its other
CAD, footprint, mechanical, and blocker gates closed. The validator rejects
production approval while any physical gate remains open.

| Reference | Current representation | Required selected-part representation | Status |
| --- | --- | --- | --- |
| `J_ETHERNET_MAGJACK` | Generic eight-pin `pinheader` with logical TX, RX, LED, shield, and chassis labels | 7499011121A THT footprint: eight signal holes, four LED holes, two additional diameter-1.6 features, and two diameter-3.25 shell-tab holes, plus panel cutout | **Mismatch.** The header cannot represent the manufacturer hole pattern, LED pins, or shell tabs. |
| `J_USB_C` | Generic `connector` with `standard="usb_c"`; no selected MPN footprint or shell geometry | 10177070-00011LF right-angle SMT footprint, its exact contact pads, all shield/stake pads, and 0.80 board-thickness constraint | **Mismatch.** A generic USB-C symbol/shape is not its footprint or retention strategy. |

The two reel references share one family candidate but have exact bench suffixes
in the readiness record: `J_L` samples `66.9684-22` (red), and `J_R` samples
`66.9684-25` (green). These are sample suffixes, not a production BOM choice;
Stäubli's family evidence does not publish a socket contact-resistance or cycle
rating, and body-cord plug fit plus the independent chassis retainer remain
project gates.

The readiness manifest labels all connector CAD records as `pending`.
That remains accurate: acquired source files have not been imported or
independently reviewed, and the Amphenol sources could not be acquired in this
environment. USB-C is the sole input and its selected Amphenol footprint,
shell stakes, chassis load path, and cable thermal behavior remain open.

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
- [ ] Build an enclosure/module assembly that transfers RJ45 and USB-C plug
  loads to chassis supports rather than PCB solder joints.
- [ ] Perform sample plug-fit, repeated insertion, cable-pull, harness
  bend/strain-relief, and module-replacement trials before production approval.
- [ ] Review USB-C PD shell bonding, 20 V/3 A input current, connector
  temperature rise, cable identification, fault current, and service-safe
  disconnect sequence with M4-13.

**M4-11 disposition: DENY fabrication readiness.** Documentation evidence
identifies the exact selected parts and manufacturer design sources, but CAD
import, footprint comparison, physical plug fit, chassis strain relief, supply
approval, lifecycle confirmation, and service access are still open. No
connector is fabrication-approved or physically verified by this document.
