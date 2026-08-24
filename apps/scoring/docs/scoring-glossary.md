# Scoring apparatus glossary and units contract

**Contract:** M0-02
**Status:** baseline naming contract for review
**Scope:** the electrical scoring boundary, deterministic scoring records, replay scenarios, and their evidence

This document defines the words, symbols, and units used by the scoring apparatus. It is a contract for software,
firmware, electrical design, scenarios, protocol records, user interface copy, and evidence. A term in this document
has one meaning. A convenient synonym must not be introduced in a rule table or a machine-readable record.

## Authority and separation of terms

The August 2026 English FIE Material Rules, Book 3, in
[`fie-material-rules-2026-08-en.pdf`](fie-material-rules-2026-08-en.pdf) are the normative authority. The local source
has SHA-256 `1489D28ED6F3C91E27ECDF75BB29B4ED65C688A012F544D37D946A9DA81AFC26`. The cross-reference and page numbers
in this contract use [`fie-traceability-matrix.md`](fie-traceability-matrix.md), whose page references are the printed
pages in that PDF.

The following order is mandatory:

1. FIE article or Annex B wording is the rule.
2. A product rule table may choose a deterministic point inside an FIE tolerance, but must identify that choice as a
   product implementation decision. It must not call the choice an FIE limit.
3. A measurement, comparison capture, homologation test, or venue trial is evidence of an implementation. It does not
   change the rule.
4. The Favero FA-15 documents in this folder are prior art. They are not authority for a rule, threshold, endpoint,
   circuit topology, or power requirement.

FIE terms and product terms are deliberately separate. For example, the FIE phrase **valid hit** is mapped to the
product classification `on-target` only after the declared electrical state and rule table qualify it. FIE's **non-valid
hit** is mapped to `off-target` for product display and records. A candidate is never a hit merely because it resembles
one electrically.

## Units and notation

### Time

All time used by scoring, acquisition, replay, protocol decisions, and deterministic scenarios is an integer number of
microseconds. The unit is written `us` in code and prose, and as `µs` when a human-facing FIE value is quoted.

| Quantity | Canonical form | Meaning and rule |
| --- | --- | --- |
| Instant on the scoring clock | `atUs` | Non-negative integer microseconds on the monotonic scoring timeline. The timeline is scoped by `scoringBootId`. |
| Elapsed duration | `durationUs`, `contactDurationUs`, or another field ending in `DurationUs` | Non-negative integer microseconds. Never store an elapsed time as a fractional millisecond or second. |
| Start or end instant | `startedAtUs`, `qualifiedAtUs`, `capturedFromUs`, `capturedThroughUs`, `lockoutEndsAtUs` | Integer microseconds on the same monotonic timeline as the associated sample or decision. |
| Wall-clock instant | `wallAtUs` | Integer microseconds since the Unix epoch, used only for provenance, logs, and human correlation. It never drives a scoring decision. |
| FIE display time | display-only conversion | A UI may show milliseconds, seconds, hundredths, or tenths as required by FIE. The source record remains in integer microseconds. |

`atUs` values are non-decreasing within one scoring boot. Equal timestamps are allowed when several observations share a
timer capture. A value that moves backwards is a clock or record fault, not a negative duration. JavaScript or TypeScript
implementations must use safe integers for these values and reject fractions, negative values, and unsafe integers.

The monotonic timeline measures ordering and elapsed electrical behavior. It may start at zero after a boot and may not be
compared directly across boots. The tuple `(scoringBootId, atUs)` identifies an instant in evidence. A wall clock or RTC
may jump, be unset, or be corrected by network time. It is never a substitute for `atUs`, and a field named only
`timestamp` or `time` is prohibited.

### Electrical quantities

Every electrical quantity carries its unit in the field name or in a typed unit object. Bare fields such as `resistance`,
`voltage`, `current`, or `capacitance` are prohibited in machine-readable contracts.

| Quantity | Canonical machine unit and field pattern | Human notation |
| --- | --- | --- |
| Resistance | integer `resistanceMilliOhms` | `R = 200 Ω` |
| Voltage | integer `voltageMillivolts` | `12 V` |
| Current | integer `currentMicroamps` | `250 µA` |
| Capacitance | integer `capacitanceNanofarads` | `100 nF` |
| Power | integer `powerMilliwatts` | `500 mW` |
| Frequency | integer `frequencyMilliHertz` when a measured frequency is needed | `1 kHz` |

