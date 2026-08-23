# Requirements-to-evidence ledger

**Contract:** M0-12
**Status:** planning baseline for review; no planned evidence is claimed as complete
**Evidence date:** 2026-08-22

## Purpose, authority, and stage key

This is the canonical index from product requirements to evidence. The [device
delivery plan](device-delivery-plan.md) owns sequencing; this ledger owns the
claim, owner, evidence artifact, current status, and open gate. It is not a
second delivery plan.

Normative authority is the [FIE traceability matrix](fie-traceability-matrix.md)
and local FIE PDF. Names, units, uncertainty, identity, and evidence language
come from the [scoring glossary](scoring-glossary.md). The logical and processor
boundaries are defined by the [seven-conductor contract](seven-conductor-signal-contract.md),
[fault-containment contract](processor-fault-containment-contract.md),
[decision-record contract](decision-record-contract.md),
[transport-frame contract](transport-frame-contract.md),
[power/reset contract](power-reset-state-contract.md), and
[product threat model](product-threat-model.md). Electrical and physical inputs
are the [STM32 allocation](../../../packages/scoring-circuit/docs/stm32-pin-allocation.md),
[ESP32 allocation](../../../packages/scoring-circuit/docs/esp32-pin-allocation.md),
[analog front-end](../../../packages/scoring-circuit/docs/analog-front-end.md),
[connector CAD audit](../../../packages/scoring-circuit/docs/connector-cad-verification.md),
[reel-socket study](../../../packages/scoring-circuit/docs/reel-socket-selection.md),
[critical-part readiness](../../../packages/scoring-circuit/src/part-readiness.ts),
and [production board plan](../../../packages/scoring-circuit/docs/production-board-plan.md).

Use these stage codes in the ledger:

| Code | Planned evidence stage |
| --- | --- |
| U | Unit or schema tests for deterministic rules, records, parsers, and invariants. |
| S | Simulation: virtual apparatus, fault injection, SPICE, timing, tolerance, or pre-layout analysis. |
| B | Bench/coupon: calibrated fixture, analog coupon, connector sample, harness, acoustic, power, or sacrificial measurement. |
| E | EVT assembled-unit and hardware-in-the-loop integration evidence. |
| D | DVT/compliance: qualification, EMC, safety, environmental, reliability, venue, and FIE or SEMI evidence where claimed. |
| P | Production: approved fixture, golden-unit correlation, pilot, supplier, provisioning, service, and release archive. |

Status is intentionally conservative: `baseline contract`, `review draft`,
`candidate input`, `planned`, and `blocked`. A unit or simulation result cannot
substitute for analog, connector, thermal, EMC, safety, reliability,
manufacturing, venue, or approval evidence. No row below claims passed,
approved, homologated, FIE-compliant, or fabrication-ready status.

## Requirements ledger

