# Standalone scoring box

Open `standalone-scoring-box.kicad_pro` in KiCad 10. This is the separate **HUB75 standalone product**, not the
[virtual scoring box](../virtual-scoring-box/README.md) and not an overwrite of the
[frozen combined board](../usb-scoring-platform/README.md).

## Current checkpoint

The native schematic, placement and PCB routing are implemented. The four-layer, 1.6mm board provisionally retains the
combined board's **165 x 100mm** outline. There are **206 footprints: 199 purchased parts, three bare wire terminations
and four unplated mounting holes**. The combined design had 223 purchased parts; the reduction is 24 parts, not a priced
cost saving.

**This is a routed engineering checkpoint, not an order-ready board.** Changed circuits have new routing; unchanged
local circuits were reused only with matching pad positions and net assignments. Insulation and antenna keepouts remain.
The power desk review and factory programming procedure are supplied in [power-handoff.md](power-handoff.md). Physical
power qualification and manufacturing review below are still required. CAD checks do not establish electrical
performance or FIE approval.

KiCad 10.0.6 verification on **2026-09-13**: **0 ERC violations, 0 DRC violations, 0 unconnected items and 0
schematic/PCB mismatches** under the project's enabled rules. Both checks were run with failure-on-violation enabled.
The initial placement had 499 unconnected items. Final routing cleanup simplified 36 signal runs from 148 segments to
72, in addition to removing obsolete copper ends; no component or required signal was removed.

The native 3D preview is generated in `output/board-top-3d.png`; copper-layer views are in `output/layers/`. J13's exact
Ethernet model reference remains unavailable in the installed library. Its footprint and reserved connector area are
present; do not treat the empty 3D area as free space. U20 now uses the retained authentic TI package model. Shared
component models are referenced without duplicate copies.

## Product and connections

- **STM32G474RET6** performs acquisition and scoring. **ESP32-S3-WROOM-1-N8R8** handles the display, wireless network
  and IR application. Share the C17 scoring core and application source with the virtual box; use board-specific
  pin/power/transport configuration, not necessarily identical firmware binaries.
- **J3/J4:** left/right ABC solder-wire pads on opposite edges. **J5:** bottom-edge piste solder-wire pad. All connect
  to external banana sockets through soldered wires; these PCB pads are not the external sockets. The owner's Ok Fencing
  cable compatibility remains accepted. Piste is a scoring reference, not protective earth.
- **J7/J8:** HUB75 signal and separate 5V power for one Waveshare RGB-Matrix-P5-64x32, SKU 25848, 1/16-scan display. The
  panel and harnesses are external to this PCB assembly. Keep the inherited FM6127 initialization and unused E-line
  handling in the display adapter.
- **J13 / W5500:** CETUS J1B1211CCD Ethernet with integrated magnetics for network functions including Cyrano.
- **J9/J10:** two TE 5520250-2 Favero FA-05 DATA repeater connectors. These are not Ethernet or RS-422 ports.
- **U13 / BZ1:** TSOP38438 38kHz IR receiver for the shared remote and PS1240P02BT sounder.
- **J2/J6:** STM32 SWD and ESP32 UART programming/recovery. Updates retain the shared product approach.
- **J1:** a single GCT USB4105-GF-A **power-only USB-C** input, requiring a charger offering fixed 20V at 3A. USB data
  pins and the old STM32 USB/presence pins are explicitly unconnected. There is no laptop USB data mode.

USB-C is on the left edge beside its controller. Ethernet remains on the bottom edge and the two Favero ports on the top
edge, retaining the combined board's connector geometry. The ESP32 antenna projects beyond the top edge. This prototype
is a bare-board build with no enclosure; enclosure design or fit approval is not an ordering prerequisite. Secure and
insulate external wiring for bench use.

### Mounting and Ethernet fit

