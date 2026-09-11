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

The native PCB has **154 footprints** on a provisional **120 x 85mm, four-layer, 1.6mm** board. The USB interface uses
GCT USB4105-GF-A, TPD2E2U06DCKR protection, a **CP2102N-A02-GQFN20R USB-to-UART bridge**, and an **ISO7021DR serial
isolator**. **TPS70933DBVR** supplies the laptop-side 3.3V rail and tolerates raw VBUS up to 30V. Its EN pin is
intentionally open using the internal pull-up, never connected directly to high-voltage VBUS. C40 is 4.7uF.

`usb-power-control.kicad_sch` adds **STUSB4500QTR**, **STM32C011F6P6** and **TPS259470ARPWR**. Program and read back a
single **5V / 1.5A sink PDO** before shipment. The eFuse provides automatic-retry current limiting, reverse-current
blocking and adjustable voltage protection. R85 sets approximately 1.21A; C54 gives approximately 25ms for the 5V ramp.
ITIMER is intentionally open for the fastest overcurrent response. Nominal UVLO is 4.04V rising / 3.69V falling; nominal
OVLO is 5.38V rising / 4.91V falling. Divider resistors are 0.1%; temperature, comparator tolerance and fault overshoot
still require review and measurement against the protected parts' limits. Raw-input capacitors are 50V-rated. R76 now
senses only `USB_5V_PROTECTED`, so overvoltage removes the bridge's VBUS indication while its controller stays powered.

**SN74LVC1G3208DBVR** implements `(USB_AWAKE OR USB_SUSPEND_EXEMPT) AND SOURCE_ALLOWED`. **SN74LVC1T45DBVR** translates
the result to protected 5V because SN6505 EN requires 0.7 times VCC. Both qualification outputs have pull-downs; R79
holds the transformer off if the translator is unpowered. An unprogrammed controller therefore cannot energize the
scoring supply. J7 is a bare primary-domain SWD pogo-pad target, not a fitted header.

The isolated processor supply is implemented and locally routed: **SN6505BDBVR**, **Wurth 750315371** 1:1.1 transformer,
two **SS14-E3/61T** rectifiers and **TPS62162DSGR** fixed-3.3V buck regulator. Both processors and the acquisition
circuits share `CORE_3V3`; the IR receiver retains its existing resistor/capacitor supply filter. The design target is
0.8A combined load, below the buck's 1A rating, not a measured whole-supply rating. The 2.2uH XAL5030-222MEC and two
10uF output capacitors follow the regulator's recommended LC range. The regulator's power-good output holds STM32 reset
low until the output is valid. A 10k output resistor provides a discharge path.

The transformer enable has a default-off pull-down. Its protected 5V input and qualified-source/suspend enable are
connected through PCB copper to the USB-C power-control section. Neither is tied directly to raw USB VBUS. USB_GND and
scoring GND remain separate, including their copper pours. Only the affected piste trace segment was moved to the back
layer to clear the new supply. Low-input-voltage operation, radio load steps, temperature, power-down time and system
insulation still need bench verification. Component insulation ratings alone do not establish FIE compliance.

