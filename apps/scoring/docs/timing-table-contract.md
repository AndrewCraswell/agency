# Versioned timing-table contract

**Task:** M1-07

## Scope

[`timing-table.ts`](../src/timing-table.ts) is the one executable authority
for the released `timing-1` product selections and the FIE timing bands that
constrain them. It loads a named, immutable table without reading wall-clock
state. The epee, foil, and sabre scorers resolve every runtime duration through
this table. They do not carry independent timing selections.

`loadTimingTable` accepts only `timing-1`. An unknown or non-string revision
throws rather than selecting a fallback. The returned table and every nested
record are frozen. A caller therefore cannot change a later decision by
mutating a table it previously loaded.

`FIE_TIMING_BANDS` is a separately frozen, machine-readable record of the
published bands and their endpoint uncertainty. Boundary generation imports
that record instead of copying numerical envelope constants. `validateTimingTable`
exists for build and fixture tooling. It rejects missing or extra fields,
fractional or unsafe values, values outside the applicable FIE-derived band,
and values that differ from the released `timing-1` selection. Being inside an
FIE tolerance is not permission to substitute a different runtime value; a new
reviewed table needs a new revision. `resolveTimingTable` canonicalizes a
validated explicit input back to the frozen released object, so a mutable clone
cannot become scorer state.

## `timing-1` selections and bounds

| Field | `timing-1` value | FIE band and endpoint uncertainty | Authority and status |
| --- | ---: | --- | --- |
| Epee contact minimum | 2,000 us | 2,000-10,000 us; FIE tolerance needs a product selection | EPEE-03, Annex B B(c), p. 80. The selected lower floor retains the current epee rule. |
| Epee double-hit window | 45,000 us | 40,000-50,000 us; FIE tolerance needs a product selection | EPEE-02, Annex B B(b), p. 80. The existing selected value is retained; exact endpoints and anchor remain the recorded product policy, not an FIE constant. |
| Foil contact-break minimum | 13,000 us | 13,000-15,000 us; FIE tolerance needs a product selection | FOIL-02, Annex B A.1(b).1-A.1(b).3, pp. 78-79. The current conservative floor is retained. |
| Foil lockout | 300,000 us | 275,000-325,000 us; FIE tolerance needs a product selection | FOIL-05, Annex B A.1(a).4-A.1(a).6, p. 78. The current first-qualified-signal policy is retained. |
| Sabre contact minimum | 100 us | At least 100 us; the published lower endpoint still needs product policy above the floor | SABRE-03, Annex B C(a).7 and C(b).1-C(b).2, pp. 81-82. The rule must never signal below this value. |
| Sabre sensitivity test point | 1,000 us | Exactly 1,000 us; exact published endpoint | SABRE-03. This is not a candidate-expiry timer. |
| Sabre control-break duration | 3,000 us | 1,000-5,000 us; FIE tolerance needs a product selection | SABRE-07, Annex B C(b).7, p. 82. The current nominal selection is retained. |
| Sabre blade registration and recovery | 5,000 us and 20,000 us | Registration 0-5,000 us and recovery 10,000-20,000 us; published endpoints need explicit product policy | SABRE-06, Annex B C(b).5-C(b).6, p. 82. The loader admits no alternative value for this release. |
| Sabre blade interruption maximum | 10 | Exact published maximum | SABRE-06. |
| Sabre lockout | 170,000 us | 160,000-180,000 us; FIE tolerance needs a product selection | SABRE-05, Annex B C(a).8-C(a).9, p. 81. The current first-qualified-signal policy is retained. |

The table deliberately contains no audio duration, epee 100-ohm unbounded
duration, foil insulation-band behavior, or a new sabre endpoint. Those values
are unresolved elsewhere in the traceability matrix and are not made flexible
by this loader.

## Boundary and C17 handoff

[`timing-boundary.ts`](../src/timing-boundary.ts) loads `timing-1` directly
for the all-weapon boundary corpus and validates an explicit table before
reading it. Its rule-revision resolver maps only reviewed rule identities to
`timing-1`, then rejects an unknown mapping or timing revision with the
`unknown-rule-revision` outcome. The suite generates below, at, and above
vectors from loaded product selections for both sides, and imports
`FIE_TIMING_BANDS` for reference endpoints rather than copying tolerance
numbers. The epee, foil, and sabre scorers consume the same canonical table in
one runtime path.

This is the input handoff for C17 work, not a second C implementation. `CW-05`
must generate a versioned C timing profile from this reviewed table, bind the
table revision and generation digest into native, STM32, and WebAssembly
artifacts, and reject a stale or unknown revision before scoring. The existing
C constants remain a documented migration blocker until that generated-profile
work is complete; they must not be treated as an alternate authority.

## Evidence

[`timing-table.test.ts`](../src/timing-table.test.ts) proves deterministic
loading, fail-closed unknown revisions, explicit FIE bands and endpoint
uncertainty, envelope rejection, rejection of an unreviewed in-band substitute,
strict object shape, canonicalization, and deep immutability. The generated
all-weapon boundary corpus proves scorer behavior immediately below, at, and
above every released runtime selection.
