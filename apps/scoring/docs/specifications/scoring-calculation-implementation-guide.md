# Scoring calculation implementation guide

**Who this is for:** anyone who needs to understand, implement, review, or test how a fencing scoring box decides which
lights to turn on. No knowledge of the existing codebase is assumed.

**Timing profile:** post-2016 FIE timing behavior only, released by this project as `timing-1`

**Official rules used here:** [FIE Material Rules, Book 3, August 2026 - Annex B, Characteristics of Scoring Apparatus,
pages 77-82](fie-material-rules-2026-08-en.pdf#page=77)

**Prior-art policy:** public code is cited as evidence that an implementation technique has existed. It is not evidence
of FIE conformance, and no cited implementation overrides the FIE rules or the explicit project policies below.

This guide explains the complete journey from a fencer making electrical contact to the box lighting a lamp. It first
describes the ideas in ordinary language, then gives the exact calculations a firmware developer needs.

The shorter [weapon-mode programming specification](weapon-scoring-programming-specification.md) remains the formal
project requirement. This guide explains what those requirements mean in practice.

The cited GPL implementations are used only as prior art. The pseudocode in this guide is an original expression of the
FIE-derived project behavior and is not copied from those repositories.

## Table of contents

1. [How a scoring box works](#how-a-scoring-box-works)
2. [Where the requirements come from](#where-the-requirements-come-from)
3. [Terms and timestamp model](#terms-and-timestamp-model)
4. [Common calculation rules](#common-calculation-rules)
5. [What the box decides and what the referee decides](#what-the-box-decides-and-what-the-referee-decides)
6. [Released timing table](#released-timing-table)
7. [Foil](#foil)
8. [Epee](#epee)
9. [Sabre](#sabre)
10. [Required decision records](#required-decision-records)
11. [Implementation and test guidance](#implementation-and-test-guidance)
12. [Common candidate pseudocode](#appendix-a-common-candidate-pseudocode)
13. [Foil pseudocode](#appendix-b-foil-pseudocode)
14. [Epee pseudocode](#appendix-c-epee-pseudocode)
15. [Sabre and whip-over pseudocode](#appendix-d-sabre-and-whip-over-pseudocode)
16. [Source ledger](#appendix-e-source-ledger)

## How a scoring box works

The weapons and body cords are passive electrical equipment. They do not send a digital “hit” message. Instead, a
scoring box repeatedly checks the electrical relationships among the weapon, conductive clothing, guard, body-cord
lines, and conductive piste.

A useful mental model is:

1. **Measure:** determine which electrical paths are open, closed, grounded, or uncertain.
2. **Start a timer:** when a measurement looks like a possible hit, remember when it began.
3. **Qualify:** keep checking that the same condition remains true for the weapon's required minimum time.
4. **Classify:** decide whether it is on-target, off-target, grounded, a fault, or a sabre whip-over.
5. **Apply the two-fencer window:** after the first hit, decide whether the other fencer's hit arrived soon enough to be
   shown too.
6. **Signal and remember:** turn on the correct lamps and sound, then keep the result latched until the box is rearmed.

The three weapons differ in what starts a possible hit:

| Weapon | What the box watches | Minimum used by this product | How a second hit is handled |
| --- | --- | ---: | --- |
| Foil | The normally closed foil circuit opens when the point is depressed. A separate return path says whether the point is on conductive target. | 13 ms | The other side must finish qualifying before a 300 ms window ends. |
| Epee | Pressing the point closes the tip circuit. Guard and piste contacts must be rejected. | 2 ms | Compare when the two contacts started. A separation of 45 ms or less is a double touch. |
| Sabre | An uninsulated part of the sabre contacts the opponent's conductive jacket, glove, or mask. | 0.1 ms | The other side must finish qualifying before a 170 ms window ends. Blade-contact history can reject a whip-over. |

One millisecond (`ms`) is 1,000 microseconds (`us`). Firmware uses integer microseconds so that the calculations do not
depend on floating-point rounding.

## Where the requirements come from

The “FIE source” column in each weapon table links directly to the page and named subsection that contains the rule.
The labels mean:

| Authority label | Meaning |
| --- | --- |
| **FIE** | The official material rules require this behavior. |
| **FIE + project choice** | FIE gives a range or tolerance. We choose one exact value so every box behaves the same way. |
| **Project choice** | FIE does not answer a software-level detail, such as what happens at an exact equality. We state our choice instead of leaving it hidden in code. |
| **Prior art only** | A public repository shows one way somebody implemented the idea. It helps us learn, but does not prove that approach is correct or FIE-compliant. |

If sources conflict, use this order:

1. Current FIE Material Rules and any applicable SEMI test interpretation.
2. A released project rules or timing revision.
3. This implementation guide.
4. Commercial-machine observations.
5. Public repository prior art.

The guide uses the current August 2026 rulebook because it still contains the post-2016 timing behavior selected for
this product. There is no setting for older timing rules. A public repository or commercial box may choose a different
value inside an FIE tolerance; that does not automatically make either value wrong.

## Terms and timestamp model

These words are used very deliberately. In particular, **contact**, **candidate**, **qualified hit**, and **signalled
hit** are different stages. Keeping them separate prevents subtle timing mistakes.

| Term | Plain-language meaning | What firmware must remember or calculate | Where it comes from | Prior-art example |
| --- | --- | --- | --- | --- |
| Observation | One trustworthy snapshot of the weapon wiring for both fencers. | Record when it was taken, which measurement phase produced it, the electrical relationships found, and any resistance uncertainty. Time always moves forward in integer microseconds. | Project representation needed to implement the FIE rules | [Sentinel separates a seven-line scan from game rules](https://github.com/phillip-toone/sentinel/blob/55f8559b31/firmware/scanner/ContinuityScanner.h#L12-L67); [OpenPiste performs named drive/read phases](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/sabre.cpp#L7-L46). |
| Candidate | Something that looks like a hit, but has not lasted long enough yet. | Remember the first trustworthy time it appeared. Cancel it if contact is lost, its classification changes, or the measurement becomes uncertain. | Project representation of the minimum-contact rules in [Foil A(b), p. 78](fie-material-rules-2026-08-en.pdf#page=78), [Epee B(c), p. 80](fie-material-rules-2026-08-en.pdf#page=80), and [Sabre C(b), p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [wnew records a start time and resets it when contact is lost](https://github.com/wnew/fencing_scoring_box/blob/2b1698f599/firmware/allweaponbox/allweaponbox.ino#L281-L308); [OpenPiste feeds continuous samples to debouncers](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/epee.cpp#L59-L87). |
| Continuous duration | How long the same trustworthy electrical condition has lasted. It is a time difference, not a number of samples. | `durationUs = observedAtUs - candidateStartedAtUs`. A gap, class change, unknown sample, or time going backward breaks continuity. | FIE gives minimum durations in [Foil A(b), p. 78](fie-material-rules-2026-08-en.pdf#page=78), [Epee B(c), p. 80](fie-material-rules-2026-08-en.pdf#page=80), and [Sabre C(b), p. 82](fie-material-rules-2026-08-en.pdf#page=82); the representation is a project choice | [Inexfensive uses elapsed microseconds and resets on release](https://github.com/mschnur/inexfensive/blob/31dce8279c/FencingBox/EpeeMode.cpp#L32-L56). |
| Qualified hit | A candidate that has now passed every required check, including time, target, resistance, grounding, and any weapon-specific rule. | Qualify on the first trustworthy observation where all checks pass and `durationUs >= minimumUs`. | The required checks are defined separately in [Foil A, pp. 77-79](fie-material-rules-2026-08-en.pdf#page=77), [Epee B, pp. 80-81](fie-material-rules-2026-08-en.pdf#page=80), and [Sabre C, pp. 81-82](fie-material-rules-2026-08-en.pdf#page=81) | [OpenPiste applies qualification before setting lamps and starting lockout](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/epee.cpp#L127-L184). |
| Registered or signalled hit | The box has accepted the event and will turn on a lamp. | Save an unchangeable decision at `signalAtUs`. Allow no more than one registered hit per side until reset. | [FIE Foil A(a), pp. 77-78](fie-material-rules-2026-08-en.pdf#page=77), [Epee B(a)-B(f), pp. 80-81](fie-material-rules-2026-08-en.pdf#page=80), and [Sabre C(a), p. 81](fie-material-rules-2026-08-en.pdf#page=81) | [OpenPiste sets lamp, sound, side signal, and lockout together](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L188-L250). |
| Contact start | Earliest timestamp at which the continuous physical condition was observed. | `startedAtUs`; never replace it with the later qualification timestamp. | Project choice needed to measure epee hit separation | [Copis stores contact and lockout timestamps separately](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L14-L27). |
| Qualification time | First timestamp at which a candidate has met its minimum duration and all other predicates. | `qualifiedAtUs >= startedAtUs + minimumUs`; sampling means it may be later than the mathematical threshold. | Project choice | [OpenPiste keeps weapon-specific contact thresholds separate from lockout constants](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/TimingConstants.h#L8-L22). |
| Event window | The short period after the first hit during which the other fencer may still light a lamp. “Lockout” is the state after that period ends. | Use the weapon-specific timestamp and exact endpoint below. Never use UI, network, or wall-clock time. | [Foil A(a).6, p. 78](fie-material-rules-2026-08-en.pdf#page=78), [Epee B(b), p. 80](fie-material-rules-2026-08-en.pdf#page=80), and [Sabre C(a).8, p. 81](fie-material-rules-2026-08-en.pdf#page=81), with project endpoint choices | [wnew centralizes weapon windows but anchors them to contact time](https://github.com/wnew/fencing_scoring_box/blob/2b1698f599/firmware/allweaponbox/allweaponbox.ino#L68-L79), illustrating why the anchor must be specified independently. |
| Same-side inhibit | Once one fencer's lamp has been accepted, that same fencer cannot register another hit before reset. | Mark the side as registered, cancel its pending candidate, and ignore new hit-shaped observations from it until rearm. | [FIE Foil A(a).4, p. 78](fie-material-rules-2026-08-en.pdf#page=78); used as the project's one-event-per-side rule for all weapons | [OpenPiste guards signalling with per-side flags](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/sabre.cpp#L162-L181). |
| Double touch | In epee, both fencers made valid contacts close enough together that both lamps must be shown. | Compare when the two physical contacts began, not which side the software happened to process first. | [FIE Epee B(b), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [OpenPiste selects a 45 ms epee window](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/TimingConstants.h#L8-L10); [wnew processes each side independently](https://github.com/wnew/fencing_scoring_box/blob/2b1698f599/firmware/allweaponbox/allweaponbox.ino#L346-L395). |
| Simultaneous signal | Two accepted registrations with identical qualification timestamps. | Sort first by `startedAtUs`, then by side only to make records deterministic. Both outputs are asserted from the same committed decision set. | Project choice supporting FIE simultaneous lamp behavior | [Copis evaluates both sides before driving either hit lamp](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L270-L297). |
| Diagnostic indication | A yellow, white, or optional orange light that reports an equipment condition. It is not a point or a priority decision. | Give diagnostics their own timer and latch behavior. They must never change a hit already accepted by the box. | [Foil anti-blocking, p. 79](fie-material-rules-2026-08-en.pdf#page=79), [Epee B(e), p. 80](fie-material-rules-2026-08-en.pdf#page=80), and [Sabre C(a).5-C(a).6, p. 81](fie-material-rules-2026-08-en.pdf#page=81) | [OpenPiste updates sabre white diagnostics separately from hit signalling](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/sabre.cpp#L91-L123). |
| Indeterminate | Available evidence overlaps a rule boundary or contains contradictory relations. | Do not guess. Clear an unqualified candidate, emit a diagnostic decision, and remain fail-closed for new hits. | Project safety policy | [Sentinel's scanner preserves a continuity map rather than directly declaring touches](https://github.com/phillip-toone/sentinel/blob/55f8559b31/firmware/scanner/ContinuityMap.h#L13-L29). |
| Unavailable | The acquisition result cannot be trusted because of boot, calibration, timing, processor, or electrical failure. | No new candidate or hit. Preserve any already-latched decision and report the fault. | Project safety policy | No complete prior-art implementation was accepted as authority for this behavior. |

### Required timestamps

The firmware needs several clocks for one apparent hit because “contact began,” “contact became valid,” and “the box
accepted the first hit” are not necessarily the same moment. Every accepted or rejected candidate must keep these
instants distinct:

| Name in code | What it means | What it is used for |
| --- | --- | --- |
| `startedAtUs` | First trusted observation of a continuous physical condition | Epee double-touch separation and duration qualification |
| `qualifiedAtUs` | First observation at which the duration and all predicates pass | Apparatus signal and foil/sabre event-window opening |
| `firstSignalAtUs` | Qualification time of the first accepted side | Foil and sabre event-window end |
| `windowEndsAtUs` | Exact selected end of the opposite-side acceptance interval | Transition to locked state |
| `observedAtUs` | Timestamp of the current acquisition sample | Duration, boundary, and overrun calculations only |

Firmware must never synthesize an edge between samples. If a contact first appears in a sample at `10,000 us`, its
start is `10,000 us`, not an estimated time halfway to the previous sample.

## Common calculation rules

### Resistance and uncertainty

Real resistance measurements are never perfectly exact. If the box measures 198 ohms with an uncertainty of 5 ohms,
the true value may be anywhere from 193 to 203 ohms. The firmware must carry that range forward instead of pretending
the value is exactly 198.

Resistance comparisons use integer milliohms and calculate this range:

```text
lower = max(0, measuredMilliOhms - uncertaintyMilliOhms)
upper = measuredMilliOhms + uncertaintyMilliOhms
```

For a rule requiring `R <= limit`, the decision is:

| Condition | Result |
| --- | --- |
| `upper <= limit` | The complete possible range is allowed. |
| `lower > limit` | The complete possible range is outside the limit. |
| Otherwise | The range crosses the boundary, so the result is uncertain. Do not guess. |

For a strict rule requiring `R < limit`, only `upper < limit` is confidently inside. For a strict break requiring
`R > limit`, only `lower > limit` is confidently a break. Equality follows the operator printed in the weapon table;
it is never silently rounded into the preferred class.

### Continuous qualification

A single sample is not enough to prove that a contact lasted long enough. The box starts a candidate on the first valid
sample and compares every later timestamp with that original start. For example, an epee contact seen at `10,000 us`
does not qualify on a sample at `11,999 us`; it first qualifies on a trustworthy sample at or after `12,000 us`.

1. Start a candidate only from a trusted, rule-shaped observation.
2. Keep the original `startedAtUs` while the exact same classification remains true.
3. Reset it on a known open/closed transition, target-class change, ground condition, line fault, indeterminate result,
   unavailable result, or weapon-specific rejection state.
4. Qualify when `observedAtUs - startedAtUs >= minimumUs`.
5. A pulse known to end at the current sample may qualify at that end if the whole interval was trusted and its elapsed
   duration reached the minimum. An unknown or unavailable end may not qualify it.

### Atomic two-side processing

Both sides are advanced from the same immutable observation before either result is committed. This prevents the order
of two function calls from deciding which lamp is first. New hits are ordered by physical start and then by a stable
side identifier only for serialization.

### Latching and rearm

Accepted red, green, and foil off-target white signals remain latched until the declared manual or automatic rearm. A
sound timeout or mute command does not clear the visual decision. Changing weapon mode cannot reclassify a latched
event; the apparatus must rearm first.

## What the box decides and what the referee decides

“Judging an engagement” has two distinct meanings that must not be combined:

| Question | Scoring apparatus responsibility |
| --- | --- |
| Did a rule-shaped electrical event occur? | Yes. Apply the weapon tables and signal the resulting lamps and sound. |
| Were two epee contacts inside the double-touch interval? | Yes. Register one or both electrical hits using the epee calculation. |
| Was a foil contact on target or off target? | Yes. Classify the trusted return path and signal colored or white. |
| Was a sabre contact an allowed target contact or a rejected whip-over sequence? | Yes. Apply the target, duration, blade-history, and fault calculations. |
| Which fencer had right of way in foil or sabre? | No. The referee judges attack, parry, riposte, remise, and priority. |
| Should a signalled foil or sabre hit add a score? | No. The bout workflow applies the referee's award. |
| Was blade contact a parry in the fencing sense? | No. Electrical blade contact is only an observed relation used by whip-over handling and telemetry. |

The scoring core may therefore emit `on-target`, `off-target`, `valid-contact`, `blade-contact`, `whipover-rejected`, and
equipment-fault events. It must not emit `attack-won`, `right-of-way-left`, `parry-successful`, or an automatic point
award.

## Released timing table

These are the only runtime timing selections. Published FIE ranges remain acceptance-test references, not operator
settings.

| Weapon calculation | Released value | Exact endpoint policy | Authority |
| --- | ---: | --- | --- |
| Foil continuous circuit break | `13,000 us` | Qualify at `elapsed >= 13,000 us` | [FIE Foil A(b).1-A(b).3, pp. 78-79](fie-material-rules-2026-08-en.pdf#page=78) + project choice at the start of the 13-15 ms guaranteed band |
| Foil opposite-side window | `300,000 us` | Open at first `qualifiedAtUs`; accept only a signal with `qualifiedAtUs < windowEndsAtUs`; equality is locked out | [FIE Foil A(a).6, p. 78](fie-material-rules-2026-08-en.pdf#page=78) + project endpoint choice |
| Epee continuous tip contact | `2,000 us` | Qualify at `elapsed >= 2,000 us`; never signal a known shorter pulse | [FIE Epee B(c), p. 80](fie-material-rules-2026-08-en.pdf#page=80) + project choice |
| Epee double-touch separation | `45,000 us` | Accept second contact when `second.startedAtUs - first.startedAtUs <= 45,000 us`; equality is a double | [FIE Epee B(b), p. 80](fie-material-rules-2026-08-en.pdf#page=80) + project choice inside the 40-50 ms tolerance |
| Sabre continuous target contact | `100 us` | Qualify at `elapsed >= 100 us`; `1,000 us` remains a test point, not a timeout | [FIE Sabre C(b).1, p. 82](fie-material-rules-2026-08-en.pdf#page=82) + project choice |
| Sabre opposite-side window | `170,000 us` | Open at first `qualifiedAtUs`; accept only a signal with `qualifiedAtUs < windowEndsAtUs`; equality is locked out | [FIE Sabre C(a).8, p. 81](fie-material-rules-2026-08-en.pdf#page=81) + project endpoint choice |
| Sabre B/C control break | `3,000 us` | Qualify a continuous resistance strictly above 250 ohms at `elapsed >= 3,000 us` | [FIE Sabre C(b).7, p. 82](fie-material-rules-2026-08-en.pdf#page=82) + nominal project choice |
| Sabre through-blade normal-registration end | `5,000 us` | `elapsed <= 5,000 us` remains normally eligible | [FIE Sabre C(b).5, p. 82](fie-material-rules-2026-08-en.pdf#page=82) + conservative use of the stated `4 ms + 1 ms` allowance |
| Sabre whip-over recovery | `20,000 us` | Suppression is cleared when `elapsed >= 20,000 us` | [FIE Sabre C(b).6, p. 82](fie-material-rules-2026-08-en.pdf#page=82) + conservative use of the stated `15 ms +/- 5 ms` allowance |
| Sabre blade-contact interruptions | `10` | Protection applies for `count <= 10`; more than 10 becomes indeterminate rather than automatically creating a hit | [FIE Sabre C(b).5, p. 82](fie-material-rules-2026-08-en.pdf#page=82) + fail-closed project choice |

The canonical values are implemented in [`timing-table.ts`](../../src/timing-table.ts) and explained in
[`timing-table-contract.md`](../timing-table-contract.md).

## Foil

In foil, current normally flows through the fencer's own weapon circuit. Pressing the point opens that circuit. The box
then checks where the point is touching:

- Conductive target produces the fencer's colored lamp.
- Non-conductive target produces that fencer's white lamp.
- A guard, piste, wiring fault, or uncertain reading is handled separately and must not be guessed into either class.

For example, suppose the left point first opens at `1,000 us`. If it stays open against valid target through
`14,000 us`, it has been open for 13 ms and the left colored lamp is signalled at `14,000 us`. The 300 ms window then
ends at `314,000 us`. A right hit that finishes qualifying before that instant may also be shown. One that finishes
exactly at `314,000 us` is too late under this project's endpoint choice.

| What this means | How the box decides | What the user sees | FIE trace | Prior-art example |
| --- | --- | --- | --- | --- |
| Foil circuit break | Candidate condition is `circuitBreak == open`, acquisition is trusted, integrity is intact, and target context is known. A closed loop clears the candidate. | No output until duration qualifies. | **FIE:** [Foil A(a).1, p. 77](fie-material-rules-2026-08-en.pdf#page=77) | [OpenPiste measures the own foil circuit before classification](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L91-L117). |
| On-target candidate | The continuous break has `targetContext == target`. If context changes, restart duration under the new class. | Red for the configured left side or green for the configured right side after qualification. | **FIE:** [Foil A(a).2, p. 77](fie-material-rules-2026-08-en.pdf#page=77) | [OpenPiste separates circuit state from conductive-target validity](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L91-L123). |
| Off-target candidate | The same continuous break has trusted `targetContext == nonTarget`. Grounded, blade-only, indeterminate, or unavailable observations are not automatically off-target. | Side-specific white plus the same sound request used for an on-target signal. | **FIE:** [Foil A(a).2-A(a).3, pp. 77-78](fie-material-rules-2026-08-en.pdf#page=77); unknown-state handling is a **project choice** | [wnew has distinct on-target and off-target candidate branches](https://github.com/wnew/fencing_scoring_box/blob/2b1698f599/firmware/allweaponbox/allweaponbox.ino#L281-L340). |
| Break qualification | `elapsed = observedAtUs - startedAtUs`; qualify when `elapsed >= 13,000 us`. The class must remain unchanged throughout. | Register the candidate's on/off-target class. | **FIE + project choice:** [Foil A(b).1-A(b).3, pp. 78-79](fie-material-rules-2026-08-en.pdf#page=78) | [OpenPiste selects 13.5 ms](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/TimingConstants.h#L12-L14); [wnew selects 14 ms](https://github.com/wnew/fencing_scoring_box/blob/2b1698f599/firmware/allweaponbox/allweaponbox.ino#L68-L79). These differing legal values show why our revision is explicit. |
| External resistance | Required fixture cases include 0, 200, and 500 ohms. A break of 13-15 ms with exterior resistance from 0 through 500 ohms must register a valid hit. A 14 ms +/-1 ms break from 0 through 200 ohms must register its valid or non-valid result. | Preserve measured value and uncertainty with the decision; do not substitute a single unexplained ADC threshold. | **FIE:** [Foil A(b).1-A(b).3, pp. 78-79](fie-material-rules-2026-08-en.pdf#page=78) | [OpenPiste derives named ADC resistance thresholds](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/3WeaponSensor.cpp#L71-L95). |
| Closed-loop tolerance | A closed foil loop confidently at or below 200 ohms remains closed and must not generate off-target. | No hit; circuit remains armed. | **FIE:** [Foil A(b).4, p. 78](fie-material-rules-2026-08-en.pdf#page=78) | OpenPiste and wnew use threshold buckets, but no cited block proves this entire fixture boundary. |
| Guard, piste, and undepressed-point rejection | A grounded guard/piste relation, or target contact without the qualifying circuit break, clears the candidate. Ground-path testing must include 100 ohms. | No colored or white hit signal for the rejected condition. | **FIE:** [Foil A(b).5, pp. 78-79](fie-material-rules-2026-08-en.pdf#page=78) | [OpenPiste checks guard and piste before accepting white](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L188-L249). |
| Blade contact | Electrical contact between blades does not disable normal valid and non-valid hit calculation. | Continue normal candidate processing. | **FIE:** [Foil A(b).6, p. 79](fie-material-rules-2026-08-en.pdf#page=79) | OpenPiste samples a parry relation, but no cited public test demonstrates the complete requirement. |
| Anti-blocking return class | Let `[lower, upper]` be the opponent return resistance. `upper <= 200,000` milliohms is valid-hit eligible; `lower > 200,000` is non-valid-hit eligible; an overlap is indeterminate. | Select only the return eligibility. It cannot create a hit without a qualified circuit break. | **FIE + project choice:** [Foil anti-blocking apparatus, p. 79](fie-material-rules-2026-08-en.pdf#page=79) | [OpenPiste exposes resistance-based foil target thresholds](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L12-L69). |
| Anti-blocking yellow | For own weapon-to-jacket insulation, `upper < 450,000` milliohms gives yellow-on; `lower > 475,000` gives yellow-off; any interval touching 450-475 ohms is indeterminate. | Yellow diagnostic only. It neither blocks nor creates a hit. | **FIE + project choice:** [Foil anti-blocking apparatus, p. 79](fie-material-rules-2026-08-en.pdf#page=79) | [OpenPiste has a separate foil leakage diagnostic path](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L132-L153). |
| Same-side inhibit | After a side registers on-target or off-target, clear its candidate and ignore further hit-shaped observations from that side until rearm. | At most one foil signal per side per event. | **FIE:** [Foil A(a).4, p. 78](fie-material-rules-2026-08-en.pdf#page=78) | [OpenPiste gates each side using `SignalLeft` and `SignalRight`](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L91-L117). |
| Opposite-side window | On the first accepted hit, set `firstSignalAtUs = qualifiedAtUs` and `windowEndsAtUs = firstSignalAtUs + 300,000`. Accept another side only if its own `qualifiedAtUs < windowEndsAtUs`. At equality or later, lock. | Latch the first result and, when eligible, the opposite result. | **FIE + project choice:** [Foil A(a).5-A(a).6, p. 78](fie-material-rules-2026-08-en.pdf#page=78) | [OpenPiste selects 300 ms](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/TimingConstants.h#L8-L10). wnew instead uses depression time in its lock expression, a prior-art difference we do not adopt. |
| Foil output | Red/green for on-target, white for off-target, identical sound for both sides. Sound is short or automatically limited to no more than 2 seconds; light remains latched until reset. | Emit one immutable decision and derive physical outputs from it. | **FIE:** [Foil A(a).2-A(a).3, pp. 77-78](fie-material-rules-2026-08-en.pdf#page=77) and [m.51.6, p. 44](fie-material-rules-2026-08-en.pdf#page=44) | [OpenPiste couples classification to the expected lamp and sound flags](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/foil.cpp#L188-L250). |

Current project implementation: [`foil.ts`](../../src/foil.ts) owns candidate, classification, same-side inhibit, and
window behavior. [`foil-insulation.ts`](../../src/foil-insulation.ts) owns the anti-blocking resistance calculations.

## Epee

In epee, pressing the point closes the tip circuit. Unlike foil, there is no off-target white lamp and no right-of-way
decision. The important extra check is whether the tip is touching the opponent rather than a grounded guard or piste.

Each fencer's contact is timed independently. Suppose left contact starts at `100,000 us` and right contact starts at
`143,000 us`. Their separation is 43 ms, so both lamps are shown after each contact completes its own 2 ms minimum. If
the right contact started at `146,000 us`, the 46 ms separation would be outside our selected 45 ms cutoff and only the
left lamp would remain.

| What this means | How the box decides | What the user sees | FIE trace | Prior-art example |
| --- | --- | --- | --- | --- |
| Tip closure candidate | Start only when the tip circuit is closed, grounded-material state is confidently clear, line integrity is intact, and the resistance observation is trusted. | No output until duration qualifies. | **FIE:** [Epee B(a), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [OpenPiste samples each epee tip path independently](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/epee.cpp#L50-L87). |
| Contact qualification | Qualify when the same valid condition remains continuous for `elapsed >= 2,000 us`. Reject every known pulse with `elapsed < 2,000 us`. | Register the side's valid hit. | **FIE + project choice:** [Epee B(c), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [wnew implements a continuous 2 ms candidate](https://github.com/wnew/fencing_scoring_box/blob/2b1698f599/firmware/allweaponbox/allweaponbox.ino#L346-L395); [OpenPiste selects 6 ms](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/TimingConstants.h#L16-L17). |
| Contact-path resistance | `[lower, upper]` is eligible when `upper <= 100,000` milliohms, ineligible when `lower > 100,000`, and indeterminate when the interval overlaps 100 ohms. This continuous project choice covers the FIE's named 10 and 100 ohm fixture points without creating a gap between them. | Only eligible evidence advances a tip candidate. | **FIE + project choice:** [Epee B(c), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [OpenPiste uses calibrated resistance thresholds and one continuous qualifier](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/3WeaponSensor.cpp#L71-L95). |
| Normal resistance test | At the 10 ohm normal external-resistance fixture point, contacts from 2 through 10 ms must register. The runtime minimum remains 2 ms. | Valid hit when all other predicates pass. | **FIE:** [Epee B(c), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | Public code contains thresholds, but no cited suite proves the duration-by-resistance matrix. |
| Exceptional resistance test | At the 100 ohm exceptional fixture point, apply the same hard safety rule that less than 2 ms never registers. At and above 2 ms, a continuous otherwise-valid contact is eligible without imposing a separate maximum duration. | Valid hit when all other predicates pass. | **FIE + project choice:** [Epee B(c), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | OpenPiste is the threshold witness linked in the contact-path row; it is not conformance evidence for this matrix. |
| Guard or piste rejection | If grounded material is confidently detected, reject even when the earth path is 100 ohms. A range crossing the grounded threshold is indeterminate, not a valid hit. | No hit; optionally emit a diagnostic reason. | **FIE + project choice:** [Epee B(d), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [OpenPiste resets the candidate when guard or piste is detected](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/epee.cpp#L127-L184). |
| First hit | Of all newly qualified contacts, choose the smallest `startedAtUs`; use stable side order only if starts are identical. Set `firstContactAtUs` to that physical start. | Register and latch the first side. | **Project choice implementing** [FIE Epee B(b), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [Copis stores a separate contact and accepted-hit time](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L14-L27). |
| Double touch | For the other independently qualified side, calculate `deltaUs = second.startedAtUs - first.startedAtUs`. If `deltaUs <= 45,000`, accept both. Qualification may finish later if the second candidate began inside the window and remained continuous. | Both red and green indications are committed together. | **FIE + project choice:** [Epee B(b), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [wnew uses a 45 ms selected value](https://github.com/wnew/fencing_scoring_box/blob/2b1698f599/firmware/allweaponbox/allweaponbox.ino#L68-L79). |
| Single hit | If the second contact starts after `first.startedAtUs + 45,000 us`, reject it for this event. Lock once current time is beyond the selected boundary and no inside-window candidate remains pending. | Only the first side remains lit. | **FIE + project choice:** [Epee B(b), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | [OpenPiste selects the same 45 ms midpoint](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/TimingConstants.h#L8-L10). |
| FIE 40/50 boundaries | Tests below 40 ms must always produce both lamps. Tests above 50 ms must always produce only the first. The selected 45 ms cutoff determines the FIE-permitted band: exactly 45 ms is double; any greater separation is single. | Deterministic result in the permitted tolerance band. | **FIE + project choice:** [Epee B(b), p. 80](fie-material-rules-2026-08-en.pdf#page=80) | The variety of public 40 and 45 ms choices is prior-art evidence, not an alternative runtime mode. |
| Epee output | At least two failure-independent lamps per side, red on one side and green on the other, plus a loud sound. Optional orange earth-short diagnostics do not affect hit calculation. | Latch visual hit until reset; audio mute does not clear it. | **FIE:** [Epee B(e)-B(f), pp. 80-81](fie-material-rules-2026-08-en.pdf#page=80) | Public firmware commonly drives one logical output per side; that does not prove the physical redundancy requirement. |

Current project implementation: [`epee.ts`](../../src/epee.ts) owns the basic candidate and double-touch state machine.
[`epee-resistance.ts`](../../src/epee-resistance.ts) adds resistance, grounded-material, integrity, and uncertainty
decisions. Its present exact 10 and 100 ohm host fixture classes are narrower than the continuous `<= 100 ohm`
production policy above and must be reconciled before release.

## Sabre

In sabre, any uninsulated part of the weapon may make a hit on the opponent's conductive jacket, glove, or mask. A valid
contact can be very short: this product uses a 0.1 ms minimum.

Sabre is harder than simply asking whether a target wire is active. The box must also remember whether the blades or
guards were touching. That history is needed to reject a flexible blade that bends around the opponent's blade or guard
and then touches target, commonly called a **whip-over**. Sabre also has yellow own-equipment warnings and white B/C
control-circuit warnings; neither is a point.

| What this means | How the box decides | What the user sees | FIE trace | Prior-art example |
| --- | --- | --- | --- | --- |
| Target contact | Candidate condition is contact between any uninsulated part of the acting sabre and the opponent's conductive jacket, glove, or mask, with trusted external-path eligibility. | No output until duration qualifies. | **FIE:** [Sabre C(a).1-C(a).2, p. 81](fie-material-rules-2026-08-en.pdf#page=81) | [OpenPiste reads cross-side sabre target paths](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/sabre.cpp#L68-L81). |
| Non-conductive contact | A confidently non-conductive surface is not a hit. It may close a previously trusted candidate interval at the observed release time; it never starts one. | No signal unless the just-ended interval already met the minimum. | **FIE + project choice:** [Sabre C(a).4, p. 81](fie-material-rules-2026-08-en.pdf#page=81) | Most simple implementations only clear a timer; no cited public suite establishes exact release-edge behavior. |
| External path | `[lower, upper]` is eligible when `upper <= 100,000` milliohms, ineligible when `lower > 100,000`, and indeterminate when it overlaps 100 ohms. | Only eligible evidence may advance a hit candidate. | **FIE + project choice:** [Sabre C(b).2, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [OpenPiste derives resistance thresholds used by its sabre phases](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/3WeaponSensor.cpp#L71-L95). |
| Contact qualification | Qualify at `elapsed >= 100 us`. A known pulse below 100 us is rejected. The 1,000 us value is a required sensitivity test point, not a candidate-expiry time. | Register a valid sabre contact if no whip-over or fault predicate blocks it. | **FIE + project choice:** [Sabre C(b).1, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [OpenPiste selects 120 us](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/TimingConstants.h#L19-L22); [Copis selects 600 us](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L37-L44). |
| Own-equipment contact | A weapon-to-own-conductive-equipment fault does not block an otherwise-valid exchanged hit. For the diagnostic resistance range, `upper <= 450,000` milliohms gives yellow-on, `lower > 450,000` gives yellow-off, and an overlap is indeterminate. | Continue hit processing and emit a separate non-latched yellow diagnostic. | **FIE + project choice:** [Sabre C(a).2 and C(a).5, p. 81](fie-material-rules-2026-08-en.pdf#page=81) and [C(b).3, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [Copis models the own-equipment indication separately](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L91-L105); [OpenPiste reserves separate diagnostic phases](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/sabre.cpp#L113-L137). |
| Faulty guard/blade allowance | If a hit is made on the faulty fencer's guard or blade, the special allowance applies only when the resistance to the valid surface is confidently `< 250,000` milliohms. Equality is not inside the stated “less than” condition. | Treat as target-eligible only through this explicit allowance. | **FIE + project choice:** [Sabre C(b).3, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | No cited public block proves this strict resistance boundary end to end. |
| Blade-contact history start | Start a through-blade history at `tBlade0` when target contact and blade/guard contact are simultaneously trusted. Store `lastBladeContact = present` and `interruptions = 0`. | Continue normal processing during the early allowed interval. | **Project representation of** [FIE Sabre C(a).7, p. 81](fie-material-rules-2026-08-en.pdf#page=81) and [C(b).5, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [Copis stores parry start and bounce count](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L14-L27); [Inexfensive enters a dedicated whip-over state](https://github.com/mschnur/inexfensive/blob/31dce8279c/FencingBox/SaberMode.cpp#L86-L108). |
| Interruption count | Increment only on a trusted `present -> absent` blade-contact transition after `tBlade0`. Repeated absent samples do not increment. Reset the count when history ends. | Supplies the maximum-ten condition; does not itself create a hit. | **FIE + project choice:** [Sabre C(b).5, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [Inexfensive counts only a transition out of blade contact](https://github.com/mschnur/inexfensive/blob/31dce8279c/FencingBox/SaberMode.cpp#L34-L57). |
| Early through-blade hit | Let `bladeElapsedUs = observedAtUs - tBlade0`. While `bladeElapsedUs <= 5,000`, a target contact may qualify normally after the 100 us minimum. | Valid hit if every normal predicate passes. | **FIE + project choice:** [Sabre C(b).5, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [Copis records the published 4 and 15 ms values](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L37-L44). |
| Whip-over rejection interval | When `5,000 < bladeElapsedUs < 20,000` and `interruptions <= 10`, reject the blade-mediated target candidate and clear its duration. | Emit `whipover-rejected`; no hit lamp or hit sound. | **FIE + project choice:** [Sabre C(a).7, p. 81](fie-material-rules-2026-08-en.pdf#page=81) and [C(b).5-C(b).6, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [Copis suppresses target hits while whip-over protection is active](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L158-L217); [Inexfensive has an explicit suppression interval](https://github.com/mschnur/inexfensive/blob/31dce8279c/FencingBox/SaberMode.cpp#L59-L84). |
| More than ten interruptions | If `interruptions > 10` before recovery, mark the blade-mediated result indeterminate and do not create a hit from that ambiguous sequence. A fresh, independently observed normal target contact may start after history clears. | Diagnostic/fail-closed result. | **Project choice**; [FIE Sabre C(b).5, p. 82](fie-material-rules-2026-08-en.pdf#page=82) only guarantees suppression when interruptions are no more than ten | Copis and Inexfensive re-enable after more than ten interruptions; [Inexfensive behavior is visible here](https://github.com/mschnur/inexfensive/blob/31dce8279c/FencingBox/SaberMode.cpp#L67-L74). We deliberately do not let that transition itself create a hit. |
| Recovery | When `bladeElapsedUs >= 20,000`, clear the blade-mediated history. A subsequent target observation starts a new candidate at its own timestamp; suppressed time is not credited. | Normal hit detection resumes. | **FIE + project choice:** [Sabre C(b).6, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [Inexfensive clears protection after its selected timeout](https://github.com/mschnur/inexfensive/blob/31dce8279c/FencingBox/SaberMode.cpp#L76-L84). |
| B/C control break | A break is confidently present only when the complete uncertainty interval is strictly above 250 ohms. Start `controlBreakSinceUs`; clear it if the relation returns to normal or becomes unknown. Qualify at continuous `elapsed >= 3,000 us`. | Latch the faulty side's white diagnostic and request its required sound. | **FIE + project choice:** [Sabre C(a).6, p. 81](fie-material-rules-2026-08-en.pdf#page=81) and [C(b).7, p. 82](fie-material-rules-2026-08-en.pdf#page=82) | [Copis times a control-circuit break separately from a hit](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L184-L198); [OpenPiste uses a separate sabre-white debounce](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/3WeaponSensor.cpp#L370-L382). |
| Other B/C abnormal change | The acquisition contract must name each detectable B/C illegal relation. Once its own reviewed persistence rule classifies `abnormalChange`, emit one transition into white-on. Do not reuse the 3 ms control-break timer for a different fault unless its rule explicitly says so. | Latch the faulty side's white diagnostic and request sound; retain the named fault reason. | **FIE + project choice:** [Sabre C(a).6, p. 81](fie-material-rules-2026-08-en.pdf#page=81) | [OpenPiste keeps white-state handling outside normal sabre hit qualification](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/sabre.cpp#L91-L123). |
| Opposite-side window | On first accepted hit, set `firstSignalAtUs = qualifiedAtUs` and `windowEndsAtUs = firstSignalAtUs + 170,000`. The other side must independently qualify with `qualifiedAtUs < windowEndsAtUs`. Equality or later is locked out. | Latch one or both side signals. | **FIE + project choice:** [Sabre C(a).8-C(a).9, p. 81](fie-material-rules-2026-08-en.pdf#page=81) | [OpenPiste selects 170 ms and starts lockout when signalling](https://github.com/pietwauters/esp32scoringdeviceMqtt/blob/ed6485efeb/src/sabre.cpp#L147-L181); Copis also selects 170 ms. |
| Sabre output | Red/green valid-hit lamp plus identical side-independent sound lasting 1-2 seconds. Yellow is non-latched own-equipment state. White B/C fault is persistent and audible. | Keep hit and diagnostic records distinct even if the same physical sounder is used. | **FIE:** [Sabre C(a).2-C(a).6, p. 81](fie-material-rules-2026-08-en.pdf#page=81) | [Copis has distinct hit, control-break, and self-contact outputs](https://github.com/TheGrimReaper13/Copis/blob/c671f790fb/copis/copis.ino#L223-L297). |

Current project implementation: [`sabre.ts`](../../src/sabre.ts) owns target qualification, external-path classification,
blade-mediated history, interruption count, diagnostics, and event-window behavior.

## Required decision records

Every registered or rejected event must be explainable without replaying UI or network state. At minimum, persist:

| Field | Reason |
| --- | --- |
| Weapon, side, and classification | Identifies the rule branch and physical output. |
| `startedAtUs`, `qualifiedAtUs`, `firstSignalAtUs`, and `windowEndsAtUs` | Makes duration and lockout calculations auditable. |
| Rules revision and timing revision | Prevents a constant copied from another build from being treated as equivalent behavior. |
| First and last evidence cycle IDs | Connects the decision to bounded acquisition observations. |
| Resistance value, uncertainty, and named comparison result | Shows why a boundary was inside, outside, or indeterminate. |
| Target, ground, integrity, and blade-contact classes | Shows that duration alone did not create the decision. |
| Whip-over start, elapsed duration, and interruption count | Explains sabre suppression and recovery. |
| Accepted, rejected, indeterminate, or unavailable disposition with reason | Prevents absence of a lamp from becoming an unexplained result. |
| Output latch and reset cause | Proves that display or audio handling did not rewrite the scoring event. |

The canonical event schema is [`decision-record-contract.md`](../decision-record-contract.md). The STM32 remains the
sole electrical scoring authority; ESP32 display, remote, protocol, storage, and network work may consume these records
but may not create or reclassify them.

## Implementation and test guidance

### Firmware structure

Implement each weapon as a deterministic reducer:

```text
nextState, decisions = advance(previousState, trustedObservation, timingTable)
```

The reducer must not read a wall clock, sleep, perform ADC I/O, drive a lamp, allocate unbounded memory, call the
network, or consult bout score. The acquisition task supplies monotonic timestamps and normalized observations. The
output task consumes immutable decisions.

### Boundary vectors

For every duration or resistance boundary, test:

- Just below, exactly at, and just above the boundary.
- Both sides and identical-time two-side observations.
- Contact loss immediately before and after qualification.
- Indeterminate and unavailable evidence during a candidate.
- Measurement intervals wholly below, wholly above, and overlapping the resistance limit.
- Lockout with no pending candidate and with an opposite candidate that started before the applicable boundary.
- Monotonic counter wrap or overflow handling using the production timer representation.

Sabre additionally requires 0, 10, and 11 interruption vectors; target through blade at 0, 5, and 20 ms under the
released policy; B/C resistance at, below, and above 250 ohms; and target pulses below, at, and above 100 us.

### Physical evidence

Host tests prove reducer behavior, not apparatus conformance. A separate calibrated fixture must independently generate
contact duration, resistance, ground, cross-line, blade-contact, and interruption stimuli and observe physical lamp and
audio outputs on its own clock. The scorer's logs are supporting evidence, never the fixture's sole verdict.

## Appendix A: common candidate pseudocode

```text
function advanceCandidate(state, observation, minimumUs):
    require monotonic(observation.atUs)

    classification = classifyTrustedObservation(observation)

    if classification is INDETERMINATE or UNAVAILABLE or REJECTED:
        return clearedCandidate(), diagnostic(classification)

    if classification is not CANDIDATE:
        return clearedCandidate(), noDecision

    if state.candidate is absent or state.candidate.class != classification.class:
        return candidate(classification.class, observation.atUs), noDecision

    elapsedUs = observation.atUs - state.candidate.startedAtUs
    if elapsedUs < minimumUs:
        return state.candidate, noDecision

    return registered(), hit(
        class = classification.class,
        startedAtUs = state.candidate.startedAtUs,
        qualifiedAtUs = observation.atUs
    )
```

## Appendix B: foil pseudocode

```text
function classifyFoil(contact):
    if contact.integrity is not INTACT:
        return faultOrUnknown(contact.integrity)
    if contact.circuitBreak is not OPEN:
        return NO_CANDIDATE
    if contact.targetContext == TARGET:
        return CANDIDATE(ON_TARGET)
    if contact.targetContext == NON_TARGET:
        return CANDIDATE(OFF_TARGET)
    return faultOrUnknown(contact.targetContext)

function acceptFoilHit(state, hit):
    if state.side[hit.side].registered:
        return state

    if state.windowEndsAtUs exists and hit.qualifiedAtUs >= state.windowEndsAtUs:
        return lockAndReject(state, hit, "foil-window-expired")

    accept(hit)
    state.side[hit.side].registered = true

    if state.firstSignalAtUs is absent:
        state.firstSignalAtUs = hit.qualifiedAtUs
        state.windowEndsAtUs = hit.qualifiedAtUs + 300000

    return state
```

## Appendix C: epee pseudocode

```text
function classifyEpee(contact):
    if contact.lineIntegrity is not INTACT:
        return faultOrUnknown(contact.lineIntegrity)
    if contact.tipCircuit is OPEN:
        return NO_CANDIDATE
    if contact.tipCircuit is not confidently CLOSED:
        return UNKNOWN
    if contact.groundedMaterial == GROUNDED:
        return REJECTED_GROUNDED
    if contact.groundedMaterial is not confidently CLEAR:
        return UNKNOWN
    return CANDIDATE(VALID)

function resolveEpeeHits(qualifiedHits, pendingCandidates):
    sort qualifiedHits by startedAtUs, then stable side

    if no first hit exists:
        first = qualifiedHits.first
        accept(first)
        firstContactAtUs = first.startedAtUs

    for hit in qualifiedHits excluding first:
        separationUs = hit.startedAtUs - firstContactAtUs
        if separationUs <= 45000:
            accept(hit)
        else:
            reject(hit, "epee-window-expired")

    pendingInsideWindow = any candidate where
        candidate.startedAtUs - firstContactAtUs <= 45000

    if nowUs - firstContactAtUs > 45000 and not pendingInsideWindow:
        lock()
```

## Appendix D: sabre and whip-over pseudocode

```text
function advanceBladeHistory(history, contact, nowUs):
    if bladeContact is UNKNOWN:
        return UNKNOWN_HISTORY

    if history is absent:
        if contact.targetEligible and contact.bladeContact == PRESENT:
            return { startedAtUs: nowUs, interruptions: 0, last: PRESENT }
        return absent

    elapsedUs = nowUs - history.startedAtUs
    if elapsedUs >= 20000:
        return absent

    if history.last == PRESENT and contact.bladeContact == ABSENT:
        history.interruptions += 1

    history.last = contact.bladeContact
    return history

function classifySabre(contact, history, nowUs):
    require trusted target, external path, and blade observations

    if contact.target is NON_CONDUCTIVE:
        return NO_CANDIDATE
    if contact.externalPathUpperMilliOhms > 100000:
        return REJECTED_EXTERNAL_PATH

    if history exists:
        elapsedUs = nowUs - history.startedAtUs

        if elapsedUs <= 5000:
            return CANDIDATE(VALID)
        if history.interruptions > 10:
            return INDETERMINATE
        if elapsedUs < 20000:
            return REJECTED_WHIPOVER

    return CANDIDATE(VALID)

function acceptSabreHit(state, hit):
    if state.side[hit.side].registered:
        reject(hit, "same-side-inhibit")
    else if state.windowEndsAtUs exists and hit.qualifiedAtUs >= state.windowEndsAtUs:
        lockAndReject(hit, "sabre-window-expired")
    else:
        accept(hit)
        state.side[hit.side].registered = true

        if state.firstSignalAtUs is absent:
            state.firstSignalAtUs = hit.qualifiedAtUs
            state.windowEndsAtUs = hit.qualifiedAtUs + 170000
```

## Appendix E: source ledger

### Normative and project sources

| Source | Role |
| --- | --- |
| [FIE Material Rules, August 2026, Annex B, pp. 77-82](fie-material-rules-2026-08-en.pdf#page=77) | Normative apparatus behavior. Annex B pages 77-82 define the weapon calculations. |
| [FIE traceability matrix](fie-traceability-matrix.md) | Local rule IDs, page citations, and unresolved interpretation register. |
| [Weapon-mode programming specification](weapon-scoring-programming-specification.md) | Normative project programming baseline. |
| [Timing-table contract](../timing-table-contract.md) | Immutable runtime selections and boundary policy. |
| [Seven-conductor signal contract](../seven-conductor-signal-contract.md) | Acquisition phases, conductor relations, and trusted observation vocabulary. |
| [Decision-record contract](../decision-record-contract.md) | Immutable scoring evidence and processor-boundary record. |

### Principal prior-art sources

| Repository and inspected pin | Use in this guide | Known limitation |
| --- | --- | --- |
| [OpenPiste `esp32scoringdeviceMqtt@ed6485efeb`](https://github.com/pietwauters/esp32scoringdeviceMqtt/tree/ed6485efeb) | Phased readings, calibrated thresholds, weapon modules, diagnostics, and selected 300/45/170 ms windows | Protocol tests do not prove the complete Annex B weapon matrix. Its `sabreFIE.cpp.txt` whip-over sketch is incomplete and is not used as conformance evidence. |
| [wnew `fencing_scoring_box@2b1698f599`](https://github.com/wnew/fencing_scoring_box/tree/2b1698f599) | Small candidate timers, on/off-target branches, and all-weapon scalar timing | Sabre lacks whip-over; some variants retain obsolete 120 ms timing; lockout is anchored differently from this guide. |
| [Copis `@c671f790fb`](https://github.com/TheGrimReaper13/Copis/tree/c671f790fb) | Explicit sabre contact history, interruption count, target qualification, control-break timing, and 170 ms selection | Sabre only; repository states whip-over is untested and records false-positive and indicator defects. |
| [Inexfensive `@31dce8279c`](https://github.com/mschnur/inexfensive/tree/31dce8279c) | Readable whip-over state and present-to-absent interruption counting | Uses obsolete 120 ms sabre lockout and reports unreliable foil/sabre sensing. |
| [Sentinel `@55f8559b31`](https://github.com/phillip-toone/sentinel/tree/55f8559b31) | Separation of electrical scanning from game rules and explicit seven-line continuity acquisition | Architecture and experiments only; no production weapon rule engine. |

The complete inventory and license observations are in the
[GitHub fencing-scoring repository catalog](prior-art/fencing-scoring-github-catalog.md). The comparative limitations are
in the [prior-art analysis](prior-art/fencing-scoring-prior-art-analysis.md).
