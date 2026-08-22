# M4-03 source, reference, switch, and ADC error budget

## Result and scope

This is the M4-03 calculation record for the repeated sensing cell in M4-01 and the M4-02 clamp candidate. It covers
`left.A`, `left.B`, `left.C`, `right.A`, `right.B`, `right.C`, and `piste`; the values apply once per conductor, not as
an unsupported claim that seven leakage paths add to one channel. It is a coupon budget, not a released schematic,
footprint, BOM, fabrication package, compliance result, or FIE approval.

**Verdict: DENY.** The passive topology and 47.5-cycle ADC acquisition are analytically adequate for a static sample
after the defined blanking interval, but the proposed component set does **not** meet the `+/- 5 ohm` M4-01 fixture
target at the 450 ohm foil boundary. At 125 C after a 25 C calibration, the absolute-sum screen is 7.17 ohms, failing by
2.17 ohms. That screen uses only stated clamp gates, a published ADC EL typical-characterization screen, a selected source-resistor
temperature coefficient, fixture allocation, and settled typical switch charge. It excludes unproven switch drift,
board leakage, reference dynamics, and LQFP64 ADC/comparator limits, so it is not a passable guarantee by omission.

The ADC linearity data are for an LQFP100 characterization condition, not this LQFP64 part. The comparator/DAC path has
no applicable numeric threshold guarantee for the proposed operating point and is prohibited from classifying the
450/475 ohm boundary. M4-03 can become a **conditional measurement pass**, not a release, only if M4-08 establishes a
replacement full-corner per-channel bound of 5.00 ohms or less. Until then, the threshold budget is open and the product
must report boundary overlap as `indeterminate` as required by the signal contract.

This result deliberately does not choose a different clamp, comparator threshold circuit, or physical seven-conductor
phase map. Those are M4-02, M4-04, M4-05, and SIG gates, respectively. It does name a coupon-only source-resistor
candidate because its temperature coefficient is a material term in this budget; it does not add it to a production BOM.

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
R_S,max = 2490 x 1.0005 + 9.8 + 23.1 = 2524.145 ohm
V_450   = 2.5 x 450 / (2524.145 + 450) = 0.378260 V
R_TH    = R_S,max || 450 = 381.91 ohm
dR/dV   = R_S,max x 2.5 / (2.5 - V_450)^2 = 1401.7 ohm/V
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
24 V input does not appear directly in the transfer function. Its only possible error credit is through a released
regulator and the reference input: those must maintain `3V3A` at 3.135 V to 3.465 V and keep the reference in its
2.7 V to 18 V operating range. Reference startup, source/VREF+ impedance mismatch, ADC reference-load transients,
reference load regulation, routing drop, and a missing reference do not cancel and must force `unavailable`. The existing
allocation has not released the regulator, reference buffer/decoupling, or `VREF+` routing, so there is no unconditional
reference-accuracy credit and no claimed 24 V input-tolerance result.

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
an LQFP64 worst-case guarantee nor a pass claim. `mV` values use 1401.7 ohm/V. The source-resistor term is calibrated
at 25 C and evaluated at the worst 125 C endpoint. No term marked a measurement gate receives an unearned numeric credit.

| Contributor | Bound and treatment | Error, ohms | Status |
| --- | --- | ---: | --- |
| Source 0.05%, TMUX resistance, 22 ohm resistor | Removed only by complete channel two-point calibration | 0 after calibration | calibration condition |
| Source-resistor TCR | 2.49 kohm, 10 ppm/C, 25 C calibration to 125 C; exact ratio calculation | 0.44 | bounded coupon candidate |
| TMUX/22 ohm temperature and voltage drift | 9.8 ohm is a maximum, not a calibrated drift envelope at the approximately 1 mA source current | unbounded | measurement gate |
| REF5025A-Q1 initial error and drift | Ratiometrically removed only with common valid source and VREF+ | 0 after calibration | reference-health gate |
| 3V3A and 24 V input variation | No direct transfer term only after regulator/reference health proves the stated input range; source/switch behavior must be measured | unbounded | measurement gate |
| M4-02 clamp leakage | M4-02 coupon screen: `|I_D_NEG(0.45 V)| <= 1.50 uA` and `|I_D_POS(2.1 V)| <= 0.10 uA` | 3.12 | measurement gate |
| ADC half-code quantization | 0.5 x 2.5 V / 4095 = 0.305 mV | 0.43 | bounded |
| ADC EL integral-linearity typical screen | Table 72: 3.1 LSB typical x 2.5 V / 4095 = 1.892 mV | 2.65 | LQFP100 characterization only |
| Two-point fixture interpolation and standard uncertainty | Allocation, not an achieved result | 0.50 | M4-05 acceptance allocation |
| TMUX charge after five local time constants | 4.19 ohms initial two-edge pedestal x exp(-5) | 0.03 | only after blanking |
| ADC residual, PCB leakage, and reference dynamics | No LQFP64 full-corner bound or assembled-coupon result | unbounded | measurement gate |
| Comparator/DAC resistance threshold | Prohibited from resistance classification; see the separate non-credit screen below | 0 | architectural restriction |

