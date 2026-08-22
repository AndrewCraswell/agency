# Foil contact-break state-machine contract

**Task:** M1-03  
**Status:** host-only logical scorer; timing-table endpoints remain provisional

## Scope and authority

This contract covers the deterministic rule-layer projection in
[`foil.ts`](../src/foil.ts). It consumes trusted logical observations, qualifies
foil circuit breaks, classifies on-target and off-target contacts, and applies
same-side inhibition plus the foil event window. It does not select an analogue
topology, infer target context from an ADC value, decide a resistance boundary,
or drive lamps and audio.

The normative source is FIE Material Rules, Book 3, August 2026, Annex B,
A.1(a)-A.2, pp. 77-79, as traced by FOIL-01 through FOIL-05 in
[`fie-traceability-matrix.md`](fie-traceability-matrix.md). The local FIE
matrix is authoritative. The seven-conductor contract supplies the logical
input vocabulary and requires untrusted observations to suppress qualification.

## Inputs and state

Each side receives a `FoilContact` at a non-decreasing safe-integer `atUs` on
the scoring clock. `left` and `right` are apparatus positions, not lamp colours
or priority.

| Field | Values used by M1-03 | Outcome |
| --- | --- | --- |
| `circuitBreak` | `open`, `closed`, `indeterminate`, `unavailable` | An `open` circuit may start or continue a candidate. Every other value clears it; untrusted states never become `closed`. |
| `targetContext` | `target`, `nonTarget`, `grounded`, `indeterminate`, `unavailable` | `target` leads to `on-target`; `nonTarget` leads to `off-target`; `grounded` rejects the contact; untrusted states clear it. |
| `integrity` | `intact`, `lameFault`, `weaponFault`, `indeterminate`, `unavailable` | A lame or weapon fault clears the candidate and exposes a side-local diagnostic state. It cannot be reclassified as target context. |
| `insulationDiagnostic` | `withinRange`, `outsideRange`, `indeterminate`, `unavailable` | Preserved as an M1-04 handoff only. It does not change M1-03 scoring. |

`lameFault` identifies the opposing conductive-target return used for the
acting-side observation. `weaponFault` identifies the acting-side foil loop.
They are trusted acquisition projections, not a raw electrical claim about a
particular bodywire conductor. In particular, they do not represent the
anti-blocking own weapon-to-jacket insulation indication in FOIL-04.

An `indeterminate` or `unavailable` input clears only that side's candidate;
an independent trusted observation on the other side remains eligible. This is
the containment required by the seven-conductor contract. The state exposes
`grounded-contact`, `lame-fault`, `weapon-fault`, `indeterminate`, or
`unavailable` as the latest side-local observation status. Later event capture
maps them to the decision-record `rejected-contact`, `line-fault`, or
`uncertainty` vocabulary with preserved acquisition evidence; M1-03 does not
invent a persistence or raw-capture policy.

## Qualification and classification

The machine starts a candidate when `circuitBreak` is `open`, integrity is
`intact`, and target context is `target` or `nonTarget`. That classification
must remain stable until qualification; a target-context transition starts a
new candidate. A candidate qualifies at the first trusted open observation at
least `13_000 us` after its observed start. The emitted hit carries the
classification, side, observed start, and qualification time.

| Duration at a trusted qualifying observation | M1-03 result | Basis |
| --- | --- | --- |
| `12_999 us` | No hit | Conservative product floor. FIE does not guarantee registration below 13 ms. |
| `13_000 us` | Qualify | FIE FOIL-02 guaranteed region. |
| `14_000 us` | Qualify | FIE nominal `14 ms +/- 1 ms` point. |
| `15_000 us` | Qualify | FIE FOIL-02 guaranteed region. |
| Above `15_000 us` | May qualify if it remained trusted until a later sample | FIE gives a guarantee through 15 ms, not a maximum break duration. |

The 13,000-us floor is a deterministic product choice at the start of the
FIE-guaranteed band, not a claim that FIE forbids a shorter break from
registering. The input adapter does not claim it has observed a physical edge
at those exact instants. Its phase completion, resistance interval, and
uncertainty must be established by the front end. A grounded target context
must never qualify; this preserves FOIL-03 and GEN-03 without treating a guard
or piste path as a non-target hit.

## Inhibition and lockout

After a side has registered an on-target or off-target hit, that side cannot
register another hit before bout reset. An opposing side can register a
qualified hit while the event window remains open. Hits qualified in the same
input frame are ordered by candidate start, then `left` before `right`; this
orders records only and assigns no fencing priority.

FOIL-05 says later signals are ignored after `300 ms +/- 25 ms` from the first
**signalled** hit. Therefore the anchor is `qualifiedAtUs`, not circuit-break
start. The FIE-supported band is `275_000` through `325_000 us`; FIE does not
choose an exact endpoint. M1-03 uses `300_000 us` as a clearly labelled
**provisional product policy**, inclusive at the endpoint: at
`firstHitSignalledAtUs + 300_000`, no additional signal qualifies and the
state becomes locked. A candidate that began before that instant but would
qualify at or after it is ignored because qualification is the signal instant.
M1-07 must replace this with a reviewed versioned timing-table policy. It must
not be represented as an FIE constant.

## M1-04 handoff

FOIL-04's anti-blocking mode, 200-ohm scoring behavior, 450/475-ohm yellow
indication guarantees, and the unresolved 450-475-ohm band are not implemented
here. `insulationDiagnostic` is carried unchanged so M1-04 can add a separate
diagnostic decision without changing an already-qualified M1-03 contact.
`withinRange` and `outsideRange` have no yellow-lamp meaning in this task.

## Proposed golden scenarios for later manifest integration

This task deliberately does not modify the shared golden manifest. The later
integration task should add these entries and scenario files after aligning
them with the corpus runner:

| Scenario ID | Traceability | Required vector result |
| --- | --- | --- |
| `foil.break-boundaries` | FOIL-01, FOIL-02 | Both sides: no hit at 12,999 us; on-target hits at 13,000, 14,000, and 15,000 us; no artificial upper-duration rejection. |
| `foil.target-context` | FOIL-01, FOIL-03 | Both sides: target becomes `qualified-hit`, non-target becomes `off-target`, grounded produces no hit, and a context transition restarts the candidate. |
| `foil.integrity-and-uncertainty` | FOIL-03, GEN-03 | Both sides: lame fault, weapon fault, indeterminate, and unavailable clear only the affected candidate while an independent opponent hit remains eligible. |
| `foil.same-side-and-lockout` | FOIL-05 | Same-side inhibition, opposite-side registration before cutoff, first-signalled-hit anchor, and provisional 300,000-us inclusive cutoff. Include FIE reference points 275,000 and 325,000 us as non-endpoint evidence. |
| `foil.insulation-handoff` | FOIL-04 | The four M1-04 diagnostic input values do not alter an M1-03 hit. Later M1-04 vectors add resistance intervals and yellow-indication expectations. |

## Acceptance evidence

[`foil.test.ts`](../src/foil.test.ts) covers both sides, 13/14/15-ms points,
target versus non-target classification, grounded rejection, lame and weapon
fault containment, explicit indeterminate and unavailable inputs, the M1-04
handoff, same-side inhibit, first-signalled-hit lockout, timestamp validation,
and deterministic simultaneous ordering. The scoring package retains 100%
coverage thresholds.
