# Scoring device and circuit technical-debt intake

Audit date: 2026-08-24

Scope: the stable TypeScript and C paths under `apps/scoring` and the stable
tscircuit models under `packages/scoring-circuit`. The audit applies DRY,
SOLID, and YAGNI pragmatically: a finding is recorded only when the current
code has a bounded simplification or a concrete drift/failure risk. No
implementation files were changed. The already-dirty scoring docs README was
left untouched.

Priority is `P1` (protects a behavioral or protocol boundary), `P2` (reduces
maintenance risk), or `P3` (useful cleanup with no immediate correctness
signal). State is one of `intake`, `ready`, `in-progress`, `blocked`, or
`done`.

## Ranked handoff

| Rank | ID | Priority | State | Finding |
| --- | --- | --- | --- | --- |
| 1 | SD-001 | P1 | ready | Epee contact and lockout mechanics are implemented twice |
| 2 | SD-002 | P1 | ready | Prototype `device.ts` is still an exported parallel emulator/protocol path |
| 3 | SD-005 | P1 | ready | STM32, ESP32, and TypeScript transport codecs do not share one executable source of truth |
| 4 | SD-003 | P2 | ready | Virtual STM32 and ESP32 duplicate canonical-data cloning and boundary checks |
| 5 | SD-004 | P2 | ready | Scenario execution, scorer dispatch, and report comparison are coupled in one branch-heavy module |
| 6 | SC-001 | P2 | done | Root-approved shared weapon-input topology is renderer-verified across logical and physical circuit models; board-specific connector labels remain distinct |
| 7 | SC-002 | P2 | ready | Harness MPN and pin data have multiple manually maintained sources |
| 8 | SC-003 | P3 | intake | The retained logical board model is a 1,100-line mixed-domain composition |
| 9 | SD-006 | P1 | blocked | ESP32 services and receiver disagree on identifier validity; intake waits for FW-004 |
| 10 | SD-009 | P1 | ready | Remote gesture timing still uses milliseconds instead of canonical microseconds |
| 11 | SD-010 | P2 | done | Root-approved replay now delegates authoritative record validation and immutable cloning solely to `parseDecisionRecord` while retaining replay-only annotation checks |
| 12 | SD-011 | P2 | done | Root-approved producer parser now owns strict application-time validation and replay consumes its deeply frozen projection |
| 13 | SD-007 | P2 | ready | Scenario display and fixture schemas duplicate vocabulary predicates |
| 14 | SD-008 | P2 | intake-blocked-on-active-units | Strict immutable-data helpers are copied across app and circuit contracts |
| 15 | SC-004 | P2 | done | Root-approved board artifacts use content-addressed readiness identities and a validated configurable simulator origin instead of wall-clock or embedded localhost data |
| 16 | FW-005 | P2 | done | Root-approved shared native CMake policy now enforces C17, conversion warnings, and Clang coverage consistently while retaining STM32 target-specific flags |
| 17 | SC-005 | P3 | done | Root-approved test-only renderer helper centralizes the shared tscircuit setup across eight suites while preserving each suite's PCB mode and component-specific assertions |

## SD-001: consolidate epee contact and lockout mechanics

- Priority: `P1`
- State: `ready`
- Affected files: [`apps/scoring/src/epee.ts`](../src/epee.ts) (lines 65-182), [`apps/scoring/src/epee-resistance.ts`](../src/epee-resistance.ts) (lines 240-381), and their two test files.
- Description and evidence: `epee.ts` advances a side through valid-contact, candidate, registered, hit, and lockout states in `advanceContact`, `compareHits`, `isPendingInsideLockout`, and `advanceEpeeScoring`. `epee-resistance.ts` repeats the same lifecycle in its own `advanceContact`, `compareHits`, `isPendingInsideLockout`, and `advanceEpeeResistanceScoring`; the resistance version only adds classification and diagnostic decisions. The two modules therefore repeat the side advances, first-hit selection, ordering, and provisional cutoff arithmetic instead of sharing a small timing kernel.
- Impact: a change to contact duration, start-time ordering, or the retained lockout boundary can be fixed in one scorer and missed in the other. The duplicated tests prove each implementation locally, but do not prove that the common normal-contact behavior stays equivalent.
- Bounded remediation: extract one private app-local helper for the side lifecycle and hit ordering. Let each scorer supply a small classification result (`candidate`, `open`, or `decision`) and retain the resistance scorer's decision list outside the helper. Keep the existing public state and scorer functions.
- Dependencies: the selected `TimingTable` contract and existing epee/resistance golden scenarios.
- Non-goals: do not merge resistance and simple-contact input types, change resistance thresholds, or introduce a generic framework for foil and sabre.
- Acceptance checks:
  - Existing `epee.test.ts` and `epee-resistance.test.ts` pass unchanged or with fixture-only updates.
  - A shared-kernel test covers first-hit ordering, the start-anchored cutoff, an in-window candidate that qualifies after the deadline, and monotonic timestamps.
  - Normal simple-contact inputs produce the same hits and lock state as the current resistance path configured with exact 10-ohm/100-ohm observations.
  - The lockout arithmetic and side lifecycle exist in one implementation; only weapon-specific classification remains separate.

