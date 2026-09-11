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

The schematic contains the two acquisition circuits, STM32, ESP32, input reset-default resistors and TSOP38438 IR
receiver. Twenty-two standalone-only processor connections have been replaced with explicit no-connects. J3/J4/J5 are
bare PCB wire-solder terminations, excluded from the purchased-parts BOM; their provisional 1.2mm drills and wire strain
relief still need assembly review. Unused copied custom symbols and header footprints have been removed.

The native PCB has an initial placement of 90 footprints on a provisional **120 x 85mm, four-layer, 1.6mm** board. It
has no tracks or planes, and the power/USB circuit is not yet included. The ESP32 antenna extends beyond the top edge;
antenna/enclosure clearance still needs review. This project does not inherit the combined board's verification
approval, power firmware, or fabrication package. Provide an actual KiCad 3D screenshot with each board-update
checkpoint.

1. Integrate USB-C power/data and an appropriately sized isolated supply for **both** processors. The combined board's
   laptop-mode application-power inhibition cannot be reused unchanged. Review source qualification, radio peak current,
   suspend/recovery and wall-charger operation before choosing the supply. Do not automatically retain its 30W
   converter.
2. Finish schematic/net review, power-section placement and routing. Verify antenna clearance, connector access and
   every footprint/model. Board size is not frozen; the old 165 x 100mm layout is not this product.
3. Run native checks and review the assembly BOM/placement before producing a supplier package. Validate real power,
   input thresholds, USB and wireless behavior on assembled hardware before use with fencers.

Power and USB are not yet integrated. Do not suppress the resulting ERC findings to present this draft as complete. No
new document/evidence validators or firmware forks are needed.

## Placement checkpoint checks

KiCad netlist export contains 90 components. ERC has seven outstanding findings: USB_DM, USB_DP and USB_PRESENT are
unconnected to the pending USB section, and four power inputs are undriven. The placement check has no schematic/PCB
parity errors or component overlaps. It still reports 229 unrouted connections and two ESP32 silkscreen/edge warnings.
The 0.2mm minimum drill matches the retained ESP32 thermal-via footprint and the combined board's existing fabrication
constraint; it is not a waiver of assembly review.

The latest native render is `output/placement-3d.png`; generated reports and images are local, ignored outputs. This is
an integration checkpoint, not a clean electrical/routing result or a final BOM.

Repository verification reached coverage but did not pass: the existing scoring simulator rebuild integration test
(`apps/scoring/src/observatory-integration.test.ts:126`) exceeded its 5000ms timeout. The scoring run reported 968 tests
passed and one failed; no simulator files were changed for this board checkpoint.
