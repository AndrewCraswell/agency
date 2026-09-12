# Virtual scoring box

Open `virtual-scoring-box.kicad_pro` in KiCad 10. This separate development PCB is routed and has an assembly-review
export; it has not been released to a manufacturer. The combined `../usb-scoring-platform/` design is frozen at commit
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

The native PCB has **146 footprints**, including **142 purchased components**, on a **120 x 85mm, four-layer, 1.6mm**
board. The USB interface uses GCT USB4105-GF-A, TPD2E2U06DCKR protection, a **CP2102N-A02-GQFN20R USB-to-UART bridge**,
and an **ISO7021DR serial isolator**. **TPS70933DBVR** supplies the laptop-side 3.3V rail and tolerates raw VBUS up to
30V. Its EN pin is intentionally open using the internal pull-up, never connected directly to high-voltage VBUS. C40 is
4.7uF.

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
scoring GND remain separate, including their copper pours. The piste connection clears the supply on the front layer.
Low-input-voltage operation, radio load steps, temperature, power-down time and system insulation still need bench
verification. Component insulation ratings alone do not establish FIE compliance.

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

STM32 USART1 connects directly to ESP32 on the shared 3.3V rail: `STM_TX` to ESP RX and `STM_RX` to ESP TX. Same-rail
translators U10/U11 and their redundant C23-C26/R30/R31 support were removed. R72/R73 retain idle-high reset defaults;
C22/C27 remain at the ESP32 supply. The removed parts' copper, custom symbol and footprint were also removed.

All schematic connections are routed. In1.Cu contains only the separate scoring and USB ground planes: all 33 former
power-track segments on that layer were removed. In2.Cu carries the corresponding 3.3V regions and ordinary signal
routes. Raw VBUS and protected 5V retain separate back-layer pours and explicit eFuse input/output joins. The USB bridge
and protection device face the connector directly. Both data nets have two vias for the short USB-C duplicated-contact
joins; the main data routes remain on the front. The back joins have a local, stitched USB-ground reference on In2.Cu.
Local via antipads remain; this is not a measured USB-compliance result.

The regulator, inductor and output capacitors form a compact group with a direct top-layer ground return. Output sensing
is separated from the switching node. Y1 and its load capacitors sit beside the STM32 oscillator pins: both crystal nets
stay on the front, with no vias and 6.90/9.48mm total drawn HSE_IN/HSE_OUT copper, including capacitor branches.

The placement refinement puts J2 beside STM32 and J6 beside ESP32, with the ESP reset/boot buttons grouped beside J6.
The seven input-load resistors sit beside their STM32 pins; repeated driver/default resistors form orderly local rows.
Twenty-five components moved relative to `f9809c1`; all 146 footprint identities, values and pad/net assignments are
unchanged. External connectors, board outline, ESP32 antenna position, USB data, crystal and switching-loop geometry
remain unchanged. In1.Cu still has no signal or power tracks. The antenna extends beyond the top edge; the final
enclosure must leave it clear.

The surface-routing pass preserves every component position and pad/net assignment. **LEFT_A, LEFT_C, RIGHT_A, RIGHT_B,
RIGHT_C and PISTE** now run entirely on F.Cu. LEFT_B retains its shorter front/back path; forcing it onto the front
produced an excessive detour. Four control networks no longer use In2.Cu: LEFT_C_DRIVE, RIGHT_C_DRIVE, PISTE_OE_N and
SWDIO. Tight processor escapes remain internal where a front-only path would be obstructed or longer. The reset button
has a short, dedicated connection to the scoring ground plane. Redundant signal vias were removed.

Relative to the preceding branding checkpoint, In2.Cu track length falls from **772.930mm to 681.571mm** (11.8%); its
share of total track length falls from **24.2% to 21.4%**. F.Cu carries 1472.575mm and B.Cu 1029.816mm. Total drawn
track length is **3183.962mm**, down from 3198.362mm; there are **1618 segments and 366 vias**, down from 1629 and 377.
In1.Cu remains ground-plane-only. These are CAD measurements, not propagation delays, measured electrical performance,
or proof of a globally optimal layout. Shorter aggregate routing does not mean every individual net is shorter.

White silkscreen identifies STM32, ESP32, the IR receiver, left/right inputs, USB-C, piste, A/B/C wire pads, service
headers and reset/boot controls. J2/J6 have individual pin labels. The product marking is **FENCING CLUB**, **VIRTUAL
SCORING BOX**, and **USB + WIRELESS**. The piste termination says only **PISTE**; the electrical safety distinction
remains in this documentation. Omit code-only component labels and lookup legends from the silkscreen; full component
references remain on the fabrication drawing. Text meets the enabled 0.8mm minimum and clears solder pads and board
edges. Provide an actual KiCad 3D render with each board-update checkpoint.