## SD-002: retire or explicitly quarantine the prototype device path

- Priority: `P1`
- State: `ready`
- Affected files: [`apps/scoring/src/device.ts`](../src/device.ts) (lines 102-311), [`apps/scoring/src/virtual-stm32.ts`](../src/virtual-stm32.ts) (lines 278-380), [`apps/scoring/src/virtual-esp32.ts`](../src/virtual-esp32.ts) (lines 416-490), [`apps/scoring/src/transport-frame.ts`](../src/transport-frame.ts) (lines 1-7 and 145-210), [`apps/scoring/package.json`](../package.json) (lines 9-17), [`apps/scoring/README.md`](../README.md) (lines 9-23), and [`apps/scoring/docs/decision-record-contract.md`](decision-record-contract.md) (lines 3-14).
- Description and evidence: `device.ts` exports its own epee-only STM32/ESP32 state, `ScoringDecisionRecord`, CRC over JSON, newline-delimited JSON encoding, and exactly-once receiver. The package still exports it as `scoring/device`. The newer virtual shell and receiver model the processor authority and binary transport separately, while the decision-record contract explicitly says it replaces the prototype `ScoringDecisionRecord` shape when M2 implements capture. The README still labels `device.ts` as the production boundary and describes its JSON event encoding.
- Impact: callers can select two emulator APIs with different record shapes, timing defaults, framing, and validation. A protocol or record fix can land in the canonical virtual path while the exported prototype continues to look production-ready and silently exercises different semantics.
- Bounded remediation: make one explicit canonical-path decision. Prefer removing the public `./device` export and moving its coverage to the virtual STM32, processor-link, and virtual ESP32 end-to-end tests once equivalent capture assertions exist. If the prototype must remain for a short migration, keep it private/test-only and label all references as a prototype; do not add another public compatibility API.
- Dependencies: the M0-05 decision-record implementation, M2-03/M2-07 virtual-device contracts, and the binary transport contract must cover the prototype tests that are retained.
- Non-goals: do not redesign the decision-record payload, change the transport envelope, or preserve a second production protocol for backward compatibility.
- Acceptance checks:
  - `scoring/device` is no longer a supported production import, or a documented review decision proves why it remains and identifies it as non-production.
  - The canonical virtual end-to-end test covers capture delay, immutable record fields, sequence rejection, corruption rejection, and receiver non-redecision.
  - README and contract references name the same canonical path and framing.
  - No production source imports both `device.ts` and the virtual transport stack for the same flow.

## SD-005: establish one transport codec source of truth across targets

- Priority: `P1`
- State: `ready`
- Affected files: [`apps/scoring/src/transport-frame.ts`](../src/transport-frame.ts) (lines 9-15 and 131-210), [`apps/scoring/firmware/stm32/core/stm32_transport.c`](../firmware/stm32/core/stm32_transport.c) (lines 6-123 and 163-215), [`apps/scoring/firmware/esp32/src/scoring_esp32_services.c`](../firmware/esp32/src/scoring_esp32_services.c) (lines 5-22 and 145-218), [`apps/scoring/firmware/stm32/tools/generate-transport-fixture.mjs`](../firmware/stm32/tools/generate-transport-fixture.mjs), and the ESP32 host transport tests.
- Description and evidence: TypeScript defines the M2-05 magic, version, message mapping, direction policy, lengths, and CRC. The STM32 C parser repeats those rules and receives generated golden frames from the TypeScript build. The ESP32 C parser independently repeats the magic/version/message range, header offsets, flags, length, and CRC, but its host tests construct frames locally rather than consuming the generated TypeScript fixture. The C implementations also use range checks for message types where TypeScript uses an explicit mapping.
- Impact: a message-code, direction, length, or CRC change can pass one target's tests and fail at the other target. The current STM32 fixture generation gives cross-language evidence for STM32 only; the ESP32 boundary has no equivalent byte-for-byte compatibility gate.
- Bounded remediation: extend the existing fixture-generation flow to emit a small shared protocol header/vector set consumed by both C host suites, or compile one deliberately tiny portable C transport codec into both targets and compare it against the TypeScript golden vectors. Keep hardware/DMA and service orchestration adapters outside that codec.
- Dependencies: the frozen `transport-frame.ts` contract, `fixtures/transport-frame-golden.json`, and each target's host-test build.
- Non-goals: do not create a cross-platform HAL, move application services into the codec, or claim CRC authenticity; CRC remains corruption detection only.
- Acceptance checks:
  - TypeScript, STM32 C, and ESP32 C all consume the same magic/version/message-code/direction/CRC vectors.
  - Wrong direction, unknown message code, truncated frame, max payload, and CRC corruption produce equivalent rejection outcomes on both C targets.
  - `generate-transport-fixture.mjs --check`, STM32 host tests, and ESP32 host tests pass in a clean build.
  - Protocol constants and the CRC polynomial are not independently retyped in the two target parsers.

