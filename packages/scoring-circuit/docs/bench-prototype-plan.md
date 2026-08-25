# Canonical bench prototype plan

## Decision and status

Build the first integrated hardware as **one accessible bench PCB**. It is an
engineering instrument for closing electrical, firmware, and rules-behavior
questions before the production design is divided into scoring, application,
and communications assemblies.

The bench PCB is not a production-form-factor preview and is not presently
ready to fabricate. Its design must remain denied until the prototype-ready
definition at the end of this document is satisfied. Passing the prototype
does not authorize the production PCB.

## Prototype outcome

One board must let the team:

- acquire all seven fencing conductors with an external analog acquisition and
  protection front end, normalized by the authoritative C17 scoring core on
  the exact `ESP32-S3-WROOM-1U-N16R2`;
- keep acquisition, C17 scoring, presentation, Ethernet, IR workflow, and
  hardware adapters logically separated so a future scoring MCU may be added
  without rewriting rules behavior;
- run the exact ESP32-S3, W5500 Ethernet path, and Würth `7499011121A`
  integrated-magnetics RJ45;
- accept normal operating power from a USB-C PD adapter through the selected
  Amphenol receptacle, TPS25730A sink, protection, eFuse, and conversion path;
- drive the selected Adafruit product 2277 64-by-32 HUB75 panel through the
  existing `SN74AHCT245PWR` safe-blanking architecture;
- program, reset, recover, and observe the ESP32 without removing parts;
- attach an external body-cord/piste fixture through a selected bench harness;
- receive, authenticate, and exercise the in-scope encrypted IR referee remote
  through the selected protected receiver path without allowing a remote
  command to fabricate, qualify, or reclassify an electrical hit;
- expose every critical rail, reset, timing, analog, and interface
  node to labeled probes.

The board should favor hand access, probe clearance, replaceable protection
parts, optional series links, current-measurement shunts, configuration straps,
and visible domain boundaries over size or appearance.

## Explicit deferrals

This prototype does not close or require:

- an enclosure, bezel, VESA mount, ingress target, cosmetic industrial design,
  or final connector panel;
- miniaturization, final component density, or the production three-board
  split;
- production battery/UPS or the standards proposal needed to reconcile the
  final product with current FIE supply requirements;
- FCC, CE, IEC/UL 62368-1, FIE homologation, ESD/EFT/surge certification, or a
  compliance mark;
- final factory test coverage, panelization, selective coating, alternate
  sourcing, production programming, or factory DFM.

Those are production gates. The bench board must preserve the architecture
needed to test them later without pretending it already satisfies them.

The encrypted IR referee remote is not deferred. Its product behavior, security boundary, bout-event requirements, and
manufacturer package are defined in
[`apps/scoring/docs/encrypted-ir-remote-control-contract.md`](../../../apps/scoring/docs/encrypted-ir-remote-control-contract.md).
The current no-spare-GPIO allocation is a design blocker to resolve, not permission to omit the receiver.

## Documentation authority

This page is the only active hardware backlog. Earlier roadmaps for a
three-board apparatus, communications carrier, enclosure envelope, production
stack-up, and factory fabrication release have been removed so they cannot
compete with this prototype sequence.

Component-selection records, manufacturer-footprint evidence, analog studies,
pin-allocation audits, Ethernet support calculations, and connector test
records remain reusable technical evidence. Their production-oriented status
language does not add work to this backlog unless a `BP-*` task explicitly
uses that evidence.

## One-board architecture

Use a provisional four- or six-layer rectangular board on standoffs, with no
enclosure assumptions. Final outline and layer count are selected during
layout review from the routing and return-path evidence; the production
six/six/four stack-ups are not inherited automatically.

Organize the board from left to right:

1. external fixture harness and connector-adjacent protection;
2. socketed or option-selectable analog acquisition cells and REF5025 domain;
3. ESP32, reset/watchdog, service header, C17 scoring adapter, and primary
   lamp/buzzer outputs;
4. USB-C receptacle, PD sink/protection/eFuse, W5500, crystal/support network,
   and the board-edge MagJack;
5. HUB75 logic buffers, display signal header, and separately protected display
   power branch.

Use one low-impedance digital ground with explicit analog return, ESD-return,
chassis/shield, high-current display, and sensitive-reference routing rules.
The prototype deliberately has no processor isolation corridor or isolated
scoring supply. This is a P0 simplification, not evidence that a future split
MCU product should omit a reviewed isolation boundary.

## Fixed identities and prototype interfaces

