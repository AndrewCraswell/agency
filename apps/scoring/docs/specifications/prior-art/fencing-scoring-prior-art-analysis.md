# Fencing-scoring prior-art analysis against FIE material rules

**Analysis date:** 2026-08-24

**Repository inventory:** [GitHub fencing-scoring repository catalog](fencing-scoring-github-catalog.md)

**Normative baseline:** [August 2026 FIE traceability matrix](../fie-traceability-matrix.md)

## Conclusion

No inspected public repository demonstrates complete conformance to the August 2026 FIE Material Rules. The strongest
all-weapon implementation is the current OpenPiste firmware, but its public automated tests exercise communication
protocols rather than the complete electrical, resistance, timing, fault, lamp, audio, clock, and power matrix. The
popular wnew family is useful simple-state-machine prior art, but its sabre variants disagree on 120 versus 170 ms and
the project explicitly lacks whipover. Several repositories that advertise three weapons contain disabled or stubbed
sabre code.

Accordingly:

- FIE rules remain the only normative source.
- Public repositories may supply architecture, circuit, fixture, and failure-mode ideas.
- A README percentage or “FIE timing” claim is unverified until reproduced against named rule vectors.
- A copied constant is not a scoring specification. The apparatus must also implement resistance, ground, target,
  fault, sequence, output-latching, audio, power, and uncertainty behavior.

## Comparison method

The comparison uses the requirement IDs in
[`fie-traceability-matrix.md`](../fie-traceability-matrix.md). A repository receives credit only for inspectable source or
test evidence at its cataloged pin. The evidence labels are:

| Label | Meaning |
| --- | --- |
| Implemented | Source contains an identifiable state transition or output corresponding to the requirement. |
| Partial | One scalar or happy path is present, but resistance, fault, endpoint, or sequence behavior is missing. |
| Claimed | README or comment asserts behavior without a reproducible rule test. |
| Tested | A test supplies a stimulus, checks an expected outcome, and names or clearly implements the rule boundary. |
| Unknown | Source is absent, compiled only, ambiguous, or too incomplete to establish behavior. |

This is an engineering comparison, not FIE homologation, patent validity analysis, or a freedom-to-operate opinion.
For formal patent prior art, preserve full commit identity, author and commit metadata, release tags, issue/README
history, and an independent publication or archive date. Code license and patent prior-art status are separate questions.

## Representative implementation comparison

