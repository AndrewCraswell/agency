# M0-06 transport-frame contract

This is the only binary envelope used on the directed STM32-to-ESP32 scoring
link and its ESP32-to-STM32 request path. It carries opaque payload bytes. It
does not parse a decision record, assign authority, retransmit a frame, or
authenticate a sender.

## Version 1 wire layout

Every frame is complete and unfragmented. All multi-byte integers are unsigned
big-endian. CRC-32C is the reflected Castagnoli form with initial and final
XOR values of `0xffffffff`.

| Offset | Bytes | Field | Required value |
| --- | ---: | --- | --- |
| 0 | 2 | Magic | ASCII `SC` (`0x53 0x43`) |
| 2 | 1 | Version | `1` |
| 3 | 1 | Message type | See the directed type table |
| 4 | 2 | Flags | `0` |
| 6 | 4 | Sequence | Sender-assigned unsigned 32-bit integer |
| 10 | 4 | Payload length | `0` through `4096` |
| 14 | N | Payload | Opaque bytes owned by the message contract |
| 14 + N | 4 | CRC-32C | CRC of bytes 0 through `13 + N` |

The fixed header is 14 bytes, the CRC is 4 bytes, and a frame is at most
4,114 bytes. Trailing bytes and a declared length that does not equal the
complete frame are invalid.

## Directed message types

| Code | Message type | Allowed sender | Required receiver |
| ---: | --- | --- | --- |
| `1` | `decision-record` | STM32 | ESP32 |
| `2` | `status` | STM32 | ESP32 |
| `3` | `request` | ESP32 | STM32 |
| `4` | `response` | STM32 | ESP32 |

The receiving codec validates direction before exposing payload bytes. An
unknown type, unknown receiver, nonzero flags, magic mismatch, incompatible
version, wrong direction, length failure, or CRC mismatch is rejected.

## Sequence and corruption policy

Each directed stream has its own 32-bit sequence space. The sender starts at a
link-recovery boundary chosen by the owning lifecycle and increments only when
the transport adapter commits a successful write. The receiver accepts exactly
its expected sequence. A lower sequence is a duplicate and a higher sequence
is reordered. Both are fail-closed until the owning recovery lifecycle starts a
new stream. After `0xffffffff` is accepted or committed, that stream is
exhausted and must be recovered before another frame is sent or received.

The TypeScript envelope decoder is deliberately stateless, so duplicate and
reorder policy is implemented by the STM32 transport state and ESP32 receiver
state. This prevents a byte parser from silently becoming a source of delivery
or authority policy.

CRC-32C detects accidental corruption only. It is not authentication,
authorization, replay protection, or sender identity. Link authentication and
authorization remain separate security concerns.

## Compatibility policy

Only version `1` is accepted. There is no fallback, version negotiation, or
reinterpretation of reserved flags. Any wire-incompatible change requires a
new protocol version and coordinated sender and receiver release. Additive
application semantics belong inside the message payload contract only when its
existing payload-version policy permits them.

## Immutable conformance vectors

[transport-frame-golden.json](../fixtures/transport-frame-golden.json) stores
the immutable `encodedHex` bytes for every permitted message type. The fixture
generator uses the TypeScript encoder only to verify those immutable bytes and
then emits headers consumed by both C host suites. It never treats newly
encoded bytes as a fixture update.

Conformance coverage includes byte-for-byte TypeScript, STM32, and ESP32
decoding of all four allowed types, corruption, truncation, wrong direction,
unknown type, incompatible version, bounded maximum payload, and stateful
duplicate and reorder handling in both firmware receivers.
