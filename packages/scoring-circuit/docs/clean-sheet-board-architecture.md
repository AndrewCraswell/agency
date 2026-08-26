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
- A HUB75 connector with two 74AHCT245 buffers because a 5 V panel cannot be assumed to accept 3.3 V logic reliably.
- One transistor-driven buzzer. The HUB75 panel provides the prototype scoring lamps, so duplicate discrete lamp drivers
  are omitted.
- Fused 5 V input from the existing off-board USB-C PD and regulator modules, plus only the rails actually consumed by
  the board.
- Essential decoupling, reset-state resistors, protection at externally handled conductor inputs, and useful test pads.

## Explicitly deferred

The first board does not include custom production connectors, on-board USB-C PD negotiation, on-board high-current
conversion, an STM32, processor isolation, redundant supervisors, manufacturing fixtures, production service headers,
environmental qualification, homologation evidence, per-part evidence ledgers, backlog validators, automated release
gates, or speculative expansion hardware.

It also does not include duplicate indicator loads when a header to the intended external lamp, buzzer, or display is
sufficient for firmware development.

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
| Two 74AHCT245 buffers | Translate the thirteen HUB75 control signals from 3.3 V to reliable 5 V logic. |

There is no external scoring ADC, precision reference, analog mux, op-amp, negative-rail generator, STM32, isolation
device, supervisor, or multi-channel output driver in the starting design.

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
