# M4 one-channel protected analog experiment

## Status

**Status: DENY.** This is a DNP, one-channel learning article after the
PGA855/LTC2373 path was rejected for incompatible converter common mode,
unselected driver/filter behavior, incomplete channel coverage, and an
unclosed isolated-power budget. It does not change the apparatus schematic,
production BOM, readiness register, calibration policy, fabrication state, or
FIE claim.

The experiment is intentionally small: one source-on resistance path, one
protected precision buffer, and one SAR converter. It makes the two questions
that block the existing topology measurable: can a ground-referenced 0-ohm to
500-ohm path retain the 450-ohm decision accuracy, and can it do so without
consuming the 10 microsecond sabre response allocation?

The executable contract is
[`src/one-channel-analog-experiment.ts`](../src/one-channel-analog-experiment.ts),
and its separate reviewable circuit is
[`src/one-channel-analog-experiment.circuit.tsx`](../src/one-channel-analog-experiment.circuit.tsx).
Neither is imported by the apparatus build.

## Selected experiment chain

```text
fixture LINE -> TPD4E05U06 shunt to SGND, then 22 ohm -> TMUX1112 source node
  -> ADA4177-1 unity buffer, powered from isolated +5 V and -5 V
  -> 20 ohm -> ADS8881 AINP
                 |-> 1 nF C0G -> SGND
ADS8881 AINN -> SGND
REF5025A-Q1 -> 2.49 kohm -> TMUX1112 source path -> source node
```

The `ADS8881IDGS` is a 1 MSPS, 18-bit true-differential SAR. Its supported
input pins span 0 V to `VREF`, and its common-mode range spans 0 V to `VREF`.
This coupon ties `AINN` to `SGND`, but deliberately limits its normal matrix to
the 0-ohm to 500-ohm region: `AINP` then spans only 0 V through about 0.42 V
and common mode spans 0 V to about 0.21 V. Both are inside the published range.
The broader SAR range is not credited because the selected protected buffer's
full-temperature input range ends at plus/minus 1.5 V. This is fundamentally
different from trying to force a PGA output at 2.5 V into the LTC2373's narrow
common-mode window.

`ADA4177-1ARZ` is intentionally operated from isolated plus/minus 5 V, not as
an undocumented single-supply buffer. Its pin 3 non-inverting input receives
the source node, pin 6 output closes unity feedback to pin 2 inverting input,
and its normal 0 V to 0.42 V input is inside
the published plus/minus 1.5 V full-temperature common-mode envelope, and the
part's integrated OVP is specified to 32 V beyond either rail. That gives the
guarded experiment a device-range screen for plus/minus 24 V while preserving
0-ohm normal operation. It is **not** a sustained-fault approval.

| Ref. | Exact part/value | Role |
| --- | --- | --- |
| `U_ISO` | `NXE1S0505MC` | 1 W isolated 5 V source for the coupon analog island; surface-mount 14-position package with five solder lands at positions 1, 3, 7, 8, 14, four functional connections, and position 14 NA/no-connect |
| `U_NEGATIVE_RAIL` | `TPS60400DBVR` | Isolated 5 V to -5 V charge pump |
| `U_3V3` | `TPS7A2033PDBVR` | 3.3 V converter digital and analog supply |
| `U_REF` | `REF5025AQDRQ1` | Shared 2.5 V excitation and SAR reference |
| `U_SOURCE_SWITCH` | `TMUX1112PWR` | Existing source-path behavior under test; source-only during capture |
| `R_SOURCE` | `ERA3AEB2491V`, 2.49 kohm, 0.1%, 25 ppm/C | Exact excitation resistor |
| `U_OVP_BUFFER` | `ADA4177-1ARZ` | Unity-gain protected buffer, plus/minus 5 V |

