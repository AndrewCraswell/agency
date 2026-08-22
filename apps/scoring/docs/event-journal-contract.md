# Event journal contract

**Delivery task:** M2-08

The application domain keeps a durable, bounded copy of already-authoritative M0-05 decision records. This module is
host-only evidence for transaction behavior. It is not a flash layout, filesystem API, production payload encoding,
wear-leveling scheme, hold-up claim, or authority path for the STM32.

## Durable model

Appending a record creates a new checkpoint through four virtual durable boundaries:

1. `prepared-header` writes the next generation and record count.
2. `prepared-records` writes immutable copies of all records in that checkpoint.
3. `prepared-integrity` writes CRC-32C and SHA-256 values over a private deterministic test projection.
4. `commit-marker` makes the complete checkpoint current.

Power can be injected immediately after every boundary. A boot reads only the last complete checkpoint. Thus loss before
the marker recovers the previous checkpoint, and loss after the marker recovers the next checkpoint. Prepared data is
not replay evidence and never becomes a partial accepted record.

The model assumes `commit-marker` is one atomic *selection* primitive. It does not assert that a flash page,
filesystem rename, or marker write is atomic in the product. M5/M6 must select and prove a medium-specific mechanism,
such as a reviewed two-slot scheme, before this model becomes hardware evidence.

The integrity projection exists only to make the host model testable. It bounds strings, values, and accumulated bytes
while traversing, so it fails closed before constructing unbounded integrity input. It is not M0-06 framing, a selected
device serialization, or a promise about a production storage medium. CRC and digest failures fail closed as corrupt
recovery.

## Record and capacity rules

- Every stored entry is revalidated as an M0-05 `DecisionRecord`, cloned, and deeply frozen.
- Existing matching `recordId` plus identical content is idempotent and returns `duplicate`; the same ID with differing
  content returns `conflict`.
- Capacity is configured at construction, from one through 32. A full journal, or a record set beyond the host
  model's bounded integrity-projection limits, returns `backpressure` before any durable write; it does not silently
  discard an older record.
- Raw capture references stay inside their M0-05 decision record. They already carry bounded content-addressed SHA-256
  references, so M2-08 does not invent a second raw-capture store or payload format.
- Corrupt CRC, digest, structure, or a checkpoint exceeding configured capacity produces no recovered records. The
  application cannot treat that state as a no-hit result or use it to recreate a primary indication.

## Executable evidence

`src/event-journal.test.ts` exercises a failure after each write boundary, normal boot recovery, duplicate and conflict
handling, capacity backpressure, integrity corruption, and immutable returned records. It demonstrates M0-10's
old-valid-or-new-valid persistence result without claiming hardware power-loss behavior.
