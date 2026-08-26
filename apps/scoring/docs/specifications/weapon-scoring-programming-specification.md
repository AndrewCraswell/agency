# Weapon-mode and scoring-apparatus programming specification

**Status:** normative project programming baseline derived from the August 2026 FIE Material Rules

**Applies to:** deterministic scoring core, acquisition firmware, apparatus outputs, replay model, and independent tester

**Does not apply to:** referee priority decisions, automatic point awards, tournament ranking, or unreviewed wireless
substitutes for body-cord observations

Electric foil, epee, and sabre weapons are normally passive electrical equipment; the weapon itself is not programmed.
This specification defines how the apparatus is programmed when a weapon mode is selected. A wireless body pack may
run firmware, but it remains an acquisition component and may not relax or redefine the apparatus behavior.

The normative source is the local
[`fie-material-rules-2026-08-en.pdf`](fie-material-rules-2026-08-en.pdf), verified by the checksum in
[`README.md`](../README.md). Rule decomposition and printed page references are in
[`fie-traceability-matrix.md`](fie-traceability-matrix.md). The immutable product timing selections are in
[`timing-table-contract.md`](../timing-table-contract.md). If this document and the FIE source differ, the FIE source wins
and this document must be corrected with the rule-derived tests.

## Authority and program boundaries

The implementation has five authorities that must remain separate:

| Authority | Owns | Must not do |
| --- | --- | --- |
| Acquisition front end | Safe excitation phases, line readings, measured resistance and uncertainty, monotonic capture time | Call a reading a hit or silently turn unavailable/ambiguous evidence into `open` |
| Deterministic scoring core on STM32 | Candidate state, duration qualification, target/ground/fault classification, lockout, decision record | Decide fencing priority, award a point, depend on network/UI availability, or accept an undocumented threshold |
| Apparatus output driver | Lamp/audio latch and reset behavior derived from a scoring decision | Create, modify, suppress, or reclassify the decision because a display or network is busy |
| ESP32/product workflow | Render decisions, clock/score/card workflow, remote commands, protocol publication, storage and replay | Originate a weapon hit or treat a stale/replayed packet as a new decision |
| Independent tester | Generate bounded electrical stimuli and observe physical outputs on its own timeline | Share scorer code, trust scorer logs as its only verdict, or infer an unobserved physical output |

The scoring decision vocabulary and immutable evidence are defined in
[`decision-record-contract.md`](../decision-record-contract.md). The processor boundary is defined in
[`processor-fault-containment-contract.md`](../processor-fault-containment-contract.md). Prior-art repositories are
cataloged in [`fencing-scoring-github-catalog.md`](prior-art/fencing-scoring-github-catalog.md); none is an authority in this table.
Exact calculation terms, timestamp anchors, endpoint policies, prior-art code witnesses, and pseudocode are in the
[`scoring calculation implementation guide`](scoring-calculation-implementation-guide.md).

## Required processing pipeline

Each acquisition cycle and candidate follows this ordered pipeline:

1. **Enter safe inactive.** No source is energized and no scoring output can be asserted by an unready processor.
2. **Select a named phase and source.** The weapon mode, side, source conductor, legal relation set, and perspective come
   from [`seven-conductor-signal-contract.md`](../seven-conductor-signal-contract.md).
3. **Settle and observe.** Record state, integer resistance, uncertainty interval, phase, side, `cycleId`, and monotonic
   `atUs`. Never fabricate an edge time between samples.
4. **Normalize observations.** Produce `open`, `closed`, `grounded`, `crossLine`, `outOfRange`, `indeterminate`, or
   `unavailable`. Preserve contradictory evidence.
5. **Advance a weapon candidate.** A candidate records its physical start bound and accumulated contiguous evidence. A
   broken continuity interval resets the applicable duration unless the weapon rule explicitly requires history.
6. **Qualify or reject.** Apply the named timing-table revision, resistance context, target/ground context, and fault
   rules. Emit the exact reason for rejection or unavailability.
7. **Apply bout-level window behavior.** The first signalled hit opens the weapon-specific opposite-side interval. Keep
   candidate start, qualification, signal, and window-end timestamps distinct.
8. **Emit and latch one immutable decision.** Record weapon, side, classification, rule/timing revision, evidence range,
   signal time, lockout state, and diagnostics.
9. **Drive physical outputs.** Visual and audible behavior derives from the latched event. Only the declared reset/rearm
   transition clears it.

The acquisition scan, UI loop, network stack, storage, audio rendering, and LED rendering must not block or perturb the
monotonic weapon-decision path enough to violate the lowest applicable timing boundary.

## Common state machine

The scoring core exposes these logical states independently of UI state:

