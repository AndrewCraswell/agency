# M4 single-channel analog characterization coupon

## Status and decision

**Status: DENY for coupon capture, production use, seven-channel replication, FIE
closure, and fabrication release.** This is a bounded, one-channel learning
design that makes the needed M4 measurements reviewable. It may support guarded,
low-energy characterization after an M4-04 footprint and return-path review. It
does not authorize procurement, Gerbers, or any direct high-energy fault test.

The current Rev-B candidate fails the existing pre-capture gate: its 125 C,
450-ohm static screen is 7.20 ohms, exceeding the required 4.50-ohm analytical
half-width, and the external negative clamp has no bounded priority over the
STM32 pad. See [the M4-03 error budget](m4-03-analog-error-budget.md). The
executable gate is `src/analog-coupon.ts`; its default result is intentionally
`deny`.

The coupon circuit lives in `src/analog-coupon.circuit.tsx`. It is separate from
the apparatus board and deliberately has one line only.

## Single-channel schematic and BOM

The nominal source-only capture route is:

```text
J_FIXTURE.LINE -> TPD4E05U06DQAR -> 22 ohm -> QUIET
  -> TMUX1112 source path <- 2.49 kohm <- REF5025AQDRQ1 (2.5 V)
  -> 1.00 kohm -> ADC_PAD -> STM32G474 LQFP64 ADC and comparator inputs
                         |-> 470 pF C0G -> SGND
                         |-> BAV199 -> LM4040C20QDBZR 2.048 V shunt -> SGND
                         |-> BAT54T1G -> SGND
```

The `TMUX1112PWR` source and sink enables have independent 100 kohm pulldowns.
The sink branch is physically observable but must be disabled for every
resistance capture. Its return resistor and phase meaning remain unqualified
until SIG-02; this coupon must not silently invent one.

| Ref. | Exact part/value | Coupon role |
| --- | --- | --- |
| `U_ESD` | `TPD4E05U06DQAR` | Connector-side protection candidate with a separate `ESD_RETURN` terminal |
| `R_ESD` | `CRCW060322R0FKEAHP`, 22 ohm, 1% | Quiet-side connector isolation |
| `U_SWITCH` | `TMUX1112PWR` | One source path and one disabled-by-default sink path |
| `U_REF` | `REF5025AQDRQ1` | 2.5 V excitation and MCU `VREF+` candidate |
| `R_SOURCE` | Panasonic ERA-3A family, 2.49 kohm, 0.05%, 10 ppm/C | Source-ratio candidate; exact order code is still a footprint/procurement gate |
| `R_ADC` | `CRCW06031K00FKEAHP`, 1.00 kohm, 1% | ADC input isolation |
| `C_ADC` | 470 pF C0G, 0603 | ADC-node filter; exact MPN/tolerance is still open |
| `D_POS` | `BAV199-7-F` | Positive pad clamp to independently shunted `CLAMP_2V048` |
| `D_NEG` | `BAT54T1G` | Baseline negative pad clamp to `SGND` |
| `U_CLAMP` | `LM4040C20QDBZR` | 2.048 V positive-clamp sink |
| `R_CLAMP_BIAS` | 10.0 kohm, 1%, 0603 | `S3_3` bias to the shunt |
| `R_FAULT_GUARD` | 56.0 kohm, 1%, 1206 | Dedicated guarded-force lane; never bypass or use it as a normal line connection |
| `U_MCU` | `STM32G474RET3TR` | LQFP64 ADC/comparator/pad behavior under test |

The board has a 3.3 V isolated bench-supply header, not USB-C, a battery, or a
weapon connector. Build it as a four-layer coupon with the TPD-to-`ESD_RETURN`
loop at the fixture edge and the reference/ADC/clamps over a quiet `SGND` island.
`ESD_RETURN` is not a substitute for `SGND`, and no shield-bonding decision is
made here. Manufacturer land patterns, electrical-rule checks, clearance, and
return-path review are still required before any board order.

## Test points and controls

All voltage probes are differential to the recorded reference, not an arbitrary
scope earth clip.

| Point/control | Required observation or control |
| --- | --- |
| `TP_LINE` | Fixture-side line voltage and injected waveform |
| `TP_FORCE_UPSTREAM` | Actual guarded-force waveform upstream of `R_FAULT_GUARD`; combine with `TP_LINE` and force current to calculate resistor voltage, power, and energy and to detect source overshoot. |
| `TP_POST_TPD` | TPD output residual before `R_ESD`; this is the only node for the 1,022-ohm conditional injection screen |
| `TP_QUIET` | Post-22-ohm source/switch node and line-bank settling |
| `TP_ADC_PAD` | Actual STM32 pad, ADC kickback, clamp behavior, and comparator crossing |
| `TP_CLAMP` | LM4040 clamp voltage and its transient current measurement reference |
| `TP_REF` | Excitation and `VREF+` at conversion time |
| `TP_S3_3`, `TP_SGND` | Rail excursion, back-power, and local reference |
| `SOURCE_EN`, `SINK_EN` | Commanded digital states. The fixture must enforce one-of-two mutual exclusion and inhibit both when its interlock, power, reset, or communications are unhealthy. Resistance capture requires source high and sink low. |
| `J_FIXTURE_STATUS` | Separate observed permit, force-relay, source-gate, sink-gate, current-trip, watchdog, dwell-timer, and fixture-power signals. Commands and observations must agree for a measured record. This header observes an external fixture; it does not implement the interlock on the coupon. |
| `TP_SINK_DNP` | Isolated observation stub at the unqualified TMUX sink output. It has no resistor or connection to `SGND`, `SENSE`, or the fixture and receives no functional credit. |

