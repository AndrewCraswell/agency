# BP-100 one-channel analog topology

## Decision

BP-100 selects the existing protected-buffer and dedicated-SAR chain for the
first one-channel prototype experiment:

```text
fixture LINE -> TPD4E05U06DQAR shunt -> CRCW060322R0FKEAHP 22 ohm -> TMUX1112
  -> ADA4177-1 unity buffer on isolated +5 V / -5 V
  -> 20 ohm / 1 nF -> ADS8881 AINP
ADS8881 AINN -> SCORING_SGND
REF5025A-Q1 -> 2.49 kohm -> TMUX1112 source path -> source node
```

This accepts the reviewed topology selection only. It is not a performance,
physical-measurement, fault, footprint, schematic, or fabrication approval.
BP-101 must close the reference network, BP-102 must close connector protection
and fault recovery, and BP-103 must select and prove the seven-channel
conversion architecture.

## Why this path is selected

- The normative 0-ohm state and the 450/475/500-ohm region are within the
  published normal input ranges of the isolated `ADA4177-1BRZ` buffer and
  `ADS8881IDGS` converter.
- The 450-ohm, 125 C review inventory has an explicit 4.5-ohm arithmetic
  screen. Its credited values are fixture allocation, source-resistor
  temperature after corner calibration, buffer bias and offset, ADC INL and
  offset drift, and ADC quantization. It remains unvalidated and requires
  per-corner two-point calibration.
- The inspectable 100-ohm, 10-nF arithmetic is below 10 microseconds, but uses
  typical buffer bandwidth and is not a guaranteed settling result.
- The separately guarded 56-kohm lane keeps a 24 V, 100 ms experiment within
  the buffer's published OVP range. It is not sustained-fault, surge, ESD,
  EFT, brownout, or unpowered approval.

## Reviewed budget inventory

The executable contract is the complete review record. Every term is named;
an unbounded term uses `credit: "none"`, and a numerical screen that cannot
prove end-to-end performance uses `credit: "screen-only"`. A guarded-source
value uses `credit: "source-envelope-only"`: it does not provide a component
survival or recovery allowance.

| Budget | Included or screened terms | Explicit zero-credit terms | Physical state |
| --- | --- | --- | --- |
| Error at 450 ohm and 125 C | Fixture allocation, source-resistor temperature, buffer bias and offset, ADC INL, ADC offset drift, and quantization | Reference accuracy and dynamics; source calibration residual; switch resistance, leakage, charge, and memory; clamp behavior; remaining buffer and ADC errors; SAR and reference loop components; board and fixture effects; calibration transfer | `DENY` |
| Settling at 100 ohm and 10 nF | Source five-time-constant, typical buffer-bandwidth, SAR RC, and ADC-cycle arithmetic | Switch behavior; guaranteed buffer settling; SAR kickback and reference recovery; all extracted parasitics; firmware and qualification timing; overload recovery | `DENY` |
| Leakage | Buffer bias bound and a screen-only ADC leakage conversion | Switch, clamp, reference, PCB, connector, cable, fixture, contamination, humidity, and probe leakage | `DENY` |
| Overload and fault | 24 V, 100 ms, 10 s, minimum guard resistance, source current, power, and energy envelope | Normal-port and surge conditions; clamp, buffer, ADC, rail, return, and supply behavior | `DENY` |
| Fault recovery | No physical result is credited | Powered and unpowered polarity and temperature matrix, required traces, post-pulse health, and fixture-control evidence | `DENY` |

Therefore `topologySelectionAccepted` and `reviewedBudgetComplete` are true,
while `performanceClaimAccepted` and `physicalMeasurementsAccepted` are false.
The acceptance is truthful because it accepts the selection review, not an
unmeasured product characteristic.

## Exact selected core

The core remains `NXE1S0505MC`, `TPS60400DBVR`, `TPS7A2033PDBVR`,
`REF5025AQDRQ1`, `TPD4E05U06DQAR`, `CRCW060322R0FKEAHP`,
`TMUX1112PWR`, `ERA3AEB2491V`, `ADA4177-1BRZ`,
`ADS8881IDGS`, `CRCW060320R0FKEAHP`, `C0603C102J5GACTU`, and the separate
`CRCW120656K0FKEAHP` guarded-force resistor. BP-101 separates the reference
loops: KEMET `T521B106M025ATE100` stabilizes the REF5025 output locally, while
Vishay `RCWE0603R220FKEA` feeds an ADS8881-local Murata
`GRM21BR71A106KE51L` 10-uF X7R 0805 reservoir. No smaller parallel capacitor
is permitted at the ADC REF pins.

The complete per-reference support BOM remains in
[`one-channel-analog-readiness.ts`](../src/one-channel-analog-readiness.ts).
The executable BP-100 decision is
[`bench-prototype-analog-topology.ts`](../src/bench-prototype-analog-topology.ts).

The normal protection path is bound by exact reference, MPN, package, and
manufacturer evidence link: `U_ESD` `TPD4E05U06DQAR`, `R_ESD`
`CRCW060322R0FKEAHP`, `U_SOURCE_SWITCH` `TMUX1112PWR`, `U_OVP_BUFFER`
`ADA4177-1BRZ`, `R_SAR` `CRCW060320R0FKEAHP`, and `U_SAR` `ADS8881IDGS`.
The same contract independently freezes every upstream numerical input used by
the screens. A missing, duplicate, or altered BOM row, or an altered numerical
input, fails validation rather than becoming a new BP-100 baseline.

## Open gates

1. BP-101 must prove the REF5025 input/output network, ESR, dynamic load,
   reference return, and ADS8881 acquisition behavior.
2. BP-102 must prove TPD/switch leakage, guarded energy, clamp and buffer
   behavior, overload recovery, brownout, and unpowered fault behavior.
3. BP-103 must decide how seven converters or an alternative reviewed
   conversion stage connect to the STM32, then prove simultaneous acquisition,
   crosstalk, isolated-power loading, and fault containment.
4. BP-031 must independently approve every populated footprint.
5. BP-300 cannot integrate this chain until BP-101 through BP-103 are accepted.

The decision remains `releaseState: deny`, with schematic integration,
footprint closure, and fabrication authorization all false.
