# Decision record contract

This is the M0-05 canonical logical schema for an immutable scoring decision record. It replaces the prototype
on-target-only `ScoringDecisionRecord` shape in `src/device.ts` when M2 implements event capture. The prototype stays
unchanged in M0-05 so this contract does not silently define M0-06 framing or M2 persistence.

The record is sufficient to replay the decision and its initial indication without running the scoring algorithm again.
Raw observations remain evidence, not input to a replay-time re-decision.

## Boundaries

This contract defines the payload only. It does not define a binary frame, JSON wire encoding, CRC, storage transaction,
signature, clock synchronization protocol, seven-line electrical topology, or a timing-table value. Those belong to
M0-06, M0-03, M0-10, M1-07, and M2 respectively.

All `*Us` fields are non-negative integer microseconds on the STM32 monotonic scoring clock. UTC and network-time
metadata are deliberately absent until M2-09. A record carries the result selected by the scoring authority; an ESP32
can display, store, or replay it but cannot create or reclassify it.

## Version and immutability policy

- `schemaVersion` is `1` for this contract. A consumer accepts only an explicitly supported version and rejects all
  others before using a record. It must not guess the meaning of a new field, disposition, diagnostic, or reason code.
- A published record, its provenance, and each referenced capture are immutable. Corrections are new records that cite
  their own capture evidence; they do not alter prior records.
- A raw capture reference is content-addressed by its SHA-256 digest. The capture payload format is identified but not
  specified here. Later work may choose storage and encoding without changing the decision meaning.
- The stable vocabularies below have no `other` or free-text fallback. A new semantic value requires a reviewed schema
  revision; older consumers fail closed instead of turning it into a hit or ignoring it.

## Required envelope

Every record has this envelope. Strings marked as identifiers or revisions are non-empty, opaque identifiers; they are
not display copy.

| Field | Requirement | Replay purpose |
| --- | --- | --- |
| `schemaVersion` | Integer `1` | Compatibility gate. |
| `recordId` | Immutable unique decision-record identifier | Links a correction or UI selection without changing a decision. |
| `decisionAtUs` | Within `captureWindow` and equal to the outcome's qualified, attempted, detected, reset, observed, or performed instant | Exact authority decision time. |
| `captureWindow` | `fromUs`, `throughUs`, `firstSequence`, `lastSequence`; ordered, inclusive bounds | Bounded acquisition interval considered by the decision. |
| `provenance` | Firmware, boot, hardware, rule, timing-table, line-contract, and calibration-profile identities | Identifies exactly which authority and contract made the decision. |
| `rawCaptureRefs` | Zero to eight bounded content-addressed references | Locates preserved pre/post samples or fault/calibration/reset context without embedding unbounded data. |
| `outcome` | Exactly one discriminated outcome below | Supplies the already-decided replay result. |

`provenance.firmware` contains `identity`, `buildDigest` (a `sha256:` prefix followed by 64 lowercase hexadecimal
digits), and `scoringBootId`. The remaining required
provenance fields are `hardwareRevision`, `ruleSetRevision`, `timingTableRevision`, `lineContractRevision`, and
`calibrationProfileRevision`. A missing or unknown identity is an uncertainty or reset record, not a fabricated value.

Each raw capture reference contains `captureId`, `kind`, `contentDigest`, `contentFormatRevision`, `fromUs`, `throughUs`,
`firstSequence`, `lastSequence`, and `sampleCount`. Its interval and sequence range must be ordered and bounded. Valid
`kind` values are `acquisition-samples`, `calibration-measurements`, `fault-context`, and `reset-context`.

## Outcome vocabulary

All outcomes contain a `signal` snapshot: `visual` is `valid-hit`, `off-target`, `diagnostic`, or `none`; `audible` is
`requested` or `none`; and `latched` is a Boolean. It captures the initial authority request, not a later UI state.
Physical lamp channels, audio duration, and reset wiring remain M0-03 and M0-04 responsibilities.

| `disposition` | Required fields beyond `signal` | Meaning |
| --- | --- | --- |
| `qualified-hit` | `weapon`, `side`, `hitStartedAtUs`, `qualifiedAtUs` | A valid scoring hit. `qualifiedAtUs` is not inferred later from raw samples. |
| `off-target` | `weapon: "foil"`, `side`, `qualifiedAtUs` | A qualified foil non-valid indication, distinct from a rejected contact. |
| `rejected-contact` | `weapon`, `attemptedSide`, `attemptedAtUs`, `reason` | A contact candidate that cannot produce a score. |
| `line-fault` | `lineId`, nullable `side`, `diagnostic`, `detectedAtUs`, `persistence` | A line/acquisition fault. `lineId` is defined by the versioned M0-03 line contract, not guessed here. |
| `reset` | `scope`, `cause`, `resetAtUs` | A reset lifecycle fact; it never means a hit. |
| `uncertainty` | `subject`, `effect`, `observedAtUs`, `lowerBound`, `upperBound`, `unit` | A bounded uncertainty that prevents a silent assumption. |
| `calibration` | `calibrationId`, `status`, `performedAtUs` | A calibration lifecycle result with its measurements in a raw capture reference. |

