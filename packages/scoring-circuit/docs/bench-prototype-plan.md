# Clean-sheet ESP32 scoring prototype backlog

## Decision

The canonical P0 hardware is a new ESP32-S3-only bench board. Do not continue
subtracting circuitry from the former STM32/ESP32 design. Git history retains
that design as evidence, but the canonical schematic and PCB are replaced in
place.

P0 is an accessible engineering board, not a production-form-factor preview.
It must acquire all seven weapon conductors, run the portable C17 scoring core,
provide Ethernet, HUB75 display, encrypted IR control, USB service, protected
primary outputs, and expose useful test access. It remains denied for
fabrication until `BP-434` passes.

## Fixed P0 boundary

- One ESP32-S3 module runs target adapters and the portable C17 core. The core
  remains isolated in software from ESP-IDF, network, display, persistence,
  and remote-control code so a later dedicated scoring MCU does not require a
  rules rewrite.
- Normal power is USB-C PD at SPR 20 V, 3 A. No alternate input connector,
  source selector, battery, permanent rail telemetry, or full-rail shunt is
  populated.
- Wired networking uses W5500 and the Würth `7499011121A` MagJack.
- Display output uses two `SN74AHCT245PWR` buffers and the selected Adafruit
  2277 HUB75 panel interface.
- Encrypted IR uses `TSOP38438`; a remote command can request workflow changes
  but can never fabricate or reclassify an electrical hit.
- Weapon cables are owner-validated OK Fencing-compatible cables. P0 provides
  three labeled plated-through wire landings per side, six total, plus a
  separate piste/ground landing and independent strain relief, or an exact
  board connector only if a suitable part is selected.
- Recovery uses native USB and labeled UART0, BOOT, EN/reset, 3.3 V, and ground
  pads. No populated STM32 SWD or generic service header is required.
- STM32, processor isolation, isolated link power, F-RAM, RTC, secure element,
  audio, speaker, external antenna assembly, serialized output latch, and
  speculative expansion are absent or explicit DNP.

The current `ESP32-S3-WROOM-1U-N16R2` record conflicts with the no-external-
antenna rule. `BP-120` must select and reconcile an integrated-antenna module
before the clean-sheet processor schematic is drawn.

## Status rules

| Status | Meaning |
| --- | --- |
| `backlog` | Dependencies are complete; the task is ready but not active. |
| `in-progress` | Root or a named bounded work unit is actively producing the deliverable. |
| `review` | A committed implementation exists and is awaiting root acceptance or a recorded revision. |
| `blocked` | One or more task IDs in `Dependencies` are incomplete. Physical evidence is not called a blocker until the board needed to obtain it has been ordered. |
| `done` | Implementation, appropriate verification, root review, and commit are complete. |
| `superseded` | Historical work was intentionally replaced and grants no P0 completion credit. |

Root is always the reviewer and committer. Every root review must immediately
update `Status` and `Latest state`. A task may preserve a downstream `DENY`
and still be done when its acceptance is only a contract, selection, or test
protocol. Post-order measurements belong in `BP-620` through `BP-633` and do
not keep pre-order definition tasks open.

## Priority order

1. Close exact selections and electrical contracts (`BP-050` through
   `BP-149`).
2. Draw and review the new schematic (`BP-320` through `BP-335`).
3. Place, route, verify, and release the PCB (`BP-420` through `BP-435`).
4. Build the board support and test firmware in parallel where interfaces are
   frozen (`BP-520` through `BP-533`).
5. Assemble and execute physical evidence (`BP-620` through `BP-633`).

## Superseded task mapping

The former broad task IDs are not reused with different meanings. Their
evidence remains in Git and is consumed by the clean-sheet units below:

- `BP-031` through `BP-035` map to footprint/BOM convergence in `BP-111`,
  `BP-148`, and `BP-149`;
- `BP-300` through `BP-303` map to the granular schematic units `BP-320`
  through `BP-335`;
- `BP-400` through `BP-403` map to physical implementation `BP-420` through
  `BP-435`; and
- `BP-500` through `BP-511` map to firmware and physical-evidence units
  `BP-520` through `BP-533` and `BP-620` through `BP-633`.

Those historical IDs grant no completion credit to their replacements.

