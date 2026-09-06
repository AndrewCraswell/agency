# Laptop acquisition power

## Approved replacement requirement

**Current interface decision: one USB-C receptacle, no physical mode switch.** The owner declined the switch and raised
cost/usability concerns about two ports. Neither alternative is selected. The owner has now removed the $36 savings
target: retain LTM2884 and finish the power circuit. USB enumeration, its absence, or a timeout alone must not be
treated as proof that a charger is connected.

Laptop mode may require a USB-C source advertising sufficient power; ordinary USB-A adapter compatibility is no longer
required. The HUB75 remains disconnected. The calculations below allocate the isolated LTM2884 load, not a complete
host-input power budget. U19's replacement is implemented; automatic source qualification/control remains unfinished.

The replacement still needs source-power detection. With STUSB4500, Type-C current flags report the CC pull-up, whereas
an explicit PD contract takes precedence. Its source-capability message, including the suspend flag, must be read
promptly over I2C; the static power-ready outputs do not report that flag. See
[ST's programming guide, sections 1.7-1.9](https://www.st.com/resource/en/user_manual/um2650-the-stusb4500-software-programing-guide-stmicroelectronics.pdf).
The existing J12 service header is not a running controller. Do not assume that a powered USB-C requirement by itself
allows an always-on isolated converter on every PD-capable laptop.

**The owner confirmed one populated board for both modes, without component swaps.** The 5V-only STUSB4500L alternative
is rejected because it cannot negotiate the full system's 20V supply. Use one USB-C port for laptop power/data or
standalone PD power. In laptop mode, keep the application/display branch off; enable it only after full-display mode and
sufficient source power are both established. Do not use source voltage alone to choose the mode. Add the necessary
power control with the simplest suitable circuit; do not introduce separate laptop-only component populations. This
choice is resolved. Power-control implementation remains unfinished, rather than blocked on owner input.

## Selected supply

**Retain LTM2884IY#PBF.** Do not pursue the discrete ISOUSB111/transformer option solely to preserve the earlier savings
estimate. The 2026-09-06 price comparison omitted necessary power-control circuitry and was not a completed BOM saving.
The current LTM2884 reference listing was $56.82 at one piece / $44.2720 at the 25-piece tier; these are dated
[DigiKey part prices](https://www.digikey.com/en/products/detail/analog-devices-inc/LTM2884IY-PBF/4864070), not an
assembly quote. Reprice the complete board after the remaining power-control implementation, without applying the $36
credit.

U19 is **LTC3115IDHD-1#PBF**, replacing LMR36510ADDAR. It can regulate through the low-input region where the old buck
could only drop voltage. The native circuit follows the
[ADI Rev E 5V reference](https://www.analog.com/media/en/technical-documentation/data-sheets/ltc3115-1.pdf): 10uH L2,
47uF output, 4.7uF input and VCC bypass, 100nF bootstrap capacitors, 47.5k RT (750kHz), 1M/249k feedback, 60.4k/3.3nF
compensation and 15k/33pF feed-forward. PWM/SYNC is low for Burst mode; RUN is connected to VBUS. The reference
specifies 5V/1A for input above 3.6V. That is component-level capability, not a guaranteed board input budget.

C39 is TDK C4532X7R1H475K200KB; C43 is
[TDK C4532X5R1A476M280KA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C4532X5R1A476M280KA),
the full ordering code for the 47uF/10V/1812 reference family. C41 uses a 16V-rated 4.7uF/0805 part; C42/C66 are
50V-rated 100nF/0603. L2 is
[Coilcraft XAL5050-103MEC](https://www.coilcraft.com/en-us/products/power/high-voltage-inductors/xal/xal50xx/xal5050-103/).
All 15 replacement-section components have manufacturer/MPN fields. C44 is removed. The schematic and local routing pass
native ERC/DRC with zero violations and zero unconnected items; all 219 components and 833 netlist pins match. This does
not establish loop stability, transient response, hot-plug behavior or fault-temperature performance.

Automatic input-current qualification, the application-power enable policy and the complete startup/suspend budget
remain to be implemented. Keeping the integrated isolator avoids a separate transformer/rectifier/data-isolator
redesign; it does not eliminate those system-level responsibilities.

## Retained circuit budget

**Paper budget, not a measured operating result.** Retain the LTM2884 acquisition supply; this review does not justify a
larger converter. Laptop-only units ship **without a HUB75 panel connected**. The laptop supplies power and runs the
scoring display. ESP32, Ethernet and IR remain on the separate application supply; sound and Favero transmission are
disabled in this acquisition-only budget, even though their circuits are populated.

The native schematic and placement now use **one J1 USB-C receptacle**. STUSB4500 negotiates power, LTC3115-1 supplies
the LTM2884 primary, and the separately enabled TPS25947/REC30K branch supplies isolated application power. **The local
circuits, J1 feeds, CC lines, primary distribution and regulated isolator feeder are routed. They have not been powered
or characterized; do not power this draft.** The left-edge primary return remains separate from board ground. An absent
panel is not automatic charger detection, nor permission to turn on the other application loads.

The retained draft proposed separate **5V PDO1-only** and **20V/3A PDO2** programming profiles. That is not the final
mode-selection implementation: the replacement must support both modes on the same populated board. Q4/Q5 currently
require PDO2's power-ready and VBUS-enable flags before enabling the application converter; they do not enforce a
user-selected laptop mode. A PD-capable laptop can supply 20V too. USB enumeration establishes the data session, not
permission to enable the display. NVM programming and firmware mode control remain unimplemented.

## Limits and calculated load

The previous LTM2884 budget targeted an ordinary USB 2.0 host: at most 100mA before configuration and 500mA after the
host accepts that configuration (`bMaxPower = 250`, in 2mA units). These legacy targets do not override the approved
USB-C requirement above. The
[USB-IF power policy](https://compliance.usb.org/index.asp?Format=Standard&UpdateFile=Policies) distinguishes these
limits.

[LTM2884 Rev D](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf), pages 3 and 15-17,
specifies 200mA isolated output with 4.4V input and recommends less than 25mA output before enumeration. That guidance
is not an enforced host-current limit. The original and revised `(a)` silicon have different no-load consumption;
neither the typical efficiency curve nor the following output budget proves the host-input limit. Measure at J1. The new
PD controller, primary buck-boost, eFuse, their bias networks and converter losses are **additional host-side load**,
not included in the isolated-output table. Their combined startup, active and suspend consumption remains unmeasured.

Currents below are mA drawn from `USB_ISOLATED_5V`, including loads behind D1/U4. AP2112K is a **linear** regulator:
3.3V output current passes through its 5V input approximately one-for-one, plus regulator current. Do not multiply the
200mA rating by 5/3.3. Basis: current native schematic, including the R72 transmit idle pull, 3.0-3.6V acquisition rail
and up to 85 C. Temperature, firmware and component allowances below are design conditions, not a product environmental
rating.

| Load                                           | Before configuration | Active acquisition | Basis                                                                                                                               |
| ---------------------------------------------- | -------------------: | -----------------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| U1 CPU/Flash baseline                          |                12.00 |              19.00 | 16MHz startup, 48MHz running, voltage Range 1, cache on/prefetch off; characterized maximum at 85 C                                 |
| Seven comparators and reference scalers        |                    0 |               5.05 | Disabled at startup; 7 x (720uA + 1uA), rounded up                                                                                  |
| MCU clocks, USB, timer/DMA and I/O switching   |                 4.00 |               8.00 | Engineering allowance, not a published combined maximum; excludes the CPU/comparators above                                         |
| Excitation through the seven 220-ohm resistors |                    0 |              16.53 | At most one high source at a time: 3.6V / (220 x 0.99), including a grounded conductor or initially discharged cable                |
| DRIVE/OE, reset and UART bias resistors        |                 0.90 |               3.40 | Prior 0.50/3.00mA allocation plus R72 at 3.6V / 9.9k = 0.364mA when TX is low, rounded up; R73 is on the unpowered application rail |
| U8/U9 buffer overhead and U10/U11 translators  |                 0.20 |               2.00 | Allowance above static currents, with defined input levels; excludes conductor load and external pulls already counted              |
| U4, R3/R4 and residual leakage                 |                 0.50 |               0.50 | Allowance; R3/R4 consumes at most 5.5V / 247.5k = 0.023mA; loaded regulator and backfeed need measurement                           |
| Unallocated margin                             |                 2.40 |              20.52 | Reserved for measured departures, not accessories                                                                                   |
| **Isolated-output target**                     |            **20.00** |          **75.00** | **5mA below the startup guidance; 125mA below the configured output rating**                                                        |

The MCU values come from [DS12288 Rev 6](https://www.st.com/resource/en/datasheet/stm32g474re.pdf), tables 21/22 and 79.
The baseline uses an external clock with peripherals off, not our complete firmware. HSI16/HSI48, PLL/HSE, USB traffic,
timer/DMA, actual code and switching belong in the separate allowance. Seven comparators consume up to 5.04mA static;
dynamic current still needs checking. This is a bounded allocation with explicit unknowns, not an all-corners sum of
guaranteed maxima. It does not authorize a 170MHz acquisition build under the same startup allowance.

[Nexperia 74LVC125A](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf), table 6, and
[TI SN74AXC1T45](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf), section 5.5, support the low static overhead when
inputs are at valid rails. U10/U11 support partial power-down; verify `APP_3V3` actually falls below 0.1V for the stated
output-disable condition. D2 is not a zero-leakage switch. The
[AP2112-3.3 table](https://www.diodes.com/assets/Datasheets/AP2112.pdf), page 8, gives 80uA maximum no-load quiescent
current; the allowance above must also cover its loaded behavior.

At the 75mA target, isolated output power is nominally 0.375W. Ignoring D1's helpful voltage drop, U4 dissipates about
(5 - 3.3) x 0.075 = **0.128W** at nominal voltage. Exact SS14 manufacturer/temperature-dependent drop, LTM output
variation, regulator dropout, PCB temperature and cable loss remain to be checked. Require `CORE_3V3` >=3.0V while
capturing; do not claim margin just because the MCU has not reset.

## Required operating behavior

- Boot in the 20mA allocation: stay at 16MHz or below, use only the clocks/peripherals needed to enumerate, leave all
  excitation OE_N high, and hold SOUNDER_PWM/FAVERO_TX low. No startup chirp, comparator scan, radio or network startup.
- Only after a nonzero configuration is accepted may firmware enter the 75mA allocation. Source one conductor high at a
  time, with break-before-make; low discharge phases may enable several outputs. The existing scan model follows this
  topology, but its 525us characterization sweep is **not** an approved scoring schedule. Budget a faster real schedule
  and verify contact timing separately. Desktop acquisition must explicitly start a new capture session.
- USB reset, deconfiguration or loss of USB_PRESENT returns to the startup allocation and invalidates capture. Bus
  silence is not evidence of a charger. With SPNDPWR high, suspend removes acquisition power on USB alone; retain the
  accepted reconnect-after-wake behavior and test that boot/USB attach completes without repeated power cycling.
- No HUB75 is connected in the laptop product. Keep the PD application branch off in laptop mode, including populated
  ESP32/Ethernet/IR. Do not silently enable sound/Favero from the spare margin. If later required on laptop power,
  budget them explicitly. Service programmers and external power must not bypass isolation during fencer use.

## Bench checks still required

Use an assembled board, current measurement at J1 **and** U18 output, and a passive conductor fixture, not fencers. No
hardware measurements have been performed.

1. Cold plug, delayed/denied configuration, reset and deconfiguration: <=100mA host and <=20mA isolated steady load;
   capture inrush separately. Direct raw-VBUS bypass C1/C36/C39/C40 sums to **6.8uF nominal**. U19's 47uF output
   capacitor, U18's input bypass and secondary charging are behind the regulator but still contribute startup current.
   Tolerance, effective capacitance, PD transitions and hot-plug overshoot require measurement; the nominal sum is not
   proof of USB input-capacitance compliance.
2. Accepted configuration with maximum USB traffic and scan activity: <=500mA host and <=75mA isolated target. Exercise
   open cords, all conductors joined, grounded selected conductor and cable capacitance. If 75mA is exceeded, reconcile
   the measured budget before raising it; 200mA is not our operating target.
3. Suspend/resume and unplug/replug, both with and without PD: verify the host suspend limit of 2.5mA, loss of old
   captures, bounded restart, no false observations and no unwanted application-rail power. Include D2/U10/U11 leakage
   and the new host-side controller/regulator consumption; U18's suspend behavior alone cannot prove the whole limit.
   The [USB-IF electrical update](https://compliance.usb.org/index.asp?UpdateFile=Electrical) also requires truthful
   bus/self-power reporting and re-enumeration before changing from self-powered to high-power bus operation.
4. Measure loaded U19 output, CORE_3V3 and temperature with representative cables. Sweep through 4.1-5.5V and the
   negotiated 20V operating point, including startup and transitions; U18 must remain above 4.4V at its pins. The new
   buck-boost topology addresses dropout but has not been measured. Stop capture on undervoltage; do not claim support
   for all laptop/cable combinations or treat the nominal reference circuit as measured loop-stability proof.
5. With the full-system NVM profile, verify 5V-only sources leave application power off; test 20V negotiation, the
   nominal 18.0V UVLO/21.84V OVLO thresholds, current limit, loaded startup, PD fallback and detach. Confirm both
   control flags release correctly and the isolated supplies never connect USB_GND to board GND. Repeat with the
   laptop-only NVM profile to confirm the populated application branch stays off.

**Decision:** retain the 20mA/75mA isolated-load targets, but re-establish the host-side budget for the replacement
shared-input circuit. Primary power routing and both USB data trunks are complete at the layout checkpoint; low-input
margin, NVM programming, firmware enforcement and physical checks remain unfinished. This budget is not USB
certification or FIE safety proof.

The UART transmit pulls add no nets, and the acquisition-side pull fits within the existing power targets. The populated
sounder now has a 1k piezo discharge resistor and local bypass; these do not authorize sound in laptop mode. Keep its
PWM output low as required above. The seven existing simulation models include the 16.53mA grounded-conductor bound;
none simulates the complete USB supply. Current native checks and repository verification results are recorded in the
[design status](README.md#checks-performed).
