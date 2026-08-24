# Box tester sequence contract

**Contract:** BT-04  
**Status:** planning baseline only

BT-04 compiles one accepted M0-07 golden scenario into immutable, logical tester
steps. It does not score a bout, derive an expectation, select a timing threshold,
map a logical line to hardware, or apply electrical stimulus. The source is
[`../src/box-tester-sequence.ts`](../src/box-tester-sequence.ts).

## Sequence shape

The compiler preserves the listed `inputs` order as `stimulus` steps. Each step
keeps its authored integer-microsecond timestamp, timestamp uncertainty, input ID,
and listed logical line readings. It preserves authored expectation-array order as
`expectations`: decisions, non-events, uncertainty, then optional diagnostics and
classifications. It never sorts a scenario, fills an expectation, or turns a rule
result into authored data.

All numbers accepted by the compiler are non-negative safe integers. Every output is
a detached, deeply frozen plain-data graph. This lets BT-05 consume one stable plan
without allowing a caller to mutate the source scenario or the compiled evidence.

## Closed boundary

The compiler accepts only the current strict `scoring-golden-scenario` format,
listed-input virtual-clock microseconds, snapshot input frames, declared line names,
known logical states, and an `accepted` authored expectation. It rejects malformed
or accessor-backed data, unknown keys or states, duplicate IDs or line readings,
undeclared source input IDs, non-monotonic input timestamps, unsafe integers,
rejected scenarios, and configured input, line, or expectation capacity overflows.
An expected decision or non-decision window may occur after the final listed
stimulus because the later BT-05 runner holds the final logical line state while
observing it. A non-decision window must still satisfy `fromUs <= throughUs`.

Logical states in this contract are not relay instructions. BT-03 must still define
the safe switch, impedance, leakage, capacitance, and source-envelope realization;
BT-05 must still run and evaluate the plan. Therefore no BT-04 output can claim DUT
execution, physical-output observation, calibration, qualification, or approval.

## Acceptance

BT-04 is met when canonical accepted scenarios compile deterministically into the
same immutable logical plan without copied timing constants, while invalid,
unsupported, unsafe, non-monotonic, or over-capacity inputs fail closed.
