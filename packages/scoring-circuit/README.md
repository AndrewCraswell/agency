# Scoring prototype hardware

Active new development is the [virtual scoring box](virtual-scoring-box/README.md): STM32 scoring, ESP32 wireless/IR,
and laptop or wall-powered USB-C. Its schematic and PCB placement are incomplete; it has no fabrication package yet. The
combined board below is frozen as the separately preserved computer/standalone reference. A dedicated standalone board
comes later.

The current assembly candidate is the [native KiCad USB scoring platform](usb-scoring-platform/README.md), with STM32
acquisition, ESP32 application/display interfaces, isolated USB, USB-C PD, Ethernet, IR, HUB75 and Favero outputs. Its
[design review](usb-scoring-platform/design-review.md) is the authoritative list of remaining findings. It is a
supplier-review draft, not an approved fabrication release.

## Earlier tscircuit carrier

The ESP32 DevKitC/WIZ850io carrier is preserved as the explicitly requested comparison design. Its
[architecture](docs/clean-sheet-board-architecture.md), source and models describe that carrier, not the native board.
Do not mix its BOM, pinout or generated fabrication files with the USB scoring platform.

The following commands operate on that earlier carrier only. For the current board use the native project's
`export-manufacturing.ps1` and its README instructions.

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