| Function | Bench identity or interface | Prototype rule |
| --- | --- | --- |
| Processor | `ESP32-S3-WROOM-1U-N16R2` | Sole prototype MCU. It hosts adapters, C17 scoring, outputs, display, Ethernet, storage, and controls, but the C17 core remains a separate portable authority module. No module substitution. |
| External analog AFE | Existing seven-channel protection, reference, and ADS8881 candidate network | Converts weapon lines to explicitly timestamped normalized observations. BP-127 must prove the ADC-only cadence before per-channel comparators may be omitted; the interface is not a second scoring authority. |
| Reference | `REF5025AQDRQ1` | Used only with a data-sheet-compliant input/output network and measured dynamic-load evidence. |
| Ethernet controller | `W5500` | Uses the committed exact crystal, passives, ferrite, reset, and polling architecture. |
| Ethernet jack | Würth `7499011121A` | W5500 MDI pairs remain entirely on this PCB; chassis/shield node is separately observable. |
| Display | Adafruit product `2277`, 64-by-32, 1/16 scan | External panel only. Board provides 13 buffered HUB75 signals and a separately protected 5 V branch. |
| Display buffers | Two `SN74AHCT245PWR` | Reset-gated high impedance plus panel `OE` pull-up must hold the panel blank during reset, absence, and brownout. |
| Normal power and USB service | Amphenol `10177070-00011LF`, `TPD4S201TRGRRQ1`, `TPD2EUSB30DRTR`, `TPS25730ADREFR`, `TVS2200DRVR`, `B340A-13-F`, `TPS259474ARPWR` | Required USB-C PD sink input from a standard adapter. The normal operating contract is SPR 20 V/3 A. `TPD4S201TRGRRQ1` protects CC1, CC2, SBU1, and SBU2; exact `TPD2EUSB30DRTR` protects D-/D+. Native USB 2.0 service reaches ESP32 GPIO19/GPIO20 through one matched 22 Ohm series resistor on each data line. |
| Bench power diagnosis | Labeled rail test pads and removable current links | P0 has no populated alternate input connector or source selector. Any current-limited injection is a USB-disconnected, de-energized bench procedure through reviewed test access, never a product input. |
| Weapon fixture | Molex `43045-1200`, mate `43025-1200`, terminals `43030-0007` | Carries seven named conductors plus reviewed fixture/ESD returns; unused positions are NC. It never becomes the production body-cord connector. |
| Body-cord sockets | External fixture using sample `66.9684-22` and `66.9684-25` where applicable | Samples remain candidates. Plug fit, line mapping, sweat/salt, retention, and cycle evidence remain separate. |
| ESP32 service | Samtec `TSW-106-07-G-S` six-contact header candidate | Expose 3.3 V-compatible UART RX/TX, `BOOT_N`, active-high manual reset request, 3.3 V sense, and digital ground. Use an approved-level adapter. |
| RF | WROOM-1U module connector | No external antenna assembly is populated on P0. Ethernet is the required product network; radio load is exercised only when the module antenna path is intentionally equipped for the BP-127 stress test. |

The fixture harness reuses already selected Micro-Fit parts for bench
convenience. This does not authorize those parts for the final external product
interface. The exact HUB75 header, lamp connector, direct-wire strain relief,
and debug mating access remain explicit prototype BOM tasks below.

## USB-C PD and bench-measurement contract

Normal operation uses a standard USB-C PD adapter. The selected sink requests
an SPR 20 V/3 A contract; raw 5 V before negotiation must not energize the
post-contract apparatus rail. `TPD4S201TRGRRQ1` protects only CC1, CC2, SBU1,
and SBU2. Exact `TPD2EUSB30DRTR` protects USB D-/D+, followed by exactly one
matched 22 Ohm series resistor on each line before ESP32 GPIO19/GPIO20. The
exact receptacle, protection networks, disconnect behavior, TVS,
reverse-current path, eFuse, V5 converter, and USB 2.0 data path are part of
the prototype schematic and layout.

P0 does not populate `J_LAB_INJECTION`, `7101SYZQE`, or their harness. Labeled
rail test pads and removable current links may support staged diagnosis only
under a procedure that disconnects USB-C and verifies the board is de-energized
before attaching or removing a current-limited source. These pads are not an
alternate supported input and cannot bypass the normal product protection in
operation.

The protected and converted power tree feeds three separately measurable
branches:

- display V5 through a fuse or resettable current limiter and a removable
  current-measurement link;
- ESP32 and analog V5, followed by the selected 3.3 V regulator, analog
  filtering, and separately measurable AFE branch.

Provide a physical display-branch disconnect so processor bring-up never
requires powering the panel. Provide branch test points and removable links or
current shunts for USB-PD output, V5 input, display, ESP32, and analog-front-end
current. Test-pad injection and USB-C attachment must never coexist.
The panel branch must be wired for the purchased panel's measured startup and
full-white current; the published approximate 4 A value is a starting screen,
not a harness release.

## Authority and observable failure behavior

The ESP32 is the sole prototype processor. It may supply explicit timestamps
and normalized observations to the C17 core, but host services, Ethernet,
display, IR workflow, persistence, and UI code may not decide scoring outcomes.
The core must continue to have no wall-clock, random, network, or display
dependency. It produces only canonical decisions and safe output requests.

BP-127 must prove that acquisition timing, queue overflow, scheduler latency,
Wi-Fi/Ethernet/display load, reset, brownout, and malformed input fail
unavailable rather than silently changing a rules decision. Every output has a
documented inactive state before firmware executes. Future MCU separation is a
planned adapter boundary, not a compatibility promise for this prototype.

## Parallel work lanes

| Lane | Scope | May start after | Joins at |
| --- | --- | --- | --- |
| A: architecture and schematic control | Freeze one-board net ownership, BOM identities, power tree, reset table, and ERC rules | `BP-000` | `BP-300` schematic review |
| B: analog and weapon fixture | Resolve the one-channel topology, seven-channel replication, reference drive, fixture harness, and thresholds | `BP-000` | `BP-300`; this lane is fabrication-critical |
| C: ESP32 acquisition and recovery | ESP32 pin map, deterministic acquisition adapters, reset/watchdog, UART/USB recovery, and safe outputs | `BP-127` | `BP-300` |
| D: Ethernet, display, IR, and application I/O | W5500/MagJack, HUB75, ESP32 rail, encrypted IR, USB, and safe primary outputs | `BP-127` | `BP-300` |
| E: physical bench design | Outline, zones, mounting holes, probe access, harness strain relief, fixture registration | `BP-010` | `BP-400` layout review |
| F: firmware and test assets | ESP32 board support, deterministic acquisition harness, manufacturing self-test, rule corpus, replay capture, bring-up scripts | `BP-127` | `BP-503` ready-to-apply-power review |

Lane B can block fabrication without preventing C, D, E, and F from completing
their paper designs and test assets. No lane may waive another lane's evidence.