## SD-003: share bounded canonical-data cloning primitives

- Priority: `P2`
- State: `ready`
- Affected files: [`apps/scoring/src/virtual-esp32.ts`](../src/virtual-esp32.ts) (lines 61-159 and 278-376) and [`apps/scoring/src/virtual-stm32.ts`](../src/virtual-stm32.ts) (lines 74-169 and 171-270).
- Description and evidence: both virtual processor boundaries define local `isRecord`, non-negative integer, synchronous-result, exact-key, cycle, depth, entry, string, array-descriptor, plain-object, accessor, and deep-clone logic. Their limits differ intentionally (ESP32 accepts a larger record; STM32 accepts a smaller outcome), but the traversal and descriptor rules are materially the same.
- Impact: security-relevant handling of getters, symbols, sparse arrays, cycles, prototypes, non-finite values, and freezing can drift between processor boundaries. Fixes must be applied and tested twice, while similar code makes it difficult to see which differences are intentional limits and which are accidental.
- Bounded remediation: extract a private `cloneCanonicalData` utility with explicit per-call limits and an error label. Reuse only the traversal and descriptor mechanics; keep each module's schema-specific exact-key checks, error codes, and limits at its own boundary. The same small module can hold the common `isRecord`, safe-integer, and thenable checks if that reduces repetition.
- Dependencies: the existing virtual boundary contracts and tests.
- Non-goals: do not share decision-record schema validation with arbitrary application JSON, loosen exact-field checks, or make the utility a public package.
- Acceptance checks:
  - Both virtual processor test suites pass, including adversarial getter, symbol, sparse-array, prototype, cycle, non-finite, and mutation cases.
  - ESP32 and STM32 retain their current depth, entry, and string limits and error prefixes.
  - Returned values remain deeply frozen and no accessor is invoked during cloning.
  - The recursive clone/traversal implementation has one source file.

## SD-004: split scenario execution from report comparison

- Priority: `P2`
- State: `ready`
- Affected files: [`apps/scoring/src/scenario-runner.ts`](../src/scenario-runner.ts) (lines 229-329, 336-447, 492-600, 602-777, and 823-873) and [`apps/scoring/src/scenario-runner.test.ts`](../src/scenario-runner.test.ts).
- Description and evidence: the 900-plus-line module validates JSON schemas and manifests, maps line inputs, selects epee/foil/sabre scorers, executes samples, collects uncertainty/diagnostic data, derives final state, compares expectations, and serializes reports. `executeScenario` contains separate resistance-epee, simple-epee, foil, and sabre branches with repeated `as ReturnType<...>` casts (lines 648-710), then repeats those branches to read final state (lines 745-766).
- Impact: scorer additions or changes require edits in multiple parts of one function; a wrong cast or missed branch can produce a report that is structurally valid but semantically incomplete. The parser, execution, and comparison concerns cannot be tested or reviewed independently.
- Bounded remediation: keep the public `runScenario` and report shape, but move the branch-specific sample loop into small private weapon runners that return one discriminated execution result. Add one shared final-state reader on that result and leave schema parsing/comparison as separate private functions. Do not introduce a plugin registry.
- Dependencies: golden-scenario schemas, existing weapon scorer APIs, and report-version compatibility.
- Non-goals: do not change scenario JSON, add another schema version, or generalize weapon rules behind a speculative abstraction.
- Acceptance checks:
  - The full golden-scenario corpus has byte-for-byte equivalent reports and exit codes for valid, failed, and invalid inputs.
  - Existing malformed manifest, unknown revision, duplicate line, monotonic-time, uncertainty, foil, and sabre tests pass.
  - `executeScenario` no longer contains repeated scorer-specific type assertions for both execution and final-state extraction.
  - Schema validation and report comparison can be unit-tested without running a weapon scorer.

## SC-001: deduplicate the weapon-input subcircuit while preserving board-specific connectors

