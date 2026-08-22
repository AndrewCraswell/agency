# M2-05 transport codec evidence

**Task:** M2-05 canonical binary encoder and decoder

**Implementation:** [transport-frame.ts](../src/transport-frame.ts)

**Executable evidence:** [transport-frame.test.ts](../src/transport-frame.test.ts)

## Audit result

M0-06 already defines and implements the canonical version-1 frame. M2-05 reuses that codec; it does not add a second
frame format or a decision-record serializer. The frame payload remains opaque and authoritative to its owning payload
contract, as required by M0-05 and M0-06.

| M2-05 acceptance | Evidence | Result |
| --- | --- | --- |
| Golden frames match byte for byte | Three deterministic fixtures cover a `decision-record` frame with opaque test payload bytes, an empty request, and a maximum-sequence status frame. The first fixture does not define or validate decision-record payload serialization. | Pass |
| Malformed length rejected | Decoder rejects truncated input, declared lengths above 4,096 bytes, declared lengths that do not match the complete input, trailing bytes, and input above the 4,114-byte frame bound. | Pass |
| CRC corruption rejected | CRC-32C check-value test plus a corrupted payload byte case. | Pass |
| Unknown message type rejected | Unknown type is rejected before payload delivery. | Pass |
| Wrong receiver direction rejected | STM32-only and ESP32-only message directions are checked before payload delivery. | Pass |
| Incompatible version rejected | Unknown frame version is rejected before payload delivery. | Pass |
| Bounded construction and decoding | Encoder allocates only after the 4,096-byte payload bound is checked. Decoder rejects inputs larger than `MAX_TRANSPORT_FRAME_BYTES` before reading payload bytes, and round-trips the maximum-size frame. | Pass |

The decoder's stable error vocabulary is `frame-input`, `truncated`, `frame-length`, `magic`, `version`,
`message-type`, `direction`, `flags`, `payload-length`, `trailing-bytes`, and `crc`. Non-`Uint8Array` values are
rejected as `frame-input` before their length or contents are inspected.

Sequence duplicate, reordering, loss, and recovery behavior remains deliberately owned by M2-06. CRC-32C detects
accidental corruption; it is not an authenticity or sender-identity mechanism.

## Verification

Focused scoring verification:

```text
pnpm --filter scoring test -- transport-frame.test.ts
7 tests passed
```

The repository-wide `pnpm verify` remains the milestone-level check and may include unrelated work from other active
task owners.