H1-H4 are 3.2mm unplated mounting holes, with a 6.5mm-diameter copper-free area on all four layers. Use **M3 nylon
screws and insulating standoffs, with heads/washers no larger than 6mm**. The offset fourth mounting point avoids the
radio antenna and connector circuitry. No existing signal track or component was moved. These holes are not purchased
assembly parts, and do not imply an enclosure or hardware kit is included.

Mounting centers measured from the board's lower-left corner, looking down from the component side:

| Hole | X (mm, right) | Y (mm, up) |
| ---- | ------------- | ---------- |
| H1   | 4             | 96         |
| H2   | 4             | 4          |
| H3   | 160           | 3.5        |
| H4   | 137           | 55         |

J13 was compared visually and numerically with pages 2-3 of the
[Cetus J1B1211CCD drawing retained by WIZnet](https://www.wiznet.hk/en/index.php?controller=attachment&id_attachment=2).
Its eight 0.9mm signal holes, four 1.02mm LED holes, two 1.6mm shield holes and two 3.25mm locating holes match the
drawing. The nominal body is 16 x 21.3 x 13.35mm; its front extends 1.1mm beyond the bottom board edge, with the
locating feet still on the board. The adjacent R105 lies outside the body. This is a footprint/body-envelope check, not
a physical mating test. No authentic STEP model was available from the checked library/provider; do not substitute a
different jack merely to fill the preview. Its missing model alone does not prevent assembling the specified part.

## Routing organization

- **Top copper:** components, compact local circuitry and most short signal connections. Both crystal circuits and the
  Ethernet differential pairs remain entirely on this surface, without signal vias in those critical paths.
- **First inner layer:** ground only, with no routed signal or supply traces. Charger-side `USB_GND` and scoring `GND`
  remain separate. The Ethernet magnetics keepout remains clear of planes.
- **Second inner layer:** supply regions and selected signal connections. `PANEL_5V` has a continuous dedicated copper
  corridor, with 6mm-wide main straight sections, connecting U6 to both J8 supply pins. Crossing signals were rerouted
  outside this corridor; it does not depend on thin signal-width bridges. Thermal spokes are 0.8mm.
- **Bottom copper:** organized signal runs with ground fill. Primary VBUS distribution uses a wide, separate copper
  region and parallel input vias. The ESP32 has a direct 0.8mm top-layer supply feed from the buck output, with its
  local bypass capacitors close to the module.

The project-local ESP32 edge-mount footprint changes only the off-board silk artwork; its pads, antenna keepout and
model geometry remain those of the KiCad footprint. Signal routing was shortened and unnecessary jogs and dead ends
removed without moving connector pads or changing the schematic's electrical connections.

The layout was informed by the relevant
[Espressif placement and ground guidance](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/pcb-layout-design.html)
and [WIZnet Ethernet guidance](https://docs.wiznet.io/Design-Guide/hardware_design_guide). Copper geometry is not a
measured current rating or impedance certification: the fabricator's actual stackup, temperature rise, connector losses
and panel startup load still belong to the power/manufacturing review.

Ethernet transmit copper measures 30.2676mm per leg. Receive copper, including both sides of coupling capacitors
C52/C53, measures 31.7467mm and 31.5467mm, a 0.20mm difference. These paths exceed WIZnet's preferred 25mm length but
remain below its 75mm limit; they are not a claim of an optimal layout or verified 100-ohm impedance.

The saved dielectric/copper stack matches the published [JLC04161H-7628 stackup](https://jlcpcb.com/impedance): 0.2104mm
outer prepreg, 1.065mm core, 0.035mm outer copper and 0.0152mm inner copper. Select that construction in the quote. An
independent first-order screen on 2026-09-13 uses the
[TI edge-coupled microstrip equations, Figure 9-4](https://www.ti.com/lit/ds/symlink/sn65mlvd203b.pdf):
`Z0 = 87/sqrt(Er+1.41) * ln(5.98*H/(0.8*W+T))` and `Zdiff = 2*Z0*(1-0.48*exp(-0.96*S/H))`. With H=0.2104mm, W=0.25mm,
T=0.035mm, edge gap S=0.25mm and Er=4.4, the result is **60.56 ohms single-ended / 102.54 ohms differential**. Keep the
existing pair geometry; it is within the nominal 90-110 ohm target window. This is an analytical screen, not a
field-solver or manufacturing qualification: solder mask, copper etch/plating, dielectric tolerance, pad escapes and
connector transitions are not included.

On 2026-09-13 the [JLCPCB calculator](https://jlcpcb.com/pcb-impedance-calculator) successfully returned widths for the
same four-layer, 1.6mm, 1oz outer/0.5oz inner construction, L1 signals referenced to L2, and a 100-ohm target:

| Calculator model, with solder mask | Pair edge spacing | Adjacent ground clearance | Calculated width |
| ---------------------------------- | ----------------: | ------------------------: | ---------------: |
| Non-coplanar differential pair     |          0.2499mm |                      none |         0.2545mm |
| Coplanar differential pair         |          0.2499mm |                  0.2499mm |         0.2418mm |

Spacing/clearance inputs were 0.25mm; the table records the calculator's displayed rounded values. The board's main
traces are 0.25mm wide and its ground zones use 0.25mm clearance. This is a nominal design cross-check, not an impedance
measurement: local 0.20mm neck-downs, changing coupling and pad/connector transitions still need the production review.
No copper was changed to chase the calculator's last decimal. Obtain the fabricator's approval of the actual routing
against **100 ohms differential, +/-10%**, and its coupon/test result before manufacturing acceptance. The calculator
result does not count as that factory response. The precise request is in
[power-handoff.md](power-handoff.md#factory-confirmation-request).

## Simpler standalone power

U5 **STUSB4500QTR** negotiates the charger contract. U20 **TPS259470LRPWR** protects and gates the input to U6
**REC30K-2405SZ**, which produces isolated 5V for the display and secondary regulators. AP2112K supplies the acquisition
3.3V rail; AP63203 supplies application 3.3V. Their sequencing translators remain because these are separate rails.

The standalone board removes LTM2884 isolated laptop USB, LTC3130 laptop supply, their support, the dual-supply OR
diodes, and the STM32C011 source-mode controller. U22 **TPS70933DBVR** and two capacitors provide the small primary-side
3.3V supply for status and I2C pull-ups. EN is intentionally open using its internal pull-up, not tied to raw VBUS.

The desk-reviewed load allocation is **26.4W**, with a 45C commissioning target and 50C full-load local-ambient ceiling
around U6. C45 is now 1nF C0G: the nominal eFuse output ramp is about 10ms rather than 100ms. This same-footprint change
reduces startup overlap without adding components. The [power handoff](power-handoff.md) records assumptions, tolerance
calculations, limits and measurements still needed.

**Factory configuration is still required.** Program and read back U5 through primary-domain J12 with exactly two sink
PDOs: 5V/0.5A, then fixed 20V/3A, and the listed status settings. `prepare-power-profile.py` prepares those settings
from an actual 40-byte NVM readback while preserving unrelated bits. The procedure and offline byte tests are supplied;
no real device readback, factory-qualified image or hardware programming result is available yet.

Q4/Q5 retain both active-low `POWER_OK2` and `VBUS_EN_SNK` qualification. Together they inhibit U20 until the requested
PDO2 contract is accepted and remove its enable on detach. This uses the controller's documented standalone behavior,
not USB enumeration, bus silence, or an inference that a connected device must be a wall charger. The eFuse's separate
voltage window remains a further check. USB_GND must remain isolated from scoring GND, including programming equipment.

Source references: [STUSB4500 status and NVM behavior](https://www.st.com/resource/en/datasheet/stusb4500.pdf),
[TPS709 input and EN limits](https://www.ti.com/lit/ds/symlink/tps709.pdf), and
[TPS25947 protection behavior](https://www.ti.com/lit/ds/symlink/tps25947.pdf).

## Manufacturing review files

Run `./export-manufacturing.ps1` from this directory. It checks ERC, DRC, connectivity and schematic parity, then
creates this design's BOM, matching SMT/THT placements, Gerbers/drills, assembly drawing and native 3D preview in a new
`output/manufacturing-*` directory. J3/J4/J5 are bare solder pads and are excluded from purchased-part lists. The
package includes the U5 programming procedure and offline profile helper, not a guessed NVM binary or the removed
source-mode MCU firmware. Supplier catalog matches must be checked afresh. Nothing is uploaded automatically.

The reviewed export contains 199 BOM rows, 199 matching placements and 13 Gerber/drill files. Their common origin is the
board's lower-left corner. The assembly drawing includes the custom connector and power-part references; these added
fabrication-layer labels do not change the visible silkscreen, component positions or copper.

The four offline power-profile tests pass (`python -B test_power_profile.py`). The manufacturing-handoff `pnpm verify`
run passed format/lint/types/knip, then reported 968 scoring tests passed and one 5-second timeout in
`observatory-integration.test.ts`. That file passed all three tests on a focused rerun without changing its timeout or
source. The preceding coverage run was also below the existing 100% gate: statements 95.44%, branches 93.78%, functions
99.79% and lines 96.09%. No thresholds were lowered. These are separate from the native board/export checks;
repository-wide verification is not clean.

Use **default green solder mask** for the prototype order as requested. Both the CAD stackup and order handoff use
green; Gerbers describe mask openings, not pigment. Confirm the actual supplier option before ordering.

### Current JLCPCB draft

The separate [standalone assembly draft](https://cart.jlcpcb.com/smt-order/?pcbFileNo=35c0fdd6e3324e1b85591293ca0d5e9c)
was configured on 2026-09-12 and its revised BOM/placements verified on **2026-09-13**. The existing virtual-board draft
remains untouched. Nothing was submitted, paid for or sent to support.

- Four layers, 165 x 100mm, 1.6mm, TG155, green mask, white silk, ENIG, 1oz outer/0.5oz inner copper and
  **JLC04161H-7628** construction. The 0.2mm-via option adds four-wire testing. Impedance control is selected at +/-10%,
  but this does not qualify the finished board's impedance; the nominal analytical screen is recorded above.
- **Five fabricated PCBs and two top-side Standard assemblies**, the site's minimum assembly quantity. Temporary 5mm
  rails make the quoted panel 165 x 110mm; factory rail removal is selected. The finished PCB outline is unchanged.
- Production-file and component-placement confirmation are enabled, with **automatic confirmation disabled**. Customer
  parts selection is retained. Functional-test review includes the U5 procedure/helper; this is not confirmation that
  JLCPCB can perform the required NVM programming. The assembly drawing and no-omissions instructions are attached.
- Uploaded bundle: `output/manufacturing-20260912-154354/pcb-fabrication.zip`, SHA256
  `7387D2A76A82E2785578438EF19FFCEA299DF2A01581D353D708A00965DFA252`. Updated BOM and placement files from
  `output/manufacturing-20260913-011725/` were subsequently uploaded; both contain 199 references. Sourcing changes did
  not move components, change pads/drills/nets, or alter routed copper.
- The assembly draft has **195 selected references with exact requested MPNs**, two shortage references (J9/J10, four TE
  connectors required across the two assemblies), and two unmatched references (J8/U6). Exact Global Sourcing offers for
  all four references are now identified below; they are not yet purchased or available in private inventory. J1 was
  explicitly reselected after upload left its quantity at zero; it now has quantity two and is selected.
- The preliminary **$128.67** is fabrication/options for five PCBs with rails, **not** assembled-board cost. Components,
  assembly, programming, shipping and tax are not a finished quote.

### Reviewed sourcing changes

The native schematic/PCB now specify stocked ordering numbers for **30 previously unresolved references**, plus J1's
exact USB connector match. Ratings, capacitance/resistance values, pinouts, footprints and copper are unchanged. The
exporter includes the native `LCSC` field as `LCSC Part #`; an empty field means no reviewed catalog ID, not an
instruction to omit the part. Always check the resulting supplier match, especially on a fresh upload.

| References                          | Selected MPN            | JLCPCB ID |
| ----------------------------------- | ----------------------- | --------- |
| C1, C2, C3, C15, C21, C33, C37, C38 | YAGEO CC0603KRX7R9BB105 | C559769   |
| C5, C22, C28                        | TDK C1608X5R1C106MT000N | C342854   |
| C12, C54, C55                       | YAGEO CC0603KRX7R9BB103 | C100042   |
| C14                                 | TDK C1608X7S1A475KT000E | C342959   |
| C17, C18                            | YAGEO CC0603JRNPO9BN270 | C107045   |
| C36, C73                            | YAGEO CC0805KKX7R9BB105 | C91185    |
| C45                                 | YAGEO CC0603JRNPO9BN102 | C106246   |
| C46                                 | YAGEO CC0805KKX7R0BB104 | C106243   |
| C47                                 | TDK C3225X7R1H106KT000E | C432929   |
| C49                                 | TDK C3216X7R1C106KT000N | C342827   |
| C51                                 | YAGEO CC0603KRX7R9BB223 | C106222   |
| C56                                 | YAGEO CC0603KRX5R7BB475 | C277476   |
| R30, R31                            | Vishay CRCW060347K0FKEA | C844929   |
| R98                                 | Vishay CRCW06031K37FKEA | C4209564  |
| J2                                  | Samtec HTSW-105-07-G-S  | C3337223  |
| J6                                  | Samtec HTSW-106-07-G-S  | C3334125  |
| J1                                  | GCT USB4105-GF-A        | C3020560  |

Each selected ID showed sufficient assembly-search inventory for the two-board prototype on 2026-09-13. This does not
reserve stock or establish availability for 30 boards. C47/C49 retain their original TDK parts under the delivery
numbers explicitly paired in [TDK's change notice, page 13](https://media.futureelectronics.com/PCN/95306_SPCN.PDF).
C5/C22/C28 and C14 likewise use ordering numbers for the existing TDK catalog parts; their native Datasheet fields
retain the corresponding TDK catalog pages. All substitute datasheet links are in the native component fields.

YAGEO capacitor review includes dimensions, voltage, dielectric, tolerance and typical DC-bias graphs, not just the
printed capacitance. The 0603 1uF part loses substantial capacitance at 20V; C1 is not counted as 1uF effective there.
C36/C73 remain separate 0805 raw-input bypass capacitors. C37/C38 operate at U5's 1.2V/2.7V regulator outputs: the
typical bias curve, 10% tolerance and X7R temperature screen give about 0.67uF at 2.7V, above ST's 0.5uF minimum. These
typical-curve screens are not guaranteed all-corner or aged capacitance measurements. C47/C49 retain the previous bulk
parts to avoid an unreviewed change to converter behavior. C56 remains 4.7uF on W5500's 1.2V TOCAP. The crystal
capacitors remain 27pF C0G; R98 remains 1.37k, 1%, 100ppm/K, so neither oscillator loading nor nominal eFuse current
setting changes.

J2/J6 retain Samtec's high-temperature HTSW body, 2.54mm pitch, 5.84mm mating post, 2.54mm tail and existing 1.02mm PCB
drills. Only plating changes: `-G` retains 10 microinch gold on the mating post and uses flash gold on the tail instead
of `-L` matte tin. Do not substitute standard TSW:
[Samtec's catalog](https://suddendocs.samtec.com/catalog_english/tsw_th.pdf) does not rate that PBT version for
lead-free soldering. [J2](https://www.samtec.com/products/htsw-105-07-g-s) and
[J6](https://www.samtec.com/products/htsw-106-07-g-s) are manufacturer-listed high-temperature parts.

### Remaining parts: exact sources found

All three remaining part types are available through **JLCPCB Global Sourcing**, with no substitute or PCB change. On
2026-09-13 the account already contained these three unpurchased cart lines. Only these lines were selected for the
standalone two-assembly checkout; the other 21 sourcing-cart lines were left unchanged and unselected.

| Board references | Exact part          | JLCPCB sourcing distributor / SKU | Distributor stock shown | Purchase quantity | Line price (USD) |
| ---------------- | ------------------- | --------------------------------- | ----------------------: | ----------------: | ---------------: |
| U6               | RECOM REC30K-2405SZ | DigiKey / 945-REC30K-2405SZ-ND    |                     252 |                 2 |           $71.75 |
| J9, J10          | TE 5520250-2        | DigiKey / A31405-ND               |                   2,019 |                 4 |           $11.31 |
| J8               | Wurth 645004114822  | RS Components / 645004114822      |                     179 |                10 |            $6.14 |

The quantities cover two assembled boards; J8 has a ten-piece minimum, leaving eight spare headers. No additional
attrition quantity was shown for these offers; any assembly-review supplement still needs agreement. The selected-parts
subtotal is **$89.20**. Checkout adds **$3.00 handling**, displaying **$92.20 total** before billing information has
been completed. This is only the three sourcing lines, not PCB fabrication or assembly, and it is not a paid or reserved
price. The DigiKey power-module offer shows 8-14 business days; that is not a promised complete-board delivery date.

The exact manufacturer/distributor identities are also corroborated by the
[RECOM listing](https://www.digikey.com/en/products/detail/recom-power/REC30K-2405SZ/24366463),
[TE listing](https://www.digikey.com/en/products/detail/te-connectivity-amp-connectors/5520250-2/769549), and
[Wurth listing](https://uk.rs-online.com/web/p/pcb-headers/2138652). Direct distributor prices differ from JLCPCB's
sourcing quote; use the checkout amount above for this route. The existing native MPNs, footprints and models remain.

[JLCPCB's Global Sourcing procedure](https://jlcpcb.com/help/article/how-to-use-jlcpcb-global-sourcing-parts-service)
requires purchase, assembly eligibility review and warehouse receipt before these parts can be assigned from private
inventory. Paid sourcing orders are normally non-cancellable; review can reject unsupported parts or request
supplements. Do not mark the four references as stocked or the board as order-ready simply because offers exist.

The [sourcing cart](https://jlcpcb.com/user-center/smtPrivateLibrary/partsCart/?global=1) and checkout are prepared, but
**no order was submitted, no payment or new terms were accepted, and no supplier message was sent**. Billing information
and owner purchase approval are the next actions. After receipt, assign the exact private parts to J8/J9/J10/U6 and
review all 199 placements; do not omit any of them to advance the assembly draft.

## Remaining work, in order

1. Obtain owner approval for the prepared exact-part purchase, complete sourcing and warehouse receipt, then assign the
   four private-inventory references, inspect every supplier placement and obtain the complete SMT/THT assembly quote.
   Do not submit an order or contact support without the owner's permission.
2. Obtain the fabricator's finished-stackup impedance confirmation and agreement to U5's five-sector I2C programming,
   readback and cold-start checks. The calculator cross-check and programming handoff are prepared, but no factory
   acceptance or actual U5 readback is available. Contact requires the owner's permission. No enclosure review is
   required for this bare-board prototype.
3. On assembled hardware, verify power, insulation, startup/faults, acquisition timing, display, Ethernet, repeaters, IR
   and audio before connecting fencing equipment. CAD checks cannot substitute for those measurements.

Maintain this README and native KiCad source directly. No new backlog validator, generator framework, historical
checkpoint archive is needed. `output/` is disposable generated review material, not a second source of truth.
