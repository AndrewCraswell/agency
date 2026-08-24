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

This is a topology selection, not accuracy, timing, fault, footprint,
schematic, or fabrication approval. BP-101 must close the reference network,
BP-102 must close connector protection and fault recovery, and BP-103 must
select and prove the seven-channel conversion architecture.

## Why this path is selected

- The normative 0-ohm state and the 450/475/500-ohm region are within the
  published normal input ranges of the isolated `ADA4177-1BRZ` buffer and
  `ADS8881IDGS` converter.
- The inspectable 450-ohm, 125 C arithmetic is below the 4.5-ohm development
  allocation, but remains unvalidated and requires per-corner two-point
  calibration.
- The inspectable 100-ohm, 10-nF arithmetic is below 10 microseconds, but uses
  typical buffer bandwidth and is not a guaranteed settling result.
- The separately guarded 56-kohm lane keeps a 24 V, 100 ms experiment within
  the buffer's published OVP range. It is not sustained-fault, surge, ESD,
  EFT, brownout, or unpowered approval.

No omitted term receives credit. The executable contract lists the omitted
switch, clamp, ADC, reference, tolerance, parasitic, firmware, and recovery
terms with `credited: false` and keeps both accuracy and timing `validated:
false`.

## Exact selected core

The core remains `NXE1S0505MC`, `TPS60400DBVR`, `TPS7A2033PDBVR`,
`REF5025AQDRQ1`, `TPD4E05U06DQAR`, `CRCW060322R0FKEAHP`,
`TMUX1112PWR`, `ERA3AEB2491V`, `ADA4177-1BRZ`,
`ADS8881IDGS`, `CRCW060320R0FKEAHP`, `C0603C102J5GACTU`, and the separate
`CRCW120656K0FKEAHP` guarded-force resistor. The corrected reference output
capacitor is KEMET `T521B106M025ATE100`, 10 uF, 25 V, 100 milliohm maximum
ESR at 25 C and 100 kHz, not the older `T491A106K010AT` candidate.

The complete per-reference support BOM remains in
[`one-channel-analog-readiness.ts`](../src/one-channel-analog-readiness.ts).
The executable BP-100 decision is
[`bench-prototype-analog-topology.ts`](../src/bench-prototype-analog-topology.ts).

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