## Reusable foundation

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-000` | done | Canonical plan ownership and root-only review authority are recorded. | Maintain the clean-sheet plan and decision authority. | None | Approved plan/decision artifact and task-set validator. |
| `BP-010` | blocked | The obsolete dual-domain zone drawing is rejected; the replacement waits on module, analog, power, and connector envelopes. | Freeze the board envelope and dimensioned functional zones. | `BP-057`, `BP-110`, `BP-120`, `BP-149` | Board-edge connectors, RF keepout, IR view, analog quiet region, high-current return, probe access, mounting, and strain relief are dimensioned. |
| `BP-020` | done | ESP32-only baseline records selected, TBD, and DNP functions; four exact selections remain in their dedicated tasks. | Maintain the executable P0 population baseline. | `BP-000` | Every required function is selected, TBD, or DNP with quantity, package, source, and rationale. |
| `BP-030` | done | Exact-MPN footprint evidence method and fail-closed validator are committed. | Maintain the footprint-evidence method. | `BP-020` | Drawing/CAD, digest, artwork, orientation, reviewer, and disposition fields fail closed. |
| `BP-040` | done | ESP32-only net classes use APP_GND plus a controlled SCORING_SGND quiet region and explicit high-current, shield, USB, and Ethernet rules. | Maintain net-class and return-path rules. | `BP-000` | Reviewed net classes contain no isolation corridor or superseded processor nets. |

## Power selections and contracts

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-050` | in-progress | USB-C/PD, eFuse, V5, and application 3.3 V contracts are now exact. BP-055 display protection, BP-056 analog/reference loads, and BP-057 end-to-end reconciliation remain active work. | Converge the complete P0 power tree. | `BP-020` | `BP-051` through `BP-057` are done and one exact power-tree diagram is approved. |
| `BP-051` | done | Exact TPS25730A straps, protected-CC capacitors, USB data protection, and matched 22 Ohm pair are committed and tested. | Freeze USB-C receptacle, PD negotiation, CC/SBU, and USB2 support. | `BP-020` | Exact MPN/value/pin network requests only 20 V/3 A and raw 5 V cannot energize apparatus rails. |
| `BP-052` | done | Commit `d5f7b1d` freezes eight exact populated TPS259474A support rows: local input bypass, UVLO/OVLO dividers, ILM, ITIMER, and DVDT. PG/PGTH indication and duplicate output bulk are DNP. Root review, 35 focused tests, package types, lint, and format pass. | Freeze the minimal TPS259474A eFuse network. | `BP-051` | Exact input bypass, voltage window, current limit, inrush, blanking, reverse/fault behavior, and DNP indication parts. |
| `BP-053` | done | Commit `d5f7b1d` freezes twelve populated TPS56A37 support rows. The redundant EN divider, external SS capacitor, PG pull-up/test point, telemetry monitor, and shunt are DNP; the TI EVM feed-forward pair is retained for the HUB75 step load. Root review, 35 focused tests, package types, lint, and format pass. | Freeze the minimal TPS56A37 20 V-to-5 V implementation. | `BP-052` | Exact U/L/C/R population, effective-capacitance assumptions, layout rules, and explicit optional-part dispositions. |
| `BP-054` | done | LMR43620 application rail and all ten physical support references are committed. | Freeze the 5 V-to-3.3 V ESP32/AFE rail. | `BP-020` | Exact regulator/support BOM and separate ESP32/AFE measurement access. |
| `BP-055` | backlog | Selected panel and branch limiter exist; the disconnect, fuse/current limit, and removable-link implementation must be made exact. | Freeze the protected HUB75 5 V branch. | `BP-020` | Exact limiter/fuse, connector, disconnect, removable measurement link, current envelope, and safe-off state. |
| `BP-056` | backlog | Common-ground AFE direction is approved; its positive/negative/reference rail loads are not yet complete. | Close AFE and reference rail budgets. | `BP-020` | Worst-case startup, continuous, transient, fault, and conversion-loss allocation for every analog/reference rail. |
| `BP-057` | blocked | Waiting on the eFuse, 5 V, display, and analog sub-budgets. | Reconcile the end-to-end power and thermal budget. | `BP-052`, `BP-053`, `BP-054`, `BP-055`, `BP-056` | USB-PD, eFuse, converters, display, ESP32, Ethernet, outputs, AFE, cable drop, and thermal screens close without double counting. |