The native stackup now specifies [JLC04161H-3313](https://jlcpcb.com/impedance): nominal 1.6mm four-layer construction,
35um outer / 15.2um inner copper, 0.0994mm outer prepregs (Dk 4.1), and a 1.265mm core (Dk 4.6). Select this exact
stackup in the fabrication draft. Do not substitute the default 7628 stackup silently. The 0.20mm USB trace geometry is
a design target, not a fabricator-confirmed 90-ohm result; JLCPCB's online calculation currently returns no width
result. Electrical USB verification remains a bench requirement.

1. Finish the primary-side sleep-current and voltage/current tolerance review, then verify antenna clearance and
   connector access. The virtual-board source-control configuration is implemented and host-tested; its physical power
   behavior is not measured. Board size is not frozen; the old 165 x 100mm layout is not this product.
2. Complete supplier matching, placement orientation and assembly/programming acceptance using this board's export, not
   the combined board's paused order. All 142 purchased parts have manufacturer/MPN/footprint fields and matching
   placement rows. All purchased components have resolvable package models. The bare solder/pogo targets have no model
   and are excluded from both BOM and placement. Use the revised J2/J6 locations when reviewing programming fixtures.
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

KiCad contains **146 components**, including four bare wire/service targets. ERC reports **zero findings**. Native DRC
reports **zero violations**, **zero schematic/PCB parity issues**, and **zero unconnected items**. Unused routing tails
were removed. The rule floor is **0.15mm track / 0.15mm clearance**, with wider ordinary routes and power copper. This
is above [JLCPCB's published multilayer 1oz trace/space minimum](https://jlcpcb.com/capabilities/Capab); it does not
waive isolation, current-carrying capacity or assembly review. Local 0.5mm vias use 0.25mm drills. An edge-specific
ESP32 footprint clips only off-board silkscreen; its pads, manufacturer model and antenna keepout are unchanged. The
0.2mm minimum drill matches the retained ESP32 thermal-via footprint and the combined board's existing fabrication
constraint; it is not a waiver of assembly review.

The native custom rule also passes a **2mm minimum copper-clearance screen** between primary USB/power/control nets and
scoring-side nets, including intentionally unconnected primary package pads. This is an engineering layout floor, not a
FIE requirement, dielectric test, interlayer insulation rating or measured surface-creepage result. Physical insulation
qualification remains separate from ordinary PCB DRC.

The manufacturing exporter includes fresh `board-top-3d.png` and `board-bottom-3d.png` renders in its output directory.
Generated reports and images are local, ignored outputs. This is a clean native CAD/assembly-export checkpoint, not a
firmware release, bench result or permission to order. U22 uses the installed KiCad WSON-8 2x2mm, 0.5mm-pitch package
model; its obsolete `Texas_DSG0008A_` model filename was corrected without changing its footprint or placement.

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

## Assembly handoff

Run `./export-manufacturing.ps1` with KiCad 10 and LLVM/Clang available. It creates a new output directory, runs native
ERC/DRC/parity checks, exports the exact BOM and matching placements, Gerbers, plated/non-plated drills and an assembly
PDF, and builds the **virtual** U24 image from current source. Gerbers, drills and placements share the lower-left
auxiliary origin (board coordinates 50,135mm); exported component positions use positive X/Y millimetres. The four
copper layers are F.Cu, In1.Cu, In2.Cu, B.Cu. Minimum drill is 0.2mm; the USB shell uses plated slots. Request standard
green solder mask and white silkscreen for this prototype. A 3D colour is not a manufacturing order option.

- Fit all 142 BOM parts, including through-hole J2/J6 and U13. Do not substitute parts or rotate them from generic
  catalog previews without checking pin 1 against the native pad map. The Gerber ZIP is bare-board data, not assembly
  instructions; send BOM, placement and programming requirements separately when an order is authorized.
- J3/J4/J5 are seven bare 1.2mm plated wire holes. J7 is five bare primary-domain SWD pads. Do not buy or fit connectors
  at these references. Enclosure-mounted ABC/piste sockets, wire gauge, harness length and strain relief are not defined
  by the PCB BOM. Keep left/right wiring distinct. Leave clearance around the USB cable, IR window and ESP32 antenna.
- Program/read back **U24 STM32C011** through J7 with the included `programming/U24/power-control.hex`. Use USB_GND for
  this primary-side probe and do not inject voltage through its reference pin. Configure/read back **U23 STUSB4500** NVM
  for one 5V/1.5A sink PDO using ST's programming procedure. Volatile runtime configuration is not a factory NVM image.
  The assembler must confirm the fixture/programming service; it is not implied by an SMT assembly quote.
- J2 is the isolated STM32 scoring MCU's SWD; J6 is ESP32 3.3V UART recovery. Do not bridge their scoring GND to USB_GND
  with non-isolated programming equipment during isolation tests. No complete virtual-box scoring/application image is
  included yet; the combined STM32 image's PA2 output configuration is not the virtual USART2 adapter.
- After assembly, test cold-start, source changes, USB suspend/resume, rejected low-power sources, fault shutdown, radio
  load steps, temperatures, acquisition thresholds and insulation before connecting fencers. Factory electrical
  continuity and host software tests do not replace these measurements.

The primary-side suspend review is not a worst-case compliance proof. TPS25947 specifies 610uA maximum on-state
quiescent current; CP2102N gives 195uA **typical**, excluding USB pull-up current; STUSB4500's 210uA maximum is for
**unattached/no communication**, not an active PD session. STM32C011 Stop current, LSI/RTC/watchdog overhead, wake duty,
resistor dividers and bus pull-ups must also be included. In particular, a stuck-low PD alert can prevent Stop. Measure
the complete input current under the source's actual suspend policy; do not add typical values and label the sum a
guaranteed limit. References: [CP2102N](https://www.silabs.com/documents/public/data-sheets/cp2102n-datasheet.pdf),
[STUSB4500 table 22](https://www.st.com/resource/en/datasheet/stusb4500.pdf),
[STM32C011 table 31](https://www.st.com/resource/en/datasheet/stm32c011f4.pdf),
[TPS25947](https://www.ti.com/lit/ds/symlink/tps25947.pdf).

### JLCPCB validation draft

The [current virtual-box draft](https://cart.jlcpcb.com/smt-order/?pcbFileNo=0d7e87fc3bcf4669aeb7055e406425c1) is
**unsubmitted, unpaid and not order-ready**. On 2026-09-12, JLCPCB accepted the revised Gerbers, BOM and placement file
from `output/assembly-surface-routing/`. The ZIP SHA-256 is
`5745D27C666B6909F49E156D7E74235956336AD4D5BFBD7E9C590D7966547863`. The older `9436ff25...` and `c45d113d...` drafts are
obsolete for this layout; keep the frozen combined-board draft separate. The programming feasibility package remains
associated with the earlier review, not newly approved.

Do not contact JLCPCB support, send follow-up messages, or request additional sourcing/programming quotations without
the user's explicit permission. Continue local validation and self-service draft checks only. Do not submit or pay.

- Five bare boards, two assembled; Standard PCBA, all components on top; 120 x 85mm finished, 1.6mm FR-4, green mask,
  white legend, ENIG, 1oz outer / 0.5oz inner copper. **JLC04161H-3313** is selected, with F.Cu / In1.Cu / In2.Cu / B.Cu
  in that order. JLCPCB adds two 5mm rails; depaneling is selected.
- Epoxy-filled/capped vias are requested. U2 has twelve 0.2mm thermal holes and U22 has two. Fill/cap only the
  0.2/0.25/0.3mm via groups, not USB slots, connector, wire or locating holes. Confirm this in the production files.
- Production-file and placement confirmation are required, with automatic confirmation disabled.
- JLCPCB parsed the revised board as four layers, 120 x 85mm. Its explicit copper order is F.Cu / In1.Cu / In2.Cu /
  B.Cu. The 0.2mm drill setting also selects four-wire Kelvin testing and TG155. The displayed $110.63 is still the
  bare-PCB quote, not a complete assembled-board price.
- The original automatic match incorrectly assigned eight 1uF capacitors to Walsin **80pF** parts C3868041. All eight
  matches were corrected to the intended TDK identity. C45537494 is the exact-name catalog entry but has incomplete
  package/category data and zero stock; its appearance in a matched/selected row is **not sourcing approval**.
  [TDK specifies 1uF, 50V, X7R, 10%, 0603](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C1608X7R1H105K080AB).
- R82/R84's invalid ordering identity was corrected in the schematic, PCB and supplier draft to
  [Panasonic ERA3AEB103V](https://industrial.panasonic.com/ww/products/pt/high-precision-chip-resistors/models/ERA3AEB103V):
  10kOhm, 0.1%, 25ppm/K, 0.1W, 0603. Their values, pads and routing did not change. C190610 was in stock and both
  references were selected. The new upload initially left J1 USB4105-GF-A/C3020560 at quantity zero. Reselecting the
  exact GCT part corrected this to quantity two; JLCPCB showed 1,571 in stock. Its $0.03-per-piece special-assembly
  notice is a disclosed handling fee, not permission to omit the connector.
- R88 (`PD_ALERT_N`) and R92 (`FUSE_FAULT_N`) now use stocked **Yageo AF0603FR-0747KL / C144107** in place of the
  unavailable RC0603FR-0747KL. Both are 3.3V pull-ups, not voltage-setting dividers. Resistance remains 47kOhm, 1%,
  100ppm/K, 0.1W, 75V, 0603; pads and routing are unchanged. Nominal asserted-low dissipation is only 0.232mW.
  [Yageo's AF specification, pages 2, 4 and 5](https://yageogroup.com/content/datasheet/asset/file/pyu-af_51_rohs_l)
  confirms ordering, dimensions and ratings. JLCPCB showed 6,246 in stock and selected both references at a combined
  procurement quantity of 20 for $0.2240. This clears two reference shortages without changing circuit behavior.
- The schematic and PCB record explicit JLCPCB identities for twelve references, and the exporter carries them in
  `JLCPCB Part #`. This prevents the known automatic mis-match on re-upload; it does not approve a substitution or
  establish available inventory. Review every supplier line again after any BOM upload.

The retained draft contains 142 BOM references / 48 MPNs and 142 matching placements. All 142 requested identities match
their supplier identities after normalizing punctuation; this is an identity screen, not datasheet or placement
approval. JLCPCB confirms 117 references and flags **25 references with inventory shortages**. Advancing to placement
review offers to leave unavailable parts unpopulated. That option was rejected: no required component has been waived.
Supplier placement approval, assembly/programming acceptance and the complete price remain open. This was rechecked on
the new draft: the next step offers **Do not place**, which would omit required parts. That option was not accepted. No
order, payment, new sourcing request or support message was sent during this draft refresh.

The current local review export is `output/assembly-surface-routing/`, generated together with
`export-manufacturing.ps1`: thirteen Gerber/drill files, 142 BOM rows, matching placements and top/bottom 3D renders.
BOM identities are unchanged from the stock review; prior placement/fabrication hashes are obsolete. Generated exports
remain local and ignored, not a release authorization. This exact export is now uploaded to the current draft above.

Fresh KiCad ERC, DRC, unconnected and parity counts are all zero under the enabled rules; top/bottom 3D renders and
local copper views were inspected. The virtual U24 image cross-builds unchanged at 3096 bytes code / 72 bytes RAM.
Scoring-circuit types and tests passed (2 files / 13 tests); lint and all eight existing ngspice models also passed.
These models do not simulate the revised PCB parasitics. The surface-routing update preserves component placement, pad
geometry, USB data, crystal and power-switching copper. The refreshed `pnpm verify` passes its check stage, then fails
the scoring application's existing 100% coverage gate: 96.09% lines, 99.79% functions, 95.44% statements and 93.78%
branches. No application source or coverage thresholds changed in this PCB-only update; no full-repository pass is
claimed.

The unresolved procurement list below is **25 board references / 12 part types**, not 25 extra pieces. JLCPCB purchase
quantities also include assembly attrition and minimum-order quantities. Both the reference list and numeric shortfalls
below were rechecked in the refreshed draft on 2026-09-12. Recheck stock and price before release.

| References                            | Required MPN         | JLCPCB identity | Remaining sourcing issue                                                                          |
| ------------------------------------- | -------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| C1, C15, C21, C33, C39, C49, C50, C52 | C1608X7R1H105K080AB  | C45537494       | 20-piece shortfall; incomplete catalog package/rating data requires manual sourcing confirmation. |
| C12                                   | C1608X7R1H103K080AA  | C2180830        | 19-piece current shortfall.                                                                       |
| C14                                   | C1608X7S1A475K080AC  | C5331011        | 5-piece quoted shortfall.                                                                         |
| C17, C18                              | CGA3E2C0G1H270J080AA | C193086         | 8-piece quoted shortfall.                                                                         |
| C22                                   | C1608X5R1C106M080AB  | C2167896        | 2-piece current shortfall.                                                                        |
| C41-C46                               | C3216X7R1C106K160AC  | C2167646        | 16-piece quoted shortfall.                                                                        |
| J2                                    | HTSW-105-07-L-S      | C6571098        | 2-piece quoted shortfall; through-hole assembly required.                                         |
| J6                                    | HTSW-106-07-L-S      | C3324216        | 2-piece quoted shortfall; through-hole assembly required.                                         |
| R81                                   | ERA3AEB2372V         | C2074741        | 6-piece quoted shortfall.                                                                         |
| R83                                   | ERA3AEB3482V         | C2074547        | 20-piece quoted shortfall.                                                                        |
| T1                                    | 750315371            | C5184247        | 5-piece quoted shortfall; do not substitute an arbitrary transformer.                             |
| U26                                   | SN74LVC1G3208DBVR    | C2682152        | 3-piece current shortfall.                                                                        |

An exact-family stock search for U26 found only two TI DBVR pieces, no idle/private stock, and no TI DBVT stock
(`C2862830`). The stocked `SN74LVC1G3208DBVR-TP / C51939611` is a **TECHPUBLIC** part, not an alternate reel of the
specified TI device; it was not selected. Procurement of exact parts or a separately verified substitution is still
needed. Do not reduce attrition quantities or clear these warnings by leaving required positions empty.

Non-purchasing parts quotation **XOB2026091200835** was submitted on 2026-09-12 for these 13 identities. The site's
quantity-entry handler failed (`this.minNumber is not a function`): entered quantities appeared in the form but the
saved request retained one per line. The quote is therefore **not a usable build quotation**. Support was sent the
correction list: C45537494=20, C2180830=20, C5331011=5, C193086=8, C2167896=5, C2167646=16, C6571098=2, C3324216=2,
C2074741=6, C2074547=20, C105579=20, C5184247=5, C2682152=5. These are total required procurement quantities including
the draft's attrition, not just the shortfalls above. The C105579 request is now obsolete because R88/R92 were replaced
with stocked C144107. Do not buy that old line. No checkout or payment was authorized. No new support contact was made
during the stock substitution review.

Read-only Global Sourcing checks found exact 750315371 transformers at about $3.63 each (Element14_UK, minimum five),
the exact 1uF TDK capacitor at about $0.183 each (Element, minimum ten), and J2's exact Samtec header via DigiKey with a
one-piece minimum. These listings suggest procurement can retain the design, but are not stocked-assembly commitments or
landed quotes. No items were added to the existing sourcing cart. Purchased sourcing parts must reach JLCPCB's warehouse
before assembly selection; obtain corrected quantity/lead-time/fee confirmation before buying.

The previously supplied programming package is for **supplier feasibility review**, not programming acceptance. It
includes the virtual U24 HEX and assembly/probe guidance. U23 still needs a reviewed single-5V/1.5A NVM configuration
and an agreed programming/readback method. ST's reference NVM example is not this board's configuration; do not copy it
unmodified. ST provides an
[offline configuration GUI and factory I2C programming procedure](https://github.com/usb-c/STUSB4500). The target is one
enabled fixed PDO, 5V/1.5A, USB communication capable, not externally powered, and `REQ_SRC_CURRENT=0`; disable the
higher-voltage PDOs. Preserve unrelated NVM settings using the ST tool rather than writing guessed reserved bytes. U24's
SWD connection cannot directly write U23's NVM: the factory needs an agreed I2C probe or temporary programmer image,
followed by full 40-byte readback, cold-reset PDO verification, and the final U24 runtime image. Use a fixed 5V source
during initial programming, not a higher-voltage-capable PD source. JLCPCB support (Leo, 2026-09-12) confirmed that its
functional-test service can review programming and that through-hole assembly of J2/J6/U13 is supported. This is not
engineering acceptance of the specific fixture or U23 NVM operation. The supplied U24 HEX cannot substitute for U23's
separate 40-byte NVM configuration; a specific clarification was sent.
[Programming is a separately reviewed Standard PCBA service](https://jlcpcb.com/help/article/pcba-programming-service).
Do not release a board with blank source-control firmware as ready to program the scoring application.

The native ERC/DRC/parity/connectivity checks report zero findings under enabled rules. This does not finish the
datasheet/rating review of every MPN, all 142 supplier placements, or physical qualification. CP2102N, ISO7021, TPS25947
and the transformer pin/net maps were individually rechecked against manufacturer drawings. Final supplier placement
review, complete assembly price and programming-service acceptance remain open; no shortage has been waived by omitting
parts. The earlier $110.63 figure was the **bare-PCB quote only**, not the assembled total.
