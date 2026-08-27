# Minimal ESP32 scoring prototype

## Purpose

Build the smallest practical board that lets us connect fencing conductors to an ESP32-S3 and develop scoring firmware
on real hardware. This board is a disposable, hand-assembled engineering prototype. It is not a production scoring
machine, certification sample, manufacturing reference, or enclosure-ready product.

The prototype succeeds when it can be powered and programmed, observe and stimulate the seven scoring conductors,
drive the HUB75 scoring display, and exercise the portable C17 scoring logic. Anything that does not directly help
that first firmware-development loop is deferred.

## Restart decision

The previous 164-component, 489-connection carrier is retired as the active prototype design. Continuing to route or
incrementally simplify it would preserve assumptions that no longer match this goal. The replacement starts from a blank
schematic and may reuse verified pinouts, footprints, module choices, specifications, and scoring code only after each is
shown to serve the minimal prototype.

Do not preserve a circuit merely because it has already been designed, documented, or tested. Previous implementation
effort is not a reason to include hardware.

## Required hardware

The initial schematic contains only these functional blocks:

- An official ESP32-S3-DevKitC-1-N8R2 on two 22-pin socket rows. The quad-SPI PSRAM variant keeps GPIO35, GPIO36,
  and GPIO37 available for carrier I/O, unlike the octal-PSRAM N8R8 variant. The complete carrier CAD model is aligned to the
  22.86 mm row spacing so its male headers visibly enter the sockets. Its on-board regulator, USB interfaces, reset, and boot
  controls replace the previous bare-module support circuitry.
- Direct solder pads or simple headers for the six weapon wires and piste conductor.
- The OpenPiste seven-conductor topology: one bidirectional ESP32-S3 GPIO and one series resistor per conductor. Left
  and right A use 33 ohms; left and right B/C plus piste use 470 ohms. There is no second sense-resistor column. This is
  the starting prototype topology, not proof of FIE conformance. Add an external ADC, reference, mux, buffer, or
  negative rail only if measured scoring behavior demonstrates that the direct interface cannot meet a named threshold.
- A socketed or directly soldered WIZ850io module for Ethernet. Its on-module pull-ups provide the required default
  states for chip select, interrupt, and reset; the carrier does not duplicate them.
- One TSOP38438-compatible IR receiver input with only the manufacturer's recommended 100 ohm and 100 nF supply
  filter. Its output connects directly to the ESP32 input without an unnecessary carrier pull-up.
- A standard 2x8 keyed HUB75 data connector for one 64x32, 1/16-scan RGB panel. Its 13 signals use the established
  ESP32-S3 LCD-DMA pin assignment, and all three connector grounds return to APP_GND. A separate Würth Elektronik
  645004114822 four-pin 3.96 mm power header supplies two 5 V and two ground contacts from the prototype regulator;
  its matching cable housing is 645004113322. GPIO19 and GPIO20 are no longer consumed by duplicate local indicators,
  so the DevKitC native USB pins remain electrically unused by the carrier.
- One TDK PS1240P02BT 4 kHz piezo sounder, driven from 3.3 V through one low-side transistor.
- Two board-edge 6P4C RJ14 FA-05 DATA-LINE outputs. The exact TE 5520250-2 models are upright, open over the rear
  board edge, and use the manufacturer drawing's 16.13 mm housing height above the PCB. The rendered housing remains
  above the carrier while only its contacts and board locks pass through it. Each socket has its own 4N32 optocoupler, 82 ohm loop resistor, 680 kohm base
  resistor, and protection diode, matching the documented Favero 20 mA current-loop topology without coupling the two
  repeater-supplied 10-15 V loops together. GPIO43 supplies one 2,400-baud 8N1 UART stream to both optocoupler inputs.
  These are not Ethernet, RS-422, or FPA DB9 ports and cannot affect scoring decisions.
- An Adafruit 5807 USB-C PD daughterboard fixed at 20 V and a socketed Pololu D36V50F5 regulator supplying 5 V. Both
  modules use their manufacturer circuits and protection instead of reproducing USB-C negotiation or conversion from
  discrete parts. The PD daughterboard sits flush on the carrier with its VOUT and GND pads soldered directly through
  plated carrier holes; its loose terminal block is not populated and there are no power wires or wire jumpers to install.
  The regulator carrier connects both pins in each duplicated VIN, input-ground, VOUT, and output-ground pair. Its
  optional VRP, enable, and power-good positions are omitted because the fixed-output module is enabled by default and
  the prototype does not use remote voltage programming or power-good telemetry.
