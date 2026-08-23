# Software product evolution roadmap

**Status:** approved planning direction

## Decisions this roadmap makes

1. Finish and validate the current TypeScript specification, C17 STM32 scoring implementation, and ESP-IDF ESP32 implementation before migrating the scoring core to Rust.
2. Treat the approved golden vectors, unit tests, integration tests, scenario corpus, and hardware-correlation evidence as the behavioral oracle. A new implementation must match that oracle; it does not replace it by asserting equivalent intent.
3. Improve the web player now. It is a deterministic presentation and replay client, not a second scoring authority. Its RGB LED array must present the same event and latch semantics as the apparatus display contract.
4. Make reliable, signed, rollback-capable OTA for both processors a launch requirement. The STM32 remains the only scoring authority throughout download, validation, activation, rollback, and an ESP32 failure.
5. Plan to open-source the software while selling hardware. Select the exact license only after dependency-compatibility, contributor, trademark, safety, security, export, and commercial-hardware review.

This page sequences the decisions above. The [device delivery plan](device-delivery-plan.md) remains the authority for hardware, EVT, DVT, and production milestones. The [firmware language ADR](firmware-language-portability-decision.md) remains the authority for the current C17 decision.

## Guardrails

- Do not begin a Rust production migration while the current C17/ESP-IDF release is incomplete or lacks its required evidence. A small toolchain investigation may be planned, but it must not fork the launch implementation.
- Keep scoring qualification, timestamps, weapon tables, and primary output decisions on the STM32. The ESP32 and browser may consume immutable records and render projections only.
- Do not couple a web-player visual change to a new scoring rule. Render stored or already-qualified events; add rule behavior only through the existing rules, vector, and evidence process.
- Do not OTA-update bootloaders or the ESP32 partition table in the initial product release. Do not make an irreversible anti-rollback change without an explicit security review.
- Do not publish secrets, production signing keys, device credentials, unrestricted factory tools, or a claim that software publication makes hardware certified. Keep the license undecided until its review gate.
- Avoid speculative abstraction. A shared Rust crate exists only after equivalence evidence shows it reduces lifecycle risk. No Rust HAL, ESP Rust port, cloud fleet service, or alternate simulator is in scope merely to demonstrate portability.

## Phase A: Protect the current oracle and improve the player now

**Entry:** the current TypeScript rules, scenario runner, and player are available.

**Exit:** the player visibly projects apparatus-style RGB LED states from authoritative replay data, while the current test corpus stays the canonical behavior source.

| ID | Task | Depends on | Acceptance | Stop or rollback gate |
| --- | --- | --- | --- | --- |
| EVO-01 | Publish a behavior-oracle manifest that pins `rules-1`, golden scenarios, decision-record schema, transport frames, test commands, and evidence digests. | M1-11, M2-14 | A reviewer can reproduce the named corpus and identify its revisions without reading implementation internals. | Stop if any listed artifact is mutable, missing, or has ambiguous ownership; repair the manifest rather than copy fixtures. |
| EVO-02 | Define the player display projection contract: logical panel geometry, RGB palette, side/weapon mapping, latch/reset semantics, unavailable state, and accessible textual equivalent. | M0-05, M2-11 | The contract maps each accepted record type to a visual state without assigning or reclassifying a touch. | Stop if it needs raw line samples or a browser-side scoring inference. |
| EVO-03 | Render a logical HUB75-style RGB LED array in the web player, starting with the known 64 by 32 logical panel model and a scalable canvas or DOM presentation. | EVO-02 | Snapshot and interaction tests show side lamps, white/off-target state, lockout, reset, and unavailable states at the documented logical resolution. | Revert to the last correct renderer if the projection changes decision-record meaning or becomes too slow for deterministic replay. |
| EVO-04 | Connect the player to recorded decision/replay events and make its panel advance only from the virtual clock or replay timeline. | EVO-01, EVO-03 | A fixed replay produces the same visible panel-state sequence and textual event sequence on repeated runs. | Stop if wall-clock scheduling changes the event order or a player action mutates a record. |
| EVO-05 | Add player controls for scenario selection, deterministic play, pause, step, reset, and an explicit unavailable diagnostic. | EVO-04 | Keyboard-accessible controls replay a named scenario and identify the source scenario and rule revision. | Keep controls local to playback; do not add remote scoring, configuration, or firmware-control paths. |
| EVO-06 | Add visual regression fixtures for each panel state and a browser acceptance checklist comparing the player’s event/latch behavior with the apparatus display contract. | EVO-03, EVO-05 | CI and integrated-browser review pass for desktop and mobile layouts, keyboard names, and all display states. | Stop release of a player change when a fixture or accessibility check disagrees with the contract. |

