# USB scoring platform

Separate native KiCad engineering draft. The existing ESP32 prototype, browser preview, and fabrication files are
unchanged. Open `usb-scoring-platform.kicad_pro` in KiCad 10. The schematic and PCB files are editable source; no
generator is needed to maintain this project. Project-local footprints reference the existing package's retained STEP
models without changing or duplicating them in Git. Their sources and license notes are in
[CAD model sources](../assets/cad/SOURCES.md). Native library parts require the installed KiCad footprint and 3D
libraries.

**Not ready for fabrication, sale, or connection to fencers.** The schematic is a candidate circuit and the PCB is an
unrouted floorplan, not a completed design. This folder is not consumed by the existing prototype export commands.

## Design decisions

- STM32G474RET6 handles excitation, seven internal comparator inputs, timestamps, and native USB. Desktop software runs
  the portable C17 scoring core first; standalone scoring can subsequently use the same core on STM32. Firmware is not
  implemented here. Internal comparators avoid adding a separate comparator bank, but the sensing circuit still needs
  threshold and timing characterization.
- ESP32-S3-WROOM-1-N8R8 handles the HUB75 display, Ethernet, and IR. Two SN74AXC1T45 UART translators separate powered
  and unpowered logic rails. These are **not galvanic isolators**.
- Keep the WIZ850io Ethernet module, TSOP38438 receiver, two TE 5520250-2 Favero DATA-LINE connectors with optocoupler
  outputs, HUB75 signal/power connectors, and sounder from the prototype. Favero ports are not Ethernet or RS-422.
- Separate USB-C connectors serve computer USB data and USB-C PD power. Diode ORing feeds the acquisition supply from
  computer USB or the PD-derived 5V rail. The display, ESP32, and Ethernet require PD power. USB power limits, suspend,
  inrush, and power transitions remain to be verified.
- J1 uses GCT USB4105-GF-A for computer USB: a documented 16-contact USB 2.0 receptacle with a matching native KiCad
  footprint and STEP model. It replaces the initial HRO candidate in this new design only. See the
  [manufacturer drawing](https://gct.co/files/drawings/usb4105.pdf).
- Retain Adafruit 5807 fixed-20V PD and Pololu D36V50F5 modules initially. Use AP63203 with a Coilcraft XAL5030-472MEC
  inductor for application 3.3V. Module substitutions remain possible if footprint, power, cost, and availability
  justify them; this is not a locked procurement BOM.
- J3/J4 are three-wire harness landings for off-board female banana sockets, not banana receptacles themselves. J5 is
  the metal-piste reference connection, not protective earth. The user's compatible Ok Fencing cable remains unchanged.

## Current state and remaining work

The schematic contains 150 components across ten functional/support sheets plus the cover. Every component has a
footprint, and all 154 schematic nets were transferred to the initial 160 x 100mm, four-layer PCB. Most components are
passive support, clamps, decoupling, and defined reset-state resistors; their physical arrangement is still provisional.

Before routing and fabrication:

1. Finish the sensing design: excitation sequence, comparator reference and hysteresis, per-weapon thresholds, capture
   timing, loading, and simultaneous-contact behavior. The 330-ohm excitation resistors, 10k sense resistors, and BAT54S
   clamps are characterization candidates, not evidence of correct FIE behavior. Check clamp-rail injection and
   unpowered faults. Do not infer patent clearance from component selection or this topology.
2. Resolve the isolation and electrical-safety boundary for USB, PD, Ethernet, piste, and weapon conductors. This draft
   shares acquisition and application ground and does not implement galvanic USB or power isolation. Do not connect it
   to people on the strength of schematic checks.
3. Finish local placement, decoupling, connector access, mounting, antenna clearance, and power/current paths. Review
   every retained footprint and 3D transform against its exact part drawing. Resolve the ESP32 footprint's 0.2mm thermal
   drills versus the current 0.3mm board rule with the intended fabrication process; do not merely suppress the warning.
4. Route the board, define stackup/net classes, run schematic-to-PCB parity and DRC, inspect 3D and manufacturing
   outputs, and then perform hardware bring-up. No routing, purchase, or assembly release has been performed.

## Checks performed

KiCad 10.0.6 loaded the schematic and PCB in its native editors. Native schematic ERC reported zero violations; netlist
export succeeded and the PCB transfer checked every explicitly connected schematic pin against that export. These checks
establish connectivity consistency, not analog performance or compliance. Module symbols use passive pins where the
retained interface lacks detailed electrical pin types, which limits what ERC can diagnose.

Current PCB DRC reports 411 unconnected items, 12 thermal-drill size errors, four USB connector hole-clearance errors,
and nine silkscreen warnings. The connector's 0.1944mm pad-to-hole clearance is below the default 0.25mm rule and needs
fabricator review. These findings are open, not waived. The board has no routed copper. Visual review and electrical
design work are not complete.

Repository verification on September 5, 2026 passed formatting, lint, types, unused-code checks, and the existing
prototype simulations, but failed three tests in unchanged scoring application files: two timeouts and a canonical
scenario-corpus assertion (`scenario-runner.test.ts` and `observatory-integration.test.ts`). Those existing simulations
do not validate this new STM32 front end. No software-test failures were suppressed or repaired as part of this draft.

Reference component data: [STM32G474](https://www.st.com/resource/en/datasheet/stm32g474re.pdf),
[SN74LVC125A](https://www.ti.com/lit/ds/symlink/sn74lvc125a.pdf),
[SN74AXC1T45](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf),
[AP63203](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), and
[XAL5030-472](https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xal/xal5030-472/).