- Essential decoupling, reset-state resistors, protection at externally handled conductor inputs, and useful test pads.

## Explicitly deferred

The first board does not include custom production connectors, a custom USB-C PD circuit, a custom high-current
converter, an STM32, processor isolation, redundant supervisors, manufacturing fixtures, production service headers,
environmental qualification, homologation evidence, per-part evidence ledgers, backlog validators, automated release
gates, or speculative expansion hardware.

It does not include separate on-board scoring lamps or a production lamp engine. The HUB75 panel is the local visual
output, and the two FA-05 DATA-LINE interfaces drive external repeaters. The DATA-LINE transmitters are optically
isolated, but surge and cable-length qualification remain production work.

## Complexity rules

Before adding any component, answer all three questions:

1. Which required prototype behavior fails without it?
2. Why can that behavior not be provided by the selected module, a direct connection, firmware, or an off-board bench
   assembly?
3. What is the simplest safe substitute?

If those answers are not concrete, omit the component. Prefer modules, direct soldering, headers, jumpers, and bodge-wire
repair. Do not add circuitry solely for a possible production revision.

The schematic must remain understandable as a small number of functional blocks. The first-pass target is no more than
60 populated parts including connectors and passives, on a two-layer board no larger than 160 mm by 100 mm. Crossing
either limit requires removing or moving functions off-board before layout; it is not permission to expand the limit.

### Active ICs and modules

| Item | Why it is on the first board |
| --- | --- |
| ESP32-S3-DevKitC-1-N8R2 | Runs all firmware and already includes programming, reset, boot, regulation, flash, and PSRAM while leaving GPIO35 through GPIO37 available. |
| WIZ850io | Supplies required wired Ethernet without a custom PHY, magnetics, crystal, or RJ45 design. |
| TSOP38438 | Receives the required infrared remote signal with one ESP32 input. |
| 64x32 HUB75 panel | Provides the Skewered-style full RGB score, clock, status, and diagnostic display through the ESP32-S3 LCD-DMA peripheral. |
| Adafruit 5807 | Provides the board-edge USB-C socket and fixed 20 V PD request without firmware or loose power wires. |
| Pololu D36V50F5 | Converts the negotiated input to the board's 5 V rail without a custom regulator design. |
| Two 4N32M optocouplers | Reproduce the documented isolated FA-05 DATA-LINE current-loop output, one isolated loop per repeater socket. |

There is no external scoring ADC, precision reference, analog mux, op-amp, negative-rail generator, STM32, processor
isolation, supervisor, display level shifter, or multi-channel output driver in the starting design. Direct 3.3 V HUB75
signaling is a prototype assumption to verify with the selected panel; add a buffer only if measured logic margin or
signal integrity requires it.

## Component and connection audit

Every carrier component and connection was reviewed after routing. The WIZ850io chip-select pull-up and TSOP38438
output pull-up were removed because they duplicated behavior already supplied by the selected modules. The unused
Pololu VRP, enable, and power-good carrier positions were also removed, while all eight duplicated power pins are now
connected so the module does not rely on a single header contact for its input or output current.

The remaining unconnected positions are inseparable from purchased parts: eight unused positions on the standard
ESP32-S3-DevKitC-1 socket pair, the WIZ850io module's designated NC position, and pin 3 marked NC on each 4N32M
optocoupler package. They are not dangling carrier nets or optional support circuitry. A generated-product test holds
that exact allowlist and fails if any other board pin becomes unconnected.

## Work ownership

The root agent performs all prototype architecture, schematic, PCB, documentation, verification, and commit work.
Subagents are not used for this work. This avoids locally correct tasks preserving an architecture that has not passed a
single-owner simplicity review.

## Order gate

Do not start placement or routing until the root agent has reviewed the complete minimal schematic against this document.
The board is ready to order after basic electrical review, footprint inspection, PCB ERC/DRC, and visual inspection of
Gerbers and drill files. Production qualification is not part of this gate.

Firmware hardware bindings begin only after the ordered schematic and pinout are fixed. The portable C17 core remains
hardware-independent and the sole scoring authority.
