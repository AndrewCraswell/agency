# Integrated ESP32 prototype board

`src/index.circuit.tsx` is the sole canonical P0 circuit entry point. It is no
longer the former multi-assembly STM32/ESP32 connectivity model.

The architecture freezes:

- a provisional 360 mm by 200 mm, four-layer bench envelope;
- one integrated schematic containing the power, acquisition, processor, Ethernet, display, IR, output, and direct-wire
  sections;
- the clean-sheet global rail, ground, shield, reset, and output-permit names;
- explicit exclusion of STM32, processor isolation, SWD, optional persistence
  and audio, permanent V5 telemetry, alternate input, and source selection; and
- fail-closed release authority: schematic integration and PCB placement are complete, while routing and fabrication
  authorization remain incomplete.

The canonical board now contains the integrated P0 power, phased weapon acquisition, ESP32, Ethernet, HUB75, IR,
USB, output, and direct-wire blocks. The OpenPiste comparison corrected the acquisition model from seven independent
ADC cells to named source/sink/sense phases with five protected sensed conductors and one shared ADC/reference chain.
Board placement is complete. Routing is active and fabrication authority remains closed.

## Provisional fabrication stack

The current routing candidate is a 1.6 mm JLCPCB four-layer JLC3313 board with 2 oz outer copper, 1 oz inner copper,
ENIG, `APP_GND` on layer 2, and power distribution on layer 3. High-current paths remain on broad outer-layer copper;
USB and Ethernet pairs remain on one outer signal layer over the uninterrupted layer-2 ground plane.

This is not order authority. JLCPCB's published impedance calculator supports 1 oz outer copper, not the proposed 2 oz
signal layer. Final USB 90-ohm and Ethernet 100-ohm width, gap, solder-mask model, tolerance, and coupon geometry require
the order-specific stack cross-section and supplier field-solver confirmation before manufacturing release.
