# Scoring apparatus delivery plan

## Outcome

Deliver a premium three-weapon scoring apparatus in controlled increments:

1. an executable, source-traceable scoring specification;
2. a deterministic two-processor simulator with event replay and fault injection;
3. host-tested STM32 and ESP32 firmware;
4. an independently reviewed EVT design package that is safe to fabricate;
5. validated EVT and DVT units; and
6. a production release supported by manufacturing, compliance, reliability, FIE evidence, and a reproducible
   encrypted referee-remote software package.

Fabrication readiness is the exit criterion for Milestone 5. It is not a claim of product, regulatory, or FIE approval.
Software emulation can retire rule, protocol, replay, recovery, and application risks before boards arrive, but it cannot
prove analog thresholds, EMC behavior, connector life, thermal performance, or real-time peripheral behavior.

## Planning rules

- Keep product-specific work inside `apps/scoring` and hardware design inside `packages/scoring-circuit`. Extract a
  shared package only after a second real consumer exists.
- Give an agent one task ID at a time. A task should normally produce one reviewable commit in one to three focused
  working days.
- A task owns the files named in its task packet. Changes to a shared contract require a separate contract task or
  coordination with every dependent task.
- Every completed task must include evidence: tests, generated artifacts, measurements, review notes, or an explicit
  documentation-only acceptance check.
- Do not hide open hardware decisions behind placeholder footprints, generic CAD bodies, guessed values, or supplier
  search results.
- Do not add production mechanisms merely to improve an emulator. Simulate only behavior required by a contract,
  failure mode, acceptance test, or diagnosed risk.
- Hardware-in-the-loop begins after EVT boards exist. A small analog coupon and socketed resistance/timing fixture may
  be built earlier because they answer the analog questions needed to release the EVT schematic.

## Repository boundaries

| Area | Canonical location | Ownership |
| --- | --- | --- |
| Rules, deterministic simulator, golden vectors | `apps/scoring/src`, `apps/scoring/tests`, `apps/scoring/fixtures` | Software specification |
| Protocol and replay documentation | `apps/scoring/docs` | Cross-processor contract |
| STM32 firmware | `apps/scoring/firmware/stm32` | Authoritative acquisition and scoring |
| ESP32 firmware | `apps/scoring/firmware/esp32` | UI, storage, networking, identity, and updates |
| Circuit, parts evidence, analog model, fabrication outputs | `packages/scoring-circuit` | Electrical and PCB design |
| Enclosure and connector-module CAD | `packages/scoring-circuit/mechanical` | Mechanical integration |
| Test evidence | `apps/scoring/evidence` and `packages/scoring-circuit/evidence` | Immutable generated or measured results |

The proposed folders are created by the first task that needs them. Empty scaffolding is not a deliverable.

## Task states and completion contract

Use `backlog`, `ready`, `in-progress`, `review`, `blocked`, and `done`. A task is `ready` only when every dependency is
`done`, its input documents are available, and no unresolved design choice can materially change its output.

Every agent task packet must state:

- **Objective:** one observable outcome.
- **Allowed files:** the smallest exclusive file set the task may change.
- **Inputs:** exact documents, contracts, generated artifacts, and predecessor task IDs.
- **Deliverables:** files or physical evidence expected at review.
- **Acceptance:** commands, measurements, or reviewer checks that must pass.
- **Non-goals:** adjacent work that must remain untouched.
- **Handoff:** decisions, remaining risks, and the next task IDs unblocked.

Repository-wide validation remains required before a milestone closes. A task may use focused checks during
development, but its handoff must identify any unrelated repository failures rather than silently broadening its scope.

## Milestone overview

| Milestone | Exit outcome | Starts when | Can run alongside |
| --- | --- | --- | --- |
| M0: Baseline contracts | Traceable rules, system boundaries, task-ready contracts | Immediately | Nothing depends on unfinished M0 contracts |
| M1: Executable scoring specification | Foil, epee, and sabre behavior proven by golden vectors | Relevant M0 contracts are stable | M2 infrastructure and M4 research |
| M2: Full virtual apparatus | Deterministic STM32/ESP32 simulation, replay, recovery, and fault injection | Event and protocol contracts exist | M1 weapon modules and M4 analog work |
| M3: Firmware foundations | Host-tested firmware implements the same vectors and protocol | M1 rule tables and M2 transport are stable | M4 and mechanical work |
| M4: Analog and mechanical proof | Measured sensing cell and frozen board/enclosure interfaces | M0 pin/power contracts exist | M1 through M3 |
| M5: EVT fabrication release | Reviewed schematic, PCB, BOM, and manufacturing package | M3 interfaces and M4 evidence are accepted | Final software features not tied to board interfaces |
| M6: EVT integration | Boards score correctly and survive defined faults | EVT boards assembled | Application feature development |
| M7: DVT and approval | Design passes reliability, compliance, venue, and FIE evidence gates | EVT defects closed | Manufacturing fixture development |
| M8: Production validation | Repeatable, traceable manufacturing release | DVT design frozen | Field-service preparation |

## Encrypted remote cross-milestone track

The canonical operator behavior, button lookup, and `RC-01` through `RC-18` work units live in the
[encrypted IR remote contract](encrypted-ir-remote-control-contract.md) and
[button reference](remote-control-button-reference.md). They are not duplicated as M-series tasks because they cross
product, application, firmware, security, electrical, and manufacturing ownership.

| Gate | Required remote work | Exit evidence |
| --- | --- | --- |
| Baseline and schematic release | `RC-01` through `RC-04` | Authority and schema decisions, approved keypad/labels, selected cryptographic and receiver architecture, optical/battery targets, and bench-board interface. |
| Virtual apparatus and application | `RC-05` through `RC-12` | Complete valid initialization, every bout transition, button conformance, snapshot load, no-empty-state tests, and single-writer controller arbitration. |
| Target firmware | `RC-13` through `RC-15` | Apparatus decoder, handheld firmware, pairing/provisioning/service recovery, and target security evidence. |
| Paired prototype acceptance | `RC-16` | Command, fault, range, angle, venue-light, adjacent-piste, latency, battery, reset, replay, and unavailable-owner evidence. |
| Production release | `RC-17` and `RC-18` | Serialized fixture conformance and least-privilege manufacturer/recovery package dry run. |

## M0: Baseline contracts

**Exit criterion:** every downstream team can implement against versioned rules, signals, messages, and acceptance
evidence without inventing missing behavior.

**Status legend:** `backlog` not started; `ready` dependencies complete; `in-progress` active work; `review` committed evidence awaiting explicit independent approval; `blocked` waiting on a named prerequisite; `done` implementation, verification, independent approval, and commit recorded.

