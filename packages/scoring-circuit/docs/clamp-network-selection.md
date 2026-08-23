# M4-02 clamp and rail-protection candidate

## Decision and scope

Use the repeated candidate below for `left.A`, `left.B`, `left.C`, `right.A`, `right.B`, `right.C`, and `piste`. It is a coupon candidate, not a released schematic, BOM, PCB, compliance result, FIE approval, or fabrication approval. It preserves the connector TVS already in the architecture model and adds an external, independently sunk MCU-pin clamp. It does not rely on an STM32 internal clamp or a 3.3 V LDO to absorb a transient. That follows TI's guidance to use external diodes plus current limiting and to provide a supply clamp because the supply may not sink diverted current ([SBAA506](https://www.ti.com/lit/an/sbaa506/sbaa506.pdf)).

M4-03 must incorporate the stated leakage, capacitance, charge-injection, and ADC terms. M4-04 may capture this only as a coupon after its footprint and return-path review. The existing JSX, BOM, footprints, and readiness manifest remain deliberately unchanged.

## Exact candidate

| Ref. | Candidate | Connection and rationale |
| --- | --- | --- |
| `D_ESD`, each four-conductor group | TI `TPD4E05U06DQAR` | Connector conductor to `ESD_RETURN`; two quads cover seven conductors with one spare. TI lists it Active and specifies 0.5 pF typical capacitance, 10 nA maximum leakage at 2.5 V, 6.5 V minimum breakdown, 10 V clamp at 1 A, 2.5 A 8/20 us surge, 80 A EFT (5/50 ns), and IEC 61000-4-2 +/-12 kV contact or +/-15 kV air for the device ([Rev. O](https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf)). |
| `R_ESD`, each conductor | Vishay `CRCW060322R0FKEAHP`, 22 ohm, 1%, 0603 | Between the far side of `D_ESD` and the quiet sensing node. This is a pulse-proof high-power thick-film family; its ordering scheme supports 22R, 1% ([datasheet](https://www.vishay.com/doc?20043=)). It is not continuous-fault protection by itself. |
| `R_ADC`, each conductor | Vishay `CRCW06031K00FKEAHP`, 1.00 kohm, 1%, 0603 | Existing M4-01 MCU branch, with 470 pF C0G at the MCU pin. The same pulse-proof family as `R_ESD` makes the 1 kohm value and pulse screen reproducible; it isolates clamp capacitance and limits residual current. |
| `D_POS`, each conductor | Diodes Incorporated `BAV199-7-F` | Anode at MCU pin, cathode at `CLAMP_2V048`. One diode of the dual package is used. This PN diode limits full-temperature leakage: 0.90 V maximum at 1 mA, 1.0 V maximum at 10 mA, 5 nA maximum at 75 V, and 80 nA maximum at 75 V and 150 C ([datasheet](https://www.diodes.com/datasheet/download/BAV199.pdf)). |
| `D_NEG`, each conductor | onsemi `BAT54T1G` | Anode at `SGND`, cathode at MCU pin. It is an active 30 V Schottky, specified at 0.32 V maximum at 1 mA and 2 uA maximum reverse leakage at 25 V and 25 C ([datasheet](https://www.onsemi.com/pdf/datasheet/bat54t1-d.pdf)). ST recommends a Schottky pin-to-ground where negative ADC injection is possible ([STM32G474 datasheet](https://www.st.com/resource/en/datasheet/stm32g474rc.pdf)). |
| `V_CLAMP`, shared | TI `LM4040C20QDBZR`, 2.048 V shunt | Cathode at `CLAMP_2V048`, anode at `SGND`; never connected to `REF5025`. Q-grade is rated -40 C to 125 C. At 100 uA, the C20Q full-range reverse-breakdown-voltage tolerance is +/-30 mV. Its separately specified current-induced reverse-voltage change is 1 mV maximum from 80 uA to 1 mA and 8 mV maximum from 1 mA to 15 mA; thermal hysteresis is separately 0.08% ([Rev. Q](https://www.ti.com/lit/ds/symlink/lm4040.pdf)). It is a transient sink, not a measurement reference. |
| `R_BIAS`, shared | 10.0 kohm, 1%, 0603 | Directly from `3V3A` to `CLAMP_2V048`. Removing the proposed series Schottky is intentional: its 0.24 V value is specified only at 0.1 mA and 25 C, so it cannot establish the required -40 C to 125 C minimum shunt bias. The direct resistor has a reproducible full-range current calculation below. |

No fitted alternate is selected. `TPD4E05U06-Q1` is only a contingency because its typical dynamic resistance is 0.96 ohm rather than 0.8 ohm; it needs a new surge calculation before use. On 2026-08-22 TI listed [`TPD4E05U06DQAR`](https://www.ti.com/product/TPD4E05U06) and [`LM4040C20QDBZR`](https://www.ti.com/product/LM4040/part-details/LM4040C20QDBZR) Active, while authorized-distributor snapshots showed [`TPD4E05U06DQAR`](https://www.digikey.ca/en/products/detail/texas-instruments/TPD4E05U06DQAR/3996774), [`BAV199-7-F`](https://www.digikey.com/en/products/detail/diodes-incorporated/BAV199-7-F/1033645), and [`BAT54T1G`](https://www.mouser.com/en/ProductDetail/onsemi/BAT54T1G) stocked. These are sourcing observations, not purchase-time lifecycle or stock guarantees; recheck all four semiconductor MPNs before BOM release.

## Reproducible error, capacitance, and charge calculations

The limiting calculation uses the 450 ohm foil diagnostic band, a powered 3.3 V scoring domain, 2.5 V excitation, and the current M4-01 topology. The selected `CRCW060322R0FKEAHP` is 1%, not 5%: using its published 100 ppm/C TCR from 25 C to 125 C gives `R_ESD,max = 22 x 1.01 x 1.01 = 22.442 ohm`. Use the declared 2.49 kohm source candidate at +0.05% and 10 ppm/C, and `R_MUX = 9.8 ohm` from the TMUX1112 3.3 V +/-10%, -40 C to 125 C maximum. TI specifies the switch at 2 nA maximum on-leakage over temperature and -1.5 pC charge injection ([TMUX1112](https://www.ti.com/lit/ds/symlink/tmux1112.pdf)).

```text
R_S,max = 2490 x 1.0005 x 1.001 + 9.8 + 22 x 1.01 x 1.01 = 2525.978 ohm
V_450   = 2.5 x 450 / (2525.978 + 450) = 0.378027 V
R_TH    = R_S,max || 450 = 381.955 ohm
R_LEAK  = R_TH + (1000 x 1.01 x 1.01) = 1402.055 ohm
dR/dV   = R_S,max x 2.5 / (2.5 - V_450)^2 = 1402.5 ohm/V
```

| Contributor | Bound used | Voltage error | Equivalent resistance error |
| --- | ---: | ---: | ---: |
| `D_ESD` | 10 nA at 2.5 V | 3.82 uV | 0.0054 ohm |
| `D_POS` BAV199-7-F | 80 nA, conservatively using its 150 C, 75 V bound | 112 uV | 0.16 ohm |
| `D_NEG` BAT54 | 2.0 uA at 25 V, 25 C | 2.804 mV | 3.93 ohm |
| TMUX1112 source path | 2 nA | 0.76 uV | 0.0011 ohm |
| **Total stated bound** | **2.092 uA** | **2.921 mV** | **4.10 ohm** |

The 4.10 ohm allocation is below the current 5 ohm fixture target by only 0.90 ohm. BAT54 does not publish a full-temperature maximum at its actual 0.38 V reverse bias, so its 25 C, 25 V figure is not a valid full-range guarantee. The coupon must measure `|I_D_NEG(0.45 V)| <= 1.50 uA` and `|I_D_POS(2.1 V)| <= 0.10 uA` at -40 C, 25 C, 85 C, and 125 C. With the revised `R_LEAK` and `dR/dV`, those limits produce 3.15 ohm of clamp contribution; if either fails, reject or redesign the candidate rather than hiding it in calibration.

The TPD adds 0.5 pF typical at the cable node, just 0.1% of the 0.5 nF minimum fixture bank. BAV199 adds 2 pF typical and BAT54 10 pF maximum beside the 470 pF C0G capacitor. `1020.1 ohm x 482 pF = 0.492 us`; including `R_TH` gives 0.676 us, or 3.38 us for five time constants. This is inside the 10 us sabre scan budget but is only an RC estimate. M4-03 must use the STM32 sample capacitor, selected acquisition time, diode C-V curves, and PCB extraction.

One TMUX edge gives `1.5 pC / (500 pF + 470 pF) = 1.55 mV`, or 2.17 ohm at 450 ohms. Two same-polarity edges can reach 4.34 ohm before settling. Comparator qualification and ADC classification must therefore be blanked for at least 3.5 us after every source/sink state change, then proven to retain the 100 us sabre minimum contact. This is a phase-control requirement, not a passive-protection claim.

## Residual transient current and rail behavior

### Positive event: BAV199 into LM4040

The positive path is `connector -> D_ESD -> R_ESD -> R_ADC -> D_POS -> CLAMP_2V048 -> V_CLAMP -> SGND`. `D_NEG` is reverse-biased in this path. The TPD positive-clamp calculation uses only a typical interpolation, not a guaranteed maximum:

```text
V_TPD_POS,typ,est(2.5 A) = 10 V + 0.8 ohm x (2.5 A - 1 A) = 11.2 V
V_CLAMP_POS,max,screen = 2.048 V + 0.030 V + 0.008 V = 2.086 V
I_POS,plausible,25C = (11.2 V - 2.086 V - 1.0 V) / (22 ohm + 1000 ohm) = 7.94 mA
```

`10 V at 1 A` and `0.8 ohm` are TPD typical positive-direction data. `1.0 V` is BAV199's maximum at 10 mA and 25 C, used as a screening endpoint rather than a full-temperature bound. `2.086 V` combines the C20Q's 2.048 V nominal value, its +/-30 mV full-range tolerance at 100 uA, and the separately specified 8 mV current-induced change from 1 mA to 15 mA. Consequently, 7.94 mA is only a plausible 25 C operating estimate under the non-guaranteed 11.2 V TPD estimate: its maximum diode and clamp drops minimize, rather than bound, the secondary current.

For a loose upper-current screen under that same non-guaranteed 11.2 V TPD estimate, take the defensible minimum-drop envelope: zero `D_POS` drop because BAV199 publishes no guaranteed minimum, `V_CLAMP,min,screen = 2.048 V - 0.030 V - 0.008 V = 2.010 V`, and both 1% series resistors at minimum. This is deliberately an uncorrelated component-tolerance envelope, not a waveform prediction:

```text
R_SERIES,min = 990 ohm + 21.78 ohm = 1011.78 ohm
I_POS,upper,screen = (11.2 V - 2.010 V - 0 V) / 1011.78 ohm = 9.08 mA
```

The C20Q's 8 mV current-induced change is specified as a maximum magnitude, so the lower-voltage end of this screen takes it in the negative direction. No BAV199 minimum forward-voltage data are assumed. The result is not a guaranteed surge current because the TPD input is typical data, but it is the proper high-current screen for the downstream resistor and shunt checks.

For a deliberately conservative rectangular 20 us pulse at the 9.08 mA upper-current screen, resistor and LM4040 energies are screened with conservative current/voltage envelopes and assigned to the parts actually in the positive path:

```text
E_R_ADC,upper = I^2 x 990 ohm x 20 us = 1.63 uJ
E_R_ESD,upper = I^2 x 21.78 ohm x 20 us = 0.0359 uJ
E_V_CLAMP,upper = 2.086 V x I x 20 us = 0.379 uJ
I_V_CLAMP,total,upper,screen = 9.08 mA + 0.146 mA = 9.23 mA
```

The LM4040-energy voltage uses its 2.086 V upper envelope while the current calculation uses its 2.010 V lower envelope; that intentionally overstates energy and is not a physically correlated operating point. For context only, the 7.94 mA plausible 25 C estimate gives `E_D_POS,plausible,25C = 1.0 V x 7.94 mA x 20 us = 0.159 uJ`. BAV199 energy is not assigned an upper numeric value because the data available here have neither a full-temperature minimum nor maximum forward-voltage curve at this pulse; measure it. The final line includes the maximum steady bias derived below. It is below the 15 mA operating-current endpoint, but still depends on the same typical/interpolated TPD input and is not a rating claim. The actual 8/20 waveform, package thermal impedance, trace inductance, repetitive pulses, and BAV199 hot forward drop must be measured on the coupon.

### Negative event: BAT54 to SGND

For negative transients, the unidirectional TPD's lower steering diode conducts toward `ESD_RETURN`; the TPD's 10 V positive avalanche clamp and 0.8 ohm typical positive dynamic resistance do not describe this direction. The secondary intended path is `connector -> D_ESD lower diode -> R_ESD -> R_ADC -> D_NEG -> SGND`. `D_POS` and `V_CLAMP` are reverse-biased, so no negative-pulse energy is assigned to the BAV199 or LM4040.

No TPD maximum negative residual voltage/current is specified from which a valid numeric secondary negative-current or energy bound can be derived. If the coupon measures a residual negative peak `V_RES_NEG`, then calculate `I_D_NEG(t) = (abs(V_RES_NEG(t)) - V_F,BAT54(I,T)) / 1022 ohm` when positive, and integrate `E_D_NEG = integral(V_F x I dt)` and `E_R_ADC = integral(I^2 x 1000 ohm dt)`. The BAT54 forward-voltage table is 25 C data, so it may only guide setup, not prove the result over temperature. Coupon measurements must capture the negative residual and actual diode current before this polarity is accepted.

### Bias and back-power screen

Assume the M4-03 rail tolerance `3V3A = 3.3 V +/-5%`, so `3V3A,min = 3.135 V` and `3V3A,max = 3.465 V`. The C20Q full-range values at 100 uA are 2.018 V to 2.078 V. For an extra conservative resistor calculation, include the 1 mV maximum current-induced change below 1 mA: `V_CLAMP,max = 2.079 V`, `V_CLAMP,min = 2.017 V`. With the selected 10.0 kohm +/-1% resistor:

```text
I_BIAS,min = (3.135 V - 2.079 V) / 10.1 kohm = 104.6 uA
I_BIAS,max = (3.465 V - 2.017 V) / 9.9 kohm = 146.3 uA
```

This provides 24.6 uA margin above the C20Q's 80 uA full-range minimum current, and the maximum steady shunt current is 0.146 mA. Unlike the superseded Schottky-fed calculation, it does not use a 25 C diode forward-voltage figure to claim full-range regulation. The coupon must still measure clamp voltage and shunt current at -40 C, 25 C, 85 C, and 125 C with both rail limits, because load, layout, and the M4-03 rail tolerance remain design inputs rather than released hardware proof.

Direct `R_BIAS` does create a possible back-power path from a positive-driven `CLAMP_2V048` rail into an unpowered `3V3A` domain. With no credit for the unpowered rail's impedance, its current is screened only as `I_BACKPOWER,max,screen = 2.079 V / 9.9 kohm = 210 uA`; this does not show that the rail remains below any safe voltage. The coupon must measure it. ST allows only limited negative injection and warns that negative analog injection degrades other conversions. The external clamps are intended to avoid internal current, but power-off pad voltage, `VDDA`, `3V3A`, and actual injected current must be measured before calling rail back-powering closed.

## Return strategy and coupon gates

Place `D_ESD` directly behind the connector with a short, wide conductor-to-TVS-to-`ESD_RETURN` loop. `R_ESD` is on the quiet side, never in the return loop. Route `ESD_RETURN` on its own island to the connector shield or chassis bonding choice from M4-13; do not inject it through `SGND` or the reference return. The architectural `J_POWER_24V.CHASSIS -> ESD_RETURN` net is a placeholder, not a proven bonding design.

Place `R_ADC`, both pad clamps, the 470 pF C0G capacitor, and the MCU pad together on a small `SGND`-referenced island. Place `V_CLAMP` and `R_BIAS` beside it. Keep the guard rail separate from `REF5025`.

| Coupon test | Required evidence | Gate |
| --- | --- | --- |
| Temperature leakage | Per-channel diode, TVS, and powered/off switch leakage at the voltages above | Re-run 450/475 ohm budget with measured maxima. |
| Temperature bias current | `CLAMP_2V048` voltage and LM4040 cathode current with `3V3A` at 3.135 V and 3.465 V, at -40 C, 25 C, 85 C, and 125 C | Confirm 80 uA to 15 mA in the assembled coupon; the calculation is not a thermal measurement. |
| Clamp transient | Connector, quiet node, MCU pin, `CLAMP_2V048`, `3V3A`, `VDDA`, and `SGND` differential traces; both polarities | Measure BAV199/LM4040 positive-path current and BAT54 negative-path current, residual voltage, and no rail rise; do not infer either from the opposite TPD polarity. |
| Powered, brownout, unpowered fault | Both polarities and the M4-09-defined DC fault | No rail back-power, reset release, false comparator event, qualified touch, or damage. Continuous 24 V body-cord miswire remains unclaimed until tested. |
| Sacrificial ESD, EFT, surge | Exact waveform, coupling, cable, repetition, polarity, ambient, and post-test leakage | Proves only the tested coupon condition, never apparatus IEC, EMC, safety, or FIE approval. |
| Switch blanking | State, ADC/comparator traces, and 0.5/2/5/10 nF banks | No hit classification in blanking window; every required 100 us or longer timing boundary remains captured. |

## Handoff

M4-03 receives a 22 ohm connector isolation resistor, 1 kohm MCU isolation resistor, BAV199-7-F positive clamp to an independently sunk 2.048 V rail, BAT54 negative clamp to `SGND`, and a direct 10.0 kohm bias from `3V3A` that requires a power-off back-feed measurement. It must close ADC acquisition, MCU pad type and limits, source/sink calibration, threshold margin, temperature leakage, temperature bias current, and comparator blanking. M4-04 must perform ERC, manufacturer-drawing footprint review, and return-path review before coupon capture. Remaining gates are M4-03 through M4-05, M4-08, M4-09, M4-13, and M4-14; none is closed by this document.
