# M4-03 sensing error budget

**Status:** bounded paper calculation. It does not prove the fixture target,
authorize a coupon, authorize an energized test, release a schematic, or grant
scoring authority.

The executable artifact is
[`../src/m4-03-sensing-error-budget.ts`](../src/m4-03-sensing-error-budget.ts).
It binds the committed M4-01, M4-02, BP-100, and BP-101 source artifacts by
commit and SHA-256. It does not import the circuit package into application
runtime.

The application artifact is a conditional paper budget only. It does not
supersede the detailed circuit-package audit in
[`../../../packages/scoring-circuit/docs/m4-03-analog-error-budget.md`](../../../packages/scoring-circuit/docs/m4-03-analog-error-budget.md),
which keeps physical release denied until the remaining clamp, ADC, timing,
fixture, and coupon evidence exists.

## Boundary and result

The source measurement path is `REF5025AQDRQ1 -> ERA3AEB2491V 2.49 kohm ->
TMUX1112PWR -> LINE`; the ADS8881 uses that same REF5025 reference. The sink
switch is off and observed off during that source measurement. A separately
calibrated sink residual applies when a sink-selected test uses that path.

At the 450-ohm and 475-ohm foil thresholds, at -40 C and 125 C, the complete
linear ledger is less than 5 ohms. Every source/sink switch, resistor,
clamp/connector/cable/fixture leakage, buffer, ADC, reference, SAR network,
temperature transfer, calibration fit, and uncertainty term has either a
published bound or a numeric calibration allocation with required evidence and
an invalidation rule. This is a conditional result, not a demonstrated fixture
capability. The reference's ideal common gain error cancels ratiometrically;
reference-load and timing mismatch retain a measured calibration allocation.

| Term | Treatment |
| --- | --- |
| TMUX1112 source and sink switches | The committed maximum 9.8-ohm source on resistance and the source resistor's 0.1-percent and 25-ppm/C movement make a 18.515-ohm raw path shift at 125 C. The ledger separately allocates source on resistance and sink-off/selected-path residuals, each with observed-state calibration evidence. |
| ERA3AEB2491V and clamp path | Per-corner source calibration allocates the selected resistor, 22-ohm series path, and clamp effect. Separate four-wire and leakage records must prove their numeric allocations. |
| REF5025 and ADS8881 reference | Shared ideal reference error is ratiometric. Separate ratio and load/timing allocations cover only captured conversion-correlated residuals. |
| ADS8881 | Three-LSB INL, half-LSB quantization, 1.5-uV/C offset drift, and 5-nA input leakage are calculated at each threshold corner. A separate numerical allocation covers kickback and aperture behavior. |
| ADA4177-1 | The committed 120-uV full-temperature offset and 1-nA bias terms are included once. Gain, linearity, noise, settling, and recovery have separate evidence-gated numerical allocations; temperature is not double counted against the 120-uV full-temperature offset. |
| Fixture, fit, and uncertainty | Leakage, temperature/humidity transfer, calibration fit, standard traceability, and expanded uncertainty each receive independent numerical allocations, evidence, and invalidation conditions. |

## Required calibration evidence

For every channel, source/sink direction, and -40, 25, 85, and 125 C corner,
measure traceable 0-ohm and 500-ohm standards using the same conversion timing
as threshold operation. Fit a gain and intercept from those standards. Archive
the standard identity, raw ADC samples, reference trace, source/sink observed
state, temperature, fit, residual, and expanded uncertainty.

The calibration is invalid after a source/sink control change, reference or
ADC timing change, power change, temperature-boundary crossing, or wiring
provenance change. M4-08 may accept the fixture target only after those records
show every named allocation limit. Every allocation remains an explicit gate
until its named record exists; the artifact deliberately reports
`fixtureTargetValidated: false`.

## Excluded physical effects

The numerical allocations are not physical credit. If a required record cannot
prove its allocation, the fixture target is blocked rather than silently
dropping the term. M4-04 through M4-08 own the coupon, fixture, and physical
evidence.

USB-C PD remains the normal apparatus input. This calculation introduces no
power-path, VBUS, CC, or USB-PD change.

## Machine-readable acceptance boundary

The calculator accepts only the declared `0` through `500` ohm resistance
domain and `-40` through `125` C temperature domain. The four immutable
screens are `450` and `475` ohms at `-40` and `125` C. Each screen sums all 20
term allocations in declaration order without rounding; validation rejects a
changed term, source, evidence record, invalidation rule, source contract, or
sum.

Calibration is invalidated by any source or sink control/path/channel change,
reference or ADC conversion-timing change, power or rail change, temperature
or humidity-boundary change, wiring/probe/fixture/channel-provenance change,
calibration algorithm/standard/firmware/fit-limit change, integrity or
configuration mismatch, failed drift/reference self-test, or explicit
recalibration. The source contracts require the exact 40-character commit and
64-character SHA-256 identity for each bound artifact.

All physical-authority flags remain false: fixture target validation,
energized testing, fabrication, schematic integration, and scoring authority.
Missing evidence therefore blocks the target rather than granting credit.
