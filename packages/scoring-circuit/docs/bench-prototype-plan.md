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

- acquire all seven fencing conductors with the authoritative
  `STM32G474RET3TR`;
- run scoring logic while the application processor is absent, reset, or
  deliberately faulted;
- exercise the isolated processor link through `ISO7762FDWR` and
  `ISO7721FDR`, with scoring power isolated by `NXE1S0505MC`;
- run the exact `ESP32-S3-WROOM-1U-N16R2`, the W5500 Ethernet path, and the
  Würth `7499011121A` integrated-magnetics RJ45;
- accept normal operating power from a USB-C PD adapter through the selected
  Amphenol receptacle, TPS25730A sink, protection, eFuse, and conversion path;
- drive the selected Adafruit product 2277 64-by-32 HUB75 panel through the
  existing `SN74AHCT245PWR` safe-blanking architecture;
- program, reset, recover, and observe both processors without removing parts;
- attach an external body-cord/piste fixture through a selected bench harness;
- receive, authenticate, and exercise the in-scope encrypted IR referee remote through the selected protected receiver
  path without giving the ESP32 scoring authority;
- expose every critical rail, reset, timing, analog, isolation, and interface
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
3. STM32, scoring watchdog/supervisor, SWD, and primary lamp/buzzer outputs;
4. a clearly marked isolation corridor containing only the exact isolators and
   isolated-power crossing;
5. ESP32, application watchdog/supervisor, service header, storage, and controls;
6. USB-C receptacle, PD sink/protection/eFuse, W5500, crystal/support network,
   and the board-edge MagJack;
7. HUB75 logic buffers, display signal header, and separately protected display
   power branch.

Keep `SCORING_SGND` and `APP_GND` separate on every layer. The bench board may
join multiple production functions physically, but it must not erase the
electrical isolation boundary or scoring authority.

## Fixed identities and prototype interfaces

| Function | Bench identity or interface | Prototype rule |
| --- | --- | --- |
| Scoring MCU | `STM32G474RET3TR` | Owns acquisition, qualification, timing, primary lamps, and buzzer. |
| Application MCU | `ESP32-S3-WROOM-1U-N16R2` | Owns display, Ethernet services, storage, controls, and non-authoritative replay. No module substitution. |
| Main digital isolation | `ISO7762FDWR` | Carries SCK, MOSI, CS, reset request, MISO, and ESP32 heartbeat with the committed directions and fail-safe polarity. |
| Auxiliary isolation | `ISO7721FDR` | Carries STM32 heartbeat; reverse channel remains service-only and never reaches STM32 reset. |
| Isolated scoring power | `NXE1S0505MC` | Fed from bench 5 V; output load, ripple, startup, and local regulator must close before layout release. |
| Reference | `REF5025AQDRQ1` | Used only with a data-sheet-compliant input/output network and measured dynamic-load evidence. |
| Ethernet controller | `W5500` | Uses the committed exact crystal, passives, ferrite, reset, and polling architecture. |
| Ethernet jack | Würth `7499011121A` | W5500 MDI pairs remain entirely on this PCB; chassis/shield node is separately observable. |
| Display | Adafruit product `2277`, 64-by-32, 1/16 scan | External panel only. Board provides 13 buffered HUB75 signals and a separately protected 5 V branch. |
| Display buffers | Two `SN74AHCT245PWR` | Reset-gated high impedance plus panel `OE` pull-up must hold the panel blank during reset, absence, and brownout. |
| Normal power and USB service | Amphenol `10177070-00011LF`, `TPD4S201TRGRRQ1`, `TPD2EUSB30DRTR`, `TPS25730ADREFR`, `TVS2200DRVR`, `B340A-13-F`, `TPS259474ARPWR` | Required USB-C PD sink input from a standard adapter. The normal operating contract is SPR 20 V/3 A. `TPD4S201TRGRRQ1` protects CC1, CC2, SBU1, and SBU2; exact `TPD2EUSB30DRTR` protects D-/D+. Native USB 2.0 service reaches ESP32 GPIO19/GPIO20 through one matched 22 Ohm series resistor on each data line. |
| Diagnostic power injection | Test-only `LAB_POST_EFUSE_20V`, 20 V/2.3 A input on the alternate throw of C&K `7101SYZQE` | The laboratory source bypasses the PD controller and eFuse only for staged bring-up. The normal `PD_EFUSE_OUT_20V` and diagnostic source occupy opposite selector throws, the common feeds `V20_TO_V5_BUCK`, selector changes occur de-energized, and simultaneous drive is prohibited. It is not a second product input. |
| Weapon fixture | Molex `43045-1200`, mate `43025-1200`, terminals `43030-0007` | Carries seven named conductors plus reviewed fixture/ESD returns; unused positions are NC. It never becomes the production body-cord connector. |
| Body-cord sockets | External fixture using sample `66.9684-22` and `66.9684-25` where applicable | Samples remain candidates. Plug fit, line mapping, sweat/salt, retention, and cycle evidence remain separate. |
| STM32 debug | Samtec `FTSH-105-01-L-DV-007-K` ten-contact Cortex-style SWD header candidate with pin 7 omitted | Expose SWDIO, SWCLK, NRST, scoring 3.3 V sense, scoring ground, and the pin-7-omitted key. Exact pinout is frozen before schematic review. |
| ESP32 service | Samtec `TSW-106-07-G-S` six-contact header candidate | Expose isolated 3.3 V-compatible UART RX/TX, `BOOT_N`, active-high manual reset request, 3.3 V sense, and APP_GND. Use an external isolated or approved-level adapter. |
| RF | WROOM-1U module connector and an external test antenna | Radio acceptance is deferred until the exact antenna/coax is selected; Ethernet is sufficient for prototype-ready connectivity. |

