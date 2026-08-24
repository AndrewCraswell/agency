# C17 scoring core and WebAssembly simulator migration

**Status:** approved implementation plan

## Decision

The product will use one deterministic, heapless C17 scoring core for all
scoring execution:

- the STM32 firmware links the core directly;
- native host tools compile the same source for conformance, sanitizer, and
  fuzz testing; and
- the browser simulator loads the same core as WebAssembly.

TypeScript remains responsible for UI, scenario orchestration, schema
validation, fixture authoring, remote and bout workflows, and display
projection. It must not retain a second hit-qualification, classification,
lockout, diagnostic, timing-eligibility, or uncertainty implementation after
the migration gate closes. There is no TypeScript scoring fallback when the
WebAssembly module is missing, incompatible, or trapped; scoring becomes
explicitly unavailable.

This plan replaces the proposed scoring-core rewrite. A different firmware
language requires a future decision supported by a product need that the
shared C17 core cannot satisfy.

## Current blockers to immediate cutover

The TypeScript scoring engines cannot be deleted today:

- the STM32 target executable does not yet link the C scoring core;
- the C input and output model omits fault, uncertainty, grounding, diagnostic,
  reset, and unavailable states implemented by the TypeScript specification;
- the current 54-vector C corpus is a bounded subset generated from the
  TypeScript implementation rather than an independent complete oracle;
- timing and record identities are duplicated as C constants;
- the public C structs expose pointers, `bool`, enums, `size_t`, padding, and
  mutable state, so they are not a stable WebAssembly ABI;
- no pinned C-to-WebAssembly build or browser adapter exists; and
- STM32 timing, stack, acquisition, and hardware-output evidence is incomplete.

The TypeScript scorer remains the active simulator implementation until
`CW-16`. From the shadow phase through deletion it is comparison-only, and it
may be removed only after every deletion gate below passes.

## Granular work units

