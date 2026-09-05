# USB scoring platform

Separate native KiCad engineering draft. The existing ESP32 prototype, browser preview, and fabrication files are
unchanged. Open `usb-scoring-platform.kicad_pro` in KiCad 10. The schematic and PCB files are editable source; no
generator is needed to maintain this project. Project-local footprints reference the existing package's retained STEP
models without changing or duplicating them in Git. Their sources and license notes are in
[CAD model sources](../assets/cad/SOURCES.md). Native library parts require the installed KiCad footprint and 3D
libraries.

**Not ready for fabrication, sale, or connection to fencers.** The schematic is a candidate circuit and the PCB is an
unrouted floorplan, not a completed design. This folder is not consumed by the existing prototype export commands.

## Low-volume build scope

Design for **3-10 units per month**. Prioritize dependable operation, straightforward assembly and repair, and
inexpensive design changes. A higher module cost is acceptable when it saves meaningful engineering, assembly, or
support effort.

- Keep the agreed STM32 acquisition / ESP32 application split and existing required interfaces. No extra processor,
  redundant supply, or speculative expansion interface without a concrete need.
- Prefer proven, available modules and manufacturer reference circuits. Replace a module with discrete circuitry only
  for a demonstrated electrical, mechanical, availability, or overall cost benefit at this sales volume.
- Desktop acquisition must ultimately use **one computer USB cable for both power and data**. PD powers the full display
  system. The current PD-powered, isolated-data draft is an intermediate state, not a completed substitute for USB
  power. Evaluate a proven isolated USB/power solution before designing a custom isolated supply.
- Each added component must serve a required function, satisfy an applicable requirement, or address a specific failure
  mode. Keep necessary protection, decoupling, reset defaults, isolation, and practical programming access; low volume
  does not reduce electrical-safety or scoring-correctness requirements.
- Concentrate verification on the actual circuit: pin/footprint fit, ERC/DRC, power behavior, sensing and timing, and
  end-to-end operation. Keep the existing scoring-logic tests. Do not add documentation/BOM validators, speculative
  qualification frameworks, or elaborate automated factory fixtures for this build.
- Maintain this short design note and the native KiCad source. Prefer changes that remain easy to inspect and repair;
  propose any substantial increase in parts, custom circuitry, or assembly steps before implementing it.

## Design decisions

- STM32G474RET6 handles excitation, seven internal comparator inputs, timestamps, and native USB. Desktop software runs
  the portable C17 scoring core first; standalone scoring can subsequently use the same core on STM32. Firmware is not
  implemented here. Internal comparators avoid adding a separate comparator bank, but the sensing circuit still needs
  threshold and timing characterization.
- ESP32-S3-WROOM-1-N8R8 handles the HUB75 display, Ethernet, and IR. Two SN74AXC1T45 UART translators separate powered
  and unpowered logic rails. These are **not galvanic isolators**.
- Keep the WIZ850io Ethernet module, TSOP38438 receiver, two TE 5520250-2 Favero DATA-LINE connectors with optocoupler
  outputs, HUB75 signal/power connectors, and sounder from the prototype. Favero ports are not Ethernet or RS-422.
- Separate USB-C connectors serve computer USB and USB-C PD power. The current circuit uses ADuM3160BRWZ for isolated
  USB data and powers acquisition from the PD-derived 5V rail. The former direct USB supply connection and VBUS divider
  were removed because they crossed the intended isolation boundary. USB-only acquisition power remains unimplemented,
  including its start-up, current-limit, suspend, and power-transition behavior.