The fixture harness reuses already selected Micro-Fit parts for bench
convenience. This does not authorize those parts for the final external product
interface. The exact diagnostic-injection interlock, HUB75 header, lamp
connector, speaker connector, and debug mating cables remain explicit
prototype BOM tasks below.

## USB-C PD and diagnostic-power contract

Normal operation uses a standard USB-C PD adapter. The selected sink requests
an SPR 20 V/3 A contract; raw 5 V before negotiation must not energize the
post-contract apparatus rail. `TPD4S201TRGRRQ1` protects only CC1, CC2, SBU1,
and SBU2. Exact `TPD2EUSB30DRTR` protects USB D-/D+, followed by exactly one
matched 22 Ohm series resistor on each line before ESP32 GPIO19/GPIO20. The
exact receptacle, protection networks, disconnect behavior, TVS,
reverse-current path, eFuse, V5 converter, and USB 2.0 data path are part of
the prototype schematic and layout.

Staged bring-up may use a current-limited 20 V laboratory supply capped at
2.3 A on `LAB_POST_EFUSE_20V`. That diagnostic source deliberately bypasses
the PD controller and eFuse and reaches only the alternate throw of exact
`7101SYZQE`; normal `PD_EFUSE_OUT_20V` reaches the other throw, and the common
feeds `V20_TO_V5_BUCK`. Selector changes occur only while both sources are
de-energized. The selector physically prevents simultaneous USB-C and
laboratory drive. This is not automatic dual-input arbitration and the
diagnostic connection is not an externally supported product interface.

The protected and converted power tree feeds three separately measurable
branches:

- display V5 through a fuse or resettable current limiter and a removable
  current-measurement link;
- application V5, followed by the exact selected application 3.3 V regulator
  and its complete support network;
- `NXE1S0505MC`, followed by the selected scoring-domain 3.3 V regulator and
  analog filtering.

Provide a physical display-branch disconnect so processor bring-up never
requires powering the panel. Provide branch test points and removable links or
current shunts for USB-PD output, V5 input, display, application, and isolated
scoring current. Diagnostic injection and normal USB-C power must never be
enabled together.
The panel branch must be wired for the purchased panel's measured startup and
full-white current; the published approximate 4 A value is a starting screen,
not a harness release.

## Authority and observable failure behavior

The STM32 must operate its rule engine, primary lamps, and buzzer with the
ESP32 held in reset, unpowered on its local branch, sending malformed frames,
or missing entirely. The ESP32 may mirror decisions and request configuration,
but no ESP32 signal may qualify a hit or automatically reset the STM32.

The isolated SPI frame retains protocol version, sequence, timestamp, length,
CRC-32C, and message type. Missing heartbeat, reset request, watchdog timeout,
brownout, and invalid traffic are observable at labeled test points. Every
output has a documented inactive state before either processor executes code.

## Parallel work lanes

| Lane | Scope | May start after | Joins at |
| --- | --- | --- | --- |
| A: architecture and schematic control | Freeze one-board net ownership, BOM identities, power tree, reset table, and ERC rules | `BP-000` | `BP-300` schematic review |
| B: analog and weapon fixture | Resolve the one-channel topology, seven-channel replication, reference drive, fixture harness, and thresholds | `BP-000` | `BP-300`; this lane is fabrication-critical |
| C: processors and isolation | STM32/ESP32 pin maps, clocks, reset/watchdog, isolated SPI, SWD/UART recovery | `BP-000` | `BP-300` |
| D: Ethernet, display, and application I/O | W5500/MagJack, HUB75, application rail, storage/audio placeholders | `BP-000` | `BP-300` |
| E: physical bench design | Outline, zones, mounting holes, probe access, harness strain relief, fixture registration | `BP-010` | `BP-400` layout review |
| F: firmware and test assets | Board support, manufacturing self-test, rule corpus, replay capture, bring-up scripts | `BP-100`, `BP-120` | `BP-503` ready-to-apply-power review |

