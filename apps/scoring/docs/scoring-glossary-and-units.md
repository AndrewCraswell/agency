# Scoring glossary and units contract

**Contract:** M0-02
**Revision:** `m0-02`
**Scope:** names and machine units at the electrical scoring boundary

This page is the naming contract for scoring code, firmware records, replay
samples, fixtures, protocol messages, and evidence. The machine-readable
implementation is [`../src/scoring-glossary-and-units.ts`](../src/scoring-glossary-and-units.ts).
The exported `SCORING_GLOSSARY` is immutable and is validated before use.

## Authority and boundary

The normative source is the August 2026 English FIE Material Rules in
[`fie-material-rules-2026-08-en.pdf`](specifications/fie-material-rules-2026-08-en.pdf).
The local traceability index is [`fie-traceability-matrix.md`](specifications/fie-traceability-matrix.md).
M0-02 names the concepts and units. It does not choose the seven-line physical
topology, excitation phases, analogue thresholds, endpoint inclusion, or
output polarity. Those remain M0-03 and later weapon-specific contracts.

The order of authority is:

1. FIE article or Annex B wording.
2. A product rule-table choice, explicitly labelled as a product choice.
3. A measurement or test result as evidence of that implementation.
4. Favero FA-15 documents as prior art only.

The matrix rows exercised by this contract are GEN-01 through GEN-07,
FOIL-01 through FOIL-05, EPEE-01 through EPEE-05, SABRE-01 through SABRE-07,
OUT-01 through OUT-05, CLOCK-01, and PWR-01 through PWR-03.

## Canonical sides and lines

`left` and `right` are apparatus positions. They are not competitors, teams,
lamp colors, fencing priority, or referee scores. The side-to-lamp mapping is
configuration and must not be inferred.

The seven logical conductors are exactly:

| Identifier | Meaning |
| --- | --- |
| `left.A` | Logical conductor A for the left apparatus position |
| `left.B` | Logical conductor B for the left apparatus position |
| `left.C` | Logical conductor C for the left apparatus position |
| `right.A` | Logical conductor A for the right apparatus position |
| `right.B` | Logical conductor B for the right apparatus position |
| `right.C` | Logical conductor C for the right apparatus position |
| `piste` | Shared conductive piste and its declared ground reference |

`A`, `B`, and `C` are conductor identities, never side names, weapon names,
sensors, or released connector pin numbers. `piste` is not protective earth,
signal ground, chassis ground, or a processor ground pin. A physical pin
assignment is not part of M0-02.

## States and outcomes

These are distinct observations and outcomes. A candidate is not a hit, a
line fault is not a rejected contact, and unavailable is not no signal.

| Canonical name | Meaning |
| --- | --- |
| `open` | Declared circuit path is not electrically closed in its test conditions |
| `closed` | Declared circuit path is electrically closed in its test conditions |
| `grounded` | Observed path connects to the declared piste or earthed-material reference |
| `crossLine` | A conductor connects to another logical conductor outside the declared phase |
| `outOfRange` | Measurement is outside the declared fixture, ADC, or rule range |
| `indeterminate` | Evidence cannot distinguish the required state or boundary within uncertainty |
| `unavailable` | No trusted observation exists because acquisition or authority is not ready |
| `safeInactive` | Output driver cannot assert a hit, diagnostic lamp, or audible signal |
| `candidate` | Rule-shaped interval started but has not met all qualification conditions |
| `qualified-hit` | Candidate satisfies the released weapon rule table |
| `registered-hit` | Qualified hit recorded as an apparatus signal event |
| `rejected-contact` | Contact intentionally not registered because a stated rule condition failed |
| `line-fault` | Required electrical line or state cannot be trusted |
| `noSignal` | No apparatus signal was produced for the observed interval |
| `uncertainty` | Evidence is retained but its interval overlaps a decision boundary |

Weapon-specific source values retain their exact current spellings, including
`nonTarget`, `lameFault`, `weaponFault`, `withinRange`, `outsideRange`,
`eligible`, `ineligible`, `present`, `absent`, `normal`, `controlBreak`,
`abnormalChange`, and `nonConductiveSurface`.

Product classifications are `on-target` and `off-target`. FIE wording such as
`valid hit` and `non-valid hit` is explanatory or normative source wording; it
must not be used as a generic schema success value. The implementation keeps
`valid-hit` and `non-valid` only as explicitly classified output vocabulary.

Use weapon-qualified observations where an unqualified word could be
overloaded: `epeeTipContact`, `foilCircuitBreak`, `sabreTargetContact`,
`bladeContact`, and `guardGroundContact`. A raw `contact`, `touch`, `strike`,
or `hit` field is not a substitute for the qualified term.

## Time

Every monotonic scoring instant and elapsed duration is a non-negative safe
integer number of microseconds. The machine unit is `us`; the source field
suffix is `Us`. `wallAtUs` is the explicit exception: it is a signed
application wall-clock provenance value in integer microseconds since the Unix
epoch, and it never drives scoring. Examples from the current scoring types
include:

