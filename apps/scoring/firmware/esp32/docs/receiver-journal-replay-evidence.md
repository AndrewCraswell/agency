# M3-09 ESP32 receiver, journal, and replay evidence

## Scope and boundary

This increment adds a bounded, SDK-free C17 implementation under
`firmware/esp32`. It consumes one complete STM32-to-ESP32 frame at a time
through the existing strict M2-05 decoder in `scoring_esp32_services.c`.
Only a transport-valid `decision-record` frame can reach the journal. The
payload stays opaque: the ESP32 code does not deserialize it, run a weapon
rule, assign a record ID, alter a timestamp, or create a replacement
decision.

`scoring_esp32_receiver_t` keeps one expected unsigned 32-bit transport
sequence. A first valid frame establishes the stream. Lower sequences are
duplicates, higher sequences are reordering or loss, and a full journal
returns bounded backpressure without advancing the expected sequence. A
corrupt, truncated, oversized, wrong-version, wrong-type, or bad-CRC frame
cannot reach storage. A valid non-decision STM32 frame is consumed as
ordering evidence and reported as ignored. Because this C boundary keeps the
decision payload opaque, the journal also treats an identical authoritative
byte string as a duplicate even if a caller presents it with another
transport sequence; it never tries to inspect a record ID.

## Journal and replay model

`scoring_esp32_journal_storage_t` is a two-slot durable checkpoint model. An
append, including a cursor-only checkpoint for an ignored valid STM32 frame,
writes the inactive slot at four explicit boundaries:

1. prepared header;
2. prepared record copies;
3. prepared CRC-32C integrity value; and
4. commit marker.

Only a committed slot with valid magic, version, bounded lengths, generation,
record count, cursor, and CRC-32C is recoverable. On reopen, the highest
valid generation wins. Power loss before the marker therefore leaves the
previous checkpoint; power loss after the marker leaves the complete new
checkpoint. Fresh all-zero slots are empty; a committed marker with no valid
slot is corrupt. The cursor is restored as the next expected sequence, with
`UINT32_MAX` restoring an exhausted stream.

There are no dynamic allocations and no eviction path. The host model is
bounded to 32 records of at most 4,096 payload bytes each. Its two inline
slots measure 262,720 bytes on the current host ABI; the named
`SCORING_ESP32_JOURNAL_HOST_STORAGE_MAX_BYTES` bound is enforced at compile
time and by an active host test. Tests keep this fault-model storage in
static duration memory. It is not evidence
that an ESP32 target can place this object on its stack or DRAM. A later
target adapter must provide flash-backed storage and prove its medium-specific
atomic primitive before claiming target persistence evidence.

`scoring_esp32_journal_replay` copies the stored payload bytes and original
STM32 transport sequence into caller-owned buffers. It never invokes a
decoder or scoring implementation, so replay cannot re-decide a touch.
The accepted receipt's `record` view is borrowed from the fixed ingress
buffer and is valid only until the next receive or ESP32 application reset;
the journal copy is the durable replay source.

## ESP32-only lifecycle

`scoring_esp32_receiver_reset` requires a fresh, non-empty bounded boot ID
from `identity.read_boot_id`, reopens the committed journal, restores the
persisted transport cursor, and clears only other volatile link state. It
does not call the reset service and the service table has no STM32 reset or
control operation. A persisted record remains available after this
application lifecycle reset; re-delivery is identified as a duplicate.
An unavailable link or an empty no-frame poll produces an `IGNORED` receipt
and no record bytes, rather than a rejected scoring event.

The reset and power-loss model is application-domain host evidence. It does
not claim ESP-IDF flash-driver, Secure Boot, electrical isolation, watchdog,
or STM32 reset behavior. Those remain target and board evidence owned by the
M3-10 ADR and later milestones.

## Host acceptance

From `apps/scoring`, run both configurations:

```text
powershell -ExecutionPolicy Bypass -File firmware/esp32/scripts/run-host-tests.ps1 -Configuration Debug
powershell -ExecutionPolicy Bypass -File firmware/esp32/scripts/run-host-tests.ps1 -Configuration Release
```

`tests/scoring_esp32_receiver_host_test.c` covers valid opaque ingress,
duplicate frames, corruption before storage, reorder rejection and recovery,
bounded backpressure, cursor restore after decisions and ignored frames,
sequence exhaustion, required changed boot IDs, unavailable/no-frame ignored
receipts, every journal power-loss boundary with multiple prior records,
newest-corrupt fallback versus all-committed-corrupt recovery, deterministic
byte-for-byte replay, and ESP32-only reset without an STM32 control call. The
existing M3-08 service and M3-11 load-isolation tests remain in the same CTest
suite.