Lane B can block fabrication without preventing C, D, E, and F from completing
their paper designs and test assets. No lane may waive another lane's evidence.

## Granular work units

### Contract and electrical baseline

**Status legend:** `backlog` not started; `ready` dependencies complete; `in-progress` active work; `review` committed evidence awaiting explicit independent approval; `blocked` waiting on a named prerequisite; `done` implementation, verification, independent approval, and commit recorded.

`done` applies to the acceptance of that specific work unit. A completed contract, validator, inventory, or release gate may truthfully preserve a downstream `DENY` result; it does not authorize fabrication or product release unless that work unit explicitly grants the authority. Reopen affected completed units if a dependency later changes incompatibly.

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-000` | done | Delivered: Freeze this plan and assign owner/reviewer for every lane. | Freeze this plan and assign owner/reviewer for every lane. | None | Approved plan revision and decision log. |
| `BP-010` | done | Delivered: Contract-bound 300 mm by 160 mm provisional zoning drawing with seven domains, a 20 mm isolation corridor, and eight connector-edge coordinates; explicitly non-fabrication. | Freeze the bench-only one-board boundary and provisional zone drawing. | `BP-000` | Dimensioned zoning drawing with domain boundary and connector edges. |
| `BP-020` | done | Delivered: Create the baseline prototype BOM separate from the production BOM. | Create the baseline prototype BOM separate from the production BOM. | `BP-000` | Every reference is explicitly selected, `TBD`, or DNP; selected rows include MPN, lifecycle, quantity, source, and package. A baseline may contain TBD/DNP slots and is not an order BOM. |
| `BP-030` | done | Delivered and root-approved footprint-evidence method binds exact MPN/package, primary drawing/CAD, artwork digest, orientation, reviewer, and disposition without granting premature release. Regression commit `67c8a58` additionally proves non-HTTPS manufacturer sources and impossible calendar timestamps fail closed while release remains denied; 8 focused tests plus package types, lint, and format pass. | Freeze the footprint-evidence method and review template. | `BP-020` | Per-reference template binds exact MPN/package, manufacturer drawing/CAD, artwork digest, orientation, reviewer, and disposition. It does not claim closure before selections exist. |
| `BP-031` | blocked | Root-reviewed commits `f85f5c3` and `e2f2d3b` hash-bind all 16 shared analog sources and add a source-controlled `ERA3AEB2491V` project-footprint candidate derived from Panasonic's 1608 guidance: 0.8 mm by 0.9 mm pads, 2.1 mm overall span, 0.5 mm gap, exact retained source hashes, and rendered-geometry digest. The footprint remains `accepted: false`, orientation pending, and fabrication denied. All 113 ledger records remain DNP-unresolved despite zero source-unresolved records. BP-031 remains blocked by incomplete dependency `BP-104`; the other project footprints, artwork, orientation, schematic reconciliation, and fabrication evidence remain open. Root verification passed 69 source-focused tests plus 3 footprint tests, package types, lint, format, hashes, and diff checks. | Close analog, protection, reference, and weapon-fixture footprints. | `BP-030`, `BP-103`, `BP-104` | Independent evidence record for every populated lane-B reference; unresolved options remain explicit DNP. |
| `BP-032` | blocked | Root review retained and hash-bound the exact TI primary PDFs for `TPS3431SDRBR` in 3 mm by 3 mm DRB/VSON-8 and `TPS389033DSER` in 1.5 mm by 1.5 mm DSE/WSON-6, while preserving the corrected `NXE1S0505MC` package and four exact STM32 VDD bypass selections. Eight processor-support references remain explicitly unresolved; all manufacturer-CAD, project-footprint, artwork, orientation, schematic, and fabrication gates stay denied. | Close processor, isolation, reset, clock, and debug footprints. | `BP-030`, `BP-122`, `BP-123`, `BP-124`, `BP-125` | Independent evidence record for every populated lane-C reference. |
| `BP-033` | blocked | Root-reviewed commit `58314d4` resolves the W5500 control-network identities: `TP_W5500_RESET_N` and `TP_W5500_INT_N` use Keystone `5001` catalog test points, while `R_W5500_INT_BIAS` uses Yageo `RC0603FR-07100KL` 100 kOhm, 1%, 0603. Three primary PDFs are hash-bound; the W5500 `INTn` output-stage topology remains explicitly unspecified, and the bias is justified by the canonical inactive-high polling policy. Five dependent test files pass 57 tests with package types, focused lint, and format clean. BP-033 remains blocked on the other unresolved lane-D identities and all manufacturer-CAD, accepted-footprint, artwork, orientation, layout, fabrication, BP-143, and BP-146 physical gates. | Close power, Ethernet, application, HUB75, display, and encrypted-IR receiver footprints. | `BP-030`, `BP-050`, `BP-141`, `BP-142`, `BP-143`, `BP-144`, `BP-145`, `BP-146` | Independent evidence record for every populated lane-D reference, including the BP-146 receiver path; audio remains explicit DNP with no host or I2C stub. |
| `BP-034` | blocked | Root-reviewed commit `51bcb3d` delivers the prototype-only direct-wire A/B/C landing contract for both sides. The fail-closed validator covers exact nets/pads/test points/labels, NC exclusions, de-energized rework, clamp-only strain loading, thresholds, negative tests, and every authority-bearing field; 5 focused tests plus package types, lint, and format pass. USB-C PD remains unchanged and the owner-validated OK Fencing weapon cable remains accepted. The work unit is still blocked by incomplete dependencies `BP-104` and `BP-143`; received-sample, mounting, mate/unmate, continuity, retention, and strain evidence remain open. | Complete pre-order connector sample, mate, fit, pinout, and continuity review. | `BP-050`, `BP-104`, `BP-124`, `BP-141`, `BP-143` | Received sample identities, mating-part checks, orientation/photos, mechanical fit, harness pinout, strain relief, and continuity archive. No automated scoring fixture is required yet. |
| `BP-035` | blocked | The current evaluator after BP-033 commit `58314d4` remains `DENY` with 666 blockers: 30 unresolved MPN, 44 unresolved package, 42 unresolved population, 32 sample-evidence, 257 footprint-evidence, 232 missing-baseline-reference, 2 duplicate-reference, 9 missing-lane-reference, 6 package-drift, and 12 population-drift. `selection-blocked` is zero. Dependencies BP-031 through BP-034 are incomplete and own these closures; rerun the evaluator after every lane change. | Converge the lane BOMs into an order-candidate BOM. | `BP-031`, `BP-032`, `BP-033`, `BP-034` | Every proposed populated row is exact and footprint-approved; no proposed populated `TBD` remains; every omitted option is explicit DNP; lane netlists and reference sets are ready for schematic integration. |
| `BP-040` | done | Delivered: Freeze net classes and ground/shield names. | Freeze net classes and ground/shield names. | `BP-010` | Reviewed `APP_GND`, `SCORING_SGND`, ESD-return, chassis, analog, high-current, and differential-pair rules. |
| `BP-050` | done | Delivered: Freeze USB-C PD power, protection, conversion, diagnostic injection, and branch measurement. | Freeze USB-C PD power, protection, conversion, diagnostic injection, and branch measurement. | `BP-020` | Exact USB-C/PD/protection/eFuse/V5 parts and support values, 20 V/3 A contract behavior, USB2 data routing, branch protection/current links, display disconnect, diagnostic-injection points, hard source mutual exclusion, and current-limited bring-up procedure. |

### Analog and external fixture lane

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-100` | done | Delivered: root-approved one-channel topology with complete fail-closed error, settling, leakage, overload, and recovery inventory; unbounded terms receive zero credit and physical release remains denied. | Select the one-channel acquisition topology that can cover 0 ohm, 450/475 ohm, and sabre timing. | `BP-000` | Reviewed error, settling, leakage, overload, and fault-recovery budget with no omitted term receiving credit. |
| `BP-101` | done | Delivered: exact REF5025/ADS8881 local networks, ESR/layout rules, transient-capture plan, and reproducible 12-case ngspice-47 bounded behavioral simulation; no silicon or physical-performance credit is inferred. | Reconcile REF5025 input, output ESR/capacitance, and SAR dynamic load. | `BP-100` | Exact capacitors, ESR bounds, layout rule, transient capture plan, and simulation. |
| `BP-102` | done | Delivered: exact protection and guarded-energy network with powered/unpowered fail-closed witnesses, interlocks, trace requirements, current/energy limits, and recovery-capture contract; physical captures remain downstream evidence. | Close connector-side protection and guarded-fault energy. | `BP-100` | Exact protection network, unpowered behavior, current/energy limits, and fixture interlock review. |
| `BP-103` | done | Delivered: root-approved seven explicit 16-part cells, conductor/net/reference maps, source and guarded-force paths, all 14 STM32 enables, exact ADS8881 daisy chain and host-word order, independently bound MPNs, strict immutable validation, and explicit DENY integration gates. | Replicate the approved cell across seven named conductors. | `BP-100`, `BP-101`, `BP-102` | Channel-by-channel schematic and net-map review; no generic repeated block hides pin swaps. |
| `BP-104` | in-progress | Dependencies `BP-010` and `BP-103` are complete, so this task is not blocked. Fixture pinout, NC positions, continuity thresholds, and the fail-closed physical-evidence intake are frozen. Official Molex drawing endpoints and exact material-table scopes are recorded for `43045-1200`, `43025-1200`, `43030-0007`, and `44242-0005`; next work is retaining/hash-binding the primary drawing/CAD artifacts, then recording received-part fit, labels, seven crimp/retention records, strain relief, rejected miswires, and calibrated continuity. | Freeze fixture-harness pinout and NC positions. | `BP-010`, `BP-103` | Drawing, continuity map, mating parts, labels, strain relief, and miswire test. |
| `BP-105` | backlog | Next after `BP-104`, `BP-106`, `BP-403`: Build the automated external body-cord/piste fixture after prototype order release. | Build the automated external body-cord/piste fixture after prototype order release. | `BP-104`, `BP-106`, `BP-403` | As-built photos, continuity, four-wire resistance, capacitance bank, relays, watchdog, interlock, and observed-state records. This is post-order work. |
| `BP-106` | blocked | Implemented matrix contract retained, but blocked by BP-104 physical harness evidence; energized authority remains denied and the 544-point calibrated evidence archive cannot close until that prerequisite is complete. | Freeze the analog test matrix, fixture behavior, and calibration artifact contract. | `BP-101`, `BP-102`, `BP-104` | Versioned standards, temperatures, capacitances, resistance/force points, interlock behavior, instrument categories, and record schema. It does not require the automated fixture to be built. |

