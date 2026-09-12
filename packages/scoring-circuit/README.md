# Scoring prototype hardware

## Native KiCad designs

- **Active: [virtual scoring box](virtual-scoring-box/README.md).** STM32 scoring, ESP32 wireless/IR, and laptop or
  wall-powered USB-C. The 120 x 85mm board is routed and has a 142-part assembly export. Its README records the current
  JLCPCB draft, component shortages and programming handoff; it is not yet order-ready.
- **Frozen: [combined computer/standalone board](usb-scoring-platform/README.md).** The 165 x 100mm, 223-part design
  includes isolated USB, USB-C PD, Ethernet, IR, HUB75, audio and Favero outputs. Preserve it as a separate reference;
  do not overwrite it with either dedicated product. Its [design review](usb-scoring-platform/design-review.md) retains
  unresolved findings and component checks, not fabrication approval.
- **Active: [standalone HUB75 scoring box](standalone-scoring-box/README.md).** Separate native schematic and initial
  165 x 100mm placement with 199 purchased parts. Retains STM32, ESP32, IR, fencer/piste connections, HUB75, Ethernet,
  Favero outputs, audio and power-only USB-C PD; removes the laptop interface and source-mode MCU. Power review and
  routing are still pending. Firmware logic stays shared, with board-specific hardware adapters.

For each native design, use its README and its manufacturing exporter when available; the unrouted standalone project
does not yet have one. Keep the latest supplier-upload package and required programming handoff; older output
checkpoints, build caches and scratch routing scripts are disposable. Keep source, required component models and
manufacturer references. Generated output is not a second source of truth.

## Earlier tscircuit carrier

The ESP32 DevKitC/WIZ850io carrier is preserved as the explicitly requested comparison design. Its
[architecture](docs/clean-sheet-board-architecture.md), source and models describe that carrier, not the native board.
Do not mix its BOM, pinout or generated fabrication files with the USB scoring platform.

The following commands operate on that earlier carrier only, not the native KiCad designs.

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
