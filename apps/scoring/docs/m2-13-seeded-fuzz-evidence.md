# M2-13 seeded protocol and record fuzz evidence

**Task:** M2-13

The bounded suite in [`src/m2-13-seeded-fuzz.test.ts`](../src/m2-13-seeded-fuzz.test.ts) uses the checked seed
fixture [`m2-13-seed-corpus.json`](../fixtures/m2-13-seed-corpus.json). It is a reviewable deterministic test corpus,
not a general fuzzer framework and not production behavior.

## Fixed limits and replay

- Eight unsigned 32-bit seeds are checked into the fixture.
- Each seed runs 32 iterations, for 256 total iterations.
- Generated transport payloads are at most 4,096 bytes and complete frames are at most 4,114 bytes.
- The journal fuzz cases retain at most two records.
- Every iteration selects each malformed-frame class in a stable round-robin: truncation, declared length, version,
  message type, CRC, receiver direction, and trailing bytes.

Run the exact corpus with:

```text
pnpm --filter scoring exec vitest run src/m2-13-seeded-fuzz.test.ts
```

The test hashes its stable JSON report and asserts the checked report digest. A failure identifies the fixed fixture,
bounded iteration count, and report counters in the test output; rerunning the command reproduces the same report.
The current report digest is `sha256:41e516c3dabd3d32ab2d14e5900cb057fc967eb0d48b10a6d2ec2e149159a2a5`.

The checked report contains 256 protocol iterations, 32 accepted records, 32 duplicate rejections, and 32 invalid
decision-payload rejections. It exercises each of CRC, message type, payload length, trailing bytes, truncation, and
version rejection 32 times, and both direction checks 64 times. The journal matrix contains 1,024 write-boundary
cases: 768 recover the old checkpoint and 256 recover the new checkpoint.

## Properties and evidence

The suite proves the following host-model properties across the fixed corpus:

- malformed length, version, type, CRC, direction, truncation, and trailing-byte inputs fail with the strict M2-05
  decoder error class;
- maximum-size frames round-trip, while an over-limit payload or frame is rejected before decode, use, or storage;
- valid decision records are accepted once, a repeated record ID is rejected, and an invalid decision payload cannot
  create a retained record;
- matching journal record IDs are idempotent, differing content is a conflict, and neither path appends a second record;
- extra or forward-version decision-record shapes are rejected by the M2-07 authority guard;
- every M2-08 write boundary recovers exactly the old committed checkpoint or the new committed checkpoint; and
- malformed records fail before the virtual journal performs a durable write.

This evidence does not claim heap measurement, flash atomicity, physical transport integrity, or firmware qualification.
Those remain target and hardware evidence owned by the later delivery tasks.