## Analog, weapon, and primary-output definition

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-100` | backlog | Existing AFE studies remain evidence, but the clean-sheet common-ground topology needs one concise approved circuit. | Freeze one-channel measurement topology. | `BP-020` | Exact excitation, clamp, buffer, ADC, return, ranges, settling, leakage, and fault-current budget. |
| `BP-101` | backlog | REF5025 is selected; its complete input/output/dynamic-load network is not closed. | Freeze the reference drive and distribution network. | `BP-020` | Exact capacitors, ESR, load, routing, startup, fault, and acquisition-settling evidence. |
| `BP-102` | backlog | Paper protection evidence exists; clean-sheet unpowered, overload, and recovery behavior must be reconciled. | Freeze weapon-line input and unpowered protection. | `BP-020` | Exact clamps, resistors, energy limits, leakage, back-power prevention, and fault truth table. |
| `BP-103` | blocked | ADC timing model exists but depends on the final topology and reference drive. | Freeze ADS8881 conversion, CONVST, SPI/GDMA, and sample-order interface. | `BP-100`, `BP-101`, `BP-102` | Seven-device bit count, cadence, timestamp bound, queue bound, overrun behavior, and exact pins. |
| `BP-104` | backlog | Owner-validated cables are not a blocker; P0 requires only board landings/sockets and mechanical strain relief. | Freeze the OK Fencing weapon-board interface. | `BP-020` | Three labeled plated-through landings per side, one separate piste/ground landing, line map, spacing, probe access, strain anchor, continuity procedure, and optional exact socket disposition. |
| `BP-105` | blocked | Fixture implementation waits on the final line interface and topology. | Freeze the guarded analog test fixture. | `BP-100`, `BP-102`, `BP-104`, `BP-106` | Physically incompatible normal/fault connections, standards, interlock, calibration, and evidence schema. |
| `BP-106` | done | Analog test matrix, temperatures, resistance/capacitance points, instruments, and evidence schema are committed. | Maintain the analog characterization matrix. | `BP-020` | Focused validator and test matrix remain aligned with the final topology. |
| `BP-107` | blocked | V5_ANALOG and the retained negative rail require the incomplete analog rail budget. | Freeze analog positive/negative rail generation and filtering. | `BP-056` | Exact TPS60400/support/filter network, load margin, ripple, startup, and fault behavior. |
| `BP-108` | backlog | Lamp/buzzer electrical requirements are not yet bounded. | Define primary lamp and buzzer electrical loads. | `BP-020` | Voltage, steady/inrush current, cable, inductive behavior, open/short/reverse, EMC, thermal, and default-off requirements. |
| `BP-109` | blocked | Driver choice waits on the load envelope. | Select the hardware-safe primary-output driver. | `BP-108` | Exact driver/protection/support MPNs and truth table prove reset/unpowered/default-off behavior independent of firmware. |
| `BP-110` | blocked | Seven-channel replication waits on the one-channel, reference, protection, acquisition, and analog-rail contracts. | Freeze the named seven-channel analog net map. | `BP-100`, `BP-101`, `BP-102`, `BP-103`, `BP-107` | Every channel/reference/enable/data net is explicit; no generic repeated block can hide swaps. |
| `BP-111` | blocked | Analog footprint closure waits on the final active reference set. | Close analog, reference, protection, and weapon footprints. | `BP-030`, `BP-104`, `BP-107`, `BP-110` | Every populated analog/weapon reference has approved manufacturer evidence and artwork. |

## ESP32, recovery, and application interfaces

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-120` | backlog | WROOM-1U without an antenna is invalid for the stated P0 boundary. | Select the exact integrated-antenna ESP32-S3 module. | `BP-020` | Exact orderable module, flash/PSRAM, RF keepout, lifecycle, power, package, and migration record replace every 1U assumption. |
| `BP-121` | blocked | Existing GPIO work is reusable but must be regenerated for the selected module and final peripherals. | Freeze the complete ESP32 pad/peripheral allocation. | `BP-103`, `BP-109`, `BP-120`, `BP-126`, `BP-143` | Every module pad has one owner; ADC, W5500, HUB75, IR, USB, UART, reset, watchdog, and outputs have no collision. |
| `BP-122` | superseded | Processor-to-processor isolation is not populated on P0. | Historical dual-MCU isolation contract. | None | No P0 acceptance credit. |
| `BP-123` | blocked | Single-supervisor/watchdog contract exists but must bind the final ESP32 and output-enable nets. | Freeze reset, brownout, watchdog, and safe-enable network. | `BP-109`, `BP-120`, `BP-121` | Exact network and truth table cover cold start, brownout, watchdog, manual reset, and power-off/backfeed. |
| `BP-124` | blocked | Populated service headers were removed; final pads depend on the module pin map. | Freeze native USB, UART0, BOOT, and reset recovery access. | `BP-120`, `BP-121`, `BP-123` | Exact pad map, levels, mating fixture, recovery procedure, labels, and no powered-header ambiguity. |
| `BP-125` | blocked | Processor checklist has been simplified but still names the obsolete 1U module. | Reconcile the complete ESP32 support network. | `BP-120`, `BP-121`, `BP-123`, `BP-124` | Exact local bypass, EN/BOOT, RF keepout, unused pads, USB, recovery, and schematic sign-off. |
| `BP-126` | backlog | TSOP38438/RMT direction is selected; queue and authority boundary remain to be frozen. | Freeze the encrypted-IR hardware/firmware interface. | `BP-020` | Exact RMT input, reset/default behavior, bounded queue, authentication handoff, replay failure, and no electrical-hit authority. |
| `BP-127` | blocked | Paper timing shows 126 serial bits and an 8.01 us scan, but loaded falsification remains. | Prove ESP32-only acquisition feasibility. | `BP-057`, `BP-103`, `BP-121`, `BP-123` | One-cell and seven-channel tests under Ethernet, HUB75, IR, USB, radio, flash/cache, reset, and queue stress fail unavailable. |
| `BP-128` | blocked | Direct GPIO outputs are planned; final pins and driver are incomplete. | Freeze direct output GPIO and hardware-permit ownership. | `BP-109`, `BP-121`, `BP-123` | Five outputs, permit/reset gating, inactive levels, startup order, and fault states are exact. |
| `BP-140` | done | Exact W5500 and 17-part support network are committed. | Maintain the W5500 support network. | `BP-020` | Exact controller, crystal, analog supply, bypass, reset, interrupt/polling, and support rows. |
| `BP-141` | done | W5500-to-MagJack MDI, polarity, 100 Ohm route plan, LEDs, and shield boundary are committed. | Maintain Ethernet MDI and shield wiring. | `BP-140` | Pin-by-pin map and shield/ESD-return rule remain exact. |
| `BP-142` | done | Exact LMR43620 3.3 V implementation and ten physical BOM rows are committed; physical load evidence moved to BP-623/BP-631. | Maintain the application 3.3 V contract. | `BP-054` | Exact schematic inputs and calculation remain verified. |
| `BP-143` | done | Panel, signal/power cables, board connector identities, pin map, and physical-evidence protocol are committed. | Maintain HUB75 panel and mating selections. | `BP-020` | Exact selected identities and received-part protocol remain verified. |
| `BP-144` | blocked | ESP32-only two-buffer safing contract is implemented and tested, but final reset ownership depends on BP-123. | Freeze reset-safe HUB75 signal path. | `BP-123`, `BP-143` | All 13 signals, defaults, bypass, shared enable gate, and black/high-impedance truth table. |
| `BP-145` | blocked | Zero-option peripheral population is implemented, but the module correction in BP-120 must be reconciled before closure. | Freeze the intentionally minimal peripheral population. | `BP-120`, `BP-142` | F-RAM, RTC, secure element, audio, speaker, external antenna assembly, and expansion remain DNP. |
| `BP-146` | blocked | Receiver MPN/filter/optical targets are reusable but must bind the final GPIO, rail, and queue contract. | Freeze the complete TSOP38438 receive path. | `BP-121`, `BP-126`, `BP-142`, `BP-145` | Exact receiver/filter/protection/test point, optical window, current, latency, range, angle, flood, and fault targets. |
| `BP-147` | blocked | Connector selection waits on the primary-output load definition. | Select the lamp/buzzer connector and cable pinout. | `BP-108` | Exact connector/mate/terminals, five outputs plus return, current rating, keying, strain relief, and continuity plan. |
| `BP-148` | blocked | Footprints wait on the complete active processor/application set. | Close ESP32, reset, recovery, output, Ethernet, HUB75, and IR footprints. | `BP-030`, `BP-125`, `BP-128`, `BP-141`, `BP-143`, `BP-146`, `BP-147` | Every populated non-analog reference has approved evidence/artwork and every removed option is absent or DNP. |
| `BP-149` | blocked | Final order-candidate population waits on analog and application footprint closure. | Converge the clean-sheet candidate BOM. | `BP-057`, `BP-111`, `BP-148` | Zero populated TBDs; exact references, quantities, MPNs, packages, sources, footprints, and DNPs agree. |