- Priority: `P2`
- State: `done`
- Latest state: Root review confirmed one shared `weapon-input-topology.tsx` contract drives both models, removes the invented TBD front-end footprint and the obsolete piste-through-left-ESD route, preserves connector-specific labels, and passes 17 focused helper and generated-Circuit-JSON tests after the runtime schema fix.
- Affected files: [`packages/scoring-circuit/src/index.circuit.tsx`](../../../packages/scoring-circuit/src/index.circuit.tsx), [`packages/scoring-circuit/src/scoring-io-board.circuit.tsx`](../../../packages/scoring-circuit/src/scoring-io-board.circuit.tsx), [`packages/scoring-circuit/src/weapon-input-topology.tsx`](../../../packages/scoring-circuit/src/weapon-input-topology.tsx), and their tests.
- Description and evidence: both `WeaponInput` functions declare `U_ESD_L/R`, the placeholder analog front end, the A/B/C signal traces, ESD return, signal ground, and 3.3 V. The logical model uses `J_L/J_R` with A/B/C labels; the physical scoring-I/O model uses the selected harness references and physical footprint metadata. The internal protection/front-end topology is nevertheless manually duplicated.
- Impact: a pin-label, ESD return, front-end pin, or shared trace change can update one model and leave the other inconsistent. Since the logical model is retained as architecture evidence and the physical model feeds prototype planning, drift is especially hard to spot from a single board preview.
- Bounded remediation: extract one private helper for the shared ESD/front-end group and its six signal/power traces. Pass only the connector reference and its A/B/C endpoint labels; keep the logical connector, harness component, footprint decisions, coordinates, and board-specific traces in each caller.
- Dependencies: tscircuit component naming and both model test snapshots.
- Non-goals: do not merge the logical and physical boards, force shared coordinates, or build a general component-library layer for one repeated subcircuit.
- Acceptance checks:
  - Both circuit models build and their current tests retain the same component references and trace endpoints.
  - A shared helper test or generated Circuit JSON assertion proves both boards contain identical ESD/front-end internal topology.
  - Harness pin labels and logical A/B/C labels remain intentionally distinct at the connector boundary.

## SC-002: make production harness selection the single MPN/pin source

- Priority: `P2`
- State: `ready`
- Affected files: [`packages/scoring-circuit/src/physical-board-contract.ts`](../../../packages/scoring-circuit/src/physical-board-contract.ts) (lines 59-108 and 261-314), [`packages/scoring-circuit/src/production-harness-selection.ts`](../../../packages/scoring-circuit/src/production-harness-selection.ts) (lines 84-144 and 145-210), and [`packages/scoring-circuit/src/part-readiness.ts`](../../../packages/scoring-circuit/src/part-readiness.ts) (lines 76-246).
- Description and evidence: `physical-board-contract.ts` manually repeats cable, header, housing, terminal MPNs and board pin labels for all four harnesses. It later compares those literals to `productionHarnessSelection`, proving that the same facts have two sources. `part-readiness.ts` also carries the selected connector MPN records and physical evidence. The current validator catches some drift at runtime, but the duplication remains in every edit and review.
- Impact: a connector revision can require synchronized edits in multiple data tables. A missed edit blocks the build only if the changed value is covered by the validator; fields outside that comparison can diverge while still producing a plausible board model.
- Bounded remediation: derive the physical board's cable/connector MPN and basic pin labels from `productionHarnessSelection`. Keep board ownership, chassis socket references, and physical open-gate evidence in the board contract; keep `part-readiness` as an evidence/readiness view and add a focused cross-check for the selected MPNs rather than copying the full records.
- Dependencies: production harness selection remains the reviewed integrated-DNP source; existing contract and readiness tests.
- Non-goals: do not collapse evidence records into one giant catalog, mark any connector fabrication-ready, or remove the existing ownership/gate validation.
- Acceptance checks:
  - Changing a selected harness MPN or pin function in the canonical selection updates the board integration view without a second literal edit.
  - Existing physical-board and harness-selection tests retain exact references, pin counts, and DNP/open-gate states.
  - A negative test proves a readiness record with a mismatched selected MPN fails the focused cross-check.
  - The board contract no longer stores a second copy of the selected harness MPN tuple.

## SC-003: decompose the retained logical board composition

- Priority: `P3`
- State: `intake`
- Affected files: [`packages/scoring-circuit/src/index.circuit.tsx`](../../../packages/scoring-circuit/src/index.circuit.tsx) (1,163 lines), [`packages/scoring-circuit/src/scoring-io-board.circuit.tsx`](../../../packages/scoring-circuit/src/scoring-io-board.circuit.tsx), [`packages/scoring-circuit/src/application-display-carrier.circuit.tsx`](../../../packages/scoring-circuit/src/application-display-carrier.circuit.tsx), and [`packages/scoring-circuit/src/index.test.tsx`](../../../packages/scoring-circuit/src/index.test.tsx).
- Description and evidence: `index.circuit.tsx` is a single literal board composition containing weapon inputs, piste protection, STM32 scoring, isolated power, isolation, ESP32, Ethernet, display, audio, service, and mounting geometry. Its own comment says it is a logical end-to-end model rather than one PCB, while separate scoring-I/O and application/display models are the physical planning surfaces.
- Impact: a reviewer changing one domain must navigate a 1,100-line component and can accidentally alter another domain's names, nets, or geometry. The file's mixed ownership also makes it harder to compare retained architecture evidence with the active prototype models.
- Bounded remediation: split the JSX into private domain sections or small local components (`scoring domain`, `isolation`, `application/display`, `service`) and compose them in the existing `ScoringCircuit` board. Preserve every component name, net endpoint, coordinate, and board size; do not introduce a generic circuit DSL.
- Dependencies: tscircuit composition behavior and existing generated-output/index tests.
- Non-goals: do not route the board, change the retained architecture, merge physical board models, or infer fabrication readiness from the refactor.
- Acceptance checks:
  - `@repo/scoring-circuit` build output has identical component/trace names, counts, and board envelope before and after the split.
  - `index.test.tsx` and the generated preview checks pass.
  - Each private section has one clear domain responsibility and no new public export.