The bridge replaces the ISOUSB111. It can enumerate independently of the scoring processors and exposes `USB_AWAKE` from
its active-low suspend output. A 10k pull-down keeps this signal low while reset leaves it floating. This gives the
power circuit a hardware USB-sleep signal; it does **not** by itself qualify the source or complete the whole-board
suspend budget. The isolator defaults to UART idle-high. Pinouts, supply arrangements and the QFN land pattern were
reviewed against the rendered manufacturer drawings:
[Silicon Labs CP2102N](https://www.silabs.com/documents/public/data-sheets/cp2102n-datasheet.pdf) and
[TI ISO7021](https://www.ti.com/lit/ds/symlink/iso7021.pdf).

The laptop link is STM32 **USART2, PA2 TX / PA15 RX, AF7**, separate from USART1 to ESP32 and SWD. PA11/PA12 native USB
and the obsolete USB_PRESENT input are now explicitly unused. Desktop software needs the CP210x VCP driver and a serial
transport adapter; native STM32 USB DFU is **not connected**. Initial programming/recovery remains through SWD and the
ESP32 service header. Shared-source application updates need the board-specific serial adapter. Use framed,
sequence-numbered messages with bounded queues and flow control in the protocol; hardware RTS/CTS and USB remote wake
are not connected. The hardware bridge supports up to 3 Mbaud, but firmware throughput has not been validated.

All schematic connections are now routed. In1.Cu provides separate scoring and USB-side ground regions; In2.Cu carries
the corresponding 3.3V pours and selected signal routes. Two low-current source-controller supply joins use In1.Cu in
the control area, outside the USB data corridor. Raw VBUS and protected 5V use separate back-layer pours, with explicit
eFuse input/output necks and bridges between separated copper regions. USB D+ stays on the front layer; D- has a short
back-layer crossing with nearby ground stitching at both transitions. This is full-speed USB routing, not a measured USB
compliance result. The lower-left area contains the USB interface and isolated power stage. The ESP32 antenna extends
beyond the top edge; antenna/enclosure clearance still needs review. This project does not inherit the combined board's
verification approval, power firmware, or fabrication package. Provide an actual KiCad 3D screenshot with each
board-update checkpoint.

1. Finish the primary-side sleep-current and voltage/current tolerance review, then verify antenna clearance and
   connector access. The virtual-board source-control configuration is implemented and host-tested; its physical power
   behavior is not measured. Board size is not frozen; the old 165 x 100mm layout is not this product.
2. Review whether the same-rail UART translators can be removed without changing reset behavior, and review every
   footprint/model and the assembly BOM/placement before producing a supplier package. R69, R74 and R77 were moved to
   clear their ground/USB routing; component identities and pin nets are unchanged. Rerun native checks after changes.
3. Implement the board-specific STM32 serial adapter/shared application firmware, then validate real power, input
   thresholds, USB and wireless behavior on assembled hardware before use with fencers. Application development does not
   require the physical PCB, but successful host tests alone cannot qualify an assembled scoring machine.

USB data-interface placement, the isolated power stage, source-control hardware/firmware and PCB routing are
implemented; assembly release and physical qualification are not complete. Preserve the existing compatibility promise
of advertised Type-C current at least 1.5A **or** a qualified 5V/1.5A PD contract unless the user approves narrowing it.
A direct-current-advertisement-only design could omit PD negotiation and the separate power-control processor, but that
is an unapproved compatibility change, not the current specification. The smaller supply must power both STM32 and
ESP32; the combined board's STM32-only laptop budget is insufficient. Do not suppress pending power/connection findings.
No new document/evidence validators or firmware forks are needed.

The power firmware must combine source qualification with the bridge's sleep signal: no qualified source means the
scoring supply stays off; a source requiring USB suspend allows it only while USB is awake. Qualified sources exempt
from USB suspend, including an appropriate wall charger, must support wireless operation without USB enumeration.
Preserve the existing 5V PD compatibility; do not substitute a direct-Type-C-only policy. The hardware gate is routed
and the shared [power-controller source](../../../apps/scoring/firmware/power-control/README.md) now builds a
virtual-board image. PA4 outputs SOURCE_ALLOWED, PA5 outputs USB_SUSPEND_EXEMPT. PD alert, eFuse fault, USB_AWAKE and a
nominal 32ms RTC alarm wake Stop0. A requested RDO exemption alone is not permission; the firmware checks the fresh
source flags. The virtual image never enables the combined board's 20V/display profile. Factory-program U24 using the
virtual image, not the combined image, and configure/read back U23's single 5V/1.5A NVM PDO separately.

## Current checkpoint checks

KiCad netlist export contains **154 components**, including bare wire/service pads. ERC reports **zero findings**.
Native DRC reports **zero violations**, **zero schematic/PCB parity issues**, and **zero unconnected items**. Unused
routing tails were removed. The rule floor is **0.15mm track / 0.15mm clearance**, with wider ordinary routes and power
copper. This is above [JLCPCB's published multilayer 1oz trace/space minimum](https://jlcpcb.com/capabilities/Capab); it
does not waive isolation, current-carrying capacity or assembly review. Local 0.5mm vias use 0.25mm drills. An
edge-specific ESP32 footprint clips only off-board silkscreen; its pads, manufacturer model and antenna keepout are
unchanged. The 0.2mm minimum drill matches the retained ESP32 thermal-via footprint and the combined board's existing
fabrication constraint; it is not a waiver of assembly review.

The latest native render is `output/routed-board-3d.png`; generated reports and images are local, ignored outputs. This
is a clean native routing checkpoint, not a firmware release, bench result, final BOM or permission to order.

The CP2102N footprint uses KiCad's Silicon Labs QFN20 land pattern and a retained, unmodified
[KiCad StepUp package model](https://gitlab.com/kicad/libraries/kicad-packages3D/-/blob/6.0.11/Package_DFN_QFN.3dshapes/SiliconLabs_QFN-20-1EP_3x3mm_P0.5mm.step).
The model retains its copyright and CC BY-SA 4.0 notice with the KiCad electronic-design exception. It is a package
model, not a manufacturer assembly approval.

T1 uses Wurth's exact manufacturer symbol, footprint and STEP model from the
[WE-PPTI product library](https://www.we-online.com/en/components/products/WE-PPTI?sq=750315371), with only local
library/model paths changed. Its six-pad land pattern and pin ordering were checked against the rendered
[750315371 drawing](https://www.we-online.com/components/products/datasheet/750315371.pdf). The converter was checked
against [SN6505B](https://www.ti.com/lit/ds/symlink/sn6505b.pdf),
[TPS62162](https://www.ti.com/lit/ds/symlink/tps62162.pdf) and [SS14](https://www.vishay.com/docs/88746/ss12.pdf)
manufacturer documentation. Supply, distribution and reset/enable connections have no remaining native connectivity
findings. Physical startup, fault, suspend, load-step and temperature tests remain necessary.

Source-control pin/function review uses [STUSB4500](https://www.st.com/resource/en/datasheet/stusb4500.pdf),
[STM32C011](https://www.st.com/resource/en/datasheet/stm32c011f4.pdf),
[TPS25947](https://www.ti.com/lit/ds/symlink/tps25947.pdf), [TPS709](https://www.ti.com/lit/ds/symlink/tps709.pdf),
[OR-AND gate](https://www.ti.com/lit/ds/symlink/sn74lvc1g3208.pdf) and
[enable translator](https://www.ti.com/lit/ds/symlink/sn74lvc1t45.pdf). The eFuse uses the correct ten-pin RPW model
[provided by TI](https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/982334/tps25947-step-file),
not the unrelated twenty-pin download reported in that thread. Its STEP assembly already supplies the seating transform;
no extra rotation or height offset is applied.

The routing checkpoint ran `pnpm verify`: format, lint, types, unused-code, change and circuit-simulation checks passed.
All 47 scoring test files / 969 tests passed, but scoring coverage failed its global 100% gate: lines 96.09%, statements
95.44%, branches 93.78%, functions 99.79%. This is not a clean repository verification result. No scoring firmware or
simulator files were changed for this routing checkpoint; the coverage shortfall remains separate from the clean native
PCB checks.

The subsequent power-firmware checkpoint passes all three native power suites and the complete C/C++ coverage gate.
Power policy / target adapter have 100% line/function coverage and 95.05% / 95.74% branch coverage; all scoring-core
metrics remain 100%. Both MCU images cross-build (3096 bytes code, 72 bytes static RAM). Full repository verification
still fails the same scoring TypeScript coverage gate, not a C test failure. The virtual image is not yet flashed or
electrically qualified.
