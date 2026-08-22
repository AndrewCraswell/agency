# Seeded scoring property tests

**Task:** M1-09

`src/scoring-property-harness.ts` supplies the bounded host-side corpus used by
`src/scoring-property-harness.test.ts`. It uses a local 32-bit linear
congruential generator so the test corpus does not depend on wall-clock time,
Vitest's randomisation, or a property-testing dependency.

## Reproducibility

The default seed is `0x1a092026`. A normal run contains 24 cases, eight per
weapon, and each case contains two through six monotonic samples. The corpus
serializes as stable JSON property order; equal seeds therefore produce
byte-identical UTF-8 output. Property failures include the hexadecimal seed
and case identifier, for example:

`Scoring property failed seed=0x1a092026 case=foil-4: ...`

To replay a failure, set the test's `PROPERTY_SEED` to the reported unsigned
32-bit value and run:

```text
pnpm --filter scoring exec vitest run src/scoring-property-harness.test.ts
```

The no-hit safety corpus is a fixed 27-case matrix. Its seed changes only the
bounded timestamp offset; the matrix itself covers epee line integrity,
tip-loop, grounding, resistance uncertainty, foil circuit/integrity/target
projections, and sabre target/path/blade projections that are indeterminate,
unavailable, or otherwise unsafe. The test deliberately does not reinterpret
diagnostic-only sabre B/C states as hit blockers.

## Properties and limits

The suite replays existing authoritative epee, foil, and sabre state machines
and checks:

- equal seeds serialize byte-for-byte identically;
- each generated input replays to a deep- and byte-identical authoritative
  scorer state without mutating the serialized corpus;
- left/right mirrored samples produce mirrored scorer states and decisions,
  with stable side ordering retained for ties;
- every generated backdated timestamp is rejected before it can score;
- unsafe authoritative projections never create a hit; and
- supervisor reset and weapon-change transitions discard generated hits,
  candidates, lockout, and diagnostics by returning a fresh scorer state.

This is bounded host property evidence, not a replacement for M2 virtual
apparatus, transport, firmware, physical acquisition, or release qualification.
It does not alter timing-table values, golden manifests, or normative rule
semantics.