The machine unit is a representation choice and does not change the FIE value. For example, `200 Ω` is encoded as
`200_000` in `resistanceMilliOhms`. A resistance result also carries its measurement uncertainty when the value is
used at a boundary. Do not round a value toward a desired rule outcome.

The following mathematical wording is preserved exactly in meaning:

| Wording | Required interpretation |
| --- | --- |
| `less than x` or `below x` | Strictly `< x`; equality is not included. |
| `more than x` or `in excess of x` | Strictly `> x`; equality is not included. |
| `at most x` | `≤ x`; equality is included. |
| `up to x` | Preserve the FIE clause and declare the product endpoint policy before implementation. Do not silently turn it into either `< x` or `≤ x`. |
| `between a and b` | Copy the source wording and state whether the product rule uses `(a,b)`, `[a,b]`, or another endpoint policy. If the source does not decide the endpoints, equality is `indeterminate` until reviewed. |
| `x ± y` | A tolerance around a nominal value, not permission to use a rounded or floating-point comparison. Record the lower and upper boundaries in integer microseconds or the declared electrical unit. |

For an uncertain measurement, represent the measured interval and unit. If that interval overlaps a decision boundary,
the result is `indeterminate`; it is not silently assigned to either side of the boundary.

### Boundary values from the FIE matrix

These conversions are exact. They are reference points, not a complete rule table and not endpoint decisions.

| Weapon or apparatus behavior | FIE wording and exact reference | Integer microsecond or electrical reference points |
| --- | --- | --- |
| Foil break sensitivity | `14 ms ± 1 ms`, valid registration guaranteed for `13–15 ms`; Annex B A.1(b).1-A.1(b).3, pp. 78-79 | `13_000`, `14_000`, and `15_000 us`; resistance bands `0 Ω`, `200 Ω`, and `500 Ω` |
| Foil closed and earth paths | Closed-circuit resistance up to `200 Ω`; foil earth resistance up to `100 Ω`; Annex B A.1(b).4-A.1(b).6, pp. 78-79 | `200_000` and `100_000` milliohms; contacts between blades are tested at the measured resistance and must not be normalised |
| Foil anti-blocking insulation indication | Valid hit up to `200 Ω`, non-valid above `200 Ω`; yellow on below `450 Ω` and never on above `475 Ω`; Annex B A.2, p. 79 | Strict `<450 Ω` for automatic yellow-on and strict `>475 Ω` for automatic yellow-off guarantee; the `450-475 Ω` band is `indeterminate` until INT-04 is closed |
| Foil event window | `300 ms ± 25 ms` after the first hit signalled; Annex B A.1(a).6, p. 78 | `275_000`, `300_000`, and `325_000 us` |
| Epee contact | Reject less than `2 ms`; normal external resistance `10 Ω`, contact duration `2–10 ms`; Annex B B(c), p. 80 | `2_000` and `10_000 us`; `10_000` and `100_000` milliohms |
| Epee grounded material | Guard or conductive piste must not signal even with `100 Ω` in the earth circuit; Annex B B(d), p. 80 | `100_000` milliohms; this is a non-registration rule, not a normal target resistance |
| Epee double-hit tolerance | Less than `40 ms` versus greater than `50 ms`; Annex B B(b), p. 80 | `40_000` and `50_000 us`; endpoint handling is open in INT-02 |
| Sabre contact sensitivity | `0.1–1 ms`; Annex B C(b).1, pp. 81-82 | `100` and `1_000 us`; a registration below `100 us` is rejected by the cited requirement |
| Sabre external and insulation-fault paths | External connection resistance up to `100 Ω`; yellow fault indication for `0–450 Ω`; faulty guard or blade hit allowed below `250 Ω`; Annex B C(b).2-C(b).3, p. 82 | `100_000`, `450_000`, and `250_000` milliohms; preserve the FIE endpoint wording |
| Sabre opposite-side interval | `170 ms ± 10 ms`; Annex B C(a).8, p. 81 | `160_000`, `170_000`, and `180_000 us` |
| Sabre through-the-blade behavior | `0–4 ms (+1 ms)` and prevent registration `4–15 ms (+5 ms)`; Annex B C(b).5, p. 82 | `0`, `4_000`, `5_000`, `15_000`, and `20_000 us`; endpoint and tolerance interpretation is open in INT-05 |
| Sabre whipover recovery | `15 ms ± 5 ms`; Annex B C(b).6, p. 82 | `10_000`, `15_000`, and `20_000 us` |
| Sabre control-circuit break | More than `250 Ω` for `3 ms ± 2 ms`; Annex B C(b).7, p. 82 | strict `>250 Ω`; `1_000`, `3_000`, and `5_000 us`; equality and endpoint handling is open in INT-06 |
| Spool and connecting cable | Each spool wire at most `3 Ω` socket-to-socket and each connecting cable wire at most `2.5 Ω`; FIE m.55.1-m.55.7 and m.56.1-m.56.3, p. 47 | `3_000` and `2_500` milliohms, including the declared connector and harness scope |
| Conductive piste | End-to-end resistance at most `5 Ω` and centre earthed; FIE m.57.1-m.57.2, m.57.4, and m.57.6, p. 48 | `5_000` milliohms; the centre bond and continuity are measured inputs |
| Apparatus source | `12 V ± 5%` or the allowed separate supply arrangements; FIE m.58.1-m.58.3, p. 49 | `11_400` to `12_600 mV` for the nominal `12 V` input range; product rail values remain separate |

