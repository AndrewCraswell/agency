# Virtual processor link contract

**Contract:** M2-06
**Status:** deterministic host implementation

## Boundary

`createVirtualProcessorLink` models one bounded, synchronous link between the
virtual STM32 scoring authority and the ESP32 application controller. It moves
complete `Uint8Array` transport frames only. The link checks the frame-size
bound, copies the bytes, and reads the transport sequence field as evidence. It
does not decode payloads, validate CRCs, accept sequences, repair bytes, or
make a scoring decision. The receiving processor remains responsible for
transport decoding and authority checks.

The link uses the supplied M2-01 virtual clock. It never reads wall time,
waits for host work, or chooses a random fault. A fault-script entry is
consumed in send order; a missing entry means no fault. The script is copied
at construction and cannot be changed by later caller mutation.

## API and bounds

```ts
const link = createVirtualProcessorLink({
  clock,
  faultScript,
  queueCapacity,
  onAttempt,
  onDelivery
})

link.send("stm32", frameBytes)
link.cancel(attemptId)
link.disconnect()
link.reconnect()
```

`send` is synchronous and returns a receipt containing the attempted IDs,
connection epoch, requested copy count, submission timestamp, and immediate
outcome. A queued receipt does not mean that a frame was accepted by the
receiver. `onAttempt` receives every final attempt outcome. `onDelivery`
receives only delivered attempts. Both callbacks receive defensive byte copies.

The minimum complete frame is 18 bytes and the maximum is 4,114 bytes, as
defined by M0-06. The queue capacity defaults to 64 pending delivery attempts,
may be zero, and is bounded at 1,024. Duplication is bounded at eight total
copies. A submission needing more pending capacity is rejected atomically with
a `backpressured` attempt; no partial copies enter the queue.

## Faults and outcomes

One scripted fault applies to one send:

| Fault | Effect |
| --- | --- |
| `delay` | Adds the declared microsecond delay before the attempt. |
| `loss` | Schedules an attempt that completes as `lost` and is not delivered. |
| `duplication` | Schedules the declared number of copies at the same deadline. Equal-time copies retain schedule order. |
| `reordering` | Adds a deterministic delay, allowing a later send to arrive first. |
| `corruption` | XORs one selected byte in the transmitted copy. The original and wire bytes are both retained. |
| `disconnect` | Drops pending work, records it as `disconnected`, and leaves the link disconnected. The triggering send is also `disconnected`. |

Final outcomes are `delivered`, `lost`, `cancelled`, `disconnected`, or
`backpressured`. Pending attempts are visible as `queued`. Every attempt keeps
sender, receiver, direction, original sequence, wire sequence, original frame
bytes, transmitted bytes, copy index, submission time, scheduled time,
connection epoch, and the applied fault.

## Disconnect and recovery

`disconnect` cancels every pending clock callback and marks its attempt
`disconnected`; no frame is replayed later. Sending while disconnected records
an immediate `disconnected` attempt. `reconnect` opens an empty link and
increments the connection epoch. It does not replay old attempts, infer a
missing sequence, or restore receiver state. M2-07 must establish its own
receiver expected-sequence boundary and report any resulting degraded state.

## Acceptance

Focused tests cover every fault, equal-time ordering, repeatability,
backpressure boundaries, cancellation, disconnect and reconnect, invalid
inputs, immutable byte copies, direction metadata, sequence preservation, and
the absence of stale replay. The focused implementation is 100 percent
covered. The link is intentionally not a retry manager, a transport decoder,
or a scoring simulator.
