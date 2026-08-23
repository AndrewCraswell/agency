# M4-03 source, reference, switch, and ADC error budget

## Result and scope

This is the M4-03 calculation record for the repeated sensing cell in M4-01 and the M4-02 clamp candidate. It covers
`left.A`, `left.B`, `left.C`, `right.A`, `right.B`, `right.C`, and `piste`; the values apply once per conductor, not as
an unsupported claim that seven leakage paths add to one channel. It is a coupon budget, not a released schematic,
footprint, BOM, fabrication package, compliance result, or FIE approval.

**Verdict: DENY. M4-01 is also an unsatisfied predecessor gate.** The passive topology and 47.5-cycle ADC acquisition
are analytically adequate only for a static sample after the defined blanking interval. The M4-01 ngspice run is a
51-case selected-device bounded series screen, not vendor/full-corner proof: it uses the TMUX full-temperature RON
limit and selected resistor tolerance/TCR, but it omits the clamps, ADC sampling kickback, PCB/cable parasitics, and
MCU rail injection. It therefore cannot establish the temperature, input-voltage, or tolerance coverage required by
M4-01, and cannot support an M4-03 release.

Independently, the proposed component set does **not** meet the `+/- 5 ohm` M4-01 fixture target at the 450 ohm foil
boundary. At 125 C after a 25 C calibration, the absolute-sum screen is 7.20 ohms, failing by 2.20 ohms. That screen
uses only stated clamp gates, a published ADC EL typical-characterization screen, a selected source-resistor temperature
coefficient, fixture allocation, and settled typical switch charge. It excludes unproven switch drift, board leakage,
reference dynamics, and LQFP64 ADC/comparator limits, so it is not a passable guarantee by omission.

The ADC linearity data are for an LQFP100 characterization condition, not this LQFP64 part. The comparator/DAC path has
no applicable numeric threshold guarantee for the proposed operating point and is prohibited from classifying the
450/475 ohm boundary. M4-08 validates a coupon after M4-04, but it cannot waive M4-01/M4-03. The current candidate has
not met the conditional analytical gate for M4-04 coupon capture described below, so this result does not authorize its
fabrication. Until an analytical redesign or reviewed corner model closes that gate, the threshold budget is open and the
product must report boundary overlap as `indeterminate` as required by the signal contract.

This baseline result does not release a different clamp, comparator threshold circuit, or physical seven-conductor phase
map. Those are M4-02, M4-04, M4-05, and SIG gates, respectively. It records a bounded leakage-only experiment below for
M4-02 review; it is not a recommended redesign and is not added to a production BOM.

## Bounded leakage-only experiment (not a supportable redesign)

Replacing the `BAT54T1G` negative clamp with one diode of the already-used `BAV199-7-F` low-leakage dual diode is
retained only as a coupon leakage experiment. The existing positive clamp is also a BAV199 diode. This keeps the source,
switch, 1 kohm ADC isolation, 470 pF filter, external TPD, and two-point calibration architecture unchanged, but it does
not establish that the external negative clamp conducts before an STM32G474 pad protection path. It is not a supportable
component-only release direction and does not change the current M4-02 candidate decision.