- The integrated LTM2884 USB/power module was evaluated but is not selected. Its low-current suspend mode removes
  downstream power and requires USB re-enumeration after host resume; its keep-powered mode exceeds the USB suspend
  current allowance when bus powered. Decide whether a desktop reconnect after computer sleep is acceptable before
  adopting that tradeoff. See the
  [manufacturer's suspend and compliance notes, pages 15-16](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf).
- J1 uses GCT USB4105-GF-A for computer USB: a documented 16-contact USB 2.0 receptacle with a matching native KiCad
  footprint and STEP model. It replaces the initial HRO candidate in this new design only. See the
  [manufacturer drawing](https://gct.co/files/drawings/usb4105.pdf).
- Retain Adafruit 5807 fixed-20V PD and Pololu D36V50F5 modules initially. Use AP63203 with a Coilcraft XAL5030-472MEC
  inductor for application 3.3V. Module substitutions remain possible if footprint, power, cost, and availability
  justify them; this is not a locked procurement BOM.
- J3/J4 are three-wire harness landings for off-board female banana sockets, not banana receptacles themselves. J5 is
  the metal-piste reference connection, not protective earth. The user's compatible Ok Fencing cable remains unchanged.

## Current state and remaining work

The current draft contains 157 components across eleven functional/support sheets plus the cover. Every component has a
footprint, and all 162 schematic nets were transferred to the initial 160 x 100mm, four-layer PCB. Most components are
passive support, clamps, decoupling, and defined reset-state resistors; their physical arrangement is still provisional.

Before routing and fabrication:

1. Finish the sensing design: excitation sequence, comparator reference and hysteresis, per-weapon thresholds, capture
   timing, loading, and simultaneous-contact behavior. The 330-ohm excitation resistors, 10k sense resistors, and BAT54S
   clamps are characterization candidates, not evidence of correct FIE behavior. Check clamp-rail injection and
   unpowered faults. Do not infer patent clearance from component selection or this topology.
2. Complete single-cable USB acquisition power and review the electrical-safety boundary for USB, PD, Ethernet, piste,
   and weapon conductors. The USB data isolator and PCB copper keepouts now separate computer ground from board ground;
   acquisition and application still share board ground. These draft changes do not establish complete board safety.
3. Finish local placement, decoupling, connector access, mounting, antenna clearance, and power/current paths. Review
   every retained footprint and 3D transform against its exact part drawing. Resolve the ESP32 footprint's 0.2mm thermal
   drills versus the current 0.3mm board rule with the intended fabrication process; do not merely suppress the warning.
4. Route the board, define stackup/net classes, run schematic-to-PCB parity and DRC, inspect 3D and manufacturing
   outputs, and then perform hardware bring-up. No routing, purchase, or assembly release has been performed.

## Checks performed

At the 157-component USB-isolation checkpoint, KiCad 10.0.6 loaded the schematic and PCB in its native editors and
rendered the assembly in its native 3D viewer. ERC reported zero violations; netlist export succeeded and the PCB
transfer checked every explicitly connected schematic pin against that export. The host connector, ESD device, isolator
bypasses and series resistors occupy a separate USB-ground island with all-copper-layer keepouts. These checks establish
connectivity consistency, not analog performance or compliance. Module symbols use passive pins where the retained
interface lacks detailed electrical pin types, which limits what ERC can diagnose.

That checkpoint's PCB DRC reported 431 unconnected items, 12 thermal-drill size errors, four USB connector
hole-clearance errors, and 13 silkscreen warnings. The connector's 0.1944mm pad-to-hole clearance is below the default
0.25mm rule and needs fabricator review. These findings are open, not waived. The board has no routed copper. Visual
review of individual pin seating and electrical design work are not complete. The isolated-data circuit has been
reviewed as an intermediate draft only; single-cable acquisition power remains open.

Repository verification on September 5, 2026 passed formatting, lint, types, unused-code checks, and all five existing
prototype simulations. Scoring application tests reported 770 passes and three failures in unchanged files: a mutation
test timeout and canonical-corpus failure in `scenario-runner.test.ts`, plus a 29-versus-28 scenario-count assertion in
`observatory-integration.test.ts`. Those existing simulations do not validate this new STM32 front end. No software-test
failures were suppressed or repaired as part of this draft.

Reference component data: [STM32G474](https://www.st.com/resource/en/datasheet/stm32g474re.pdf),
[SN74LVC125A](https://www.ti.com/lit/ds/symlink/sn74lvc125a.pdf),
[SN74AXC1T45](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf),
[AP63203](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf), and
[XAL5030-472](https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xal/xal5030-472/).
