# ESP32 scoring prototype backlog

## Prototype outcome

Build one accessible ESP32-S3 bench board that acquires all seven weapon
conductors, runs the portable C17 scoring core, and provides Ethernet, HUB75,
encrypted IR, USB service, and protected lamp/buzzer outputs.

This is a prototype critical path, not a production qualification plan. Work
that can only be completed after the prototype proves the architecture belongs
in the findings and production-transfer record, not as a pre-order blocker.

## Fixed design

- One `ESP32-S3-WROOM-1-N16R2` with integrated PCB antenna. No STM32,
  processor isolation, isolated link power, SWD, external antenna assembly,
  F-RAM, RTC, secure element, audio amplifier, or speculative expansion.
- USB-C PD at SPR 20 V, 3 A is the only normal populated input. No alternate
  input, source selector, battery, or permanent rail telemetry.
- The existing common-ground ADS8881/REF5025 acquisition concept is reduced to
  one approved channel and then repeated seven times.
- W5500 Ethernet, two reset-safe HUB75 buffers, TSOP38438 encrypted IR, native
  USB/UART recovery, and protected direct lamp/buzzer outputs remain required.
- Owner-validated OK Fencing cables terminate at six labeled plated-through
  weapon landings plus one separate piste landing. A custom socket is optional
  for P0; independent strain relief and probe access are required.
- The C17 scoring core remains target-neutral. ESP-IDF code is an adapter and
  cannot obtain scoring authority from network, display, persistence, or IR.

## Status rules

| Status | Meaning |
| --- | --- |
| `backlog` | Dependencies are complete and the task is ready. |
| `in-progress` | Root or one bounded work unit is actively delivering it. |
| `review` | A committed implementation is awaiting root disposition. |
| `blocked` | At least one task ID in `Dependencies` is incomplete. |
| `done` | Implementation, verification, root approval, and commit are complete. |

Root is the only reviewer and committer. Update `Status` and `Latest state`
immediately after every root review. A definition task may be done while later
physical evidence remains open; that evidence belongs in bring-up tasks.

## 1. Freeze the design

| ID | Status | Latest state | Deliverable | Dependencies | Done when |
| --- | --- | --- | --- | --- | --- |
| `BP-000` | done | Clean-sheet ESP32-only authority and root-only review are committed. | Maintain this compact critical-path backlog. | None | Task set, ownership, dependency rules, and root review authority validate. |
| `BP-020` | done | Executable P0 population baseline records selected, TBD, and DNP functions. | Maintain the prototype population baseline. | `BP-000` | Every populated function has quantity, package, source, and rationale; removed functions are absent or DNP. |
| `BP-040` | done | APP_GND, SCORING_SGND quiet region, shield/ESD return, USB, Ethernet, and high-current rules are committed. | Maintain the electrical rule classes. | `BP-000` | The clean-sheet rules contain no obsolete isolation corridor or processor nets. |
| `BP-050` | in-progress | USB-C/PD, eFuse, 5 V, and 3.3 V are exact. Display-branch work is delivered; the analog/reference rail budget and one reconciled total remain. | Freeze the complete minimal power tree. | `BP-020` | One exact diagram and BOM cover USB-C PD, protection, eFuse, 5 V, 3.3 V, display branch, analog rails, startup, peak, fault, thermal, and measurement links without double counting. |
| `BP-100` | backlog | The smallest retained candidate is REF5025, TMUX1112, TPD4E05U06, ADA4177-1, ADS8881, and a local TPS60400 negative rail. Existing arithmetic is screening evidence only. | Freeze the complete seven-line acquisition design. | `BP-020`, `BP-040` | One exact channel, reference/protection/rail network, ADS8881 timing interface, seven-channel named replication, support quantities, failure states, and characterization plan agree. |
| `BP-104` | in-progress | Seven landing/probe identities, piste separation, continuity/miswire procedure, optional socket boundary, and strain anchors are delivered. Exact mechanical geometry still needs measurement. | Freeze the weapon-cable board interface. | `BP-020` | Six weapon landings plus piste, labels, finished holes, pitch, probes, strain relief, and de-energized continuity procedure are exact enough to place. |
| `BP-108` | in-progress | Required lamp/buzzer semantics, FIE photometric bounds, default-off behavior, and unresolved electrical fields are delivered. Exact prototype loads are not yet selected. | Select and bound the prototype lamps, buzzer, driver, and connector. | `BP-020` | Exact loads, voltage/current/inrush, driver/protection, six-conductor connector, cable, open/short/reverse response, reset default, and thermal screen agree. |
| `BP-120` | in-progress | Root verified Espressif lists `ESP32-S3-WROOM-1-N16R2`: 16 MB Quad-SPI flash, 2 MB Quad-SPI PSRAM, integrated antenna, and 18 x 25.5 x 3.1 mm body. Canonical contract/BOM reconciliation is delivered for review. | Freeze ESP32 module, pins, support, reset, and recovery. | `BP-020` | Exact module, RF keepout, every pad owner, bypass, EN/BOOT, watchdog/reset, native USB, UART recovery, and unused-pad policy agree. |
| `BP-126` | in-progress | GPIO35 RMT_RX, TSOP38438 polarity/carrier, bounded edge and queue rules, authenticated handoff, replay/flood failures, and no-hit authority are delivered for root review. | Freeze encrypted-IR hardware and adapter contract. | `BP-020` | Receiver/filter/protection/test point, optical placement, GPIO/RMT bounds, reset/flood behavior, and authenticated no-hit-authority handoff agree. |
| `BP-140` | done | Exact W5500, support network, MagJack MDI/polarity, LEDs, and shield boundary are committed. | Maintain the Ethernet contract. | `BP-020`, `BP-040` | Controller, support, MagJack, shield/ESD return, reset, interrupt/polling, and routing constraints stay exact. |
| `BP-143` | done | Exact HUB75 panel, signal/power cables, board connectors, and pin map are committed. | Maintain the HUB75 contract. | `BP-020` | Panel power, 13 signals, two reset-safe buffers, blanking default, connectors, and measurement plan stay exact. |

