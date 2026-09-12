# Standalone scoring box

Open `standalone-scoring-box.kicad_pro` in KiCad 10. This is the separate **HUB75 standalone product**, not the
[virtual scoring box](../virtual-scoring-box/README.md) and not an overwrite of the
[frozen combined board](../usb-scoring-platform/README.md).

## Current checkpoint

The native schematic and initial PCB placement are implemented. The four-layer, 1.6mm board provisionally retains the
combined board's **165 x 100mm** outline. There are **202 footprints: 199 purchased parts and three bare wire
terminations**. The combined design had 223 purchased parts; the reduction is 24 parts, not a priced cost saving.

**This board is deliberately unrouted and is not ready to order.** Old tracks, vias and ground pours were removed rather
than carried across circuit changes. Relevant insulation and antenna keepouts remain. KiCad 10.0.6 checks on 2026-09-12
report zero schematic ERC violations, zero schematic/PCB mismatches, zero non-routing DRC violations, and 499
unconnected items. These checks establish the initial CAD checkpoint, not electrical performance or FIE approval.

The native 3D preview is generated in `output/board-top-3d.png`. J13's Ethernet model reference is unavailable in the
installed library and U20 has no assigned model; their actual footprints remain present. Do not treat the empty model
areas as available space. Existing authentic shared component models are referenced without making duplicate copies.

## Product and connections

- **STM32G474RET6** performs acquisition and scoring. **ESP32-S3-WROOM-1-N8R8** handles the display, wireless network
  and IR application. Share the C17 scoring core and application source with the virtual box; use board-specific
  pin/power/transport configuration, not necessarily identical firmware binaries.
- **J3/J4:** left/right ABC solder-wire pads on opposite edges. **J5:** bottom-edge piste solder-wire pad. All connect
  to enclosure-mounted banana sockets with strain relief; these PCB pads are not the external sockets. The owner's Ok
  Fencing cable compatibility remains accepted. Piste is a scoring reference, not protective earth.
- **J7/J8:** HUB75 signal and separate 5V power for one Waveshare RGB-Matrix-P5-64x32, SKU 25848, 1/16-scan display. The
  panel and harnesses are external to this PCB assembly. Keep the inherited FM6127 initialization and unused E-line
  handling in the display adapter.
- **J13 / W5500:** CETUS J1B1211CCD Ethernet with integrated magnetics for network functions including Cyrano.
- **J9/J10:** two TE 5520250-2 Favero FA-05 DATA repeater connectors. These are not Ethernet or RS-422 ports.
- **U13 / BZ1:** TSOP38438 38kHz IR receiver for the shared remote and PS1240P02BT sounder.
- **J2/J6:** STM32 SWD and ESP32 UART programming/recovery. Updates retain the shared product approach.
- **J1:** a single GCT USB4105-GF-A **power-only USB-C** input, requiring a charger offering fixed 20V at 3A. USB data
  pins and the old STM32 USB/presence pins are explicitly unconnected. There is no laptop USB data mode.

The provisional placement retains outward-facing Ethernet and Favero connector geometry from the combined board. Cable
access, mounting holes, RF clearance and final enclosure fit still need a dedicated placement review.

## Simpler standalone power

U5 **STUSB4500QTR** negotiates the charger contract. U20 **TPS259470LRPWR** protects and gates the input to U6
**REC30K-2405SZ**, which produces isolated 5V for the display and secondary regulators. AP2112K supplies the acquisition
3.3V rail; AP63203 supplies application 3.3V. Their sequencing translators remain because these are separate rails.

The standalone board removes LTM2884 isolated laptop USB, LTC3130 laptop supply, their support, the dual-supply OR
diodes, and the STM32C011 source-mode controller. U22 **TPS70933DBVR** and two capacitors provide the small primary-side
3.3V supply for status and I2C pull-ups. EN is intentionally open using its internal pull-up, not tied to raw VBUS.

**Factory configuration is still required.** Before the assembly can work as specified, program and read back U5 NVM
through primary-domain J12 with exactly two sink PDOs: default 5V, then fixed 20V/3A. Configure `POWER_OK_CFG=10b`,
`REQ_SRC_CURRENT=0` and `POWER_ONLY_ABOVE_5V=1`. The programming image and procedure are not implemented yet.

Q4/Q5 retain both active-low `POWER_OK2` and `VBUS_EN_SNK` qualification. Together they inhibit U20 until the requested
PDO2 contract is accepted and remove its enable on detach. This uses the controller's documented standalone behavior,
not USB enumeration, bus silence, or an inference that a connected device must be a wall charger. The eFuse's separate
voltage window remains a further check. USB_GND must remain isolated from scoring GND, including programming equipment.

Source references: [STUSB4500 status and NVM behavior](https://www.st.com/resource/en/datasheet/stusb4500.pdf),
[TPS709 input and EN limits](https://www.ti.com/lit/ds/symlink/tps709.pdf), and
[TPS25947 protection behavior](https://www.ti.com/lit/ds/symlink/tps25947.pdf).

## Remaining work, in order

1. Finish the new whole-board power budget and tolerance/thermal/startup review, including default-off behavior and the
   U5 programming/readback handoff. The combined board's supply calculations are inputs, not approval of this circuit.
   Do not assume the isolated converter's 30W nameplate is an available continuous panel allocation.
2. Refine placement and board size around enclosure access, connector bodies, mounting, the power isolation barrier,
   ESP32 antenna clearance and compact analog/clock/switching groups. Resolve missing authentic CAD models.
3. Route the new board with solid return paths, short critical connections and orderly surface routing. Keep the primary
   and scoring grounds separate. Then rerun ERC, full DRC/parity and fabrication/assembly checks.
4. Generate this board's own BOM, placements, Gerbers and supplier draft only after routing and review. Recheck part
   availability and assembly responsibilities; no combined or virtual fabrication ZIP applies to this design.
5. On assembled hardware, verify power, insulation, startup/faults, acquisition timing, display, Ethernet, repeaters, IR
   and audio before connecting fencing equipment. CAD checks cannot substitute for those measurements.

Maintain this README and native KiCad source directly. No new backlog validator, generator framework, historical
checkpoint archive or fabrication package is needed for this initial placement. `output/` is disposable generated review
material, not a second source of truth.
