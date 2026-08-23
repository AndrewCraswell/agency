# Foil anti-blocking insulation decision contract

**Task:** M1-04
**Status:** host-only resistance decision contract; no analogue acquisition implementation

## Scope and authority

This contract implements the host-side resistance decisions required by FIE
FOIL-04 in [`foil-insulation.ts`](../src/foil-insulation.ts). It is used only
when a reviewed apparatus configuration selects anti-blocking foil mode. It
consumes already trusted, calibrated resistance measurements and produces two
independent outcomes per side:

1. a return-circuit **scoring eligibility** outcome; and
2. an own weapon-to-jacket **yellow diagnostic** outcome.

It neither observes conductors nor declares a circuit topology, ADC threshold,
calibration method, lamp driver, persistence policy, or a referee action. Those
remain M0-03, M0-04, and M4 work. A decision here is not a contact-break hit,
does not call the lamp hardware, and does not alter the M1-03 foil state
machine.

The normative source is FIE Material Rules, Book 3, August 2026, Annex B,
A.2, p. 79, as traced in FOIL-04 of
[`fie-traceability-matrix.md`](fie-traceability-matrix.md). The terms and
interval rules in [`scoring-glossary.md`](scoring-glossary.md), the
affected-side `foil-insulation-diagnostic` phase in
[`seven-conductor-signal-contract.md`](seven-conductor-signal-contract.md),
and the uncertainty conventions in
[`golden-scenario-contract.md`](golden-scenario-contract.md) apply.

## Input and validation

Each `FoilInsulationSample` carries a non-negative safe-integer `atUs` and one
observation for `left` and `right`. An observation contains the two distinct
measurements below. A zero value is measured resistance, never absence.

| Input | Perspective | Meaning |
| --- | --- | --- |
| `opponentReturnResistance` | acting-side | The resistance in the return circuit used for that side's potential foil contact. |
| `ownWeaponToJacketInsulation` | affected-side | The resistance between that side's weapon and its own conductive equipment. It is the yellow-diagnostic input. |

Every known measurement supplies non-negative safe-integer
`resistanceMilliOhms` and `resistanceUncertaintyMilliOhms` together. The
evaluated interval is `[max(0, value - uncertainty), value + uncertainty]` in
milli-ohms. The upper bound must also be a safe integer. Both fields are
`null` only when a trusted measurement is unavailable. A partial, negative,
fractional, unsafe, or overflowing measurement is rejected at the API boundary
and cannot become a decision.

## Decisions

### Return-circuit scoring eligibility

The FIE requirement is a valid hit up to 200 Ω and non-valid hits above 200 Ω
in the opponent's return circuit. This module calls the outcomes
`valid-hit-eligible` and `non-valid-hit-eligible`: they are resistance
eligibility only, not actual hit records. M1-03 still requires a trusted foil
circuit break and target context before it can qualify an `on-target` or
`off-target` hit.

| Entire measurement interval | Result | Interpretation |
| --- | --- | --- |
| At or below 200,000 milli-ohms | `valid-hit-eligible` | **Provisional product endpoint policy:** treats exact 200 Ω as within “up to 200 Ω.” It is explicit so M4 evidence or rule review can replace it without claiming an analogue threshold. |
| Strictly above 200,000 milli-ohms | `non-valid-hit-eligible` | FIE FOIL-04 scoring behavior for values above 200 Ω. |
| Overlaps 200,000 milli-ohms | `indeterminate` | Fail closed. No valid/non-valid classification is inferred. |
| Unavailable | `unavailable` | Fail closed. No scoring eligibility is inferred. |

### Yellow diagnostic

FIE requires yellow to be on below 450 Ω and never on above 475 Ω. It does not
assign a yellow result in the 450–475 Ω band. Yellow indicates an insulation
fault only; it is not a valid hit, non-valid hit, rejection, or no-hit
decision. A lit lamp requires the referee to stop the bout and call technical
experts under FOIL-04, but that procedure is outside this host contract.

| Entire measurement interval | Result | Interpretation |
| --- | --- | --- |
| Strictly below 450,000 milli-ohms | `yellow-on` | FIE yellow-on guarantee. |
| Strictly above 475,000 milli-ohms | `yellow-off` | FIE yellow-off guarantee. |
| Touches or overlaps 450,000–475,000 milli-ohms | `indeterminate` | **Provisional fail-closed policy.** The band remains unresolved; no analogue threshold or hysteresis is invented. |
| Unavailable | `unavailable` | Fail closed. No yellow state is asserted. |

The two results are deliberately independent. In particular, a low own
weapon-to-jacket insulation resistance may yield `yellow-on` while the
opponent-return resistance is `valid-hit-eligible`; the yellow indication does
not suppress, create, or reclassify the contact. Conversely, an unavailable
yellow input does not change a trusted return-circuit eligibility result.

## Integration boundary

M1-03's `FoilContact.insulationDiagnostic` remains an input handoff and its
scoring behavior remains unchanged. A future adapter may map the diagnostic
result to that vocabulary only after M0-05 event records, M0-04 output
ownership, diagnostic persistence, and the selected anti-blocking apparatus
mode are reviewed. It must preserve `indeterminate` and `unavailable` rather
than coercing them to `yellow-on` or `yellow-off`.

The current `foil.insulation-handoff` golden scenario proves only that the
diagnostic handoff does not alter contact scoring. It does not assert these
resistance decisions or a physical yellow output. Focused host tests preserve
separate scoring-eligibility and yellow-diagnostic assertions at 0, 199,999,
200,000, 200,001, 449,999, 450,000, 475,000, 475,001, and 500,000
milli-ohms.

## Open interpretations

1. The exact equality policy at 200 Ω is a documented product interpretation
   of “up to,” not an analogue or FIE sampling threshold. M4 calibration and
   rule review must confirm or replace it.
2. The FIE leaves 450–475 Ω open. This contract intentionally returns
   `indeterminate`; a future hysteresis policy requires independent evidence
   and review.
3. The mapping from this host diagnostic to yellow-lamp persistence, output
   ownership, transport records, and referee-facing workflow remains outside
   M1-04.