## SD-006: unify ESP32 identifier validation

- Priority: `P1`
- State: `blocked`
- Latest state: The mismatch is evidenced and bounded; implementation waits for FW-004 so receiver validation is not edited concurrently.
- Affected files: `firmware/esp32/src/scoring_esp32_services.c`, `firmware/esp32/src/scoring_esp32_receiver.c`, and their host tests.
- Description: services currently accept empty or embedded-NUL identifiers that the receiver rejects for the same public identifier type.
- Impact: boot and device identity validity depends on which ESP32 API receives the value.
- Bounded remediation: introduce one private validator with an explicit nonempty policy and cover empty, embedded-NUL, terminal-NUL, and maximum-length inputs through both APIs.
- Non-goals: do not change public wire formats, identity ownership, or add a general validation framework.

## SD-007: share scenario-display schema predicates

- Priority: `P2`
- State: `ready`
- Affected files: `src/scenario-display-projection.ts`, `src/scenario-display-fixtures.ts`, and their focused tests.
- Description: decision, signal, diagnostic, timestamp, and vocabulary predicates are independently reimplemented; the two record guards already disagree about arrays.
- Impact: fixture parsing and display projection can accept different shapes after a vocabulary or boundary change.
- Bounded remediation: share only the common display signal, decision, and diagnostic predicates while retaining fixture-specific document bounds and expected-ID checks locally.
- Non-goals: do not create a generic schema library or merge scenario execution with display projection.

## SD-008: consolidate strict immutable-data helpers

- Priority: `P2`
- State: `intake-blocked-on-active-units`
- Affected files: the strict copies in `apps/scoring/src`, plus behaviorally identical copies across `packages/scoring-circuit/src` such as `bench-prototype-analog-footprint-closure.ts`, `bench-prototype-application-footprints.ts`, `bench-prototype-fixture-harness.ts`, and `bench-prototype-reset-watchdog.ts` after active M4, remote-control, and PCB units settle.
- Description: security-sensitive `deepFreeze`, plain-record, and exact-data-graph implementations are copied across engineering contracts.
- Impact: alias, accessor, prototype, and symbol rejection semantics can drift and fixes must be repeated.
- Bounded remediation: after overlapping work closes, extract one private helper with caller-supplied error labels and migrate only behaviorally identical strict copies.
- Non-goals: do not migrate simpler trusted-object freezing or publish a monorepo-wide abstraction.

## SC-004: make generated board artifacts deterministic and portable

- Priority: `P2`
- State: `done`
- Latest state: Delivered and root-approved: readiness JSON and page bytes are deterministic and content-addressed, simulator origins fail closed, the real board artifact builds, and browser acceptance follows the configured link to the live simulator without console errors.
- Affected file: `packages/scoring-circuit/src/build.ts`.
- Description: the readiness report embeds the current wall-clock timestamp and the board page hardcodes a workstation-only `127.0.0.1:4178` simulator URL.
- Impact: identical board builds have different hashes, and non-local artifacts contain an environment-specific link.
- Bounded remediation: derive a stable report identity from canonical circuit/readiness inputs, omit runtime timestamps, and make the simulator link an explicit build setting or relative deployment link.
- Acceptance: two identical builds produce identical report/page hashes, while non-local builds contain no unintended localhost URL.

## SC-005: centralize repeated tscircuit test setup

- Priority: `P3`
- State: `done`
- Affected files: the repeated `new Circuit()` setup in analog-coupon, communications-module, index, manufacturer-footprint-adapter, part-readiness, and physical-board-model tests.
- Description: fourteen setup blocks repeat materially identical circuit construction and option wiring across eight test files.
- Impact: rendering-option changes require repeated edits and can leave suites using subtly different setup.
- Bounded remediation: with the tscircuit runtime repaired, add one test-only helper with explicit PCB/schematic options while preserving each suite's current rendering mode.
- Non-goals: do not introduce a production circuit abstraction or hide component-specific assertions.

