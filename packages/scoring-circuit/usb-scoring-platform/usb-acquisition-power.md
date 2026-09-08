# Laptop acquisition power

## Approved replacement requirement

**Current interface decision: one USB-C receptacle, no physical mode switch.** The owner declined the switch and raised
cost/usability concerns about two ports. Neither alternative is selected. The owner has now removed the $36 savings
target: retain LTM2884 and finish the power circuit. USB enumeration, its absence, or a timeout alone must not be
treated as proof that a charger is connected.

Laptop mode may require a USB-C source advertising sufficient power; ordinary USB-A adapter compatibility is no longer
required. The HUB75 remains disconnected. The calculations below allocate the isolated LTM2884 load, not a complete
host-input power budget. U19's replacement and U21 automatic source qualification/control are implemented and
host-tested; the assembled-board current and timing measurements remain outstanding.

The replacement still needs source-power detection. With STUSB4500, Type-C current flags report the CC pull-up, whereas
an explicit PD contract takes precedence. Its source-capability message, including the suspend flag, must be read
promptly over I2C; the static power-ready outputs do not report that flag. See
[ST's programming guide, sections 1.7-1.9](https://www.st.com/resource/en/user_manual/um2650-the-stusb4500-software-programing-guide-stmicroelectronics.pdf).
U21 provides the controller hardware and [firmware](../../../apps/scoring/firmware/power-control/README.md). Do not
assume that a powered USB-C requirement by itself allows an always-on isolated converter on every PD-capable laptop.

**The owner confirmed one populated board for both modes, without component swaps.** The 5V-only STUSB4500L alternative
is rejected because it cannot negotiate the full system's 20V supply. Use one USB-C port for laptop power/data or
standalone PD power. In laptop mode, keep the application/display branch off; enable it only after full-display mode and
sufficient source power are both established. Do not use source voltage alone to choose the mode. Add the necessary
power control with the simplest suitable circuit; do not introduce separate laptop-only component populations. This
choice is resolved. The implemented policy keeps laptop suspend shutdown enabled and only permits application power
after a fresh power-only source declaration and accepted 20V/3A contract.

## Selected supply

**Retain LTM2884IY#PBF.** Do not pursue the discrete ISOUSB111/transformer option solely to preserve the earlier savings
estimate. The 2026-09-06 price comparison omitted necessary power-control circuitry and was not a completed BOM saving.
The current LTM2884 reference listing was $56.82 at one piece / $44.2720 at the 25-piece tier; these are dated
[DigiKey part prices](https://www.digikey.com/en/products/detail/analog-devices-inc/LTM2884IY-PBF/4864070), not an
assembly quote. Reprice the complete board after the remaining power-control implementation, without applying the $36
credit.

U19 is **LTC3130IMSE-1#PBF**, configured for fixed 5V with automatic Burst/PWM operation. The native circuit follows the
[ADI LTC3130-1 reference](https://www.analog.com/media/en/technical-documentation/data-sheets/3130f.pdf): 10uH L2, 47uF
output, 4.7uF PVIN and VCC bypass, separate 1uF VIN bypass and two 22nF bootstrap capacitors. MODE and VS1 are grounded;
VS2 and MPPC connect to VCC; EXTVCC uses the 5V output and RUN connects to VBUS. Internal compensation and fixed output
remove R90/R91/R108/R109/R110/C67/C68. U18 isolation and U21 power control remain unchanged.

The schematic and local PCB routing pass native ERC/DRC and parity checks. Both 4.1V and 20V manufacturer-model
load-step cases passed the nominal 5V +/-5% screen. These do not establish whole-input suspend consumption, guaranteed
thermal/tolerance margins or measured hardware behavior; see the
[design review](design-review.md#requirements-and-power-budget-follow-up-8-september).

C39 is TDK C4532X7R1H475K200KB; C43 is
[TDK C4532X5R1A476M280KA](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C4532X5R1A476M280KA),
the full ordering code for the 47uF/10V/1812 reference family. C41 uses a 16V-rated 4.7uF/0805 part; C42/C66 are
50V-rated 22nF/0603 (TDK C1608X7R1H223K080AA). L2 is
[Coilcraft XAL5050-103MEC](https://www.coilcraft.com/en-us/products/power/high-voltage-inductors/xal/xal50xx/xal5050-103/).
The current manufacturing export has 223 fitted components with manufacturer/MPN fields and passes native ERC/DRC,
connectivity and schematic parity. The earlier regulator's component counts and 100nF bootstrap description are
superseded. This does not establish physical loop stability, transient response, hot-plug behavior or fault temperature.

Automatic source-current qualification and the application-power policy are implemented. The complete startup/suspend
budget still requires physical measurements. Keeping the integrated isolator avoids a separate
transformer/rectifier/data-isolator redesign; it does not eliminate those system-level responsibilities.

## Standalone display power boundary

U6 REC30K-2405SZ is rated 5V/6A, shared by the panel, application regulator, buffer circuits and the D2 acquisition
feed. It is not a 6A allocation exclusively for J8. The current specification names a 64x32 HUB75 interface but no exact
panel with a guaranteed maximum input current. Do not approve an arbitrary panel or claim full-white operation from
resolution alone. Use its rated load, including startup, plus the other loads against the converter's derated output at
the intended enclosure temperature. The manufacturer's 87% efficiency is typical at nominal input and full load; it is
not a guaranteed efficiency at our 20V input.
[RECOM selection guide and derating](https://recom-power.com/pdf/Econoline/REC30K%28-Z%29.pdf).

The saved PCB's PANEL_5V fill on In2.Cu is one connected polygon. U6 pin 6 and J8 pins 1/2 connect through their plated
holes to this plane; the small surface branches are not the entire panel-current path. The main horizontal and vertical
trunks are nominally 6mm wide before local clearances. The specified inner copper is 0.0152mm, not outer-layer 1oz. This
confirms connectivity, not allowable current or temperature rise: local holes, thermal connections, the ground return,
cable and contacts still contribute resistance. Neither clean DRC nor the 7A connector contact rating establishes a 6A
board-path rating. Measure voltage at J8 and at the panel, plus converter/connector temperature, during the assembled
maximum-load and startup tests. No speculative trace change was made from the overview alone.

Before choosing the panel, close `I_panel + I_application_input + I_acquisition_feed + I_other_5V <= I_U6_derated`.
Application input means the 5V input to U7, not its 3.3V output current. Until an exact panel is specified, the
standalone maximum-brightness power budget remains unclosed. This does not affect the panel-disconnected laptop mode.

## Primary-side control hardware

U21 is [STM32C011F6P6](https://www.st.com/resource/en/datasheet/stm32c011f6.pdf), TSSOP-20, powered by U18 VLO
(`USB_HOST_3V3`). Use the internal HSI48 divided by eight (6MHz); no external oscillator is needed. It is a power
supervisor, separate from the STM32G474 scoring processor and ESP32 application processor.

| U21 pin                   | Signal               | Function and reset state                                                    |
| ------------------------- | -------------------- | --------------------------------------------------------------------------- |
| 1 PB7 / 20 PB6            | PD_SDA / PD_SCL      | U5 I2C with 4.7k pull-ups                                                   |
| 13 PA6                    | PD_ALERT_N           | U5 alert input with 47k pull-up                                             |
| 11 PA4                    | USB_ISO_EN           | U18 ON, 100k pull-down: acquisition off                                     |
| 12 PA5                    | APP_INHIBIT          | Q6 gate, 100k pull-up: application inhibited; drive low only when qualified |
| 16 PA11                   | USB_SUSPEND_EN       | U18 SPNDPWR, 100k pull-up: automatic suspend shutdown enabled               |
| 18 PA13 / 19 PA14 / 6 PF2 | SWDIO / SWCLK / NRST | J14 underside service pads                                                  |

Q6 pulls `PD_EFUSE_EN` low when inhibited; the existing Q4/Q5 PD hardware gates remain in series with software
permission. J14 pads are 1=VLO reference, 2=USB_GND, 3=SWDIO, 4=SWCLK, 5=NRST. Do not inject debugger power into VLO or
bridge the isolation barrier with a grounded debugger. J14 is excluded from the assembled BOM.

VLO's 10mA external allowance must cover U21, I2C and control pulls. The full VBUS budget still includes U19 and U5;
this allowance is not a measured startup/suspend result. Both source qualification and U5 configuration are required
before the reset-safe board can operate.

## Retained circuit budget

### Input-side review

The prototype retains a **5V / at least 1.5A advertised or contracted source** for laptop acquisition. A conservative
active allocation is 0.60A at J1, not 1.5A of normal consumption. With 75mA isolated load, assume 40% incremental
LTM2884 efficiency, 100mA converter overhead, 9mA transceiver overhead and 4mA VLO load: the 5V input is approximately
0.3005A. At 70% U19 efficiency and 4.1V cable-end voltage this becomes 0.524A; a further 10mA primary allowance gives
0.534A, below the 0.60A allocation. The two efficiency floors are **engineering assumptions to measure**, not guaranteed
data-sheet minima. This closes the allocation, not inrush, thermal or all-corners performance qualification.

U21's HSI48/8 flash-running characterization at 85 C is 1.4mA maximum with peripherals disabled
([ST DS13866 table 27](https://www.st.com/resource/en/datasheet/stm32c011f6.pdf)). Allocate 0.6mA for peripherals and
switching, 1.483mA for both 4.7k I2C pull-ups continuously low at VLO=3.45V and -1% resistance, and 0.179mA for
control/alert pulls: **3.662mA**, rounded to 4mA, versus VLO's 10mA allowance. This is a steady-load allocation;
debugger loading and capacitor charging are separate. The actual firmware now checks a qualified contract on ALERT_N or
every 10ms, avoiding continuous I2C pull-up current while retaining immediate alert polling and the watchdog.

**Suspend criteria correction:** USB-C non-PD 1.5A/3A advertisement is not subject to the blanket 2.5mA legacy limit.
The USB-IF functional test TD 4.10.3 permits those advertised currents and uses **25mW** for a non-hub PD sink when the
source supports USB suspend. See the
[official test specification, pages 104-105](https://usb.org/sites/default/files/USB%20Type%20C%20Functional%20Test%20Specification%202021%2005%2020.pdf).
Keep LTM2884 suspend shutdown enabled in laptop mode. Measure the complete J1 power against the applicable source/PD
condition, including U21, U5 and U19; an isolated-output shutdown is not proof of the total. The 4mA worst-case VLO
allocation is not itself a demonstrated PD suspend budget. Lower I2C duty improves margin but does not establish a
measured 25mW pass. Default-current USB-A operation remains outside the supported product configuration.

The current source audit does not justify a tighter guaranteed suspend allowance: the no-alert pass has 216 I2C clocks,
but `wait_flag` bounds each wait by 4000 register polls, not a measured bus time. Clock stretching and alert/error paths
can extend activity; continuously low pull-ups cannot simply be discounted by the nominal 0.54ms/10ms ratio. Retain the
4mA allocation for power sizing. The approximately 96.3% U19 efficiency required by the conservative 25mW screen is
**not a demonstrated pass or a demonstrated hardware failure**. Resolve this using whole-J1 current measurements with an
attached PD host in suspend; source operating conditions and U5 current must be included. Do not substitute a
disconnected U5 typical current, the U19 no-load figure, or a firmware WFI instruction for that measurement.

**Paper budget, not a measured operating result.** Retain the LTM2884 acquisition supply; this review does not justify a
larger converter. Laptop-only units ship **without a HUB75 panel connected**. The laptop supplies power and runs the
scoring display. ESP32, Ethernet and IR remain on the separate application supply; sound and Favero transmission are
disabled in this acquisition-only budget, even though their circuits are populated.

The native schematic and placement now use **one J1 USB-C receptacle**. STUSB4500 negotiates power, LTC3130-1 supplies
the LTM2884 primary, and the separately enabled TPS25947/REC30K branch supplies isolated application power. **The local
circuits, J1 feeds, CC lines, primary distribution and regulated isolator feeder are routed. They have not been powered
or characterized; do not power this draft.** The left-edge primary return remains separate from board ground. An absent
panel is not automatic charger detection, nor permission to turn on the other application loads.

U21 writes and reads back volatile **5V/1.5A PDO1** and **20V/3A PDO2** profiles on the same populated board. Q4/Q5
require PDO2's power-ready and VBUS-enable flags; Q6 adds firmware inhibition. A PD-capable laptop can supply 20V too,
so U21 requires fresh source capabilities declaring no USB communications before requesting display power. It then
checks the accepted contract. NVM is not rewritten at boot; verify POWER_OK_CFG=10b and REQ_SRC_CURRENT=0 defaults.

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
  topology. The current STM32 acquisition driver and decoder use **40us slots / 120us three-slot frames**; the former
  525us characterization sweep is not the firmware schedule. Host tests check frame timing, but physical settling and
  contact timing still require bench verification. Desktop acquisition must explicitly start a new capture session.
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
   capture inrush separately. Direct raw-VBUS bypass C1/C36/C39/C40/C50 sums to **7.8uF nominal**. U19's 47uF output
   capacitor, U18's input bypass and secondary charging are behind the regulator but still contribute startup current.
   Tolerance, effective capacitance, PD transitions and hot-plug overshoot require measurement; the nominal sum is not
   proof of USB input-capacitance compliance.
2. Accepted configuration with maximum USB traffic and scan activity: <=500mA host and <=75mA isolated target. Exercise
   open cords, all conductors joined, grounded selected conductor and cable capacitance. If 75mA is exceeded, reconcile
   the measured budget before raising it; 200mA is not our operating target.
3. Suspend/resume and unplug/replug, both with and without PD: verify the applicable suspend-current/power limit above,
   loss of old captures, bounded restart, no false observations and no unwanted application-rail power. Include
   D2/U10/U11 leakage and the new host-side controller/regulator consumption; U18's suspend behavior alone cannot prove
   the whole limit. The [USB-IF electrical update](https://compliance.usb.org/index.asp?UpdateFile=Electrical) also
   requires truthful bus/self-power reporting and re-enumeration before changing from self-powered to high-power bus
   operation.
4. Measure loaded U19 output, CORE_3V3 and temperature with representative cables. Sweep through 4.1-5.5V and the
   negotiated 20V operating point, including startup and transitions; U18 must remain above 4.4V at its pins. The new
   buck-boost topology addresses dropout but has not been measured. Stop capture on undervoltage; do not claim support
   for all laptop/cable combinations or treat the nominal reference circuit as measured loop-stability proof.
5. With U21 firmware installed, verify 5V-only sources leave application power off; test 20V negotiation, the nominal
   18.0V UVLO/21.84V OVLO thresholds, current limit, loaded startup, PD fallback and detach. Confirm both control flags
   release correctly and the isolated supplies never connect USB_GND to board GND. Repeat with the laptop source
   advertising USB communications to confirm the populated application branch stays off.

**Decision:** retain the 20mA/75mA isolated-load targets, but re-establish the host-side budget for the replacement
shared-input circuit. Primary power routing and both USB data trunks are complete at the layout checkpoint; low-input
margin and physical checks remain unfinished; firmware enforcement is implemented and host-tested. This budget is not
USB certification or FIE safety proof.

The UART transmit pulls add no nets, and the acquisition-side pull fits within the existing power targets. The populated
sounder now has a 1k piezo discharge resistor and local bypass; these do not authorize sound in laptop mode. Keep its
PWM output low as required above. The seven existing simulation models include the 16.53mA grounded-conductor bound;
none simulates the complete USB supply. Current native checks and repository verification results are recorded in the
[design status](README.md#checks-performed).
