# Virtual scoring box

Open `virtual-scoring-box.kicad_pro` in KiCad 10. This is a separate, incomplete schematic and PCB project, not an
orderable board. The combined `../usb-scoring-platform/` design is frozen for this product split at repository commit
`ea7c3af023e6ad69eb4b2c7591a94a8ba3619fca`; do not change it while developing this board. Its supplier draft remains
paused.

## Product boundary

- STM32 determines foil, epee and sabre touches. The laptop displays results and controls the bout; network arrival time
  never determines contact timing. Timestamped conductor events may also be exported for development and diagnostics.
- ESP32 handles Wi-Fi/Bluetooth connectivity and the same IR remote as the future standalone model. Both processors must
  be powered in USB and wireless operation. Share firmware source and the C17 scoring core, with board-specific
  configuration.
- One USB-C port provides laptop power/data or wall-charger power for wireless use. Retain the adequately powered USB-C
  source requirement; universal USB-A adapter operation is not promised.
- Left and right enclosure-mounted ABC sockets connect by soldered wires to opposite sides of the PCB. The piste socket
  also connects by soldered wire. Provide strain relief; the piste reference is not protective earth.
- Retain accessible STM32 SWD and ESP32 programming/recovery interfaces. Same update approach as the standalone product.
- No Ethernet, Favero outputs, HUB75, audio, or high-power display supply.

## Current state and next work

The schematic contains the two acquisition circuits, STM32, ESP32, input reset-default resistors, TSOP38438 IR receiver,
and a USB-C data interface. Twenty-two standalone-only processor connections have been replaced with explicit
no-connects. J3/J4/J5 are bare PCB wire-solder terminations, excluded from the purchased-parts BOM; their provisional
1.2mm drills and wire strain relief still need assembly review. Unused copied custom symbols and header footprints have
been removed.

The native PCB has **98 footprints** on a provisional **120 x 85mm, four-layer, 1.6mm** board. The USB interface uses
GCT USB4105-GF-A, TPD2E2U06DCKR data-line protection, and an ISOUSB111DWR full-speed data isolator with local bypass
capacitors. Both isolator sides use externally regulated 3.3V; their supplies are still pending. Pin 12 is the
downstream pull-up-enable input and is tied to CORE_3V3, not treated as a suspend-status output. Pin mapping and supply
connections were reviewed against [TI's ISOUSB111 datasheet](https://www.ti.com/lit/ds/symlink/isousb111.pdf), including
the rendered pin table.

A first signal-routing pass, a scoring-side In1.Cu ground pour and 59 short ground-pad taps are present. The pour and
signal routing leave the lower-left primary-side power area clear. The 50 selected non-power/non-USB signal nets are
only partially routed; ground-pad connections, USB pairs and power distribution remain unfinished. The ESP32 antenna
extends beyond the top edge; antenna/enclosure clearance still needs review. This project does not inherit the combined
board's verification approval, power firmware, or fabrication package. Provide an actual KiCad 3D screenshot with each
board-update checkpoint.

1. Integrate USB-C power/data and an appropriately sized isolated supply for **both** processors. The combined board's
   laptop-mode application-power inhibition cannot be reused unchanged. Review source qualification, radio peak current,
   suspend/recovery and wall-charger operation before choosing the supply. Do not automatically retain its 30W
   converter.
2. Finish schematic/net review, power-section placement and routing. Verify antenna clearance, connector access and
   every footprint/model. Board size is not frozen; the old 165 x 100mm layout is not this product.
3. Run native checks and review the assembly BOM/placement before producing a supplier package. Validate real power,
   input thresholds, USB and wireless behavior on assembled hardware before use with fencers.

USB data-interface placement is implemented, but power is not integrated. Preserve the existing compatibility promise of
advertised Type-C current at least 1.5A **or** a qualified 5V/1.5A PD contract unless the user approves narrowing it. A
direct-current-advertisement-only design could omit PD negotiation and the separate power-control processor, but that is
an unapproved compatibility change, not the current specification. The smaller supply must power both STM32 and ESP32;
the combined board's STM32-only laptop budget is insufficient. Do not suppress pending power/connection findings. No new
document/evidence validators or firmware forks are needed.

The ISOUSB111 does not inherit the combined board's LTM2884 automatic isolated-power shutdown. Its whole-board
PD-suspend power budget, including ESP32 and the isolated converter, remains unresolved. Do not finalize the power
section or call the USB interface qualified until this is addressed. The direct Type-C current-advertisement-only
alternative is awaiting a user decision; it has not been adopted.

## Current checkpoint checks

KiCad netlist export contains 98 components. ERC has nine outstanding findings: USB_PRESENT, USB_CC1 and USB_CC2 await
the power section, and six power inputs are undriven. Native DRC reports **zero copper/placement violations**, **zero
schematic/PCB parity issues**, and **107 unconnected items**. This is not a clean routing result. An edge-specific ESP32
footprint clips only off-board silkscreen; its pads, manufacturer model and antenna keepout are unchanged. The 0.2mm
minimum drill matches the retained ESP32 thermal-via footprint and the combined board's existing fabrication constraint;
it is not a waiver of assembly review.

The latest native render is `output/signal-routing-3d.png`; generated reports and images are local, ignored outputs.
This is an integration checkpoint, not a clean electrical/routing result or a final BOM.

Repository verification used the same checks with formatting in read-only `--check` mode to preserve other projects'
active edits. Format, lint, types, unused-code and change checks passed. Coverage did not pass: the existing
`apps/scoring/src/epee-state-machine-audit.test.ts` committed-source audit exceeded its 5000ms timeout. The scoring run
reported 968 tests passed and one failed. Rerunning that audit alone passed all four tests; the whole coverage run is
not claimed clean. No scoring firmware or simulator files were changed for this checkpoint.
