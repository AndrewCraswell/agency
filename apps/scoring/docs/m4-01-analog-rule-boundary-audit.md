# M4-01 analog rule-boundary audit

**Status:** evidence plan only. This document does not select thresholds,
approve a circuit, authorize an energized test, approve fabrication, or grant
scoring authority.

The executable model-screen inventory is
[`../src/m4-01-analog-rule-boundary-audit.ts`](../src/m4-01-analog-rule-boundary-audit.ts).
It is constrained by the committed [M0-03 seven-conductor logical
contract](seven-conductor-signal-contract.md) and the committed prototype
contracts [BP-100](../../../packages/scoring-circuit/docs/bench-prototype-analog-topology.md),
[BP-101](../../../packages/scoring-circuit/docs/bench-prototype-reference-drive.md),
[BP-102](../../../packages/scoring-circuit/docs/bench-prototype-fault-protection.md),
and [BP-106](../../../packages/scoring-circuit/docs/bench-prototype-analog-test-matrix.md).

## Audit boundary

M0-03 is deliberately a logical acquisition contract. Its
`safe-inactive`, `select-source`, `settle`, `observe`, and `release` ordering
does not assign a source level, ADC threshold, settling duration, sample rate,
or calibration. Consequently, a circuit simulation can screen only declared
assumptions. It cannot create an available logical relation, a hit candidate,
or a scoring result.

The audit creates exact, immutable case records and finite outputs for the
complete BP-106 normal 20 resistance by four capacitance by four temperature
matrix, all 14 guarded voltages across the same capacitance and temperature
corners, the equivalent unpowered no-credit matrix, the 100-us, 1-ms, 2-ms,
3-ms, and 13/14/15-ms rule-pulse neighbourhoods, and the BP-101 passive
reference screen. Every record includes a stable case ID, inputs, result,
disposition, source-contract SHA-256 identities, and an owned follow-up.

The normal records reproduce the committed source-divider, range, five-time
constant, and pre-capture error arithmetic. They include the explicit
zero-credit tolerance inventory for every resistance/capacitance/temperature
case. The guarded records reproduce the committed source-current, power,
energy, and OVP-envelope arithmetic. The test-only cross-package check
compares these results against the BP-100, BP-101, and BP-102 executable
calculations; production application code has no circuit-package dependency.

For each item, the executable form distinguishes what simulation can screen
from what only calibrated physical evidence can establish. In particular,
simulation cannot establish cable or fixture parasitics, calibration transfer,
actual component recovery, no-back-power behaviour, waveform provenance, or a
scoring classification. Cases with bounded arithmetic are
`screen-pass-no-credit` or `screen-fail-no-credit`. Every unpowered case is
`no-credit` because the committed evidence supplies no valid physical model;
its exact BP-102-owned physical follow-up is embedded in the record.
The 99-us case is an explicit failing below-minimum timing screen; its result
still grants no scoring authority.

## Required physical evidence

BP-106 requires a complete one-channel normal matrix at every resistance,
capacitance, and temperature point, with traceable resistance/capacitance/
temperature standards, DMM, oscilloscope, raw immutable evidence, and expanded
uncertainty. Its guarded matrix is separately interlocked and uses physically
incompatible connectors; it does not authorize applying power.

BP-101 additionally requires reference and converter-node captures at cold,
ambient, and hot conditions. BP-102 requires pre-pulse interlock, current-trip,
watchdog, rail/reference, ADC-code, waveform, stop-condition, and recovery
witnesses. Powered and unpowered behaviour stays unavailable until such
apparatus-specific evidence exists under the separately reviewed safety
procedure.

The loader rejects missing, duplicate, stale, non-finite, altered, and
source-drifted cases. Until physical evidence exists, M0-03 requires
unavailable, contradictory, out-of-range, cross-line, stale, or uncertain
evidence to become a safe-inactive fault. No M4-01 artifact may bypass that
disposition or grant circuit, fabrication, energized-test, or scoring
authority.
