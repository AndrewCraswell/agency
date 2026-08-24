# BP-034 connector samples, mates, and physical-fit evidence

BP-034 is the pre-order evidence contract for the bench board. It is deliberately
fail-closed: it freezes the exact samples to acquire, but it does not claim any
part has been ordered, received, mated, photographed, continuity-tested, or
approved for fabrication.

The executable contract is
[`src/bench-prototype-connector-preorder.ts`](../src/bench-prototype-connector-preorder.ts).

## Required samples

| Interface | Board or cable identity | Required mate or cable |
| --- | --- | --- |
| USB-C normal input | Amphenol `10177070-00011LF` | StarTech.com `USB2CC1M`, 1 m USB-C male-to-male, 60 W (3 A) PD cable |
| Lab injection | One Molex `43045-0400` | One `43025-0400` housing and four `43030-0007` terminals |
| Measurement links | Four Molex `39-28-1023` | Four `39-01-2020` housings and eight `39-00-0039` terminals |
| Weapon fixture | One Molex `43045-1200` | One `43025-1200` housing and seven populated `43030-0007` terminals |
| Weapon test plug | Molex `44242-0005` | `43045-1200` only, de-energized |
| STM32 service | Samtec `FTSH-105-01-L-DV-007-K` | Samtec `FFSD-05-D-06.00-01-N` |
| ESP32 service | Samtec `TSW-106-07-G-S` | Samtec `SSW-106-01-G-S` |
| Ethernet | Würth `7499011121A` | Eaton Tripp Lite series `N201-003-BL`, 0.91 m Cat6 RJ45 male-to-male (8P8C) patch cable |
| HUB75 signal | Samtec `TST-108-04-G-D-RA` | Adafruit `4170` |
| HUB75 panel power | Adafruit `4767` | JST `SMR-04V-N` with `SYM-001T-P0.6`, JST `SMP-04V-NC` with `SHF-001T-0.8BS`, and Adafruit `2277` |

## Cable-selection source evidence

The two immediate cable-identity blockers are resolved only to a source-backed
pre-order selection. Neither selection is a purchase, receipt, mating, fit,
continuity, strain-relief, signal-integrity, EMC, CAD/artwork, or release
approval.