| Canonical field | Meaning |
| --- | --- |
| `atUs` | Monotonic sample or observation instant |
| `startedAtUs` | Candidate start instant |
| `qualifiedAtUs` | Qualification instant |
| `candidateSinceUs` | Start of the current candidate |
| `lastSampleAtUs` | Latest accepted sample instant |
| `firstHitAtUs` | Epee hit-window anchor |
| `firstHitSignalledAtUs` | First emitted signal instant |
| `lockoutEndsAtUs` | Weapon lockout end instant |
| `capturedFromUs` and `capturedThroughUs` | Inclusive replay-evidence bounds |
| `durationUs` | Elapsed duration |
| `wallAtUs` | Signed application wall-clock microseconds since the Unix epoch, never a scoring input |

Milliseconds, seconds, fractional numbers, negative values in monotonic
fields, unsafe integers, and fields named only `time`, `timestamp`, `timeout`,
or `delay` are not machine representations. A human-facing display may
convert `us` to the FIE display unit, but the source record remains integer
`us`. The tuple
`(scoringBootId, atUs)` identifies an instant; `atUs` is not comparable across
boot identities.

Current timing-table names remain qualified and unit-bearing, including
`contactMinimumUs`, `doubleHitWindowUs`, `contactBreakMinimumUs`,
`lockoutUs`, `minimumContactUs`, `bladeRegistrationLatestUs`,
`bladeRecoveryUs`, `controlBreakUs`, and `sensitivityTestPointUs`.

## Electrical quantities

Electrical quantities carry a unit in their field name or in a typed unit
object. Bare `resistance`, `voltage`, `current`, `capacitance`, `power`, and
`frequency` fields are prohibited.

| Machine unit code | Field suffix | Human symbol | Example |
| --- | --- | --- | --- |
| `milliOhm` | `MilliOhms` | mΩ | `resistanceMilliOhms: 200_000` |
| `milliVolt` | `Millivolts` | mV | `voltageMillivolts: 12_000` |
| `microAmp` | `Microamps` | µA | `currentMicroamps: 250` |
| `milliAmp` | `Milliamps` | mA | `currentMilliamps: 250` |
| `nanoFarad` | `Nanofarads` | nF | `capacitanceNanofarads: 100` |
| `milliWatt` | `Milliwatts` | mW | `powerMilliwatts: 500` |
| `milliHertz` | `MilliHertz` | mHz | `frequencyMilliHertz: 1_000` |

The code is machine vocabulary, not a parser for display symbols. `ms`, `s`,
`ohm`, `Ω`, and an unqualified `milliOhms` unit code are rejected. Values are
integer safe numbers and are non-negative for the declared scoring quantities.
For example, the FIE 200 Ω reference is `200_000` milli-ohms, not `200` with
an implicit unit.

Relevant FIE reference points remain traceability values, not endpoint
decisions: foil 13_000, 14_000, and 15_000 us; epee 2_000 and 10_000 us;
sabre 100 and 1_000 us; and the electrical 100_000, 200_000, 250_000,
450_000, and 500_000 milli-ohm points. Product timing selections such as the
current 45_000 us epee lockout are implementation choices and must not be
described as FIE constants.

## Identity and reset names

Keep `scoringBootId`, `sequence`, `sequenceRange`, `firmwareIdentity`,
`firmwareDigest`, `ruleRevision`, `timingRevision`, and `protocolVersion`
separate. None may be collapsed into a generic `id`, `version`, or `revision`.

Reset names are also distinct: `boutReset`, `supervisorReset`,
`processorReset`, `watchdogReset`, `brownoutReset`, `powerCycle`,
`updateReset`, and `factoryReset`. A processor reset is not a bout reset and
must not create a hit. During boot, reset, line fault, invalid timing,
uncalibrated acquisition, or power fault, the scoring authority is
`unavailable` and outputs are `safeInactive`.

## Machine-readable validation rules

`validateScoringGlossary` accepts only the exact glossary shape and returns a
deeply frozen copy. It rejects:

- duplicate canonical names, including case or whitespace variants;
- duplicate unit codes or unsupported unit codes;
- a term that references a unit not present in the glossary;
- a quantity term without a unit or a non-quantity term with one; and
- an alias that collides with a canonical name or another alias.

There is no `none` unit. Non-quantity terms use `unit: null`, and quantity
terms always name one of the declared machine units. The shipped glossary
intentionally has no convenience aliases. If a future
alias is reviewed, it must be one unambiguous spelling in the same namespace.
`resolveScoringGlossaryTerm` resolves only canonical names or those reviewed
aliases. `validateGlossaryMeasurement` rejects unknown units, display symbols,
fractions, negative values, and extra properties. `assertIntegerMicroseconds`
is the shared guard for every internal instant and duration.

No validator converts an unknown unit into `noSignal`, `indeterminate`, or a
default unit. A malformed or ambiguous record fails closed and remains a
validation error.