`done` applies to the acceptance of that specific work unit, not the entire device or factory release. Reopen an affected completed unit if a dependency later changes incompatibly.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M0-01 | done | Delivered: FIE traceability matrix for foil, epee, sabre, lamps, buzzer, lockout, faults, and power. | FIE traceability matrix for foil, epee, sabre, lamps, buzzer, lockout, faults, and power | None | Every normative behavior cites article/page in the local FIE PDF; Favero differences are labeled prior art, not authority |
| M0-02 | done | Delivered: root-approved glossary, explicit unit registry, strict validator, documentation, and focused tests define line names, sides, signed wall timestamps, monotonic integer-microsecond time, resistance, and timing boundaries. | Glossary and units contract for line names, sides, timestamps, resistance, and timing boundaries | M0-01 | No overloaded names; all internal time uses integer microseconds; all electrical units are explicit |
| M0-03 | done | Delivered: root-approved seven-conductor and weapon-phase contract with exact safe/select/settle/observe/release sequencing, source witnesses, strict data boundaries, deep immutable receipts, and fail-closed diagnostics for every illegal or indeterminate cycle outcome. | Seven-conductor logical signal contract, weapon excitation phases, and safe inactive state | M0-01, M0-02 | Reviewed by software and electrical owners; every illegal or indeterminate state has a diagnostic outcome |
| M0-04 | done | Delivered: root-approved immutable STM32/ESP32 authority, heartbeat, one-way reset, safe-state, fault, and USB-C PD boundary; cross-package BP-122/BP-123 reconciliation remains test-only. | STM32/ESP32 responsibility and fault-containment contract | M0-02 | Scoring authority, reset ownership, watchdog behavior, degraded modes, and forbidden ESP32 decisions are explicit |
| M0-05 | done | Delivered: Strict versioned immutable decision-record schema covers hits, rejections, line faults, reset, calibration with raw evidence, numeric and identity uncertainty, STM32 provenance, exact-key parsing, and migrated journal/replay/ESP32 consumers. | Versioned decision-record schema covering hits, rejections, line faults, calibration, and uncertainty | M0-01, M0-04 | Schema examples round-trip and reject unknown incompatible versions |
| M0-06 | done | Delivered and root-approved: one versioned binary envelope, four immutable golden frames, generated STM32/ESP32 C fixtures, receiver-direction enforcement, sequence policy, and corruption/truncation/version coverage pass TypeScript and native host verification. | Binary transport frame specification with sequence, length, CRC-32C, message type, and compatibility policy | M0-04, M0-05 | Golden encoded frames exist; corruption, truncation, duplication, reordering, and version mismatch outcomes are defined |
| M0-07 | done | Delivered: version 1.1 manifest digests, strict source/input/expectation identities, exact coverage mappings, authored boundary uncertainty, and adversarial integrity cases pass the complete 110-test runner/clock suite. | Golden scenario file format and corpus manifest | M0-01, M0-02, M0-05 | A scenario can express line transitions, expected events, expected non-events, and boundary uncertainty without code |
| M0-08 | blocked | Partial fail-closed proof validates the exact STM32G474RET3/LQFP64 map, 14 alternate functions, GPIO conflicts, CMSIS peripherals, and distinct DMAMUX requests against pinned STM32CubeG4 1.6.3 inputs; closure still requires a pinned STM32CubeMX installation and generated candidate `.ioc`/project with clock, safe-state, and DMA solver evidence. | Candidate STM32 GPIO/ADC/comparator/timer/DMA allocation | M0-03 | Every used signal maps to a real MCU function; conflicts and alternate-function constraints are checked |
| M0-09 | blocked | Blocked: Candidate N16R2 map and tests exist; schematic/RF/antenna, boot electrical, and physical interface reviews remain before closure. | Candidate ESP32 GPIO and peripheral allocation | M0-04, M0-06 | Strapping, boot, USB, Ethernet SPI, display, audio, I2C, debug, and antenna constraints are reviewed |
| M0-10 | done | Delivered: Root-approved immutable power/reset lifecycle covers cold boot, brownout, independent and watchdog reset, update activation/rollback, whole-power loss, persistence, one-way reset authority, safe-inactive behavior, and USB-C PD as the normal input. | Power-state and reset-state contract | M0-04 | Cold boot, brownout, independent reset, watchdog reset, update, and power-loss persistence behavior are defined |
| M0-11 | done | Delivered and root-approved: the immutable threat model freezes STM32 scoring authority, target-bound signed activation and rollback, identity/key custody, production debug policy, hostile network/frame/IR boundaries, fail-closed recovery, and USB-C PD normal power while retaining downstream security evidence gates. | Product threat model and firmware trust boundaries | M0-04, M0-06, M0-10 | Covers signed updates, rollback, device identity, debug access, network isolation, malformed frames, and recovery |
| M0-12 | blocked | Delivered and root-reviewed: immutable 19-family ledger binds every requirement ID and requirement-text projection from the FIE matrix and four canonical backlogs to explicit unit, simulator, native-C, WebAssembly, HIL, and physical evidence owners; completion waits for blocked prerequisites M0-08 and M0-09. | Requirements-to-evidence ledger | M0-01 through M0-11 | Every product requirement names its planned unit, simulation, bench, EVT, DVT, compliance, or production evidence |

## M1: Executable three-weapon scoring specification

**Exit criterion:** deterministic host tests prove every rule boundary for both sides and all three weapons. The
implementation has no dependency on an MCU SDK or wall-clock time.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M1-01 | done | Delivered and root-approved: executable source-fingerprinted audit maps every current epee boolean and resistance branch to EPEE/GEN requirements, verifies both declared commit blobs and current sources, retains exact timing/ground/ordering boundaries, and explicitly defers lamps/audio and C17 migration without granting TypeScript authority. | Audit current epee state machine against the traceability matrix | M0-01, M0-07 | Existing behavior is either cited and retained or corrected with boundary tests |
| M1-02 | done | Delivered and root-approved: resistance-aware epee scenarios and mirrored tests cover normal and exceptional contacts, grounded rejection, simultaneous ordering, provisional lockout-boundary retention, and fail-closed unavailable, indeterminate, and interval evidence on both sides. | Epee exceptional-resistance and grounded-material logical cases | M1-01, M0-03 | Golden scenarios cover valid, invalid, simultaneous, and near-lockout contacts on both sides |
| M1-03 | done | Delivered and root-approved: source-bound foil scorer and contract cover both sides at 12,999/13,000/14,000/15,000 us, target and non-target classification, grounded and equipment-fault containment, indeterminate/unavailable inputs, deterministic ordering, same-side inhibition, and provisional first-signalled-hit lockout. | Foil contact-break and on/off-target state machine | M0-01, M0-03, M0-07 | Tests cover 13/14/15 ms boundaries, target grounding, lame/weapon faults, and lockout |
| M1-04 | done | Delivered and root-approved: independently authored, FIE-PDF-digest-bound vectors cover both sides at 449/450/475/476 ohms plus bounded uncertainty and unavailable evidence, while keeping yellow diagnostics separate from 200-ohm scoring eligibility and preserving the C17/no-TypeScript-fallback boundary. | Foil insulation-warning and 450/475 ohm decision contract | M1-03 | Boundary vectors distinguish scoring behavior from diagnostic indication |
| M1-05 | done | Delivered and root-approved: sabre scorer and source-bound scenarios cover both sides, 99/100/1,000 us held and released target pulses, fail-closed uncertain releases, control break, yellow/white diagnostics, whipover/external-path containment, deterministic simultaneous capture, and lockout; the 28-scenario corpus remains green. | Sabre contact and control-break state machine | M0-01, M0-03, M0-07 | Tests cover 0.1 ms minimum, 1 ms capture, 3 ms control break, whipover-related sequences, and lockout |
| M1-06 | done | Existing committed implementation root-approved: strict supervisor-authorized reset and weapon-change transitions require a new bout identity and fresh scorer, preserve only the intended weapon selection and revision, and cannot leak hits, candidates, lockout, diagnostics, timing state, or decision authority. | Weapon-neutral bout reset and state-transition API | M1-02, M1-03, M1-05 | Reset cannot leak hits, pending contacts, or lockout state across bouts or weapon changes |
| M1-07 | done | Delivered and root-approved: `timing-1` is a deeply immutable canonical table with machine-readable FIE bands and endpoint uncertainty; epee, foil, sabre, and boundary generation derive from it, while unknown revisions, altered selections, out-of-band values, and mutable clones fail closed. | Versioned immutable timing-table loader | M1-02, M1-03, M1-05 | Unknown revisions fail closed; values outside approved bounds are rejected |
| M1-08 | done | Root-reviewed independent expectations cover all 54 runtime vectors and 26 FIE/reference vectors below, at, and above every boundary for both sides; 86 focused tests pass. | Generated boundary-vector suite | M1-02 through M1-07 | Every timing boundary runs below, at, and above the limit for both sides with deterministic ordering |
| M1-09 | done | Root-reviewed bounded property evidence reproduces seeded corpora byte-for-byte, mirrors both sides and decisions, rejects backdated time, and proves unsafe projections cannot score; 8 focused tests pass. | Property tests for monotonic time, symmetry, determinism, and no-hit safety | M1-06, M1-08 | Seeded runs reproduce exactly; left/right mirroring produces mirrored decisions |
| M1-10 | done | Delivered and root-approved: strict bounded immutable capture records machine, instrument, calibration, uncertainty, raw-artifact, session, observation, and comparison provenance; every relationship is descriptive evidence only and prior-art observations cannot become normative rules, thresholds, pass/fail gates, or scorer-generated expectations. | Reference-machine comparison capture format | M0-07 | Favero or other machine observations can be stored with provenance without becoming normative rules |
| M1-11 | done | Delivered and root-approved: `rules-1` binds 39 immutable M0/M1 artifacts at reviewed revision 8e4681d, the complete 19-ID three-weapon traceability set, and exact verification identities; all 356 focused tests plus types, lint, and format pass. | Scoring specification release `rules-1` | M1-01 through M1-10 | Focused verification and independent rule review pass; traceability ledger is complete |