The selected `45_000 us` epee lockout in the current `EPEE_RULES` source is an implementation choice inside the FIE
40-50 ms tolerance. It is not an FIE constant. The current `contactTimeUs: 2_000` is an implementation representation of
the FIE minimum and remains subject to the rule-table and uncertainty decisions in M1-01 and M1-02.

## Sides, conductors, and ground

### Sides

`left` and `right` are the only canonical side identifiers. They identify the two apparatus positions and are independent
of fencing priority, referee interpretation, or the color of a lamp. The side mapping to FIE red and green outputs is a
declared apparatus configuration and must not be hard-coded as `left = red` or `right = green`.

`side` is not a synonym for `competitor`, `fencer`, `player`, `team`, or `color`. Those may be domain labels outside the
electrical decision, but a scoring record uses `side: "left"` or `side: "right"`.

### Seven logical conductors

The product boundary has seven logical external lines. This is a logical naming set, not a released connector pinout:

| Logical identifier | Meaning | Constraint |
| --- | --- | --- |
| `left.A` | A conductor associated with the left side | A, B, and C are logical conductor identities, not left/right labels or physical pin numbers. |
| `left.B` | B conductor associated with the left side | FIE Annex B C(a).6 explicitly names circuits B and C when describing an abnormal electrical change. |
| `left.C` | C conductor associated with the left side | The exact excitation and physical mapping are M0-03 decisions. |
| `right.A` | A conductor associated with the right side | Do not infer a side from the letter A. |
| `right.B` | B conductor associated with the right side | Map FIE's “circuits B and C of the fencer at fault” to the declared side mapping in evidence. |
| `right.C` | C conductor associated with the right side | The mapping must be reviewed with the electrical owner. |
| `piste` | Shared conductive piste and its declared ground reference | This is not protective earth, chassis earth, signal ground, or a processor ground pin. |

`A`, `B`, and `C` are conductor identifiers. They are not three weapon types, three sides, three sensors, or three
physical connector pins. `piste` is the canonical product name for the shared conductive piste conductor. Use
`pisteGrounded` for a measured ground state and `pisteResistanceMilliOhms` for its measured resistance.

FIE m.56-m.57 use conductive piste, earth, and earthed material in their own rule context. In product records,
**grounded** means that the measured state connects to the declared earthed material or piste reference. **Protective
earth** is a mains-safety term and must never be substituted for a piste state. The FIE definition of earthed material
does not release M0-03 from defining excitation phases, isolation, illegal states, and safe inactive behavior.

The seven-line topology, physical harness mapping, pin keying, and any galvanic relationship remain M0-03 and M4-13
deliverables. A design must not assign a hidden physical meaning to `A`, `B`, `C`, or `piste` merely because a comparison
machine has seven sockets.

### Common electrical states

These are observations, not scoring outcomes:

| Canonical state | Meaning |
| --- | --- |
| `open` | The declared circuit path is not electrically closed within its test conditions. |
| `closed` | The declared circuit path is electrically closed within its test conditions. |
| `grounded` | The observed path is connected to the declared earthed guard or conductive piste reference. |
| `crossLine` | A conductor is connected to another logical conductor when the declared phase does not permit that connection. |
| `outOfRange` | A measured electrical quantity is outside the declared fixture, ADC, or rule measurement range. |
| `indeterminate` | The available measurement and uncertainty cannot distinguish the states needed by the rule. |
| `unavailable` | No trusted observation is available because the scorer is booting, reset, faulted, uncalibrated, or otherwise not ready. |