### Processor, isolation, and recovery lane

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-120` | done | Delivered: Exhaustive STM32G474RET3TR LQFP64 pad map with seven-channel ADS8881 serialization, isolated SPI, primary outputs, debug, boot, and safe-state ownership. | Reconcile the STM32 pin allocation with the selected seven-channel topology. | `BP-100` | Exact LQFP64 pad/net table with ADC, comparator, timer, SPI, lamp, buzzer, SWD, and strap checks. |
| `BP-121` | done | Delivered: Exhaustive ESP32-S3-WROOM-1U-N16R2 41-pad map covering isolated/application buses, HUB75, USB2, service recovery, watchdogs, straps, and IR receiver allocation. | Reconcile the ESP32 N16R2 allocation. | `BP-000` | Exact module-pad table covering isolated SPI, Ethernet SPI, HUB75, native USB2 service, UART recovery, I2C, application-only `IR_RX`/`RMT_RX`, watchdog, straps, reserved NC pads, and module-unexposed GPIO33/GPIO34. |
| `BP-122` | done | Delivered: Exact ISO7762/ISO7721 channel map, default levels, reset containment, rail separation, and four-state powered/unpowered truth table. | Freeze isolation channel directions and default levels. | `BP-120`, `BP-121` | Pin-level ISO7762/ISO7721 map and powered/unpowered truth table. |
| `BP-123` | in-progress | Dependencies `BP-120` and `BP-121` are complete. Root-reviewed commit `4a60c5f` adds a fail-closed schematic-integration preflight covering 11 exact reset/watchdog nets, processor/isolation pin reconciliation, hash-bound source/PDF/ERC inputs, and zero unexplained ERC findings without granting integration authority; 9 focused tests, package types, lint, format, and diff checks pass. Next work is BP-300 schematic source/PDF/ERC submission and independent schematic review, followed by assembled-prototype cold-start, brownout, watchdog, manual-reset, cross-domain, and power-off captures. | Close both supervisor/watchdog/reset networks. | `BP-120`, `BP-121` | Exact MPN/value schematic and cold-start, brownout, watchdog, manual-reset, cross-domain, and power-off tests. |
| `BP-124` | done | Delivered: Exact SWD and ESP32 UART/boot service header identities, pinouts, mating assemblies, voltage rules, de-energized recovery sequence, and reversal-prevention gate. | Freeze STM32 SWD and ESP32 UART/boot service headers. | `BP-120`, `BP-121` | Header pinouts, mating cable IDs, voltage constraints, reset procedure, and recovery demonstration plan. |
| `BP-125` | in-progress | Dependencies `BP-120` and `BP-121` are complete, so this task is not blocked. Root review selected and hash-bound the first Murata bypass part; a read-only audit has confirmed the five proposed capacitor identities and manufacturer body/series land guidance while finding no exact-MPN manufacturer CAD. The delivered selection unit awaits root diff review and one `GCM21BR71E225KA73L` archive URL must be rebound to Murata. Next work is processor schematic sign-off plus project paste/mask/courtyard/orientation/placement review. | Define oscillator, decoupling, boot straps, and unused-pin policy. | `BP-120`, `BP-121` | Data-sheet checklist and schematic sign-off for both processors, including GPIO35 `IR_RX`/`RMT_RX`, GPIO36/37 reserved NC, GPIO33/GPIO34 module-unexposed, and BP-121 `irReceiver` provenance. |
| `BP-126` | done | Delivered: GPIO35/module-pad-28 application-only RMT receive boundary, with conflicting pads and generic expander timing credit denied pending BP-146 hardware evidence. | Reconcile the encrypted IR receiver/decoder interface with the ESP32 allocation and authority boundary. | `BP-121`, `BP-145` | `GPIO35`/module pad 28 is selected as application-only `IR_RX` on ESP32-S3 `RMT_RX`; receiver hardware remains **DENY** pending BP-146 cumulative exact-MPN, reset, timing, queue, fault, and power-off evidence. GPIO36/37 are reserved NC for DNP audio, GPIO33/34 are unexposed, and protected USB/Ethernet/F-RAM/HUB75/UART/watchdog/isolation signals remain unchanged. A generic GPIO expander receives no timing credit. |

### Ethernet, display, and application lane

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-140` | done | Delivered: Exact W5500 controller and 17-part support network with independent provenance, reset/interrupt endpoints, polling policy, and fail-closed upstream drift checks. | Import the complete W5500 support network from the committed decision register. | `BP-020` | Exact W5500, crystal, load capacitors, feedback/series resistors, EXRES, TOCAP, 1V2O, AVDD/VDD bypass, ferrite, and reset nets. |
| `BP-141` | done | Delivered: Exact W5500-to-7499011121A MDI polarity/pin map, 100 ohm on-board route plan, LED map, chassis shield boundary, and no-MDI-harness rule. | Close W5500-to-7499011121A MDI and shield wiring. | `BP-140` | Pin-by-pin review, 100 ohm route plan, shield/ESD-return decision, and no MDI harness crossing. |
| `BP-142` | done | Delivered: Exact LMR43620 application rail and support BOM with reviewed startup, transient, branch-current, and conservative thermal screens; physical measurements remain downstream. | Freeze application 3.3 V implementation from the 5 V bench rail. | `BP-050` | Exact regulator/support BOM plus startup, transient, current, and thermal calculation. |
| `BP-143` | in-progress | Dependency `BP-020` is complete, so this task is not blocked. Exact Adafruit panel/signal/power-cable, Samtec header/footprint-print, and JST power-mate source bytes are retained and hash-bound, with omission and identity drift rejected. The next handoff is purchased-panel receipt followed by de-energized continuity, mating/orientation, current, cable-drop, connector-temperature, and physical-fit evidence. | Freeze HUB75 connector and panel power mating parts. | `BP-020` | Exact 16-pin signal and power connector MPNs, cable pinout, current rating, and purchased-panel continuity record. |
| `BP-144` | blocked | Implemented reset-safe HUB75 truth table retained, but blocked by BP-123 reset/watchdog integration and BP-143 purchased-panel/continuity evidence; schematic, power-off, layout, bench, and fabrication gates remain denied. | Implement the two-buffer reset-safe HUB75 path. | `BP-121`, `BP-123`, `BP-143` | Schematic truth table proves black/high-impedance defaults; all 13 signals and pulls are present. |
| `BP-145` | done | Delivered: Exact populated F-RAM pin/support network and explicit DNP policy for RTC, secure element, audio, speaker, and external antenna. | Define optional application peripherals for population. | `BP-121`, `BP-142` | Explicit populate/DNP table for F-RAM, RTC, secure element, audio amplifier, speaker, and antenna. |
| `BP-146` | in-progress | Dependencies `BP-126`, `BP-142`, and `BP-145` are complete, so this task is not blocked. Commit `1b83ceb` binds the TSOP38438 source-controlled footprint identity, hashes, pin order, and rendered geometry; 30 focused tests plus types, lint, and format pass. Next work is manufacturer-CAD disposition, root footprint acceptance, board placement and optical layout, then a measured panel coupon with range, angle, latency, flood, reset, and power-off results. Fabrication and optical authority remain denied until those acceptance records exist. | Select and freeze the encrypted IR remote receiver path and optical test interface. | `BP-126`, `BP-142`, `BP-145` | Exact receiver/demodulator or decoder, wavelength/carrier, supply/filter/protection, connector or optical window assumptions, test points, footprint, current budget, numeric range/angle/light/latency targets, and stuck/noise/power-off behavior are reviewed. |

