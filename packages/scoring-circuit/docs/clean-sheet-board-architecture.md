# Minimal ESP32 scoring prototype

## Purpose

Build the smallest practical board that lets us connect fencing conductors to an ESP32-S3 and develop scoring firmware
on real hardware. This board is a disposable, hand-assembled engineering prototype. It is not a production scoring
machine, certification sample, manufacturing reference, or enclosure-ready product.

The prototype succeeds when it can be powered and programmed, observe and stimulate the seven scoring conductors,
drive the basic scoring indications, and exercise the portable C17 scoring logic. Anything that does not directly help
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

- An official ESP32-S3-DevKitC-1-N8R8 on two socket rows. Its on-board regulator, USB interfaces, reset, and boot
  controls replace the previous bare-module support circuitry.
- Direct solder pads or simple headers for the six weapon wires and piste conductor.
- An OpenPiste-style resistor/transistor conductor interface connected directly to ESP32-S3 GPIO and ADC-capable pins.
  It is the starting prototype topology, not proof of FIE conformance. Add an external ADC, reference, mux, buffer, or
  negative rail only if measured scoring behavior demonstrates that the direct interface cannot meet a named threshold.
- A socketed or directly soldered WIZ850io module for Ethernet.
- One TSOP38438-compatible IR receiver input.
- One red and one green 5 mm on-board LED for immediate scoring-state feedback during bench tests, each driven directly
  from an otherwise unused ESP32 GPIO through one 330 ohm resistor.
- A three-wire WS2812 matrix connection for the larger prototype display with one GPIO and no parallel display bus.
  HUB75 is deferred behind the firmware display abstraction.
- One TDK PS1240P02BT 4 kHz piezo sounder, driven from 3.3 V through one low-side transistor. The matrix provides the prototype scoring lamps, so duplicate discrete lamp drivers are
  omitted.
- An Adafruit 5991 USB-C PD daughterboard set to 20 V and a socketed Pololu D36V50F5 regulator supplying 5 V. Both
  modules use their manufacturer circuits and protection instead of reproducing USB-C negotiation or conversion from
  discrete parts. The PD module mounts at the carrier edge; two short 18 AWG wires connect its output terminal to the
  labeled carrier landings.
- Essential decoupling, reset-state resistors, protection at externally handled conductor inputs, and useful test pads.

## Explicitly deferred

The first board does not include custom production connectors, a custom USB-C PD circuit, a custom high-current
converter, an STM32, processor isolation, redundant supervisors, manufacturing fixtures, production service headers,
environmental qualification, homologation evidence, per-part evidence ledgers, backlog validators, automated release
gates, or speculative expansion hardware.

It does not include a production lamp engine or duplicate high-current indicator drivers. The two low-current on-board
LEDs are only bench feedback; the display header remains the larger visual-output path.

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
| ESP32-S3-DevKitC-1-N8R8 | Runs all firmware and already includes programming, reset, boot, USB, regulation, flash, and PSRAM. |
| WIZ850io | Supplies required wired Ethernet without a custom PHY, magnetics, crystal, or RJ45 design. |
| TSOP38438 | Receives the required infrared remote signal with one ESP32 input. |
| WS2812 matrix | Provides all prototype scoring indications through one data signal and an off-board panel. |
| Adafruit 5991 | Provides the board-edge USB-C socket and switch-selected 20 V PD request without firmware. |
| Pololu D36V50F5 | Converts the negotiated input to the board's 5 V rail without a custom regulator design. |

There is no external scoring ADC, precision reference, analog mux, op-amp, negative-rail generator, STM32, isolation
device, supervisor, display buffer, or multi-channel output driver in the starting design.

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
