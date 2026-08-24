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
| `CW-18` | Complete the reviewed observation period. | `CW-10`, `CW-17`, `CW-22` | Run 14 consecutive days with at least 10,000 complete native corpus replays, 10,000 complete browser WebAssembly corpus replays, 100 complete STM32 corpus replays on each of three prototype boards, and 24 aggregate hardware-in-loop hours. A signed evidence bundle records the corpus/core/ABI/rule/timing/toolchain digests, shared scenario/report schema digest, simulator/server/native adapter source or artifact digests, board identities, run counts, durations, results, and reviewer. Any change to those inputs or any unresolved mismatch restarts the period from zero. |
| `CW-19A` | Prepare the final oracle and deletion change. | `CW-18` | Proposed manifest, scripts, package exports, commands, C/ABI/profile/toolchain inputs, corpus, simulator adapter, target evidence, and deletion list are reviewed together without deleting the TypeScript scorer or breaking verification. |
| `CW-19B` | Atomically delete the TypeScript scorer and activate the rebuilt oracle. | `CW-19A`, independent review | One reviewed change removes every runtime/test import of the TypeScript épée, resistance, foil, and sabre scorers; removes duplicate rule tests; activates the rebuilt oracle and exports; retains independent fixtures, schemas, UI projection, orchestration, and migration evidence; and passes full repository verification with no fallback scorer or stale intermediate state. |
| `CW-20` | Package factory-facing evidence. | `CW-19B` | The evidence package records the final oracle identity, C sources, ABI, generated profiles, native/STM32/WebAssembly toolchains, complete corpus, simulator adapter, build digests, parity commands, and target results without changing the scoring baseline. |
| `CW-21` | Close the 13 known planned requirement-evidence rows. | `CW-17`; `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-05`, `M6-07`, `M6-08`, `M7-03`, `M7-10`, `M8-03`, `BT-09`, and `BT-10` as assigned by the exact row map below | Every ledger row has reviewed normative, executable, target, and physical-output evidence as applicable; its exact active-scenario mapping is unchanged or changed only through separate reviewed manifest work; and promotion from `planned` to `covered` fails closed unless every declared evidence field, digest, owner, and review gate passes. |
| `CW-22` | Perform an independent missing-scenario and coverage-gap analysis. | `CW-21` | An independent reviewer traces normative rules, product behavior, faults, boundaries, lifecycle and reset, malformed and unavailable states, physical outputs, and cross-target behavior to executable scenarios and evidence. Every uncovered or ambiguous item becomes a separately owned task with acceptance evidence; no finding may be silently absorbed into this audit unit. |

## Required migration sequence

