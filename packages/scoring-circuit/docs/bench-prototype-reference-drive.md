# BP-101 prototype reference-drive contract

## Status

**Status: DENY.** This fixes the one-channel reference-network candidate and
the evidence required to characterize it. It is neither a measured transient
result, a released layout, a footprint approval, nor fabrication authority.

The executable contract is
[`bench-prototype-reference-drive.ts`](../src/bench-prototype-reference-drive.ts).
It continues the selected one-channel chain in
[`bench-prototype-analog-topology.md`](bench-prototype-analog-topology.md).

## Exact network

| Reference | Exact part | Connection and role |
| --- | --- | --- |
| `U_REF` | TI `REF5025AQDRQ1` | 2.5 V reference for source excitation and `ADS8881IDGS` `REF`. |
| `C_REF_IN` | Murata `GRM188R71A105KA12D` | 1 uF X7R input bypass directly from `S5V_ISOLATED` to `SCORING_SGND` at `U_REF` IN/GND. |
| `C_REF_REG` | KEMET `T521B106M025ATE100` | REF5025-local 10 uF polymer output stabilization, 25 V, 100 milliohm maximum ESR at 25 C and 100 kHz. |
| `C_REF_REG_HF` | KEMET `C0603C104K3RACTU` | REF5025-local 100 nF X7R high-frequency bypass in parallel with `C_REF_REG`. |
| `R_REF_SAR` | Vishay Dale `RCWE0603R220FKEA` | Exact 0.22-ohm, 1% series feed between REF5025 OUT and `ADS_REF2V5`; inside the required 0.1-ohm to 0.47-ohm range. |
| `C_REF` | Murata `GRM21BR71A106KE51L` | ADS8881-local 10 uF X7R, 10 V, 10%, 0805 reservoir directly across REF/GND. |
| `U_SAR` | TI `ADS8881IDGS` | Its REF pin is driven by `ADS_REF2V5`; `AINN` remains `SCORING_SGND`, not a substitute reference return. |

The committed REF5025A-Q1 constraints are 1 uF to 50 uF output capacitance
and 1.5 ohm maximum output-capacitor ESR. The selected 10-uF capacitor's
published maximum ESR is 0.1 ohm under its stated 25 C and 100-kHz test
condition. It stabilizes the reference device locally; it is not the
ADS8881-local reservoir. No lower-value capacitor may be placed in parallel
with `C_REF` at the ADC REF pins.

## Placement and returns

The first loop contains `U_REF` OUT/GND, `C_REF_REG`, and `C_REF_REG_HF`.
The second, physically separate loop contains the output of `R_REF_SAR`,
ADS8881 REF/GND, and `C_REF`. Each conductor between the named pads must be
shorter than 0.1 inch, contain zero vias, and have less than 2 nH extracted
loop inductance. `C_REF_IN` belongs at `U_REF` IN/GND with a local quiet
return. Neither loop may share the source-switch, buffer-output, SCLK, CONVST,
DOUT, isolated-converter, or charge-pump switching-current path.

Review evidence must include an annotated placement/copper image, measured
pad-to-pad conductor lengths, via counts, and post-layout extracted inductance
for both loops. Those records do not exist yet, so layout remains DENY.

The eventual PCB review must prove this placement with the actual footprint,
via geometry, return path, and component orientation. This document does not
approve any of those items.

The legacy coupon names `S5V_ISO` and `SGND` map to the canonical prototype
names `S5V_ISOLATED` and `SCORING_SGND`. BP-101 validates that mapping; new
prototype integration must use only the canonical names.

## Illustrative arithmetic and capture

The executable screen applies a **100 nC, 1 us test stimulus** to an 8-uF
minimum capacitor and 0.1-ohm ESR. The function explicitly accepts and
validates the pulse width: 100 nC in 1 us is 100 mA. It therefore reports
12.5 mV capacitive droop plus a 10 mV ESR step, 22.5 mV total, before any
REF5025 response. This is only an illustrative stimulus for planning a
capture. It is not an ADS8881 load claim, an upper bound, a regulator model,
a ripple limit, or a pass/fail result.

Capture `ADS_REF2V5` at ADS8881 REF/GND and REF5025 OUT/GND separately, the isolated
5-V input at REF5025 IN/GND, and the local scoring ground. Trigger on CONVST.
Archive single conversions and bursts, source-off and highest normal
source-on conditions, cold/ambient/hot board conditions, plus controlled
power-transition captures. Each record needs raw waveforms and the probe
model, bandwidth, grounding method, calibration, time base, sample rate,
trigger, board ID, firmware digest, SHA-256, ripple, conversion-correlated
step, recovery time, ringing, and ADC-code statistics.

Until those traces are measured and reviewed, dynamic load, reference quietness,
layout, footprint, and fabrication all remain **DENY**.

## Primary evidence

- [REF5025A-Q1 data sheet](https://www.ti.com/lit/gpn/REF5025A-Q1)
- [ADS8881 data sheet](https://www.ti.com/lit/ds/symlink/ads8881.pdf)
- [T521B106M025ATE100 data sheet](https://search.kemet.com/download/specsheet/T521B106M025ATE100)
- [GRM21BR71A106KE51L data sheet](https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf)
- [RCWE0603R220FKEA family data sheet](https://www.vishay.com/docs/20019/rcwe.pdf)
- [GRM188R71A105KA12D data sheet](https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A105KA12-01.pdf)
- [C0603C104K3RACTU data sheet](https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en)