| ID and requirement family | Owner and primary task IDs | Stages | Acceptance evidence or artifact | Current status | Explicit open gates |
| --- | --- | --- | --- | --- | --- |
| **R-01 GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07.** Apparatus boundary, seven lines, cables/spools, piste continuity and centre bond, body-cord safety, and pre-competition checks. **Normative FIE:** m.44 to m.57. | Rules and electrical; M0-01, M0-03, M4-05, M4-08, M4-13, M6-05, M7-03, M8-03. | U, S, B, E, D, P | Source-cited rule table; boundary vectors; calibrated resistance/timing fixture; spool, cable, harness, and piste reports; EVT/DVT runs; production coverage and golden limits. | Baseline matrix exists; physical topology and measured evidence are not established. | INT-01 and SIG-01 to SIG-06; uncertainty and keying; official-competition claim determines SEMI, UPS, extension-lamp, and finals-clock gates. |
| **R-02 FOIL-01, FOIL-02, FOIL-03, FOIL-04, FOIL-05, EPEE-01, EPEE-02, EPEE-03, EPEE-04, EPEE-05, SABRE-01, SABRE-02, SABRE-03, SABRE-04, SABRE-05, SABRE-06, SABRE-07.** Three-weapon qualification, target and grounded states, resistance and timing boundaries, lockout, blade history, diagnostics, and uncertainty. **Normative FIE:** Annex B A, B, and C. | Rules, firmware, and analog; M0-01, M0-03, M1-02, M1-03, M1-04, M1-05, M1-06, M1-07, M1-08, M1-09, M1-10, M1-11, M4-01, M4-08, M6-05, M7-03. | U, S, B, E, D, P | Versioned rule/timing tables; below/at/above vectors; three-weapon analog and fixture results; B/C and white/yellow diagnostics; EVT corpus; DVT qualification; production fixture. | Host-rule evidence for M1-02 through M1-10 is committed and independently reviewed: epee resistance (`a1cb9f3f8eb00a2df04c79a57c9c0b80396486e4`), foil state machine (`4be096278422d9b35600e4d78c5e1525948bca62`), foil insulation (`8bb02d75ebf872832307434d329ba0f2d8b2b5b8`), sabre state machine (`ff9d7c0084c2cc9fd8798e2479af354250bead3c`), bout state (`b8c7b2a85de819b5b0fc92b8bff999c58caf1c44`), timing table (`73626a55a2e02aff485ba4458aadc98b8b9965be`), boundary suite (`3e0822eeb0065294755344d3ab703f4b6f16a744`), seeded properties (`c41700799c492f2c3ab0093ea5f316d6319088cb`), and reference capture format (`9277de24ebea81fad97612f310d8a7361bf39b82`). The M1-11 independent review found the host evidence passes and identified the prior R-02 status as its sole closure item; `rules-1` remains unreleased pending final re-review. These U-stage host results do not establish physical acquisition, analog/fixture measurements, target firmware, primary outputs, HIL/EVT, DVT/compliance, production, fabrication, or FIE approval evidence. | INT-02 to INT-06; SIG-04 and SIG-05; foil 450 to 475 ohm policy; epee finite 100 ohm envelope; sabre endpoints, B/C persistence, and measured target context; physical acquisition and analog correlation; target firmware and output drivers; HIL/EVT, DVT, production, fabrication, and approval evidence. |
| **R-03 OUT-01, OUT-02, OUT-03, OUT-04, OUT-05, CLOCK-01.** Latched and side-identified lamps, extension lamps, diagnostics, audio, disconnected-cable fallback, clock independence, and encrypted remote if in scope. **Normative FIE:** m.51, m.59, m.60, and Annex B. | Firmware, electrical, product, and compliance; M0-04, M0-05, M5-04, M5-06, M6-07, M6-08, M7-04, M7-10, M8-03. | U, S, B, E, D, P | Output/latch vectors; reset-state captures; photometry and viewing report; audio duration and dB report; isolated clock/extension test; venue workflow; production channel test. | Output ownership is contractual; drivers, lamps, acoustic target, isolation, and clock/remote evidence are not proven. | Warm STM32 reset latch behavior; lamp height, spacing, and lumens; disconnected-cable 80 to 100 dB path; ordinary audio policy; INT-08 and INT-09. |
| **R-04 PWR-01, PWR-02, PWR-03 and M0-10 lifecycle.** Source range, backup, brownout, watchdog, processor/update reset, whole-device loss, safe inactive outputs, new boot identity, persistence boundary, and supervisor-only bout reset. **Normative FIE:** m.49, m.51.7, m.51.11, m.58. | Power and compliance; M0-10, M2-08, M2-10, M5-02, M6-02, M6-09, M7-05, M7-12. | U, S, B, E, D, P | Lifecycle tests; power-fail transaction report; rail and UPS measurements; reset/boot captures; safe-output evidence; update recovery; DVT safety/reliability; production power fixture. | Contract exists; 24 V versus FIE 12 V disposition, sequencing, backup, and hardware reset proof are open. | INT-09 and power proposal; physical pulldowns, reset-source isolation, recovery gates, warm-reset latch decision, and no automatic ESP32-to-STM32 reset. |
| **R-05 M0-04 scoring authority and degraded operation.** STM32 alone owns acquisition, time, qualification, rejection, lockout, records, and primary outputs; ESP32 can present, store, replay, or request only approved operations. | Firmware and systems; M0-04, M2-07, M3-04, M3-09, M3-11, M6-07, M7-08. | U, S, E, D, P | Authority-invariant tests; ESP32 crash, malformed request, link-loss, and load-isolation scenarios; HIL fault report; security and service audits. | Baseline responsibility contract exists; target firmware, isolation wiring, and HIL evidence are not established. | Two heartbeat directions; independent reset paths; request validation; no ESP32 path to scoring state or primary outputs; healthy STM32 versus unavailable STM32 behavior. |
| **R-06 M0-03, M0-08, and M0-09 physical signal and allocation boundary.** Logical phases must bind to real MCU functions, boot-safe controls, isolation, reset, DMA/timer paths, and approved peripherals without hidden conflicts. | Electrical and firmware; M0-03, M0-08, M0-09, M4-13, M5-04, M5-05, M5-06, M6-02, M6-07. | S, B, E, D, P | Reviewed phase/pin map; CubeMX and ESP-IDF allocation proof; reset-state table; target timing/DMA instrumentation; schematic and board bring-up records. | Candidate allocations are review inputs only. | SIG-01 to SIG-06; STM32 threshold, HRTIM, reference/clamp, output-driver, oscillator, and CubeMX blockers; ESP-01 to ESP-11 display, USB, reset, heartbeat, shared-bus, RF, and N16R2 blockers. |
| **R-07 M0-05, M0-07, and replay.** Immutable qualified-hit, off-target, rejection, line-fault, reset, uncertainty, and calibration records; bounded captures; provenance; deterministic scenarios; atomic persistence; replay without re-decision. | Rules, data, and QA; M0-05, M0-07, M2-04, M2-08, M2-11, M3-09, M6-05, M6-06, M8-03. | U, S, E, D, P | Schema round trips and rejects unknown values; golden scenario manifest; fault and power-fail reports; reboot/update replay corpus; board records matching host decisions; production retention audit. | Decision-record schema, golden-scenario manifest, and partial epee corpus are baseline inputs; complete three-weapon corpus, capture production, atomic persistence, and board journal remain planned. | Rule endpoints and line contract; no raw-sample re-decision; storage authentication, retention, export, and correction policy. |
| **R-08 M0-06 transport and parser.** Bounded version-1 frames, receiver direction, length, flags, CRC-32C, and expected sequence fail closed on corruption, truncation, duplication, reordering, or version mismatch. | Protocol and security; M0-06, M2-05, M2-06, M2-13, M3-05, M3-09, M7-08. | U, S, E, D, P | Golden frame corpus; malformed/direction tests; link fault injection; target parser and backpressure tests; penetration review; production conformance fixture. | Frame contract and vectors are baseline inputs; link fault injection, target implementation, and authenticity are not complete. | CRC is not authentication; production must define sender binding, freshness, keys, resource bounds, and recovery. |
| **R-09 M0-11 security, update, identity, debug, and service.** Target-bound authenticated images, atomic rollback, identity and key custody, bounded parsers, physical authorized debug, and service reports without secrets. | Security, firmware, and service; M0-11, M3-10, M6-03, M6-07, M7-08, M8-02, M8-07. | U, S, E, D, P | Threat-model tests; signed-image and wrong-target rejection; interrupted update/rollback; provisioning audit; parser fuzz/penetration review; debug-state and service recovery audit. | Security properties are baseline; algorithms, anti-rollback representation, key custody, lock/unlock, and target implementation are open. | Signature and key protocol, freshness, revocation, security floor, recovery exception, custody separation, PA13/PA14 and USB Serial-JTAG policy; no network-triggered debug or arbitrary output control. |
| **R-10 M4 analog model and protection.** Source/sink, reference, switch, ADC/comparator, clamp, ESD/EFT/surge, capacitance, threshold error, timing, and thermal behavior cover rule boundaries without unnecessary hardware. | Analog and electrical; M4-01, M4-02, M4-03, M5-03, M5-16, M6-04, M6-10, M7-03, M7-04. | S, B, E, D | SPICE boundary matrix and limitation record; vendor-temperature models; clamp/injected-current analysis; coupon response; EVT correlation; DVT protection regression. | Candidate analog topology and model are not a released schematic or physical proof. | Comparator threshold topology, HRTIM capture, reference and final clamp, ADC kickback, extracted parasitics, temperature, and input-power evidence. |
| **R-11 M4 fixture, calibration, and fault containment.** Calibrated resistance, capacitance, pulse, line-state, cable, and power fixture classifies open, short, grounded, cross-line, out-of-range, and indeterminate states; faults never score. | Analog, test, and reliability; M4-05, M4-07, M4-08, M4-09, M6-04, M6-10, M7-04, M8-03, M8-04. | U, S, B, E, D, P | Fixture drawing, calibration and uncertainty budget, incoming inspection, threshold/timing report, sacrificial fault report, board correlation, qualification, and production fixture correlation. | Fixture and acceptance matrix are planned; no coupon or board correlation is claimed. | Guard bands, calibration interval, instrument identity, temperature range, finite 100 ohm epee envelope, and regression after protection changes. |
| **R-12 Body-cord and reel socket interface.** FIE plug geometry, 1 ohm bodywire conductor context, retention, plug fit, contact resistance, sweat/salt, cycle life, and keyed left/right and A/B/C harnesses. | Mechanical, electrical, and service; M0-03, M4-10, M4-13, M6-11, M7-07, M8-07. | B, E, D, P | Exact socket/plug samples; fit and retainer fixture; four-wire resistance; environmental screen; endurance inspection; keyed harness drawing; service replacement trial. | Reel-socket study remains candidate-family research; no socket, plug, harness, or panel assembly is qualified. | M0-03 A/B/C ordering; exact XUB-G suffixes, official CAD, body-cord samples, retainer, harness, and project cycle target. |
| **R-13 Connector CAD, enclosure, and service mechanics.** RJ45, USB-C, locking 24 V inlet, panel cutouts, shell/bonding, strain relief, board and antenna keepouts, airflow, cable loads, drop/spill paths, and no-solder module replacement. | Mechanical and layout; M4-11, M4-12, M4-13, M5-07, M5-10, M5-17, M6-11, M7-06, M8-07. | S, B, E, D, P | Checksummed manufacturer CAD; footprint/STEP overlay; panel and load-path review; EVT enclosure/drop/service trial; DVT environmental and endurance reports; service manual. | Connector audit is source-only; CAD import, footprint, panel fit, and service/load evidence remain open. | Generic symbols cannot close footprints; NC4MD-LX is chassis-only; RJ45/USB-C chassis support, antenna/RF, IP30, bend radius, and fasteners require review. |
| **R-14 Critical-part readiness.** Selection, manufacturer evidence, verified footprint or chassis treatment, mechanical state, lifecycle, approved alternatives, and blockers must be machine-checked. | Electrical, manufacturing, and quality; M4-14, M5-08, M5-09, M5-18, M5-21, M8-01, M8-09. | B, E, D, P | Updated readiness manifest; manufacturer CAD/drawing review; approved-vendor and alternate record; incoming inspection; DFM/DFT review; controlled output and approval record. | Readiness register intentionally reports zero production-approved parts and open blockers. | ESP32, W5500, RJ45, USB-C, power inlet, and XUB-G CAD, footprint, mechanical, lifecycle, and supplier gates. A supplier page or rendered body is not approval. |
| **R-15 Rail, thermal, EMC, safety, and reliability.** Protected input, domain separation, isolation budget, derating, blocked-vent load, emissions/immunity, ESD/EFT/surge, safety, environmental, endurance, and burn-in. | Power, thermal, compliance, and reliability; M5-02, M5-16, M6-08, M6-09, M6-10, M7-04, M7-05, M7-06, M7-07, M7-09, M8-06. | S, B, E, D, P | Worst-case budget; full-load thermal report; EMC pre-scan and DVT qualification; electrical safety; drop/vibration/spill/corrosion/endurance; pilot burn-in and reliability monitoring. | Architecture is documented; budgets, test levels, standards, and all qualification evidence are open. | 24 V approval path, one-watt isolation budget, derating, blocked-vent ambient, selected-market standards, FIE claim, and defect corrective-action loop. |
| **R-16 Manufacturing and controlled release.** Reviewed schematic, PCB, BOM, DRC/netlist, DFM/DFT, fabrication outputs, source comparison, checksums, EVT/DVT correlation, supplier control, pilot yield, provisioning, service, and release identity. | Layout, manufacturing, quality, security, product, and service; M5-01, M5-09, M5-15, M5-17, M5-18, M5-19, M5-20, M5-21, M6-12, M7-01, M7-02, M8-01, M8-09. | E, D, P | Independent schematic/ERC and layout review; DRC/netlist; Gerbers or ODB++, drills, BOM, centroid, drawings, stack-up, assembly notes, checksums; golden correlation; pilot yield; release decision. | Production board plan says the current model is not fabrication-ready; no EVT order or production release is established. | M5 design and manufacturing reviews; one-revision outputs; independent viewer comparison; open-risk disposition; five-to-ten-unit EVT sign-off; DVT and production release owners. |
| **R-17 Independent scoring-box tester and operational-behavior evidence.** A separate calibrated instrument drives both three-contact reel interfaces and piste/ground, measures actual conductor transitions, observes physical outputs, and correlates the applicable complete apparatus against normative and approved product-behavior cases without trusting DUT self-report alone. | Test engineering, firmware, electrical, quality, and compliance; BT-01 through BT-12, M6-05, M7-03, M8-03. | U, S, B, E, D, P | Tester coverage contract; sequence compiler; switch/impedance error budget; self-test; calibration and uncertainty; lamp/buzzer/output correlation; immutable timelines; golden-unit and multi-tester correlation; DVT behavioral report. | Virtual bout observatory exists and the tester roadmap is defined; no tester hardware, physical-output observer, calibration, or scoring-box correlation is established. | Seven-conductor topology; floating voltage/current envelope; safe fault matrix; switch resistance/leakage/timing/skew; calibrated discrete impedance; physical lamp/audio observation; false-pass containment; drift-backed calibration interval; independent golden unit; formal DVT correlation. |