```text
CW-00 -> CW-01 -> CW-02 -> CW-03 -> CW-04/CW-05
CW-05 -> CW-06E/CW-06F/CW-06S -> CW-07
CW-03 -> CW-08
CW-04/CW-07/CW-08 -> CW-09 -> CW-10
CW-04/CW-09 -> CW-11 -> CW-12 -> CW-13
CW-09/CW-10/CW-13 -> CW-14 -> CW-15 -> CW-16 -> CW-17
CW-17 -> CW-21 -> CW-22 -> CW-18
CW-10/CW-22 -> CW-18 -> CW-19A -> CW-19B -> CW-20
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

## `CW-21`: exact planned-evidence closure ledger

**Inputs:** the reviewed normative rules and traceability matrix; the committed
golden-scenario manifest and active scenario artifacts; native, WebAssembly,
STM32, acquisition, physical-output, audio, timing, and hardware-in-loop
evidence where applicable; and immutable artifact, rule, timing, schema, board,
and toolchain identities.

**Dependencies:** `CW-17` must establish the shared versioned scenario and
report contracts and transitively closes the applicable software, corpus, ABI,
native, WebAssembly, and STM32 parity gates. Each row must also satisfy its
exact additional physical and downstream evidence-task set below. The union is
`M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-05`,
`M6-07`, `M6-08`, `M7-03`, `M7-10`, `M8-03`, `BT-09`, and `BT-10`. Evidence
collection may start earlier, but it grants no coverage credit.

The ledger is exact. `CW-21` must close these 13 rows and retain these declared
active-scenario mappings:

| Traceability ID | Exact active scenario IDs | Exact prerequisite task IDs |
| --- | --- | --- |
| `EPEE-05` | `epee.audio-visual-correlation` | `M5-04`, `M6-08`, `M7-10`, `M8-03`, `BT-09`, `BT-10` |
| `FOIL-01` | `foil.break-boundaries`, `foil.target-context` | `M4-01`, `M4-05`, `M4-08`, `M5-04`, `M6-05`, `M6-08`, `M7-03`, `M7-10`, `M8-03`, `BT-09`, `BT-10` |
| `FOIL-02` | `foil.break-boundaries`, `foil.host-resistance-classifications`, `foil.nominal-break` | `M4-01`, `M4-05`, `M4-08`, `M6-05`, `M7-03`, `BT-10` |
| `FOIL-03` | `foil.grounded-contact`, `foil.host-logical-contexts`, `foil.host-resistance-classifications`, `foil.integrity-and-uncertainty` | `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M6-05`, `M6-07`, `M7-03`, `BT-10` |
| `FOIL-04` | `foil.host-logical-contexts`, `foil.insulation-handoff` | `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-05`, `M6-07`, `M6-08`, `M7-03`, `M8-03`, `BT-09`, `BT-10` |
| `FOIL-05` | `foil.lockout-cutoff`, `foil.same-side-and-lockout` | `M5-04`, `M6-05`, `M6-08`, `M7-10`, `M8-03`, `BT-09`, `BT-10` |
| `SABRE-01` | `sabre.contact-floor-boundaries`, `sabre.own-equipment-hit-continuity` | `M4-01`, `M4-05`, `M4-08`, `M5-04`, `M6-05`, `M6-08`, `M7-03`, `M7-10`, `M8-03`, `BT-09`, `BT-10` |
| `SABRE-02` | `sabre.white-abnormal-change-latch`, `sabre.yellow-onset-clear` | `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-07`, `M6-08`, `M8-03`, `BT-09`, `BT-10` |
| `SABRE-03` | `sabre.contact-floor-boundaries`, `sabre.external-100-ohm-host-boundary`, `sabre.external-path-containment`, `sabre.whipover-boundaries-and-recovery` | `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M6-05`, `M6-07`, `M7-03`, `BT-10` |
| `SABRE-04` | `sabre.own-equipment-hit-continuity` | `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-05`, `M6-07`, `M6-08`, `M8-03`, `BT-09`, `BT-10` |
| `SABRE-05` | `sabre.lockout-boundary`, `sabre.lockout-cutoff` | `M4-01`, `M4-05`, `M4-08`, `M6-05`, `M7-03`, `BT-10` |
| `SABRE-06` | `sabre.whipover-boundaries-and-recovery` | `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M6-05`, `M6-07`, `M7-03`, `BT-10` |
| `SABRE-07` | `sabre.control-break-diagnostic-boundaries` | `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-07`, `M6-08`, `M8-03`, `BT-09`, `BT-10` |

**Deliverables:** `docs/planned-requirement-evidence-ledger.json` is the one
machine-checkable ledger artifact and
`docs/planned-requirement-evidence-ledger.schema.json` is its strict JSON
Schema. Its parser and status-derivation logic live in
`src/planned-requirement-evidence-ledger.ts`, with adversarial and exact-set
tests in `src/planned-requirement-evidence-ledger.test.ts`. The scenario server
must consume only the parser's derived coverage status, never raw
`manifest.coverage.status`; the manifest/server/report reconciliation is proven
in `src/planned-requirement-evidence-ledger.integration.test.ts`, including
planned, covered, malformed-ledger, stale-digest, and missing-ledger cases.
Each ledger record contains the
traceability ID, the exact ordered scenario-ID list, normative source revision
and article, applicable evidence classes, evidence artifact paths and digests,
target and board identities, exact prerequisite task IDs, expected and observed
outcomes, requirement owner, promoter, independent analyst, independent
reviewer, review date, and final status. Expected outcomes must be bound by
digest to independent reviewed artifacts and must never be generated from the
scorer being approved. The golden-scenario manifest and simulator report must
derive promotion from this validated ledger rather than from a caller-supplied
status.

**Acceptance:** the ledger traceability-ID set equals exactly `EPEE-05`,
`FOIL-01` through `FOIL-05`, and `SABRE-01` through `SABRE-07`. The validator
rejects a missing, extra, unknown, or duplicate ID and rejects any deviation
from the exact per-row scenario and prerequisite sets above. All 13 records
exist exactly once; every mapped scenario exists
and remains active; every required evidence artifact is present and digest
verified; target-specific and physical-output obligations are explicitly
passed or explicitly inapplicable with reviewed rationale; and the manifest,
report, tests, and ledger agree. The validator also requires four nonempty,
pairwise-distinct identities for requirement owner, promoter, independent
analyst, and independent reviewer; no caller may assert independence with a
boolean. Missing, duplicate, stale, malformed,
unavailable, mismatched, or unreviewed evidence leaves the row `planned` and
blocks `CW-22`.

**Non-goals:** `CW-21` does not discover unknown requirements, rewrite scoring
rules, infer physical evidence from simulation, broaden a scenario silently,
or treat a passing partial scenario as full requirement evidence. A required
mapping change is its own reviewed manifest and scenario task before ledger
closure.

## `CW-22`: independent coverage-gap analysis

**Inputs:** the closed `CW-21` ledger; normative rules and approved product
contracts; the traceability matrix; scenario, vector, property, fuzz, reset,
and malformed-input corpora; native, WebAssembly, STM32, acquisition, display,
audio, and hardware-in-loop evidence; and all relevant identity manifests.

**Dependency:** all 13 `CW-21` records must be covered. The analyst and final
reviewer must be independent of the person who promoted those records.
`CW-22` remains incomplete while any discovered task is open.

**Deliverables:** a versioned analysis matrix that checks, at minimum:

- every normative scoring rule and approved product behavior;
- nominal behavior, faults, uncertainty, grounded and diagnostic states;
- exact endpoints, boundary-minus-one and boundary-plus-one cases,
  simultaneity, ordering, exhaustion, and overflow;
- startup, weapon change, lifecycle, latch, rearm, reset, and interrupted
  transition behavior;
- malformed, incompatible, unavailable, trapped, stale, duplicate, and
  missing-input states;
- lamps, audio, physical outputs, acquisition classifications, and their
  correlation with canonical records; and
- byte-identical or explicitly target-specific behavior across native,
  WebAssembly, and STM32 builds.

The matrix must cite the normative or product source, mapped scenario and
evidence identities, coverage result, reviewer, and any finding. It must also
record reviewed negative findings so that absence of a gap is auditable.

**Acceptance:** an independent reviewer can reproduce the matrix and account
for every source item and coverage category; all mappings resolve to current
immutable artifacts; ambiguous or missing coverage is reported rather than
interpreted as passing; and every finding has a separate task ID, accountable
owner, dependency placement, deliverable, acceptance evidence, and blocking
gate. Every discovered task must close under independent review. All corpus,
parity, schema, target, physical-evidence, and `CW-21` gates affected by a
finding or its repair must then rerun successfully against refreshed artifact
identities. The analysis matrix must be regenerated from those identities, and
an independent reviewer must confirm zero open findings before `CW-22` can
close. Open findings block `CW-18` and TypeScript-scorer deletion.

**Non-goals:** `CW-22` does not implement discovered scenarios, repair rules,
collect missing physical evidence, or close its own findings. A discovered gap
becomes a separately scoped backlog unit owned by the responsible rules,
firmware, simulator, hardware-evidence, or cross-target team; that unit must be
reviewed and closed before the analysis can record the finding as resolved.

## Final deletion gate

TypeScript scoring may be removed only when the exact C source is linked into
the STM32 and WebAssembly artifacts, the full semantic inventory and portable
ABI are closed, all three targets agree on independent expected artifacts,
the simulator has no fallback or injected scorer, target resource and
hardware-in-loop evidence passes, build/rule/timing identities are observable,
and an independent reviewer approves the recorded `CW-18` observation period.