## SD-009: migrate remote gesture timing to canonical microseconds

- Priority: `P1`
- State: `ready`
- Affected files: `apps/scoring/src/remote-button-gestures.ts` and its focused tests.
- Description: the reducer exposes `atMs`, `lastAtMs`, and millisecond timeout/window fields while the canonical device clock uses safe-integer microseconds.
- Impact: adapters can introduce a 1,000-times conversion error or lose sub-millisecond ordering when remote input joins virtual, C17, or hardware timelines.
- Bounded remediation: rename the fields and constants to `Us`, apply the shared integer-microsecond guard, and migrate focused fixtures without changing gesture semantics.
- Non-goals: do not move remote gestures into the scoring core or create a new clock abstraction.

## SD-010: use the decision-record parser as replay's sole record validator

- Priority: `P2`
- State: `done`
- Latest state: Delivered and root-approved: replay removes its duplicate record validator and manual clone, consumes the canonical parser's deeply frozen result, preserves replay-only annotation validation, and passes the replay and journal regression suites.
- Affected files: `apps/scoring/src/replay-renderer.ts`, `decision-record.ts`, and focused tests.
- Description: replay independently validates the complete decision-record shape, then calls `parseDecisionRecord` and manually clones the same record again.
- Impact: every record-contract change requires synchronized validation edits and can make replay reject or reinterpret an otherwise canonical record.
- Bounded remediation: rely on `parseDecisionRecord` and its immutable result; retain only replay-specific annotation validation and model assembly.
- Non-goals: do not merge replay rendering with the record schema or add a generic validation framework.

## SD-011: centralize application-time annotation parsing

- Priority: `P2`
- State: `done`
- Latest state: Delivered and root-approved: `parseApplicationTimeMetadata` owns exact-key, timestamp, ordering, wall-clock, and decision-record correlation checks; replay delegates to it and retains no duplicate annotation validator or clone.
- Affected files: `apps/scoring/src/application-time-metadata.ts`, `replay-renderer.ts`, and focused tests.
- Description: replay repeats wall-clock bounds, monotonic identity, ordering, and record-correlation rules already owned by the application-time producer.
- Impact: producer and replay acceptance can drift, undermining deterministic offline ordering and uncertainty display.
- Bounded remediation: export one strict parser that accepts the associated decision record and make replay consume it.
- Non-goals: do not add wall-clock authority to the scoring record or scoring core.

## Explicit YAGNI exclusions

The audit does not recommend a cross-weapon scorer framework, a monorepo-wide validation package, a generalized tscircuit component library, or a new transport abstraction layered over the existing binary codec. The current weapon-specific semantics, security-boundary validators, and board-specific evidence should remain local until a demonstrated third use or a protocol-compatibility requirement justifies further extraction.

## Firmware audit additions

This append-only review covers the stable first-party C sources below
`apps/scoring/firmware`. The LLVM gate passed on 2026-08-24 for every source
(100 percent line, function, and branch coverage for the STM32 scoring core;
at least 80 percent for every other included source). Coverage is evidence for
the current behavior, not a reason to add speculative abstractions. These four
items are `ready`; no additional intake-only firmware item met the evidence
threshold. FW-001 is intentionally narrower than SD-005: it concerns duplicate
validation inside the STM32 codec, not the cross-target transport source of
truth.

## FW-001: share STM32 one-shot and streaming frame validation

- Priority: `P1`
- State: `done`
- Affected files: [`apps/scoring/firmware/stm32/core/stm32_transport.c`](../firmware/stm32/core/stm32_transport.c) (lines 163-215 and 227-314), [`apps/scoring/firmware/stm32/include/stm32_transport.h`](../firmware/stm32/include/stm32_transport.h) (lines 101-119), and [`apps/scoring/firmware/stm32/tests/test_stm32_transport.c`](../firmware/stm32/tests/test_stm32_transport.c) (lines 138-213 and 272-337).
- Description and evidence: `scoring_stm32_transport_decode` validates the fixed header, message direction, payload bound, exact frame length, and CRC before projecting a frame (lines 174-215). `scoring_stm32_transport_receive` repeats header validation, payload-length validation, expected-frame-length arithmetic, and excess-byte rejection while buffering, then calls `decode` and applies sequence checks (lines 262-313). The fragmented and complete-frame tests exercise both paths, but the validation rules remain manually maintained twice.
- Impact: a future header, length, or CRC-policy change can update the direct decoder and leave the streaming path with different acceptance or error behavior. The current coverage gate proves both implementations, but it does not prove that their duplicated checks remain equivalent.
- Bounded remediation: add private helpers for fixed-header validation and declared-frame-length calculation, and make the streaming path call the same complete-frame validation once its bounded buffer reaches the declared length. Keep accumulation, sequence ordering, and failure-state transitions in `receive`; do not introduce a new cross-target transport abstraction.
- Dependencies: the frozen M2-05 transport contract, checked transport golden frames, and the existing STM32 host-test build.
- Non-goals: do not change wire bytes, result codes, buffering limits, sequence policy, DMA/HAL integration, or the cross-target source-of-truth decision in SD-005.
- Acceptance checks:
  - Existing STM32 transport tests and `node firmware/tools/check-coverage.mjs` pass.
  - Direct and fragmented delivery return equivalent results for valid frames, truncation, excess bytes, bad magic/version/type/direction/flags, payload bounds, and CRC corruption.
  - One private implementation owns fixed-header, declared-length, and CRC validation; `receive` retains only buffering and stream-sequence behavior.
  - `node firmware/stm32/tools/generate-transport-fixture.mjs --check` remains clean.