`EVO-02` through `EVO-06` are the immediate implementation queue. They may proceed without waiting for hardware, Rust, or an open-source license decision.

## Phase B: Finish and validate the current C17 and ESP-IDF path

**Entry:** Phase A is in progress or complete; M3 current-language foundations are active.

**Exit:** the current C17 STM32 and ESP-IDF ESP32 code, including the two-chip update path, have reproducible builds,
host/target evidence, and a complete oracle baseline. This is a code-completion gate, not a commercial hardware launch.

| ID | Task | Depends on | Acceptance | Stop or rollback gate |
| --- | --- | --- | --- | --- |
| EVO-07 | Complete and freeze the C17 STM32 scoring baseline: source revision, compiler/container identities, map/stack/timing evidence, and the complete oracle manifest. | EVO-01, M3-02 through M3-07, M3-15 | A clean host and target build reproduces the selected corpus and decision records. | Any unexplained oracle mismatch, target timing failure, or missing provenance blocks the baseline. |
| EVO-08 | Complete and freeze the non-authoritative ESP-IDF baseline: receiver, journal, replay, display/load isolation, and reproducible service build evidence. | M3-08, M3-09, M3-11, M3-14, M3-15 | The ESP32 receives and presents records without altering STM32 decisions or timestamps. | Any application path that can alter scoring authority blocks the baseline. |
| EVO-09 | Freeze a signed product-release manifest format that binds ESP32 and STM32 artifacts, hashes, target IDs, board revisions, protocol/schema/config compatibility, release ID, and minimum security floors. | M0-06, M0-11, M3-10 | Invalid, mismatched, unsigned, truncated, and incompatible manifests fail before either activation path. | No image is selected from an unsigned envelope or an ESP32-only interpretation of compatibility. |
| EVO-10 | Specify the STM32 update image, immutable bootloader boundary, dual-bank/inactive-bank layout, signature verification, candidate state, health checks, rollback record, and STM32-authorized activation. | EVO-09, M0-04, M0-10, M0-11 | The design identifies atomic state transitions and proves that scoring is unavailable during activation. | Stop if a candidate can overwrite the only valid STM32 image or if the ESP32 can activate it unilaterally. |
| EVO-11 | Implement and host-test the STM32 signed-image verifier and dual-bank candidate/rollback state machine against a fault matrix. | EVO-10, M3-03, M3-04 | Wrong target, bad signature, downgrade, corruption, and every simulated interruption preserve or return to the prior valid bank. | Any ambiguous boot result, loss of a known-good bank, or unbounded parser is a release blocker. |
| EVO-12 | Implement and test the ESP32 inactive-slot OTA candidate path: signed image verification, health-gated validation, rollback, recovery, and security-floor handling. | EVO-09, M3-10 | A bad ESP32 image or failed candidate health check rolls back without requesting any STM32 scoring change. | Stop if ESP32 rollback depends on STM32 availability or a candidate becomes valid before its declared health checks pass. |
| EVO-13 | Implement the bounded ESP32-to-STM32 delivery protocol for already-verified artifact bytes, progress, resume, and diagnostics. | EVO-10, EVO-11, M3-05, M3-09 | Link loss, reset, duplicate blocks, reordering, and corruption cannot alter STM32 selection or scoring authority. | The ESP32 may deliver bytes but cannot substitute STM32 verification or activation. |
| EVO-14 | Implement product-update orchestration: compatibility evaluation, idle-only candidate requests, independent ESP32 and STM32 activation, and an explicit partial-update state. | EVO-09, EVO-11 through EVO-13, M0-04 | ESP-first, STM32-first failure, and rollback combinations remain serviceable; no active bout is updated. | Abort activation on an active bout, incompatible pair, missing prior-valid image, or unmet health gate. |
| EVO-15 | Run target and board power-cut, reset, watchdog, bad-image, compatibility, and recovery trials at every update state transition. | EVO-11, EVO-12, EVO-14, M6-03, M6-06, M6-07 | Evidence shows both processors return to a valid version or an explicit serviceable recovery state, with identities and diagnostics retained. | Any brick, unintended scoring availability, or silent cross-processor reset blocks DVT and launch. |
| EVO-16 | Establish the signed release-build, key-custody, staged cohort rollout, publication-pause, audit, and emergency-rollback procedure for DVT and production validation. | EVO-09, EVO-12, EVO-15 | A pre-production dry run demonstrates reproducible artifacts, separated approvals, canary containment, and recorded recovery without requiring a fleet service. | Do not publish a release that cannot be paused or whose keys, audit trail, or compatibility record are incomplete. |
| EVO-17 | Approve the code-complete current-language baseline and retained behavioral oracle. | EVO-07, EVO-08, EVO-15, EVO-16 | Firmware, security, quality, and service owners accept the C17/ESP-IDF evidence and the bounded Rust-proof scope. | This approval does not authorize hardware launch or a Rust production cutover; unresolved defects remain on the current path. |

