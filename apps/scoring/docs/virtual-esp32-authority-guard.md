# Virtual ESP32 receiver and authority guard

**Task:** M2-07
**Status:** executable virtual-device contract

## Boundary

The virtual ESP32 receiver accepts only a completed `stm32-to-esp32` delivery produced by the virtual processor link. It decodes its M2-05 envelope for the ESP32 role and accepts only the `decision-record` type as a scoring record. An ESP32-to-STM32 attempt, an undelivered link attempt, a corrupt frame, an invalid frame direction, or an inconsistent link/frame sequence produces no scoring record.

M2-05 intentionally defines payload bytes as opaque. Consequently this receiver takes a synchronous injected `decodeDecisionRecordPayload` boundary owned by the M0-05 decision-record codec. The guard does not introduce JSON, CBOR, protobuf, or another payload encoding. It validates and privately deep-freezes the returned M0-05 record before exposing it.

Schema version 1 is exact at this boundary. Every record, capture window, provenance object, firmware provenance object, outcome, signal, raw-capture array, and raw-capture reference must have only its canonical enumerable data fields. Extra, non-enumerable, accessor, symbol, inherited, or forward-version fields are rejected rather than ignored. A future record revision needs a reviewed receiver change.

## Exactly-once and ordering behavior

The receiver consumes one directed STM32 stream. It starts at an explicit expected sequence when configured; otherwise its first valid complete frame establishes the stream. Thereafter it accepts only the next unsigned 32-bit sequence. It does not buffer, sort, or repair gaps.

| Input | Result |
| --- | --- |
| Expected, valid decision record | Accept exactly once and retain its immutable record. |
| Lower or higher sequence | Reject without a record and mark the link degraded. |
| Repeated record ID at the expected sequence | Reject as a duplicate without replaying it; consume the transport sequence. |
| Valid non-decision STM32 frame | Consume ordering evidence and ignore it as non-scoring data. |
| Invalid decision payload at the expected sequence | Reject without a record; consume the transport sequence and mark the link degraded. |
| Full retained-record capacity | Reject with explicit backpressure; retain the expected sequence so a later storage-layer retry can deliver it. |
| Sequence `0xffffffff` after acceptance | Mark stream exhausted. A recovery boundary must construct a new receiver; application code has no stream-reset method. |

The retained record collection is bounded to 1 through 1,024 entries, with a default of 256. It does not evict old records, because eviction would hide authority evidence. Durable storage and power-fail transactions are M2-08 work.

## Authority guarantees and limits

The receiver never calls a weapon scorer, calculates timing, changes a decision field, creates a record ID, selects a rule revision, or sends a receipt that changes STM32 behavior. It preserves source transport order and exposes only records accepted by the injected authoritative decoder. Output records are deep-frozen copies, so an application caller cannot mutate a retained record into another outcome.

The virtual link delivery is the authority boundary in this host model. Production hardware still needs M5 isolation, directionality, and secure processor-link evidence; this module does not claim authentication, durable journaling, acknowledgements, or hardware enforcement.

## Evidence

`src/virtual-esp32.test.ts` exercises valid delivery, duplicate and reordering rejection, corrupt and wrong-direction frames, app-forged delivery metadata, opaque-payload decoding, bounded backpressure, immutable output, non-decision ordering, sequence exhaustion, and deterministic replay.
