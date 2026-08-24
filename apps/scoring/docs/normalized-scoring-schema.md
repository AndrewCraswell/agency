# Normalized scoring schema

**Task:** CW-03
**Status:** root-reviewed normative logical schema; CW-03 closure awaits CW-02

This document freezes the language-neutral logical contract between normalized
acquisition, the future C17 scoring core, and its result consumer. It is not a
wire format, C struct definition, or WebAssembly ABI. CW-04 owns byte order,
field encoding, buffer layout, negotiation, and opaque state handles.

The executable boundary is
[`../src/normalized-scoring-schema.ts`](../src/normalized-scoring-schema.ts).
It accepts only exact, bounded records and rejects omitted, unknown, nonfinite,
and out-of-range values. It is a validator only: it neither qualifies a hit nor
converts a fault, unavailable input, or indeterminate input into a score.

## Scalar rules

| Logical scalar | Range and canonical representation |
| --- | --- |
| `u8` | Integer from 0 through 255 |
| `u16` | Integer from 0 through 65,535 |
| `u32` | Integer from 0 through 4,294,967,295 |
| `u64` | Canonical base-10 text from `0` through `18446744073709551615`; no sign, decimal point, exponent, whitespace, or leading zero |
| enumeration | One listed value only |
| repeated field | Ordered list with an explicit maximum |

`u64` is text at this logical JSON-facing boundary so an implementation cannot
silently lose a C `uint64_t` timestamp through a JavaScript number. A native
implementation stores it as an unsigned fixed-width 64-bit integer. Boolean,
`undefined`, `NaN`, infinity, arbitrary property bags, implicit defaults, and
language-specific object identity are not schema values.

Before reading a field, the executable validator walks the entire supplied
graph. A record must have exactly `Object.prototype`; a repeated field must
have exactly `Array.prototype` and every index from zero through length minus
one. Every supplied property must be an enumerable own data property. Getters,
setters, class instances, array subclasses, sparse arrays, hidden keys, symbols,
aliases, and cycles are rejected. Parsed values are reconstructed, deeply
frozen, and never retain caller-owned references.

## Normalized input

Every input has schema version `1`, a `u32 inputId`, `u64 atUs`, and one weapon:
`epee`, `foil`, or `sabre`. A `sample` contains exactly one left and one right
side at the same timestamp. Each side has all four signal statuses: `point`,
`target`, `weapon`, and `control`; every status is exactly `active`, `inactive`,
`indeterminate`, `unavailable`, or `not-applicable`.

This shared timestamp and fixed left/right fields preserve simultaneous events
without a source-side ordering rule. A scoring implementation may apply the
weapon profile to the two side records, but no input adapter may choose a winner
by arrival order.

Each sample also carries at most eight diagnostics and eight faults. Diagnostics
are `control-break`, `external-path`, `grounded`, `input-indeterminate`,
`insulation`, `reset-required`, `white`, or `yellow`. Faults are
`acquisition-unavailable`, `capacity-exhausted`, `clock-fault`,
`configuration-fault`, `line-fault`, `state-fault`, or `timestamp-overflow`.
Both identify `left`, `right`, or `none` explicitly.

A reset is a distinct input variant with exactly one reason: `bout`, `recovery`,
or `weapon-change`. It is never an absent sample, inferred reset, or a
zero-filled sample.

## State and result

State is fully explicit and bounded: availability is `available`,
`indeterminate`, or `unavailable`; each side has candidate state `none`,
`pending`, or `qualified`; registration is `no` or `yes`; output capacity is a
`u8`; and the state retains no unbounded history. It also carries the latest
input identity and timestamp, lockout endpoint, weapon, diagnostics, and faults.

Every result is a receipt for one `inputId`. It has an explicit transition
state and one exact matching error code:

| Result state | Required error code | Allowed decisions |
| --- | --- | --- |
| `accepted` | `none` | `none`, `qualified-hit`, `off-target` |
| `reset` | `none` | `none` |
| `indeterminate` | `none` | `none`, `indeterminate` |
| `unavailable` | `unavailable` | `none`, `unavailable` |
| `fault` | `fault` | `none` |
| `overflow` | `overflow` | `none` |
| `capacity` | `capacity` | `none` |
| `exhausted` | `exhausted` | `none` |

`capacity` means the declared result/output capacity could not contain a
transaction. `exhausted` means the bounded scoring state or a declared resource
was exhausted. Both fail atomically and are distinct from timestamp `overflow`.
Its fixed left and right decision slots
allow zero, one, or two decisions without a variable-sized output. Each slot
uses a disposition of `none`, `qualified-hit`, `off-target`, `indeterminate`,
or `unavailable`, plus explicit start and decision timestamps, visual, audible,
and latch fields. `qualified-hit` is always valid-hit visual, audible, and
latched. `off-target` is always off-target visual, silent, and latched.
`none`, `indeterminate`, and `unavailable` are always silent, unlatched, and
have no visual indication; `none` uses zero for both timestamps. Thus output
exhaustion and capacity failure are observable and cannot masquerade as a
no-hit result.

## Deliberate boundaries

This artifact does not select timings, define weapon qualification, encode
bytes, expose a C ABI, allocate memory, or implement a C core. It has no
dependency on the M0-05 decision-record implementation, which is currently a
dirty worktree surface. CW-04 may map these fixed logical fields to canonical
bytes only after this contract receives normative rule review.