| ID | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- |
| `CW-00` | Repair the current behavior-oracle baseline. | Current repository state | The existing TypeScript-era manifest is regenerated only after review of every changed input, binds all behavior-affecting simulator sources/tests, names the simulator test command, and passes `--check`; this maintenance grants no C/WebAssembly parity credit. |
| `CW-01` | Freeze this architecture and ownership decision. | `CW-00`, current C17 ADR | One C17 core is named as the only future scoring implementation for native, STM32, and WebAssembly; ESP32 remains non-authoritative. |
| `CW-02` | Inventory every scoring-affecting TypeScript branch and consumer. | `CW-01` | Every qualification, resistance, uncertainty, grounding, fault, diagnostic, lockout, reset, timing, and ordering branch maps to the C core or an explicitly non-scoring adapter policy; zero branches are unowned. |
| `CW-03` | Freeze language-neutral normalized input, state, result, and error schemas. | `CW-02`, normative rule review | Schemas cover all three weapons, simultaneous events, unavailable and indeterminate inputs, faults, diagnostics, reset, overflow, and exhaustion without JavaScript-shaped semantics. |
| `CW-04` | Freeze portable ABI version 1. | `CW-03` | A byte-oriented wrapper uses fixed-width fields, canonical endianness, explicit lengths and capacities, version negotiation, deterministic status codes, opaque state, and no raw C struct layout, pointers, callbacks, heap, or wall clock. |
| `CW-05` | Generate rule and timing profiles from one reviewed artifact. | `CW-03` | Native, STM32, and WebAssembly consume identical generated values and expose the same rule/timing digest; copied timing constants are removed from the C core. |
| `CW-06E` | Complete C épée and resistance behavior. | `CW-03`, `CW-05` | Normal and exceptional resistance, grounded material, uncertainty, unavailable and line-fault states, contact duration, double-hit ordering, and all endpoints match the reviewed corpus. |
| `CW-06F` | Complete C foil behavior. | `CW-03`, `CW-05` | Target classification, guard/piste and weapon faults, grounded, indeterminate and unavailable states, insulation diagnostics, contact duration, and lockout match the reviewed corpus. |
| `CW-06S` | Complete C sabre behavior. | `CW-03`, `CW-05` | Target and own-equipment behavior, yellow/white diagnostics, abnormal change, control break, whipover, interruption history, external-path containment, and lockout match the reviewed corpus. |
| `CW-07` | Complete common record, lifecycle, reset, and failure behavior. | `CW-06E`, `CW-06F`, `CW-06S` | Decision records, unavailable results, reset and weapon transitions, bounded state, timestamp overflow, output capacity, and atomic failures are deterministic and field-complete. |
| `CW-08` | Build an independent full conformance corpus. | `CW-03` | Reviewed expected artifacts cover every active scenario, truth-table row, boundary plus or minus one microsecond, simultaneous event, long sequence, fault, malformed ABI input, reset, maximum timestamp, and overflow. Expected results are not regenerated from C. |
| `CW-09` | Add native C conformance, sanitizer, property, and fuzz gates. | `CW-04`, `CW-07`, `CW-08` | GCC and Clang builds pass warnings-as-errors, AddressSanitizer, UndefinedBehaviorSanitizer, static analysis, malformed-input fuzzing, deterministic replay, and full-corpus byte comparison. |
| `CW-10` | Link the exact core into the STM32 target. | `CW-07`, `CW-09` | Link map and symbol evidence prove the same core source is present; acquisition mapping, startup readiness, watchdog, reset, stack, RAM, worst-case execution time, sample loss, and hardware-output tests pass. |
| `CW-11` | Pin a reproducible C-to-WebAssembly toolchain. | `CW-04`, `CW-09` | Compiler/container versions, checksums, flags, imports, exports, memory limits, artifact digest, license record, and rebuild procedure are fixed and reproducible. |
| `CW-12` | Build the WebAssembly scoring module. | `CW-07`, `CW-11` | The module exports only the versioned ABI, imports no scoring callback, clock, filesystem, network, or allocator authority, and embeds observable core, rule, and timing digests. |
| `CW-13` | Implement a fail-closed TypeScript WebAssembly adapter. | `CW-12` | The adapter validates module/version/digests, bounds every copy, handles `i64` without unsafe number conversion, decodes canonical receipts, and returns unavailable on load failure, mismatch, trap, or malformed output. It contains no scoring rule. |
| `CW-14` | Run native, WebAssembly, and STM32 equivalence. | `CW-09`, `CW-10`, `CW-13` | All targets produce byte-identical canonical scoring receipts and errors for the complete corpus and seeded adversarial traces under debug and optimized builds; target-specific artifact and build identities are checked separately against their expected manifests; zero unexplained mismatch remains. |
| `CW-15` | Add simulator shadow comparison. | `CW-13`, `CW-14`, current simulator | The simulator executes WebAssembly and the retained TypeScript scorer separately, records both identities, and fails visibly on any difference without treating either mismatch as a pass. |
| `CW-16` | Cut simulator scoring over to WebAssembly. | `CW-14`, `CW-15`, browser acceptance | Every scenario, run-selected action, replay, reset, and unavailable path uses WebAssembly only; desktop, mobile, keyboard, deterministic replay, load failure, trap, and digest mismatch acceptance passes. |
| `CW-17` | Consolidate scenario and report contracts. | `CW-16` | Browser, server, native runner, and fixtures use one generated or shared versioned schema; duplicate loose report definitions and scorer injection are removed. |
| `CW-18` | Complete the reviewed observation period. | `CW-10`, `CW-17` | Run 14 consecutive days with at least 10,000 complete native corpus replays, 10,000 complete browser WebAssembly corpus replays, 100 complete STM32 corpus replays on each of three prototype boards, and 24 aggregate hardware-in-loop hours. A signed evidence bundle records the corpus/core/ABI/rule/timing/toolchain digests, shared scenario/report schema digest, simulator/server/native adapter source or artifact digests, board identities, run counts, durations, results, and reviewer. Any change to those inputs or any unresolved mismatch restarts the period from zero. |
| `CW-19A` | Prepare the final oracle and deletion change. | `CW-18` | Proposed manifest, scripts, package exports, commands, C/ABI/profile/toolchain inputs, corpus, simulator adapter, target evidence, and deletion list are reviewed together without deleting the TypeScript scorer or breaking verification. |
| `CW-19B` | Atomically delete the TypeScript scorer and activate the rebuilt oracle. | `CW-19A`, independent review | One reviewed change removes every runtime/test import of the TypeScript épée, resistance, foil, and sabre scorers; removes duplicate rule tests; activates the rebuilt oracle and exports; retains independent fixtures, schemas, UI projection, orchestration, and migration evidence; and passes full repository verification with no fallback scorer or stale intermediate state. |
| `CW-20` | Package factory-facing evidence. | `CW-19B` | The evidence package records the final oracle identity, C sources, ABI, generated profiles, native/STM32/WebAssembly toolchains, complete corpus, simulator adapter, build digests, parity commands, and target results without changing the scoring baseline. |

## Required migration sequence

```text
CW-00 -> CW-01 -> CW-02 -> CW-03 -> CW-04/CW-05
CW-05 -> CW-06E/CW-06F/CW-06S -> CW-07
CW-03 -> CW-08
CW-04/CW-07/CW-08 -> CW-09 -> CW-10
CW-04/CW-09 -> CW-11 -> CW-12 -> CW-13
CW-09/CW-10/CW-13 -> CW-14 -> CW-15 -> CW-16 -> CW-17
CW-10/CW-17 -> CW-18 -> CW-19A -> CW-19B -> CW-20
```

## Simulator and planned-evidence terminology

All 28 committed golden scenarios are active executable tests. The additional
13 rows currently shown as skipped are planned **requirement-evidence** rows,
not disabled tests. They map to active partial scenarios but remain open for
rules interpretation, analog acquisition, physical output, audio, timing, or
hardware-in-loop evidence.

The simulator must report these separately as `plannedRequirements`, retain
their mapped active scenario identifiers, and explain the outstanding evidence
gate. It must not call them skipped or disabled tests, include them in test
pass rates, or claim that they have no executable scenario when a mapped
scenario exists.

## Final deletion gate

TypeScript scoring may be removed only when the exact C source is linked into
the STM32 and WebAssembly artifacts, the full semantic inventory and portable
ABI are closed, all three targets agree on independent expected artifacts,
the simulator has no fallback or injected scorer, target resource and
hardware-in-loop evidence passes, build/rule/timing identities are observable,
and an independent reviewer approves the recorded `CW-18` observation period.