`safeInactive` is a hardware output state, not an electrical reading. It means that the output driver cannot assert a hit,
diagnostic lamp, or audible signal while the owner is unavailable. It must not be interpreted as `open`, `closed`, or
`grounded` on an input line.

## Weapon terms and FIE mappings

The FIE source uses `valid`, `non-valid`, `on target`, and `off the target` in different clauses. The source wording is
retained below, while the product event vocabulary remains explicit.

| Weapon | FIE normative concept | Canonical product term | Not implied |
| --- | --- | --- | --- |
| Foil | A break in the permanently circulating foil-circuit current registers a hit. A valid hit is on target; a non-valid hit is off target. Annex B A.1(a).1-A.1(a).3, pp. 77-78 | `foilCircuitBreak`; decision classification `on-target` or `off-target` | A circuit break alone does not establish target classification, resistance compliance, or a registered hit. |
| Foil | The conductive jacket is the target context. The foil earth circuit and guard or piste contacts are non-target or fault cases under A.1(b).4-A.1(b).6, pp. 78-79 | `foilTarget`, `foilGrounded`, `foilInsulationFault` | `earth` does not mean protective earth, and a blade or point touching a jacket without depression is not automatically a hit. |
| Epee | Contact between the wires forming the epee circuit completes the circuit. Hits on earthed material, the guard, or conductive piste must not signal. Annex B B(a), B(d), pp. 80-81 | `epeeCircuitComplete`, `epeeTipContact`, `groundedMaterialRejection` | `isTipClosed` in the current source is an input observation, not a qualified hit. |
| Epee | A contact must meet the applicable duration and resistance behavior. The first hit starts the apparatus timing window. Annex B B(b)-B(c), p. 80 | `epeeCandidate`, `qualifiedHit`, `epeeLockout` | The current `45_000 us` lockout is not an FIE constant, and referee priority is not represented. |
| Sabre | Contact between any uninsulated sabre part and the opposing conductive jacket, glove, or mask is a valid-target context. Annex B C(a).1-C(a).4, p. 81 | `sabreTargetContact`, `validTarget`, `nonConductiveSurfaceRejection` | A conductive target is not inferred from a software boolean without a declared measured state and uncertainty. |
| Sabre | Contact between a guard or blade and the fencer's own conductive equipment is indicated by yellow, while a valid hit by that fencer still registers. Annex B C(a).2 and C(a).5, p. 81; C(b).3, p. 82 | `sabreOwnEquipmentFault` | The yellow diagnostic is not a hit and does not by itself inhibit a valid hit. |
| Sabre | A blade whipping over while touching the opponent's blade or guard must not signal; normal subsequent registration resumes after the specified recovery condition. Annex B C(a).7-C(a).9 and C(b).5-C(b).6, pp. 81-82 | `whipoverRejection`, `bladeContact`, `whipoverRecovery` | `whipover` is not a generic debounce or a timeout. It is a weapon-specific electrical sequence. |
| Sabre | An abnormal electrical change in circuits B and C and a control-circuit break have white-lamp diagnostic behavior. Annex B C(a).6 and C(b).7, pp. 81-82 | `sabreCircuitBCFault`, `controlCircuitBreak`, `whiteDiagnostic` | A white diagnostic is not a non-valid hit, a transport error, or evidence that the circuit is open in every physical phase. |

`registered` means that the apparatus has fulfilled the applicable electrical rule and creates a signal event. `signalled`
means that an output event was emitted or latched. `qualified` means that the deterministic scorer has satisfied its
declared rule conditions. None of these terms decides fencing priority or the referee's score.

## Samples, readings, transitions, and outcomes

### Observations and time progression