## M2: Deterministic virtual apparatus and replay

**Exit criterion:** CI can run a complete virtual bout, inject processor/link/storage faults, and reproduce every
accepted or rejected electrical event from its immutable record.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M2-01 | blocked | Virtual-clock execution, safe timestamps, same-seed and byte-identical API reports, 29 executable plus 13 planned-evidence cases, and desktop/mobile simulator checks pass. The coherent simulator commit is blocked because clean `pnpm-lock.yaml` regeneration hangs against the configured private Azure registry; CW-00 oracle regeneration must follow that exact committed source/lock state. | Explicit virtual microsecond clock and scheduler | M0-02 | No simulator behavior reads wall-clock time; equal seeds produce byte-identical output |
| M2-02 | done | Existing committed implementation root-reviewed: exactly seven canonical conductors, deterministic safe/select/settle/observe/release acquisition, explicit open/closed/grounded/cross-line/out-of-range/indeterminate/unavailable readings, and no scoring decisions; 15 focused tests pass. | Seven-line virtual front-end reading model | M0-03, M2-01 | Expresses open, closed, grounded, cross-line, resistance bucket, and indeterminate/fault readings |
| M2-03 | done | Delivered and root-approved: deterministic bounded virtual STM32 shell validates M2-02 snapshots, resolves the reviewed weapon profile before scorer invocation, ignores wrong-profile or untrusted inputs, and emits only immutable scorer-origin outcomes with no application-owned decisions. | Virtual STM32 device shell independent of epee-specific types | M1-06, M2-01, M2-02 | Selects weapon tables and emits no application-owned decisions |
| M2-04 | done | Root-reviewed authoritative capture stores bounded immutable pre/post evidence for hit, rejection, short, late-hit, parry, whipover, uncertainty, and line-fault outcomes; 6 focused tests pass. | Hit, rejection, short, late-hit, parry, whipover, and line-fault event capture | M0-05, M2-03 | Each record contains bounded pre/post samples, reason, rule revision, firmware identity, boot ID, and sequence range |
| M2-05 | done | Delivered and root-approved: the canonical M0-06 codec matches all four checked-in golden frames byte-for-byte and rejects malformed length, CRC, type, direction, version, flags, trailing bytes, and invalid input types. | Canonical binary encoder and decoder | M0-06 | Golden frames match byte-for-byte; malformed length, CRC, type, and version are rejected |
| M2-06 | done | Delivered and root-approved: the deterministic virtual link covers delay, loss, duplication, reordering, corruption, disconnect/reconnect, cancellation, bounded backpressure, defensive snapshots, and caller-mutation isolation at 100% focused coverage. | Fault-injectable virtual processor link | M2-05 | Supports delay, loss, duplication, reordering, corruption, disconnect, and bounded backpressure |
| M2-07 | done | Existing committed implementation root-approved: capability-bound virtual-link deliveries, strict canonical record decoding, bounded non-evicting retention, exact sequence and duplicate handling, immutable snapshots, and adversarial forged/mutated input tests ensure ESP32 accepts authoritative records exactly once without creating or reclassifying decisions. | Virtual ESP32 receiver and authority guard | M0-04, M2-06 | Accepts valid records exactly once and cannot create, alter, or reclassify a scoring decision |
| M2-08 | done | Delivered and root-approved: strict immutable journal options and storage handoff, bounded atomic checkpoint generations, CRC/digest recovery, idempotency/conflict handling, and adversarial power-loss tests guarantee recovery to the old or new complete state. | Event journal and power-fail transaction model | M0-05, M0-10, M2-07 | Power loss at every write boundary yields either the old or new valid state, never a partial record |
| M2-09 | done | Delivered and root-approved: bounded application boot identity, RTC uncertainty/drift, forward and backward network-time anchors, explicit offline/stale/indeterminate ordering, deterministic M2-08 journal recovery annotation, and replay preservation remain outside STM32 scoring authority. | Application boot ID, RTC uncertainty, and network-time metadata | M0-05, M2-08 | Offline and resynchronized timelines remain ordered and explicitly uncertain where required |
| M2-10 | done | Delivered and root-approved: deterministic reset/recovery scenarios cover independent processor reset, watchdog, brownout, link loss, whole-power recovery, corrupt or interrupted journal recovery, new application-boot metadata, immutable diagnostics, and preserved STM32 boot identity, output state, and scoring authority. | Processor reset, watchdog, brownout, and recovery scenarios | M0-10, M2-06 through M2-09 | Independent resets never change STM32 scoring authority; recovery produces explicit diagnostics |
| M2-11 | done | Delivered and root-approved: stored authoritative records and application-time metadata are parsed by their canonical validators, projected in fixed recursive property order, deeply frozen, and rendered byte-identically without rerunning or re-deciding scoring. | Replay renderer data contract | M2-04, M2-09 | A stored record renders without rerunning or re-deciding the scoring algorithm |
| M2-12 | done | Delivered and root-approved: strict one-path CLI runs a scenario or corpus through the canonical runner, binds exact input bytes by SHA-256, emits bounded byte-stable JSON, preserves runner mismatch status, and rejects invalid invocations, paths, oversized inputs, and oversized reports with deterministic nonzero exits. | Scenario-runner CLI and machine-readable report | M0-07, M2-10 | Runs one file or a corpus, returns nonzero on mismatch, and emits stable JSON evidence |
| M2-13 | done | Root-reviewed fixed seeded fuzz evidence exercises all 256 receiver cases, strict record mutations, allocation bounds, frame/record duplicates, journal write exclusion, and decoder mutation isolation; 7 focused tests pass. | Seeded protocol and record fuzz suite | M2-05, M2-07, M2-08 | Crashes, unbounded allocations, duplicate acceptance, and silent corruption are absent across the fixed corpus |
| M2-14 | backlog | Next after M2-01 through M2-13, M1-11: Full virtual-apparatus release. | Full virtual-apparatus release | M2-01 through M2-13, M1-11 | All golden vectors and fault scenarios pass with required coverage and reproducible evidence |