## Granular work units

### Contract and electrical baseline

**Status legend:** `backlog` dependencies complete but work not started; `in-progress` active work; `review` committed evidence awaiting explicit independent approval; `blocked` waiting on a named prerequisite; `done` implementation, verification, independent approval, and commit recorded; `superseded` historical work intentionally replaced by an approved architecture decision and retained only as evidence.

`done` applies to the acceptance of that specific work unit. A completed contract, validator, inventory, or release gate may truthfully preserve a downstream `DENY` result; it does not authorize fabrication or product release unless that work unit explicitly grants the authority. Reopen affected completed units if a dependency later changes incompatibly.

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-000` | done | Delivered: Freeze this plan and assign owner/reviewer for every lane. | Freeze this plan and assign owner/reviewer for every lane. | None | Approved plan revision and decision log. |
| `BP-010` | blocked | The ESP32-only architecture supersedes the 300 mm by 160 mm dual-domain drawing and its isolation corridor. Root has rewritten the architectural boundary; the remaining deliverable waits for BP-127 to fix the acquisition and peripheral envelope. | Freeze the ESP32-only bench boundary and provisional zone drawing. | `BP-000`, `BP-127` | Dimensioned zoning drawing with analog return, high-current return, connector edges, IR optical access, RF keepout, probe access, and direct-wire strain relief. |
| `BP-020` | done | Root rebaselined and verified the executable BOM around one ESP32, external AFE, W5500 Ethernet, TSOP38438 IR, HUB75, USB-C PD, native-USB/test-pad recovery, and serialized primary outputs in `d9accb5`. STM32, processor isolation, isolated power/link, both populated service headers, alternate power input/selector, F-RAM, RTC, secure element, audio, speaker, and external antenna remain explicit DNP rows. Focused BOM/architecture/service/connector tests and package type-check passed. | Rebaseline the ESP32-only prototype BOM separately from production. | `BP-000` | Every P0 reference is explicitly selected, `TBD`, or DNP; removed references are recorded as superseded or DNP rather than silently omitted; selected rows include MPN, lifecycle, quantity, source, and package. |
| `BP-030` | done | Delivered and root-approved footprint-evidence method binds exact MPN/package, primary drawing/CAD, artwork digest, orientation, reviewer, and disposition without granting premature release. Regression commit `67c8a58` additionally proves non-HTTPS manufacturer sources and impossible calendar timestamps fail closed while release remains denied; 8 focused tests plus package types, lint, and format pass. | Freeze the footprint-evidence method and review template. | `BP-020` | Per-reference template binds exact MPN/package, manufacturer drawing/CAD, artwork digest, orientation, reviewer, and disposition. It does not claim closure before selections exist. |
| `BP-031` | blocked | The 42 approved and 71 reviewed-unapproved dual-architecture analog records remain reusable, but BP-103 must first reconcile the external ADC and reference network with ESP32 acquisition. No previously approved analog footprint is revoked solely because the processor changed. | Close analog, protection, reference, and weapon-fixture footprints for the ESP32 acquisition path. | `BP-030`, `BP-103`, `BP-104` | Independent evidence record for every populated lane-B reference; unresolved options remain explicit DNP. |
| `BP-032` | blocked | The old 51-reference processor/isolation lane is no longer the P0 reference set. STM32, ISO7762, ISO7721, NXE1S0505, SWD, and their dual-domain support are superseded. Rebuild this lane from the completed ESP32 pin, reset, recovery, and support decisions after BP-121 through BP-125; preserve old evidence as historical only. | Close ESP32, reset, recovery, clock, and safe-output footprints. | `BP-030`, `BP-121`, `BP-123`, `BP-124`, `BP-125` | Independent evidence record for every populated ESP32-only lane-C reference and zero active references to the superseded processor link. |
| `BP-033` | blocked | Existing USB-C PD, W5500, HUB75, display, and TSOP38438 evidence remains reusable. The lane must wait for the revised single-domain regulator, output, optional-peripheral, and IR decisions under BP-142/BP-144/BP-145/BP-146 before its active reference set can be rebaselined. | Close power, Ethernet, HUB75, display, encrypted-IR, and retained application footprints. | `BP-030`, `BP-050`, `BP-141`, `BP-142`, `BP-143`, `BP-144`, `BP-145`, `BP-146` | Independent evidence record for every populated lane-D reference; removed F-RAM/audio/dual-domain options are explicit DNP or superseded. |
| `BP-034` | blocked | Root replaced the ten-family preorder with five active groups: USB-C, OK Fencing weapon sockets/direct landings, W5500 MagJack, HUB75 signal, and HUB75 panel power. Lab input and both programming headers are removed. The owner-approved cable is not a blocker; exact received socket identity/dimensions and upstream BP-050/BP-104/BP-124/BP-141/BP-143 completion remain dependencies. | Converge the minimal P0 connector, mating, fit, pinout, and continuity plan. | `BP-050`, `BP-104`, `BP-124`, `BP-141`, `BP-143` | Exact active interface identities, drawings/CAD disposition, orientation, board footprint, strain relief, continuity procedure, and zero populated superseded connectors. Physical sample results remain post-order evidence. |
| `BP-035` | blocked | BP-031, BP-032, and BP-033 are incomplete dependencies; BP-034 is complete. BP-031 is 42 approved/71 reviewed-unapproved, BP-032 is 1 approved/50 reviewed-unapproved, and BP-033 is 99 reviewed-unapproved/2 not-started. The current evaluator remains `DENY` with 343 blockers across 247 references: 21 unresolved MPN, 35 unresolved package, 33 unresolved population, 220 footprint-evidence, 7 missing-lane-reference, 8 missing-baseline-reference, 8 package-drift, and 11 population-drift; `selection-blocked` is zero. Reviewed-unapproved evidence intentionally does not grant footprint approval. | Converge the lane BOMs into an order-candidate BOM. | `BP-031`, `BP-032`, `BP-033`, `BP-034` | Every proposed populated row is exact and footprint-approved; no proposed populated `TBD` remains; every omitted option is explicit DNP; lane netlists and reference sets are ready for schematic integration. |
| `BP-040` | blocked | Root implemented and verified the ESP32-only net contract: one `APP_GND` plane, a controlled `SCORING_SGND` quiet analog region with one reviewed connection, USB/Ethernet pair rules, local high-current returns, and no isolation corridor, lab input, or selector. BP-010 remains the sole incomplete dependency because the revised dimensioned placement drawing is not yet fixed. | Freeze ESP32-only net classes and ground/shield names. | `BP-010` | Reviewed digital, analog/reference, ESD-return, chassis/shield, high-current, USB, Ethernet differential-pair, and RF rules with no obsolete isolation corridor. |
| `BP-050` | backlog | BP-020 is complete. Root implemented and verified the simplified USB-C-only contract, exact eight-part chain, TPS56A37 support, display limiter, de-energized measurement procedure, and provisional ESP32-only load screen. Remaining task work is explicit rather than dependency-blocked: close the AFE/radio/output rail budget, choose exact PD straps/USB series pair/application regulator, qualify or replace TVS2200 against the TPS25730A limit, and collect physical PD/inrush/load-step/cable-drop/trip/thermal/shutdown evidence. | Freeze the simplified USB-C PD power, protection, conversion, and branch measurement path. | `BP-020` | Exact USB-C/PD/protection/eFuse/V5 parts and support values, 20 V/3 A contract behavior, USB2 routing, branch protection/current links, display disconnect, no populated alternate input, and current-limited test-pad procedure. |

### Analog and external fixture lane

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-100` | backlog | Root audit found that the previously approved contract still selects `NXE1S0505MC` and an isolated plus/minus 5 V domain. Rebase the reusable ADS8881, REF5025, TMUX1112, ADA4177, protection, and guarded-force work onto the single-domain ESP32 P0; decide whether the negative rail earns its place. | Select the one-channel acquisition topology that can cover 0 ohm, 450/475 ohm, and sabre timing. | `BP-000` | Reviewed error, settling, leakage, overload, and fault-recovery budget with no omitted term receiving credit. |
| `BP-101` | blocked | The reusable REF5025/ADS8881 network and simulation still bind the removed isolated rail. Rebase their rail provenance, transient plan, and physical evidence after BP-100 closes. | Reconcile REF5025 input, output ESR/capacitance, and SAR dynamic load. | `BP-100` | Exact capacitors, ESR bounds, layout rule, transient capture plan, and simulation. |
| `BP-102` | blocked | The reusable connector protection and guarded-energy work still traces the removed isolated rails and obsolete sink assumptions. Reconcile it to the BP-100 single-domain topology. | Close connector-side protection and guarded-fault energy. | `BP-100` | Exact protection network, unpowered behavior, current/energy limits, and fixture interlock review. |
| `BP-103` | blocked | The seven explicit analog cells and ADS8881 chain remain useful, but their 14 STM32 enable bindings are obsolete. After BP-127, replace them with exact ESP32-controlled conversion, SPI/GDMA, safe-enable, sample-order, and fail-unavailable interfaces. Per-channel comparator hardware remains DNP unless the ADC-only timing experiment fails. | Reconcile and replicate the seven-channel external acquisition path for ESP32. | `BP-100`, `BP-101`, `BP-102`, `BP-127` | Channel-by-channel schematic and net map, exact ADC timing/order interface, queue bounds, safe enables, and no generic repeated block hiding pin swaps. |
| `BP-104` | done | Root-approved at the pre-order contract boundary: commits `5339ec7` and `d195d47` retain exact Molex evidence and the fixture contract; commits `81beeed` and `97915a5` add the fail-closed received-part intake, explicit null-CAD disposition for `43030-0007`, exact pin/NC map, mating identities, labels, strain path, continuity limits, miswire cases, and independent-review schema. Root re-verification passed the 88-test BP-104/BP-123/BP-143/BP-144 set. Real received-part fit, seven crimp/retention records, strain relief, rejected miswires, and calibrated continuity remain mandatory BP-105/BP-502 evidence and do not block ordering the board/fixture used to obtain them. | Freeze fixture-harness pinout and NC positions. | `BP-010`, `BP-103` | Exact drawing/CAD disposition, continuity map, mating parts, labels, strain-relief design, miswire procedure, numeric limits, and fail-closed physical-evidence schema. |
| `BP-105` | blocked | Blocked on `BP-403`: prototype-only pre-order release must complete before physical fixture build. | Build the automated external body-cord/piste fixture after prototype order release. | `BP-104`, `BP-106`, `BP-403` | Received-part identities/photos, de-energized mate and labels, seven crimp/retention records, strain relief, four rejected miswire cases, calibrated continuity and isolation, four-wire resistance, capacitance bank, relays, watchdog, interlock, and observed-state records. |
| `BP-106` | done | Root-approved: the versioned 544-point analog characterization contract freezes exact resistance, capacitance, temperature, guarded-force, pulse/interval, interlock, instrument-category, calibration, digest, and record-schema requirements without authorizing energy or requiring fixture automation. Commit `57dccd5` validates the BP-101 source contract before snapshot use and adds real duplicate/extra/missing/category/fixture-drift adversarial coverage. Root verification passed 41 BP-101/BP-102/BP-104/BP-106 tests, package types, lint, format, and diff checks. BP-105 physical fixture evidence remains a prerequisite for executing characterization, not for freezing this BP-106 contract. | Freeze the analog test matrix, fixture behavior, and calibration artifact contract. | `BP-101`, `BP-102` | Versioned standards, temperatures, capacitances, resistance/force points, interlock behavior, instrument categories, and record schema. It does not require the automated fixture to be built. |

