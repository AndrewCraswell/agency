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

The native PCB has **107 footprints** on a provisional **120 x 85mm, four-layer, 1.6mm** board. The USB interface uses
GCT USB4105-GF-A, TPD2E2U06DCKR protection, a **CP2102N-A02-GQFN20R USB-to-UART bridge**, and an **ISO7021DR serial
isolator**. TLV75533PDBVR supplies the laptop-side 3.3V rail. The scoring-side supply is not integrated yet.

The bridge replaces the ISOUSB111. It can enumerate independently of the scoring processors and exposes `USB_AWAKE` from
its active-low suspend output. A 10k pull-down keeps this signal low while reset leaves it floating. This gives the
pending power circuit a hardware USB-sleep signal; it does **not** by itself qualify the source or complete the
whole-board suspend budget. The isolator defaults to UART idle-high. Pinouts, supply arrangements and the QFN land
pattern were reviewed against the rendered manufacturer drawings:
[Silicon Labs CP2102N](https://www.silabs.com/documents/public/data-sheets/cp2102n-datasheet.pdf) and
[TI ISO7021](https://www.ti.com/lit/ds/symlink/iso7021.pdf).

The laptop link is STM32 **USART2, PA2 TX / PA15 RX, AF7**, separate from USART1 to ESP32 and SWD. PA11/PA12 native USB
and the obsolete USB_PRESENT input are now explicitly unused. Desktop software needs the CP210x VCP driver and a serial
transport adapter; native STM32 USB DFU is **not connected**. Initial programming/recovery remains through SWD and the
ESP32 service header. Shared-source application updates need the board-specific serial adapter. Use framed,
sequence-numbered messages with bounded queues and flow control in the protocol; hardware RTS/CTS and USB remote wake
are not connected. The hardware bridge supports up to 3 Mbaud, but firmware throughput has not been validated.

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

The next power implementation must combine source qualification with the bridge's sleep signal: no qualified source
means the scoring supply stays off; a source requiring USB suspend allows it only while USB is awake. Qualified sources
exempt from USB suspend, including an appropriate wall charger, must support wireless operation without USB enumeration.
Preserve the existing 5V PD compatibility; do not substitute a direct-Type-C-only policy. This hardware gate and the
primary-side low-power firmware budget remain unfinished.

## Current checkpoint checks

KiCad netlist export contains 107 components. ERC has eight outstanding findings: USB_CC1 and USB_CC2 await the power
section, and six power inputs are undriven. Native DRC reports **zero copper/placement violations**, **zero
schematic/PCB parity issues**, and **133 unconnected items**. The increase includes new USB support connections; no
completed routing is claimed. Four obsolete ground taps and their unused vias were removed with the old USB isolator. An
edge-specific ESP32 footprint clips only off-board silkscreen; its pads, manufacturer model and antenna keepout are
unchanged. The 0.2mm minimum drill matches the retained ESP32 thermal-via footprint and the combined board's existing
fabrication constraint; it is not a waiver of assembly review.

The latest native render is `output/usb-bridge-3d.png`; generated reports and images are local, ignored outputs. This is
an integration checkpoint, not a clean electrical/routing result or a final BOM.

The CP2102N footprint uses KiCad's Silicon Labs QFN20 land pattern and a retained, unmodified
[KiCad StepUp package model](https://gitlab.com/kicad/libraries/kicad-packages3D/-/blob/6.0.11/Package_DFN_QFN.3dshapes/SiliconLabs_QFN-20-1EP_3x3mm_P0.5mm.step).
The model retains its copyright and CC BY-SA 4.0 notice with the KiCad electronic-design exception. It is a package
model, not a manufacturer assembly approval.

At the preceding routing checkpoint, repository verification used formatting in read-only `--check` mode to preserve
other projects' active edits. Format, lint, types, unused-code and change checks passed. Coverage did not pass: the
existing `apps/scoring/src/epee-state-machine-audit.test.ts` committed-source audit exceeded its 5000ms timeout. The
scoring run reported 968 tests passed and one failed. Rerunning that audit alone passed all four tests; the whole
coverage run is not claimed clean. No scoring firmware or simulator files were changed for this checkpoint.