## Evidence-class rule

| Class | Establishes | Does not establish |
| --- | --- | --- |
| Normative rule evidence | The implementation exercised the cited FIE row under declared rule, revision, hardware, firmware, instrument, and uncertainty conditions. | A new FIE limit, silent endpoint choice, approval, or compliance claim. |
| Product implementation evidence | The declared product choice passed its acceptance test. | Authority to relabel a product choice as an FIE rule. |
| Favero FA-15 comparison | A named prior-art observation for fixture, acoustic, or reference-machine comparison under M1-10. | Our rule table, analog topology, endpoint, power, approval, homologation, compliance, or fabrication readiness. |

Every result must identify source and revision, hardware, firmware and digest,
scoring boot and sequence, immutable readings, units, calibration and
uncertainty, reset and power state, and whether it is normative, a product
choice, measured, or prior-art comparison.

## Audit: M0-01 through M0-11

| Contract | Ledger coverage |
| --- | --- |
| M0-01 FIE matrix | R-01 to R-04 and evidence-class rule; all 33 FIE IDs are explicit in the ledger. |
| M0-02 glossary | R-02, R-04, R-07, R-08, R-11; units, identity, uncertainty, `indeterminate`, `unavailable`, and `safeInactive`. |
| M0-03 seven-conductor signal | R-01, R-02, R-05, R-06, R-10 to R-13; SIG-01 to SIG-07 and INT-01, INT-04 to INT-08. |
| M0-04 fault containment | R-03 to R-09 and R-15; STM32 authority, degraded/unavailable, reset, latch, and update ownership. |
| M0-05 decision record | R-03, R-04, R-07 to R-09; immutable dispositions, provenance, captures, reset, calibration, and uncertainty. |
| M0-06 transport frame | R-05, R-07 to R-09; bounds, direction, CRC, sequence, malformed input, and production authenticity gate. |
| M0-07 golden scenarios | R-01, R-02, R-07, R-11; boundary, non-event, fault, reset, uncertainty, and power-fail corpus. |
| M0-08 STM32 allocation | R-05, R-06, R-10, R-11, R-15; MCU functions, DMA/timer, reference, outputs, SWD, and safe controls. |
| M0-09 ESP32 allocation | R-05, R-06, R-09, R-13, R-15; display, USB, Ethernet, storage, RF, audio, reset, heartbeat, straps, and N16R2. |
| M0-10 power/reset | R-03 to R-06, R-11, R-15; lifecycle, safe output, persistence, power, and recovery evidence. |
| M0-11 threat model | R-05, R-07 to R-09, R-13 to R-16; trust zones, abuse cases, updates, identity, debug, service, privacy, and manufacturing custody. |

