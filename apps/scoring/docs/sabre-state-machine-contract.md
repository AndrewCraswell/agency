# Sabre contact and control-break state-machine contract

**Task:** M1-05
**Status:** host-only logical scorer; timing-table endpoints and analogue acquisition remain provisional

## Scope and authority

[`sabre.ts`](../src/sabre.ts) is the deterministic host rule layer for the
trusted sabre inputs defined by the `sabre-*` phases in
[`seven-conductor-signal-contract.md`](seven-conductor-signal-contract.md).
It qualifies target contacts, keeps yellow and white diagnostics distinct from
hits, models a trusted blade-mediated whipover history, and applies a
provisional opposite-side event window. It does not select a circuit topology,
derive a raw resistance threshold, control lamps or audio, apply referee
priority, or infer a physical acquisition history from raw samples.

The FIE Material Rules, Book 3, August 2026, Annex B C(a)-C(b), pp. 81-82 are
the authority, as traced by SABRE-01 through SABRE-07 and OUT-01 through OUT-04
in [`fie-traceability-matrix.md`](fie-traceability-matrix.md). This task
exercises SABRE-01 through SABRE-07. Its SABRE-06 endpoints are provisional
product choices, not an FIE timing-table release.

## Inputs and containment

Each side receives a `SabreContact` at a non-decreasing, non-negative safe
integer `atUs`. `left` and `right` are apparatus positions, never lamp colours
or priority. The acquisition boundary has already classified every input.

| Input | Values | Rule-layer meaning |
| --- | --- | --- |
| `targetContact` | `target`, `nonConductiveSurface`, `indeterminate`, `unavailable` | Only `target` may begin or continue a target candidate. A non-conductive surface is an explicit rejection. |
| `externalPathEligibility` | `eligible`, `ineligible`, `indeterminate`, `unavailable` | A trusted logical result for SABRE-03's external connection up to 100 ohms. It intentionally carries no raw resistance or analogue threshold. Only `eligible` can score. |
| `bladeContact` | `present`, `absent`, `indeterminate`, `unavailable` | A trusted blade/guard relation used to start and retain a blade-mediated history. `present` is not, by itself, a hit or rejection. Indeterminate and unavailable fail closed. |
| `ownEquipmentFault` | `present`, `absent`, `indeterminate`, `unavailable` | A side-local yellow diagnostic only. It never creates, suppresses, or reclassifies a target hit. |
| `circuitBCFault` | `normal`, `controlBreak`, `abnormalChange`, `indeterminate`, `unavailable` | A side-local white diagnostic path only. It never creates, suppresses, or reclassifies a target hit. |

Target, external-path, and blade-contact uncertainty fails closed for the
affected side. It neither creates a hit nor alters an independent trusted
observation on the other side. Own-equipment and B/C diagnostic inputs are
separate logical phases; their indeterminate or unavailable values assert no
diagnostic and do not coerce a trusted target input into a different result.
The acquisition profile must itself fail unavailable before presenting an
incomplete set as a trusted `target` contact.

## Contact qualification and blade-mediated whipover history

A target candidate starts at the first trusted `target` and `eligible`
observation. It qualifies at the first such observation at least `100 us`
later. Equality is included: 99 us is rejected, 100 us
qualifies, and 101 us qualifies. This explicit product endpoint ensures the
apparatus never signals below the SABRE-03 floor.

The FIE `0.1-1 ms` sensitivity wording provides a 1,000-us test point but does
not safely establish a host-only candidate expiry. The scorer therefore checks
999, 1,000, and 1,001 us without inventing a maximum duration. M1-07 and
analogue evidence must release any further endpoint policy.

When trusted `target`, `eligible`, and `bladeContact: present` coincide, the
scorer starts `bladeMediated` history with `startedAtUs`, the last trusted
blade-contact state, and an interruption count. It increments the count only
for a trusted `present` to `absent` transition. Equal-time samples are still
ordered by their submitted sample order, so the state does not infer an edge
between samples.

The following deterministic choices cover SABRE-06 while retaining its FIE
tolerances as explicit open interpretations:

| Elapsed from `bladeMediated.startedAtUs` | M1-05 result | Status |
| --- | --- | --- |
| Up to and including `5_000 us` | A trusted target candidate may qualify. | **Provisional product choice** for the FIE `0-4 ms (+1 ms)` registration region. |
| Above `5_000 us` and below `20_000 us`, with 0-10 interruptions | Clear or prevent a target candidate as `whipover-rejection`. | **Provisional product gate** spanning the FIE `4-15 ms (+5 ms)` prevention language. |
| The same prevention region with 11 or more interruptions | Clear or prevent the candidate as `indeterminate`. | Fail closed: FIE only states the no-more-than-10 condition and does not authorise a host-side hit beyond it. |
| At or after `20_000 us` | Clear the retained history before processing the current target observation. A later trusted target may qualify normally. | **Provisional product choice** at the outer end of FIE's `15 ms +/- 5 ms` recovery band. |

