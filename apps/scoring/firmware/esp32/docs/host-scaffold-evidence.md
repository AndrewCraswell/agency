# M3-08 ESP-IDF host-build scaffold evidence

## Scope

This task establishes the non-authoritative ESP32 service boundary. It is an
ordinary C17 component that can be built natively without an ESP board and is
also consumable by ESP-IDF as a component. It includes no ESP-IDF headers, no
generated configuration, and no target adapter implementation.

The implementation validates an M2-05 frame at the ingress boundary and passes
only the borrowed opaque payload bytes and STM32 transport sequence to the
storage service. It does not deserialize an M0-05 record, invoke a weapon rule,
derive a hit, create a scoring event, or acknowledge a scoring decision.
The returned payload view points into the app's fixed ingress buffer and is
valid only until the next receive. A storage adapter must make a durable copy
within its callback; the scaffold retains no replayable record ownership.

## Interfaces and safe defaults

`include/scoring_esp32_services.h` declares substitutable function-table
interfaces for storage, monotonic clock and time metadata, device and boot
identity, network, display, audio, signed update, watchdog, reset, and the
read-only scoring link. They exchange caller-owned data views.
Only the scoring ingress buffer has a fixed capacity at this layer. Other
service byte values are borrowed views; their bounds and ownership policies
belong to the relevant adapter and M3-10/M3-11 work.

`scoring_esp32_app_init` normalizes every absent callback into a deterministic
`UNAVAILABLE` service. The default clock reports unavailable metadata, the
default identity is empty, and the default scoring link supplies no bytes. No
missing adapter can create a record, fake a time value, or issue a reset.
`request_reset` is an ESP32-local adapter boundary only: no STM32 reset,
control, or scoring-authority path is available here.

The only fixed transport allocation is the 4,114-byte M2-05 maximum frame.
Payloads larger than 4,096 bytes, malformed length fields, nonzero flags,
unknown framing fields, and CRC-32C failures are rejected before storage is
called.

## Host command

From `apps/scoring`, run:

```text
powershell -ExecutionPolicy Bypass -File firmware/esp32/scripts/run-host-tests.ps1
```

The command configures the native CMake project, builds the strict C17 library
and host test with warnings as errors, then runs CTest. A compatible C compiler
and Ninja are required. The expected ESP-IDF integration is to add this
directory as a component; when `ESP_PLATFORM` is set, its CMake file calls
`idf_component_register` with the same source and include directory.
Pass `-Configuration Release` to exercise the same checks with `NDEBUG` set;
the host test uses an always-active `CHECK` mechanism rather than `assert`.

## Executable acceptance

`tests/scoring_esp32_services_host_test.c` proves:

1. a valid M2-05 `decision-record` frame reaches storage with byte-identical
   opaque payload and its STM32 sequence;
2. non-decision, nonzero-flag, CRC-corrupt, truncated, over-declared-length,
   and oversized link reports never reach storage and leave the returned record
   empty;
3. storage failure returns no record to the caller; and
4. an app with no target adapters exercises every normalized service category
   and fails safely and deterministically.

## Explicit deferrals

This is not an ESP-IDF target build, `sdkconfig`, secure-boot provisioning,
signature verifier, flash journal, replay renderer, network client, display
driver, audio driver, watchdog driver, or reset implementation. Those belong to
the pinned target integration and M3-09 through M3-11. M2-07/M2-08 remain the
current contract models for record acceptance and power-fail safety; this
scaffold does not duplicate them.
