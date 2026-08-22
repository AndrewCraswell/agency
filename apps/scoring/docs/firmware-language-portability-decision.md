# ADR: firmware language and portability

- **Status:** accepted for firmware foundations
- **Decision date:** 2026-08-22
- **Applies to:** M3-03 through M3-15
- **Revisit when:** a named safety, certification, customer, or hiring requirement materially changes this trade-off

## Context

This product has two deliberately different processors. The STM32G4 owns acquisition, qualification, timestamps, and
every scoring decision. The ESP32-S3 owns presentation, storage, networking, identity, and updates; it must not make
or alter a scoring decision. The approved `rules-1` TypeScript implementation and M2-05 transport codec are the
executable specification, not firmware source to be embedded or translated at run time.

The firmware needs one small, host-testable **STM32 scoring implementation** while retaining ordinary vendor bring-up,
target debugging, and long-term support. The ESP32 needs receiver, schema, journal, and replay services only. This
decision does not select a safety standard or claim certification.

## Decision

Use a freestanding, portable **strict C17 subset** for the STM32 scoring core and SDK-free protocol-domain libraries
in the first firmware release. Compile those libraries for native host tests and, where relevant, their owning target.
Use the pinned vendor C dialect and required assembly at startup and adapter boundaries; isolate and audit every vendor
extension there rather than claim that generated headers or startup code are strict C17.

- **STM32G4:** use strict C17 for the scoring core and host-test build, then compile that same core for the STM32.
  Use the pinned STM32CubeG4/Arm toolchain C dialect and assembly for startup, acquisition, DMA, comparator, timer,
  watchdog, and transport adapters. Keep STM32Cube-generated and STM32CubeG4 HAL/LL code at that peripheral edge.
  STM32CubeIDE is a supported C/C++ environment, and STM32CubeG4 supplies HAL, LL, CMSIS, middleware, and examples,
  so this follows the vendor's natural integration path without making C++ part of the real-time authority.
- **ESP32-S3:** use project-owned C compiled with the pinned ESP-IDF C dialect for the transport receiver,
  decision-record schema validation, journal boundary, and replay services. It may compile non-authoritative shared
  protocol definitions or generated fixtures, but it must never compile, link, invoke, reproduce, or infer the
  scoring qualification algorithm. Use ESP-IDF for the target framework. C++ is not banned from a later, isolated
  non-scoring ESP component, but it is not part of the M3 foundations or shared interface. Any such addition needs its
  own ADR, a pinned language standard, and a target-size and failure-path measurement.
- **STM32 scoring core:** create it only in M3-03 after M3-02 exports the scoring golden vectors. It will be a pure C
  library with a C header, fixed-width integer types, explicit input/output lengths, caller-owned bounded state, and
  no SDK headers, heap allocation, files, threads, interrupts, wall clock, floating point, or target compiler
  extensions. It receives normalized acquisition observations plus an explicit microsecond timestamp and returns a
  bounded decision or no decision. It is compiled only for native host tests and STM32 firmware. STM32 adapters own
  peripheral access and convert core results to the M0-05/M2-05 contracts.
- **Protocol-domain libraries:** a C transport/schema library may be compiled on both targets only when it operates on
  already-authoritative records or bytes. It must not contain weapon tables, acquisition observations, qualification
  state, or an API that can produce a scoring decision.

Use `uint64_t` for absolute microsecond timestamps at firmware boundaries and fixed-width integer timing constants.
No C++ exceptions, RTTI, virtual dispatch, dynamic allocation, or C++ standard library facility may cross the core
boundary. These constraints make timing and memory use reviewable; they do not make C memory-safe by themselves.

## Evidence informing the choice

The vendor-supported routes cover the selected C path directly:

