# Firmware golden-vector export contract

M3-02 defines the portable fixture produced by
[`src/golden-vector-exporter.ts`](../src/golden-vector-exporter.ts). It gives
host firmware tests the same timing table, electrical stimuli, and expected
outcomes used by the released M1 host rules. A firmware test can consume the
serialized JSON directly or translate it into a language-native fixture at
build time.

## Canonical artifact

The top-level `format` is `scoring-firmware-golden-vectors` and
`schemaVersion` is `1.0.0`. The artifact carries:

- `source: "m1-08-runtime-boundary-vectors"`;
- `ruleSetRevision: "rules-1"` (the approved host rule release, not a
  weapon-specific corpus identity);
- `timingTableRevision: "timing-1"`;
- `timeUnit: "us"` and `resistanceUnit: "milliOhm"`;
- 54 runtime vectors in the exact M1-08 generator order; and
- a `sha256:` digest over the canonical JSON of the artifact with `digest`
  omitted.

Canonical JSON sorts object keys recursively, preserves array order, emits no
insignificant whitespace, and ends with one newline. Re-exporting the same
source is therefore byte-identical. Object field order is intentionally
normalized; a changed value, array order, or vector order changes the digest
or serialized bytes. `assertCurrentGoldenVectorExport` rejects stale output,
including a stale digest or altered timing identity.

## Vector contents

Each vector has a stable M1-08 `id`, weapon, boundary, selected `boundaryUs`,
test `elapsedUs`, side, and `below`/`at`/`above` position. `stimulus` contains
complete timestamped samples in integer microseconds using one explicit format
per weapon:

- `epee-resistance-v1` contains the epee resistance projection in
  milli-ohms;
- `foil-v1` contains the trusted foil contact projection; and
- `sabre-v1` contains the trusted sabre contact projection.

`expected` is a language-neutral result summary. It contains every qualified
hit's side and start/qualification timestamps, foil classification when
applicable, and generated sabre white diagnostics. Yellow diagnostics are not
part of the M1-08 runtime boundary source and are intentionally not promised
by this artifact. A vector with no hit and no diagnostic has
`disposition: "no-hit"`; a diagnostic-only vector has
`disposition: "diagnostic"`.

The exporter constructs each stimulus and expected result by calling the
committed epee, foil, and sabre rule modules with `loadTimingTable("timing-1")`.
The all-weapon exporter does not route through the epee-only golden-corpus
rule resolver. Timing values are never copied into firmware-specific fixtures.
The M1-08 reference vectors are deliberately omitted because they document
published envelopes rather than runtime endpoints.

The current `expected` object is intentionally a compact summary of hits,
diagnostics, and no-hit outcomes. It is not a field-for-field M0-05 decision
record fixture: it does not invent provenance, capture references, record IDs,
or rejection semantics that M1-08 does not define. M3-04 must retain its
separate decision-record parity gate.

## Scope and fail-closed behavior

The M0-07 files under `docs/golden-scenarios` remain a separate scenario
corpus. They express replay inputs, provenance, non-events, and uncertainty;
they are not silently converted into firmware vectors by this exporter. The
exporter accepts only the released M1-08 runtime source and the approved
`timing-1` table. It rejects unknown sources, unknown timing revisions,
unsupported option fields, unsupported statuses, and `planned` scenario
entries instead of inventing stimuli or expected outcomes.

## Reproducible command and checked artifact

The checked artifact is
[`fixtures/golden-vector-export.json`](../fixtures/golden-vector-export.json).
After source changes, regenerate it with:

```text
pnpm --filter scoring export:golden-vectors
```

The stale-artifact check is:

```text
pnpm --filter scoring check:golden-vectors
```

The command builds the exporter, then runs the small Node CLI under
`apps/scoring/scripts`. `--check` parses the checked JSON and compares its
canonical bytes, raw UTF-8 bytes, and digest with a fresh export. Native host
tests can consume the checked JSON without copying timing constants into
firmware sources. The scoring package's `verify` script runs this check.

This contract does not define a target-language parser, MCU transport frame, or
target timing claim. M3-03 and later firmware tasks may translate this artifact
into C fixtures while retaining its units, order, rule-set/timing identities,
and digest.

## Replacement gate for the shared C17 core

The 54-vector artifact remains valid bounded regression evidence, but it is not
sufficient to remove the TypeScript scoring engines. `CW-08` replaces it as the
deletion-grade oracle with independent expected artifacts covering every active
scenario, complete normalized inputs, uncertainty, unavailable and fault states,
yellow and white diagnostics, reset and lifecycle behavior, decision records,
malformed ABI inputs, long sequences, simultaneous events, and overflow.

The replacement fixture compiler may read reviewed scenario inputs and expected
results, but it must not execute either the TypeScript or C scorer to manufacture
expectations. Native C, STM32, and WebAssembly consume the same immutable bytes.
The current exporter and generated C header are removed or narrowed only after
the atomic `CW-19B` deletion-and-oracle gate closes.
