# Overtime, medical, and competition-format workflow

RC-08 keeps countdown workflow state separate from STM32 scoring time and immutable decision records.

## Overtime priority

The initial held `overtime.toggle` action is currently unavailable. It is reserved for an authenticated receipt from
the frozen priority-entropy owner `priority-entropy-owner` at revision `priority-entropy-1`; a receipt would contain
one bit, the owner identity and revision, and a bounded sample identity. No reviewed transport or security boundary is
integrated to verify those bytes and issue an opaque capability. The reducer deliberately provides neither a receipt
factory nor a caller-supplied verification hook, because either would allow a caller to mint a trusted bit. Therefore
every attempted new overtime start fails closed. The reducer never generates randomness, uses wall-clock state, or
treats the handheld as an entropy source.

If this boundary is integrated, bit `0` will assign left priority and bit `1` right priority, with complete receipt
correlation retained in the resulting snapshot and event. Existing active overtime state can only be cleared: a further
held action clears priority and its correlation, restores the configured bout duration, and leaves the bout clock
stopped. External snapshot loads containing any entropy receipt fail closed, because serialized correlation is not a
capability. Break, medical, and already-running bout states cannot enter overtime.

Supervisor priority override remains fail-closed with `owner-unavailable`. It requires its own audited provenance
contract before it can become an RC-08 capability. The current snapshot schema deliberately has no transitional state
that could safely represent an entropy-free active overtime priority.

## Medical intervention

Modified `medical.start` starts the retained five-minute preset as a separate medical timer. It requires a stopped bout clock in bout mode and does not replace, restart, or otherwise mutate the bout clock. While that medical timer is running, clock toggle, correction, load/configuration, break start, overtime, and another medical start are rejected. Snapshot validation also rejects a running medical timer concurrent with a running bout or passivity timer.

## Competition format

Modified `format.advance` and `format.retreat` change only the already typed `competition.kind` and numeric value. The
prototype registry is the checked-in [`competition-format-rules-registry.json`](./competition-format-rules-registry.json)
artifact owned by `scoring-product-rules`, registry `prototype-bout-format-registry`, revision `2026-08-23.1`, with
digest `sha256:8ccfc9c878c8758bde503fec7bba2f81308da66528b3b7b6ab1e4b8046770d98`. Its current prototype bounds are 1 through
3 for both typed fields; this is a product configuration, not a claim about universal fencing rules.

Fresh and STM32-confirmed new bouts bind that exact owner, registry, revision, and digest into their snapshot. Reducer
initialization and snapshot load independently reverify the frozen identity, so an arbitrary caller configuration or a
stale registry cannot cross a bout boundary. Format commands use only the verified registry bounds and require a
stopped bout clock in bout mode with no active medical timer. They reject an altered authority, a value at or outside
its typed bound, or a running clock. Match and period remain distinct fields and are never inferred from one another.