## M3: Firmware foundations

**Exit criterion:** M3-15 releases host-tested STM32 and ESP32 firmware foundations that implement the frozen
contracts. M3-16 through M3-18 are explicitly tracked aliases into the separate C17 WebAssembly migration DAG and do
not retroactively expand the M3-15 firmware release. The ESP32 remains a record consumer and does not link the scoring
core.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M3-01 | done | Delivered and root-approved: the accepted portability ADR fixes one strict C17 scoring core for native, STM32, and WebAssembly, vendor C adapters at target edges, fixed-width bounded interfaces, pinned toolchains, host/target qualification and debugging, and rejects Rust/C++ rewrites, ESP32 scoring, and TypeScript fallback. | Firmware-language and portability decision record | M1-11, M2-05 | Records the selected strict C17 core, vendor C adapters, native/STM32/WebAssembly target model, qualification, debugging, and team-support rationale |
| M3-02 | done | Delivered and root-approved: the checked 54-vector JSON translates into generated STM32 fixtures with exact source, ordering, rule-set, timing-table, unit, and digest metadata; native host tests consume and assert the generated contract without manually copied timing constants. | Golden-vector exporter usable by host firmware tests | M0-07, M1-11 | Firmware tests consume generated fixtures without manually copying timing constants |
| M3-03 | done | Delivered and root-approved: the committed strict-C17 native STM32 scaffold substitutes clock, ADC, comparator, DMA, flash, watchdog, and transport interfaces, provides fail-closed unavailable defaults and bounded polling, emits no scoring decisions, and passes all 7 native CTest gates. | STM32 host-build scaffold with hardware interfaces | M3-01, M3-02 | Builds without STM32 hardware and substitutes clock, ADC, comparator, DMA, flash, watchdog, and transport interfaces |
| M3-04 | done | Delivered and root-approved at the firmware-foundation boundary: the committed heapless C17 core passes the complete checked 54-vector M1-08 three-weapon corpus, matches every exported decision-record field, and has 100% line/function/branch coverage. Full fault, uncertainty, generated-profile, portable-ABI, and WebAssembly parity remain owned by CW-03 onward. | STM32 scoring core implementation | M3-03 | Passes the complete three-weapon golden corpus and matches decision records field-for-field |
| M3-05 | done | Delivered and root-approved: the committed bounded caller-owned C17 transport validates the M2-05 header, direction, length, and CRC, preserves opaque payloads, handles fragmentation and direct/stream parity, rejects corruption/duplicate/reorder/exhaustion, and latches one-outstanding-frame backpressure until recovery. Focused transport/fixture CTest passes 2/2 and coverage is 99.33% lines, 100% functions, 97.22% branches. | STM32 binary transport implementation | M2-05, M3-03 | Passes golden frames, fragmentation, corruption, sequence, and backpressure tests |
| M3-06 | blocked | Host target-startup and adapter tests pass 2/2, and the target static check proves bounded symbols, no allocation/ESP control path, and inactive output latching before output mode. Closure remains blocked by M0-08 CubeMX/clock-tree/DMA proof, external-HSE implementation, supervisor/integrity/acquisition readiness, and physical safe-output pull validation. | STM32 target startup, clocks, MPU, watchdog, supervisor, and safe outputs | M0-08, M0-10, M3-03 | Target build and static checks pass; reset defaults cannot indicate a hit |
| M3-07 | blocked | Root audit confirms the host poll seam is bounded and fail-closed, but no acquisition trigger, DMA buffer topology, timestamp ordering, deadline budget, or target timing metric can be frozen before M0-08 provides CubeMX clock/DMAMUX proof and M4-08 provides measured acquisition timing. | STM32 acquisition scheduler and DMA buffer adapter | M0-08, M3-04, M4-08 | Host timing tests pass; target timing budget is instrumented for later board measurement |
| M3-08 | done | Delivered and root-approved: the committed dual ESP-IDF/native strict-C17 scaffold exposes substitutable storage, clock, identity, network, display, audio, signed-update, watchdog/reset, and read-only scoring-link services with deterministic unavailable defaults and no ESP32 scoring authority; 3/3 CTest and all C coverage gates pass. | ESP-IDF host-build scaffold with service interfaces | M3-01, M3-02 | Storage, clock, identity, network, display, audio, update, and scoring-link dependencies are substitutable |
| M3-09 | done | Delivered and root-approved: the committed SDK-free C17 receiver validates complete STM32 frames, journals opaque authoritative bytes exactly once through four atomic write boundaries, restores cursors across reset/power loss, rejects corruption/reordering/exhaustion fail closed, and replays without decoding or scoring; Debug/Release CTest and per-source coverage gates pass. | ESP32 receiver, journal, and replay implementation | M2-07 through M2-11, M3-08 | Passes virtual power-loss, duplicate, corruption, reset, and replay scenarios |
| M3-10 | done | Delivered and root-approved at the design/host-evidence boundary: the committed ADR fixes ESP32-S3 Secure Boot v2, encrypted release flash, signed dual-slot OTA, anti-rollback, per-unit identity, locked production debug, pending-verify rollback, and controlled recovery while preserving separate STM32 authority; the strict-C17 release verifier passes its native host gate. Target eFuse, pinned ESP-IDF, provisioning, and factory read-back evidence remain downstream gates. | ESP32 identity, secure boot, signed update, rollback, and recovery design | M0-11, M3-08 | Threat-model tests and documented provisioning/recovery flow pass review |
| M3-11 | done | Delivered and root-approved at the host-isolation boundary: the committed strict-C17 harness drives 2,048 rounds of maximum-sized network, display, and audio backpressure/unavailable/rejected load before and after an authoritative STM32 frame, proving the opaque record, sequence, storage copy, and timestamp bytes remain unchanged and corrupt post-load frames remain rejected. RTOS scheduling, DMA, electrical-link, and board evidence remain downstream gates. | Display/audio/network load-isolation tests | M0-04, M3-08 | Maximum simulated application load cannot modify scoring records or STM32 timestamps |
| M3-12 | done | Root-approved no-go report pins Renode 1.16.1 and its release tree, confirms no STM32G4/G474 platform, rejects misleading generic-register stubs, and retains native/static/HIL verification without a permanent Renode dependency. | STM32 Renode feasibility spike | None; bounded upstream platform audit | A bounded report identifies supported peripherals and value beyond host tests; no permanent dependency without evidence |
| M3-13 | done | Delivered and root-approved: the committed bounded probe pins Espressif QEMU 9.2.2 and documents supported ESP32-S3 CPU/RAM/UART/SPI-flash, GDB, eFuse-file, crypto, OpenEth, PSRAM, RGB, and partial watchdog value while explicitly deferring Secure Boot, RTC watchdog, radio/USB/ADC, electrical, analog-scoring, and STM32-authority evidence. QEMU remains an optional target-integration smoke lane; native C17 tests remain required. | ESP32 QEMU feasibility spike | M3-08 through M3-10 | A bounded report identifies supported ESP-IDF behavior and value beyond host tests |
| M3-14 | done | Root-approved native C17 runner links the real STM32 publish/transport seam to the real ESP32 receiver/journal/replay path. Debug, Release, and coverage-mode CTest runs pass duplicate, corruption, lost/reordered frame, backpressure recovery, ESP32 reset/reopen, byte/sequence identity, and four journal power-loss boundary checks. The evidence lists every platform fake and makes no Renode, target, HIL, or physical claim. | Dual-virtual-firmware integration runner | M3-05, M3-09, accepted M3-12/M3-13 results | Runs the highest-value supported firmware paths together; unsupported peripherals remain host fakes, not hidden omissions |
| M3-15 | blocked | M3-14 native integration is root-approved and committed; release remains blocked by M3-06 target-startup physical/CubeMX gates and M3-07 acquisition scheduler dependencies. The later C17/WebAssembly migration remains a separate DAG. | Firmware-foundation release | M3-01 through M3-14 | Host verification passes; target builds are reproducible; remaining board-only tests are listed explicitly |
| M3-16 | backlog | Next after `CW-02` through `CW-04`: Versioned portable scoring ABI (tracking alias). | Versioned portable scoring ABI (tracking alias) | `CW-02` through `CW-04` | `CW-04` closes fixed-width canonical byte inputs, outputs, state, errors, versioning, capacities, and digests without exposing C struct layout |
| M3-17 | backlog | Next after `CW-11` through `CW-13`: C17 WebAssembly build and browser adapter (tracking alias). | C17 WebAssembly build and browser adapter (tracking alias) | `CW-11` through `CW-13` | `CW-12` and `CW-13` close a pinned reproducible module and fail-closed adapter with no scorer callback, target I/O, or TypeScript fallback |
| M3-18 | in-progress | Active: Simulator WebAssembly cutover and atomic TypeScript scorer deletion (tracking alias). | Simulator WebAssembly cutover and atomic TypeScript scorer deletion (tracking alias) | `CW-14` through `CW-19B`, plus `CW-21` and `CW-22` | Browser, native, and STM32 parity, exact planned-evidence closure, independent gap analysis, observation, and independent review pass; simulator uses WebAssembly only; duplicate TypeScript scorers and the final oracle are changed atomically |

