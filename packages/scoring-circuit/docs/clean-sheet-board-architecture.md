# BP-320 clean-sheet board scaffold

`src/index.circuit.tsx` is the sole canonical P0 circuit entry point. It is no
longer the former multi-assembly STM32/ESP32 connectivity model.

The scaffold freezes:

- a provisional 240 mm by 140 mm, four-layer bench envelope pending BP-010;
- twelve named schematic integration units BP-321 through BP-332;
- the clean-sheet global rail, ground, shield, reset, and output-permit names;
- explicit exclusion of STM32, processor isolation, SWD, optional persistence
  and audio, permanent V5 telemetry, alternate input, and source selection; and
- a fail-closed authority record: canonical source is true, while schematic
  integration, PCB placement/routing, and fabrication authorization are false.

The empty board render proves only that the old circuit is no longer the
canonical source. Components and connections enter the canonical board only
through their named integration tasks after their electrical contracts pass
root review. BP-010 may change the provisional dimensions without reviving any
old circuitry.
