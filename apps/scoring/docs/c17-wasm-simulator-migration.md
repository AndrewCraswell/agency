# C17 scoring core and WebAssembly simulator migration

**Status:** migration incomplete; shared scoring core with board-specific hardware adapters

The ESP32-S3 owns application/display interfaces, not the scoring core; STM32C011 owns primary power control.
The [hardware index](../../../packages/scoring-circuit/README.md) distinguishes the active virtual box, frozen combined
board and planned standalone HUB75 board. Their different transport and power interfaces belong in adapters, not
separate scoring engines.

## Decision

The product will use one deterministic, heapless C17 scoring core for all
scoring execution:

- the STM32G474 firmware links the core directly;
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

- the STM32G474 target integration has not been verified against the current native board;
- the C input and output model omits fault, uncertainty, grounding, diagnostic,
  reset, and unavailable states implemented by the TypeScript specification;
- the current 54-vector C corpus is a bounded subset generated from the
  TypeScript implementation rather than an independent complete oracle;
- timing and record identities are duplicated as C constants;
- the public C structs expose pointers, `bool`, enums, `size_t`, padding, and
  mutable state, so they are not a stable WebAssembly ABI;
- no pinned C-to-WebAssembly build or browser adapter exists; and
- STM32G474 timing, stack, acquisition, and hardware-output evidence is incomplete.

The TypeScript scorer remains the active simulator implementation until
`CW-16`. From the shadow phase through deletion it is comparison-only, and it
may be removed only after every deletion gate below passes.

## Granular work units

**Status legend:** `backlog` not started; `ready` dependencies complete; `in-progress` active work; `review` committed evidence awaiting explicit independent approval; `blocked` waiting on a named prerequisite; `done` implementation, verification, independent approval, and commit recorded.