### ESP32 acquisition and recovery lane

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-120` | superseded | The reviewed STM32G474 pin map remains historical evidence for a future split-MCU product, but no STM32 or SWD reference is active on the P0 board. | Historical STM32 pin allocation. | None | Superseded by the root-approved ESP32-only architecture decision; no P0 acceptance credit. |
| `BP-121` | blocked | Root implemented and verified the exact preliminary sole-ESP32 pad table: SPI3/GDMA ADC on GPIO4/5/6, primary-output latch on GPIO7 sharing SPI2 clock/data, W5500, 13 HUB75 pins, native USB, TSOP38438 on GPIO35 RMT, recovery pads, watchdog kick, and seven uncommitted GPIOs with no reuse. BP-127 remains the incomplete dependency because its one-cell and seven-channel loaded timing evidence is not run. | Reconcile the sole ESP32 module pad and peripheral allocation. | `BP-127` | Exact module-pad and peripheral-instance table covering external ADC SPI/GDMA and CONVST, W5500, HUB75, USB2, IR RMT, recovery, serialized primary outputs, watchdog, straps, RF keepout, and safe-state ownership with no double allocation. |
| `BP-122` | superseded | ISO7762, ISO7721, isolated SPI, rail separation, and the four-state processor power truth table are not populated on P0. The reviewed records remain historical evidence for a future partition. | Historical dual-processor isolation contract. | None | Superseded by the root-approved ESP32-only architecture decision; external-interface protection remains governed elsewhere. |
| `BP-123` | blocked | Root selected one `TPS389033DSER`, one `TPS3431SDRBR`, and their five support passives for the active BOM. One common `APP_RESET_N` will reset ESP32 EN, W5500, primary outputs, and display enable. The obsolete dual-MCU executable contract and physical artifacts still need rewrite after BP-121. | Close the ESP32 supervisor/watchdog/reset and output-safe-state network. | `BP-121` | Exact MPN/value schematic fragment, reset truth/timing review, clean generated ERC evidence, fail-closed capture protocol, and proof that only fresh acquisition/core/reference/output health can service the watchdog. |
| `BP-124` | blocked | Root implemented and verified native USB plus six labeled UART0/BOOT_N/EN_RESET/APP_3V3/APP_GND recovery pads. Both populated service headers are DNP; a keyed temporary fixture uses 3.3 V logic, open-drain boot/reset, and no target power. BP-121 remains the incomplete dependency for the final sole-ESP32 pad allocation. | Freeze ESP32 USB, UART, boot, and reset recovery. | `BP-121` | Exact header/test-pad pinout, mating cable identity where used, voltage constraints, de-energized recovery procedure, native-USB recovery, and reversal-prevention plan. |
| `BP-125` | blocked | Exact ESP32 module and retained support evidence remain useful. Delete STM32, isolation, dual-domain clock/reset, and SWD requirements; complete an ESP32-only boot, rail, decoupling, RF, strap, unused-pad, and support checklist after BP-121. | Define and approve the ESP32-only support checklist and schematic inputs. | `BP-121` | Root-reviewed data-sheet checklist and exact ESP32/source/candidate reconciliation with every active rail, strap, recovery, RF, USB, acquisition, Ethernet, HUB75, IR, and safe-output connection accounted for. |
| `BP-126` | blocked | The TSOP38438 and authenticated anti-replay workflow remain required. Remove the obsolete application-only processor wording while preserving the rule that remote commands cannot create, qualify, clear, or reclassify electrical hits. Final RMT pin and concurrency evidence wait on BP-121 and the optional-peripheral decision. | Reconcile encrypted IR capture and its command-to-scoring safety boundary. | `BP-121`, `BP-145` | Exact RMT-capable input, receiver queue/fault boundary, authentication and replay handoff, and tests proving remote workflow commands cannot enter the normalized electrical-sample interface. |
| `BP-127` | blocked | Root implemented and verified the fail-closed feasibility contract. The paper screen uses a 140-bit seven-ADS8881 frame at 20 MHz plus 1 µs guard for an 8 µs scan, twelve completed scans per 100 µs sabre signal, a 32-frame internal-DRAM queue, four-frame lag limit, exact unavailable faults, seven spare GPIOs, hardware-safe serialized outputs, watchdog health tokens, and a flash-write prohibition while scoring. Dependencies BP-050/BP-100/BP-101/BP-102 and the specified one-cell plus seven-channel loaded bench experiment remain incomplete; no paper result receives schematic or fabrication credit. | Prove ESP32-S3-only P0 scoring feasibility and safety boundary. | `BP-050`, `BP-100`, `BP-101`, `BP-102` | Exact ADS8881 SPI/GDMA and CONVST interface, monotonic sampling schedule, scan/timestamp error budget, bounded queue/error model, preliminary pin/resource map, hardware-safe serialized primary outputs, watchdog contract, rail budget, and a one-cell falsification experiment under simultaneous Ethernet, HUB75, IR, USB, radio, and flash/cache stress. No paper result receives seven-channel or fabrication credit. |

### Ethernet, display, and application lane

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-140` | done | Delivered: Exact W5500 controller and 17-part support network with independent provenance, reset/interrupt endpoints, polling policy, and fail-closed upstream drift checks. | Import the complete W5500 support network from the committed decision register. | `BP-020` | Exact W5500, crystal, load capacitors, feedback/series resistors, EXRES, TOCAP, 1V2O, AVDD/VDD bypass, ferrite, and reset nets. |
| `BP-141` | done | Delivered: Exact W5500-to-7499011121A MDI polarity/pin map, 100 ohm on-board route plan, LED map, chassis shield boundary, and no-MDI-harness rule. | Close W5500-to-7499011121A MDI and shield wiring. | `BP-140` | Pin-by-pin review, 100 ohm route plan, shield/ESD-return decision, and no MDI harness crossing. |
| `BP-142` | blocked | Root retained the exact `LMR43620MSC3RPERQ1` 2 A buck and its required inductor/capacitor network, but removed the unused PGOOD pull-up and route because BP-123 owns independent rail supervision. Existing conservative startup/current/transient/thermal screens pass; BP-050/BP-127 and loaded ESP32/AFE evidence remain incomplete dependencies. | Freeze the single ESP32/AFE 3.3 V implementation from the 5 V rail. | `BP-050`, `BP-127` | Exact regulator/support BOM plus loaded startup, transient, RF, acquisition, current, and thermal calculation with separately measurable ESP32 and analog branches. |
| `BP-143` | done | Root-approved at the pre-order selection boundary: exact Adafruit 2277 panel, 4170 signal cable, 4767 power cable, JST/Samtec mating identities, 16-pin signal map, both power branches, current-rating inputs, drawings/source snapshots, and a fail-closed physical-evidence protocol are frozen. Commit `25754b3` binds real timestamps, calibrated continuity/current/voltage/thermal instruments, artifact hashes, mating/orientation, current, cable drop, temperature, and fit without claiming results. Root re-verification passed the 88-test cross-task set. Actual receipt, board-side fit/continuity, and powered panel measurements remain mandatory BP-502/BP-507 evidence. | Freeze HUB75 connector and panel power mating parts. | `BP-020` | Exact signal/power connector and cable MPNs, pinout, current-rating design inputs, retained source evidence, and fail-closed received-panel measurement protocol. |
| `BP-144` | blocked | Root retained both `SN74AHCT245PWR` devices for 13-signal 3.3 V-to-5 V translation, but collapsed their duplicated enable circuits to one shared `BSS138AKA` sink and one bias/gate network in the active BOM. Rewrite the executable topology after BP-121/BP-123. | Reconcile the two-buffer reset-safe HUB75 path with the sole ESP32. | `BP-121`, `BP-123`, `BP-143` | Schematic truth table proves black/high-impedance defaults; all 13 signals, pulls, pins, and reset-enable paths are present. |
| `BP-145` | blocked | Root implemented the zero-option population contract: F-RAM, RTC, secure element, audio, speaker, and external antenna are all DNP, and speculative support parts/stubs are prohibited. ESP32 eFuses plus encrypted NVS own identity/persistence; flash writes are prohibited during scoring and unavailable NVS cannot change hit classification. BP-121/BP-142 remain incomplete dependencies. | Freeze the intentionally minimal P0 peripheral population. | `BP-121`, `BP-142` | Explicit DNP/removal table for F-RAM, RTC, secure element, audio, speaker, and unused expansion; retained eFuse/NVS key, counter, journal, write-timing, wear, and recovery policy. |
| `BP-146` | blocked | Exact `TSOP38438`, 38 kHz/940 nm assumptions, supply/filter/protection, optical geometry, footprint evidence, and numeric test targets remain selected. Rebind its GPIO, reset, queue, power, and authority claims after BP-126/BP-142/BP-145; do not repeat the manufacturer evidence work. | Reconcile and freeze the encrypted IR receiver path and optical test interface. | `BP-126`, `BP-142`, `BP-145` | Exact receiver, wavelength/carrier, supply/filter/protection, RMT input, optical window, test point, footprint, current budget, queue bounds, and numeric range/angle/light/latency/fault targets. |