Calibrate the assembled source-only route at traceable 0 and 500 ohm standards
at 25 C. This is an electrical calibration, not a permission to reuse
coefficients after an unchecked board change. Record the raw ADC codes,
reference voltage at each conversion, MCU ADC-calibration state, HRTIM time,
and all fixture identities.

## Fixture, protection, and input matrix

Use a fixture with Kelvin-characterized 0/10/95/100/105/195/200/205/245/250/255/
445/450/455/470/475/480/495/500/505-ohm standards, switchable 0.5/2/5/10 nF
line banks, break-before-make switching, and separately recorded relay bounce.
The fixture must have a current-limited isolated 3.3 V supply at 3.135 V and
3.465 V, temperature logging, a calibrated resistance standard, differential
voltage probes, and a calibrated pad-current measurement method.

Run the normal resistance matrix at -40 C, 25 C, 85 C, and 125 C for every
listed resistance, line bank, and 3.3 V endpoint. The 450/475-ohm interval is
not a pass/fail threshold; an overlapping measurement is `indeterminate`.

`J_GUARDED_FORCE` is physically separate from `J_FIXTURE`. It reaches the line
only through 56 kohm, 1%. No downstream resistance receives credit because the
TPD or a clamp may shunt the line. The worst-case 55.44 kohm value gives:

```text
I_FORCE,max = 24 V / 55.44 kohm = 0.4329 mA
P_GUARD,max = 24 V x 0.4329 mA = 10.39 mW
E_SOURCE,max,100ms = 24 V x 0.4329 mA x 0.100 s = 1.039 mJ
```

The fixture must hard-limit a force pulse to 100 ms and enforce at least 10 s
before another pulse. Its force relay must be normally open and mutually
exclusive with normal-resistance excitation and both TMUX enables; loss of
fixture power, watchdog, communications, temperature validity, or current-trip
health must open the force relay and drive both enables low. The archive must
record the fixture interlock certificate and the commanded and observed state
of every permit, relay, gate, trip, watchdog, timer, and power signal for every
point. The coupon does not contain that interlock. No force characterization is
authorized until the separate fixture design has been reviewed and its observed
status interface is connected.

At most 0.4329 mA and 1.039 mJ can enter the downstream TPD/clamp/pad network
from the guarded source during one pulse. That is a source envelope, not a
TPD, diode, resistor, or MCU rating proof. Record actual voltage and current
waveforms at `TP_FORCE_UPSTREAM` and `TP_LINE`. For the guard resistor, integrate
`integral(abs((V_FORCE_UPSTREAM(t) - V_LINE(t)) x I_FORCE(t)) dt)`. For the TPD,
BAT54, BAV199, LM4040, and MCU pad, separately integrate
`integral(abs(V_DEVICE,differential(t) x I_DEVICE(t)) dt)` using that device's
measured differential-voltage and current traces. Guarded records require explicit
`tpd-voltage/current`, `bat54-voltage/current`, `bav199-voltage/current`,
`lm4040-voltage/current`, and `mcu-pad-voltage/current` trace identities in
addition to upstream force voltage/current and the named node traces. Each archived record must include peak
absolute voltage, peak absolute current, peak power, integrated energy, and an
explicit reviewed-rating-margin flag for every device. The schema rejects
source current above 0.4329 mA, source energy above 1.039 mJ, or guard-resistor
power/energy beyond the minimum-tolerance envelope. Reject the setup before
connecting the MCU if any
measured device energy, instantaneous voltage/current, or temperature rise lacks
a reviewed rating margin. Because the STM32 operating target is zero injection,
even a sub-0.5 mA pad current is a failed measurement condition, not permission
to continue escalation.

Use the guarded lane only for
non-destructive polarity characterization at -24, -7, -3, -1, -0.5, -0.3,
-0.1, 0, +0.1, +0.3, +0.5, +1, +3, +7, and +24 V; record the force-source
current limit and actual waveform. This test is deliberately **not** the
sustained M4-09 fault: its source impedance changes the phenomenon.

Never apply a direct 24 V source, surge generator, ESD gun, EFT source, or a
body-cord/piste cable to the baseline coupon. Those experiments require a
separate, reviewed sacrificial setup and may not be connected to a live scoring
MCU.

## Measurement sequence

1. Inspect assembly and record board, BOM, fixture, instrument-calibration,
   and firmware identities. Verify source and sink controls are low before
   powering the coupon. Prove the normally-open force relay, one-of-two
   source/sink exclusion, 100 ms force timer, 10 s pulse interval, watchdog
   release, and current trip before attaching the coupon.