Thus a blade-mediated target that reaches the 100-us floor inside the early
region can register. An unsignalled sequence is retained after target loss so
that a later target cannot become a false hit during the prevention region.
At the recovery endpoint the current sample only starts a new ordinary
candidate; it never fabricates an immediate hit. `indeterminate` or
`unavailable` blade input clears the candidate and retained history for that
sample and fails closed. The physical edge-time bounds, the exact 4/5/15/20-ms
endpoint policy, and the relationship between the trusted logical relation and
the actual blade/guard path remain M0-03/M4/M1-07 review items.

## Diagnostics

`ownEquipmentFault: present` gives `yellow-on`; `absent` gives `yellow-off`.
The FIE's yellow-lamp relation is side local. A simultaneous or later valid
target hit remains eligible, including when the own equipment is at fault.
The 0-450-ohm and below-250-ohm SABRE-04 physical cases must be resolved by the
acquisition contract before they are projected to this logical input; this
scorer makes no threshold claim.

`circuitBCFault: abnormalChange` gives `white-on` immediately. A trusted
`controlBreak` starts a separate candidate and gives `white-on` at exactly
`3_000 us`; 2,999 us does not, while 3,001 us does. This is a provisional
nominal choice within SABRE-07's `3 ms +/- 2 ms` tolerance. The input already
means a break strictly above 250 ohms, so equality and analogue uncertainty are
not decided in this module. A completed white diagnostic is latched in the
host state pending bout reset; M0-04/M0-05 own physical white-lamp persistence,
audio, record shape, reset authority, and recovery behaviour.

Yellow and white diagnostic values are not hits, off-target hits, or referee
decisions. They create no `SabreHit` and cannot prevent an independent trusted
opponent target contact.

## Inhibition and provisional event window

After a side registers a target hit, it cannot register another before bout
reset. Simultaneous qualifying hits are ordered by observed candidate start,
then `left` before `right`; this orders records only and assigns no priority.

SABRE-05 measures the later opposing hit after the first registered signal.
This scorer anchors the event window to the first `qualifiedAtUs`, named
`firstHitSignalledAtUs`. The FIE-supported range is 160,000 through 180,000 us
around a nominal 170,000 us, but does not state endpoint inclusion or settle
the physical-contact versus lamp-signal anchor. M1-05 freezes the following
**provisional product policy**: `170_000 us`, anchored to the first qualified
signal and inclusive at the end. At
`firstHitSignalledAtUs + 170_000`, no additional candidate can qualify and the
state becomes locked. The 160,000- and 180,000-us values are retained as
non-endpoint reference points, not alternate runtime cutoffs. M1-07 must
replace this with a reviewed, versioned timing-table rule.

## Golden-scenario handoff

This task intentionally adds no shared golden scenarios or manifest rows;
M1-08 owns corpus integration. It should add both-side vectors for:

| Scenario topic | Traceability and expected result |
| --- | --- |
| Target duration | SABRE-01/SABRE-03: reject 99 us; qualify 100 and 101 us; retain 999/1,000/1,001-us sensitivity evidence. |
| Target and fault containment | SABRE-01/SABRE-04: non-conductive rejection, own-equipment yellow with a valid hit, external eligibility, uncertainty, and opposite-side independence. |
| Whipover history | SABRE-03/SABRE-06: trusted early blade-mediated registration; no false hit at 5 and 15 ms; recovery at 20 ms; interruption counts 0, 10, and 11 with the over-10 case explicitly indeterminate. |
| B/C diagnostics | SABRE-02/SABRE-07: abnormal change, and control break at 2,999/3,000/3,001 us, separately from hit decisions. |
| Lockout | SABRE-05: both sides, deterministic simultaneous ordering, first-qualified-signal anchor, 160/170/180-ms references, and the provisional 170,000-us inclusive cutoff. |

## Acceptance evidence

[`sabre.test.ts`](../src/sabre.test.ts) covers both sides, 99/100/101-us and
999/1,000/1,001-us points, 2,999/3,000/3,001-us control-break handling,
target versus non-conductive classification, own-equipment and B/C diagnostics,
trusted blade-mediated history at 0/4/5/15/20 ms, interruption counts 0/10/11,
recovery without a fabricated hit, external-path eligibility,
indeterminate/unavailable containment, provisional lockout, deterministic
ordering, same-side inhibition, and safe-integer monotonic timestamps. The
scoring package retains 100% coverage thresholds.
