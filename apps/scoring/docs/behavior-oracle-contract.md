# Behavior oracle contract

The current `rules-1` behavior oracle pins the TypeScript implementation and
its existing corpus. The target state makes native C, WebAssembly, and STM32
builds compare against explicit, independently reviewed expected artifacts. It
does not grant hardware, timing, fabrication, or FIE approval. TypeScript is
the active simulator backend until `CW-16`, then comparison-only until the
atomic `CW-19B` deletion; it may not generate the independent final corpus.

## Pinned inputs

[`behavior-oracle-manifest.json`](behavior-oracle-manifest.json) records a
SHA-256 digest for:

- the reviewed `rules-1` weapon, bout, timing, and property sources and tests;
- the golden corpus manifest, both golden schemas, and every scenario declared
  by the manifest;
- the decision-record contract, implementation, and tests;
- the transport codec, its tests, and its golden-frame fixture;
- the scenario runner, display projection, and golden-vector/run entry points;
- every checked-in simulator runtime source, UI component, test, Vite/TypeScript
  configuration, and the explicit `pnpm --filter scoring test:simulator` command;
- the scoring package and TypeScript/Vitest configuration, root package and
  inherited shared TypeScript configuration, pnpm catalog, lockfile, Turbo
  configuration, Node version pin, and oracle-generator script;
- the exact commands used to exercise those boundaries.

Artifact hashes normalize CRLF to LF before hashing so a Windows checkout and
an LF-only checkout produce the same identity. Repository-relative paths and
command order are stable, no time or machine identity is included, and the root
digest covers all artifact entries and commands.

## Review workflow

Check the committed oracle without changing it:

```text
node apps/scoring/scripts/behavior-oracle.mjs --check
```

Print a proposed replacement for review:

```text
node apps/scoring/scripts/behavior-oracle.mjs --print
```

After an intentional behavior-baseline review, update it with:

```text
node apps/scoring/scripts/behavior-oracle.mjs --write
```

A stale digest is a review signal, not a formatting error to update
automatically. An implementation claiming parity must execute the pinned
commands and compare its ordered decisions and declared display projections;
matching only the root digest is not execution evidence.

## Display projection foundation

`src/scenario-display-projection.ts` is a pure, deterministic projection from
the scenario, expectation, and actual scenario report to a timeline and a
display snapshot at an event index. Only actual result decisions can illuminate
a primary lamp or request the buzzer. Expected decisions remain markers, input
snapshots provide contact and fault context, unknown visuals fail closed, and a
rejected report cannot synthesize an output.

The React simulator imports the shared display-projection module. The display
continues to project already-authoritative results and does not score. The
scoring backend remains the TypeScript scenario runner until `CW-16` switches
it to the reviewed C17 WebAssembly adapter; a module failure must render
unavailable rather than selecting a TypeScript fallback.

The simulator's browser interval advances only an already-materialized event
index for visual replay. It supplies no timestamp, scheduling decision, random
value, or result to the scenario runner or future WebAssembly adapter; all
authoritative time remains explicit `atUs` evidence in the report.

The oracle manifest must eventually bind the C core, ABI, generated timing profile,
native/STM32/WebAssembly toolchains and tests, browser adapter, complete corpus,
and simulator behavior. The currently stale manifest is repaired as an
immediate baseline-maintenance task before migration evidence is credited;
`CW-19A` prepares and reviews the final replacement, and `CW-19B` activates it
atomically with TypeScript scorer deletion.
