# Replay renderer data contract

M2-11 renders a stored M0-05/M2-04 authoritative `DecisionRecord`. Rendering
is a read-only presentation boundary: it validates the stored payload,
copies it into a deterministic immutable model, and never feeds raw evidence
back through a weapon scorer.

## Input and output

The renderer accepts one exact data object:

```ts
type ReplayRenderInput = {
  record: DecisionRecord
  applicationTime?: ApplicationTimelineEntry | null
}
```

`record` is the complete STM32-owned record. `applicationTime`, when present,
is the M2-09 annotation for that exact record. Its `decisionRecordId`,
`monotonic.decisionAtUs`, and `monotonic.scoringBootId` must match the record;
the annotation cannot replace or revise those values. A missing annotation is
rendered as `null`; no current time or inferred wall-clock coordinate is
created.

The output is:

```ts
type ReplayRenderModel = {
  schemaVersion: 1
  record: DecisionRecord
  applicationTime: ApplicationTimelineEntry | null
}
```

The renderer clones every object and array, freezes the complete model, and
uses a fixed property order. Equivalent input data therefore produces the
same serialized model. The authoritative record remains a separate nested
value so application metadata cannot be mistaken for STM32 provenance.

## Preservation and authority boundary

The renderer preserves, without reinterpretation:

- `decisionAtUs` and every capture-window timestamp and sequence;
- the complete discriminated `outcome`, including rejection, fault, reset,
  calibration, and uncertainty reasons;
- all firmware, scoring-boot, hardware, rule, timing-table, line-contract,
  and calibration provenance; and
- every bounded `rawCaptureRef`.

`applicationTime` may add only application sequence, ordering relations, and
the M2-09 wall-clock estimate or explicit unavailable/uncertainty status. It
cannot add a hit, change a disposition, infer a score, reorder records, or
rewrite an STM32 timestamp. This module must not import a weapon scorer,
timing table, virtual front-end, or scoring state machine.

## Fail-closed validation and bounds

The public input and all nested records must be plain enumerable data objects
with the exact fields for their known schema revision. Symbols, inherited
custom objects, accessors, sparse arrays, unknown fields, unknown enum values,
schema revisions, malformed digests, mismatched application annotations, and
invalid bounds are rejected before a model is returned.

Record identifiers and revisions are bounded identifiers. Other strings are
limited to 256 characters, raw capture references remain limited to the M0-05
maximum of eight, and the serialized render model has a defensive 65,536-byte
UTF-8 ceiling. The per-field and reference-count bounds make that aggregate
ceiling unreachable for this fixed schema; it is retained as a future-proof
guard and is not claimed as exercised by the current tests. These limits are
host-contract bounds, not permission to truncate or drop evidence. A record
exceeding a limit fails closed.

## Acceptance evidence

`src/replay-renderer.test.ts` proves authoritative field preservation,
application-time uncertainty preservation, offline rendering, deterministic
serialization independent of input key order, deep immutability, strict
unknown-field/schema rejection, metadata identity checks, semantic ordering
and uncertainty checks, and bounded field input. The aggregate byte ceiling is
documented as a defensive unreachable guard.
