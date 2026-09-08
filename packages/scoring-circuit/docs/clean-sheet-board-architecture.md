# ESP32 carrier reference

This page describes the earlier tscircuit carrier retained for comparison at the owner's request. The current assembly
candidate is the [native KiCad USB scoring platform](../usb-scoring-platform/README.md). Do not use this carrier's
pinout, power assumptions, BOM or routing as instructions for the native board.

## Carrier components

- ESP32-S3-DevKitC-1-N8R8 on two 22-pin socket rows; GPIO35 through GPIO37 are reserved by its memory configuration.
- WIZ850io Ethernet module, TSOP38438 infrared receiver and PS1240P02BT sounder.
- Adafruit 5807 fixed-20V USB-C PD module and Pololu D36V50F5 5V regulator.
- Two TE 5520250-2 RJ14 sockets with independent 4N32M-isolated Favero DATA-LINE outputs.
- A 64x32 HUB75 signal header and separate 5V power header. Unlike the native board, this carrier uses direct 3.3V
  signals, whose compatibility must be measured before connecting a panel.
- Seven conductor connections following the OpenPiste topology: one bidirectional GPIO per conductor, with 33-ohm
  series resistance on left/right A and 470 ohms on left/right B, C and piste. These are not direct banana sockets.

## Source and checks

`src/index.circuit.tsx` and its imported parts own the actual circuit and placement. Package build and routing commands
 generate this carrier's preview and manufacturing outputs; they do not update the native KiCad project.

The [electrical simulations](electrical-simulation.md) screen conductor, power, IR, sounder and repeater behavior for
this carrier. Their simplified models do not establish full-board safety, FIE homologation or physical compatibility.

Use current generated quantities and supplier prices if revisiting this design. The completed construction diary,
obsolete restart instructions and dated price estimate have been removed; the active native design's remaining work
is tracked in its [design review](../usb-scoring-platform/design-review.md).