## 2. Draw one schematic

| ID | Status | Latest state | Deliverable | Dependencies | Done when |
| --- | --- | --- | --- | --- | --- |
| `BP-320` | done | Commit `b52c72f` replaces the obsolete 738-line dual-MCU model with the canonical empty board, hierarchy, global nets, provisional outline, and four mounting holes. Root review, 56 focused tests, package types, lint, build, and desktop/mobile browser checks pass. | Maintain one canonical clean-sheet circuit source. | `BP-000`, `BP-040` | Source, title/revision, hierarchy, global nets, provisional outline, and no-obsolete-circuit test are committed. |
| `BP-321` | blocked | Waiting on the complete minimal power contract. | Draw the USB-C PD and all power rails. | `BP-050`, `BP-320` | USB-C, protection, PD, eFuse, 5 V, 3.3 V, display/analog branches, links, probes, and returns pass ERC. |
| `BP-323` | blocked | Digital interface contracts are partly complete; ESP32 support and primary outputs remain. | Draw ESP32 and every digital peripheral/interface. | `BP-108`, `BP-120`, `BP-126`, `BP-140`, `BP-143`, `BP-320` | ESP32/reset/recovery, W5500, IR, HUB75, outputs, USB data, and default-safe enables pass ERC with no obsolete MCU nets. |
| `BP-328` | blocked | Waiting on final acquisition and weapon geometry. | Draw analog rails, reference, seven acquisition channels, and weapon landings. | `BP-100`, `BP-104`, `BP-320` | Named rails, channels, ADC order, clamps, returns, landings, probes, and strain features pass ERC with no hidden swaps. |
| `BP-333` | blocked | Waiting on all three electrical sheets. | Integrate, reconcile BOM/footprints, clear ERC, and conduct root schematic review. | `BP-020`, `BP-321`, `BP-323`, `BP-328` | Zero unexplained ERC errors or populated TBDs; references, quantities, MPNs, packages, footprints, DNPs, and findings agree. |

`BP-030` is committed footprint-method evidence consumed by `BP-333`; it is
not a separate active delivery task.

## 3. Make the PCB and order it

| ID | Status | Latest state | Deliverable | Dependencies | Done when |
| --- | --- | --- | --- | --- | --- |
| `BP-420` | blocked | Waiting on the reviewed schematic. | Freeze outline/stack-up and place the complete board. | `BP-333` | Board edges, mounting, ESP32 antenna, connectors, IR view, weapon strain relief, power/thermal loops, analog quiet region, returns, and probe access are dimensioned and reviewed. |
| `BP-426` | blocked | Waiting on placement. | Route USB-C PD, converters, display power, planes, and high-current returns. | `BP-420` | Data-sheet critical loops, current capacity, thermal copper/vias, Kelvin/sense paths, shield/ESD return, and measurement links pass review. |
| `BP-427` | blocked | Waiting on placement. | Route reference, analog rails, seven channels, and ADC timing signals. | `BP-420` | Quiet returns, guarding, symmetry, reference loops, CONVST/SPI timing, and crosstalk constraints pass review. |
| `BP-430` | blocked | Waiting on placement. | Route ESP32, USB2, Ethernet, HUB75, IR, outputs, and recovery access. | `BP-420` | RF keepout, USB/MDI pairs, clocks, default-safe controls, optical input, external outputs, labels, and test access pass review. |
| `BP-432` | blocked | Critical routing is incomplete. | Finish the board and run DRC/connectivity/manufacturability checks. | `BP-426`, `BP-427`, `BP-430` | Zero unexplained DRC or unrouted errors; connectivity, impedance, voltage-drop, thermal, silkscreen, and assembly checks pass. |
| `BP-434` | blocked | Waiting on a clean routed board. | Generate, review, and order one prototype revision. | `BP-432` | Gerber/drill or ODB++, IPC-356, BOM, centroid, drawings, stack-up, renders, digests, supplier acknowledgements, and root prototype-order approval agree. |