### Schematic and physical implementation

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-300` | backlog | Next after `BP-035`, `BP-050`, `BP-103`, `BP-104`, `BP-106`, `BP-122`, `BP-123`, `BP-125`, `BP-141`, `BP-142`, `BP-143`, `BP-144`, `BP-145`, `BP-146`: Integrate one canonical bench schematic. | Integrate one canonical bench schematic. | `BP-035`, `BP-050`, `BP-103`, `BP-104`, `BP-106`, `BP-122`, `BP-123`, `BP-125`, `BP-141`, `BP-142`, `BP-143`, `BP-144`, `BP-145`, `BP-146` | Schematic source, generated PDF, converged candidate BOM, and zero unexplained ERC errors. Every fabrication-critical analog, power, processor, isolation, Ethernet, display, encrypted IR remote, fixture, and debug input has converged. |
| `BP-301` | backlog | Next after `BP-300`: Conduct independent mixed-signal and fault-containment review. | Conduct independent mixed-signal and fault-containment review. | `BP-300` | Findings log closed with reviewer acceptance. |
| `BP-302` | backlog | Next after `BP-300`, `BP-106`: Freeze test points, removable links, current shunts, and labels. | Freeze test points, removable links, current shunts, and labels. | `BP-300`, `BP-106` | Probe map covers every rail, reset, heartbeat, SPI, encrypted IR receiver/decoder interface, analog stage, fixture line, reference, and display-enable state. |
| `BP-303` | backlog | Next after `BP-035`, `BP-301`, `BP-302`: Freeze the final prototype order BOM against the accepted schematic. | Freeze the final prototype order BOM against the accepted schematic. | `BP-035`, `BP-301`, `BP-302` | BOM and schematic reference sets, quantities, MPNs, packages, population/DNP states, footprint evidence, and approved substitutions match exactly; zero populated TBDs remain. |
| `BP-400` | backlog | Next after `BP-010`, `BP-301`, `BP-302`, `BP-303`: Freeze board outline, stack-up, mounting, and placement. | Freeze board outline, stack-up, mounting, and placement. | `BP-010`, `BP-301`, `BP-302`, `BP-303` | Dimensioned drawing, fabricator stack-up, placement review, hand/probe clearance, and strain-relief plan. |
| `BP-401` | backlog | Next after `BP-400`: Route analog, isolation, clocks, USB-C PD and USB2 service, UART recovery, Ethernet, HUB75, and high-current branches. | Route analog, isolation, clocks, USB-C PD and USB2 service, UART recovery, Ethernet, HUB75, and high-current branches. | `BP-400` | Routed source with reviewed return paths, USB/Ethernet differential constraints, PD/power layout rules, isolation clearance, and no unrouted nets. |
| `BP-402` | backlog | Next after `BP-401`: Run ERC, DRC, SI/PI, thermal, and fabrication-output review. | Run ERC, DRC, SI/PI, thermal, and fabrication-output review. | `BP-401` | Clean reports or reviewed waivers; Gerber/drill/ODB++, IPC-356, BOM, centroid, assembly, and impedance artifacts share one revision digest. |
| `BP-403` | backlog | Next after `BP-402`: Perform independent pre-order release review. | Perform independent pre-order release review. | `BP-402` | Signed prototype-only release record explicitly excluding production authority. |

### Firmware, assembly, and evidence

| ID | Status | Latest state | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `BP-500` | backlog | Next after `BP-120`, `BP-121`, `BP-126`, `BP-300`: Build STM32 and ESP32 board-support configurations. | Build STM32 and ESP32 board-support configurations. | `BP-120`, `BP-121`, `BP-126`, `BP-300` | Pin ownership tests, encrypted IR receiver/decoder support, build artifacts, firmware digests, and hardware revision binding. |
| `BP-501` | backlog | Next after `BP-105`, `BP-302`, `BP-500`: Implement fixture-safe manufacturing self-test. | Implement fixture-safe manufacturing self-test. | `BP-105`, `BP-302`, `BP-500` | Test enumerates rails, reference, resets, isolation, seven lines, lamps, buzzer, encrypted IR receiver/decoder, Ethernet, and display; failures cannot be reported as passes. |
| `BP-502` | backlog | Next after `BP-403`: Assemble and inspect the first boards. | Assemble and inspect the first boards. | `BP-403` | Serialized as-built BOM, X-ray where required, AOI/manual inspection, unpowered continuity/isolation, and rework record. |
| `BP-503` | backlog | Next after `BP-050`, `BP-105`, `BP-106`, `BP-500`, `BP-501`, `BP-502`: Conduct the ready-to-apply-power review. | Conduct the ready-to-apply-power review. | `BP-050`, `BP-105`, `BP-106`, `BP-500`, `BP-501`, `BP-502` | Approved power procedure, current limits, stop conditions, calibrated equipment, fixture-interlock certificate, firmware digests, unpowered inspection, and signed external power permit. |
| `BP-504` | backlog | Next after `BP-503`: Bring up power with processors and display disconnected. | Bring up power with processors and display disconnected. | `BP-503` | Capture successful 20 V/3 A PD negotiation; prove raw 5 V/non-PD attachment cannot energize the post-contract apparatus rail; verify PD and `LAB_POST_EFUSE_20V` selector throws, de-energized change procedure, and physical source mutual exclusion; execute the current-limited 20 V/2.3 A diagnostic bring-up; archive rail sequence, ripple, temperature, and stop conditions. |
| `BP-505` | backlog | Next after `BP-504`, `BP-500`: Bring up STM32, reset, SWD, and isolated link. | Bring up STM32, reset, SWD, and isolated link. | `BP-504`, `BP-500` | Clock/debug, watchdog, supervisor, heartbeat, malformed-link, and ESP32-absent evidence. |
| `BP-506` | backlog | Next after `BP-504`, `BP-500`, `BP-141`, `BP-146`: Bring up ESP32, encrypted IR remote, Ethernet, USB service, and recovery. | Bring up ESP32, encrypted IR remote, Ethernet, USB service, and recovery. | `BP-504`, `BP-500`, `BP-141`, `BP-146` | Capture USB Serial/JTAG enumeration, console/service traffic, JTAG access, disconnect/reconnect, and recovery; prove independent UART/`BOOT_N` recovery; archive encrypted IR pairing, command/duplicate/replay/wrong-key/noise/fault results plus W5500 reset, link, traffic, polling, and fault-injection captures. |
| `BP-507` | backlog | Next after `BP-504`, `BP-144`: Bring up HUB75 with the purchased panel. | Bring up HUB75 with the purchased panel. | `BP-504`, `BP-144` | Blank/reset behavior, all signals, refresh, full-white current, inrush, cable drop, ghosting, and connector temperature. |
| `BP-508` | backlog | Next after `BP-504`, `BP-106`: Execute one-channel analog characterization before seven-channel scoring. | Execute one-channel analog characterization before seven-channel scoring. | `BP-504`, `BP-106` | Complete calibrated archive; unavailable conditions remain unavailable. |
| `BP-509` | backlog | Next after `BP-505`, `BP-506`, `BP-508`: Execute all-channel rules and interaction corpus. | Execute all-channel rules and interaction corpus. | `BP-505`, `BP-506`, `BP-508` | Foil, epee, sabre, simultaneous-event, shorts, grounds, lockout, timing-boundary, replay, every encrypted IR short/held command and state guard, loaded/fresh bout state, duplicate/replay rejection, and failure-case results. |
| `BP-510` | backlog | Next after `BP-506`, `BP-507`, `BP-509`: Run integrated stress and recovery. | Run integrated stress and recovery. | `BP-506`, `BP-507`, `BP-509` | Panel load, Ethernet traffic, encrypted IR traffic and optical interference, radio when equipped, processor resets, brownout, cable faults, and 50 C bench-thermal record. |
| `BP-511` | backlog | Next after `BP-510`: Conduct prototype completion review. | Conduct prototype completion review. | `BP-510` | Accepted evidence index, known-limit register, production-transfer recommendations, and explicit remaining production gates. |

## Convergence gates and dependency DAG

There is no single shortest chain. Order release requires all fabrication lanes
to converge:

```text
BP-000 -> BP-020 -> BP-030