## Clean-sheet schematic

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-320` | backlog | Clean-sheet replacement is approved; no new canonical source exists yet. | Create the new canonical schematic project and sheet hierarchy. | `BP-000`, `BP-040` | One canonical source, title/revision, global nets, rule classes, and no imported obsolete circuitry. |
| `BP-321` | blocked | Waiting on the final USB-C/eFuse contract. | Draw USB-C, protection, PD, and eFuse sheet. | `BP-051`, `BP-052`, `BP-320` | Exact pins, straps, capacitors, protection, voltage window, and test access pass ERC. |
| `BP-322` | blocked | Waiting on final V5 and branch power contracts. | Draw V5, 3.3 V, display, and branch-measurement sheet. | `BP-053`, `BP-054`, `BP-055`, `BP-057`, `BP-320` | Exact converters, rails, links, fuses, disconnects, and no telemetry/alternate input pass ERC. |
| `BP-323` | blocked | Waiting on processor/reset/recovery contracts. | Draw ESP32, support, reset/watchdog, and recovery sheet. | `BP-123`, `BP-124`, `BP-125`, `BP-128`, `BP-320` | Exact module/pads/support/safe enables pass ERC with no obsolete MCU nets. |
| `BP-324` | blocked | W5500 contracts are done; sheet waits on the project scaffold. | Draw W5500, MagJack, shield, and Ethernet support sheet. | `BP-140`, `BP-141`, `BP-320` | Exact support, MDI polarity, LEDs, reset, and shield nets pass ERC. |
| `BP-325` | blocked | Waiting on the complete receiver contract. | Draw encrypted-IR receiver sheet. | `BP-146`, `BP-320` | Exact filter, protection, RMT net, test point, and optical placement attributes pass ERC. |
| `BP-326` | blocked | Waiting on HUB75 safing acceptance. | Draw HUB75 signal and panel-power interface sheet. | `BP-055`, `BP-143`, `BP-144`, `BP-320` | Thirteen buffered signals, blanking defaults, connectors, and protected power pass ERC. |
| `BP-327` | blocked | Waiting on driver and connector selections. | Draw primary lamp/buzzer output sheet. | `BP-109`, `BP-128`, `BP-147`, `BP-320` | Five protected outputs, shared return, permit/reset gate, and connector pass ERC. |
| `BP-328` | blocked | Waiting on reference and analog rail contracts. | Draw reference and analog-rail sheet. | `BP-101`, `BP-107`, `BP-320` | Exact reference, bipolar/positive rails, filters, returns, and test access pass ERC. |
| `BP-329` | blocked | Waiting on the one-channel measurement and protection contracts. | Draw one complete weapon acquisition channel. | `BP-100`, `BP-102`, `BP-103`, `BP-328` | Named input, clamps, buffer, ADC, enable, reference, return, and probe nets pass ERC. |
| `BP-330` | blocked | Waiting on the seven-channel map and approved one-channel sheet. | Replicate and explicitly name all seven acquisition channels. | `BP-110`, `BP-329` | Channel-by-channel review proves no pin, protection, reference, or ADC-order swaps. |
| `BP-331` | blocked | Waiting on the weapon landing definition. | Draw weapon wire landings, probes, and strain-relief features. | `BP-104`, `BP-320` | Both sides have exact labels, pin map, spacing, continuity access, and mechanical anchors. |
| `BP-332` | blocked | Individual sheets are incomplete. | Add global test points, removable links, labels, and cross-sheet interfaces. | `BP-321`, `BP-322`, `BP-323`, `BP-324`, `BP-325`, `BP-326`, `BP-327`, `BP-330`, `BP-331` | Probe map covers every critical rail, reset, timing, analog, output, IR, Ethernet, USB, and display state. |
| `BP-333` | blocked | Waiting on complete sheet integration. | Clear schematic ERC and intentional-waiver log. | `BP-332` | Zero unexplained ERC errors; every waiver has a named reason and owner. |
| `BP-334` | blocked | Waiting on ERC-clean schematic and candidate BOM. | Reconcile schematic references against the candidate BOM. | `BP-149`, `BP-333` | Exact one-to-one reference, quantity, MPN, package, population, and footprint match. |
| `BP-335` | blocked | Waiting on an ERC-clean, BOM-reconciled schematic. | Conduct root mixed-signal, power, and fault-containment review. | `BP-334` | Findings log is closed and root approves the schematic for PCB implementation only. |

## PCB placement, routing, and order release

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-420` | blocked | Waiting on the zone drawing and approved schematic. | Freeze outline, stack-up, mounting, and fabrication rules. | `BP-010`, `BP-335` | Dimensioned outline, stack-up, impedance, copper/clearance, mounting, and edge rules. |
| `BP-421` | blocked | Waiting on the physical rules. | Place board-edge connectors, weapon landings, IR window, and strain relief. | `BP-420` | Mechanical clearances, mating access, RF/IR access, and cable loads are reviewed. |
| `BP-422` | blocked | Waiting on connector placement. | Place USB-C PD, eFuse, V5, 3.3 V, and display-power stages. | `BP-421` | High-current loops, thermal copper, branch links, disconnect, and probe access match data-sheet guidance. |
| `BP-423` | blocked | Waiting on connector and power placement. | Place reference, analog rails, and seven acquisition channels. | `BP-421`, `BP-422` | Symmetry, quiet return, guard/spacing, replaceability, and probe clearance are reviewed. |
| `BP-424` | blocked | Waiting on analog/power placement. | Place ESP32, reset/recovery, W5500, HUB75, IR, and outputs. | `BP-422`, `BP-423` | Module RF keepout, clocks, reset, interfaces, thermal paths, and test access are reviewed. |
| `BP-425` | blocked | Waiting on complete placement. | Review planes, return paths, partitions, and copper-current capacity. | `BP-424` | APP_GND, SCORING_SGND connection, shield/ESD return, display return, and high-current widths are approved. |
| `BP-426` | blocked | Waiting on placement/return review. | Route USB-C PD, eFuse, converters, and high-current display power. | `BP-425` | Data-sheet critical loops, Kelvin/sense routes, thermal vias, and branch returns pass review. |
| `BP-427` | blocked | Waiting on placement/return review. | Route reference, analog rails, acquisition channels, and ADC timing. | `BP-425` | Guarding, symmetry, quiet returns, CONVST/SPI timing, and crosstalk constraints pass review. |
| `BP-428` | blocked | Waiting on placement/return review. | Route native USB2 and recovery signals. | `BP-425` | Controlled USB pair, matched series parts, ESD placement, UART/BOOT/reset access, and no stubs. |
| `BP-429` | blocked | Waiting on placement/return review. | Route W5500 clock, SPI, MDI pairs, LEDs, and shield return. | `BP-425` | MDI impedance/polarity, crystal loop, SPI, shield/ESD, and MagJack placement pass review. |
| `BP-430` | blocked | Waiting on placement/return review. | Route HUB75, encrypted IR, primary outputs, and remaining low-speed nets. | `BP-425` | Default-safe controls, optical input, output fault separation, and panel interfaces pass review. |
| `BP-431` | blocked | Critical routing is incomplete. | Finish remaining nets, test access, silkscreen, and assembly markings. | `BP-426`, `BP-427`, `BP-428`, `BP-429`, `BP-430` | Zero unrouted nets; polarity, pin 1, DNP, voltage, warning, and connector labels are legible. |
| `BP-432` | blocked | Waiting on the fully routed board. | Run DRC, connectivity, SI/PI, thermal, and manufacturability checks. | `BP-431` | Zero unexplained DRC/unrouted errors; reviewed impedance, voltage drop, thermal, and assembly reports. |
| `BP-433` | blocked | Waiting on clean board checks. | Generate one revision-bound fabrication and assembly package. | `BP-432` | Gerber/drill or ODB++, IPC-356, BOM, centroid, drawings, stack-up, renders, and digests agree. |
| `BP-434` | blocked | Waiting on complete release artifacts. | Conduct independent prototype-only pre-order review. | `BP-433` | Root closes findings and explicitly grants prototype-order authority while excluding production authority. |
| `BP-435` | blocked | Waiting on prototype-only release. | Order boards and components and record supplier revisions. | `BP-434` | Purchase package, quantities, substitutions, supplier acknowledgements, and immutable release digest are archived. |