2. At each temperature and supply endpoint, verify `REF_2V5`, `CLAMP_2V048`,
   `S3_3`, and no unpowered-rail back-feed. Reject the point if the reference
   is missing, unsettled, or outside the logged envelope.
3. Run the two-point 0/500-ohm calibration at 25 C, then retain its coefficients
   and integrity metadata. Do not refit a threshold at 450 or 475 ohm.
4. For each resistance and line bank, set source enabled and sink disabled,
   start timing at the actual switch-control edge, apply the reviewed blank,
   and archive repeated raw codes plus all test-point traces.
5. Measure diode leakage at the actual low-voltage conditions and both rail
   states. For every guarded negative-force point, record `TP_POST_TPD`,
   `TP_QUIET`, `TP_ADC_PAD`, `S3_3`, `VDDA`, and pad current. A pad-current
   result must be mean-consistent with zero plus its expanded uncertainty;
   remaining allocation and cross-channel effects must be reviewed, not guessed.
   Record the applied force voltage, pulse duration, source current, per-device
   voltage/current traces, and integrated energy. A 100 ms or energy-envelope
   violation aborts the run and creates `line-fault` evidence.
6. Exercise reset, brownout, missing reference, source stuck on, sink stuck on,
   both enables commanded, ADC overrun/saturation, and recovery. Each must
   produce `unavailable` or `line-fault`, never a qualified touch.
7. Archive the raw condition records using the Zod schema in
   `src/analog-coupon.ts`, then validate the ordered run with
   `validateCouponRun`. Each event carries a contiguous index, run identity,
   fixture-timer witness, and prior-force end/interval evidence. The validator
   independently rejects force pulses less than 10 seconds apart. Do not reduce
   a condition to a spreadsheet pass flag.

## Pass equations and current blockers

For each standard and corner, compute `e = mean(R_DUT) - R_standard`, and use
the observed half-range as a transparent repeatability allowance until M4-05
supplies the reviewed statistical method:

```text
E_DUT,measured = abs(e) + repeatability allowance
pass only if E_DUT,measured + U_FIX <= 5.00 ohm
```

`U_FIX` is the separately demonstrated expanded uncertainty, including the
standard, switching/contact, instrument, temperature, and repeatability terms.
It must be no more than 0.50 ohm for capture. A symmetric reported DUT interval
uses `W_DUT / 2 + U_FIX <= 5.00 ohm`; never compare a full width directly with
5 ohm.

The current topology is **DENY** for capture because `E_MODEL = 7.20 ohm` at
the existing 125 C/450-ohm screen and external negative-clamp priority remains
unbounded. The low-energy guarded lane is useful to quantify that defect, but
cannot fix it. The minimum credible correction remains the separately
supervised 8 V-or-higher protected-switch architecture represented by
`ADG5412FBRUZ-RL7` with a 12 V scoring rail, as documented in
[the topology decision](m4-03-minimal-topology-decision.md). It is a new
architecture review, not an authorized substitution.

`assessCouponCaptureReadiness` can list missing predecessor evidence, but its
`benignCharacterizationAllowed` and `captureAuthorized` fields are structurally
always `false` while this immutable candidate state is `deny`. Caller-provided
booleans cannot promote it.

## Archive schema

Each JSON record validates `analogCouponRecordSchema` in
`src/analog-coupon.ts`. A measured point requires the applied force voltage and
pulse duration, corner coordinates, three or more equal-length raw ADC and
resistance arrays, board/firmware/calibration identifiers, `U_FIX <= 0.50 ohm`,
verified fixture interlock, a control state consistent with normal-resistance or
guarded-force mode, measured `S3_3`, `VDDA`,
and all named test-point voltages, formal trace identity/hash/sample metadata,
reference health, and negative-path current/residual evidence. Nominal records
require zero applied force, zero force duration and energy, an open observed
force relay, source observed on, and sink observed off. Guarded records require
a nonzero bounded force and duration, force relay observed closed, both TMUX
paths observed off, nonzero force telemetry, and complete voltage/current trace
coverage. Commands and observed states must agree.

No pad-current allocation has been reviewed, so the design fixes
`I_INJ_ALLOC = 0 A`; records cannot supply a larger value. The executable
zero-current criterion therefore accepts only an exactly zero reported mean and
exactly zero expanded uncertainty, supported by a required uncertainty-evidence
identity. A practical instrument interval will not meet that placeholder, which
is intentional: the one-channel coupon can characterize the path but cannot
close injection or cross-channel behavior before a reviewed nonzero allocation,
uncertainty method, and separate cross-channel evidence exist.
Missing or rejected health evidence must be archived as a distinct
`unavailable` or `line-fault` record with its trace metadata and fault code. It
must not contain or imply a favorable resistance result.

Passing any one point only closes that measured condition. It does not close
M4-01, M4-03, M4-05, M4-08, M4-09, EMC, apparatus safety, a production BOM, or
FIE requirements.