`done` applies to the acceptance of that specific work unit, not the final scorer cutover or factory release. Reopen an affected completed unit if a dependency later changes incompatibly.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| `CW-01` | review | Target corrected from the superseded ESP32-only plan to STM32G474. Portable C17 ownership is unchanged; prior implementation evidence does not certify the current board integration. | Freeze this architecture and ownership decision. | Current C17 ADR | One C17 core is named as the only future scoring implementation for native, STM32G474, and WebAssembly; peripheral adapters remain non-authoritative. |
| `CW-02` | blocked | Await the corrected `CW-01` target review. Complete a concise human-reviewed ownership inventory without adding a backlog validator or generated status artifact. | Inventory every scoring-affecting TypeScript branch and consumer. | `CW-01` | The plan names every current scorer, rule/timing source, adapter, simulator consumer, and deletion or migration disposition; root review confirms no production scoring path or fallback is omitted. |
| `CW-03` | blocked | Root-approved per-weapon logical schema and 11 focused tests are committed; closure waits for dependency `CW-02`. | Freeze language-neutral normalized input, state, result, and error schemas. | `CW-02`, normative rule review | Schemas cover all three weapons, simultaneous events, unavailable and indeterminate inputs, faults, diagnostics, reset, overflow, and exhaustion without JavaScript-shaped semantics. |
| `CW-04` | backlog | Next after `CW-03`: Freeze portable ABI version 1. | Freeze portable ABI version 1. | `CW-03` | A byte-oriented wrapper uses fixed-width fields, canonical endianness, explicit lengths and capacities, version negotiation, deterministic status codes, opaque state, and no raw C struct layout, pointers, callbacks, heap, or wall clock. |
| `CW-05` | backlog | Next after `CW-03`: Generate rule and timing profiles from one reviewed artifact. | Generate rule and timing profiles from one reviewed artifact. | `CW-03` | Native, STM32G474, and WebAssembly consume identical generated values and expose the same rule/timing digest; copied timing constants are removed from the C core. |
| `CW-06E` | backlog | Next after `CW-03`, `CW-05`: Complete C épée and resistance behavior. | Complete C épée and resistance behavior. | `CW-03`, `CW-05` | Normal and exceptional resistance, grounded material, uncertainty, unavailable and line-fault states, contact duration, double-hit ordering, and all endpoints match the reviewed corpus. |
| `CW-06F` | backlog | Next after `CW-03`, `CW-05`: Complete C foil behavior. | Complete C foil behavior. | `CW-03`, `CW-05` | Target classification, guard/piste and weapon faults, grounded, indeterminate and unavailable states, insulation diagnostics, contact duration, and lockout match the reviewed corpus. |
| `CW-06S` | backlog | Next after `CW-03`, `CW-05`: Complete C sabre behavior. | Complete C sabre behavior. | `CW-03`, `CW-05` | Target and own-equipment behavior, yellow/white diagnostics, abnormal change, control break, whipover, interruption history, external-path containment, and lockout match the reviewed corpus. |
| `CW-07` | backlog | Next after `CW-06E`, `CW-06F`, `CW-06S`: Complete common record, lifecycle, reset, and failure behavior. | Complete common record, lifecycle, reset, and failure behavior. | `CW-06E`, `CW-06F`, `CW-06S` | Decision records, unavailable results, reset and weapon transitions, bounded state, timestamp overflow, output capacity, and atomic failures are deterministic and field-complete. |
| `CW-08` | backlog | Next after `CW-03`: Build an independent full conformance corpus. | Build an independent full conformance corpus. | `CW-03` | Reviewed expected artifacts cover every active scenario, truth-table row, boundary plus or minus one microsecond, simultaneous event, long sequence, fault, malformed ABI input, reset, maximum timestamp, and overflow. Expected results are not regenerated from C. |
| `CW-09` | backlog | Root reran the executable gate after making it build its own required domain artifacts, so it now works from a clean checkout instead of depending on a pre-existing `dist` directory. All 11 first-party C sources are mapped, `stm32_scoring_core.c` has 100% line/function/branch coverage, and every non-core source exceeds 80% in all three metrics (lowest: 80.91% branches in `scoring_esp32_receiver.c`). The policy/parser tests pass 3 of 3. Remaining work follows `CW-04`, `CW-07`, and `CW-08`: add cross-target conformance, GCC/Clang warnings, sanitizers, static analysis, malformed-input fuzz, deterministic replay, property, and full-corpus comparison gates. | Add native C conformance, coverage, sanitizer, property, and fuzz gates. | `CW-04`, `CW-07`, `CW-08` | The LLVM coverage gate passes 100% line/function/branch coverage for the scoring core and at least 80% for every other first-party C/C++ source, with only generated/vendor/test/build-output exclusions. GCC and Clang builds pass warnings-as-errors, AddressSanitizer, UndefinedBehaviorSanitizer, static analysis, malformed-input fuzzing, deterministic replay, and full-corpus byte comparison. |
| `CW-10` | backlog | Next after `CW-07`, `CW-09`: Link the exact core into the STM32G474 target. | Link the exact core into the STM32G474 target. | `CW-07`, `CW-09` | Link map and symbol evidence prove the same core source is present; acquisition mapping, startup readiness, watchdog, reset, stack, RAM, worst-case execution time, sample loss, and hardware-output tests pass. |
| `CW-11` | backlog | Next after `CW-04`, `CW-09`: Pin a reproducible C-to-WebAssembly toolchain. | Pin a reproducible C-to-WebAssembly toolchain. | `CW-04`, `CW-09` | Compiler/container versions, checksums, flags, imports, exports, memory limits, artifact digest, license record, and rebuild procedure are fixed and reproducible. |
| `CW-12` | backlog | Next after `CW-07`, `CW-11`: Build the WebAssembly scoring module. | Build the WebAssembly scoring module. | `CW-07`, `CW-11` | The module exports only the versioned ABI, imports no scoring callback, clock, filesystem, network, or allocator authority, and embeds observable core, rule, and timing digests. |
| `CW-13` | backlog | Next after `CW-12`: Implement a fail-closed TypeScript WebAssembly adapter. | Implement a fail-closed TypeScript WebAssembly adapter. | `CW-12` | The adapter validates module/version/digests, bounds every copy, handles `i64` without unsafe number conversion, decodes canonical receipts, and returns unavailable on load failure, mismatch, trap, or malformed output. It contains no scoring rule. |
| `CW-14` | backlog | Next after `CW-09`, `CW-10`, `CW-13`: Run native, WebAssembly, and STM32G474 equivalence. | Run native, WebAssembly, and STM32G474 equivalence. | `CW-09`, `CW-10`, `CW-13` | All targets produce byte-identical canonical scoring receipts and errors for the complete corpus and seeded adversarial traces under debug and optimized builds; target-specific artifact and build identities are checked separately against their expected manifests; zero unexplained mismatch remains. |
| `CW-15` | backlog | Next after `CW-13`, `CW-14`, current simulator: Add simulator shadow comparison. | Add simulator shadow comparison. | `CW-13`, `CW-14`, current simulator | The simulator executes WebAssembly and the retained TypeScript scorer separately, records both identities, and fails visibly on any difference without treating either mismatch as a pass. |
| `CW-16` | backlog | Next after `CW-14`, `CW-15`, browser acceptance: Cut simulator scoring over to WebAssembly. | Cut simulator scoring over to WebAssembly. | `CW-14`, `CW-15`, browser acceptance | Every scenario, run-selected action, replay, reset, and unavailable path uses WebAssembly only; desktop, mobile, keyboard, deterministic replay, load failure, trap, and digest mismatch acceptance passes. |
| `CW-17` | backlog | Next after `CW-16`: Consolidate scenario and report contracts. | Consolidate scenario and report contracts. | `CW-16` | Browser, server, native runner, and fixtures use one generated or shared versioned schema; duplicate loose report definitions and scorer injection are removed. |
| `CW-18` | backlog | Next after `CW-10`, `CW-17`, `CW-22`: Complete the reviewed observation period. | Complete the reviewed observation period. | `CW-10`, `CW-17`, `CW-22` | Run 14 consecutive days with at least 10,000 complete native corpus replays, 10,000 complete browser WebAssembly corpus replays, 100 complete STM32G474 corpus replays on each of three prototype boards, and 24 aggregate hardware-in-loop hours. A signed evidence bundle records the corpus/core/ABI/rule/timing/toolchain digests, shared scenario/report schema digest, simulator/server/native adapter source or artifact digests, board identities, run counts, durations, results, and reviewer. Any change to those inputs or any unresolved mismatch restarts the period from zero. |
| `CW-19A` | backlog | Next after `CW-18`: Prepare the final parity tests and deletion change. | Prepare the final parity tests and deletion change. | `CW-18` | Proposed parity fixtures, scripts, package exports, commands, C/ABI/profile/toolchain inputs, corpus, simulator adapter, target evidence, and deletion list are reviewed together without deleting the TypeScript scorer or breaking verification. |
| `CW-19B` | backlog | Next after `CW-19A`, independent review: Atomically delete the TypeScript scorer and activate C/WebAssembly verification. | Atomically delete the TypeScript scorer and activate C/WebAssembly verification. | `CW-19A`, independent review | One reviewed change removes every runtime/test import of the TypeScript épée, resistance, foil, and sabre scorers; removes duplicate rule tests; activates C/WebAssembly parity tests and exports; retains independent fixtures, schemas, UI projection, orchestration, and migration evidence; and passes full repository verification with no fallback scorer or stale intermediate state. |
| `CW-20` | backlog | Next after `CW-19B`: Package factory-facing evidence. | Package factory-facing evidence. | `CW-19B` | The evidence package records the independent expected-fixture identity, C sources, ABI, generated profiles, native/STM32G474/WebAssembly toolchains, complete corpus, simulator adapter, build digests, parity commands, and target results without changing the scoring baseline. |
| `CW-21` | backlog | Next after `CW-17`; `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-05`, `M6-07`, `M6-08`, `M7-03`, `M7-10`, `M8-03`, `BT-09`, and `BT-10` as assigned by the exact row map below: Close the 13 known planned requirement-evidence rows. | Close the 13 known planned requirement-evidence rows. | `CW-17`; `M4-01`, `M4-05`, `M4-08`, `M4-09`, `M5-04`, `M6-05`, `M6-07`, `M6-08`, `M7-03`, `M7-10`, `M8-03`, `BT-09`, and `BT-10` as assigned by the exact row map below | Every ledger row has reviewed normative, executable, target, and physical-output evidence as applicable; its exact active-scenario mapping is unchanged or changed only through separate reviewed manifest work; and promotion from `planned` to `covered` fails closed unless every declared evidence field, digest, owner, and review gate passes. |
| `CW-22` | backlog | Next after `CW-21`: Perform an independent missing-scenario and coverage-gap analysis. | Perform an independent missing-scenario and coverage-gap analysis. | `CW-21` | An independent reviewer traces normative rules, product behavior, faults, boundaries, lifecycle and reset, malformed and unavailable states, physical outputs, and cross-target behavior to executable scenarios and evidence. Every uncovered or ambiguous item becomes a separately owned task with acceptance evidence; no finding may be silently absorbed into this audit unit. |

## Required migration sequence

```text
CW-01 -> CW-02 -> CW-03 -> CW-04/CW-05
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
STM32G474, acquisition, physical-output, audio, timing, and hardware-in-loop
evidence where applicable; and immutable artifact, rule, timing, schema, board,
and toolchain identities.

**Dependencies:** `CW-17` must establish the shared versioned scenario and
report contracts and transitively closes the applicable software, corpus, ABI,
native, WebAssembly, and STM32G474 parity gates. Each row must also satisfy its
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
and malformed-input corpora; native, WebAssembly, STM32G474, acquisition, display,
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
  WebAssembly, and STM32G474 builds.

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
the STM32G474 and WebAssembly artifacts, the full semantic inventory and portable
ABI are closed, all three targets agree on independent expected artifacts,
the simulator has no fallback or injected scorer, target resource and
hardware-in-loop evidence passes, build/rule/timing identities are observable,
and an independent reviewer approves the recorded `CW-18` observation period.
