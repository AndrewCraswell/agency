# M3-11 ESP32 application-load isolation evidence

## Scope

This host-only C17 harness demonstrates the M0-04 boundary at the M3-08 ESP32
service interface. It uses no ESP-IDF, display, audio, network, storage, or
scoring drivers. It does not parse a scoring record or execute scoring rules.

The scoring link remains a read-only STM32-to-ESP32 ingress. A completed,
valid M2-05 `decision-record` frame is passed to storage as its opaque payload
and STM32 transport sequence. Display, audio, and network have only separate
caller-owned byte-view inputs; they have no record, timestamp, decision, or
STM32-control parameter.

## Bounded load harness

`tests/scoring_esp32_load_isolation_host_test.c` defines one fixed maximum
simulation: 2,048 rounds, each calling all three application services with a
4,096-byte payload. The services are substitutable host fakes that return:

- network backpressure as `BUFFER_TOO_SMALL`;
- display failure as `UNAVAILABLE`; and
- audio rejection as `REJECTED`.

The harness runs that bounded load before and after valid STM32 record ingress.
It compares the returned borrowed record and the storage adapter's durable copy
byte-for-byte with the source payload, and compares the source STM32 transport
sequence exactly. An identified opaque fixture span represents an STM32 `atUs`
timestamp sentinel; the harness does not decode it, but proves it unchanged as
part of the full opaque payload comparison.

It also corrupts an otherwise valid decision frame after the same application
load. The frame is rejected before storage, the returned record is empty, and
no service call can create or reclassify a scoring record.

## Host commands

From `apps/scoring`, run both configurations:

```text
powershell -ExecutionPolicy Bypass -File firmware/esp32/scripts/run-host-tests.ps1 -Configuration Debug
powershell -ExecutionPolicy Bypass -File firmware/esp32/scripts/run-host-tests.ps1 -Configuration Release
```

Both configure the SDK-free native CMake project, build with warnings as
errors, and run CTest. The CTest suite includes the M3-08 service-boundary test
and the M3-11 load-isolation test.

## Limits

This is host evidence for software boundary containment, not proof of ESP32
scheduler fairness, Wi-Fi or Ethernet driver behavior, display/audio DMA,
physical link isolation, or real-time STM32 acquisition. Those need target and
board evidence. It adds no scoring behavior, network implementation, driver,
queue, retry, record ownership, or STM32 control path.
