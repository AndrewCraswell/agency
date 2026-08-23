# M4-03 analog-front-end topology decision

## Decision

**No component-only, no-new-rail topology is selected.** Rev-B remains the only documented topology and M4-01/M4-03
remain **DENY**. The bounded review identified no fault barrier that simultaneously has a guaranteed 0 V normal signal
range on existing rails, an applicable 125 C leakage bound, and sustained negative-fault isolation. The apparently
minimal `ADG7421FBCPZ-RL7` route is rejected because its guaranteed normal range excludes the normative 0 ohm path.

This record does not change production BOM, readiness, schematic, fabrication status, calibration policy, or FIE claims.
It adds no executable model because no new operating topology is qualified even as a coupon candidate.

## Current failure mode

At the 450 ohm foil boundary and 125 C, current Rev-B's static screen is 7.20 ohms against the 5.00 ohm fixture target.
The dominant terms are the 3.15 ohm clamp-leakage allocation and 2.65 ohm STM32 ADC INL term. The latter is based on a
3.1 LSB LQFP100 typical value and therefore cannot release the selected LQFP64 part. STM32 also warns that negative
injection can degrade other ADC conversions; the acceptance target remains zero internal injection rather than merely
remaining below an absolute maximum. [STM32G474 DS12288](https://www.st.com/resource/en/datasheet/stm32g474re.pdf)

The existing two-`BAV199-7-F` leakage experiment calculates 4.37 ohms, using two 80 nA, 150 C leakage values, but it
does not prove that the external negative clamp conducts before the STM32's -0.30 V input boundary. It cannot be a
release or a stand-alone M4-04 topology. [BAV199 data sheet](https://www.diodes.com/datasheet/download/BAV199.pdf)

## Bounded alternatives

| Candidate | Normal-range, leakage, and fault assessment | Cost / availability evidence | Decision |
| --- | --- | --- | --- |
| Rev-B `BAT54T1G` negative clamp | 3.15 ohm clamp allocation and no proof of external negative-clamp priority. The 450 ohm screen is 7.20 ohms. | Existing candidate; no current stock check. | Reject: misses capture target. |
| Two `BAV199-7-F` clamps per channel | 4.37 ohm leakage-only screen, but the stated 0.90 V maximum at 1 mA cannot prove priority before the MCU's -0.30 V boundary or isolate a sustained connector fault. | Manufacturer data support leakage experiment only. | Reject as stand-alone topology. |
| `ADG7421FBCPZ-RL7` x4 plus BAV199 clamps on `3V3A` | ±60 V protected Sx, 23 ohm maximum on resistance, 15 nA maximum on leakage at 125 C, and 40 pC typical enable charge. However normal signal range starts at `VSS + 0.1 V`; 0 ohm is an in-spec normal state and cannot be deferred to coupon characterization. | Manufacturer lists recommended-for-new-design and $2.77 at 1ku, $11.08 for four before assembly. No stock confirmation. [Product page](https://www.analog.com/en/products/adg7421f.html), [data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/adg7421f.pdf) | **Reject: out-of-spec normal operation.** |
| `TMUX2821` x4 plus BAV199 clamps on `3V3A` | Rail-to-rail 0 V normal range and powered-off protection, but only to +/-5.5 V. It does not establish the M4-09 sustained 24 V connector-fault barrier after the existing ESD array. Its 1 uA maximum on leakage also exceeds this error budget. | Active TI part; no price or stock credited. [Product page](https://www.ti.com/product/TMUX2821) | Reject: fault range and leakage. |
| `TMUX1102` x7 plus BAV199 clamps on `3V3A` | 0 V to `VDD` normal range, 3 pA stated low leakage, and 1.8 ohm typical resistance, but no powered-off or ±24 V input fault isolation. It cannot stop back-power or injection under the required fault. | Active TI part; no price or stock credited. [Product page](https://www.ti.com/product/TMUX1102) | Reject: no fault barrier. |
| `ADG5412FBRUZ-RL7` x2 plus BAV199 clamps, new supervised 12 V rail | 0 V to 10 V normal signal range with a 12 V supply, ±55 V protected source, 37 ohm maximum on resistance and 4.5 nA maximum on leakage at 125 C. A prior screen is 4.41 ohms, but it retains ADC typical-INL and transient gates. | $5.37 at 1ku, $10.74 for two before regulator, supervisor, decoupling, startup interlock, assembly, reliability qualification, or stock confirmation. [Product page](https://www.analog.com/en/products/adg5412f.html), [data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/adg5412f_5413f.pdf) | Defer: smallest credible protected-switch architecture, but not minimal under the no-new-rail product constraint. |
| `AD4696BCPZ` external 16-channel ADC | Guaranteed +/-1 LSB INL over temperature and 5 mA active clamps, but serialized 1 MSPS acquisition, a 1.14 V to 1.98 V logic rail, and no sufficient negative-fault path proof for this topology. | $16.18 at 1ku before rail and integration. [Product page](https://www.analog.com/en/products/ad4696.html) | Reject as over-scoped. |
| `AD7616BSTZ` external 16-channel ADC | Existing 5 V / 3.3 V domains, but +/-4 uA input current in the applicable range overwhelms this resistance-error budget and changes architecture. | $16.92 at 1ku. [Data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/AD7616.pdf) | Reject: leakage and scope. |

Manufacturer price pages are dated research snapshots, not procurement approval or distributor availability proof.

## Smallest credible architecture change, deferred

The smallest reviewed path that accommodates 0 V without relying on out-of-spec behavior is a fault-isolated switch on a
new supervised 8 V or higher rail, represented by `ADG5412FBRUZ-RL7` x2 and a 12 V scoring-domain rail. It must add the
regulator, reverse and surge protection, rail supervisor or monitor, decoupling, reset/startup interlock, fault-flag
aggregation, and independent verification of fault behavior with that rail absent, ramping, and brownout. This is more
than a part substitution, so it is explicitly deferred rather than silently becoming the Rev-C baseline.

At the 450 ohm boundary its *conditional* screen uses 2525.978 ohms existing source maximum plus 37 ohms switch
resistance: `V = 0.373385 V`, `dR/dV = 1416.795 ohm/V`, and `R_ADC,input = 1402.891 ohm`. With BAV199 plus ADG leakage,
quantization, typical ADC INL, fixture uncertainty, source TCR, and settled TMUX charge, it totals 4.406 ohms. That
0.094 ohm margin is a coupon-capture calculation only, not a necessity proof or release case; it omits actual LQFP64
INL, ADC kickback, board leakage, rail dynamics, fault-transient injection, and cable parasitics.

## Coupon gates before any architecture selection

1. For any proposed low-voltage fault switch, prove all normative 0, 450, 475, and 500 ohm signals are within its
   guaranteed operating range at every monitored rail and temperature corner. Characterization cannot waive a range
   violation.
2. Measure actual clamp and switch leakage at positive and negative pin voltages, powered, brownout, and unpowered.
3. Apply positive and negative TPD residuals including M4-09 DC fault. Probe connector, protected input/output, quiet
   ADC node, MCU pad, `SGND`, `VDDA`, and `3V3A`; demonstrate zero internal STM32 injection after fault response.
4. Capture LQFP64 ADC residual, kickback, inter-channel memory, fault influence, startup, recovery, and calibration
   repeatability. Fault and recovery must be `unavailable`, never a scoring state.
5. Demonstrate `E_DUT,measured + U_FIX <= 5.00 ohm` across resistance, capacitance, supply, and temperature corners,
   while preserving 450 to 475 ohms as `indeterminate`.
6. Run destructive ESD, EFT, surge, cable-fault, powered, brownout, and unpowered tests on sacrificial coupons. Results
   apply only to those conditions and do not establish IEC, EMC, FIE, fabrication, or apparatus approval.

Any failure returns to M4-03 review. It must not be hidden by a wider threshold, extra calibration point, ADC
oversampling, or an unreviewed substitute part.
