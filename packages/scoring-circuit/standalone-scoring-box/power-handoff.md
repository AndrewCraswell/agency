# Standalone power and assembly handoff

Engineering review: 2026-09-12. Applies only to this standalone board. No assembled board has been tested.

## Supply decision

Retain STUSB4500, TPS259470L and REC30K-2405SZ. Use an isolated USB-C PD wall supply offering **fixed 20V/3A** and a
3A-rated cable. A charger advertised as "60W" without that fixed profile is not sufficient. No laptop data mode or
second panel is supported. No new converter or control MCU is needed for this prototype.

The native netlist was checked again: U6 supplies J8, U4, U7, the display buffers and the two Favero LED drivers. U22
supplies only primary-side pull-ups. There is no longer a D2 acquisition-feed diode or a laptop USB power branch.

| Load                                            | Design allocation | Supply treatment                                    |
| ----------------------------------------------- | ----------------: | --------------------------------------------------- |
| Waveshare P5 64x32, SKU 25848                   |          4A at 5V | Manufacturer's 20W panel rating                     |
| ESP32 including module memory                   |     0.65A at 3.3V | Through U7                                          |
| W5500 including analog rail                     |     0.20A at 3.3V | Through U7                                          |
| IR, Ethernet LEDs, translators and bias         |     0.05A at 3.3V | Through U7                                          |
| Application switching reserve                   |     0.10A at 3.3V | Through U7; total application allocation 1A         |
| STM32, acquisition drivers, sound and U4 losses |     0.20A from 5V | U4 is linear; do not apply a 3.3/5 current discount |
| Two Favero optocoupler LED drivers              |     0.05A from 5V | Not power for the external repeater lamps           |
| HUB75 buffers, bias and dynamic-load reserve    |     0.15A from 5V | Includes cable switching, not another display       |

These are design allocations, not guaranteed maximum device currents or enforced firmware limits. With an assumed 75% U7
efficiency, U6 supplies `4 + (3.3 x 1)/(5 x 0.75) + 0.20 + 0.05 + 0.15 = 5.28A`, or **26.4W**. This leaves 3.6W against
its nominal 30W rating. At an assumed 75% U6 efficiency and 18.5V at its input, the converter draws 1.903A. Allocate
another 10mA for primary control and bias. The two efficiency assumptions are deliberately reduced engineering screens,
not manufacturer guarantees.

The exact RECOM 9-24V derating curve reaches full load through approximately **50C local ambient**, then decreases. At
60C it permits approximately 24.55W, insufficient for this budget. Use a **45C commissioning target and 50C full-load
local-ambient ceiling** until measurements establish the enclosure's behavior. Its reference test PCB differs from ours.
Do not infer an enclosure rating from the curve.

U4 dissipates approximately 0.34W at 200mA and nominal rails. Its published SOT25 thermal resistance gives about 63C
rise, before board-specific cooling effects. Measure U4 as well as U6; its 600mA rating is not a usable board current
allocation at this voltage drop. U7's assumed 75% screen dissipates 1.1W at the 1A application allocation. U20 loses
approximately 0.163W at 1.903A using its 45-milliohm maximum on-resistance. U22's continuously-low I2C/status pulls draw
less than 1.6mA at nominal 3.3V, about 27mW regulator loss at 20V.