The displayed static screen is `0.44 + 3.12 + 0.43 + 2.65 + 0.50 + 0.03 = 7.17 ohms`. It fails the 5.00 ohm target by
2.17 ohms before the unbounded switch, board, reference, LQFP64 ADC, supply, and input terms. Even granting external
two-point gain and offset correction, integral non-linearity is not automatically removed. The 3.1 LSB is specifically
ST's **EL, single-ended integral-linearity, typical** result in DS12288 Table 72: multiple-ADC operation, <=52 MHz,
`VDDA >= 2.7 V`, `VREF+ >= 1.62 V`, -40 C to 125 C, 2.5/6.5-cycle sampling, and LQFP100. It is characterized after
internal calibration, not production-tested, and is neither a total-unadjusted-error value nor an LQFP64 guarantee.

The remaining conditional allocation is:

```text
5.00 - 3.12 clamp - 0.43 quantization - 0.50 fixture - 0.03 settled charge - 0.44 source TCR = 0.48 ohm
```

Thus, if M4-08 replaces the unsuitable ADC EL typical screen with a measurement, the **sum** of measured residual ADC non-linearity,
post-calibration switch/protection temperature and supply drift, PCB leakage, reference dynamics, and any
comparator-to-ADC correlation error must be at most 0.48 ohms at each required temperature and line bank. This is a
narrow conditional margin, not a design release. A larger measured term fails M4-03 and requires a new M4-02/M4-03
candidate or a revised, reviewed acquisition method.

For context, the uncalibrated screen also fails: the M4-02 pre-screened 4.06 ohm clamp estimate, the 2.65 ohm ADC EL
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
resistance estimate at each selected threshold, VDD and 24 V input extreme, -40 C, 25 C, 85 C, and 125 C. It must also
bound propagation delay and HRTIM capture skew under the actual overdrive and phase mask. The resulting threshold must
remain a prequalification/timestamp threshold only unless a separate reviewed budget changes this restriction.

## Sampling capacitor, source impedance, and line banks

The STM32's 5 pF typical sample-and-hold capacitor is included with 470 pF C0G, 10 pF maximum BAT54, 2 pF typical
BAV199, 17 pF typical enabled TMUX capacitance, and 0.5 pF typical TPD capacitance. That gives 504.5 pF at the ADC
node for the local five-time-constant screen. It is not a maximum-capacitance guarantee: coupon measurement must bound
the actual pad, trace, diode C-V, and sample kickback contribution.

At 500 ohms, the maximum ADC driving impedance is:

```text
R_ADC,drive = (2524.145 || 500) + 1010 = 1427.3 ohm
```

The selected 47.5-cycle, 52 MHz two-ADC acquisition uses DS12288's more conservative 1.8 kohm slow-channel limit from
the faster 60 MHz Table 67 condition, leaving 372.4 ohms analytic margin. It therefore covers the slow `right.A` and
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
corners, the model deliberately sums them as a conservative sequential allocation. Use 7.60 us blanking for a 100 ohm,
10 nF sabre-relevant source change and 24.47 us blanking for a 500 ohm, 10 nF diagnostic source change, rounded only
after the sum. A single fixed 3.5 us blank is insufficient for the declared 10 nF bank.

At 100 ohms and 10 nF, the conservative blank plus the Table 66 trigger latency and two ADC1 ranks is 9.96 us. That is
only 0.04 us below the 10 us planning target, excludes comparator propagation and phase-mask skew, and depends on an
unreleased two-rank sabre phase with any ADC3 rank concurrent. It is a scheduling gate, not a sabre timing pass. At
500 ohms and 10 nF, the conservative blank plus six ADC1 ranks is 31.44 us, missing the 25 us full-diagnostic target by
6.44 us. SIG-02 must either establish a pre-settled phase, reduce the necessary ranks, revise the timing target, or
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
| M4-03 analytical error target | **DENY**: 7.17 ohm 125 C absolute-sum screen fails the 5.00 ohm target by 2.17 ohms; an M4-08 full-corner per-channel result must close the 0.48 ohm residual allocation | open |
| M4-03 static acquisition impedance | 47.5-cycle sample time supports 1427.3 ohms against 1800 ohms slow-channel limit | analytic pass |
| M4-03 100 ohm, 10 nF sabre phase | Two ADC1 ranks after a 7.60 us conservative blank require 9.96 us before comparator and phase-mask uncertainty | open scheduling gate |
| M4-03 500 ohm, 10 nF full diagnostic timing | Six ADC1 ranks after 24.47 us conservative cascaded allocation require 31.44 us | fail against 25 us target by 6.44 us |
| M4-04 coupon schematic | Do not release until a reviewer captures the external clamp return, VREF+/VDDA/VSSA, regulator/reference health path, pad type, pulldowns, source-resistor candidate/TCR, and sample/blank configuration | blocked by open M4-03 gates |
| M4-05 fixture | Must provide Kelvin 0/500 ohm standards, all four capacitance banks, source/sink phase masks, pulse capture, temperature points, current probes, and uncertainty less than or equal to the 0.50 ohm allocation | open |
| M4-08 report | Must demonstrate each of seven channels meets the 5.00 ohm all-in interval and timing limits at 3V3A and 24 V input extremes, -40 C, 25 C, 85 C, and 125 C or the qualified product range | future measurement gate |

Coupon measurements must include normal and fault conditions: source or sink stuck on, both enables commanded, reset and
brownout, ADC saturation or overrun, reference absent or outside tolerance, all seven clamp paths stressed, and a
negative transient that proves no internal ADC injection. The fixture must record switch bounce separately from the
resistance standard. Any measurement interval overlapping a released boundary is `indeterminate`; any missing health
evidence is `unavailable` or `line-fault` under the signal contract.

No M4-04, M4-05, coupon procurement, fabrication, or measured threshold closure is claimed by this document.
