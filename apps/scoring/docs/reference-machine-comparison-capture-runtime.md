# M1-10 runtime capture boundary

`parseReferenceMachineComparisonCapture` is the host-side boundary for the
JSON contract in
[`reference-machine-comparison-capture.schema.json`](reference-machine-comparison-capture.schema.json).
It accepts only the pinned format and schema version, ordinary enumerable data
objects, and bounded arrays. Accessors, symbol keys, inherited objects, unknown
keys, unsafe integers, malformed timestamps, duplicate IDs, and unresolved
references are rejected.

The parser also applies checks that JSON Schema cannot express:

- source authority and use must agree. FIE is normative context only;
  implementation is contract context only; fixture is fixture context only;
  and prior-art such as Favero is comparison, machine-identity, or fixture
  context only;
- a machine source, instrument used by a measurement, artifact, scenario input,
  and comparison observation must resolve to an entry in this capture;
- current calibration requires dated certificate provenance, while unknown and
  not-applicable calibration cannot carry a calibration claim;
- resistance, elapsed microseconds, and counts cannot be negative; voltage,
  temperature, and basis-point observations may be signed; and uncertainty is
  either a non-negative value or an explicit unknown/null pair;
- comparisons pair observed inputs or outputs and carry a descriptive
  relationship plus supporting artifact digests. They cannot contain expected,
  threshold, pass/fail, promotion, or scorer-generated fields.

The returned value is a new, recursively frozen data tree. It is evidence-only:
the module exports no scorer adapter and does not copy golden-scenario
expectations. A decision-record reference remains a reference to a separately
authoritative immutable record. Corrections must be represented as a new
capture, preserving the original record and its raw artifact digests.

Focused tests are in
[`reference-machine-comparison-capture.test.ts`](../src/reference-machine-comparison-capture.test.ts).