### Schematic and physical implementation

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-300` | blocked | Blocked on the revised BP-035 and electrical contracts. The canonical schematic must be rebuilt around one ESP32 and contain no active STM32, processor isolation, isolated-link power, SWD, F-RAM, RTC, secure element, audio, speaker, external antenna, or alternate power selector references. | Integrate one canonical ESP32-only bench schematic. | `BP-035`, `BP-050`, `BP-103`, `BP-104`, `BP-106`, `BP-121`, `BP-123`, `BP-125`, `BP-127`, `BP-141`, `BP-142`, `BP-143`, `BP-144`, `BP-145`, `BP-146` | Schematic source, generated PDF, converged candidate BOM, zero unexplained ERC errors, and independent ESP32/AFE/power review. Every fabrication-critical analog, power, processor, Ethernet, display, encrypted-IR, fixture, output, and recovery input has converged. |
| `BP-301` | blocked | Blocked on `BP-300`: canonical schematic integration must complete before independent review. | Conduct independent mixed-signal and fault-containment review. | `BP-300` | Findings log closed with reviewer acceptance. |
| `BP-302` | blocked | Blocked on `BP-300`: canonical schematic integration must complete before probe/link/shunt freeze. | Freeze test points, removable links, current shunts, and labels. | `BP-300`, `BP-106` | Probe map covers every rail, reset, ADC timing/data signal, encrypted-IR interface, analog stage, fixture line, reference, serialized primary output, Ethernet, and display-enable state. |
| `BP-303` | blocked | Blocked on `BP-035`, `BP-301`, and `BP-302`: BOM convergence and schematic reviews are incomplete. | Freeze the final prototype order BOM against the accepted schematic. | `BP-035`, `BP-301`, `BP-302` | BOM and schematic reference sets, quantities, MPNs, packages, population/DNP states, footprint evidence, and approved substitutions match exactly; zero populated TBDs remain. |
| `BP-400` | blocked | Blocked on `BP-301`, `BP-302`, and `BP-303`: review findings, probe plan, and final prototype BOM are incomplete. | Freeze board outline, stack-up, mounting, and placement. | `BP-010`, `BP-301`, `BP-302`, `BP-303` | Dimensioned drawing, fabricator stack-up, placement review, hand/probe clearance, and strain-relief plan. |
| `BP-401` | blocked | Blocked on `BP-400`: outline, stack-up, placement, and mechanical review are incomplete. | Route analog/reference, ADC timing, clocks, USB-C PD and USB2 service, UART recovery, Ethernet, IR, HUB75, and high-current branches. | `BP-400` | Routed source with reviewed analog/reference and high-current returns, USB/Ethernet differential constraints, RF/IR access, PD/power layout rules, and no unrouted nets. |
| `BP-402` | blocked | Blocked on `BP-401`: routed board source is incomplete. | Run ERC, DRC, SI/PI, thermal, and fabrication-output review. | `BP-401` | Clean reports or reviewed waivers; Gerber/drill/ODB++, IPC-356, BOM, centroid, assembly, and impedance artifacts share one revision digest. |
| `BP-403` | blocked | Blocked on `BP-402`: electrical, physical, and fabrication-output review is incomplete. | Perform independent pre-order release review. | `BP-402` | Signed prototype-only release record explicitly excluding production authority. |

### Firmware, assembly, and evidence

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-500` | blocked | Blocked on `BP-300`: ESP32 board support requires the canonical single-processor schematic. The portable C17 core and its native/WASM targets remain separate from ESP-IDF adapters. | Build the ESP32 board-support and target-neutral scoring adapter. | `BP-121`, `BP-126`, `BP-127`, `BP-300` | Pin/peripheral ownership tests, ADC/GDMA acquisition, serialized safe outputs, watchdog health aggregation, encrypted-IR RMT support, build artifacts, firmware digests, and hardware revision binding. |
| `BP-501` | blocked | Blocked on `BP-105`, `BP-302`, and `BP-500`: fixture, test-point plan, and firmware support are incomplete. | Implement fixture-safe manufacturing self-test. | `BP-105`, `BP-302`, `BP-500` | Test enumerates rails, reference, reset/watchdog, seven lines, ADC order/timing, lamps, buzzer, encrypted IR, Ethernet, USB, and display; failures cannot be reported as passes. |
| `BP-502` | blocked | Blocked on `BP-403`: no prototype-only release exists to order and assemble boards. | Assemble and inspect the first boards. | `BP-403` | Serialized as-built BOM, received BP-104 fixture and BP-143 panel/interface identities, X-ray where required, AOI/manual inspection, de-energized board-side mating/orientation/labels, unpowered continuity/isolation, and rework record. |
| `BP-503` | blocked | Blocked on `BP-105`, `BP-500`, `BP-501`, and `BP-502`: fixture, firmware, self-test, and assembled-board evidence are incomplete. | Conduct the ready-to-apply-power review. | `BP-050`, `BP-105`, `BP-106`, `BP-500`, `BP-501`, `BP-502` | Approved power procedure, current limits, stop conditions, calibrated equipment, fixture-interlock certificate, firmware digests, unpowered inspection, and signed external power permit. |
| `BP-504` | blocked | Blocked on `BP-503`: ready-to-apply-power review and external power permit are incomplete. | Bring up power with ESP32 and display disconnected. | `BP-503` | Capture successful 20 V/3 A PD negotiation; prove raw 5 V/non-PD attachment cannot energize the post-contract rail; verify no populated alternate input; exercise the USB-disconnected current-limited test-pad procedure; archive rail sequence, ripple, temperature, and stop conditions. |
| `BP-505` | superseded | The STM32, SWD, isolated link, peer heartbeat, and ESP32-absent bring-up unit is not part of P0. Its reset/fault methods remain historical evidence where applicable. | Historical STM32 and isolated-link bring-up. | None | Superseded by the root-approved ESP32-only architecture decision. |
| `BP-506` | blocked | Blocked on `BP-504` and `BP-500`: safe power bring-up and ESP32 board support are incomplete. | Bring up ESP32 scoring acquisition, safe outputs, encrypted IR, Ethernet, USB service, and recovery. | `BP-504`, `BP-500`, `BP-141`, `BP-146` | Capture ADC cadence/order/overflow, core handoff, output blanking, USB Serial/JTAG, UART/boot recovery, reset/brownout/watchdog, NVS write exclusion, encrypted-IR security/optical behavior, W5500 traffic/faults, and power-off/backfeed results. |
| `BP-507` | blocked | Blocked on `BP-504`: safe power bring-up must precede purchased-panel validation. | Bring up HUB75 with the purchased panel. | `BP-504`, `BP-144` | Record received panel/cable identities, fit and mating orientation, all 16 signal-continuity paths, both power branches, blank/reset behavior, display patterns, refresh, full-white current, inrush, cable drop, ghosting, connector temperature, and calibrated evidence under the BP-143 protocol. |
| `BP-508` | blocked | Blocked on `BP-504`: safe power bring-up must precede analog characterization. | Execute one-channel analog characterization before seven-channel scoring. | `BP-504`, `BP-106` | Complete calibrated archive; unavailable conditions remain unavailable. |
| `BP-509` | blocked | Blocked on `BP-506` and `BP-508`: ESP32 acquisition/output and analog bring-up evidence is incomplete. | Execute all-channel rules and interaction corpus. | `BP-506`, `BP-508` | Foil, epee, sabre, simultaneous-event, shorts, grounds, lockout, timing-boundary, native/ESP/WASM parity, every encrypted-IR command and state guard, loaded/fresh bout state, replay rejection, and failure-case results. |
| `BP-510` | blocked | Blocked on `BP-506`, `BP-507`, and `BP-509`: integrated subsystem evidence is incomplete. | Run integrated stress and recovery. | `BP-506`, `BP-507`, `BP-509` | Panel load, Ethernet traffic, encrypted IR venue-light/flood/interference, radio when equipped, processor resets, cable faults, and 50 C bench-thermal record. The accepted archive must cover all six BP-123 reset classes and the BP-146 optical/fault cases with calibrated instruments, immutable artifacts, and independent review. |
| `BP-511` | blocked | Blocked on `BP-510`: integrated stress/recovery archive is incomplete. | Conduct prototype completion review. | `BP-510` | Accepted evidence index, known-limit register, production-transfer recommendations, and explicit remaining production gates. |

