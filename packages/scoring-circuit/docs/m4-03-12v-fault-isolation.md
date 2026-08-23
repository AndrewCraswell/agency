# M4-03 deferred 12 V fault-isolation architecture

## Decision

**DENY.** This is the fully bounded follow-up to the deferred `ADG5412FBRUZ-RL7` alternative. It establishes that the part has an in-spec 0 V normal signal range and can block a plus or minus 24 V source fault, but it does **not** close the 4.50 ohm coupon pre-capture gate or the 10 us two-rank sabre acquisition allocation. It is a coupon study only. It is not a production BOM, readiness entry, apparatus schematic, PCB change, or fabrication authorization.

The executable calculation is [`src/analog-12v-isolation.ts`](../src/analog-12v-isolation.ts). It is kept separate from the apparatus circuit, selected component register, and critical part manifest by design.

## Exact deferred coupon architecture

The scoring-domain `S5` output of the existing `NXE1S0505MC` isolated converter is the only power input. Every net in this alternative, including `S5`, `V12A`, `S3_3`, logic controls, and `SGND`, remains in the isolated scoring domain. No path connects this rail, its enable circuit, supervisor, or any analog source pin to application `GND`, USB-C VBUS, or the non-isolated application V5 rail.

```text
S5 -> TPS61041QDBVRQ1 boost -> V12A -> ADG5412F VDD x2
SGND ---------------------------------> ADG5412F VSS/GND x2

body-cord line -> ESD701 -> 22 ohm -> ADG5412F Sx
ADG5412F Dx -> existing TMUX1112 / 1 kohm / BAV199 pair / ADC path
```

The `Sx` pin, and not `Dx`, faces the protected connector. ADG's documented power-off protection applies to the source pin. A D pin never connects to a body-cord line, and the switch is not used as a multiplexer with a faulted source sharing a drain with another live source.

| Reference | Exact coupon selection | Connection / role |
| --- | --- | --- |
| `U_12V_BOOST` | TI `TPS61041QDBVRQ1` | `S5` to `V12A`; AEC-Q100, 1.8 V to 6 V input, 28 V maximum adjustable output, 215 mA minimum switch-current limit, 250 mA typical limit. |
| `R_12V_EN_UP/DOWN` | 10.0 kOhm / 100 kOhm, 1 percent | `S5` to `EN` and `EN` to `SGND`. The pulldown gives a defined low when `S5` is absent; the divider gives approximately 4.55 V at `EN` from 5 V `S5`. This is a local default only and receives no remote-shutdown or safe-state credit. |
| `L_12V_BOOST` | Coilcraft `LPS4018-103MRC` | 10 uH, 20 percent, shielded boost inductor. The source has 0.90 A 20 C-rise current and 1.1 A 10 percent-drop saturation figures, far above the very-low-load screen but not a board thermal release. |
| `D_12V_BOOST` | onsemi `MBR0540T1G` | 40 V, 0.5 A Schottky boost rectifier. Its 40 V rating is above the 28 V controller output limit. |
| `C_12V_IN` | Murata `GRM188R71A106KA73D` | 10 uF, 10 V X7R input bypass plus a 100 nF X7R local high-frequency capacitor. |
| `C_12V_OUT` | TDK `C2012X7R1H475K125AC` | 4.7 uF, 50 V X7R output bypass plus a 100 nF, 50 V X7R local high-frequency capacitor. Effective capacitance is a coupon measurement gate. The 50 V rating prevents a 25 V capacitor from being the first limit, but supplies no overvoltage-protection credit. |
| `R_12V_FB_TOP/BOTTOM` | Panasonic `ERA-3AEB893V` / `ERA-3AEB1002V` | 89.3 kOhm / 10.0 kOhm, 0.1 percent feedback divider. The reference-plus-divider-only output interval is 11.974 V to 12.514 V. |
| `U_12V_WINDOW` | TI `TPS3700QDDCRQ1` | Powered from the existing scoring `S3_3`, not `V12A`, so V12 absence is actively monitored while the scoring logic is alive. Its two open-drain outputs wire-AND through a 10 kOhm `S3_3` pull-up into `V12_WINDOW`. |
| `R_12V_UV_TOP/BOTTOM` | Panasonic `ERA-3AEB277V` / `ERA-3AEB1002V` | 277 kOhm / 10.0 kOhm, 0.1 percent divider to `INA+`. Including the TPS3700 maximum input current, its rising screen is 11.336 V to 11.624 V and its minimum falling screen is 10.993 V. |
| `R_12V_OV_TOP/BOTTOM` | Panasonic `ERA-3AEB314V` / `ERA-3AEB1002V` | 314 kOhm / 10.0 kOhm, 0.1 percent divider to `INB-`. Including the TPS3700 maximum input current, its rising screen is 12.798 V to 13.123 V. |
| `C_12V_WINDOW_VDD` / `C_12V_WINDOW_INA/INB` | 100 nF / 4.7 nF X7R | Local supervisor bypass and each monitor-input filter. Values need a brownout response measurement. |
| `D_LINE_ESD[n]` | TI `ESD701DPYR` x7 | One 24 V bidirectional 0.3 pF typical connector-side ESD diode per body-cord/piste source. It specifies 10 nA maximum leakage at plus or minus 24 V and a 37 V clamp value at 3 A. That 37 V value is not a maximum guarantee, so it cannot prove every IEC/EFT/layout waveform remains below ADG's plus or minus 55 V source limit. |
| `R_ESD[n]` | Vishay `CRCW060322R0FKEAHP` x7 | 22 ohm 1 percent quiet-side series resistor from ESD701 to the ADG source. It is not a sustained 24 V current limiter. |
| `U_12V_ENABLE[n]` | TI `SN74LVC1G08QDBVRQ1` x8 | One `S3_3` AND gate per ADG input: `MCU_SOURCE_REQUEST[n] AND V12_WINDOW`. Each ADG input has a 100 kOhm pulldown at the pin. This makes reset and an unpowered scoring controller default-off. |
| `U_ISOLATOR_A/B` | ADI `ADG5412FBRUZ-RL7` x2 | Eight protected source channels; seven are used and one is spare. `FF_A` and `FF_B` are individually captured by a scoring-domain fault input. A detected fault must make the channel `unavailable`; software capture does not substitute for the switch's own automatic turn-off. |
| `C_ISOLATOR_A/B` | 100 nF, 50 V X7R x2 | One local `V12A`-to-`SGND` bypass immediately adjacent to each ADG5412F package, in addition to the boost output capacitors. |