| Interface | Selected MPN | Primary source asset | SHA-256 | Bounded source facts |
| --- | --- | --- | --- | --- |
| USB-C normal input | StarTech.com `USB2CC1M` | [Manufacturer datasheet](evidence/bp-034/startech-usb2cc1m-datasheet.pdf), [source URL](https://media.startech.com/cms/pdfs/usb2cc1m_datasheet.pdf) | `AE5241D2A65A5B64F737D4205FD428B0432567EA98FA1482520AB0D9F345FAE7` | USB-C male-to-male, 60 W (3 A) PD, USB-IF certified. The 60 W rating covers the apparatus's 20 V, 3 A input contract. |
| Ethernet | Eaton Tripp Lite series `N201-003-BL` | [Manufacturer datasheet](evidence/bp-034/eaton-tripp-lite-n201-003-bl-datasheet.pdf), [source URL](https://assets.tripplite.com/product-pdfs/en/n201003bl.pdf) | `BB81E709DFD1E57546379D2962431CD1D1C2445E038E81B053521B6231A14C12` | Cat6, 3 ft. (0.91 m), RJ45 male at both ends, molded integral strain relief. It is the selected physical 8P8C patch mate for `J_ETH`; it does not prove a physical mate. |

Ethernet cable continuity is eight numbered 8P8C conductor paths only. The
MagJack's shield shell is a separate `CHASSIS_ETHERNET` observation; LED,
transformer, and other board pins are not cable conductors and must not be
recorded as such.

## Upstream interface provenance

`benchPrototypeConnectorUpstreamProvenance` is a frozen, identity-only snapshot
for the five contracts that feed BP-034. The accompanying
`validateBenchPrototypeConnectorUpstreamProvenance` function compares the live
contract projections to that snapshot and invokes the upstream validators before
BP-034 can validate its own contract.

| Upstream contract | BP-034 identities bound by the snapshot |
| --- | --- |
| BP-050 | USB-C receptacle and 20 V, 3 A sink contract, lab-injection housing and terminal, all four removable measurement-link housings, terminals, labels, and split nets |
| BP-104 | Weapon-fixture header, mate, terminals, 12-circuit test plug, seven-conductor order, continuity thresholds, and unresolved physical-evidence authority |
| BP-124 | STM32 SWD header and cable, ESP32 service header and socket, exact pin and net identities, and deny-only authority |
| BP-141 | W5500 controller, Würth MagJack, four MDI pairs, Ethernet shield return, no-harness-crossing rule, and deny-only release fields |
| BP-143 | HUB75 header, signal and power cable product identities, JST contact and housing identities, Adafruit panel, display power path, and unresolved authority |

The snapshot imports no physical evidence record and grants no fabrication or
release authority. Physical receipt, mating, fit, retention, strain, continuity,
electrical, thermal, and EMC gates remain open, and every upstream release field
remains `deny` or `DENY`.

Weapon-fixture continuity is delegated, not duplicated: BP-034 calls the exact
BP-104 continuity evaluator for the seven end-to-end, 66 isolation, five
intentional-open, and four negative readings. The BP-104 physical-evidence
evaluator remains authoritative for its fixture drawing, calibration, sample
fit, crimp/retention, strain, and negative-test procedure. BP-034 binds those
two evaluator names as part of its frozen authority snapshot.

## Acceptance record

An accepted evidence record must contain all of the following for every row:

- Receipt identity for the exact full component set: manufacturer, MPN,
  supplier, receipt, lot/date code, and exact quantity. Missing, extra,
  reordered, duplicated, under-counted, or over-counted mate components are
  rejected.
- Exact drawing revision plus immutable drawing and imported-CAD artifact IDs,
  each linked to a SHA-256, with footprint reference, pin-one overlay,
  board-edge/keepout review, and reviewer.
- Immutable SHA-linked photos of the pin-one/key feature and a fully seated mate,
  plus a distinct rejected-mate/reversal artifact. Every mate/unmate is recorded
  `off-and-discharged`, with `forcedMateObserved: false` and an accepted no-force
  mate/unmate result.
- Immutable SHA-linked records for the independent load path, retention method,
  retention load and result, strain method, strain load and result. USB-C and
  Ethernet plug loads may not rely on PCB solder joints alone.
- Typed de-energized, discharged continuity measurements with calibrated
  equipment provenance, pinout/checklist revision, artifact linkage, and the
  exact frozen `from` and `to` endpoint including its net name. A correct pin
  ID paired with a different endpoint is rejected. Each contact path must be
  no more than 2 ohms with no more than 0.2 ohms compensated lead residual;
  polarity, swap, reversal, and intentional-open rejection cases are recorded.

Evidence is accepted only as a dense tree of plain records and plain arrays
with exactly the declared enumerable data keys. Accessors are rejected without
being invoked. Hidden properties, symbols, extra fields, sparse or subclassed
arrays, cycles, and object aliases are rejected. Artifact IDs are exclusive to
one CAD, photo, retention, strain, or test record. The sole permitted reuse is
an explicitly identical calibration-certificate ID and SHA-256 across
measurements made with that same calibrated instrument.
The instrument identity is the exact manufacturer, model, and serial-number
tuple; a shared certificate ID cannot cross to a different tuple even when its
SHA-256 is identical.

The weapon fixture does not use the generic connector measurement shape.
BP-034 invokes the BP-104 evaluator directly and therefore requires its exact
seven end-to-end readings, 66 unique isolation readings, five intentional-open
readings, four negative cases, maximum 2 ohm contact paths, minimum 10 Mohm
isolation at 5 V, and maximum 0.2 ohm compensated lead residual.

The canonical lab connector reference is `J_LAB_INJECTION`. The ESP32 service
record explicitly recognizes `J_ESP_SERVICE` as the physical alias of
`J_ESP32_SERVICE`.

The BP-050 power contract is the authority for every measurement-link split
net. BP-034 binds both pins for all four links, including the distinct
source-side and load-side net names, and rejects a correct pin identifier with
the wrong net.

Passing BP-034 confirms connector identity and physical fit only. It does not
clear the USB-C power, weapon isolation, service recovery, Ethernet electrical,
or display inrush and thermal gates held by BP-050, BP-104, BP-124, BP-141,
and BP-143. The cable choices above leave their own receipt, fit, continuity,
retention, strain, SI/EMC, CAD/artwork, and release gates open.

## Custom OK Fencing weapon panel and short harness

This is separate from BP-104's seven-channel fixture harness. The owner has
validated that the existing OK Fencing three-pin weapon cable is compatible
with established scoring boxes; that accepted compatibility is not a remaining
cable-selection blocker. It does not select, qualify, or release the board-side
hardware.

`benchPrototypeWeaponPanelHarness` defines one custom three-socket panel per
side. The production design remains a replaceable insulated socket module with
a keyed, short connectorized harness, but that connector selection is a later
gate and is not required to close a prototype BP-034 record. Fabrication and
release remain `DENY`/`deny`.

The prototype evidence schema permits exactly two alternatives:

- `direct-carrier-pcb-mount`: record mounting holes and hardware, a separate
  insertion-load path, and proof that electrical solder joints are not the only
  mechanical retention.
- `separate-sockets-to-board-landing-pads`: record dedicated labeled plated
  through-hole and test landing pads for A/B/C, conductor material/gauge and
  insulation, a strain-relief anchor, clearance method, and no exposed shorts.
  Direct soldering to those board landing pads is prototype-only.

Both alternatives require the exact socket identity, A/B/C order, insulation,
rear terminations, de-energized non-forced mate/unmate, and immutable
continuity, isolation, open, swap, and reversal captures. The socket supplier
may be OK Fencing, but a photo, exact SKU or drawing, received sample, and
physical records are still required.

Prototype acceptance requires a separate left and right per-side record through
`evaluateBenchPrototypeWeaponPanelPairEvidence`. The aggregate accepts exactly
one left and one right interface, in that order; it rejects a missing or
duplicate side, duplicate per-side evidence IDs, and any immutable artifact ID
reused between sides. Each side may independently use either allowed prototype
mounting alternative, but both individual evaluators must accept.

The owner supplied two retained [reference photos](evidence/bp-034/owner-weapon-socket-reference-1.jpg)
([second view](evidence/bp-034/owner-weapon-socket-reference-2.jpg)), hash-bound in
the executable contract. They show a feasible construction with three separate
threaded sockets in a transparent insulating carrier and a separately fastened
metal bracket or tang. They are reference-only and non-dimensional: they do not
prove a SKU, spacing, material, rating, final panel geometry, or board-side
connector selection.