| State | Entry | Permitted exit | Output behavior |
| --- | --- | --- | --- |
| `unavailable` | Boot, unknown revision, invalid calibration, bad clock, power fault, unsafe acquisition, or processor-link failure | Reviewed recovery into `armed` | Safe inactive; never signal a hit |
| `armed` | Valid weapon selection, complete calibration, clear outputs, trusted acquisition | `candidate`, `diagnostic`, `unavailable` | No hit lamp/audio |
| `candidate` | First rule-shaped electrical observation | `armed` on rejection/reset, `windowOpen` on first qualified signal, `unavailable` on fault | No hit output before qualification |
| `windowOpen` | First qualified and signalled hit | Remain while an allowed opposite-side candidate qualifies; then `latched`; `unavailable` on fault without clearing existing latch | First signal latched; eligible opposite side may be added |
| `latched` | Window expiry or all applicable sides resolved | `armed` only through declared reset/rearm; `unavailable` preserves evidence | Hit and diagnostic outputs remain until reset |
| `diagnostic` | Weapon-specific insulation/control condition that does not itself prevent trusted scoring | `armed`, `candidate`, or `unavailable` according to the weapon rule | Yellow/white/orange behavior is independent from point/priority workflow |

Changing weapon mode while a candidate, open window, or latched hit exists is prohibited. The product must rearm through
a recorded transition before the new mode becomes active.

## Foil mode

**FIE trace:** FOIL-01 through FOIL-05 and OUT-01 through OUT-04.

### Inputs and observations

Foil uses these named acquisition phases:

- `foil-circuit-integrity`: observe the permanently circulating own foil circuit.
- `foil-target-context`: distinguish opposing conductive target from non-target and piste/earth context.
- `foil-insulation-diagnostic`: measure own weapon-to-conductive-equipment insulation for anti-blocking diagnostics.

A break in the own circulating circuit begins a candidate. A target-context observation alone, without the qualifying
break, is not a hit. Merely touching the opponent's conductive jacket with the blade or point without depressing the
point must not signal.

### Qualification and classification

1. Require one contiguous `foilCircuitBreak` interval. `timing-1` selects `13_000 us` as the qualification floor inside
   the FIE 13-15 ms guaranteed region. Test the FIE nominal `14_000 us` and upper reference `15_000 us` separately.
2. Carry exterior resistance and uncertainty with the candidate. Exercise 0, 200, and 500 ohm reference cases; do not
   reduce them to a single digital threshold.
3. At qualification, classify a trusted opposing conductive-target path as `on-target`; classify a qualifying break
   with trusted non-target context as `off-target`.
4. A guard, piste, earth, blade-contact, cross-line, contradictory, or uncertain state follows its named rule result. It
   must not be guessed into the more convenient target class.
5. Once one side signals, inhibit any later signal from that same side during the event.
6. The first signalled on-target or off-target hit opens the opposite-side window. `timing-1` selects `300_000 us`.
   Later signals after the released boundary policy are ignored. The equality policy and signal anchor must match the
   versioned boundary vectors; they are not inferred from a repository's `micros()` comparison.
7. The scoring apparatus signals both on-target and off-target electrical results. It does not indicate right of way or
   award the point.

### Anti-blocking and diagnostics

The product's FIE-claiming mode implements FOIL-04:

- A fencer's own weapon-to-jacket insulation short must not block otherwise valid or non-valid hit registration.
- The opponent return path registers valid through 200 ohms and non-valid above 200 ohms within the rule's stated
  behavior.
- Yellow is guaranteed on below 450 ohms and guaranteed off above 475 ohms.
- The 450-475 ohm interval is `indeterminate` unless a reviewed hysteresis/uncertainty policy closes INT-04.
- Yellow is an insulation diagnostic, not a card, priority decision, or hit.

### Outputs

On-target drives the configured side's red or green valid-hit output. Off-target drives that side's white output. The
sound is identical for both sides and is a short ring or continuous note limited to no more than 2 seconds. Lamps remain
latched until reset.

## Epee mode

**FIE trace:** EPEE-01 through EPEE-05 and OUT-01 through OUT-05.

### Inputs and observations

Epee uses:

- `epee-tip-loop` for the tip circuit completion,
- `epee-ground-reference` for guard/piste/earthed-material rejection, and
- `epee-line-integrity` for contradictory or cross-line equipment states.

Tip closure begins a candidate only while grounded-material evidence is clear and acquisition is trusted.

### Qualification and double-hit behavior

1. Reject a contact shorter than `2_000 us`.
2. At normal 10 ohm external resistance, register contacts in the FIE 2-10 ms interval. `timing-1` selects
   `2_000 us` as the minimum.
