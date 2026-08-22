# Versioned timing-table contract

**Task:** M1-07

## Scope

[`timing-table.ts`](../src/timing-table.ts) loads a named, immutable timing
table without reading wall-clock state. It is a standalone contract in this
increment: the existing epee, foil, and sabre state machines retain their
current constants until M1-08 consumes this table as part of a coordinated
boundary-vector and scorer update.

`loadTimingTable` accepts only `timing-1`. An unknown or non-string revision
throws rather than selecting a fallback. The returned table and every nested
record are frozen. A caller therefore cannot change a later decision by
mutating a table it previously loaded.

`validateTimingTable` exists for build and fixture tooling. It rejects missing
or extra fields, fractional or unsafe values, values outside the applicable
FIE-derived envelope, and values that differ from the released `timing-1`
selection. Being inside an FIE tolerance is not permission to substitute a
different runtime value; a new reviewed table needs a new revision.

## `timing-1` selections and bounds

| Field | `timing-1` value | Envelope or release rule | Authority and status |
| --- | ---: | --- | --- |
| Epee contact minimum | 2,000 us | 2,000-10,000 us normal-resistance test interval | EPEE-03, Annex B B(c), p. 80. The selected lower floor retains the current epee rule. |
| Epee double-hit window | 45,000 us | 40,000-50,000 us | EPEE-02, Annex B B(b), p. 80. The existing selected value is retained; exact endpoints and anchor remain the recorded product policy, not an FIE constant. |
| Foil contact-break minimum | 13,000 us | 13,000-15,000 us guaranteed region | FOIL-02, Annex B A.1(b).1-A.1(b).3, pp. 78-79. The current conservative floor is retained. |
| Foil lockout | 300,000 us | 275,000-325,000 us | FOIL-05, Annex B A.1(a).4-A.1(a).6, p. 78. The current first-qualified-signal policy is retained. |
| Sabre contact minimum | 100 us | At least 100 us | SABRE-03, Annex B C(a).7 and C(b).1-C(b).2, pp. 81-82. The rule must never signal below this value. |
| Sabre sensitivity test point | 1,000 us | Exactly the published 1 ms test point | SABRE-03. This is not a candidate-expiry timer. |
| Sabre control-break duration | 3,000 us | 1,000-5,000 us | SABRE-07, Annex B C(b).7, p. 82. The current nominal selection is retained. |
| Sabre blade registration and recovery | 5,000 us and 20,000 us | Exact current provisional policy | SABRE-06, Annex B C(b).5-C(b).6, p. 82. FIE does not resolve the tolerance endpoint semantics, so the loader admits no alternative value. |
| Sabre blade interruption maximum | 10 | Exact published maximum | SABRE-06. |
| Sabre lockout | 170,000 us | 160,000-180,000 us | SABRE-05, Annex B C(a).8-C(a).9, p. 81. The current first-qualified-signal policy is retained. |

The table deliberately contains no audio duration, epee 100-ohm unbounded
duration, foil insulation-band behavior, or a new sabre endpoint. Those values
are unresolved elsewhere in the traceability matrix and are not made flexible
by this loader.

## M1-08 handoff

M1-08 must introduce an explicit mapping from each golden scenario's
`ruleRevision` to `timing-1`, call `loadTimingTable` before replay, and reject
an unknown mapping or timing revision with the scenario's
`unknown-rule-revision` outcome. It must generate below, at, and above vectors
from the loaded scalar values for both sides, retaining the published envelope
limits as reference vectors where they are not runtime endpoints. M1-08 then
updates the weapon scorers in one coordinated change so no runtime path mixes a
loaded table with the current standalone constants.

## Evidence

[`timing-table.test.ts`](../src/timing-table.test.ts) proves deterministic
loading, fail-closed unknown revisions, envelope rejection, rejection of an
unreviewed in-envelope substitute, strict object shape, and deep immutability.