## Convergence gates and dependency DAG

There is no single shortest chain. Order release requires all fabrication lanes
to converge:

```text
BP-000 -> BP-020 -> BP-030

analog:     BP-100 -> BP-101/BP-102 -> BP-103 -> BP-104/BP-106 -> BP-031
power:      BP-020 -> BP-050 -> BP-127
processor:  BP-127 -> BP-121 -> BP-123/BP-124/BP-125           -> BP-032
peripheral: BP-050 + BP-140 -> BP-141/BP-142/BP-143
                    BP-121/BP-123 -> BP-144
                    BP-121/BP-142 -> BP-145 -> BP-126 -> BP-146 -> BP-033
connectors: BP-050/BP-104/BP-124/BP-141/BP-143                 -> BP-034

BP-031/BP-032/BP-033/BP-034 -> BP-035 lane-BOM convergence
BP-035 + all electrical contracts -> BP-300 -> BP-301/BP-302
BP-035/BP-301/BP-302 -> BP-303 final BOM freeze
BP-010/BP-301/BP-302/BP-303 -> BP-400 -> BP-401 -> BP-402 -> BP-403
```

`BP-403` is the prototype-order gate. Automated fixture construction and
bring-up firmware may proceed in parallel where useful, but neither is required
to order the bare/assembled prototype. After order release:

