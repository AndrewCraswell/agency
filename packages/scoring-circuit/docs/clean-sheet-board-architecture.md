# BP-320 integrated clean-sheet board

`src/index.circuit.tsx` is the sole canonical P0 circuit entry point. It is no
longer the former multi-assembly STM32/ESP32 connectivity model.

The scaffold freezes:

- a provisional 240 mm by 140 mm, four-layer bench envelope pending BP-010;
- twelve integrated schematic units BP-321 through BP-332;
- the clean-sheet global rail, ground, shield, reset, and output-permit names;
- explicit exclusion of STM32, processor isolation, SWD, optional persistence
  and audio, permanent V5 telemetry, alternate input, and source selection; and
- a fail-closed authority record: canonical source and schematic integration are true, while PCB placement/routing and
  fabrication authorization remain false.

The canonical board now contains the integrated P0 power, phased weapon acquisition, ESP32, Ethernet, HUB75, IR,
USB, output, and direct-wire blocks. The OpenPiste comparison corrected the acquisition model from seven independent
ADC cells to named source/sink/sense phases with five protected sensed conductors and one shared ADC/reference chain.
Board placement, routing, and fabrication authority remain closed.
