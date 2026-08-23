# Inter-board interface selection

## Decision

This page is a review-only contract for a future communications-module split. The canonical circuit has not moved
`U_ETHERNET`, `J_ETHERNET_MAGJACK`, USB-PD, or any other component, and it does not yet contain `COMM_3V3`. This page
cannot be cited as PCB, readiness, or fabrication evidence until a separate integration change updates the circuit and
the canonical readiness registers.

The proposed architecture uses three communications-module to application-carrier harnesses:

| Interface | Selected exact orderable items | Signals and power | Boundaries |
| --- | --- | --- | --- |
| `J_PWR` | Molex `43045-0400` header, `43025-0400` receptacle, `43030-0007` female crimp terminal | Two `V20_EFUSE_OUT`, two `GND`, 20 AWG | Post-eFuse 20 V only. No raw USB VBUS, CC, data, shield, or scoring ground. 3 A source input is limited to 1.5 A per contact before derating. No energized mating. |
| `J_USB2` | Samtec `ECDP-08-07.87-L1-L2-1-3` Edge Card twinax assembly and two `HSEC8-113-01-L-DV-A-L2` vertical latch sockets | One 100 ohm twinax pair for USB `D+` and `D-`; cable shield | `07.87` is wire length in inches: nominally 199.9 mm wire and about 217.4 mm overall reference length. Dedicated USB 2.0 path; final Series Prints control pair assignment and geometry. |
| `J_CTRL` | Molex `43045-1200` header, `43025-1200` receptacle, `43030-0007` female crimp terminal | W5500 SPI, chip select, reset, interrupt, communications-module present, and five ground returns | 3.3 V low-speed logic only. No Ethernet MDI or USB. SPI SCK is capped at 10 MHz pending SI release. |

The exact wires, contact-plating option, and harness jacket must be purchased and qualified as one drawing-controlled
assembly. `43030-0007` is the specified contact for the 20 AWG to 24 AWG wire range; production must confirm the final
wire gauge is in the selected terminal's manufacturer range rather than substitute contacts by appearance.
`J_CTRL` uses 24 AWG conductors and is capped at 150 mm. SCK, MOSI, and chip select use 33 ohm carrier-side source
resistors; default pulls are 100 kOhm. These are controlled starting values and remain subject to released-harness SI.

## Ethernet placement

The proposed integration moves `U_ETHERNET` (W5500), line-side protection, and `J_ETHERNET_MAGJACK` together onto the
replaceable communications module. The change is not present in `index.circuit.tsx` today. When implemented, the W5500
MDI pairs must remain short, impedance-controlled routes on that one PCB. They must not cross `J_PWR`, `J_USB2`,
`J_CTRL`, a ribbon cable, or another board connector.

The existing canonical placement therefore remains **DENY** for this three-assembly architecture. The future
communications module must derive `COMM_3V3` locally from post-eFuse 20 V rather than borrow an unallocated 3.3 V
conductor from `J_CTRL`. The regulator selection, footprint, decoupling, power-good, reset sequencing, Ethernet power
integrity, and thermal behavior remain entirely unmodeled and open. The application carrier retains the ESP32 and a
future integration may connect it to W5500 through `J_CTRL` only after the 10 MHz SPI channel passes SI review.

## Pin allocation

`J_PWR` is 1 `V20_EFUSE_OUT`, 2 `GND`, 3 `V20_EFUSE_OUT`, 4 `GND`. Parallel wiring must be equal length and gauge,
and each contact gets a dedicated same-width copper escape. The carrier may only energize after the upstream PD
controller and eFuse have established `V20_EFUSE_OUT`; neither harness nor connector produces a power sequencing
guarantee.

`J_CTRL` is: 1 `GND`, 2 `W5500_SCK`, 3 `GND`, 4 `W5500_MOSI`, 5 `GND`, 6 `W5500_MISO`, 7 `GND`, 8 `W5500_CS_N`,
9 `W5500_INT_N`, 10 `COMM_RESET_ASSERT`, 11 `COMM_PRESENT_N`, 12 `GND`. On the proposed communications module, contact 11
ties to `GND` through 1 kOhm. On the carrier it has a 100 kOhm pull-up to `V3_3`. A low level indicates electrical
mating only; it does not detect latch engagement. It is status-only and cannot enable SPI, release W5500 reset, or
bypass local power-good sequencing by itself.

`COMM_RESET_ASSERT` is active-high and reaches only the gate of a module-local `BSS138AKA`; a 100 kOhm gate pull-down
holds the sink off when the carrier is absent. Its drain joins the local W5500 reset node and its source is module
`GND`. A module-local `TPS389033DSER` also holds that reset node low until `COMM_3V3` is valid. The W5500 reset node can
rise through its 10 kOhm `COMM_3V3` pull-up only when the supervisor releases and `COMM_RESET_ASSERT` is low.