3. Exercise the exceptional 100 ohm case within the finite, reviewed fixture envelope from INT-03. “Without any specific
   duration” is not permission for an unbounded test or an instantaneous noisy sample.
4. Reject hits on a guard, conductive piste, or other earthed material even with 100 ohms in the earth circuit.
5. The first qualified and signalled hit opens the opposite-side window. `timing-1` selects `45_000 us` inside the FIE
   40-50 ms tolerance.
6. An interval strictly below 40 ms must permit both hit lamps. An interval strictly above 50 ms must permit only the
   first. Exact 40 ms, exact 50 ms, and the measurement anchor follow reviewed INT-02 policy and versioned vectors.
7. Qualification of a second-side candidate uses its own contiguous duration and ground evidence. Arrival of an
   unqualified electrical edge inside the window is not a double hit.

### Outputs

Each side has at least two failure-independent valid-hit lamps, red for one configured side and green for the other.
Orange earth-short lights are optional until INT-07 is closed and never affect the hit decision. A loud sound accompanies
the visual hit; muting it before reset must not clear the visual/event latch.

## Sabre mode

**FIE trace:** SABRE-01 through SABRE-07 and OUT-01 through OUT-04.

### Inputs and observations

Sabre uses:

- `sabre-target-contact` for the acting weapon to opposing conductive target,
- `sabre-own-equipment` for the affected side's weapon-to-own-conductive-equipment path,
- `sabre-blade-contact` for blade/guard contact history, and
- `sabre-bc-control` for the affected side's B/C control-circuit state.

These phases are not interchangeable. A simultaneous voltage pattern that cannot distinguish them is
`indeterminate`, not a hit.

### Normal target qualification

1. Contact between any uninsulated part of the acting sabre and the opponent's conductive jacket, glove, or mask is a
   target candidate. A nonconductive-surface contact must not signal.
2. A valid target contact remains eligible when the acting weapon also touches its own conductive equipment.
3. Reject any pulse below `100 us`. `timing-1` selects `100 us` as the minimum and retains `1_000 us` as the published
   sensitivity test point, not as a candidate-expiry timer.
4. Exercise external connection resistance through 100 ohms and the own-equipment leakage cases at 0, 250, and 450 ohms.
   Preserve endpoint wording and uncertainty.
5. The first qualified and signalled hit opens a `170_000 us` opposite-side window under `timing-1`. Blade contact does
   not suspend the other sabre rules.

### Whipover history

Whipover is not a generic debounce. For each side, maintain an ordered history containing blade-contact start, target
contact start, every interruption interval, interruption count, target qualification, rejection, and recovery time.

- In the initial blade-contact interval, apply the reviewed registration behavior through the FIE 0-4 ms region and its
  allowance.
- Prevent the specified target registration through the FIE 4-15 ms region when blade contact is interrupted no more
  than ten times.
- After an unsignalled whipover, permit normal subsequent hits only after the released recovery boundary. `timing-1`
  provisionally selects `5_000 us` and `20_000 us` for blade registration/recovery behavior pending the reviewed INT-05
  interpretation.
- Test zero, ten, and eleven interruptions at every relevant time boundary. Do not compress the history into one
  `isBladeTouching` Boolean.

### Diagnostics

- Yellow indicates the side whose guard/blade contacts its own conductive equipment in the stated resistance range. It
  does not block valid exchanged hits merely because it is lit.
- White plus sound indicates the weapon-specific abnormal B/C or control-circuit condition, not an off-target hit.
- A control-circuit break is more than 250 ohms for the released duration; `timing-1` selects `3_000 us` inside the
  1-5 ms tolerance. Exact equality and recovery remain versioned policy under INT-06.
- Diagnostic lamps record side, phase, resistance bucket, uncertainty, persistence, and reset/recovery cause.

### Outputs

A valid hit gives the configured red or green output and a simultaneous, side-identical short ring or continuous note
lasting 1-2 seconds. Nonconductive contact gives no hit signal. Yellow and white diagnostics are independent outputs.
All latched outputs remain until the declared reset behavior.

## Apparatus-wide output, clock, remote, and power programming

Weapon correctness is necessary but insufficient for an FIE-claiming apparatus.

### Physical outputs

- Create one authoritative output event with side, weapon, hit/diagnostic class, signal time, audio request, latch state,
  and reset cause.
- Keep hit lamps visible from above and support extension outputs. Official FIE competition configuration requires the
  height, spacing, visibility, and 2600-lumen valid / 1100-lumen white acceptance fields in OUT-02.
- Drive lamp-test behavior without fabricating a scoring decision.
- Verify ordinary foil, epee, and sabre audio separately. Do not use one unqualified duration for every weapon.
- Implement the OUT-05 disconnected-audio fault path independently: 80-100 dB at piste center for 2-3 seconds, without
  blocking the central apparatus or stopping the clock.