## 4. Build only the firmware needed for P0

| ID | Status | Latest state | Deliverable | Dependencies | Done when |
| --- | --- | --- | --- | --- | --- |
| `BP-521` | done | Commit `651ff68` adds the target-neutral C HAL for explicit microsecond time, seven-channel ADC observations, safe-inactive outputs, IR edges, and opaque bounded Ethernet. Root CMake/CTest passes 4 of 4; the native coverage gate passes with HAL at 100 percent lines/functions and 89.77 percent branches and the scoring core at 100 percent line/function/branch. | Freeze the ESP32 adapter boundary. | `BP-000` | C interfaces contain no ESP-IDF, wall clock, display, network-policy, remote-command, or scoring-rule dependency and meet coverage gates. |
| `BP-522` | blocked | Waiting on acquisition and HAL contracts. | Implement ADS8881 acquisition and integrate the portable C17 core. | `BP-100`, `BP-120`, `BP-521` | Ordered seven-channel scans, monotonic timestamps, bounded queues, fail-unavailable behavior, and native/ESP/WASM decision parity pass. |
| `BP-524` | blocked | Waiting on output and ESP32 contracts. | Implement watchdog health and reset-safe lamp/buzzer output adapter. | `BP-108`, `BP-120`, `BP-521` | Only fresh acquisition/core/output health services the watchdog; startup/reset/fault outputs stay inactive and observable. |
| `BP-526` | blocked | Waiting on ESP32 and peripheral contracts. | Implement Ethernet, HUB75, encrypted IR, USB diagnostics, and recovery adapters. | `BP-120`, `BP-126`, `BP-140`, `BP-143`, `BP-521` | Peripheral loss, malformed/flood traffic, rendering, recovery, or remote input cannot block or alter scoring authority. |
| `BP-532` | blocked | Waiting on implemented adapters. | Run deterministic integration, fault, coverage, and artifact gates. | `BP-522`, `BP-524`, `BP-526` | Loaded traffic/display/IR/USB/reset tests pass; scoring core remains 100 percent line/function/branch coverage and other first-party C/C++ remains at least 80 percent. |

## 5. Bring up and prove the prototype

| ID | Status | Latest state | Deliverable | Dependencies | Done when |
| --- | --- | --- | --- | --- | --- |
| `BP-623` | blocked | No clean-sheet board has been ordered. | Receive, inspect, check unpowered, and bring up power/ESP32 safely. | `BP-434`, `BP-532` | As-built record, continuity/isolation, apply-power permit, PD/eFuse/rails, reset/watchdog, USB/UART recovery, temperature, ripple, backfeed, and default-off captures pass. |
| `BP-625` | blocked | Waiting on stable power and processor. | Bring up Ethernet, HUB75, encrypted IR, and primary outputs. | `BP-623` | Link/fault recovery, display blanking/current, IR range/flood/auth/replay, and output normal/fault load evidence pass. |
| `BP-628` | blocked | Waiting on stable power and the acquisition fixture. | Characterize one channel, then all seven weapon channels. | `BP-623` | Resistance/capacitance/temperature matrix, settling, leakage, overload/recovery, order, crosstalk, simultaneous events, grounds, shorts, opens, and unavailable states pass. |
| `BP-631` | blocked | Waiting on peripheral and analog bring-up. | Run integrated foil/epee/sabre parity, stress, recovery, and thermal tests. | `BP-625`, `BP-628` | Native/ESP/WASM corpus, remote workflows, 50 C thermal, resets, Ethernet, display, IR, queues, outputs, and fault stress pass or produce bounded findings. |
| `BP-633` | blocked | Waiting on integrated evidence. | Close prototype findings and issue the production-transfer record. | `BP-631` | As-tested hardware/firmware digests, evidence index, accepted limitations, architecture recommendation, and explicit production/certification work are recorded. |

## Critical path

```text
definitions: BP-050 + BP-100 + BP-104 + BP-108 + BP-120 + BP-126
schematic:   BP-320 -> BP-321/BP-323/BP-328 -> BP-333
PCB:         BP-333 -> BP-420 -> BP-426/BP-427/BP-430 -> BP-432 -> BP-434
firmware:    BP-521 -> BP-522/BP-524/BP-526 -> BP-532
bring-up:    BP-434 + BP-532 -> BP-623 -> BP-625/BP-628 -> BP-631 -> BP-633
```

`BP-434` grants prototype-order authority only. `BP-623` grants bounded
apply-power authority inside its procedure. `BP-633` completes the prototype,
not production release, enclosure qualification, certification, or FIE
homologation.

The prior 104-row decomposition is retired. Its documents and tests remain
usable evidence, but its former micro-tasks are checklists inside the 32 active
deliverables above and no longer create separate blockers.