M3-18 intentionally excludes `CW-20`: factory-facing evidence packaging is a subsequent deliverable after atomic
TypeScript-scorer deletion and does not participate in the simulator cutover/deletion tracking alias.

M3-10 is part of the ESP32 half of the launch update requirement. The independently verified STM32 image, dual-bank
rollback, product compatibility manifest, ESP32 candidate health/rollback, interrupted-update matrix, and
cohort-release controls are sequenced as `EVO-09` through `EVO-16` in
[software-product-evolution-roadmap.md](software-product-evolution-roadmap.md). None of those
tasks permits the ESP32 to decide or unilaterally activate STM32 scoring firmware.

## M4: Analog and mechanical proof

**Exit criterion:** measured evidence supports the analog component values and the electrical/mechanical interfaces are
frozen enough to complete the EVT schematic and layout.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M4-01 | done | Delivered and root-approved: 786 immutable model-screen cases cover normal, guarded, unpowered, tolerance, temperature, pulse-width, and reference boundaries with committed-source digests and explicit no-credit physical follow-ups. | Analog simulation audit against all rule boundaries | M0-01, M0-03 | Model cases cover 0-500 ohm paths, declared capacitance range, tolerances, temperature, and pulse widths |
| M4-02 | done | Delivered and root-approved: source-bound paper calculations freeze the BP-102 clamp/22-ohm path, quantify leakage, capacitance, charge injection, guarded energy, surge return, and MCU injection limits, and deny all unmeasured physical authority. | Final candidate clamp diode and rail-protection network | M4-01 | Leakage, charge injection, capacitance, surge path, and MCU injected-current limits are calculated with vendor models |
| M4-03 | done | Delivered and root-approved: a source-pinned 20-term per-corner ledger assigns every switch, resistor, leakage, buffer, ADC, reference, SAR, environmental, fit, and uncertainty term a numeric bound or evidence-gated allocation; its exact sum remains within the 5-ohm fixture target while physical validation stays denied. | Source/sink switch, resistor, reference, and ADC error budget | M4-01, M4-02 | Worst-case threshold error meets the fixture target with explicit calibration assumptions |
| M4-04 | blocked | Static ERC and the exact 45-reference/26-MPN review queue remain root-reviewed. Nine exact manufacturer source/package records are now retained, SHA-256 verified from repository bytes, and bound to their exact MPNs without granting geometry or footprint authority. Remaining manufacturer drawings/CAD, board artwork overlays, and every independent footprint/orientation review still block closure. | Single-channel sensing coupon schematic and verified footprints | M4-02, M4-03 | ERC passes; footprints are checked against manufacturer drawings by a second reviewer |
| M4-05 | done | Delivered and root-approved: the source-pinned de-energized fixture design covers 320 passive corners, timing neighborhoods with uncertainty/no-credit semantics, six body-cord connectors, piste and seven-conductor port, both-side fault maps, break-before-make relay evidence, environmental/USB-C PD cases, traceable calibration, and fail-closed interlocks. | Socketed resistance, capacitance, and pulse fixture design | M0-07, M4-01 | Covers the matrix in `packages/scoring-circuit/docs/analog-front-end.md` with calibrated uncertainty |
| M4-06 | backlog | Next after M4-04, M4-05: Coupon and fixture fabrication package. | Coupon and fixture fabrication package | M4-04, M4-05 | Gerbers, drills, BOM, placement, assembly notes, drawings, and inspection checklist pass independent review |
| M4-07 | backlog | Next after M4-06: Coupon procurement and incoming inspection. | Coupon procurement and incoming inspection | M4-06 | Measured parts, pad geometry, shorts/opens, fixture resistance, and relay bounce are recorded before power-on |
| M4-08 | backlog | Next after M4-07: Analog threshold, timing, and calibration report. | Analog threshold, timing, and calibration report | M4-07 | Required resistance and pulse boundaries pass across input tolerance and planned temperature range |
| M4-09 | backlog | Next after M4-07, M4-08: Sacrificial ESD/EFT/surge and cable-fault report. | Sacrificial ESD/EFT/surge and cable-fault report | M4-07, M4-08 | Failures are contained; protection changes are fed back into the model and retested |
| M4-10 | blocked | Exact red/blue Stäubli selections now bind the 2022 item sheet, 2024 item sheet, and 2026 catalogue: the newer sources agree at 30.7 mm, but overall length remains null until Stäubli confirms the controlling revision or samples are measured. Plug-fit, retention, cycle, resistance, salt, enclosure, and footprint evidence remain open. | Exact reel-socket selection and physical plug-fit study | None | Color suffixes, retention, contact resistance, sweat/salt exposure plan, harness termination, and cycle target are recorded |
| M4-11 | blocked | Root review corrected the retained Würth RJ45 STEP checksum and current Molex 43030-0007 drawing revision to N10. A committed handoff records exact Molex identities, URLs, observed markers, failed byte acquisition, and the manufacturer-query/sample-measurement next step. Molex/Amphenol CAD, geometry, enclosure, strain-relief, and release evidence remain DENY. | Communications and power connector CAD/footprint verification | None | RJ45, USB-C, locking power, shield tabs, fasteners, service access, and strain relief match manufacturer drawings |
| M4-12 | blocked | Blocked on M4-10/M4-11 released geometry: socket length conflict, sample plug-fit, USB-C/Molex acquisition, connector overlays, board datums/height maps, antenna/IR/display/speaker selections, thermal evidence, and cable-specific bend radii prevent enclosure CAD or cutout release; only a non-dimensional constraint register is safe. | Enclosure architecture, board outlines, keepouts, and thermal assumptions | M4-10, M4-11 | VESA mounting, antenna clearance, encrypted IR optical window/field of view, airflow, display, speaker, connector modules, harness bend radii, and service sequence fit |
| M4-13 | backlog | Next after M0-03, M0-10, M4-10 through M4-12: Harness pinout, keying, bonding, and current-rating release. | Harness pinout, keying, bonding, and current-rating release | M0-03, M0-10, M4-10 through M4-12 | No reversible connector can apply destructive power or swap left/right scoring lines; chassis/ESD paths are explicit |
| M4-14 | backlog | Next after M4-08 through M4-13: Critical-parts readiness manifest update. | Critical-parts readiness manifest update | M4-08 through M4-13 | Selected parts, verified footprints, manufacturer CAD, mechanical review, and blockers are accurately machine-checked |