Module-side `SN74LVC2G126DCUR` gates SCK and MOSI, and `SN74LVC1G126DCKR` gates chip select. A second
`SN74LVC2G126DCUR` gates MISO and interrupt. These exact active TI parts specify `IOFF` partial-power-down protection.
Each OE input has a local 100 kOhm pull-down to module `GND`; `COMM_IO_ENABLE` comes only from the
`TPS389033DSER` open-drain reset output with a 10 kOhm `COMM_3V3` pull-up. All buffers therefore remain disabled through
the rail ramp and enable only after supervised release.

W5500 MISO is tri-stated while chip select is high, so its module-side buffer input has a 100 kOhm pull-down to module
`GND`. W5500 `INT_N` is an active-low push-pull digital output, not open-drain. Its carrier-side 100 kOhm pull-up defines
only the disconnected state. Carrier defaults are SCK/MOSI/reset-assert low, chip select high, and MISO pulled down.
These states and the `IOFF` gates prevent an unpowered communications module from being back-powered through control
or status pins.

The `J_USB2` pair map is intentionally controlled by the ordered Samtec Series Print rather than reconstructed from a
generic edge-card drawing. It must use two `HSEC8-113-01-L-DV-A-L2` latch sockets and assign a complete 100 ohm twinax
pair to USB `D+` and `D-`. The selected cable's `07.87` length field is inches, not centimetres or millimetres: it is
199.9 mm nominal wire length and approximately 217.4 mm overall reference length per the family drawing.

## Grounding, shield, ESD, and service

USB-C shell, RJ45 shield, ECDP shield, and communications-side HSEC8 metalwork bond to `CHASSIS` in the connector-entry
zone. Application-side HSEC8 metalwork also bonds to `CHASSIS` through a dedicated chassis contact. `APP_GND` must not
connect to `CHASSIS` through a trace, zero-ohm link, connector latch, cable shield, or mounting hardware. USB reference
continuity comes only through the two `J_PWR` `GND` conductors; the shield is never signal return. The released
mechanical assembly and ESD testing must prove this termination. USB ESD protection remains directly beside USB-C;
Ethernet line protection and magnetics remain on the proposed communications module.

Only external USB-C is a powered attachment point. PD/eFuse hot-plug behavior does not authorize energized mating of
`J_PWR`, `J_CTRL`, or `J_USB2`. Remove external USB-C, verify `V20_EFUSE_OUT` is discharged, and only then disconnect
the internal harnesses. Reverse this order for assembly. Harness tie-downs go within 25 mm of each PCB, and chassis
fasteners take insertion load. No PCB solder joint may be the mechanical retention path.

## Release evidence still required

- Lock manufacturer CAD, exact header, terminal, crimp, housing, keying, board-edge, solder mask, stencil, courtyard,
  retention, and assembled-harness drawings. Nothing in this decision authorizes a generic footprint.
- Receive the configured Samtec Series Prints and prove insertion loss/S-parameters, 100 ohm differential impedance,
  USB 2.0 eye mask, attachment behavior, ESD return path, and radiated/common-mode emissions for the actual PCB stack-up
  and `ECDP-08-07.87-L1-L2-1-3` assembly.
- Measure `J_PWR` voltage drop, parallel current sharing, contact temperature, startup, removal response, and eFuse
  recovery at full display load and 50 C blocked vent. The 3 A round-trip drop limit is 100 mV.
- Perform latching, keying, mis-mate, crimp pull, vibration, mating-cycle, module replacement, and servicing trials in
  the released enclosure. Confirm clearances and creepage for 20 V in the actual cable and board geometry.
- Integrate W5500/MagJack relocation, select and model `COMM_3V3`, and update canonical fabrication/readiness records.
- Model and validate the exact supervisor, reset sink, input/output gates, pulls, source-series resistors, and power-off
  leakage before any signal is connected to an unpowered module.

Logic sources: [TI SN74LVC2G126](https://www.ti.com/lit/ds/symlink/sn74lvc2g126.pdf),
[TI SN74LVC1G126DCKR](https://www.ti.com/product/SN74LVC1G126/part-details/SN74LVC1G126DCKR), and
[TI TPS3890](https://www.ti.com/lit/ds/symlink/tps3890.pdf).

Primary sources: [Samtec selected Edge Card twinax cable](https://www.samtec.com/products/ecdp-08-07.87-l1-l2-1-3),
[Samtec ECDP family print](https://suddendocs.samtec.com/prints/ecdp-xx-xx.xx-xx-xx-x-x-mkt.pdf),
[Samtec Edge Card family](https://www.samtec.com/high-speed-cable/micro-coax-twinax/edge-card/), and
[Molex Micro-Fit 3.0 family](https://www.molex.com/en-us/products/connectors/wire-to-board-connectors/micro-fit-30-connectors).

## Release status

**DENY.** This is only a proposed interface contract. It does not alter the canonical circuit, readiness register, or
fabrication output. W5500/MagJack relocation, `COMM_3V3`, cable Series Prints, mechanical CAD, signal-integrity,
power/thermal, grounding/ESD, and service evidence must all close in later reviewed changes.