Valid `weapon` values are `epee`, `foil`, and `sabre`; valid sides are `left` and `right`.

### Stable rejection reasons

`rejected-contact.reason` is exactly one of the following values:

| Reason | Meaning |
| --- | --- |
| `candidate-cancelled-before-qualification` | Contact ended before the rule-qualified duration. |
| `contact-below-minimum-duration` | Measured duration is below the applicable minimum. |
| `contact-inside-lockout` | Contact occurred after the relevant bout lockout closed. |
| `grounded-contact` | Guard or piste grounding invalidated the contact. |
| `invalid-line-state` | The declared line state was illegal or contradictory. |
| `measurement-outside-qualified-range` | A required measurement was outside the approved qualifying range. |
| `non-target-surface` | Contact was known to be on a non-target surface. |
| `reset-in-progress` | A reset boundary prevented qualification. |
| `same-side-inhibit` | Weapon rules inhibit another hit for the same side. |
| `whipover-while-blade-contact` | Sabre blade/guard contact rejected a whipover candidate. |

`line-fault.diagnostic` is exactly one of `acquisition-gap`, `cross-line`, `excitation-invalid`, `open-circuit`,
`out-of-range-resistance`, `safe-state`, `sample-overrun`, or `short-to-ground`. Its `persistence` is either
`transient` or `latched-until-reset`.

`uncertainty.subject` is one of `calibration`, `capture-completeness`, `clock`, `identity`, `line-state`, `resistance`,
or `timing`; `effect` is `decision-with-caveat`, `diagnostic-only`, `not-qualified`, or `unavailable`; `unit` is
`none`, `ohm`, or `us`. Bounds are finite and ordered. This preserves unresolved cases such as the foil 450-475 ohm band
without treating an ambiguous state as a hit.

`reset.scope` is `stm32`, `esp32`, or `scoring-apparatus`; `cause` is `brownout`, `firmware-update`, `operator`,
`power-on`, or `watchdog`. `calibration.status` is `passed`, `failed`, `expired`, or `unavailable`.

## Examples and executable acceptance

`src/decision-record.test.ts` round-trips one representative payload for every disposition, including qualified hit,
foil off-target, rejected grounded contact, line fault, reset, uncertainty, and calibration. It also rejects
`schemaVersion: 2` and an unknown rejection reason. The test uses a generic object serialization only to prove the
logical payload round-trip; it does not establish a device transport format.

```json
{
  "schemaVersion": 1,
  "recordId": "record-001",
  "decisionAtUs": 10500,
  "captureWindow": { "fromUs": 10000, "throughUs": 11000, "firstSequence": 40, "lastSequence": 44 },
  "provenance": {
    "firmware": {
      "identity": "stm32-scoring",
      "buildDigest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "scoringBootId": "boot-008"
    },
    "hardwareRevision": "evt-a",
    "ruleSetRevision": "rules-1",
    "timingTableRevision": "timing-1",
    "lineContractRevision": "lines-1",
    "calibrationProfileRevision": "calibration-1"
  },
  "rawCaptureRefs": [
    {
      "captureId": "capture-001",
      "kind": "acquisition-samples",
      "contentDigest": "sha256:9191919191919191919191919191919191919191919191919191919191919191",
      "contentFormatRevision": "capture-1",
      "fromUs": 10000,
      "throughUs": 11000,
      "firstSequence": 40,
      "lastSequence": 44,
      "sampleCount": 5
    }
  ],
  "outcome": {
    "disposition": "qualified-hit",
    "weapon": "epee",
    "side": "left",
    "hitStartedAtUs": 10100,
    "qualifiedAtUs": 10500,
    "signal": { "visual": "valid-hit", "audible": "requested", "latched": true }
  }
}
```

## Traceability and handoff

The contract directly covers FOIL-01 and FOIL-04, EPEE-04, SABRE-02, SABRE-03, SABRE-07, OUT-01, OUT-03, GEN-02,
GEN-04, GEN-06, GEN-07, CLOCK-01, and PWR-03 in the traceability matrix. It records all open values through revisions,
bounded uncertainty, and raw evidence rather than inventing a threshold or seven-line state.

M0-06 may frame this payload but may not alter its meaning. M0-07 may refer to the stable disposition and reason
vocabulary in scenarios but does not own scenario examples here. M2-04 implements capture production, M2-08 persistence,
M2-09 wall-clock uncertainty metadata, and M2-11 replay rendering. M1 must freeze rule and timing revisions before any
record claims a rule-specific endpoint decision.
