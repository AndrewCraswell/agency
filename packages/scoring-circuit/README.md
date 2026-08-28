# ESP32 scoring prototype board

This package owns the deliberately simple, hand-assembled PCB used to validate the fencing scoring hardware before
firmware integration. The board sockets one ESP32-S3 DevKitC and one WIZ850io Ethernet module, exposes the seven fencing
conductors, and carries only the driver, ADC protection, IR receiver, display, buzzer, and power support needed for the
prototype.

The active design documents are:

- [Clean-sheet board architecture](docs/clean-sheet-board-architecture.md)
- [Prototype delivery checklist](docs/esp32-prototype-backlog.md)

Useful commands:

- `pnpm --filter @repo/scoring-circuit build` generates the circuit JSON, the locally bundled tscircuit RunFrame PCB,
  schematic, and 3D preview, plus the BOM and placement files in `dist/`.
- `pnpm --filter @repo/scoring-circuit pcb:route` regenerates the KiCad project, Gerbers, drill files, BOM, and
  placement files in `pcb/`.
- `pnpm --filter @repo/scoring-circuit test` runs the focused board tests.

The board source sets a red solder mask and white silkscreen for the preview. Gerbers define the mask and silkscreen
geometry, but the fabricator's order form or fabrication notes select the physical pigment; change `solderMaskColor` and
`silkscreenColor` in `src/index.circuit.tsx` when a different finish is chosen.

This is a prototype, not a production or FIE-certified board. Review the KiCad board and fabrication preview before
ordering, then validate the assembled hardware electrically before connecting it to fencing equipment.