- [STM32CubeIDE](https://www.st.com/en/development-tools/stm32cubeide.html) is ST's multi-OS C/C++ development
  environment and its current VS Code variant is ST's primary IDE direction. [STM32CubeG4](https://www.st.com/en/embedded-software/stm32cubeg4.html)
  provides the STM32G4 HAL, LL APIs, CMSIS, middleware, and examples.
- [ESP-IDF's build system](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/build-system.html)
  is CMake/Ninja based and organizes applications as components. This fits narrowly scoped C receiver/journal
  components and a shared protocol-domain library rather than a second build system.
- ESP-IDF is primarily C and exposes C APIs, while its
  [C++ support](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/cplusplus.html) is real but
  requires explicit C linkage at language boundaries. Its current default is GNU C++26; exceptions and RTTI are
  disabled by default, exceptions have highly variable slow paths, and virtual calls are unsuitable in IRAM-safe
  handlers. That makes C++ a reasonable future ESP service-layer option, but not a reason to make the qualification
  core less portable.
- Host execution is valuable but not a substitute for target testing. ESP-IDF calls its host application support
  experimental and notes that hardware-dependent components must be mocked or simulated. Its
  [host-app guidance](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/host-apps.html) supports
  the decision to test the SDK-free core with ordinary native tools and use ESP-IDF host support only for adapter
  checks.
- Target diagnosis remains first-class: ESP-IDF documents
  [JTAG/GDB debugging](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/jtag-debugging/index.html),
  [tracing](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/tracing/index.html), and panic
  backtraces/core dumps in its [fatal-error guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/fatal-errors.html).
  STM32CubeIDE supplies the corresponding STM32 edit, compile, and debug workflow.
- ESP-IDF provides target Unity tests; its host tests are still evolving. Its
  [unit-test guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/unit-tests.html) and
  [CI tooling](https://docs.espressif.com/projects/idf-ci/en/latest/) support target and component checks, but do not
  remove the need for native core tests or board measurements.

Facts above are toolchain facts reviewed on the decision date. M3 must pin exact SDK, compiler, and container versions
rather than rely on current defaults.

## Alternatives considered

| Choice | Advantages | Decision |
| --- | --- | --- |
| Strict C17 STM32 scoring core, C protocol-domain libraries, and pinned vendor C adapters | Direct fit for ST-generated C and ESP-IDF C APIs; one scoring authority; straightforward native host tests; widest embedded hiring and support pool | **Selected** |
| C++ STM32 scoring core or C++ on both processors | Better encapsulation tools and supported by both vendor environments | Rejected for foundations. It adds language-linkage and language-version policy without reducing the C peripheral boundary. ESP-IDF's documented exception, RTTI, designated-initializer, and IRAM constraints create avoidable qualification-path rules. It also cannot justify an ESP scoring implementation. |
| Rust STM32 scoring core and Rust firmware | Stronger memory-safety defaults and attractive host tooling | Rejected for foundations. It would add a separate embedded HAL, linker, debugger, crate, and C-FFI supply chain alongside STM32CubeG4 and ESP-IDF. Rust may be reconsidered after a bounded, measured proof shows lower lifecycle risk for a named component; no current product requirement justifies that migration cost. It does not authorize scoring logic on the ESP32. |
| A production scoring implementation on ESP32 | Could appear to simplify local rendering | Prohibited by M0-04. It would violate the authority boundary regardless of language and make replay a second decision path. |
| Keep TypeScript in the firmware path | Reuses the current implementation text | Rejected. It would complicate deterministic bounded-memory target behavior and displace the vendor-supported firmware toolchains. The TypeScript rules remain the oracle and fixture producer. |

## Reliability and maintenance rules

1. Treat all scoring-core inputs as untrusted normalized data until checked; use checked lengths, explicit enum values,
   bounds checks, and defined integer-conversion rules. Do not rely on assertions for production validation.
2. Compile the host scoring core with warnings treated as errors and at least one sanitizer configuration for address and
   undefined-behavior defects. Run deterministic golden vectors, seeded malformed-input tests, and a bounded fuzz
   corpus there. STM32 target builds use the same core sources but are not a replacement for host sanitizers. ESP32
   runs only receiver/schema/journal/replay checks against already-authoritative artifacts.
3. Keep the STM32 authority single-threaded at the scoring-core boundary. ISR/DMA code may enqueue bounded samples but
   cannot call presentation, storage, network, or allocation code.
4. Version and record the STM32CubeG4 package, Arm compiler, ESP-IDF release, Espressif toolchain, build flags, and
   container image digest in CI artifacts. Build both debug and optimized target configurations from those pins.
5. Require target map/size output, stack-budget evidence for the STM32 scoring path, compiler/linker warnings, and a
   review of every optimization or section-placement flag. Profile the STM32 qualification path with hardware timers;
   profile ESP service load with the documented tracing tools without placing trace output in the scoring path.
6. Keep cross-language FFI out of the scoring core. If a future ESP component uses C++, it may call a stable,
   non-authoritative C protocol/service header, owns its own objects, and returns checked C values. No C++ object,
   exception, callback with captured state, or STL type crosses that boundary, and no ESP C++ code gains a path to
   scoring qualification logic.

## Exit gates for M3-03 and M3-08, before their dependents

M3-03 and M3-08 establish these gates. Their dependent implementation tasks may begin only after the applicable gates
are demonstrated:

1. **Fixture parity:** M3-02 generates immutable `rules-1` scoring vectors; M2-05 remains the owner of canonical
   transport golden frames. A native C host test consumes the scoring vectors without copied timing constants and
   matches expected decision records field-for-field. ESP receiver tests consume only M2-05 frames and already-made
   decision records.
2. **Portable build:** the STM32 scoring core builds under pinned native Linux CI compilers and the STM32 target
   toolchain with the same public header, warning policy, and no target SDK include in core sources. The ESP-IDF
   receiver/journal component builds with the pinned ESP toolchain and has no scoring-core dependency.
3. **Bounded resources:** the interfaces state maximum sample, event, transport, and state sizes; the STM32 build
   publishes map and stack-budget artifacts. Overflow is an explicit diagnostic/safe outcome, never silent allocation
   or truncation.
4. **Target integration:** a minimal STM32CubeG4 adapter compiles and runs a scoring smoke vector. A minimal ESP-IDF
   component validates an M2-05 frame and stores or replays an already-authoritative decision record. It must have no
   weapon table, normalized acquisition input, or scoring-core link dependency.
5. **Debug and recovery:** each target can produce a build identity, reset reason, and controlled watchdog test
   artifact. Debug access and production locking remain governed by M0-11 and M3-10, not by this ADR.
6. **Toolchain provenance:** CI fails if the pinned firmware SDK/compiler/container identities are absent from the
   artifact metadata. Version upgrades require the M3-02 scoring corpus, M2-05 frame corpus, and a recorded size,
   warning, and timing-delta review.

## Consequences and open risks

This keeps the safety-critical STM32 portion small, inspectable, and portable, while accepting that C requires
disciplined review and dynamic testing. The ESP32 remains a record consumer, not a second scorer. This does not prove
STM32 interrupt latency, ADC/comparator timing, DMA behavior, ESP32 load isolation, ESD resilience, or FIE
acceptance; those remain M3 target, M4, and EVT/DVT evidence items.

The only planned language boundary is TypeScript fixture generation to versioned data files. It is intentionally a
test-artifact boundary, not an in-product FFI boundary. Rust and C++ remain options for later isolated,
non-authoritative components, but introducing either into STM32 scoring authority requires a new decision record and
equivalence evidence. Neither may authorize an ESP32 scoring implementation.
