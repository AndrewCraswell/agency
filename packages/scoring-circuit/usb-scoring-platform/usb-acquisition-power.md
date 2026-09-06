# Laptop acquisition power

**Paper budget, not a measured operating result.** Retain the current LTM2884 acquisition supply for now; this review
does not justify a larger converter. Laptop-only units ship **without a HUB75 panel connected**. The laptop supplies
power and runs the scoring display. ESP32, Ethernet and IR remain on the separate application supply; sound and Favero
transmission are disabled in this acquisition-only budget, even though their circuits are populated.

The native schematic and placement now use **one J1 USB-C receptacle**. STUSB4500 negotiates power, LMR36510 supplies
the LTM2884 primary, and the separately enabled TPS25947/REC30K branch supplies isolated application power. **The
replacement primary power and CC traces remain unrouted. Do not power this draft.** An absent panel is not automatic
charger detection, nor permission to turn on the other application loads.

Laptop-only units require U5's **5V PDO1-only** NVM profile. The full-system profile additionally requests **20V/3A** as
PDO2; Q4/Q5 require both its power-ready and VBUS-enable flags before enabling the application converter. Program and
read back these profiles before bring-up. A PD-capable laptop can supply 20V too, so negotiation is not automatic
laptop-versus-charger identification. USB enumeration establishes the data session. Neither NVM programming nor firmware
mode control has been implemented here.

## Limits and calculated load

Target an ordinary USB 2.0 host: at most 100mA before configuration and 500mA after the host accepts that configuration
(`bMaxPower = 250`, in 2mA units). Do not assume 900mA because the receptacle is USB 3, or require laptop PD. The
[USB-IF power policy](https://compliance.usb.org/index.asp?Format=Standard&UpdateFile=Policies) distinguishes these
limits.

[LTM2884 Rev D](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf), pages 3 and 15-17,
specifies 200mA isolated output with 4.4V input and recommends less than 25mA output before enumeration. That guidance
is not an enforced host-current limit. The original and revised `(a)` silicon have different no-load consumption;
neither the typical efficiency curve nor the following output budget proves the host-input limit. Measure at J1. The new
PD controller, primary buck, eFuse, their bias networks and converter losses are **additional host-side load**, not
included in the isolated-output table. Their combined startup, active and suspend consumption remains unmeasured.

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
  topology, but its 350us characterization sweep is **not** an approved scoring schedule. Budget a faster real schedule
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
   capture inrush separately. Direct raw-VBUS bypass C1/C36/C39/C40 sums to **4.42uF nominal**. U19's 44uF output bank,
   U18's input bypass and secondary charging are behind the regulator but still contribute startup current. Tolerance,
   effective capacitance, PD transitions and hot-plug overshoot require measurement; the nominal sum is not proof of USB
   input-capacitance compliance.
2. Accepted configuration with maximum USB traffic and scan activity: <=500mA host and <=75mA isolated target. Exercise
   open cords, all conductors joined, grounded selected conductor and cable capacitance. If 75mA is exceeded, reconcile
   the measured budget before raising it; 200mA is not our operating target.
3. Suspend/resume and unplug/replug, both with and without PD: verify the host suspend limit of 2.5mA, loss of old
   captures, bounded restart, no false observations and no unwanted application-rail power. Include D2/U10/U11 leakage
   and the new host-side controller/regulator consumption; U18's suspend behavior alone cannot prove the whole limit.
   The [USB-IF electrical update](https://compliance.usb.org/index.asp?UpdateFile=Electrical) also requires truthful
   bus/self-power reporting and re-enumeration before changing from self-powered to high-power bus operation.
4. Start at >=4.75V at J1 and measure loaded U19 output, CORE_3V3 and temperature with representative cables. **U19
   cannot boost:** it operates in dropout near 5V input, and U18 requires >=4.4V at its own pins. A 4.4V input at J1
   therefore no longer establishes adequate isolator voltage. Sweep downward to determine the operating boundary and
   resolve this corner before release, including a different regulator if necessary. Stop capture on undervoltage; do
   not claim support for all laptop/cable combinations.
5. With the full-system NVM profile, verify 5V-only sources leave application power off; test 20V negotiation, the
   nominal 18.0V UVLO/21.84V OVLO thresholds, current limit, loaded startup, PD fallback and detach. Confirm both
   control flags release correctly and the isolated supplies never connect USB_GND to board GND. Repeat with the
   laptop-only NVM profile to confirm the populated application branch stays off.

**Decision:** retain the 20mA/75mA isolated-load targets, but re-establish the host-side budget for the replacement
shared-input circuit. Primary routing, low-input margin, NVM programming, firmware enforcement and physical checks
remain unfinished. This budget is not USB certification or FIE safety proof.

The UART transmit pulls add no nets, and the acquisition-side pull fits within the existing power targets. The populated
sounder now has a 1k piezo discharge resistor and local bypass; these do not authorize sound in laptop mode. Keep its
PWM output low as required above. The seven existing simulation models include the 16.53mA grounded-conductor bound;
none simulates the complete USB supply. Current native checks and repository verification results are recorded in the
[design status](README.md#checks-performed).