```text
BP-403 -> BP-502 assembled-board inspection
BP-403 + BP-104/BP-106 -> BP-105 automated fixture
BP-300 -> BP-500 -> BP-501 ESP32 firmware/self-test
BP-050/BP-105/BP-106/BP-500/BP-501/BP-502 -> BP-503 power permit
BP-503 -> BP-504 ... BP-511
```

No lane may bypass analog closure, exact selections, footprint evidence, final
BOM convergence, schematic/ERC, layout/DRC, or independent release review.
Pre-order tasks accept only design evidence that can exist before fabrication:
exact identities, primary sources or explicit CAD dispositions, reviewed
artwork/orientation, calculation and truth-table evidence, and fail-closed
physical-test protocols. Received-part, assembled-board, powered, thermal, and
optical results remain mandatory under `BP-105` and `BP-502` through `BP-510`;
they cannot be prerequisites for ordering the hardware needed to obtain them.

## Definition of prototype-ready

The design is **prototype-ready to order** only when all of the following are
true:

1. Planning and electrical tasks `BP-000` through `BP-106` are accepted except
   post-order fixture-build task `BP-105`; active ESP32 tasks `BP-121` and
   `BP-123` through `BP-127`, peripheral tasks `BP-140` through `BP-146`, and
   implementation tasks `BP-300` through `BP-403` are accepted with no open
   fabrication-critical finding. Superseded BP-120/BP-122/BP-505 records grant
   no P0 acceptance credit.