## M5: EVT fabrication release

**Exit criterion:** an independent reviewer agrees that the released files describe the intended circuit and board, pass
the defined electrical/layout rules, and are safe to order as a small EVT build.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M5-01 | backlog | Next after M0-03, M0-04, M4-13: Hierarchical schematic sheet plan and net naming. | Hierarchical schematic sheet plan and net naming | M0-03, M0-04, M4-13 | Sheets separate power, scoring AFE, STM32, isolation, ESP32, Ethernet, display/audio, service, and connectors |
| M5-02 | backlog | Next after M0-10, M4-13: Complete power entry, protection, conversion, sequencing, and telemetry schematic. | Complete power entry, protection, conversion, sequencing, and telemetry schematic | M0-10, M4-13 | Worst-case ratings, derating, inrush, reverse polarity, brownout, and test points are reviewed |
| M5-03 | backlog | Next after M4-08, M4-09: Complete seven-channel analog front-end schematic. | Complete seven-channel analog front-end schematic | M4-08, M4-09 | Exact values/models, calibration paths, safe defaults, ADC/comparator mapping, and test points match evidence |
| M5-04 | backlog | Next after M0-08, M3-06, M5-03: Complete STM32, reference, debug, watchdog, and primary-output schematic. | Complete STM32, reference, debug, watchdog, and primary-output schematic | M0-08, M3-06, M5-03 | Pin map, clocks, decoupling, reset, SWD, lamps, buzzer, and fault defaults are complete |
| M5-05 | backlog | Next after M0-04, M0-06, M3-05: Complete isolation and processor-link schematic. | Complete isolation and processor-link schematic | M0-04, M0-06, M3-05 | Directions, defaults, power domains, creepage intent, and reset/heartbeat paths match the contract |
| M5-06 | backlog | Next after M0-09, M3-15, M4-11, RC-01 through RC-04: Complete ESP32, encrypted IR receiver, Ethernet, storage, RTC, identity, display, audio, and debug schematic. | Complete ESP32, encrypted IR receiver, Ethernet, storage, RTC, identity, display, audio, and debug schematic | M0-09, M3-15, M4-11, RC-01 through RC-04 | Pin map, strapping, decoupling, clocks, protected IR receiver/decoder and test path, antenna keepout, magnetics, terminations, and service paths are complete |
| M5-07 | backlog | Next after M4-10 through M4-13: Complete connector-module and harness schematics. | Complete connector-module and harness schematics | M4-10 through M4-13 | Panel parts are not represented as generic headers; module and harness part numbers are explicit |
| M5-08 | backlog | Next after M5-02 through M5-07: Production BOM and approved alternatives. | Production BOM and approved alternatives | M5-02 through M5-07 | Lifecycle, stock risk, temperature grade, tolerance, voltage/current derating, and alternates are reviewed |
| M5-09 | backlog | Next after M5-01 through M5-08: Independent schematic and ERC review. | Independent schematic and ERC review | M5-01 through M5-08 | No unexplained ERC waiver; every review comment is resolved or recorded as an accepted risk |
| M5-10 | backlog | Next after M5-09, M4-12: Controlled stack-up and layout constraint specification. | Controlled stack-up and layout constraint specification | M5-09, M4-12 | Defines impedance, copper, material, isolation, return paths, analog zones, RF keepout, current, and manufacturing limits |
| M5-11 | backlog | Next after M5-10: Placement release. | Placement release | M5-10 | Connectors, mounting, antenna, isolation, analog cells, clocks, decoupling, power loops, test access, and thermal parts pass review |
| M5-12 | backlog | Next after M5-11: Critical power and analog routing. | Critical power and analog routing | M5-11 | Current loops, Kelvin paths, ESD returns, references, ADC inputs, and domain boundaries match the reviewed strategy |
| M5-13 | backlog | Next after M5-11, M5-12: Ethernet, clocks, SPI, display, audio, and remaining routing. | Ethernet, clocks, SPI, display, audio, and remaining routing | M5-11, M5-12 | Length/return constraints pass; unrouted count is zero |
| M5-14 | backlog | Next after M5-13: Copper, planes, thermal relief, stitching, creepage, and silkscreen completion. | Copper, planes, thermal relief, stitching, creepage, and silkscreen completion | M5-13 | Plane integrity, isolation slots, chassis strategy, polarity, pin-one, warning, revision, and service labels pass review |
| M5-15 | backlog | Next after M5-14: PCB DRC, schematic-to-layout, and netlist audit. | PCB DRC, schematic-to-layout, and netlist audit | M5-14 | Zero unexplained violations and zero schematic/layout mismatches |
| M5-16 | backlog | Next after M5-15: SI, PI, thermal, EMC, and safety pre-fabrication review. | SI, PI, thermal, EMC, and safety pre-fabrication review | M5-15 | Reviewers issue bounded actions; required corrections are implemented and checks rerun |
| M5-17 | backlog | Next after M5-15: Design-for-manufacture and design-for-test review. | Design-for-manufacture and design-for-test review | M5-15 | Fabricator/assembler constraints, panelization, fiducials, tooling, test pads, programming, and inspection are accepted |
| M5-18 | backlog | Next after M5-16, M5-17: Fabrication and assembly output generation. | Fabrication and assembly output generation | M5-16, M5-17 | Gerbers or ODB++, drills, IPC netlist, BOM, centroid, drawings, stack-up, notes, and 3D assembly are generated from one revision |
| M5-19 | backlog | Next after M5-18: Independent output viewer and source comparison. | Independent output viewer and source comparison | M5-18 | Apertures, layers, holes, outlines, text, mask/paste, polarity, rotations, and BOM references match source files |
| M5-20 | backlog | Next after M5-19: EVT release candidate archive and checksums. | EVT release candidate archive and checksums | M5-19 | Immutable archive includes source revision, tool versions, outputs, checksums, open risks, and quantity/build instructions |
| M5-21 | backlog | Next after M5-20: Fabrication-readiness sign-off. | Fabrication-readiness sign-off | M5-20 | Electrical, layout, mechanical, firmware, manufacturing, and product owners approve a five-to-ten-unit EVT order |

