# Native dual-firmware integration runner

**Task:** M3-14
**Scope:** native C17 integration evidence only. This is not a Renode,
hardware-in-the-loop, or board bring-up claim.

The runner links the production STM32 host publish seam and its CRC-32C,
sequence-bearing transport implementation directly with the production ESP32
transport decoder, receiver, durable two-slot journal, reset/reopen, and replay
implementation. It does not deserialize a decision record or implement scoring.
The payload is an opaque byte array at every test boundary.

## Covered properties

- An STM32-published decision frame is accepted once by the ESP32, retaining
  exact payload bytes and STM32 sequence in journal replay.
- A repeated frame is rejected without appending; a CRC-corrupted frame is
  rejected and degrades the link.
- A lost sequence followed by a later sequence is rejected as out of order.
  After an ESP32 application-only new boot, journal reopen restores the cursor,
  then the original lost and reordered real frames are accepted in sequence.
- STM32 publish backpressure blocks a repeat write until the owning code calls
  `scoring_stm32_host_recover_transport`; recovery with the known next sequence
  emits a frame the ESP32 accepts exactly once.
- A later ESP32 application-only new boot reopens the journal and replays the
  complete retained sequence without a STM32 reset path.
- For each journal power-loss boundary, restart observes either the old complete
  checkpoint or the new complete checkpoint, never a partial decision payload.

## Platform fakes, deliberately limited

| Fake | Role | Not modeled |
| --- | --- | --- |
| STM32 clock, ADC, comparator, DMA, flash, watchdog | Makes the existing host scaffold ready so its real publish seam can run | Sampling, electrical behavior, timing, qualification, or scoring |
| STM32-to-ESP link buffer | Copies the exact bytes handed to the STM32 publish callback and exposes them once to ESP ingress | UART, SPI, DMA, latency, loss physics, or hardware flow control |
| ESP boot-ID service | Changes a bounded application boot identifier before receiver reset | ESP reset circuitry or STM32 control/reset |
| ESP journal storage power-loss arm | Existing M3-09 host fault-model storage hook | Flash wear, target filesystem, or power rail behavior |

The STM32 transport encoder, ESP32 transport decoder, receiver ordering,
journal checkpoint/reopen/replay logic, and all payload/sequence assertions are
real production C17 code.

## Verification

Configure this target with the repository C17 warning policy and run CTest in
both Debug and Release. LLVM source coverage is also enabled for the native
runner, but the coverage percentage is evidence for these linked transport and
receiver paths; it does not replace the separately required 100% scoring-core
coverage gate.

Current host verification used LLVM-MinGW Clang 22.1.8 and passed one runner
test in both Debug and Release. The dedicated coverage run executed the same
runner and covered the linked STM32 host/transport and ESP32
services/journal/receiver code; its aggregate line coverage is 49.58%. That
number is intentionally not a new production coverage threshold: this runner
selects cross-firmware failure paths, while each owning unit retains its own
coverage gate.