The `TPS3700-Q1` datasheet permits its VDD to be 1.8 V to 18 V while a divider monitors a higher rail. It provides a 1 percent threshold across temperature, 5.5 mV to 12 mV hysteresis, plus or minus 25 nA maximum input current, two open-drain outputs, and up to 450 us output startup time. Both outputs are needed: `OUTA` declares undervoltage and `OUTB` declares overvoltage. It does not provide a pass through the first 450 us; the ADG inputs' 100 kOhm pulldowns and the STM32 reset state remain mandatory. The reported window includes reference, divider, tolerance, and input-current terms only; it excludes filters, rail slew, propagation, and brownout dynamics.

`TPD4E05U06` is intentionally not placed before the protected ADG source in this alternative: its 5 V protection topology would shunt the specified 24 V DC fault before the ADG could isolate it. The `ESD701DPYR` instead has 24 V working standoff, 10 nA maximum leakage at plus or minus 24 V, and 0.3 pF typical capacitance. Its 37 V clamp value at 3 A has no stated maximum and therefore gives no guarantee below the ADG's plus or minus 55 V source limit under arbitrary surge, ESD, EFT, or layout conditions.

Primary sources: [ADG5412F data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/adg5412f_5413f.pdf), [TPS61041-Q1](https://www.ti.com/product/TPS61041-Q1), [TPS3700-Q1](https://www.ti.com/lit/ds/symlink/tps3700-q1.pdf), [ESD701](https://www.ti.com/product/ESD701), [LPS4018-103MRC](https://www.coilcraft.com/en-us/products/power/shielded-inductors/ferrite-drum/lps/lps4018/lps4018-103/), and [MBR0540T1G](https://www.onsemi.com/pdf/datasheet/mbr0540t1-d.pdf).

## What this does prove

At the ADG5412F's 12 V single-supply condition, the manufacturer specifies a 0 V to VDD normal analog range, 37 ohms maximum on resistance at 0 V to 10 V and 125 C, 4.5 nA maximum channel-on leakage at 125 C, 65 nA maximum drain leakage during a plus or minus 55 V source fault, and source-fault operation up to plus or minus 55 V. A normal 0 ohm line is therefore in specification; this is the key distinction from the rejected ADG7421F route.

The modeled 11.974 V minimum rail is above ADG's 8 V minimum operating rail and the normal 0 V to 2.5 V source signal is inside 0 V to VDD. For either a +24 V or -24 V connector-side source fault, source magnitude is inside the plus or minus 55 V limit. Screening maximum separation to both supply pins over the complete modeled VDD interval gives 24 V for the +24 V fault, set by separation to VSS, and 36.514 V for the -24 V fault, set by separation to the 12.514 V maximum VDD. Both remain below the 80 V source-to-supply limit. The ADG automatically opens the source-to-drain path when a source crosses the rail by its internal threshold; its 12 V condition lists a 720 ns maximum response and 960 ns maximum recovery.

The preceding facts only prove voltage-domain applicability. They do not prove fault energy, fault current, thermals, external ESD behavior, or zero MCU injection.

## Recomputed resistance screen

The previous deferred arithmetic added the ADG's 37 ohm on resistance but did not carry charge injection. ADG specifies 340 pC typical at the 12 V condition, `VS = 6 V`, and `CL = 1 nF`; it publishes no maximum. The model also screens 640 pC as a deliberately conservative typical value taken from a different supply and signal condition, not as a 12 V specification or guarantee. At 450 ohms, 125 C, with the existing 2.5 V source path and 1.00 kOhm ADC resistor:

```text
R_SOURCE,max = 2525.978445 ohm + 37 ohm = 2562.978445 ohm
V_450        = 0.373385 V
R_TH          = 382.791 ohm
R_ADC,input   = 1402.891 ohm
dR/dV         = 1416.795 ohm/V
```

With the 10 nA ESD701 maximum-leakage screen, BAV199 pair leakage, ADG channel leakage, quantization, the same LQFP100-typical ADC INL screen, fixture allocation, and source TCR, the static subtotal is about 4.41 ohms. The ESD701 leakage value is specified at 24 V rather than the normal approximately 0.37 V line level, so this is a conservative screening input, not an applicable low-voltage measurement guarantee. This continues to use a non-applicable LQFP100 typical ADC term, so it is never a release budget.

At five time constants, applying the 340 pC 12 V typical value to the output-only 504.5 pF ADC-path capacitance gives about 6.43 ohms. Applying the conservative cross-condition 640 pC value to combined 1004.5 pF capacitance gives 6.08 ohms, but that assumes charge is shared with the input-side line capacitance. The fail-closed output-only 640 pC screen is about 12.11 ohms. With the static terms, the complete screen exceeds 16 ohms and fails the 4.50 ohm coupon-capture gate.

Ten time constants reduce the output-only conservative charge term enough for a conditional arithmetic total of about 4.49 ohms, just inside 4.50 ohms. This is not closure because the charge value is a typical from another condition, capacitances are not bounded, and the ADC term is not package-applicable. The 450 ohm foil screen takes about 11.35 us through two ADC ranks; this is diagnostic timing and is not the sabre limit. The separate 100 ohm sabre screen is about 8.47 us before ADG turn-on, charge uncertainty, comparator, logic, clock, phase-mask, and implementation delays. It therefore has no timing-release credit even though the incomplete arithmetic is below 10 us.

## Fault, startup, power, and thermal blockers

1. The ADG data sheet's plus or minus 78 uA **source-fault leakage** is typical only. It offers no maximum source-fault current for calculating a sustained plus or minus 24 V thermal or energy envelope. Its 65 nA drain-fault maximum is useful for downstream leakage, but cannot bound dissipated fault power in the protected source structure.
2. `ESD701` and the 22 ohm resistor provide a candidate 24 V-standoff connector-side ESD path, but they do not provide a qualified sustained body-cord fault current limit. Do not infer one from the diode's surge ratings.
3. The boost reference/divider screen is 11.974 V to 12.514 V only. TPS61041 load regulation, effective capacitor value, startup, ripple, component temperature, and the total `NXE1S0505MC` 1 W scoring-domain load are not closed. TPS61041 has no independent output-overvoltage shutdown in this proposal; neither its 28 V output limit nor the 50 V capacitor rating is overvoltage-protection credit. The additional rail is a low-load candidate, not proof that the isolated supply has remaining continuous or fault margin.
4. `V12_WINDOW` prevents a reset-state source-enable request from reaching an ADG input while the scoring logic is healthy. It has no credit during the supervisor's 450 us startup uncertainty, when the scoring `S3_3` rail is absent, or for an unmeasured brownout response. ADG's own power-off source protection and every input pulldown are required as independent defaults.
5. The model does not establish that the ADG's automatic open response keeps the existing TMUX, BAV199 clamps, STM32 pad, `S3_3`, `VDDA`, or reference rail at zero injection during the stated response interval. That needs a sacrificial coupon and direct current measurement.

## Required evidence before reconsideration

Build no apparatus board from this proposal. A separately reviewed sacrificial coupon would need to show the following at -40 C, 25 C, 85 C, and 125 C, across the declared capacitor banks and rail endpoints:

1. ADG source and drain leakage at 0 V, normal source voltage, plus 24 V, and minus 24 V while powered, ramping, brownout, and unpowered.
2. Differential traces at connector, post-ESD701, ADG source, ADG drain, TMUX input/output, ADC pad, `S3_3`, `VDDA`, `V12A`, `SGND`, and the two `FF` outputs, with calibrated MCU pad-current evidence.
3. A measured charge-injection distribution and a timing plan that remains within every sabre timing allocation without using typical values as limits.
4. Boost transient, surge, inrush, output capacitor, inductor, controller, diode, and isolated-converter temperature data at 50 C blocked-vent ambient.
5. A reviewed source-fault energy/current bound or a different front-end barrier with a published maximum. A 24 V source must never be attached to a live MCU coupon until this exists.

Until those conditions are met, any ADG fault, monitor-window fault, reset, or rail transition is `unavailable`, not a fencing signal or a pass through the M4-03 gate.
