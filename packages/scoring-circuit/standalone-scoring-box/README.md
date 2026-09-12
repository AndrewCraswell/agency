# Standalone scoring box

Open `standalone-scoring-box.kicad_pro` in KiCad 10. This is the separate **HUB75 standalone product**, not the
[virtual scoring box](../virtual-scoring-box/README.md) and not an overwrite of the
[frozen combined board](../usb-scoring-platform/README.md).

## Current checkpoint

The native schematic, placement and PCB routing are implemented. The four-layer, 1.6mm board provisionally retains the
combined board's **165 x 100mm** outline. There are **202 footprints: 199 purchased parts and three bare wire
terminations**. The combined design had 223 purchased parts; the reduction is 24 parts, not a priced cost saving.

**This is a routed engineering checkpoint, not an order-ready board.** Changed circuits have new routing; unchanged
local circuits were reused only with matching pad positions and net assignments. Insulation and antenna keepouts remain.
The power desk review and factory programming procedure are supplied in [power-handoff.md](power-handoff.md). Physical
power qualification and manufacturing review below are still required. CAD checks do not establish electrical
performance or FIE approval.

KiCad 10.0.6 verification on **2026-09-12**: **0 ERC violations, 0 DRC violations, 0 unconnected items and 0
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

USB-C is on the left edge beside its controller. Ethernet remains on the bottom edge and the two Favero ports on the top
edge, retaining the combined board's connector geometry. The ESP32 antenna projects beyond the top edge. Final enclosure
clearance, mounting holes and mechanical access with actual cables still need confirmation.

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

Ethernet transmit copper measures 30.2676mm per leg. Receive copper, including both sides of the series resistors,
measures 31.7467mm and 31.5467mm, a 0.20mm difference. These paths exceed WIZnet's preferred 25mm length but remain
below its 75mm limit; they are not a claim of an optimal layout or verified 100-ohm impedance.

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

The four offline power-profile tests pass (`python -B test_power_profile.py`). The repository-wide `pnpm verify` check
still fails at the existing scoring application's 100% coverage gate: 969 tests pass, with statements 95.44%, branches
93.78%, functions 99.79% and lines 96.09%. No thresholds were lowered; this is separate from the native board/export
checks.

Use **default green solder mask** for the prototype order as requested. Both the CAD stackup and order handoff use
green; Gerbers describe mask openings, not pigment. Confirm the actual supplier option before ordering.

## Remaining work, in order

1. Confirm enclosure access, mounting, connector bodies and the ESP32 antenna clearance. There are no mounting holes
   yet; agree retention before release. Resolve J13's missing authentic CAD model. Retain the routed isolation boundary
   and recheck any mechanical placement changes in KiCad.
2. Review the generated manufacturing draft, confirm stackup/impedance, part availability, SMT/THT assembly and
   enclosure-wire responsibilities. Confirm the factory can program/read back U5 with the supplied procedure. No
   combined or virtual fabrication ZIP applies, and the current JLCPCB virtual-board draft remains untouched.
3. On assembled hardware, verify power, insulation, startup/faults, acquisition timing, display, Ethernet, repeaters, IR
   and audio before connecting fencing equipment. CAD checks cannot substitute for those measurements.

Maintain this README and native KiCad source directly. No new backlog validator, generator framework, historical
checkpoint archive is needed. `output/` is disposable generated review material, not a second source of truth.