## FW-002: consolidate ESP32 journal mutation preconditions

- Priority: `P1`
- State: `done`
- Affected files: [`apps/scoring/firmware/esp32/src/scoring_esp32_journal.c`](../firmware/esp32/src/scoring_esp32_journal.c) (lines 211-297 and 299-371), [`apps/scoring/firmware/esp32/include/scoring_esp32_journal.h`](../firmware/esp32/include/scoring_esp32_journal.h) (lines 94-113), and [`apps/scoring/firmware/esp32/tests/scoring_esp32_receiver_host_test.c`](../firmware/esp32/tests/scoring_esp32_receiver_host_test.c) (lines 167-390 and 474-586).
- Description and evidence: `scoring_esp32_journal_append` and `scoring_esp32_journal_advance_cursor` each check that the journal is open, storage is present, recovery is not corrupt, the active slot is valid, and the sequence boundary is acceptable before calling the shared `commit_checkpoint` (append at lines 306-335; cursor advance at lines 350-363). Their operation-specific checks are validly different, but the common durable-state preflight and post-commit state contract are spread across the two public mutations and the shared commit helper.
- Impact: a change to corruption handling, full-journal backpressure, or sequence exhaustion can update one mutation path and not the other. The receiver uses both paths for authoritative records and ignored frames, so drift can make replay and cursor recovery depend on the message type.
- Bounded remediation: extract one private journal-mutation preflight for open/storage/recovery/current-slot checks and keep payload-size, duplicate-payload, and cursor-order rules in their respective callers. Retain `commit_checkpoint` as the sole slot-copy, integrity, commit-marker, and in-memory-state transition; do not change the two-slot format.
- Dependencies: the M3-09 journal slot contract, power-loss boundary tests, and receiver exactly-once semantics.
- Non-goals: do not add a storage backend, alter slot generations or integrity bytes, deserialize records, merge the journal with transport framing, or change ignored-frame behavior.
- Acceptance checks:
  - ESP32 journal and receiver host tests plus `node firmware/tools/check-coverage.mjs` pass.
  - Corrupt active-slot, full-capacity, power-loss at each boundary, duplicate, out-of-order, and `UINT32_MAX` sequence cases retain their current result codes for both append and cursor advance.
  - The shared preflight and the single commit transition are each covered; operation-specific duplicate-payload and cursor-order checks remain separate and explicit.
  - Receiver reboot/reopen tests prove that accepted decision records and ignored frames restore the same next expected sequence.

## FW-003: remove positional coupling from product-release authorization

- Priority: `P1`
- State: `done`
- Latest state: Delivered and root-approved: private authorization helpers resolve manifest artifacts, installed processor state, security floors, and observed artifacts by `scoring_release_processor_t`; reversed caller observation order passes, reversed manifest order remains non-canonical, and the full native coverage gate passes.
- Affected files: [`apps/scoring/firmware/product-update/src/scoring_product_release.c`](../firmware/product-update/src/scoring_product_release.c) (lines 178-288 and 327-380), [`apps/scoring/firmware/product-update/include/scoring_product_release.h`](../firmware/product-update/include/scoring_product_release.h) (lines 11 and 66-79), and [`apps/scoring/firmware/product-update/tests/scoring_product_release_host_test.c`](../firmware/product-update/tests/scoring_product_release_host_test.c) (lines 191-198 and 400-424).
- Description and evidence: manifest decoding requires artifact tag 8 to occur twice and then requires `decoded.artifacts[0]` to be ESP32 and `[1]` to be STM32 (lines 183-185 and 280-285). Authorization repeats that positional assumption by pairing those slots with `environment->esp32` and `environment->stm32`, while callers must supply `observed[0]` and `observed[1]` in the same order (lines 365-379 and header lines 75-79). The current tests construct the same positional tuple in `matching_observed`.
- Impact: the signed manifest is safe only because its order is enforced in a separate check. A schema or processor-order edit can leave artifact, installed-target, security-floor, and observed-digest comparisons paired by index rather than by processor, producing a hard-to-review release authorization drift or an unnecessary rejection.
- Bounded remediation: keep the fixed two-processor contract, but select artifacts and observed values by the explicit `scoring_release_processor_t` identity in private helpers before calling `authorize_artifact`. Retain duplicate/missing-processor rejection and the current canonical wire order; do not build a general processor registry.
- Dependencies: the product-release manifest contract, processor IDs, signature verification boundary, and existing canonical release fixtures.
- Non-goals: do not add a manifest revision, alter signature bytes or verification order, support a third processor, or change security-floor and downgrade policy.
- Acceptance checks:
  - Product-release host tests and `node firmware/tools/check-coverage.mjs` pass.
  - Tests prove that each processor is compared with its matching board, target, security floor, staging capacity, observed length, and digest even when test inputs are assembled in a different caller order.
  - A manifest with reversed artifact order still receives the existing `SCORING_RELEASE_NON_CANONICAL` result, while the private authorization mapping no longer depends on array position.
  - Signature-before-compatibility ordering and all existing reason codes remain unchanged.

