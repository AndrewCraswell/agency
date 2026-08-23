# Golden scenario contract

M0-07 defines the portable input and expected-result format for scoring vectors.
The machine-readable contract is [`golden-scenario.schema.json`](golden-scenario.schema.json).
The corpus index is [`golden-scenario-manifest.json`](golden-scenario-manifest.json), validated by
[`golden-scenario-manifest.schema.json`](golden-scenario-manifest.schema.json).
The active epee, foil, and sabre examples are in [`golden-scenarios`](golden-scenarios).

## Version and determinism

- `format` is `scoring-golden-scenario` and `schemaVersion` is exactly `1.0.0`.
- A `scenarioId` is stable and identifies the vector. It is not generated from wall-clock time.
- `ruleRevision` identifies the selected rule table. FIE citations identify authority; implementation and prior-art
  citations do not override the FIE matrix.
- `determinism.seed` is an explicit non-negative integer. `seed: 0`, listed input order, virtual clock, and
  `decision-atUs-then-id` result order are the deterministic defaults.
- All scenario and replay times are integer microseconds. Fields ending in `AtUs`, `atUs`, `fromUs`, or `throughUs`
  are never milliseconds. Resistance fields are non-negative integer milli-ohms.

The manifest is ordered lexicographically by `scenarioId`. A runner must fail on duplicate scenario IDs, duplicate
input IDs, duplicate line names in one frame, an input line not in `lineModel.names`, or an active path missing from the
manifest. The JSON Schema deliberately does not try to express cross-record rules such as monotonicity.

## Inputs

Each input is a complete `snapshot` of the scenario's declared logical lines. A line has an explicit electrical
`state` and an explicit integer `resistanceMilliOhms` and `resistanceUncertaintyMilliOhms`; `null` means that
resistance was not measured, not zero. The two resistance fields are both null or both non-negative integers.
`indeterminate` is an electrical result, not a missing field. `atUncertaintyUs` records timing uncertainty, with zero
used for ideal logical vectors.

The line names are logical scenario names, not a pinout claim. M0-03 and later electrical work map them to the seven
physical lines. This keeps the format usable for foil, sabre, control-circuit, piste-ground, and line-fault vectors
without freezing an unreviewed topology. A fault may add `faultCode`; a future line contract can add names by changing
`lineModel.revision`, while this scenario format remains stable.

## Expected results

`expect.decisions` records decision records that must be emitted. A decision uses the M0-05 `disposition` vocabulary:
`qualified-hit`, `off-target`, `rejected-contact`, `line-fault`, `reset`, `uncertainty`, or `calibration`. It uses
`decisionAtUs` and the corresponding M0-05 outcome fields, plus scenario-only `sourceInputIds` identifying the inputs
that justify it. Qualified-hit vectors provide `hitStartedAtUs` and `qualifiedAtUs`, matching the current epee model.

`expect.nonEvents` is deliberately separate from decision records. It asserts `assertion: "no-decision"` for an
inclusive time window and may include a side. Its `assertionReasonCode` explains the assertion, such as
`contact-shorter-than-minimum`; it is not a M0-05 `rejected-contact.reason` and must not be emitted as a record reason.
`expect.uncertainty` records a required uncertain or diagnostic outcome for a measured boundary, including an integer
`rangeMilliOhms` when useful. Its `assertionReasonCode` is scenario metadata, not a M0-05 record reason. The range
minimum must not exceed its maximum. `expect.finalState` provides small state assertions such as epee hit count and
lockout; it is not a second scoring implementation.

`expect.status: rejected` is for malformed or semantically invalid replay vectors. It requires a stable error code.
For example, `epee.non-monotonic-time.json` preserves the current test's backward timestamp input and expects
`non-monotonic-time`. A runner must not silently sort those inputs.

## Replay hooks

`replay` requires a virtual clock and `timeUnit: us`. Its hooks reserve the metadata needed when the same vector is
run by the host simulator or firmware: firmware identity and digest, scoring boot ID, transport sequence start, and
an optional capture ID. Null values mean that the producer is not yet available, not that the metadata is unknown after
execution. `initialState: snapshot` is reserved for later restored-state and fault-recovery scenarios and must name a
`snapshotRef`.

## Current corpus and FIE coverage

The active examples cover the existing epee tests for the two-millisecond boundary, grounded rejection, the selected
45,000 microsecond lockout boundary, and monotonic-time validation. Additional active scenarios exercise bounded host
projections for epee audio/visual correlation, foil break/target/lockout behavior, and sabre contact/lockout/whipover
behavior. A scenario may therefore be active while its composite traceability row remains `planned`: it is partial
executable evidence, not a claim that physical outputs, resistance acquisition, diagnostics, or the complete FIE
requirement have been proven. New scenarios should cite the relevant matrix row and retain this schema version unless
the format itself changes.

## Validation and acceptance

For every corpus revision, validation must:

1. Parse every manifest and scenario file as strict JSON and validate them against their corresponding JSON Schema.
2. Verify manifest paths, IDs, weapon values, source IDs, unique input IDs, declared line membership, and listed-order
   timestamps. Do not reorder invalid vectors.
3. Execute accepted vectors with the selected `ruleRevision` and compare decisions, non-events, uncertainty outcomes,
   and final-state assertions in deterministic result order.
4. Execute rejected vectors and compare the stable error code and offending input ID.
5. Confirm that an identical scenario, seed, rule revision, and runner identity produces byte-identical machine-readable
   results. A changed rule revision or firmware identity is evidence metadata, not permission to alter expected output.

M0-07 acceptance is met by schema-valid examples, manifest coverage, and the checks above. Host corpus execution now
includes all three weapon scorers. Target-firmware correlation, physical acquisition/output evidence, incomplete
composite traceability rows, and binary transport remain separate later-stage gates.
