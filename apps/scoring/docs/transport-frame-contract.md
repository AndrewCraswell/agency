# Binary transport frame contract

**Contract:** M0-06
**Status:** baseline transport contract for review

## Scope and authority

This contract defines one bounded binary envelope between the STM32 scoring controller and ESP32 application controller. It carries opaque payload bytes. It does not define decision-record serialization, storage, cryptography, authentication, retry policy, link reset, electrical isolation, or physical SPI timing.

The STM32 remains the sole scoring authority under the [processor fault-containment contract](processor-fault-containment-contract.md). A valid frame never authorizes the ESP32 to create, alter, promote, suppress, reclassify, reorder, or clear an STM32 scoring decision. M0-05 defines the immutable logical payload of a `decision-record`; M2-05 will choose and validate its canonical payload encoding.

## Canonical frame

Each write contains exactly one complete frame. Multi-byte integers use unsigned big-endian byte order. The CRC field is excluded from its own calculation.

| Offset | Size | Field | Requirement |
| --- | ---: | --- | --- |
| 0 | 2 | magic | ASCII `SC`, bytes `53 43` |
| 2 | 1 | frame version | `1` |
| 3 | 1 | message type | Defined table below |
| 4 | 2 | flags | Unsigned 16-bit integer, must be zero in version 1 |
| 6 | 4 | sequence | Unsigned 32-bit integer, scoped to one directed sender stream |
| 10 | 4 | payload length | Unsigned 32-bit integer, maximum 4,096 |
| 14 | 0 to 4,096 | payload | Opaque bytes |
| 14 + payload length | 4 | CRC-32C | Reflected Castagnoli CRC over offsets 0 through the final payload byte |

The fixed header is 14 bytes and the CRC is 4 bytes, so a complete frame is 18 through 4,114 bytes. Fragmentation, concatenation, and a scanning/resynchronization algorithm are not part of version 1. The link adapter must present one bounded complete frame to the decoder.

CRC-32C uses polynomial `0x1EDC6F41` in reflected form `0x82F63B78`, initial value `0xFFFFFFFF`, final XOR `0xFFFFFFFF`, and no final byte-order transformation. The check value for ASCII `123456789` is `0xE3069283`.

### Message types

| Byte | Type | Direction and authority |
| ---: | --- | --- |
| `01` | `decision-record` | STM32 to ESP32 only. Payload represents an already-made M0-05 record. |
| `02` | `status` | STM32 to ESP32 only. Diagnostic or availability information, never a scoring decision. |
| `03` | `request` | ESP32 to STM32 only. A request remains ineffective until the STM32 validates and accepts it. |
| `04` | `response` | STM32 to ESP32 only. Result or bounded diagnostic for an accepted or rejected request. |

The executable decoder requires the receiving role, either `stm32` or `esp32`, for every complete frame. It rejects a message type sent in the wrong direction with a `direction` error before returning any payload bytes. Payload syntax and per-type maximums may be narrowed by the owning payload contract, but cannot exceed this envelope's bound.

## Compatibility policy

A version-1 receiver accepts only magic `SC`, version `1`, one listed type legal for that receiver, zero flags, an exactly matching declared length, and a valid CRC-32C. It must reject before interpreting any payload when any condition fails. Reserved flags are rejected rather than ignored so their meaning cannot be guessed.

A receiver that sees an unknown version, type, or nonzero flag fails closed: it rejects the frame, emits an application/link diagnostic when it can, and does not turn it into a scoring event, reset, acknowledgement, or replacement record. New meaning requires a reviewed frame-version change. No backward-compatibility fallback or silent field tolerance exists.

## Sequence and fault outcomes

Sequence is transport ordering evidence, not a scoring timestamp and not a decision-record identifier. Each direction maintains its own sequence stream. Its receiver initializes an expected sequence only at a separately established sender boot or link-recovery boundary; the boot identity and recovery lifecycle remain M0-04/M0-05 concerns. A sender must establish a new stream before unsigned 32-bit sequence exhaustion. Wraparound is not accepted as in-order.

For a receiver with an expected sequence, it accepts a valid frame only when `sequence === expected`, then advances expected by one. It does not buffer, sort, or repair frames.

| Condition | Required outcome |
| --- | --- |
| Corrupt CRC, invalid magic, invalid flags, invalid type, or invalid declared length | Reject the frame. Do not read its payload or make a scoring inference. |
| Type sent to the wrong receiver | Reject with `direction` before returning payload bytes. Do not treat the frame as an acknowledgement or scoring result. |
| Truncated frame | Reject the frame. Do not wait for more bytes or concatenate a later write under this contract. |
| Duplicate sequence, less than expected | Reject as duplicate. Do not deliver or replay the payload again. |
| Greater-than-expected sequence | Reject as reordering or loss. Do not deliver a later decision in place of the missing record. Enter or retain a link-degraded diagnostic state until the separately defined recovery path establishes a new stream. |
| Equal expected sequence | Deliver the opaque payload once to its owning parser and advance the expected sequence. |
| Version mismatch | Fail closed as incompatible. Preserve no payload-derived state and do not attempt a downgrade. |

Link corruption, loss, duplication, reordering, backpressure, or reboot never changes STM32 acquisition, timing, primary outputs, or lockout. ESP32 receipt is not an acknowledgement that can change an STM32 scoring decision. The fault-containment contract governs the resulting degraded and unavailable behavior.

## Golden encoded frames

These vectors are hexadecimal complete frames, including CRC-32C.

| Meaning | Hex |
| --- | --- |
| `decision-record`, sequence `0x01020304`, payload `00 7F 80 FF` | `5343010100000102030400000004007F80FF01DE6ABE` |
| empty `request`, sequence `0` | `5343010300000000000000000000452025EA` |
| `status`, sequence `0xFFFFFFFF`, payload `A5` | `534301020000FFFFFFFF00000001A52B9989F7` |

The executable vectors and malformed-frame cases are in `src/transport-frame.test.ts`.

## Acceptance and non-goals

The encoder and decoder provide bounded frame construction, receiver-direction enforcement, and validation. They reject unknown runtime message types and non-byte payloads with stable errors rather than coercing them. Tests cover the golden vectors plus corruption, truncation, duplication/reordering policy documentation, direction, and version mismatch rejection. Sequence acceptance and transport fault injection are deferred to M2-06. This contract does not define a journal, retention, signatures or encryption, key management, SPI electrical timing, chip-select behavior, DMA, or reset wiring.