The first hardware product release must satisfy `EVO-09` through `EVO-16` together with the applicable M7 and M8
evidence. M3-10 alone closes only part of the ESP32 update requirement; it does not close the STM32 path.

## Phase C: Rust shared-core proof after current-code completion

**Entry:** `EVO-17` is complete. The C17 baseline and its oracle remain the reference implementation until a separate
migration decision is accepted. Commercial hardware shipment is not a prerequisite for this proof.

**Exit:** a small `no_std` Rust scoring core has proven byte-for-byte and decision-for-decision equivalence on native, WebAssembly, and STM32 targets, or the migration is stopped with the C17 baseline retained.

| ID | Task | Depends on | Acceptance | Stop or rollback gate |
| --- | --- | --- | --- | --- |
| EVO-18 | Write the Rust proof scope: one bounded scoring slice, target toolchains, ownership boundaries, size/timing budgets, supply-chain policy, and comparison report format. | EVO-17 | The scope excludes ESP32 scoring, firmware-wide rewrite, and production cutover. | Stop before coding if the proof cannot reuse the oracle or has no measurable lifecycle hypothesis. |
| EVO-19 | Implement the isolated `no_std` Rust core and native test harness for the scoped scoring slice. | EVO-18 | It consumes the existing immutable vectors and matches C17 decisions and record fields exactly. | Any behavioral delta is a defect or an approved rules change in the oracle, never a migration exception. |
| EVO-20 | Compile the same core and a Rust display-projection module to WebAssembly; provide a browser adapter that uses the player display projection contract. | EVO-19, EVO-04 | Native and WASM runs produce identical ordered decisions and panel projections for the frozen corpus. | Stop if the browser adapter adds scoring behavior outside the core or diverges from replay semantics. |
| EVO-21 | Compile the same core for STM32 and attach only the minimal acquisition/output adapters needed for target timing, memory, watchdog, and fault tests. | EVO-19 | Target build, map/stack, cycle/timing, and fault tests meet the agreed budgets and oracle parity. | Stop if an adapter needs heap allocation, non-deterministic timing, an unreviewed unsafe boundary, or misses the current C17 budget. |
| EVO-22 | Run a three-target equivalence gate across native, WASM, STM32 host/target, and the retained C17 reference. | EVO-20, EVO-21 | All targets match the oracle and one another for rules, faults, reset/unavailable behavior, and declared display projection. | Preserve C17 in production and close the experiment if any unexplained mismatch or maintenance cost outweighs the stated benefit. |
| EVO-23 | Make a separate migration decision from measured evidence: retain C17, migrate the core incrementally, or reject Rust for this product generation. | EVO-22 | The decision records toolchain provenance, security review, debugging workflow, build reproducibility, size, timing, staffing, and rollback plan. | No production cutover occurs without an explicit approved decision and a normal product release plan with a validated fallback. |

