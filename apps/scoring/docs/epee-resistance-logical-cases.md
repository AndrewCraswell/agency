# Epee resistance logical cases

**Task:** M1-02

**Status:** executable logical adapter; not an analogue qualification or a released endpoint policy

## Scope and authority

This adapter implements the epee inputs named by the seven-conductor contract:
`epeeCircuitComplete`, `epeeGroundedMaterial`, and `epeeLineIntegrity`. It is a
separate, richer entry point from [`epee.ts`](../src/epee.ts), whose two
booleans remain stable for existing callers.

The governing requirements are EPEE-03 and EPEE-04 in the
[FIE traceability matrix](fie-traceability-matrix.md): 10 ohms is the normal
external-resistance test case, 100 ohms is the exceptional external-resistance
test case, and grounded material must not signal even with 100 ohms in the
earth circuit. The adapter does not make claims about excitation, ADC values,
physical wiring, or an analogue threshold.

## Released logical outcomes

| Observation | Logical outcome |
| --- | --- |
| Confirmed closed, intact, not-grounded loop with an exact 10,000 milli-ohm reading | Candidate with `normal-10-ohm` evidence. |
| Confirmed closed, intact, not-grounded loop with an exact 100,000 milli-ohm reading | Candidate with `exceptional-100-ohm` evidence. |
| Confirmed grounded material, including a recorded 100,000 milli-ohm ground path | `grounded-material-rejection`; never a candidate. |
| Cross-line or out-of-range integrity | `line-fault`; never a candidate. |
| Indeterminate phase or a resistance interval that is not exactly one named test point | `uncertainty`; never a candidate. |
| Unavailable phase or absent contact-resistance measurement | `unavailable`; never a candidate. |

The current 2,000 microsecond lower boundary is preserved for both trusted
resistance cases. The 100-ohm exceptional case has no upper-duration check in
this logical adapter. That is deliberately not an unbounded physical promise:
sampling, acquisition completeness, calibrated range, and fixture duration
remain M4 evidence work.

An indeterminate or unavailable observation clears an unregistered candidate
and emits its explicit outcome. It is never converted to `open`,
`not-grounded`, or a `false` boolean. An observation that is invalid on one
side does not suppress an independent trusted contact on the other side.

The adapter retains the audited `epee.ts` 45,000 microsecond,
start-anchored lockout behavior only for compatible trusted candidates. This
is the existing provisional implementation choice, not an FIE endpoint rule.

## Open interpretations and gates

- The FIE wording supplies 10-ohm and 100-ohm compliance cases, not a
  general acceptance threshold or treatment for every value between them.
  Therefore every non-exact interval stays uncertain until a reviewed,
  versioned timing and resistance table exists in M1-07.
- The FIE wording does not define how resistance uncertainty should be
  bounded, or the physical conversion from a resistance measurement to the
  named logical phases. SIG-02, SIG-03, and SIG-06 remain open.
- The adapter records a confirmed `grounded` relation with an optional ground
  path measurement. It does not infer whether that path is guard, piste, or
  another physical route.
- The existing 45 ms lockout anchor and equality semantics remain INT-02;
  this task does not release them as endpoint policy.

## Golden-vector integration

The following active scenarios are integrated into
[`golden-scenario-manifest.json`](golden-scenario-manifest.json) in canonical
lexicographic order:

- `epee.exceptional-resistance-duration`
- `epee.grounded-material-100-ohm`
- `epee.resistance-uncertainty-near-lockout`

The manifest appends their IDs to the existing EPEE-03 and EPEE-04 coverage
without changing either requirement's `covered` status. A future runner must
execute the richer adapter for these vectors; the current boolean epee runner
cannot safely project their uncertainty fields.