## Audit: independent box tester

| Tester stage | Ledger destination and required closure |
| --- | --- |
| BT-01 through BT-05 | R-01, R-02, R-03, R-07, R-11, and R-17: coverage, canonical scenario compilation, virtual execution, output expectations, uncertainty, and timeline evidence without a hardware claim. |
| BT-06 through BT-09 | R-11, R-12, R-15, and R-17: safe switching hardware, both reel interfaces, piste/ground, programmable impedance, calibration, fault containment, and independent physical-output observation. |
| BT-10 and BT-11 | R-01 through R-07, R-10, R-11, R-15, and R-17: three-weapon hardware correlation and full apparatus power/reset/replay/display/audio/coexistence behavior. |
| BT-12 and M8-03 | R-14, R-16, and R-17: controlled tester release, multi-instrument correlation, service/calibration, and a separately reviewed production-coverage subset. |

## Audit: M4 and M5 release blockers

| Blocker source | Ledger destination and required closure |
| --- | --- |
| M4-01, M4-02, M4-03 | R-10, R-11, R-15: analog boundary model, protection, threshold error, calibration assumptions, and rail/thermal budget. |
| M4-04, M4-05, M4-06, M4-07, M4-08 | R-10, R-11: verified footprints, calibrated fixture, measured parts, uncertainty, timing/resistance, temperature, and input-tolerance report. |
| M4-09 | R-11, R-15: sacrificial ESD/EFT/surge/cable-fault containment, protection feedback, and regression. |
| M4-10, M4-11, M4-12, M4-13, M4-14 | R-12 to R-16: sockets, connector CAD, enclosure, harness/keying/bonding, thermal assumptions, readiness, and physical review. |
| M5-01, M5-02, M5-03, M5-04, M5-05, M5-06, M5-07 | R-01, R-03 to R-06, R-10, R-13, R-15, R-16: complete power, AFE, STM32, isolation, ESP32, outputs, connector, and harness schematics. |
| M5-08, M5-09 | R-14, R-16: lifecycle, alternatives, ERC, independent schematic review, and resolved or accepted comments. |
| M5-10, M5-11, M5-12, M5-13, M5-14 | R-10, R-13, R-15, R-16: stack-up, placement, routing, planes, creepage, RF/analog zones, labels, test access, and thermal paths. |
| M5-15, M5-16, M5-17 | R-10, R-13, R-15, R-16: DRC/netlist, SI/PI/thermal/EMC/safety, DFM/DFT, fabricator acceptance, programming, and inspection. |
| M5-18, M5-19, M5-20 | R-14, R-16: one-revision fabrication outputs, independent viewer comparison, checksums, open risks, and build instructions. |
| M5-21 | R-16 and all feeding rows: independent electrical, layout, mechanical, firmware, manufacturing, and product approval for a five-to-ten-unit EVT order. This is fabrication readiness only. |
| SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, SIG-06, SIG-07 | R-01, R-02, R-05, R-06, R-10 to R-13: physical line map, excitation, ground, target, B/C, calibration, optional indicators, audio, and keying. |
| INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07, INT-08, INT-09 | R-01 to R-04, R-07, R-10, R-12, R-15: topology, endpoint, resistance envelope, anti-blocking, B/C persistence, optional scope, audio, FIE claim, and power disposition. |
| STM32 open items: comparator threshold, HRTIM capture, reference/clamp, second heartbeat/reverse reset, output drivers, oscillator, CubeMX proof | R-05, R-06, R-10, R-11, R-15: verified MCU functions and measured safe controls; allocation text alone cannot close timing or safe-output claims. |
| ESP-01, ESP-02, ESP-03, ESP-04, ESP-05, ESP-06, ESP-07, ESP-08, ESP-09, ESP-10, ESP-11 | R-05, R-06, R-09, R-13, R-15, R-16: USB/Ethernet collision, straps, display/audio, reset/heartbeat, buses, RF, module variant, land patterns, and do-not-place status. |
| Production board verification gates 1 to 6 | R-05, R-06, R-10, R-13, R-15, R-16: architecture, analog, layout, engineering validation, design validation, and production validation each have a staged artifact. |

## Review rule

A requirement advances only when its artifact is archived with source and
revision, the responsible owner accepts it, and every open gate in its row is
closed. Candidate allocations, supplier results, rendered CAD, simulation-only
passes, and prior-art captures remain inputs until the stated bench, EVT, DVT,
or production evidence is independently reviewed.