Rust portability applies to the scoring core and web simulation only. The ESP32 may remain ESP-IDF C because it is not a scoring target; a Rust ESP32 port requires a separate non-authoritative service decision and does not block this phase.

## Phase D: Open-source preparation with commercial hardware

**Entry:** can run after `EVO-01`; public release follows the code-complete baseline and only after the license and
product-security gates. It may precede hardware launch.

**Exit:** the approved software scope has a reproducible public source release, clear build and contribution instructions, a reviewed license, and no release of secrets or controlled manufacturing material.

| ID | Task | Depends on | Acceptance | Stop or rollback gate |
| --- | --- | --- | --- | --- |
| EVO-24 | Inventory source, generated artifacts, third-party dependencies, firmware blobs, test vectors, documentation, marks, secrets, signing/provisioning materials, and hardware/manufacturing files. | EVO-01 | Every item is classified as publishable, review-required, or excluded with an owner. | Do not infer that an internal file is publishable because it is source code. |
| EVO-25 | Choose the candidate public scope and repository boundary for software, simulator/player, test vectors, firmware sources, and hardware interfaces. | EVO-24 | The scope supports a reproducible software build without exposing keys, credentials, calibration secrets, factory bypasses, or unreviewed production data. | Stop if public artifacts depend on nonredistributable inputs or violate third-party terms. |
| EVO-26 | Complete license, dependency compatibility, contributor, patent/trademark, safety, export, privacy, vulnerability-disclosure, and commercial-hardware review; record the selected license or a reason to defer publication. | EVO-24, EVO-25 | Counsel, security, and product owners approve a written decision. | The exact license remains intentionally unset until this gate passes; do not add a placeholder license as a substitute. |
| EVO-27 | Create reproducible public build/test, responsible-disclosure, contribution, support-boundary, trademark, and hardware-purchase documentation. | EVO-25, EVO-26 | A clean external-style checkout builds the approved software and states that hardware is sold separately and certification claims are limited to evidence. | Pull or correct any claim that overstates support, approval, safety, or hardware availability. |
| EVO-28 | Publish a tagged source release and verify its artifact digests, provenance, issue routing, and correction/incident-response procedure. | EVO-17, EVO-27 | The published release reproduces the approved source artifacts and contains no secret, excluded material, or unreviewed security disclosure. | Pause publication on a discovered secret, license conflict, supply-chain issue, or misleading product claim. |

## Decision checkpoints

| Checkpoint | Required result | If not met |
| --- | --- | --- |
| Player checkpoint after EVO-06 | Deterministic, accessible RGB array projection of authoritative records | Keep the previous player and correct the projection contract. |
| OTA checkpoint after EVO-16 | Independent signed update and rollback for both processors under interruption | Do not launch OTA or ship a network-update promise. |
| Current-code checkpoint after EVO-17 | C17/ESP-IDF implementation is fully validated against the oracle | Finish defects on the current path; do not start a Rust rewrite. |
| Rust checkpoint after EVO-22 | Native, WASM, STM32, and C17 outputs are equivalent within declared resource budgets | Retain C17 and document the rejected or deferred migration. |
| Open-source checkpoint after EVO-28 | License and publication scope are reviewed and reproducible | Keep the project private until the specific blocker is resolved. |

## Non-goals

This roadmap does not select a display manufacturer, promise a web-to-device firmware-control workflow, introduce a cloud fleet platform, define a public license, replace hardware correlation with simulation, or claim regulatory/FIE approval. Those decisions require their own evidence and owners.