`U_OVP_BUFFER` is the manufacturer-listed `ADA4177-1ARZ` R SOIC-8 orderable.
The Analog Devices [product page](https://www.analog.com/en/products/ADA4177-1.html)
and [Rev. E data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf)
are recorded as exact-orderable identity evidence. They have not been retained
or hash-bound here and do not release any footprint, CAD, artwork, orientation,
or fabrication gate.
| `U_SAR` | `ADS8881IDGS` | 18-bit, 1 MSPS, 10-pin VSSOP grounded-input differential SAR |
| `R_SAR` | `CRCW060320R0FKEAHP`, 20 ohm, 1% | SAR isolation resistor |
| `C_SAR` | `C0603C102J5GACTU`, 1 nF C0G | ADC charge bucket/filter |
| `C_REF_REG` | `T521B106M025ATE100`, 10 uF, 25 V, 100 mOhm maximum ESR | REF5025A-Q1-local output stabilization |
| `R_REF_SAR` | `RCWE0603R220FKEA`, 0.22 ohm, 1% | Series feed to the ADC-local reference loop |
| `C_REF` | `GRM21BR71A106KE51L`, 10 uF X7R, 10 V, 10%, 0805 | ADS8881-local REF/GND reservoir; no lower-value parallel capacitor |
| `R_FAULT_GUARD` | `CRCW120656K0FKEAHP`, 56 kohm, 1% | Separate guarded low-energy force lane |

The support values are specified for this coupon only. They still require
manufacturer-footprint, dielectric-bias, layout, and assembly review before a
board is ordered.

The physical pin map is deliberate and test-covered: ADS8881 `REF/AVDD/AINP/
AINN/GND/CONVST/DOUT/SCLK/DIN/DVDD` are pins `1` through `10`; `AVDD` and
`DVDD` each receive a separate 1-uF capacitor. TI's current TPS6040x data
sheet, revision C (`SLVS324C`), Table 6-1 on page 3, maps `TPS60400DBVR`
`OUT/IN/CFLY-/GND/CFLY+` to pins `1/2/3/4/5`. The coupon follows that primary
source, including one flying capacitor and one output capacitor; it explicitly
rejects the conflicting `OUT/CFLY-/GND/CFLY+/IN` ordering. TMUX1112 channel 1
maps `SEL1/D1/S1` to pins `1/2/3`;
the unused select pins are held low and its VDD has local 100-nF decoupling.
The TPD4 is only a four-channel shunt: D1+ is on the same `LINE` net as the
22-ohm precision-path input and both TPD ground pins return to `SGND`.

## Why this is an executable screen rather than a release

At 100 ohms and 10 nF, the source-network five-time-constant value is about
4.81 microseconds. The executable timing arithmetic then adds the ADS8881's
1.00 microsecond acquisition plus maximum conversion cycle, idealized 18-bit
ADA4177 settling from its **typical** 3.5 MHz unity-gain bandwidth, and the
20-ohm/1.059-nF SAR filter. It falls below 10 microseconds, but `validatesSabreCapture`
is mechanically false because buffer settling is not a relevant guaranteed
step-settling maximum and the calculation omits switch memory, layout/cable
parasitics, firmware scheduling, comparator path, and fault recovery.

At the 450-ohm diagnostic point and 125 C, the code exposes an inspectable
pre-capture sum: 18-bit ADC INL, post-25-C ADC offset drift, protected-buffer
offset/bias, source-resistor temperature movement, and the existing 0.50-ohm
fixture allocation. That bounded sum is below 4.50 ohms only if the source
path is two-point calibrated at each temperature and rail corner. It is not a
production calibration rule, a full uncertainty statement, or authorization
to move the foil threshold.

The arithmetic intentionally omits TMUX on-resistance/leakage, TPD leakage,
ADC input leakage and absolute offset, reference load and dynamic drive,
resistor/capacitor tolerance and voltage coefficients, several temperature
terms, board/cable parasitics, and a guaranteed buffer settling value. Those
omissions are gates, not a reason to round the screen into a pass.

The isolated-power screen uses the actual Murata 1 W class but intentionally
reports known **typical** consumption only. It gives no credit for converter
efficiency over temperature, startup/inrush, negative-rail ripple, reference
transient demand, heat, or a worst-case output-load proof.

## Guarded plus/minus 24 V characterization

`J_GUARDED_FORCE` is physically separate from the normal fixture line. A
normally-open, externally interlocked relay may connect the force source only
through 56 kohm, 1%. The worst 55.44 kohm resistor limits a 24 V, 100 ms pulse
to:

```text
I_MAX = 24 V / 55.44 kohm = 0.4329 mA
P_MAX = 24^2 / 55.44 kohm = 10.39 mW
E_MAX,100ms = 1.039 mJ
```

The fixture must enforce a 100 ms maximum pulse, ten-second minimum interval,
force-relay normally-open state, source-off state, source/sink mutual exclusion,
current trip, watchdog, and observed permit before the coupon is connected.
Measured records require commanded and observed force-relay, source, and sink
states to agree; an armed current trip, satisfied dwell-timer witness, healthy
fixture power, healthy watchdog, and observed permit are mandatory. Guarded
records require both source and sink commanded and observed off.
Every favorable measured record also requires an explicitly healthy reference,
healthy positive and negative analog rails, clear overload observation, and an
expected ADC-code observation. A false or missing value is valid only in an
`unavailable` incident record and can never carry a resistance measurement.
Each record requires independent line, buffer-input, buffer-output, force
voltage, and force-current traces. A source envelope is not a component-rating,
heat, clamp, surge, EFT, ESD, unpowered, brownout, or apparatus-fault proof.
Never connect a direct 24 V source, ESD gun, EFT generator, surge generator,
body cord, or piste cable to this coupon.

For every guarded point, the record must be `authorization: false`, source off,
and force relay observed closed. Any reference loss, rail fault, overload,
unexpected code, watchdog fault, interlock disagreement, or trace omission is
an `unavailable` condition for review and never a favorable resistance result.

## Required test matrix and evidence

1. Record assembly, instrument calibration, fixture-interlock certificate,
   firmware digest, board identifier, and all test-point/trace identities.
2. Validate 0, 10, 95/100/105, 445/450/455, 470/475/480, and 495/500/505 ohms
   across 0.5, 2, 5, and 10 nF at -40 C, 25 C, 85 C, and 125 C. Recalibrate
   the 0-ohm and 500-ohm standards at each corner.
3. Capture each 100-ohm, 10-nF source transition at the switch edge. Demonstrate
   the complete path, not merely the ADC conversion time, settles below the
   sabre budget. Measure buffer overload recovery separately and give it no
   normal-timing credit.
4. With source off, run only the guarded -24, -7, -3, -1, -0.5, -0.3, -0.1,
   0, +0.1, +0.3, +0.5, +1, +3, +7, and +24 V pulse matrix. Stop before any
   envelope or ratings-margin anomaly; do not escalate energy on this coupon.
5. Repeat power-up, power-down, missing reference, +5 V loss, -5 V loss, 3.3 V
   loss, source stuck on, SPI conversion fault, and overload/recovery. Each
   must be archived as unavailable, never a touch or a valid resistance.

The Zod schema rejects records that attempt `authorization: true`, lack an
interlock certificate, use mode-inconsistent source/force controls, use an
out-of-envelope force pulse, omit normal-path traces, have buffer/SAR test
points that disagree with the physical topology, or omit guarded trace
coverage. It also has an explicit `unavailable` archive outcome that cannot
contain a favorable resistance measurement. `validateOneChannelExperimentRun`
requires contiguous event order, strictly increasing timestamps, a single run
identity, and at least ten seconds from the end of one recorded guarded pulse
to the start of the next. Unavailable incident records may truthfully preserve
false permit, mutual-exclusion, or watchdog observations; measured records
require all three safety observations to be true.

The experiment's fabrication gate is structural and false: it is DNP, absent
from the apparatus BOM, emits no released copper, and has no fabrication
authority even after a measurement record passes schema validation.

## Primary evidence

- [ADS8881 data sheet](https://www.ti.com/lit/ds/symlink/ads8881.pdf): 18-bit
  1 MSPS SAR, 290 ns acquisition, 710 ns maximum conversion, 0 V to `VREF`
  input/common-mode range, 3 LSB maximum INL for the industrial grade, and
  required 10 uF to 22 uF reference decoupling.
- [ADA4177-1 data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ada4177-1_4177-2_4177-4.pdf): plus/minus 5 V operation,
  plus/minus 1.5 V full-temperature input range, 32 V beyond-rail OVP,
  offset/bias limits, and typical 3.5 MHz unity-gain bandwidth.
- [REF5025A-Q1 data sheet](https://www.ti.com/lit/gpn/REF5025A-Q1): 2.5 V,
  2.7 V to 18 V input, plus/minus 10 mA output, and -40 C to 125 C range.
- [TMUX1112 data sheet](https://www.ti.com/lit/ds/symlink/tmux1112.pdf): source
  switch leakage, resistance, and charge-injection behavior under test.
- [TPS6040x data sheet, revision C](https://www.ti.com/lit/ds/symlink/tps60400.pdf):
  DBV package pin assignments in Table 6-1 on page 3.
- [Murata NXE1 series data sheet](https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf): `NXE1S0505MC` 5 V, 200 mA, 1 W isolated output; its KDC_NXE1.A01 package drawing maps five solder lands at positions 1, 3, 7, 8, and 14, four functional connections, and position 14 NA/no-connect, with the recommended 5-pad footprint retained as source guidance only.
- [Panasonic `ERA3AEB2491V` product page](https://industrial.panasonic.com/ww/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V): 2.49 kohm, 0.1%,
  25 ppm/C exact source resistor.

Passing this coupon would only supply evidence to a new M4 topology review. It
cannot release fabrication, hardware procurement, seven-channel replication,
fault protection, FIE behavior, or the apparatus.
