# Normalized scoring schema

**Task:** CW-03
**Status:** pending root review; closure still waits for CW-02.

[`normalized-scoring-schema.ts`](../src/normalized-scoring-schema.ts) freezes
the language-neutral logical contract between normalized acquisition, the future
C17 core, and result consumers. It is not a wire format, C struct, or
WebAssembly ABI. CW-04 owns byte order, field encoding, capacities, and opaque
state handles.

## Boundary rules

Every value is a complete, exact, plain data tree. The validator rejects
getters, setters, class instances, array subclasses, sparse arrays, symbols,
hidden properties, aliases, cycles, omitted fields, and unknown fields before
reading a semantic field. It reconstructs and deeply freezes every accepted
value, so no caller object reference crosses the boundary.

`u8`, `u16`, and `u32` are safe JavaScript integers within their fixed-width
ranges. A `u64` is canonical base-10 text from `0` through
`18446744073709551615`; signs, leading zeroes, decimal points, exponents, and
JavaScript numbers are rejected. This prevents loss of a C `uint64_t` through
the JSON-facing adapter.

Diagnostics and faults are independently bounded to eight entries. Each list
is a strictly increasing, duplicate-free sequence ordered by `code`, then
`side` (`left`, `none`, or `right` in lexical order). The ordered list is part
of the logical input, so CW-04 can preserve it as deterministic bytes without
inventing a sort order. The lists carry concrete condition provenance; they are
not unstructured annotations.

## Lossless per-weapon inputs

Every sample has one simultaneous left side and right side at one `u64` time,
a `u32` input ID, diagnostics, and faults. It is discriminated by weapon:

- Épée mirrors `EpeeResistanceContact` without collapsing its subject-specific
  acquisition: `circuitComplete`, `contactResistance`, `groundPathResistance`,
  `groundedMaterial`, and `lineIntegrity`. Each resistance measurement has its
  exact resistance and uncertainty fields; both are canonical `u64` text or
  both are `null` when unavailable at acquisition.
- Foil has circuit-break, target, integrity, and insulation states. It
  distinguishes grounded target context, lame versus weapon faults, and all
  indeterminate/unavailable values.
- Sabre has target, external-path eligibility, own-equipment, blade, and B/C
  fault states. `control-break` and `abnormal-change` are distinct values.

This logical form carries all current Rules-1 inputs without asking a C core to
infer a weapon meaning from a generic signal name. A reset remains a distinct
input with one explicit reason: `bout`, `recovery`, or `weapon-change`.

## Persistent state and receipts

All weapon states carry availability, first-hit and lockout information,
candidate/registration state, last input identity, bounded capacity, faults,
and diagnostics. Explicit `hasFirstHit`, `hasLastInput`, and `lockoutActive`
discriminators distinguish an absent time from a valid timestamp of zero.
Absent first-hit, candidate, inactive history, and inactive lockout forms use
their specified zero sentinel; present times are ordered against the last input
time. A side candidate is only `none` or `pending`: a pending candidate is
unregistered and carries its bounded start time. After a hit is registered the
candidate returns to `none` with a zero candidate time while `registered` stays
`yes`; `none` also represents an unregistered idle side. Foil additionally
carries its pending candidate classification, which is `none` exactly when the
candidate is `none`, plus insulation and observation state.
Sabre additionally carries blade-mediated history (start, last blade contact,
and bounded interruption count), control-break timing, observation state, and
white/yellow diagnostic values. This is sufficient to resume deterministic
replay rather than reconstructing hidden weapon lifecycle state.

Results use fixed left and right decision slots to preserve simultaneous hits.
They distinguish accepted, reset, indeterminate, unavailable, fault, overflow,
capacity, and exhaustion states with an exact matching error code. Results also
retain the bounded, canonical diagnostic and fault lists, so a consumer can
observe fault provenance without interpreting a generic `fault` result as a
no-hit. The parser validates visual, audible, latch, side, and timestamp
coherence for each decision. `fault` receipts require nonempty fault provenance;
`unavailable` receipts require `acquisition-unavailable` provenance. Accepted,
reset, capacity, exhausted, and overflow receipts cannot carry contradictory
faults.

## Deliberate boundary

This artifact does not choose timings, qualify hits, encode bytes, allocate
memory, expose C layout, or implement the scoring core. CW-04 must convert
these exact logical fields into a versioned byte ABI with explicit endianness
and capacity behavior. CW-05 then generates the rule and timing profile; CW-06
implements the weapon semantics in C17.
