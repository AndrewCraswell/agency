# Behavior oracle contract

The `rules-1` behavior oracle makes later native, WebAssembly, and target
implementations compare against an explicit and reproducible host baseline. It
does not grant hardware, timing, fabrication, or FIE approval.

## Pinned inputs

[`behavior-oracle-manifest.json`](behavior-oracle-manifest.json) records a
SHA-256 digest for:

- the reviewed `rules-1` weapon, bout, timing, and property sources and tests;
- the golden corpus manifest, both golden schemas, and every scenario declared
  by the manifest;
- the decision-record contract, implementation, and tests;
- the transport codec, its tests, and its golden-frame fixture;
- the scenario runner, display projection, and golden-vector/run entry points;
- the scoring package and TypeScript/Vitest configuration, root package and
  inherited shared TypeScript configuration, pnpm catalog, lockfile, Turbo
  configuration, and Node version pin;
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

The observatory still contains its original inline projection. Integrating the
module requires serving its compiled browser form and deleting the duplicate
inline projection in one reviewed change. Until that wiring is complete, the
new module is an executable contract and parity target, not a claim that the
current HTML imports it.