| Term | Canonical definition | Required distinction |
| --- | --- | --- |
| `reading` | One observation of one conductor or one named weapon input at one `atUs`, including state, measured values, and uncertainty where applicable | A reading is not a whole-device sample. |
| `sample` | A time-indexed snapshot containing the readings needed by the scorer for both sides and the selected weapon | A sample is not a hit and does not imply that an unobserved transition did not occur between samples. |
| `replay sample` | The immutable encoded form of a sample used to reproduce a decision | The current `ReplaySample` with `packedInputs` is an encoded representation, not a substitute for the logical line contract. |
| `transition` | A state change observed between consecutive samples or captured by an edge timer | Do not invent a transition time between samples. If the edge is bounded only by samples, carry the interval as timing uncertainty. |
| `candidate` | A contiguous rule-shaped interval that has begun but has not yet met all duration, resistance, target, or lockout conditions | A candidate is not a hit, signal, score, or lamp event. In the current epee state it is represented by `candidateSinceUs`. |
| `qualified hit` | A candidate that satisfies the released weapon rule table at `qualifiedAtUs` | Qualification is an STM32 scoring decision. The ESP32 cannot create, edit, or reclassify it. |
| `registered hit` | A qualified hit that the apparatus records as a signal event under the FIE behavior | This is not a referee priority decision. |
| `rejection` | A measured or candidate contact that is intentionally not registered because a stated rule condition failed | Record the reason and supporting samples. Do not use rejection to hide a measurement fault. |
| `fault` | A condition that prevents trusting the required input, clock, firmware, power, transport, calibration, or output state | A fault is not a rejected hit. It normally produces a diagnostic or unavailable result and never fabricates a hit. |
| `noSignal` | No apparatus signal was produced for the observed interval | It is an outcome description, not a reason. The record must distinguish a rule rejection, a fault, and unavailable acquisition. |
| `indeterminate` | Evidence is present but cannot classify a boundary or state within declared uncertainty | It is not the same as `noSignal`, `unknown`, or `unavailable`. |

Use a weapon-qualified name when `contact` could be ambiguous: `epeeTipContact`, `foilCircuitBreak`,
`sabreTargetContact`, `bladeContact`, or `guardGroundContact`. The unqualified words `contact`, `touch`, and `hit` are
prohibited in a rule field or protocol message unless the type supplies the weapon and outcome context.

### Decision record vocabulary

The current source provides the epee scoring baseline in [`epee.ts`](../src/epee.ts) and the canonical immutable-record
boundary in [`decision-record.ts`](../src/decision-record.ts), with authority and receiver behavior covered by
[`virtual-stm32.ts`](../src/virtual-stm32.ts) and [`virtual-esp32.ts`](../src/virtual-esp32.ts):

| Current source term | Contract meaning | Boundary |
| --- | --- | --- |
| `EpeeContact.isTipClosed` | An epee input observation that the tip circuit is closed | It is not a qualified hit and does not prove target validity. |
| `EpeeContact.isGrounded` | An epee input observation that the guard or piste path is grounded | It produces a grounded-material rejection when the rule says it must not signal. |
| `EpeeSample.atUs` | Monotonic sample instant in integer microseconds | It must not be replaced with wall time. |
| `EpeeScoringState.candidateSinceUs` | Start instant of a currently continuous candidate | Clearing it means the candidate was broken or rejected; it does not create a rejection record by itself. |
| `EpeeHit.startedAtUs` | Candidate start instant | It is not necessarily the lamp or protocol emission instant. |
| `EpeeHit.qualifiedAtUs` | Instant at which the candidate met the current epee rule table | It is not a wall-clock timestamp. |
| `DecisionRecord.rawCaptureRefs` | Immutable content-addressed references to retained replay, calibration, fault, or reset evidence | References are evidence and must not be rewritten when rendered by the ESP32. |
| `DecisionRecord.captureWindow.fromUs` and `throughUs` | Inclusive bounds of the evidence considered by the authority | The bounds use the monotonic scoring clock. |
| `DecisionRecord.outcome` | The authority's already-decided qualified, rejected, diagnostic, calibration, reset, or uncertainty result | The ESP32 preserves the outcome and never re-runs a weapon scorer. |

The current source's `classification: "on-target"` is a product implementation term. It is not the literal FIE phrase
`valid hit`; the record must retain enough electrical evidence to support the mapping. A future off-target record uses
`off-target`, while FIE citations should continue to say `non-valid hit` where that is the source wording.

## Identity, ordering, and revision fields