## Firmware and pre-order test assets

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-520` | blocked | Waiting on final pad ownership. | Create ESP-IDF board definition and generated pin ownership table. | `BP-121` | Build-time collisions fail; schematic/pin-table digest binds the hardware revision. |
| `BP-521` | backlog | Portable C17 core already has native/WASM targets; the ESP-IDF boundary must remain adapter-only. | Define target-neutral HAL interfaces for time, acquisition, outputs, persistence, and diagnostics. | `BP-000` | C interfaces contain no ESP-IDF, wall-clock, network, display, or remote-control scoring authority. |
| `BP-522` | blocked | Waiting on ADC and board definitions. | Implement ADS8881 CONVST/SPI/GDMA acquisition HAL. | `BP-103`, `BP-520`, `BP-521` | Ordered scans, monotonic timestamps, bounded queues, overrun/unavailable states, and unit tests. |
| `BP-523` | blocked | Waiting on the HAL boundary and acquisition. | Integrate the portable C17 core on ESP32. | `BP-521`, `BP-522` | Native, ESP32-host, and WASM vectors produce byte-identical canonical decisions. |
| `BP-524` | blocked | Waiting on reset/output ownership. | Implement watchdog health aggregation and reset-safe output permit. | `BP-123`, `BP-128`, `BP-520` | Only fresh acquisition/core/reference/output health services watchdog; stale states de-energize outputs. |
| `BP-525` | blocked | Waiting on output hardware and board definition. | Implement primary lamp/buzzer HAL. | `BP-128`, `BP-520`, `BP-524` | Startup/reset/fault states remain off and requested outputs are bounded and observable. |
| `BP-526` | blocked | Waiting on board definition. | Implement W5500 Ethernet HAL and fault recovery. | `BP-140`, `BP-141`, `BP-520` | Link loss, malformed traffic, congestion, and reset cannot affect acquisition/scoring authority. |
| `BP-527` | blocked | Waiting on HUB75 contract and board definition. | Implement HUB75 renderer and hardware blanking control. | `BP-144`, `BP-520`, `BP-524` | Reset/brownout/absence stays blank; rendering cannot block or alter scoring. |
| `BP-528` | blocked | Waiting on IR hardware/interface contracts. | Implement TSOP38438 RMT capture and encrypted-remote handoff. | `BP-126`, `BP-146`, `BP-520` | Authentication, replay, queue, latency, flood, reset, and command-authority tests pass. |
| `BP-529` | blocked | Waiting on board definition and recovery contract. | Implement native USB diagnostics and UART/BOOT recovery. | `BP-124`, `BP-520` | Recovery works with scoring unavailable, never bypasses signed firmware policy, and is fixture-testable. |
| `BP-530` | blocked | Waiting on implemented HALs. | Implement fixture-safe self-test. | `BP-522`, `BP-524`, `BP-525`, `BP-526`, `BP-527`, `BP-528`, `BP-529` | Enumerates rails, reference, reset, seven lines, ADC order, outputs, IR, Ethernet, USB, and display; failures cannot report pass. |
| `BP-531` | blocked | Waiting on acquisition and subsystem implementations. | Build deterministic loaded-stress and fault-injection harness. | `BP-522`, `BP-526`, `BP-527`, `BP-528` | Simultaneous traffic/display/IR/USB/flash/reset/queue stress proves timing bounds and fail-unavailable behavior. |
| `BP-532` | blocked | Waiting on complete firmware/test assets. | Run firmware coverage, static analysis, parity, and artifact gates. | `BP-523`, `BP-530`, `BP-531` | Core C/C++ remains 100% line/function/branch; other first-party C/C++ remains at least 80%; build digests are archived. |
| `BP-533` | blocked | Waiting on fixture definition and board test access. | Build the guarded bench fixture and harness. | `BP-105`, `BP-332`, `BP-530` | Interlock, calibration, continuity, fault injection, connector incompatibility, and evidence capture are verified. |

## Assembly and physical evidence

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-620` | blocked | No board has been ordered under the clean-sheet release. | Receive, serialize, and inspect boards/components. | `BP-435` | As-built BOM, substitutions, orientation, AOI/manual/X-ray findings, and rework log. |
| `BP-621` | blocked | Waiting on assembled boards and fixture. | Run unpowered continuity, resistance, isolation, and mating checks. | `BP-533`, `BP-620` | Every rail, weapon line, connector, polarity, shield, reset, and output default passes calibrated checks. |
| `BP-622` | blocked | Waiting on unpowered inspection. | Conduct ready-to-apply-power review. | `BP-532`, `BP-621` | Current limits, stop conditions, calibrated equipment, firmware digest, fixture certificate, and signed permit. |
| `BP-623` | blocked | Waiting on power permit. | Bring up USB-C PD, eFuse, V5, 3.3 V, and analog/reference rails with loads disconnected. | `BP-622` | PD negotiation, raw-5 V denial, ramp, ripple, current limit, shutdown, temperature, and backfeed captures. |
| `BP-624` | blocked | Waiting on stable rails. | Bring up ESP32 reset, USB, UART recovery, watchdog, and safe outputs. | `BP-623` | Cold start, brownout, manual reset, watchdog, recovery, power-off, and default-off captures. |
| `BP-625` | blocked | Waiting on ESP32 bring-up. | Bring up W5500 Ethernet. | `BP-624` | Link, throughput, reset, cable fault, congestion, and power evidence. |
| `BP-626` | blocked | Waiting on stable rails and ESP32 bring-up. | Bring up HUB75 with the purchased panel. | `BP-623`, `BP-624` | Fit, continuity, blank/reset, patterns, refresh, inrush, full-white current, cable drop, ghosting, and temperature. |
| `BP-627` | blocked | Waiting on ESP32 and IR firmware bring-up. | Validate encrypted IR optical and security behavior. | `BP-624`, `BP-528` | Range, angle, carrier, venue light, flood/interference, latency, queue, authentication, replay, reset, and power-off evidence. |
| `BP-628` | blocked | Waiting on stable analog rails and fixture. | Characterize one weapon acquisition channel. | `BP-623`, `BP-533` | Complete BP-106 matrix for accuracy, settling, leakage, overload, recovery, temperature, and unavailable states. |
| `BP-629` | blocked | Waiting on one-channel acceptance. | Characterize all seven channels and channel interactions. | `BP-628` | Channel order, crosstalk, simultaneous events, grounds, shorts, open lines, timing, and replication evidence. |
| `BP-630` | blocked | Waiting on acquisition and output bring-up. | Validate lamp/buzzer outputs under normal and fault loads. | `BP-624`, `BP-629` | Voltage/current, inrush, short/open, inductive behavior, cable drop, EMC observations, temperature, and default-off evidence. |
| `BP-631` | blocked | Waiting on all subsystems. | Run integrated scoring, parity, stress, recovery, and thermal corpus. | `BP-625`, `BP-626`, `BP-627`, `BP-629`, `BP-630` | Foil/epee/sabre corpus, native/ESP/WASM parity, remote workflows, 50 C thermal, resets, traffic, display, and fault stress. |
| `BP-632` | blocked | Waiting on integrated evidence. | Resolve findings and issue the as-tested hardware/firmware revision. | `BP-631` | Every finding is fixed, accepted with a bounded limitation, or converted into an explicit production task. |
| `BP-633` | blocked | Waiting on closed findings. | Conduct prototype completion and production-transfer review. | `BP-632` | Accepted evidence index, known-limit register, architecture recommendations, and explicit remaining certification/production gates. |