### Clock and remote

- Maintain scoring timestamps and bout countdown time as separate monotonic domains.
- Measure/transmit hundredths throughout the match. In the last ten seconds, display tenths while running and
  hundredths while stopped, as required by CLOCK-01.
- A remote command may start/stop the bout clock or change workflow state; it cannot alter a captured scoring timestamp.
- The official-claim remote path must satisfy the encrypted-radio requirement. The current encrypted-IR product choice
  remains a compliance gate in [`encrypted-ir-remote-control-contract.md`](../encrypted-ir-remote-control-contract.md).

### Power and safe failure

- Accept the FIE 12 V supply arrangements and verify the declared `11_400-12_600 mV` nominal 12 V range.
- An official-competition configuration provides external battery/UPS continuity for at least five minutes and prevents
  mistaken direct mains connection.
- Brownout, rail fault, watchdog reset, processor reset, invalid image, or calibration loss produces `unavailable` and
  safe inactive outputs. It never produces a hit.
- Preserve boot/reset cause, scoring boot identity, power source, backup state, and rail evidence.

## Required verification program

No implementation is complete because its constants match a table or because two fencers used it successfully.

### Vector identity

Every test vector records:

- FIE matrix ID and source article,
- rule and timing-table revisions,
- weapon, side, acquisition phase, and initial state,
- physical/logical relations with resistance and uncertainty,
- pulse start, duration, interruption history, and opposing interval,
- expected hit, diagnostic, rejection, unavailable, and latch/reset outcomes,
- expected decision timestamp/anchor policy, and
- tester/scorer firmware identity plus captured physical-output evidence.

### Minimum test layers

| Layer | Required evidence |
| --- | --- |
| Pure scoring-core tests | Below, at, and above each released duration and resistance boundary for both sides; same-side and opposite-side orderings; exact expected decision record |
| Generated/property tests | Bounded sequences, timestamp monotonicity, no hit from unavailable/indeterminate state, side symmetry, replay determinism, and no post-lockout signal |
| Firmware-in-the-loop | Real timer quantization, scan schedule, interrupt latency, wrap behavior, calibration loading, safe boot, and transport backpressure |
| Independent electrical fixture | Calibrated pulse width and resistance, grounded material, blade/guard paths, cross-line faults, reel/cable/piste conditions, and sabre interruption sequences |
| Physical output observation | Lamp side/color/diagnostic, latch/reset, duplicate lamp independence, audio onset/duration/dB, extension output, and disconnected-audio behavior |
| Power and recovery | Input range, brownout, processor reset, interrupted persistence, backup transition and duration, and safe inactive state |
| Venue/compliance | Photometry, visibility, mechanical arrangement, remote encryption, clock presentation, electrical safety, and required FIE/SEMI approval evidence |

The generated corpus and stable records are governed by
[`timing-boundary-vector-contract.md`](../timing-boundary-vector-contract.md),
[`scoring-property-test-contract.md`](../scoring-property-test-contract.md), and
[`golden-scenario-contract.md`](../golden-scenario-contract.md).

## Open decisions that block a final conformance claim

The implementation must not hide these behind repository precedent:

- INT-01: exact physical excitation, sense topology, and B/C mapping;
- INT-02: epee exact 40/50 ms endpoints and interval anchor;
- INT-03: finite epee 100 ohm duration fixture envelope;
- INT-04: foil 450-475 ohm uncertainty/hysteresis behavior;
- INT-05: sabre 0.1/1/4/15 ms endpoints and tolerance interpretation;
- INT-06: sabre B/C diagnostic persistence and recovery;
- INT-07: optional indicators included in the product;
- INT-08: ordinary-hit and disconnected-audio acoustic targets; and
- INT-09: whether the release claims official FIE competition use.

Until those decisions are reviewed and their hardware evidence exists, the product may claim implementation against a
named project rule revision, but not complete FIE apparatus conformance.

## Prior-art influence

The public corpus changed this specification in three useful ways without becoming its authority:

1. OpenPiste, Inexfensive, Marcus, Copis, and Sentinel show why named phased observations are required for sabre and why
   a single simultaneous ADC snapshot is insufficient.
2. The wnew family and JBox show why all scalar selections must live in one immutable timing revision: duplicated weapon
   sketches drift and advertised modes can remain stubs.
3. JC, Ajax, Sentinel, ImprovedTesterAfterGenova, and multiple README failure reports support an independent,
   evidence-producing tester rather than self-reported firmware logs or a manual lamp check.

The detailed comparison and code-level caveats are retained in
[`fencing-scoring-prior-art-analysis.md`](prior-art/fencing-scoring-prior-art-analysis.md).