## M6: EVT integration

**Exit criterion:** assembled boards satisfy core scoring, replay, fault-containment, power, thermal, and service
requirements sufficiently to freeze DVT corrections.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M6-01 | backlog | Next after M5-21: Incoming bare-board and assembly inspection. | Incoming bare-board and assembly inspection | M5-21 | Stack-up, impedance coupon, dimensions, finish, X-ray/AOI findings, substitutions, and workmanship are recorded |
| M6-02 | backlog | Next after M6-01: Current-limited staged power bring-up. | Current-limited staged power bring-up | M6-01 | Every rail, reset, clock, reference, isolation barrier, and idle current is within its budget before processors run |
| M6-03 | backlog | Next after M6-02, M3-15: Programming, identity provisioning, and factory self-test bring-up. | Programming, identity provisioning, and factory self-test bring-up | M6-02, M3-15 | Both processors program and recover; device identity and test results are serialized without exposing secrets |
| M6-04 | backlog | Next after M6-02, M4-08: Seven-channel calibration and analog correlation. | Seven-channel calibration and analog correlation | M6-02, M4-08 | Board measurements correlate with coupon model and fixture uncertainty; coefficients remain bounded |
| M6-05 | backlog | Next after M6-03, M6-04: Three-weapon golden-vector hardware execution. | Three-weapon golden-vector hardware execution | M6-03, M6-04 | Board decisions and records match the host corpus at every rule boundary |
| M6-06 | backlog | Next after M6-03: Replay and power-loss integrity testing. | Replay and power-loss integrity testing | M6-03 | Completed records survive resets and interrupted writes; corrupt or partial records are rejected explicitly |
| M6-07 | backlog | Next after M6-03: Processor/link/watchdog/brownout fault injection. | Processor/link/watchdog/brownout fault injection | M6-03 | ESP32 failure never changes scoring authority; STM32 failure produces safe unavailable output and diagnostics |
| M6-08 | backlog | Next after M6-03: Ethernet, radio, display, audio, storage, and maximum-load coexistence. | Ethernet, radio, display, audio, storage, and maximum-load coexistence | M6-03 | Worst application load cannot alter scoring timing, thresholds, records, or processor stability |
| M6-09 | backlog | Next after M6-08: Thermal characterization and power budget closure. | Thermal characterization and power budget closure | M6-08 | Full-load temperatures and derating meet limits at declared ambient and blocked-vent assumptions |
| M6-10 | backlog | Next after M6-08, M6-09: EMC pre-scan and ESD/EFT/surge engineering tests. | EMC pre-scan and ESD/EFT/surge engineering tests | M6-08, M6-09 | Failures are reproducible, corrected, and regression-tested before DVT layout freeze |
| M6-11 | backlog | Next after M6-01: Connector, harness, enclosure, drop, and service trial. | Connector, harness, enclosure, drop, and service trial | M6-01 | Loads reach chassis supports; modules replace without soldering or damage; discovered wear risks have actions |
| M6-12 | backlog | Next after M6-04 through M6-11: EVT defect ledger and DVT change review. | EVT defect ledger and DVT change review | M6-04 through M6-11 | Every defect has severity, root cause, correction, regression evidence, and disposition |

## M7: DVT, compliance, reliability, and FIE approval

**Exit criterion:** the frozen design passes the qualification matrix and has the approvals required for its intended
markets and competition claims.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M7-01 | backlog | Next after M6-12: DVT design update and release review. | DVT design update and release review | M6-12 | All release-blocking EVT defects are corrected and independently reviewed |
| M7-02 | backlog | Next after M7-01: DVT build and golden-unit correlation. | DVT build and golden-unit correlation | M7-01 | Units correlate with fixture and EVT golden unit before destructive testing |
| M7-03 | backlog | Next after M7-02, BT-10: Formal timing and resistance qualification. | Formal timing and resistance qualification | M7-02, BT-10 | All three weapons pass boundary matrix across temperature, input tolerance, cable, and UPS transfer using the correlated independent box tester |
| M7-04 | backlog | Next after M7-02: EMC emissions and immunity qualification. | EMC emissions and immunity qualification | M7-02 | Intended-market radiated/conducted emissions and immunity, ESD, EFT, and surge requirements pass |
| M7-05 | backlog | Next after M7-02: Electrical safety assessment. | Electrical safety assessment | M7-02 | External supply, enclosure, materials, wiring, temperature, abnormal operation, and markings meet the selected standard |
| M7-06 | backlog | Next after M7-02: Environmental, vibration, drop, spill-path, and corrosion program. | Environmental, vibration, drop, spill-path, and corrosion program | M7-02 | Predefined functional and cosmetic acceptance criteria pass after exposure |
| M7-07 | backlog | Next after M7-02: Connector and control endurance program. | Connector and control endurance program | M7-02 | Reel, USB-C, Ethernet, power, buttons, and module fasteners meet target cycles with bounded resistance/retention drift |
| M7-08 | backlog | Next after M7-02, M3-10, EVO-09 through EVO-16: Firmware security, two-chip update, rollback, recovery, and penetration review. | Firmware security, two-chip update, rollback, recovery, and penetration review | M7-02, M3-10, EVO-09 through EVO-16 | Signed ESP32 and STM32 updates, key handling, compatibility, parser boundaries, recovery, and service access meet the threat model |
| M7-09 | backlog | Next after M7-02: Long-duration burn-in and accelerated cycling. | Long-duration burn-in and accelerated cycling | M7-02 | Reset, corruption, timing drift, thermal, and intermittent-connection rates meet the reliability target |
| M7-10 | backlog | Next after M7-03 through M7-09: Venue trial and operational workflow report. | Venue trial and operational workflow report | M7-03 through M7-09 | Referees, armorers, organizers, and service staff complete realistic bouts, setup, diagnostics, and recovery |
| M7-11 | backlog | Next after M7-03 through M7-10: 24 V FIE SEMI evidence package and engagement. | 24 V FIE SEMI evidence package and engagement | M7-03 through M7-10 | Complete prototype, construction drawings, proposed rule wording, and test evidence are submitted on the required schedule |
| M7-12 | backlog | Next after M7-03 through M7-11, BT-11: DVT release decision. | DVT release decision | M7-03 through M7-11, BT-11 | Claims are limited to obtained approvals; unresolved FIE power disposition is treated as a product gate; full operational tester failures are resolved or explicitly denied |

## M8: Production validation and release