analog:     BP-100 -> BP-101/BP-102 -> BP-103 -> BP-104/BP-106 -> BP-031
processors: BP-120/BP-121 -> BP-122/BP-123/BP-124/BP-125       -> BP-032
peripheral: BP-050 + BP-140 -> BP-141/BP-142/BP-143
                                      -> BP-144/BP-145 -> BP-126 -> BP-146 -> BP-033
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
BP-300 -> BP-500 -> BP-501 firmware/self-test
BP-050/BP-105/BP-106/BP-500/BP-501/BP-502 -> BP-503 power permit
BP-503 -> BP-504 ... BP-511
```

No lane may bypass analog closure, exact selections, footprint evidence, final
BOM convergence, schematic/ERC, layout/DRC, or independent release review.

## Definition of prototype-ready

The design is **prototype-ready to order** only when all of the following are
true:

1. Planning and electrical tasks `BP-000` through `BP-106` are accepted except
   post-order fixture-build task `BP-105`; processor tasks `BP-120` through
   `BP-126`, peripheral tasks `BP-140` through `BP-146`, and implementation
   tasks `BP-300` through `BP-403` are accepted with no open
   fabrication-critical finding.
2. `BP-303` proves every populated reference has an exact orderable MPN, approved footprint,
   manufacturer drawing/CAD digest, assembly orientation, and independently
   reviewed artwork. The order BOM has no populated `TBD`; every optional
   reference has an explicit DNP state.
3. The analog topology and REF5025 load network have closed analytical and
   coupon evidence for the intended first-board experiment; no missing support
   part is represented as present.
4. The schematic has zero unexplained ERC errors, the PCB has zero unexplained
   DRC/unrouted errors, and stack-up, impedance, isolation, return paths,
   high-current copper, thermals, and probe access are reviewed.
5. Exact fixture, USB-C power/service, diagnostic-injection, SWD, ESP32 UART,
   Ethernet, HUB75, panel, and BP-146 encrypted-IR receiver drawings are
   frozen, and normal versus guarded/fault connections are physically
   incompatible where required. Audio remains explicit DNP with no host or I2C
   stub.
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