| Identity or field | Canonical meaning | Required behavior |
| --- | --- | --- |
| `scoringBootId` | Unique identity of one STM32 scoring-authority boot interval | It scopes `atUs` and `sequence`. A processor reset, watchdog reset, brownout, or update must create an explicit boot/reset record and must not silently continue a previous boot's identity. |
| `sequence` | Integer protocol order of a decision or diagnostic event within a scoring boot | It is not elapsed time and is not globally unique without `scoringBootId`. The receiver accepts each expected next sequence once and records gaps, duplication, and reordering as transport outcomes. |
| `sequenceRange` | Inclusive first and last sequence numbers represented by an evidence record | It describes record coverage, not hit timing. |
| `firmwareIdentity` | Human and build identity of the firmware image that made the decision | It must be non-empty and stable for the build. A label alone is not a cryptographic proof. |
| `firmwareDigest` | Digest of the exact firmware image or approved immutable image manifest | The current record uses a `sha256:` prefix. The digest is the authoritative image identity for evidence. |
| `ruleRevision` | Identity of the weapon rule table, endpoint policies, uncertainty policy, and source edition used by the scorer | It must include the cited FIE edition and product decision revision. It is independent of firmware identity. |
| `timingRevision` | Current source field carrying the selected timing-table identity | Until M0-05 freezes the expanded decision-record schema, it must not be used to imply a complete rule revision or an FIE approval. |
| `protocolVersion` | Compatibility identity of the encoded message contract | An unknown or incompatible protocol version fails closed. It is not a rule revision and is not a firmware version. |
| `type` | Explicit message or record kind such as `decision-record` | A receiver must not infer the record kind from which fields happen to be present. |

The identity tuple for replay is `(protocolVersion, scoringBootId, sequence, ruleRevision or timingRevision,
firmwareDigest)`, with the applicable field recorded explicitly. Do not call any one of these fields `id`, `version`, or
`revision` without the qualified name.

## Uncertainty and measurement boundaries

Every boundary measurement has a declared quantity, unit, measured value or interval, instrument or estimator identity,
calibration status, and uncertainty. Timing uncertainty includes sample period, timer quantisation, interrupt or DMA
latency, and any unknown transition interval. Electrical uncertainty includes instrument error, source resistance,
connector and harness resistance, ADC/comparator error, temperature, and calibration state.

Use these result names:

| Result | Use |
| --- | --- |
| `withinRange` | The complete uncertainty interval is inside the declared accepted region. |
| `outsideRange` | The complete uncertainty interval is outside the declared region. |
| `atBoundary` | The nominal value equals a named boundary. This is descriptive; endpoint inclusion still comes from the rule table. |
| `indeterminate` | The interval overlaps a boundary or contains contradictory observations. No hit or clear state may be inferred. |
| `unavailable` | The measurement could not be trusted or was not acquired. This is a safe diagnostic state, not a rule result. |

Do not use `approx`, `near`, `probably`, `valid`, or `invalid` as a substitute for a quantified uncertainty result.
`valid` and `non-valid` retain their FIE scoring meaning only when the weapon rule has made that decision; schema
validation must use `accepted`, `rejected`, or an explicit parse error.

The FIE matrix intentionally leaves several interpretations open: the seven-line phases and topology (INT-01), epee
40/50 ms endpoints and anchor (INT-02), the finite 100-ohm epee test envelope (INT-03), foil 450-475-ohm behavior
(INT-04), sabre timing endpoints (INT-05), and sabre B/C fault persistence (INT-06). The glossary supplies names for
those decisions but does not close them. A rule implementation must emit `indeterminate` or `unavailable` when a pending
decision prevents a safe classification.

## Reset and safe unavailable states

The following reset terms are distinct:

| Term | Meaning | Scoring consequence |
| --- | --- | --- |
| `boutReset` | Explicit supervisor action that begins a new bout or weapon state | Clears scoring candidates, lockout, and output latches only through the reviewed reset path. It emits a reset record. |
| `supervisorReset` | Physical or authenticated control reserved for the designated supervisor | This is the only reset authority that may clear a latched hit indication unless a later reviewed contract says otherwise. |
| `processorReset` | Reset of the STM32 or ESP32 processor caused by reset input, software, or independent supervisor | It is not automatically a bout reset and never creates a hit. It creates a boot/reset diagnostic and a new boot identity for the affected authority. |
| `watchdogReset` | Processor reset caused by watchdog expiry | Scoring is unavailable until self-test and input safety checks pass. The cause is retained in evidence. |
| `brownoutReset` | Reset or shutdown caused by supply voltage below the declared operating range | Outputs are safe inactive and no decision is generated during the unavailable interval. Power measurements and reset cause are evidence. |
| `powerCycle` | Loss and restoration of the apparatus supply | Treat as a new boot and preserve durable records according to the power-state contract. |
| `updateReset` | Reset associated with an approved firmware update or rollback | The new firmware identity and digest are recorded before scoring can become available. |
| `factoryReset` | Destructive configuration reset | It is not a bout reset and must not erase immutable decision evidence without a separately authorized retention procedure. |