**Exit criterion:** approved suppliers and fixtures repeatedly build traceable units that meet the golden-unit limits,
and field service can diagnose and replace wear modules without factory-only knowledge.

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| M8-01 | backlog | Next after M7-12: Supplier control plan and approved-vendor list. | Supplier control plan and approved-vendor list | M7-12 | PCN/EOL monitoring, incoming criteria, alternates, counterfeit controls, and lot traceability are active |
| M8-02 | backlog | Next after M7-08, M8-01: Programming, provisioning, and key-custody station. | Programming, provisioning, and key-custody station | M7-08, M8-01 | Audit proves unique identity, protected secrets, signed firmware, two-chip recovery, and serialized results |
| M8-03 | backlog | Next after M7-03, M8-01: Production test fixture and coverage analysis. | Production test fixture and coverage analysis | M7-03, M8-01 | Covers rails, reference, every scoring line, lamps, audio, display, communications, storage, identity, and watchdogs |
| M8-04 | backlog | Next after M8-03: Golden limits and fixture correlation. | Golden limits and fixture correlation | M8-03 | Multiple fixtures and operators reproduce accepted measurements against DVT golden units |
| M8-05 | backlog | Next after M8-01 through M8-04: Pilot build. | Pilot build | M8-01 through M8-04 | Yield, defects, cycle time, rework, substitutions, and test escapes meet launch criteria |
| M8-06 | backlog | Next after M8-05: Burn-in sampling and reliability-monitoring plan. | Burn-in sampling and reliability-monitoring plan | M8-05 | Sampling detects defined early-life failures and feeds a controlled corrective-action process |
| M8-07 | backlog | Next after M8-05: Service manual, diagnostics, spares, and repair limits. | Service manual, diagnostics, spares, and repair limits | M8-05 | Authorized service can identify and replace wear modules while preserving calibration and safety |
| M8-08 | backlog | Next after M8-05 through M8-07: Release archive and configuration baseline. | Release archive and configuration baseline | M8-05 through M8-07 | Hardware, firmware, rules, BOM, suppliers, fixtures, approvals, manuals, checksums, and known risks share one release identity |
| M8-09 | backlog | Next after M8-08: Production release decision. | Production release decision | M8-08 | Product, engineering, quality, manufacturing, security, compliance, and service owners sign the launch record |

## BT: Independent scoring-box tester program

**Exit criterion:** an independently powered and calibrated tester can drive both reel interfaces plus the piste/ground
reference, observe the applicable complete-apparatus response, and produce immutable, reviewable evidence for each
approved three-weapon and operational-behavior case within its declared scope. This is a parallel verification-instrument
track, not another scoring-box feature and not an automatic FIE approval claim. See [box-tester-roadmap.md](box-tester-roadmap.md).

| ID | Status | Latest state | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| BT-01 | backlog | Next after M0-01 through M0-07: Tester requirements, independence, and coverage contract. | Tester requirements, independence, and coverage contract | M0-01 through M0-07 | Every normative and product behavior maps to stimulus, independent observation, uncertainty, and evidence; unsupported behavior is explicit |
| BT-02 | backlog | Next after M0-03, M0-10, BT-01: Reel, piste, output-sensor, and safety interface contract. | Reel, piste, output-sensor, and safety interface contract | M0-03, M0-10, BT-01 | Two three-contact reel cables, piste/ground, voltage/current range, floating boundaries, misuse, and no-back-power behavior are reviewed |
| BT-03 | backlog | Next after M4-01, M4-05, BT-02: Switch-matrix and programmable-impedance architecture. | Switch-matrix and programmable-impedance architecture | M4-01, M4-05, BT-02 | Coverage proof chooses the minimum justified topology; resistance, leakage, capacitance, switching time, skew, and fault energy fit allocated limits |
| BT-04 | backlog | Next after M0-07, M2-12, BT-01: Tester sequence language and canonical-scenario compiler. | Tester sequence language and canonical-scenario compiler | M0-07, M2-12, BT-01 | Scenarios compile deterministically without copied timing constants; invalid, unsupported, or unsafe steps fail closed |
| BT-05 | backlog | Next after M2-12, BT-04: Virtual tester and bout-observatory integration. | Virtual tester and bout-observatory integration | M2-12, BT-04 | Commands, measured transitions, expected/actual outputs, evaluations, and pass/fail/skipped/indeterminate/infrastructure-error states replay on one timeline |
| BT-06 | backlog | Next after M4-05, M4-13, BT-02 through BT-05: Tester schematic, PCB, harness, enclosure, and fabrication review. | Tester schematic, PCB, harness, enclosure, and fabrication review | M4-05, M4-13, BT-02 through BT-05 | Safe defaults, isolation, calibration paths, connectors, test access, strain relief, schematic/layout checks, and manufacturing outputs pass independent review |
| BT-07 | backlog | Next after BT-06: Prototype bring-up, self-test, and calibration. | Prototype bring-up, self-test, and calibration | BT-06 | Incoming inspection, switch topology, resistance/capacitance/timing, delay/skew, leakage, and observer thresholds are measured and archived |
| BT-08 | backlog | Next after BT-07: Tester fault-containment and uncertainty report. | Tester fault-containment and uncertainty report | BT-07 | Welded/open switch, wrong cable, DUT overvoltage, power loss, communication loss, and sensor failure force an indeterminate or infrastructure-error result before a pass is issued |
| BT-09 | backlog | Next after BT-07, BT-08: Physical-output observer correlation. | Physical-output observer correlation | BT-07, BT-08 | Lamp, buzzer, extension, reset, and unavailable observations correlate with traceable electrical, optical, and acoustic instruments |
| BT-10 | backlog | Next after M6-05, BT-09: Three-weapon golden-scenario hardware correlation. | Three-weapon golden-scenario hardware correlation | M6-05, BT-09 | Commands, measured line states, physical outputs, decision/replay records, and host expectations align for every approved case |
| BT-11 | backlog | Next after M6-06 through M6-11, BT-10: Full operational-behavior qualification suite. | Full operational-behavior qualification suite | M6-06 through M6-11, BT-10 | Power/reset, degraded cable, replay, display/audio, coexistence, service, and long-run behavior produce complete reviewable evidence |
| BT-12 | backlog | Next after M7-03, BT-11: Tester release, service, and correlation program. | Tester release, service, and correlation program | M7-03, BT-11 | Multiple testers reproduce limits; a drift-backed calibration interval, golden unit, firmware update, service, and periodic correlation are controlled |

BT-01, BT-04, and BT-05 may proceed before scoring-box PCB fabrication. BT-06 remains blocked until the physical
seven-conductor, fixture-uncertainty, and harness boundaries are stable. M6 may use calibrated laboratory fixtures before
BT-12 productization, but formal M7 timing qualification requires BT-10 correlation. M8-03 remains a separate production
coverage decision even if it reuses validated tester modules or protocols.

## Recommended initial agent queue

Start with tasks that unblock multiple lanes and have non-overlapping files:

1. **M0-01:** create the FIE traceability matrix in a new document.
2. **M0-05:** draft the expanded decision-record schema after M0-01 identifies every event class.
3. **M0-07:** define the golden scenario format against the current epee tests.
4. **M0-08:** audit the STM32 peripheral and pin allocation in the circuit documentation.
5. **M0-09:** audit the ESP32 allocation, strapping pins, and peripheral conflicts.
6. **M4-01:** expand the existing analog model matrix without changing production component claims.

After M0-01, M0-05, and M0-07 merge, separate agents can safely take M1-01, M1-03, M1-05, M2-01, and M4-01 in
parallel because their primary files and acceptance evidence do not overlap.

Do not start detailed PCB routing, target firmware peripheral code, or enclosure-detail CAD yet. Those tasks depend on
contracts or measurements that are intentionally still open.

## Milestone closure checklist

A milestone closes only when:

1. every required task is `done` or explicitly removed through a reviewed scope decision;
2. focused validation and repository-wide verification pass at the milestone revision;
3. generated and measured evidence is archived with source revision and tool versions;
4. documents and machine-readable manifests agree with the implementation;
5. an independent reviewer has resolved every release-blocking comment; and
6. remaining risks, assumptions, and deferred work are named in the next milestone entry criteria.
