## Dependency summary

```text
power:       BP-051 -> BP-052 -> BP-053 -> BP-057
             BP-054/BP-055/BP-056 --------^
analog:      BP-100/BP-101/BP-102 -> BP-103 -> BP-110 -> BP-111
processor:   BP-120 -> BP-121 -> BP-123/BP-124/BP-125 -> BP-127/BP-128
peripheral:  BP-140/BP-141, BP-143/BP-144, BP-126/BP-146, BP-108/BP-109/BP-147
BOM:         BP-057 + BP-111 + BP-148 -> BP-149
schematic:   BP-320 -> BP-321..BP-332 -> BP-333 -> BP-334 -> BP-335
PCB:         BP-010 + BP-335 -> BP-420 -> BP-421..BP-431 -> BP-432 -> BP-433 -> BP-434 -> BP-435
firmware:    BP-521 + frozen interfaces -> BP-520/BP-522..BP-531 -> BP-532
physical:    BP-435/BP-533 -> BP-620 -> BP-621 -> BP-622 -> BP-623..BP-631 -> BP-632 -> BP-633
```

## Release definitions

`BP-434` is the only prototype-order authority. It requires an exact
order-candidate BOM, approved footprints, root-approved schematic, clean
layout checks, and one revision-bound fabrication package. It does not require
measurements that can only be obtained from the ordered board.

`BP-622` is the only apply-power authority. `BP-633` is the only
prototype-complete authority. Neither grants production fabrication,
certification, enclosure, final DFM, factory programming, or FIE homologation.