| Project | Rule coverage found | Material deviations or unknowns | Verification found | Engineering use |
| --- | --- | --- | --- | --- |
| [OpenPiste current](https://github.com/pietwauters/esp32scoringdeviceMqtt/tree/ed6485efeb) | All weapons, calibrated ADC thresholds, ground/target states, foil white, sabre white/yellow and whipover, 300/45/170 ms | No published Annex B endpoint policy or complete rule-vector results; electrical thresholds are code choices, not automatically FIE evidence; ordinary output, UPS, and photometric compliance are not established by firmware | Protocol host tests only; no automated weapon-behavior suite found | Best behavioral and product-integration reference; reimplement from rules and test independently |
| [wnew](https://github.com/wnew/fencing_scoring_box/tree/2b1698f599) | Foil/epee happy paths and all-weapon scalar timing; analog bucket approach | Combined sketch uses 170 ms sabre while standalone sketches retain 120 ms; no whipover; resistance, anti-blocking, B/C fault, and uncertainty coverage incomplete | README reports oscilloscope checks; interactive test sketches, no verdict-producing rule suite | Minimal state-machine and low-cost hardware reference; use as lineage, not validation |
| [JBox](https://github.com/joejensen/fencingbox/tree/b14f231e4a) | Foil/epee timers, PC-configurable timing, PCB, score/remote integration | Sabre function is an empty return; no resistance matrix or current rule provenance | No rule suite found | Historical modular hardware/remote architecture; never cite as three-weapon proof |
| [RobinsonZ](https://github.com/RobinsonZ/fencing-scoring/tree/ecd2fb137d) | Explicit foil/epee/sabre state machines and 300/45/170 ms constants | Sabre samples immediately rather than qualifying 100 us, has no whipover, and source acknowledges diagnostic output mismatch | No tests found | Readable negative example and state-transition reference |
| [Inexfensive](https://github.com/mschnur/inexfensive/tree/31dce8279c) | Six-line inference, foil/epee/sabre modes, detailed whipover history | Authors report ambiguous analog states and inadequate Arduino scan speed; sabre lockout is obsolete 120 ms | No rule suite found | Valuable failure report: do not collapse the six lines into one simultaneous voltage inference |
| [Copis](https://github.com/TheGrimReaper13/Copis/tree/c671f790fb) | Sabre alternating excitation, 600 us qualification, 170 ms lockout, 4/15 ms and ten-interruption whipover state | README reports untested whipover, rare false positives, and self-hit indicator defect; full resistance and B/C diagnostic evidence absent | Bench/live observations only | Strongest compact sabre-sequence prior art; use its contact-history shape, not its acceptance claim |
| [JC foil box](https://github.com/jc0019/diy-fencing-scoring-box/tree/2e8bb5b08b) | Continuous 14 ms foil break and 300 ms event window | Foil resistance, anti-blocking, diagnostic bands, and exact signal anchor are absent | Separate Arduino sweep fixture, but visual/manual verdict and no resistance stimulus | Useful starting point for an independent tester topology |
| [Sentinel](https://github.com/phillip-toone/sentinel/tree/55f8559b31) | Phased 21-pair continuity acquisition architecture and measured physical settling experiments | No weapon rule engine or production firmware | Host tests plus explicitly bounded hardware experiments | Best acquisition and evidence-method prior art; not a scoring implementation |
| [ImprovedTesterAfterGenova](https://github.com/pietwauters/ImprovedTesterAfterGenova/tree/e02b908df8) | Calibrated resistance and micro-break testing for weapons, body cords, lames, guards, and reels | Tests fencing equipment, not scoring-apparatus Annex B decisions or physical output behavior | Field-use claims and inspectable tester source; no scoring-box verdict matrix | Strong equipment-fixture and operator-feedback reference; keep independent from the scorer |
| [FossBox](https://github.com/jamesw98/foss-box/tree/155c450d59) | Epee guard rejection, second-hit wait, score/clock/display/remote | A sampled weapon GPIO is immediately valid; required 2 ms contact qualification and resistance cases are absent; 40 ms endpoint policy is implicit | No rule tests found | Product UI and inexpensive display reference; not epee decision authority |
| [Marcus Pico](https://github.com/marcusdeng22/scoringbox/tree/928f7e1a31) | Measured six-channel scan time and foil/epee code | Sabre disabled because electrical observations are ambiguous; no resistance/uncertainty evidence | Ad hoc remnants only | Confirms the need for phased excitation and explicit illegal-state handling |
| [Touché](https://github.com/Yohannfra/Touche/tree/bc853ff1bb) | Open wireless epee hardware and radio architecture | README says ground detection is buggy, foil difficult, foil/sabre not implemented | Build workflow, not an FIE behavior suite | Wireless topology and honest failure-mode reference only |
| [lolorahaingo wireless](https://github.com/lolorahaingo/wireless_fencing/tree/f29bb83eda) | Structured frequency-detection experiments and recorded observations | Phase 1 R&D only; planned 300-350 ms foil lockout includes an out-of-tolerance value; no completed scorer | Physical hypothesis experiments, placeholder test folders | Wireless research method prior art; planned constants must not enter product rules |

## FIE requirement-family comparison

### Common apparatus and electrical observations

The FIE rules describe behavior over complete weapon, body-cord, spool, connecting-cable, and piste circuits, with
specified resistance cases. That is wider than detecting a switch on a microcontroller pin.

| Requirement family | Public evidence | Gap that our specification must close |
| --- | --- | --- |
| GEN-01 through GEN-07 | OpenPiste and several Arduino projects expose A/B/C inputs; Sentinel explores phased continuity; OpenPiste calibrates ADC thresholds; ImprovedTesterAfterGenova measures equipment resistance and micro-breaks | No public project provides a complete seven-line, uncertainty-aware scoring acquisition contract plus fixture results for every FIE resistance and grounded-material case |
| Measurement uncertainty | OpenPiste calibrates divider thresholds; Marcus and Inexfensive document ambiguous ADC states | Most code converts one ADC number directly into a hit-shaped Boolean. The product must preserve value, uncertainty, phase, side, and illegal-state reason |
| Ground and piste behavior | OpenPiste and some epee projects detect guard/piste states | Public tests rarely inject 100 ohm earth paths, reel/cable resistance, blade contact, or piste continuity. These must be independent fixture axes |
| Safe failure | Few projects distinguish unavailable acquisition from an open circuit | Boot, calibration, overrun, cross-line, power, and out-of-range states must be non-scoring faults, not normal `open` observations |

The adopted seven-line and phased-acquisition behavior is specified by
[`seven-conductor-signal-contract.md`](../../seven-conductor-signal-contract.md). Sentinel and OpenPiste support the
architecture choice, but neither replaces that contract.

### Foil

Normative rows are FOIL-01 through FOIL-05.

| FIE behavior | Repository evidence | Assessment |
| --- | --- | --- |
| A break in the circulating circuit becomes an on-target red/green or off-target white signal | OpenPiste, wnew, Robinson, JC, and several derivatives implement break qualification and target classification | Happy path is common. Target context is frequently a single threshold or digital pin, with no uncertainty or full ground/blade-contact matrix |
| 13-15 ms guaranteed region and 0/200/500 ohm behavior | OpenPiste selects 13.5 ms; wnew/Robinson/JC select 14 ms; the project `timing-1` selects 13 ms | Scalar duration is widely represented. Public rule tests combining duration and resistance were not found |
| Closed-loop 200 ohm, earth 100 ohm, blade-contact behavior | OpenPiste contains calibrated thresholds and detailed states | No published automated matrix establishes all combinations. Simple digital designs cannot demonstrate these requirements without an analog fixture |
| Anti-blocking and 450-475 ohm yellow interval | OpenPiste contains yellow/resistance logic | No repository documents a reviewed uncertainty/hysteresis policy for the intentionally open 450-475 ohm interval plus boundary results |
| Same-side inhibit and 300 ms +/-25 ms after first signalled hit | Most full boxes use 300 ms; wnew descendants usually anchor the timer to a candidate/depress timestamp | The FIE anchor is the first signalled hit. Candidate start, qualification, and signal time must remain distinct; exact endpoints need a product policy |

### Epee

Normative rows are EPEE-01 through EPEE-05.

| FIE behavior | Repository evidence | Assessment |
| --- | --- | --- |
| Tip circuit completion | Nearly every epee repository implements a closure path | Pushbutton demonstrations prove only this first step |
| Reject under 2 ms; register 2-10 ms at 10 ohms; exceptional 100 ohm behavior | OpenPiste selects 6 ms; wnew/Robinson select 2 ms; JBox selects 5 ms; FossBox and Xiangyi omit qualification | Public tests combining duration and resistance were not found. The exceptional 100 ohm duration needs a bounded fixture policy |
| Both lamps under 40 ms; only first over 50 ms | OpenPiste, wnew, Robinson, JBox, and many derivatives select 45 ms; FossBox waits 40 ms | A 45 ms deterministic choice is defensible inside the tolerance. Exact 40/50 ms endpoints and the interval anchor remain open and must be versioned |
| Reject guard/piste hits through 100 ohm earth | OpenPiste, Robinson, FossBox, and some prototypes model a guard state | No inspected project publishes the complete resistance-ground matrix with independent timing and measurement uncertainty |
| Redundant lamps and loud sound | Most hobby boxes use one lamp/display region per side | Firmware alone does not demonstrate failure-independent duplicate lamps, optical output, or acoustic acceptance |

### Sabre

Normative rows are SABRE-01 through SABRE-07. Sabre is the clearest discriminator between a hobby box and an FIE-shaped
apparatus.

| FIE behavior | Repository evidence | Assessment |
| --- | --- | --- |
| Opponent conductive target, nonconductive rejection, own-equipment short must not block | OpenPiste and Copis model alternating or phased states; Robinson and Inexfensive attempt the same distinction | Marcus disabled sabre because a simultaneous ADC model cannot distinguish the required states. The product needs named excitation phases |
| Yellow own-equipment and white B/C diagnostics | OpenPiste contains yellow/white paths; Robinson explicitly substitutes incorrect colors | Most projects omit these outputs or treat them as generic off-target signals |
| 0.1-1 ms sensitivity and reject below 0.1 ms | OpenPiste selects 120 us; Copis 600 us; wnew 1 ms; Robinson performs no minimum qualification | Only a deterministic hardware pulse source and measured scan/edge latency can establish the lower boundary |
| 100 ohm external, 0-450 ohm leakage, below-250 ohm faulty guard/blade case | OpenPiste has several resistance thresholds | No public automated matrix or published uncertainty results found |
| 170 ms +/-10 ms opposite-side window | Current OpenPiste, combined wnew, Robinson, Copis, and swordsgnat use 170 ms | wnew standalone sketches, Inexfensive, Konnor, chrogram, and tkronrod retain obsolete 120 ms. Repository-level inconsistency is why constants must be centralized and versioned |
| Whipover: 4/15 ms, no more than ten interruptions, recovery | OpenPiste, Inexfensive, and Copis contain explicit history; wnew states it is missing | None supplies a complete automated interruption-count and endpoint corpus with physical evidence |
| More than 250 ohm B/C break for 3 ms +/-2 ms gives white | OpenPiste selects a 2.5 ms lower-bound implementation | Equality, persistence, recovery, and the 1/3/5 ms endpoints are generally absent from public tests |

### Output, clock, and power

The catalog is dominated by contact-detection projects, while the FIE apparatus contract also covers persistent visual
signals, weapon-specific audio, extension lamps, clock resolution and remote behavior, and power continuity.

| Requirement family | Public evidence | Gap |
| --- | --- | --- |
| OUT-01 through OUT-04 | OpenPiste, JBox, FossBox, swordsgnat, and several derivatives implement lights, audio, score, and clock | Firmware does not prove lamp visibility, 2600/1100 lumen extension outputs, failure independence, or weapon-specific audio duration |
| OUT-05 and CLOCK-01 | OpenPiste has broad protocol/clock behavior and several remote projects exist | No inspected scoring repo demonstrates the complete disconnected-audio 80-100 dB path, clock isolation, hundredth/tenth display behavior, and encrypted-radio remote gate as one acceptance set |
| PWR-01 through PWR-03 | Hardware repositories show practical supplies | Public projects rarely trace 12 V tolerance, official-competition UPS backup, five-minute continuity, brownout, and fail-safe output behavior to evidence |

## Recurring defects and design lessons

1. **Three scalar timings are not the rules.** The common `depress[]`/`lockout[]` arrays omit resistance, target context,
   grounded material, fault lamps, sabre contact history, audio, and power behavior.
2. **Repository variants drift.** wnew contains 170 ms in the combined sketch and 120 ms in weapon-specific sketches.
   A released apparatus must load one immutable timing-table revision.
3. **Simultaneous analog inference creates ambiguous states.** Inexfensive reports unreliable foil/sabre behavior and
   Marcus disables sabre. Phased excitation and explicit relation records are required.
4. **UI and networking must not own scoring.** OpenPiste demonstrates how much product behavior surrounds the weapon
   engine, but protocol tests cannot substitute for decision tests. The scoring MCU emits immutable decisions; display,
   remote, MQTT, BLE, and ESP-NOW consumers cannot invent or reclassify them.
5. **Wireless latency is only one variable.** A radio message delivered inside a 300 ms foil window does not prove the
   originating contact met duration, resistance, target, ground, ordering, and synchronized-time requirements.
6. **Manual bench success is useful but not a verdict.** Copis and JC provide honest bench evidence. The production
   tester must add calibrated resistance, pulse duration, cross-line, output observation, automated expected outcomes,
   and uncertainty.
7. **Absence of a license blocks code reuse.** Technical ideas can inform a clean implementation, but code from
   `None observed` or proprietary repositories must not be copied. GPL code also requires an explicit product licensing
   decision before reuse.

## Prior-art adoption ledger

| Reference | Adopt as an idea | Do not adopt as authority |
| --- | --- | --- |
| OpenPiste current | Calibrated thresholds, separated weapon modules, sabre history, protocol/product feature inventory | Threshold values, endpoint choices, test sufficiency, or FIE claim |
| wnew family | Small readable candidate/qualification/lockout shape and inexpensive circuit concepts | Duplicated constants, 120 ms variants, missing whipover, or README completion percentages |
| Sentinel | Phased continuity scanning, topology observation, host simulation, physical settling measurement discipline | A scoring outcome, because no weapon engine exists |
| Copis | Alternating sabre observation and explicit interruption history | Untested whipover acceptance or current indicator behavior |
| JC timing jig, Ajax tester, and ImprovedTesterAfterGenova | Independent tester separation, boundary sweeps, calibrated resistance, micro-break detection, and field-operator feedback | Visual/manual scoring-box verdicts, equipment-only results, or timing-only coverage |
| JBox, FossBox, swordsgnat, OpenPiste product layer | Score, clock, remote, display, protocol, and enclosure feature inventory | Any transfer of scoring authority away from the deterministic scoring core |
| Wireless experiments | Failure modes, latency budgeting, local timestamp need, grounding difficulty | A claim that radio delivery inside lockout equals a valid hit |

The resulting project behavior is consolidated in
[weapon-scoring-programming-specification.md](../weapon-scoring-programming-specification.md). Exact definitions,
calculations, endpoint policies, and pinned code witnesses are in the
[scoring calculation implementation guide](../scoring-calculation-implementation-guide.md). Their requirements trace
to FIE rows and project contracts, not to a public repository.