Sources: [Waveshare panel](https://docs.waveshare.com/RGB-Matrix-Px-64x32),
[RECOM Rev 1-2025, pp. 2-3 and 7-8](<https://recom-power.com/pdf/Econoline/REC30K(-Z).pdf>),
[Espressif supply guidance](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html),
[W5500](https://docs.wiznet.io/assets/files/W5500_ds_v110k-8a79ea6cf98a804f93c7deb2398cb53f.pdf),
[AP2112, p. 3](https://www.diodes.com/assets/Datasheets/AP2112.pdf),
[AP63203](https://www.diodes.com/datasheet/download/AP63200-AP63201-AP63203-AP63205.pdf).

## Protection and startup

- R94/R95 set nominal 18V enable. The 0.1% resistor extremes, 1.183-1.223V comparator threshold and +/-0.1uA input
  leakage give **17.698-18.393V**, excluding Q4/Q5 off leakage. Two 1uA drain-leakage allowances add about 0.28V to the
  upper value. Those transistor limits are specified at 25C, so hot-board enable needs measurement.
- R96/R97 set nominal 21.84V cutoff; the equivalent comparator/divider screen is **21.473-22.318V**. The eFuse
  disconnects its output; it does not clamp raw USB_VBUS or protect U5/U22 from unlimited source surges. Respect U5's
  22V operating ceiling, and measure hot-plug/PD overshoot. After an overvoltage event, hysteresis can require a power
  cycle. TPS259470**L** also latches off after a thermal fault; do not describe it as automatic retry.
- R98 remains 1.37k: nominal current limit **2.434A**. A deliberately broad +/-15% screen plus 1% resistor tolerance
  gives **2.048-2.827A**. This is not an exact guaranteed threshold at this resistor value. It leaves modest margin
  above the 1.913A input allocation, below the 3A contract; transient overshoot is not covered by that steady figure.
- **C45 is 1nF, 50V, C0G, 5%, YAGEO CC0603JRNPO9BN102**, without moving pads or copper. TI's nominal
  `slew rate = 2000 / C[pF]` gives 2V/ms and about 10ms to 20V, instead of 100ms. This reduces time spent feeding a
  starting converter through a partially-on eFuse. U6 starts around 8-9V and has 20ms typical/50ms maximum startup under
  its stated test conditions; those figures are not a guaranteed delay under our input ramp.
- C46/C47 contribute 10.1uF nominal behind U20: about 20.2mA capacitive inrush at the new nominal slew. U6's internal
  input capacitance is unspecified. For scale, 100uF **total** would draw 0.2A and 220uF 0.44A, before converter load.
  Do not pass startup using only the visible 10.1uF. Capture actual input current and U20 output; check for current
  limiting or thermal latch-off with the real panel attached.
- Direct raw-VBUS bypass is C1+C36+C73 = **3uF nominal**. U5's regulator and U22's output capacitors are not directly
  across VBUS. Confirm effective capacitance, input overshoot and output rail tolerance on hardware. RECOM's output
  accuracy is typical, not a guaranteed all-corner +/-5% panel-supply bound.
- At 5V, Q4 holds enable low unless PDO2 is accepted; the divider independently prevents U20 starting at 5/9/15V. Q5
  provides the detach inhibition because POWER_OK2 alone can remain asserted after detach. U22's EN is open with its
  internal pull-up. U5 regulator outputs supply only their decoupling capacitors.
- Keep HUB75 blank, excitation disabled and sound/Favero low during reset. Firmware must initialize the panel and wait
  for settled rails before lighting it; do not use an all-white startup splash to test power sequencing.

Sources: [TI TPS25947 Rev C, sections 6.5 and 7.3.5](https://www.ti.com/lit/ds/symlink/tps25947.pdf),
[DMN2056U](https://www.diodes.com/datasheet/download/DMN2056U.pdf),
[YAGEO C45](https://yageogroup.com/download/specsheet/CC0603JRNPO9BN102),
[STUSB4500 sections 2.2.8-2.2.10](https://www.st.com/resource/en/datasheet/stusb4500.pdf),
[TPS709](https://www.ti.com/lit/ds/symlink/tps709.pdf).

## U5 factory programming

J12 is **primary-domain service only**: pin 1 USB_GND, pin 2 SDA, pin 3 SCL. Both address pins are grounded: STUSB4500
uses **7-bit I2C address 0x28** (0x50/0x51 address bytes). Use open-drain 3.3V I2C; the board supplies its 4.7k
pull-ups. Do not inject power through J12, use 5V I2C, or connect primary and secondary debuggers together. Disconnect
all fencing equipment and the panel during programming. Supply J1 from a current-limited isolated source.

1. Identify U5 as STUSB4500, not STUSB4500L. Read all five eight-byte NVM sectors using ST's NVM utility/library. Save a
   raw 40-byte binary in sector order 0-4. Confirm a valid read and inspect the existing voltage-monitoring, discharge
   and reserved settings in ST's tool; a 40-byte file alone does not establish a valid device read.
2. Run `python prepare-power-profile.py u5-readback.bin u5-standalone.bin`. This offline helper preserves all bits
   except the listed product settings. It will not overwrite an existing output, flash hardware, or silently use another
   product's NVM defaults. Never use the tests' synthetic input as a factory image.
3. Inspect the prepared image with ST's tooling: exactly **two PDOs**, PDO1 **5V/0.5A**, PDO2 **20V/3A**,
   `POWER_OK_CFG=10b`, `REQ_SRC_CURRENT=0`, `POWER_ONLY_ABOVE_5V=1`, `USB_COMM_CAPABLE=0`, `SNK_UNCONS_POWER=0`. PDO3
   remains stored but disabled. Preserve/inspect discharge and voltage-monitoring settings; they are not rebuilt by this
   helper. Do not approve arbitrary preprogrammed settings from another product.
4. Write all five sectors using ST's NVM sequence, exit test mode, read all 40 bytes back and compare exactly with the
   prepared file. NVM is **not** ordinary byte-addressable register space. Do not repeatedly write it at boot.
5. Remove J1 power completely. RESET is grounded on this board; a PD soft reset is not a substitute for reloading NVM.
   Reconnect a qualified 20V/3A source, read the live PDO count/profiles and accepted RDO, and measure U20 output. Then
   test a 5V-only source and a source lacking 20V/3A: PANEL_5V must remain off. Check detach and reattach too.

Retain the readback, prepared-image SHA256 and post-program verification for the actual assembly lot. **No real U5
readback is available yet, so no factory-qualified binary or programming pass is claimed.** The helper's byte tests
prove its transformation, not USB-PD negotiation or hardware startup. STM32/ESP32 programming remains separate; the
removed combined-board source-mode MCU image must not be included in this product's order.

Implementation references: [ST's programming workflow](https://github.com/usb-c/STUSB4500#nvm-programming),
[ST NVM write/read sequence](https://github.com/usb-c/STUSB4500/blob/c3c690f1532324fb897a08a632af917ccbc4eb38/NVM_Flasher/Src/NVM/USBPD_CUST_NVM_API.c),
[SparkFun's byte mapping and setters](https://github.com/sparkfun/SparkFun_STUSB4500_Arduino_Library/blob/7f76188b7900d930aeb7908319d463b6446257c6/src/SparkFun_STUSB4500.cpp).
The mapping was checked against the library implementation; no ST GUI export or hardware write was performed here.

## Assembly and first-article acceptance

Request SMT **and through-hole** assembly. Fit every purchased BOM item, including U6, programming headers, IR, sounder,
Ethernet, Favero and HUB75 connectors. J3/J4/J5 are bare solder terminations, not missing purchased parts. Agree who
installs the enclosure-mounted banana sockets and their soldered/strain-relieved wires, plus the separate panel and
harnesses. A PCB-assembly quote alone does not include that enclosure wiring or the display.

The four 3.2mm mounting holes require insulating M3 hardware with heads/washers no larger than 6mm; their coordinates
are in the project README. The jack footprint/body envelope was checked against its manufacturer drawing, but the exact
jack model is not displayed in the 3D preview. Before ordering: confirm enclosure retention and cable access, final
stackup/impedance, parts availability and factory programming capability. The exporter creates a **review draft**, not
manufacturing approval; use default green mask for the prototype order.

[JLCPCB's programming service](https://jlcpcb.com/help/article/pcba-programming-service) is offered for Standard PCBA
after assembly and requires programming files and interface instructions. This does not establish that their fixture
supports STUSB4500's five-sector NVM protocol. Select programming/functional-test review in the draft if available, but
do not release production without that capability and first-article readback being agreed. No supplier contact or
programming-service approval is implied by this handoff.

On the first article, measure cold/loaded startup, 5V-only rejection, detach, short-circuit/latch recovery, whole-board
current, 5V at the panel, both 3.3V rails and temperature at full display/radio/network load. Test insulation and the
actual wiring before attaching fencing equipment. Then verify acquisition timing, display, Ethernet, both Favero ports,
IR and audio. No CAD check replaces these measurements or establishes competition homologation.