2. `BP-303` proves every populated reference has an exact orderable MPN, approved footprint,
   manufacturer drawing/CAD digest, assembly orientation, and independently
   reviewed artwork. The order BOM has no populated `TBD`; every optional
   reference has an explicit DNP state.
3. The analog topology and REF5025 load network have closed analytical and
   coupon evidence for the intended first-board experiment; no missing support
   part is represented as present.
4. The schematic has zero unexplained ERC errors, the PCB has zero unexplained
   DRC/unrouted errors, and stack-up, impedance, analog/reference return paths,
   high-current copper, thermals, and probe access are reviewed.
5. Exact fixture, USB-C power/service, ESP32 UART/boot, Ethernet, HUB75, panel,
   safe primary-output latch, and BP-146 encrypted-IR receiver drawings and
   physical-validation procedures are frozen, and normal versus guarded/fault
   connections are physically incompatible by design where required. Received
   sample and powered-behavior results remain post-order gates. STM32,
   processor isolation, isolated-link power, SWD, alternate power input,
   F-RAM, RTC, secure element, audio, speaker, and external antenna are absent
   from the populated P0 BOM.
6. The test matrix, fixture behavior, evidence schemas, current-limit procedure,
   and stop conditions are frozen. Automated fixture construction and executable
   bring-up firmware may continue after order release.
7. `BP-403` records an independent **prototype-only** order release that repeats the
   exclusions in this document.

The assembled board is **ready to apply power** only after `BP-503` passes. At
that gate the board has passed unpowered inspection, the automated fixture and
interlock are complete, current limits and stop conditions are loaded, required
equipment calibrations are current, board-bound firmware/self-test artifacts
exist, and a signed external power permit has been issued. Board arrival or a
clean continuity test alone is not permission to energize it.

The assembled system is **prototype-complete** only after `BP-504` through
`BP-511` pass. That outcome permits production architecture decisions and a
three-board transfer review. It does not authorize an enclosure, certification,
factory tooling, final DFM, or production fabrication.