During boot, reset, self-test, missing calibration, invalid timing table, line fault, clock fault, malformed input,
unknown protocol version, or power fault, the scoring authority state is `unavailable`. The required safe behavior is:

- no qualified or registered hit is created;
- no candidate is promoted to a hit;
- output drivers are `safeInactive` until their owner has passed self-test;
- the unavailable reason, boot identity, reset cause, and relevant measurements are recorded when storage is available;
- a previous latched signal is not silently reinterpreted as a new hit or silently cleared as a side effect of an ESP32
  reset; the explicit supervisor reset path owns clearing it;
- the ESP32 may show an unavailable or diagnostic state, but it may not invent, alter, or reclassify an STM32 decision.

`safeInactive` does not mean that the physical input is open. It is an output safety state. The exact output polarity,
excitation phases, current limits, and restoration behavior belong to M0-03, M0-04, and M0-10.

## Naming rules by artifact

### Code

- Use `left` and `right` for sides and `A`, `B`, `C`, and `piste` for logical conductor identities. Never use `A` and
  `B` as side names.
- Suffix every internal time field with `AtUs`, `SinceUs`, `ThroughUs`, `UntilUs`, or `DurationUs`. Use `wallAtUs` only
  for UTC provenance. A bare `time`, `timestamp`, `delay`, or `timeout` is prohibited.
- Use `resistanceMilliOhms`, `voltageMillivolts`, `currentMicroamps`, `capacitanceNanofarads`, and other explicit unit
  names. A bare `resistance` or `voltage` is prohibited.
- Use `candidate`, `qualifiedHit`, `registeredHit`, `rejection`, `fault`, `indeterminate`, and `unavailable` with their
  defined meanings. Do not name a candidate `hit` or a fault `invalidHit`.
- Prefix state booleans with `is` only when the state is a direct observation, such as `isGrounded` or `isTipClosed`.
  Do not use `isValid` for a scoring outcome or a schema parse result.
- Keep `firmwareIdentity`, `firmwareDigest`, `scoringBootId`, `sequence`, `ruleRevision`, `timingRevision`, and
  `protocolVersion` separate. Do not collapse them into `version` or `id`.
- Use `sabre` in code. Use FIE's `sabre` spelling in normative prose and do not introduce `saber` as an alias.

### Scenarios and golden vectors

- Express every instant and duration as integer `us` fields. A scenario must not call a wall-clock sleep or rely on test
  execution speed.
- Identify the side and logical conductor for every reading and transition. State the endpoint operator for every
  boundary case and include below, at, and above vectors where a source or product rule requires them.
- Distinguish `expectedEvents` from `expectedNonEvents`. An expected non-event must include the reason category when the
  rule is known, or `indeterminate` or `unavailable` when it is not.
- Include weapon, rule identity, firmware identity where applicable, reset or boot identity, resistance unit, timing
  unit, and uncertainty. Never use labels such as `normal`, `edge`, `bad`, or `almost-hit` without the measured state.

### Protocol

- Include an explicit `protocolVersion` and `type` in every message. Include `scoringBootId` and `sequence` for scoring
  and diagnostic events.
- Preserve immutable samples or readings used for a decision. Include `capturedFromUs` and `capturedThroughUs` when a
  bounded replay window is present.
- Record `ruleRevision`, `firmwareIdentity`, and `firmwareDigest` for every decision. The current epee baseline's
  `timingRevision` remains a timing identity and is not an FIE approval claim.
- Reject unknown incompatible versions, malformed units, fractional times, unsafe integers, missing identities, CRC
  failures, duplicated sequences, and reordered sequences. Do not reinterpret them as no hits.

### User interface

- Use **on target** and **off target** only for a completed product classification. Use FIE's **valid hit** and
  **non-valid hit** when explaining the rule, not as a generic success or failure label.
- Show **grounded material**, **line fault**, **measurement indeterminate**, and **scoring unavailable** as distinct
  states. Do not show `invalid`, `unknown`, or `no hit` when the system is unavailable.
- Use **red**, **green**, **white**, and **yellow** only for their declared FIE signal or diagnostic meanings. Do not
  use color to infer left or right without displaying the configured side mapping.
- A candidate, transition, line reading, and diagnostic lamp are not presented as a hit. A reset is not presented as a
  new bout unless it is an explicit `boutReset`.

### Evidence

Every decision, rejection, fault, calibration report, and comparison capture names:

- the FIE source edition, article or Annex B paragraph, and printed page;
- the product rule or timing identity and the apparatus or hardware revision;
- the firmware identity and digest, scoring boot identity, and sequence or sequence range;
- the immutable readings or replay samples with integer microsecond instants;
- resistance and other electrical units, calibration state, measurement uncertainty, and boundary policy;
- reset cause, power state, line state, output state, and unavailable reason where applicable; and
- whether the statement is normative FIE behavior, a product implementation choice, a measured result, or prior-art
  comparison.

Evidence must not claim FIE approval, homologation, or compliance merely because a vector passed. The traceability
matrix remains the index for the normative rows: GEN-01 through GEN-07, FOIL-01 through FOIL-05, EPEE-01 through
EPEE-05, SABRE-01 through SABRE-07, OUT-01 through OUT-05, CLOCK-01, and PWR-01 through PWR-03.

## Prohibited or ambiguous synonyms

The following words are reserved or disallowed in a scoring contract unless the surrounding type makes the defined
meaning explicit:

| Avoid or qualify | Use instead |
| --- | --- |
| `A`, `B`, or `C` as a side | `left` or `right`; use `left.A`, `right.B`, and so on for conductors |
| `line`, `wire`, `pin`, and `circuit` interchangeably | `conductor` for the logical or physical electrical path, `circuit` for the declared functional loop, and `pin` only for a released connector assignment |
| `earth`, `ground`, `GND`, and `piste` interchangeably | `protectiveEarth`, `signalGround`, `piste`, or `grounded` with the specific declared meaning |
| Generic `contact`, `touch`, `strike`, `point`, or `impact` | `epeeTipContact`, `foilCircuitBreak`, `sabreTargetContact`, `candidate`, or `qualifiedHit` |
| Generic `hit` for an observation or candidate | `reading`, `transition`, `candidate`, `qualifiedHit`, or `registeredHit` |
| `valid` or `invalid` for schema parsing | `accepted`, `rejected`, or a named parse error; reserve FIE `valid` and `non-valid` for scoring meaning |
| `on-target` or `off-target` as if they were FIE source words everywhere | Use those as product classifications, and cite FIE `valid hit` or `non-valid hit` where applicable |
| `fault`, `rejection`, `no signal`, and `unavailable` as one state | Record the defined reason category and supporting evidence |
| `lockout`, `timeout`, and `debounce` interchangeably | Use `lockout` for a weapon rule inhibition, `timeout` for a bounded service or transport interval, and `debounce` only for an explicitly reviewed input filter |
| `time`, `timestamp`, or `date` in a scoring record | `atUs` for monotonic scoring time or `wallAtUs` for wall-clock provenance |
| `reset`, `reboot`, `clear`, and `new bout` interchangeably | `boutReset`, `supervisorReset`, `processorReset`, `watchdogReset`, `brownoutReset`, `powerCycle`, or `updateReset` |
| `unknown`, `uncertain`, `indeterminate`, and `unavailable` interchangeably | Use `indeterminate` for unresolved measurement classification and `unavailable` for absent or untrusted acquisition |
| `saber` in code or protocol | `sabre` |
| `fencer score`, `priority`, or `winner` in the STM32 decision | `side`, `qualifiedHit`, `registeredHit`, or an application/referee result outside this boundary |
| `FIE-approved`, `homologated`, or `compliant` for a passing test vector | `FIE requirement exercised`, `product test passed`, or the exact approval evidence obtained |

This contract does not prohibit natural-language explanation in a referee or training context. It prohibits using an
ambiguous explanation as a machine-readable rule, identity, unit, or evidence field.

## Handoff and review gates

M0-02 establishes names and units only. It does not close the physical conductor topology, excitation phases, exact
FIE endpoint inclusion, analog thresholds, or output polarity. Those decisions remain with:

- M0-03 for the seven-line signal contract, weapon phases, illegal states, and safe inactive readings;
- M0-04 for processor ownership, reset behavior, and unavailable containment;
- M0-05 for decision, rejection, fault, calibration, uncertainty, and versioned record schemas;
- M0-07 for scenario and golden-vector serialization; and
- M1-01, M1-03, M1-04, and M1-05 for weapon-specific endpoint policies and rule tables.

Acceptance for this documentation-only task is that downstream code, scenarios, protocol records, UI, and evidence can
use these terms without inventing a synonym or unit. Review must confirm that every selected FIE endpoint policy cites
the matrix row and is labeled as a product choice when the FIE source leaves it open.
