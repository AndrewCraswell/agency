# Tester DUT boundary and switch-matrix limits

**Contract:** BT-03
**Status:** planning contract only; physical/tester release DENY

The executable form is
[`../src/box-tester-dut-limits.ts`](../src/box-tester-dut-limits.ts). It joins
the completed BT-02 interface boundary with the M4-01 and M4-05 analytical
screens and pins the BP-104 fixture-harness evidence by SHA-256. It does not
select a switch topology, grant a physical test, claim a DUT characteristic,
or approve tester hardware.

## Frozen inputs and measured boundaries

| Boundary | Frozen limit or required measurement | Current disposition |
| --- | --- | --- |
| Normal line state | Source no more than 2,500 mV through at least 2,490 ohms, capped at 1,100 microamps | Source ceiling only. DUT voltage, current, polarity, and relation state are unmeasured. |
| Guarded exposure | Source no more than plus or minus 24,000 mV for 100 ms, 433 microamps, and 1,040 microjoules | Source ceiling only. It grants no clamp, rail, output, recovery, or survival credit. |
| Resistance stimulus | All twenty 0 through 505 ohm cases, with k=2 expanded uncertainty no more than 0.25 ohm | Each installed path must be four-wire measured at the DUT connector; a nominal module is not a stimulus result. |
| Capacitance stimulus | 500, 2,000, 5,000, and 10,000 pF banks, with k=2 expanded uncertainty no more than 100 pF | Cable, socket, and switch parasitics are unmeasured. Bank identity is not DUT capacitance evidence. |
| Delay and skew | Fixture pulse-width uncertainty no more than 1 microsecond at k=2 | Command-to-contact delay, bounce, and simultaneous-channel skew are unallocated until measured. Every rule-boundary interval is indeterminate-no-credit. |
| Leakage | Powered and unpowered bidirectional measurements after normal and guarded exposure | No numeric tester or DUT leakage limit is justified yet. A component data-sheet value cannot be transposed into one. |
| Isolation and no-back-power | BP-104's 10 megaohm at 5 V project screen for required isolated relations | A de-energized measurement precondition only, not a tester insulation rating or completed DUT result. |
| Output observation | Electrical, optical, or acoustic observer with calibrated threshold, latency, duration, uncertainty, ambient rejection, and physical-output correlation | No observer is selected. DUT records remain secondary correlation only. |

## Architecture and release gate

BT-03 deliberately leaves the minimum switch topology unselected. A later
coverage proof must show every declared open, closed, cross-line, grounded,
resistive, capacitive, pulse, and fault relation across all seven conductors,
with every unselected path open. A pair-count or prior-art switch count alone
does not prove this coverage.

The tester remains independently powered, timed, calibrated, and identified.
USB-C PD remains the apparatus's normal external input. The tester has no
connection to VBUS, CC, or the apparatus power return.

No energized DUT connection, fault injection, hardware selection, fabrication,
scoring classification, or passing physical result is authorized. A separately
reviewed interlocked procedure must first capture the required line-state,
leakage, isolation, timing, recovery, and observer evidence. The contract
fails closed until those physical gates are independently accepted.