## FW-004: separate ESP32 receiver orchestration from frame and journal state transitions

- Priority: `P2`
- State: `ready`
- Affected files: [`apps/scoring/firmware/esp32/src/scoring_esp32_receiver.c`](../firmware/esp32/src/scoring_esp32_receiver.c) (lines 173-262), [`apps/scoring/firmware/esp32/include/scoring_esp32_receiver.h`](../firmware/esp32/include/scoring_esp32_receiver.h) (lines 15-22 and 50-64), and [`apps/scoring/firmware/esp32/tests/scoring_esp32_receiver_host_test.c`](../firmware/esp32/tests/scoring_esp32_receiver_host_test.c) (lines 167-390 and 587-650).
- Description and evidence: `scoring_esp32_receiver_receive` performs application readiness checks, link I/O, frame-length checks, M2-05 decoding, expected-sequence enforcement, ignored-message classification, journal cursor or record mutation, cursor restoration, degraded-link updates, and receipt projection in one branch-heavy public function. `ignore_receipt` and `reject_receipt` cover only two projections; accepted and duplicate paths still mutate receipt fields and restore cursor inline. The coverage gate passes this routine at 86.78 percent lines and 80.91 percent branches, but the covered branches still combine transport, persistence, and API state transitions.
- Impact: a new transport result or journal outcome requires edits across several coupled branches, increasing the chance that `link_degraded`, the next expected sequence, and the receipt outcome diverge. Reviewers cannot isolate frame classification from durable mutation without running the complete receiver path.
- Bounded remediation: keep `scoring_esp32_receiver_receive` as the public coordinator, but move frame acquisition and decoding, sequence classification, and the journal commit/receipt projection into small private helpers with explicit internal results. Preserve the existing borrowed-payload lifetime and keep all service ownership in the receiver.
- Dependencies: M2-05 frame semantics, M3-08 service normalization, M3-09 journal/replay behavior, and the existing receiver fixtures.
- Non-goals: do not add an asynchronous task model, service registry, message bus, scoring authority, or new public receiver API.
- Acceptance checks:
  - ESP32 receiver host tests and `node firmware/tools/check-coverage.mjs` pass.
  - Accepted, ignored, duplicate, out-of-order, malformed, unavailable, journal-full, journal-corrupt, and sequence-exhausted cases preserve their current result, receipt, degraded-link, and cursor behavior.
  - Private frame classification can be tested without journal mutation, and private journal projection can be tested without reimplementing frame decoding.
  - The public receive function coordinates the helpers rather than directly containing both frame-parser details and journal state-transition logic.

## FW-005: consolidate native CMake safety policy

- Priority: `P2`
- State: `done`
- Affected files: the STM32, ESP32, and product-update `CMakeLists.txt` files plus a private `apps/scoring/firmware/cmake` policy module.
- Description: C17, LLVM coverage, and compiler-warning setup is repeated across native targets; ESP32 and product-update enable `-Wconversion` and `-Wsign-conversion`, while STM32 host/target code does not.
- Impact: first-party C is compiled under unequal implicit-conversion safety and every toolchain-policy change requires synchronized edits across three projects and multiple test targets.
- Bounded remediation: provide private CMake functions for baseline C17, warning, and Clang coverage policy while leaving STM32 freestanding, CPU, linker, and target-specific flags local.
- Non-goals: do not introduce a shared HAL, C++ layer, generic firmware framework, or weaken target-specific warnings.
- Acceptance checks:
  - All three native host projects and the STM32 target configure and build.
  - A configure-time assertion proves every first-party native target receives the baseline warning policy.
  - `node apps/scoring/firmware/tools/check-coverage.mjs` still passes the 100-percent core and 80-percent other-source gates.
