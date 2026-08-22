# Epee state-machine audit

**Task:** M1-01  
**Status:** audited baseline; no released endpoint policy  
**Scope:** [`epee.ts`](../src/epee.ts) and its direct unit tests. This is not an
analogue qualification, a seven-conductor implementation, or M1-02
exceptional-resistance work.

## Authority and boundary

The normative source is FIE Material Rules, Book 3, August 2026, Annex B,
B(a)-B(f), printed pages 80-81, as traced by
[`fie-traceability-matrix.md`](fie-traceability-matrix.md) rows EPEE-01 through
EPEE-05. The matrix is authoritative for this audit. Its `45_000 us` value is
explicitly a product implementation choice inside the FIE 40-50 ms tolerance;
it is not an FIE constant.

The existing public input is intentionally only a boolean adapter:

- `isTipClosed: true` represents a confirmed closed `epee-tip-loop`.
- `isGrounded: true` represents confirmed `epeeGroundedMaterial: grounded`.
- A candidate exists only while the first is true and the second is false.

That is the narrow subset permitted by the seven-conductor contract. It must
not encode `indeterminate`, `unavailable`, `crossLine`, `outOfRange`, measured
resistance, or an inferred physical transition as `false`. The future
acquisition layer owns those states and must suppress qualification where the
phase contract requires it.

## Retained behavior and evidence

| Topic | Current state machine behavior | Status and evidence |
| --- | --- | --- |
| Circuit completion | A confirmed closed, ungrounded input starts one side-local candidate. The first registered hit per side prevents another from that side. | Retained baseline for EPEE-01. `epee.test.ts` covers simultaneous contacts and start-time ordering. |
| Two-millisecond minimum | A candidate qualifies when a later confirmed closed, ungrounded sample has `atUs - candidateSinceUs >= 2_000`. A shorter interval cannot qualify. An open or grounded sample at the proposed qualification instant clears the candidate first. | Retained deterministic emulator boundary for EPEE-03. Tests cover one microsecond below and exactly 2,000 microseconds on both sides. It is not a claim that an ordinary sampled boolean has observed a physical edge exactly at either instant. |
| Grounded material | A grounded closed tip clears or prevents that side's candidate. It does not alter an independent opposing candidate or hit. | Retained for EPEE-04 and GEN-03. Tests cover either grounded side while the other side qualifies, plus a grounded interruption of an existing candidate. The boolean does not identify guard versus piste or retain the 100-ohm earth-path measurement. |
| Sample order | Equal timestamps are accepted. Backward timestamps are rejected. The audit also corrects the implementation to reject negative, fractional, and unsafe-integer `atUs` values. | Corrected to meet the glossary's monotonic integer-microsecond contract. Tests cover equal, backward, negative, fractional, and unsafe timestamps. |
| Hit ordering | When both sides qualify in one sample, hits are ordered by candidate start, then `left` before `right` for equal starts. | Retained deterministic replay behavior. It orders records only; it does not assign lamp color, fencing priority, or referee score. |

## Double-hit timing audit

FIE EPEE-02 guarantees both lamps for an interval **less than 40 ms** and only
one lamp for an interval **greater than 50 ms**. It allows apparatus timing
tolerance between those limits. It does not define either exact endpoint or
state whether the interval is measured from contact start, qualification, or
signal. Those questions remain INT-02 in the traceability matrix and glossary.

The current emulator has the following provisional product behavior:

1. The first accepted hit stores `startedAtUs`, the first observed candidate
   sample, as `firstHitAtUs`.
2. An opposing candidate whose observed start is at most `45_000 us` after
   that first candidate start remains eligible. It may qualify after the
   45,000-microsecond instant.
3. A candidate beginning later is discarded by lockout before it can qualify.
4. With no eligible candidate pending, the scorer becomes locked only after
   the elapsed time is strictly greater than `45_000 us`.

This means the current 45 ms choice is anchored to the **observed candidate
start**, not `qualifiedAtUs` and not a guaranteed physical-contact edge. The
golden scenario `epee.double-lockout-boundary` demonstrates the retained case:
an opposing candidate starts at 45,000 microseconds and qualifies at 47,000
microseconds. The same behavior is now unit-tested at 39,999, 40,000, 45,000,
50,000, and 50,001 microseconds, including a mirrored side order.

| Observed candidate-start interval | FIE conclusion | Current emulator result | Classification |
| --- | --- | --- | --- |
| `< 40_000 us` | Both lamps must signal. | Second side is retained. | FIE-required region, subject to the boolean adapter's trusted input. |
| `40_000 us` | No endpoint outcome is stated. | Second side is retained because it is inside the selected 45 ms cutoff. | Provisional product behavior, not an FIE endpoint rule. |
| `45_000 us` | Inside FIE's allowed tolerance, but no endpoint semantics are stated. | Second side is retained; equality is inclusive in the current code. | Provisional product behavior, recorded by the active golden scenario. |
| `50_000 us` | No endpoint outcome is stated. | Second side is rejected because it is beyond the selected 45 ms cutoff. | Provisional product behavior, not an FIE endpoint rule. |
| `> 50_000 us` | Only one lamp must signal. | Second side is rejected. | FIE-required region, subject to the boolean adapter's trusted input. |

The 45 ms behavior is retained only to preserve the existing deterministic
baseline and golden scenario. It is not a release of INT-02. M1-07 must place a
reviewed anchor, equality, timing-uncertainty, and rule-revision policy in the
versioned timing table before firmware or hardware relies on it.

## Deferred work and review gates

- **M1-02:** model normal 10-ohm and exceptional 100-ohm paths, bounded
  exceptional-resistance duration behavior, ground-path measurements, and the
  associated line-fault or uncertainty outcomes. This audit does not treat a
  missing resistance measurement as a no-hit.
- **M1-07:** replace the bare `EPEE_RULES` constants with a versioned approved
  timing table. The existing `timingRevision` in the device emulator is not
  evidence that the provisional endpoint policy is FIE-approved.
- **M1-08 and M1-09:** generate all boundary vectors and add broader symmetry,
  determinism, and property coverage after the rule table is frozen.
- **M0-03 blockers and M4 work:** the committed logical contract leaves
  SIG-01 through SIG-06 physical-map blockers. M4 measurement work must
  establish physical edge timing, acquisition phase completeness,
  ground-reference provenance, resistance uncertainty, and safe unavailable
  behavior. The current two booleans cannot close those gates.
- **Output work:** lamp independence, audio, output latching, and reset
  ownership are outside this pure scorer and remain EPEE-04, EPEE-05, M0-04,
  and M0-10 evidence items.

## M1-01 acceptance

The existing behavior is now explicitly traced as retained or corrected. The
corrected timestamp boundary and retained contact, ground, lockout, and
ordering boundaries have direct unit evidence. No exceptional-resistance logic,
front-end redesign, output implementation, or endpoint-policy claim is made by
this task.
