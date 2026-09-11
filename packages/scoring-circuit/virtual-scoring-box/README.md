# Virtual scoring box

Open `virtual-scoring-box.kicad_pro` in KiCad 10. This is a separate, incomplete schematic project, not an orderable
board. The combined `../usb-scoring-platform/` design is frozen for this product split at repository commit
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

The initial project contains the combined design's two acquisition sheets, STM32 sheet and ESP32 sheet, with local
symbol and footprint dependencies. This preserves the known input topology while the reduced product is integrated. It
does not inherit the combined board's verification approval, PCB layout, power firmware, or fabrication package.

1. Integrate USB-C power/data and an appropriately sized isolated supply for **both** processors. The combined board's
   laptop-mode application-power inhibition cannot be reused unchanged. Review source qualification, radio peak current,
   suspend/recovery and wall-charger operation before choosing the supply. Do not automatically retain its 30W
   converter.
2. Extract the existing IR receiver circuit without Ethernet. Remove standalone-only ESP32 signals/reset support;
   replace the inherited fencer/piste header footprints with direct wire solder points. Preserve processor programming
   access.
3. Complete ERC/net review, then place and route a compact PCB. Verify antenna clearance, connector access and every
   footprint/model. Board size is not frozen. No PCB file exists yet; the old 165 x 100mm layout is not this product.
4. Run native checks and review the assembly BOM/placement before producing a supplier package. Validate real power,
   input thresholds, USB and wireless behavior on assembled hardware before use with fencers.

Power/USB/IR sheets are not yet connected. Inherited global labels and power inputs can therefore produce ERC findings;
do not suppress them to present this draft as complete. No new document/evidence validators or firmware forks are
needed.

Initial KiCad CLI netlist export succeeded with 73 components. ERC reports 26 isolated pin labels and three undriven
power inputs in this partial hierarchy; integration and removal of unused signals remain required. This is not a clean
ERC result or a 73-part final BOM. Repository-wide verification was attempted and failed in the coverage run; it is not
evidence of complete validation for this project.