The [Diodes BAV199 Rev. 11 data sheet](https://www.diodes.com/datasheet/download/BAV199.pdf) specifies 5 nA maximum
reverse leakage at 75 V and 25 C and 80 nA maximum at 75 V and 150 C, 0.90 V maximum forward voltage at 1 mA, 160 mA
forward continuous current, and 3 us maximum reverse-recovery time. The 80 nA value is an upper-temperature vendor
maximum, not an all-temperature leakage characterization, and it is tested at 75 V rather than the actual approximately
0.45 V negative-clamp reverse voltage or approximately 1.67 V positive-clamp reverse voltage. Therefore it is used only
as a bounded screening input; a low-voltage assembled
coupon result is still required. The 0.90 V value is a maximum at one current point, not a minimum forward-voltage or
low-current knee guarantee.

The [onsemi BAT54T1G data sheet](https://www.onsemi.com/pdf/datasheet/bat54t1-d.pdf) specifies 2 uA maximum reverse
leakage at 25 V and 25 C and 0.32 V maximum forward voltage at 1 mA. Those bounds explain the tradeoff: BAT54 is more
favorable for a low-voltage negative clamp, while BAV199 is more favorable for the static leakage screen.

At 450 ohms, screening both BAV199 clamp diodes at 80 nA gives 0.16 uA total and 0.31 ohm through the same ADC-node
leakage path used by the existing screen:

```text
I_CLAMP,experiment = 80 nA + 80 nA = 0.16 uA
R_CLAMP,experiment = 0.315 ohm
E_SCREEN,experiment = 0.315 + 0.428 + 2.654 + 0.500 + 0.028 + 0.444 = 4.369 ohm = 4.37 ohm
```

This is 0.63 ohm below the 5.00 ohm target, compared with the baseline 3.15 ohm clamp term and 7.20 ohm screen. It is a
leakage-term screen only, not a release margin: it still includes the LQFP100 typical ADC EL screen, the unmeasured
switch/protection/board/reference residual, and the allocated fixture uncertainty.

### External-clamp priority and conditional negative-current screen

The negative event path is `TPD lower steering diode -> R_ESD (22 ohm) -> R_ADC (1 kohm) -> D_NEG -> SGND`. Define
`V_RES_NEG` as the voltage from the post-TPD conductor (after the TPD lower steering diode and upstream of `R_ESD`) to
`SGND`. For a negative `V_RES_NEG`, conventional current flows from `SGND` through the negative clamp, `R_ADC`, and
`R_ESD` toward that post-TPD conductor. The
[STM32G474 DS12288 Rev. 6](https://www.st.com/resource/en/datasheet/stm32g474rc.pdf) gives all TT_xx pins a `V_IN`
minimum of `VSS - 0.3 V` in its absolute-maximum table. It gives negative injection of `-5 mA` per eligible pin and an
absolute sum of `25 mA`; the I/O susceptibility table repeats the `-5 mA / 0 mA` TT_a polarity. These are stress or
susceptibility limits, not a functional accuracy allowance. ST also warns that negative injection can reduce the
accuracy of another ADC conversion and recommends an external Schottky to ground. The data sheet does not specify an
internal pad-clamp knee or its forward-voltage tolerance.

The BAV199's `0.90 V` maximum at `1 mA` is therefore not enough to prove external priority: at the specified test point,
the external diode may allow the MCU pin to be as low as `-0.90 V`, beyond ST's `-0.30 V` input boundary, and no BAV199
minimum forward-voltage curve is specified near zero current. The [TI TPD4E05U06 Rev. O data sheet](https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf)
specifies `3 V` typical from GND to I/O at `1 A` and `7 V` typical at `5 A`, but supplies no maximum negative residual
voltage. Its `2.5 A` surge rating and typical clamp values cannot prove either external-clamp priority or a bounded MCU
injection current.

For a measured `V_RES_NEG` at that post-TPD conductor, a conditional current screen through the existing 22 ohm plus
1 kohm path is:

```text
I_INJ,screen = max(0, (-V_RES_NEG - 0.30 V) / (22 ohm + 1,000 ohm))
```

The `0.30 V` endpoint is the ST input boundary, not an assumed internal-diode knee. It produces the following scale
values if `V_RES_NEG` reaches the post-TPD conductor and the MCU pin is held at `-0.30 V`:

| Conditional post-TPD conductor residual | Current screen through 1,022 ohm | Interpretation |
| ---: | ---: | --- |
| `-0.5 V` | `0.196 mA` | Non-zero internal-injection risk even for a small residual |
| `-1 V` | `0.685 mA` | Below the ST absolute maximum, but not the project's 0 mA target |
| `-3 V` | `2.642 mA` | Below the per-pin absolute maximum, but still non-zero; 3 V is only a TPD typical value |
| `-7 V` | `6.556 mA` | Exceeds the ST `-5 mA` per-pin absolute maximum; 7 V is only a TPD typical value |
| `-24 V` | `23.19 mA` | Exceeds the per-pin limit; a continuous 24 V body-cord miswire remains unbounded until measured |

These values are conditional screens, not claims that the TPD produces those post-TPD residuals. They show why merely staying
below the STM32 absolute maximum is insufficient: the project requires 0 mA internal injection and no cross-channel
ADC disturbance. Until the low-voltage BAV199 forward path, TPD negative residual, and MCU pin current are measured
together, external priority cannot be guaranteed. If the residual is instead measured at the downstream quiet ADC node,
the 22 ohm resistor has already been crossed and this 1,022 ohm screen must not be reused; measure the actual pad current
with the node definition recorded.

| Property | Existing BAT54T1G | BAV199 leakage experiment | Release implication |
| --- | --- | --- | --- |
| Reverse leakage guarantee | `2 uA` max at 25 V, 25 C | `80 nA` max at 75 V, TJ 150 C | BAV199 improves the arithmetic leakage screen, but both values require actual low-voltage measurement |
| Forward-voltage guarantee | `0.32 V` max at 1 mA | `0.90 V` max at 1 mA | BAT54 has the more favorable published endpoint; BAV199 cannot prove clamping within the STM32 `-0.30 V` boundary |
| External-priority evidence | No MCU-priority proof | No MCU-priority proof; no low-current minimum-VF guarantee | Neither component-only path closes the 0 mA injection requirement without coupon evidence |
| TPD negative path | `3 V/1 A` and `7 V/5 A` are typical only | Same TPD path | No TPD maximum negative residual is available for a release bound |

No genuinely supportable component-only redesign is identified in this bounded audit. BAT54 has a more favorable
published forward-voltage endpoint but fails the leakage screen; BAV199 improves leakage but cannot prove external-clamp
priority. A replacement would need full-temperature vendor bounds for low-current forward voltage and leakage at the
actual pin voltages, plus a measured or guaranteed TPD negative residual. The BAV199 remains an **unresolved,
leakage-only experiment**, not the recommended candidate. M4-08 must measure negative residual voltage, actual clamp
current and energy, MCU pin injection, and no cross-channel ADC disturbance at -40 C, 25 C, 85 C, and 125 C, with both
rail limits and every declared line-capacitance bank.

The STM32G474 hardware oversampler is not a compatible way to close the remaining error. ST documents hardware
oversampling and up to 16-bit output in the [STM32G474 DS12288 Rev. 6](https://www.st.com/resource/en/datasheet/stm32g474rc.pdf),
and the [RM0440 ADC reference manual](https://www.st.com/resource/en/reference_manual/rm0440-stm32g4-series-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)
defines 2x through 256x averaging. Averaging improves noise and quantization resolution; it does not turn the Table 72
LQFP100 typical integral-linearity result into an LQFP64 guarantee. The current six-rank diagnostic conversion is
`6 x 1.154 us = 6.92 us`; even 2x oversampling adds approximately 6.92 us and moves the 31.47 us full-diagnostic
acquisition farther beyond the 25 us target. A 2x two-rank 100-ohm sabre sample likewise moves the 9.98 us allocation
past the 10 us target. Oversampling therefore receives no error or timing credit. Two-point calibration removes static
offset and gain only; a multi-point production correction could be evaluated after a measured coupon result, but it
cannot close the current analytical gate by assumption.

**Leakage-experiment disposition: STILL DENY.** The BAV199 arithmetic screen is below 5.00 ohms, but it is not an
electrically justified redesign because external-clamp priority is unproven. No component-only redesign is currently
supportable. M4-03 remains denied until M4-08 supplies low-voltage temperature leakage/transient evidence, measured
negative-path injection, and a full-corner per-channel LQFP64 ADC residual bound. No comparator threshold credit,
typical-only ADC credit, or weakened fixture requirement is used.

The bounded topology decision in
[`m4-03-minimal-topology-decision.md`](m4-03-minimal-topology-decision.md) found no compliant no-new-rail isolation
revision. It therefore does not change this error budget, permit a fault-isolator coupon, close M4-01 or M4-03, or
release a schematic, board, BOM, or fabrication output.

## Inputs and primary sources

The M4-01 cell is a 2.5 V `REF5025AQDRQ1`-derived source, 2.49 kohm source resistor, `TMUX1112` source and sink switches,
22 ohm connector-side series resistor, then a 1.00 kohm ADC resistor and 470 pF C0G capacitor. M4-02 fixes the coupon
candidate `TPD4E05U06DQAR`, `BAV199-7-F`, `BAT54T1G`, and `LM4040C20QDBZR`. The calculation uses their M4-02 limits
without promoting a candidate to a production selection.

The relevant manufacturer limits are:

- [TI TMUX1112 Rev. C](https://www.ti.com/lit/ds/symlink/tmux1112.pdf): 9.8 ohms maximum on resistance over -40 C to
  125 C at 3.3 V +/- 10%, 2 nA maximum on leakage over that range, 17 pF typical on capacitance, and -1.5 pC charge
  injection. The selected 3V3A screen is 3.3 V +/- 5%, inside this supply condition.
- [TI REF5025A-Q1 Rev. H](https://www.ti.com/lit/ds/symlink/ref5025a-q1.pdf): active automotive 2.5 V series reference,
  0.1% maximum initial accuracy, 8 ppm/C maximum temperature coefficient, 2.7 V to 18 V input range, and +/-10 mA
  output capability. The reference's initial accuracy, drift, input-line regulation, and load regulation cancel only
  when the excitation and ADC `VREF+` observe the same settled reference node at the conversion instant.
- [Panasonic ERA-3A](https://na.industrial.panasonic.com/whats-new/era-3a-series): coupon source-resistor candidate,
  2.49 kohm, 0.05%, 10 ppm/C thin film. Its initial tolerance is calibrated out; its 10 ppm/C TCR produces the explicit
  post-calibration 0.44 ohm 25 C to 125 C term below. The family is high-reliability and AEC-Q200 applicable. Its
  endurance and exact orderable MPN are service and M4-04 land-pattern verification inputs, not credits in this
  one-cycle thermal budget.
- [TI TPD4E05U06 Rev. O](https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf): 10 nA maximum leakage at 2.5 V and 0.5 pF
  typical line capacitance. The data-sheet ESD rating is not a system ESD result.
- [ST STM32G474xB/xC/xE DS12288 Rev. 6](https://www.st.com/resource/en/datasheet/stm32g474rc.pdf): `CADC` is 5 pF
  typical and ADC calibration is recommended after each power-up. Table 67 permits a 1.8 kohm slow-channel external
  input impedance at 47.5 cycles and 60 MHz. The two-ADC schedule uses 52 MHz because Table 71's multiple-ADC
  condition limits single-ended operation to 52 MHz; using the 1.8 kohm 60 MHz table value at the slower 52 MHz sample
  rate is conservative. Table 66 gives `tLATR` a 2.5 ADC-cycle maximum for `CKMODE = 00`, which is the explicit timing
  assumption here. The published multi-ADC full-temperature accuracy tables name LQFP100, so they cannot close the
  LQFP64 accuracy term. The datasheet also states that negative injection degrades other ADC conversions and recommends
  an external Schottky to ground.
- M4-02 supplies the BAV199, BAT54, LM4040, and Vishay-resistor limits and its explicit clamp-leakage screen. See
  [`clamp-network-selection.md`](clamp-network-selection.md).

The executable definitions and equations are in
[`src/analog-model.ts`](../src/analog-model.ts); their numeric regression tests are in
[`src/analog-model.test.ts`](../src/analog-model.test.ts). Values below are rounded only for prose. Tests retain the
unrounded expressions.

## Channel and pad coverage

| Conductor | Pad, LQFP64 pin | ADC role | Comparator | ST pad structure | Acquisition class |
| --- | --- | --- | --- | --- | --- |
| `left.A` | PA0, 12 | ADC1 `ADC12_IN1` | COMP3 INP | TT_a | fast |
| `left.B` | PA1, 13 | ADC1 `ADC12_IN2` | COMP1 INP | TT_a | fast |
| `left.C` | PA3, 17 | ADC1 `ADC1_IN4` | COMP2 INP | TT_a | fast |
| `right.A` | PB0, 22 | ADC1 `ADC1_IN15` | COMP4 INP | TT_a | slow |
| `right.B` | PB13, 33 | ADC3 `ADC3_IN5` | COMP5 INP | TT_a | fast |
| `right.C` | PB11, 29 | ADC1 `ADC1_IN14` | COMP6 INP | TT_a | slow |
| `piste` | PB14, 34 | ADC1 `ADC1_IN5` | COMP7 INP | TT_a | fast |

This repeats the candidate allocation in [`stm32-pin-allocation.md`](stm32-pin-allocation.md). DS12288 identifies these
seven as `TT_a`; for these pins positive injection is not an allowed operating mechanism and negative injection is
limited to -5 mA per eligible pin with an absolute sum limit of 25 mA. Those are absolute-maximum limits, not an error
budget. The design target is **0 mA internal injection** in normal measurement and fault screens. The external negative
Schottky and positive shunt path are therefore required to steer residual current away from the MCU; a calculated
current below -5 mA is not a pass criterion.

The seven physical source enables and seven sink enables remain as allocated in `stm32-pin-allocation.md`. Their
pulldowns must dominate reset, debug, and an unpowered STM32. No physical phase map is inferred here: `SIG-01` and
`SIG-02` still control which source and sink pair represents each foil, epee, sabre, or piste observation.

## Static transfer function and calibration

At the limiting foil diagnostic point, M4-02 supplies the corrected conservative source path. Its maintenance correction
does not change the clamp decision or the stated coupon measurement gates.

```text
R_S,max = 2490 x 1.0005 x 1.001 + 9.8 + 22 x 1.01 x 1.01 = 2525.978 ohm
V_450   = 2.5 x 450 / (2525.978 + 450) = 0.378027 V
R_TH    = R_S,max || 450 = 381.955 ohm
dR/dV   = R_S,max x 2.5 / (2.5 - V_450)^2 = 1402.5 ohm/V
```

This is the **source-on, sink-off** resistance-reading phase. The sink TMUX has the same 3.3 V +/- 10%, 9.8 ohm, and
2 nA published limits, but no sink-resistor value or final return topology is assigned until SIG-02 freezes the phase
map. Its on-resistance is therefore deliberately absent from the source transfer function. A phase must never enable a
source and sink on the same conductor; an enabled sink is a separately calibrated continuity/fault stimulus, not a
hidden correction to this source measurement. M4-08 must record sink-on voltage/current, off leakage, switch-control
state, and temperature at every phase that uses it. Until that result exists, no sink-path threshold or timing credit is
claimed.

The calculation is ratiometric only if the source amplitude and `VREF+` are both valid, settled, and derived from the
same `REF5025AQDRQ1` output. Reference drift and initial voltage tolerance then cancel in the resistance ratio. The
20 V USB-PD input does not appear directly in the transfer function. Its only possible error credit is through a released
regulator and the reference input: those must maintain `3V3A` at 3.135 V to 3.465 V and keep the reference in its
2.7 V to 18 V operating range. Reference startup, source/VREF+ impedance mismatch, ADC reference-load transients,
reference load regulation, routing drop, and a missing reference do not cancel and must force `unavailable`. The existing
allocation has not released the regulator, reference buffer/decoupling, or `VREF+` routing, so there is no unconditional
reference-accuracy credit and no claimed 20 V USB-PD input-tolerance result.

The STM32 performs its internal ADC self-calibration after power-up and after any relevant ADC reset or configuration
reinitialization, as the ST data sheet recommends. That is not an external resistance calibration. A channel-local
two-point electrical calibration with traceable 0 ohm and 500 ohm fixture standards is a factory or controlled-service
operation after the full source, switch, connector protection, ADC, and clamp path is populated. Ordinary MCU reset
does not require a fixture.

Persist external coefficients with integrity protection and channel, hardware revision, ADC configuration, source/sink
phase, fixture identity and uncertainty, calibration temperature, and firmware compatibility metadata. A normal reset
may reuse them after internal self-calibration only when their integrity and configuration identity match and reference
health/self-test passes. Invalidate them on integrity failure, component or configuration mismatch, failed drift or
reference self-test, controlled-service policy, or an explicit recalibration command. Two-point calibration may remove
static source, switch, resistor, reference-ratio, offset, and gain terms; it may not erase temperature drift,
non-linearity, leakage curvature, charge injection, or an invalid phase.

The 450/475 ohm foil diagnostic has a 25 ohm FIE guarantee gap. A midpoint reporting threshold at 462.5 ohms has
12.5 ohms separation from either guarantee boundary. The M4-01 +/-5 ohm fixture target therefore has 7.5 ohms decision
margin, provided the measured interval is no wider than +/-5 ohms. The 450 to 475 ohm band remains `indeterminate`; no
calibration may convert it into a guaranteed on or off outcome. Other FIE values are capability boundaries rather than
released electrical thresholds until SIG-02 and the weapon phase map specify their direction and classification rule.

## Error budget at 450 ohms

The following is an absolute-sum screen, not RSS. Its clamp, quantization, fixture, and source-resistor terms use the
stated limits, while the 3.1 LSB ADC EL term is only a typical LQFP100 characterization value. It is therefore neither
an LQFP64 worst-case guarantee nor a pass claim. `mV` values use 1402.5 ohm/V. The source-resistor term is calibrated
at 25 C and evaluated at the worst 125 C endpoint. No term marked a measurement gate receives an unearned numeric credit.

| Contributor | Bound and treatment | Error, ohms | Status |
| --- | --- | ---: | --- |
| Source 0.05%, TMUX resistance, 22 ohm resistor | Removed only by complete channel two-point calibration | 0 after calibration | calibration condition |
| Source-resistor TCR | 2.49 kohm, 10 ppm/C, 25 C calibration to 125 C; exact ratio calculation | 0.44 | bounded coupon candidate |
| TMUX/22 ohm temperature and voltage drift | 9.8 ohm is a maximum, not a calibrated drift envelope at the approximately 1 mA source current | unbounded | measurement gate |
| REF5025A-Q1 initial error and drift | Ratiometrically removed only with common valid source and VREF+ | 0 after calibration | reference-health gate |
| 3V3A and 20 V USB-PD input variation | No direct transfer term only after regulator/reference health proves the stated input range; source/switch behavior must be measured | unbounded | measurement gate |
| M4-02 clamp leakage | M4-02 coupon screen: `|I_D_NEG(0.45 V)| <= 1.50 uA` and `|I_D_POS(2.1 V)| <= 0.10 uA` | 3.15 | measurement gate |
| ADC half-code quantization | 0.5 x 2.5 V / 4095 = 0.305 mV | 0.43 | bounded |
| ADC EL integral-linearity typical screen | Table 72: 3.1 LSB typical x 2.5 V / 4095 = 1.892 mV | 2.65 | LQFP100 characterization only |
| Two-point fixture interpolation and standard uncertainty | Allocation, not an achieved result | 0.50 | M4-05 acceptance allocation |
| TMUX charge after five local time constants | 4.19 ohms initial two-edge pedestal x exp(-5) | 0.03 | only after blanking |
| ADC residual, PCB leakage, and reference dynamics | No LQFP64 full-corner bound or assembled-coupon result | unbounded | measurement gate |
| Comparator/DAC resistance threshold | Prohibited from resistance classification; see the separate non-credit screen below | 0 | architectural restriction |

The displayed static screen is `0.444 + 3.15 + 0.428 + 2.654 + 0.500 + 0.028 = 7.204 ohms = 7.20 ohms`. It fails the
5.00 ohm target by 2.20 ohms before the unbounded switch, board, reference, LQFP64 ADC, supply, and input terms. Even granting external
two-point gain and offset correction, integral non-linearity is not automatically removed. The 3.1 LSB is specifically
ST's **EL, single-ended integral-linearity, typical** result in DS12288 Table 72: multiple-ADC operation, <=52 MHz,
`VDDA >= 2.7 V`, `VREF+ >= 1.62 V`, -40 C to 125 C, 2.5/6.5-cycle sampling, and LQFP100. It is characterized after
internal calibration, not production-tested, and is neither a total-unadjusted-error value nor an LQFP64 guarantee.

The remaining conditional allocation is:

```text
5.00 - 3.15 clamp - 0.428 quantization - 0.500 fixture - 0.028 settled charge - 0.444 source TCR = 0.450 ohm
```

Thus, if M4-08 replaces the unsuitable ADC EL typical screen with a measurement, the **sum** of measured residual ADC non-linearity,
post-calibration switch/protection temperature and supply drift, PCB leakage, reference dynamics, and any
comparator-to-ADC correlation error must be at most 0.45 ohms at each required temperature and line bank. This is a
narrow conditional margin, not a design release. A larger measured term fails M4-03 and requires a new M4-02/M4-03
candidate or a revised, reviewed acquisition method.

## Minimum credible closure path

No component or calibration-only change is released by this audit. Replacing the negative clamp with BAV199 makes the
leakage-only arithmetic 4.37 ohms, but it does not prove external-clamp priority, and a third calibration point cannot
turn an LQFP100 typical ADC result or temperature-dependent leakage into an LQFP64 guarantee. An external precision ADC
or comparator threshold scheme would be a materially different topology with no supporting error or timing evidence;
neither is a smallest defensible change.

### Non-circular coupon-capture gate

M4-04 may capture a **single-channel, non-release coupon** only when a reviewed M4-01/M4-03 model has a bounded
post-calibration DUT residual half-width of at most 4.50 ohms at every declared corner, a bounded safety screen, and a
reviewed measurement plan for every remaining accuracy variable. This is a conditional analytical threshold for learning
from the coupon, not an M4-03 threshold-release claim. The current candidate fails it: its 7.20 ohm screen already
exceeds 5.00 ohms, and the negative-clamp priority has no bounded safety screen.

For each standard and corner, define the signed residual as `e = R_DUT - R_standard`. The reviewed pre-coupon model must
bound both signs, `-E_minus <= e <= E_plus`, and use `E_DUT = max(E_minus, E_plus)`. It permits M4-04 only if:

```text
E_MODEL = worst-case half-width of analytically bounded DUT contributors <= 4.50 ohms
every unbounded accuracy contributor is an explicit coupon-measurement variable, not a budget credit
every safety contributor is bounded for coupon capture
```

The 4.50 ohm half-width is `5.00 ohms - 0.50 ohms`. The 0.50 ohm term is the maximum allowed expanded fixture-standard
and measurement uncertainty, `U_FIX`, at the stated coverage factor; it is not a signed DUT residual, a second
calibration error, or a 1.00 ohm full-width interval. M4-05 must define the coverage factor and include the standard,
instrument, relay/contact, temperature, and repeatability contributions. An unbounded accuracy term may justify coupon
characterization only when it is excluded from `E_MODEL` and cannot produce a qualified touch during the experiment; it
can never be silently treated as zero.

M4-08 separately closes a measured condition only when, for every required standard and corner, its estimated signed
bias and repeatability envelope produce `E_DUT,measured`, and the demonstrated fixture uncertainty produces `U_FIX`,
such that:

```text
max over all corners (absolute signed DUT bias plus its repeatability allowance) + U_FIX <= 5.00 ohms
```

Equivalently, if a symmetric DUT interval is reported with full width `W_DUT`, use `W_DUT / 2 + U_FIX <= 5.00 ohms`.
Do not compare a full width directly to 5.00 ohms, and do not treat the 450 to 475 ohm indeterminate band as a pass by
choosing a favorable residual sign.

The minimum predecessor correction is to re-audit M4-01 with the selected devices rather than resistance proxies. At
the 450/475 ohm boundary and all four declared line-capacitance banks, vendor bounds can model source-resistor tolerance
and TCR, `R_ESD`/`R_ADC` tolerance, TMUX on resistance and off leakage, REF5025 initial/drift/load limits, declared
capacitance limits, and supply ranges. Those inputs are necessary but not sufficient. The re-audit must include:

1. the available vendor-guaranteed temperature and supply corners for the TMUX source and sink paths, `R_ESD`,
   `R_ADC`, REF5025 source and `VREF+` load, and the passive input network;
2. the actual clamp topology, ADC sample-and-hold/kickback, and a reviewed PCB/cable parasitic envelope; and
3. the M4-01 resistance, capacitance, and stated pulse-width matrix, retaining the model's limitations in generated
   evidence.

The following effects are necessarily coupon gates unless a package- and condition-applicable maximum is obtained:
low-voltage clamp leakage and forward priority, TPD negative residual, LQFP64 ADC residual, ADC kickback, TMUX charge
injection, assembled PCB/cable parasitics, reference-node dynamic mismatch, MCU-pad injection, and cross-channel ADC
effect. A vendor typical curve does not convert any of these into a bound. This correction may leave M4-01 denied, which
is a valid outcome. It is the smallest honest change because it changes neither the BOM nor the topology while
establishing whether a component change is actually needed.

Only after that M4-01 re-audit and an M4-03 candidate review can a single-channel coupon make the following minimum
measurements. They separate the present dominant terms and avoid treating a fixture allocation as a DUT result:

| Measurement set | Minimum conditions | Acceptance use |
| --- | --- | --- |
| Calibrated resistance residual | 0, 450, 475, and 500 ohms after the defined two-point calibration; 3V3A and 24 V extremes; -40 C, 25 C, 85 C, and 125 C; each line-capacitance bank | At each standard/corner, report signed bias and its repeatability allowance. Let `E_DUT,measured` be the maximum absolute signed bias plus that allowance, and `U_FIX` the separately demonstrated expanded fixture uncertainty. Accept only `E_DUT,measured + U_FIX <= 5.00 ohms`, or equivalently `W_DUT / 2 + U_FIX <= 5.00 ohms` for a symmetric full-width interval. |
| Clamp leakage and priority | `D_NEG` at the actual approximately 0.45 V reverse condition and `D_POS` at approximately 2.1 V; powered, brownout, and unpowered rails; the same temperatures | Replace the 3.15 ohm clamp screen with measured maxima and prove that the external path, not the STM32 pad, carries current. |
| Negative fault path | Connector, post-TPD conductor, quiet ADC node, MCU pad, `SGND`, `VDDA`, and `3V3A` differential traces plus a calibrated current probe; both rail limits and temperatures | Establish a one-sided pad-current upper bound of `abs(mean current) + expanded current uncertainty <= I_INJ_ALLOC`, with the mean consistent with zero within its stated uncertainty. `I_INJ_ALLOC` and the corresponding cross-channel `DeltaR_ADC_ALLOC` must be allocated inside `E_DUT`; prove `abs(mean DeltaR_ADC) + expanded uncertainty <= DeltaR_ADC_ALLOC`. A current below the absolute maximum alone is not a pass. |
| Reference and ADC behavior | Excitation and `VREF+` at the conversion instant, reference startup/absence, raw ADC codes, internal calibration state, and repeated conversions | Verify ratiometric cancellation rather than assuming it, and obtain the applicable LQFP64 residual. |
| Source/sink and comparator timing | Every intended source/sink phase mask, switch-control edge, 0.5/2/5/10 nF banks, comparator input/output, and HRTIM capture | Bound charge injection, settling, sink-path behavior, comparator threshold, and propagation. Comparator evidence may timestamp only; it receives no 450/475 ohm classification credit. |

These are M4-04/M4-05/M4-08 execution inputs, not evidence that the current unreviewed circuit can be fabricated. Until
the M4-01 correction and M4-03 review produce a candidate suitable for a coupon, the product has no analytical
threshold closure.

For context, the uncalibrated screen also fails: the M4-02 pre-screened 4.10 ohm clamp estimate, the 2.65 ohm ADC EL
typical screen, and the 4.19 ohm initial two-edge switch pedestal already exceed 10 ohms, before ADC gain/offset,
resistor temperature coefficient, or reference routing. Calibration and blanking are mandatory controls, not optional
refinements.

### Comparator threshold non-credit

The comparator is a capture aid, not a calibrated resistance instrument. ST's DAC table gives an after-calibration
total-unadjusted-error figure of +/-23 LSB for a buffered DAC under a stated 3.6 V reference and load condition; mapping
that count to this 2.5 V reference is a **non-applicable sanity screen** of +/-14.0 mV or +/-19.6 ohms at 450 ohms before
comparator offset, hysteresis, propagation, input-overdrive, routing, and temperature terms. It exceeds the entire
12.5 ohm foil decision guard, so neither that mapping nor the DAC result can support a 450/475 ohm decision.

For a comparator to timestamp a transition, M4-08 must measure the actual comparator input crossing versus the ADC
resistance estimate at each selected threshold, VDD and 20 V USB-PD input extreme, -40 C, 25 C, 85 C, and 125 C. It must also
bound propagation delay and HRTIM capture skew under the actual overdrive and phase mask. The resulting threshold must
remain a prequalification/timestamp threshold only unless a separate reviewed budget changes this restriction.

## Sampling capacitor, source impedance, and line banks

The STM32's 5 pF typical sample-and-hold capacitor is included with 470 pF C0G, 10 pF maximum BAT54, 2 pF typical
BAV199, 17 pF typical enabled TMUX capacitance, and 0.5 pF typical TPD capacitance. That gives 504.5 pF at the ADC
node for the local five-time-constant screen. It is not a maximum-capacitance guarantee: coupon measurement must bound
the actual pad, trace, diode C-V, and sample kickback contribution.

At 500 ohms, the maximum ADC driving impedance is:

```text
R_ADC,drive = (2525.978 || 500) + 1020.1 = 1437.5 ohm
```

The selected 47.5-cycle, 52 MHz two-ADC acquisition uses DS12288's more conservative 1.8 kohm slow-channel limit from
the faster 60 MHz Table 67 condition, leaving 362.5 ohms analytic margin. It therefore covers the slow `right.A` and
`right.C` pads as well as the five fast pads. A shorter sample time is not released. Under `CKMODE = 00`, Table 66 gives
a 2.5-cycle maximum trigger latency: 0.048 us at 52 MHz. Six ADC1 ranks then take 6.923 us, while ADC3's one rank runs
concurrently. This timing remains open until CubeMX, target clock configuration, DMA, and HRTIM behavior are proven.

| External resistance | 0.5 nF | 2 nF | 5 nF | 10 nF | Consequence |
| --- | ---: | ---: | ---: | ---: | --- |
| 100 ohms | 0.24 us | 0.96 us | 2.41 us | 4.81 us | Add the 2.79 us ADC-filter allocation before a classified sample. |
| 450 ohms | 0.96 us | 3.82 us | 9.55 us | 19.10 us | Add the 3.51 us ADC-filter allocation before a classified sample. |
| 500 ohms | 1.04 us | 4.18 us | 10.44 us | 20.87 us | Add the 3.60 us ADC-filter allocation before a classified sample. |

The line and ADC-filter poles are cascaded. Their five-time-constant estimates cannot be combined with `max()` as a
full-settling bound. Until a two-node step-response model is parameterized with guaranteed capacitance and resistance
corners, the model deliberately sums them as a conservative sequential allocation. Use 7.63 us blanking for a 100 ohm,
10 nF sabre-relevant source change and 24.50 us blanking for a 500 ohm, 10 nF diagnostic source change, rounded only
after the sum. A single fixed 3.5 us blank is insufficient for the declared 10 nF bank.

At 100 ohms and 10 nF, the conservative blank plus the Table 66 trigger latency and two ADC1 ranks is 9.98 us. That is
only 0.02 us below the 10 us planning target, excludes comparator propagation and phase-mask skew, and depends on an
unreleased two-rank sabre phase with any ADC3 rank concurrent. It is a scheduling gate, not a sabre timing pass. At
500 ohms and 10 nF, the conservative blank plus six ADC1 ranks is 31.47 us, missing the 25 us full-diagnostic target by
6.47 us. SIG-02 must either establish a pre-settled phase, reduce the necessary ranks, revise the timing target, or
replace this conservative allocation with a verified two-node step-response bound.

## Source/sink phase and comparator timing rules

Each completed acquisition phase must follow this hardware-facing order:

1. Begin with every source and sink disable asserted and discard all comparator state accumulated before the phase.
2. Atomically load the reviewed phase mask. It may enable one declared source owner and reviewed observation paths, but
   it may not enable a source and sink on the same conductor or create an undeclared second stimulus owner.
3. Start the HRTIM phase timestamp at the actual switch-control edge, not at a software interrupt.
4. Ignore ADC classification and comparator edges until the phase-specific blank expires. Tag an edge during blanking as
   an acquisition transient, never as a contact transition.
5. Trigger ADC1 and ADC3 from HRTIM after blanking. Require the complete required rank set from that phase and retain
   raw codes, timing, reference health, and calibration identity.
6. Use a comparator only for a time transition whose threshold has a separate measured threshold and propagation-delay
   report. It must not independently decide the 450/475 ohm boundary or replace the ADC's calibrated interval.
7. Disable every source and sink when the phase completes or a DMA, overrun, reference, watchdog, reset, or phase-mask
   fault occurs. The result is `unavailable`, never a hit.

The TMUX's specified charge injection is a typical curve-based characteristic, not a full-corner maximum. With the
minimum declared 0.5 nF line bank plus 504.5 pF local capacitance, two 1.5 pC same-polarity edges produce 2.986 mV or
4.19 ohms at 450 ohms before settling. The five-time-constant blank allocates 0.03 ohm residual, but the coupon must
measure charge injection and comparator behavior across temperature, VDD, source voltage, and actual phase masks.

Comparator timestamp resolution remains a 1 us target from the allocation. It has no error-budget credit until the
internal-DAC routing, threshold repeatability, input overdrive, HRTIM capture mapping, and comparator propagation delay
are demonstrated. An ADC/HRTIM schedule cannot infer a 0.1 ms sabre contact from an unqualified comparator edge.

## Required closure evidence and gates

| Gate | Required result | State |
| --- | --- | --- |
| M4-01 predecessor audit | **DENY**: 51-case selected-device bounded series transient screen uses TMUX and selected-resistor bounds but omits clamp, ADC, parasitic, rail-injection, and full-corner device behavior; it cannot satisfy the required temperature/tolerance audit | blocks M4-03 release |
| M4-03 conditional coupon-capture gate | A reviewed candidate must have `E_MODEL <= 4.50 ohms`, an explicit measurement variable for each remaining accuracy term, and a bounded coupon-safety screen, reserving `U_FIX <= 0.50 ohms`; the current 7.20 ohm screen and negative-clamp priority do not qualify | blocked |
| M4-03 measured threshold closure | M4-08 must establish `E_DUT,measured + U_FIX <= 5.00 ohms` at each declared corner. It validates a captured coupon and does not retroactively waive M4-01/M4-03. | future measurement gate |
| M4-03 BAV199 leakage experiment | 4.37 ohm leakage-only arithmetic screen; external-clamp priority, low-voltage leakage, TPD negative residual, MCU injection, and LQFP64 ADC residual remain unmeasured | unresolved, still denied |
| M4-03 static acquisition impedance | 47.5-cycle sample time supports 1437.5 ohms against 1800 ohms slow-channel limit | analytic pass |
| M4-03 100 ohm, 10 nF sabre phase | Two ADC1 ranks after a 7.63 us conservative blank require 9.98 us before comparator and phase-mask uncertainty | open scheduling gate |
| M4-03 500 ohm, 10 nF full diagnostic timing | Six ADC1 ranks after 24.50 us conservative cascaded allocation require 31.47 us | fail against 25 us target by 6.47 us |
| M4-04 coupon schematic | Do not release until a reviewer captures the external clamp return, VREF+/VDDA/VSSA, regulator/reference health path, pad type, pulldowns, source-resistor candidate/TCR, and sample/blank configuration | blocked by open M4-03 gates |
| M4-05 fixture | Must provide Kelvin 0/500 ohm standards, all four capacitance banks, source/sink phase masks, pulse capture, temperature points, current probes, and uncertainty less than or equal to the 0.50 ohm allocation | open |
| M4-08 report | Must demonstrate each of seven channels meets the 5.00 ohm all-in interval and timing limits at 3V3A and 20 V USB-PD input extremes, -40 C, 25 C, 85 C, and 125 C or the qualified product range | future measurement gate |

Coupon measurements must include normal and fault conditions: source or sink stuck on, both enables commanded, reset and
brownout, ADC saturation or overrun, reference absent or outside tolerance, all seven clamp paths stressed, and a
negative transient that proves no internal ADC injection. The fixture must record switch bounce separately from the
resistance standard. Any measurement interval overlapping a released boundary is `indeterminate`; any missing health
evidence is `unavailable` or `line-fault` under the signal contract.

No M4-04, M4-05, coupon procurement, fabrication, or measured threshold closure is claimed by this document.
