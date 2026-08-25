# BP-010 bench-prototype architecture

## Decision and release status

The first integrated hardware is one deliberately accessible PCB on standoffs.
It is a bench instrument for closing electrical, firmware, and rules-behavior
questions. It is not a production form-factor preview or a fabrication release.

The P0 prototype uses one exact `ESP32-S3-WROOM-1-N16R2` with its integrated
PCB antenna. The previous
STM32-plus-ESP32 architecture, processor-to-processor isolators, isolated link
power, isolated SPI, and STM32 SWD interface are superseded for this board.
Their records remain historical evidence only.

This decision does not merge the software responsibilities. The portable C17
scoring core owns scoring decisions. Target adapters own acquisition,
timestamps, queues, safe outputs, storage, Ethernet, display, USB, and IR. The
interfaces between those layers must remain target-neutral so a separate
scoring MCU can be introduced later without rewriting rules behavior.

The machine-checkable source of the board boundary remains
`src/bench-prototype-contract.ts`. Until it is reconciled with this decision,
the schematic, PCB, fabrication, and order states remain denied.

## Required on the one board

- `ESP32-S3-WROOM-1-N16R2` runs the target adapter and portable C17 core.
  Its PCB antenna must extend past the base-board edge when practical. If it
  cannot, keep at least 15 mm clear in all directions around its antenna area:
  no copper, routing, or components. Keep metal housing away and verify the
  finished product for throughput and communication range.
- The seven-conductor external analog front end supplies ordered, timestamped
  ADS8881 samples through a bounded interface. Queue overflow, timestamp loss,
  conversion loss, or frame-order loss must make scoring unavailable rather
  than drop evidence silently. Per-channel comparator GPIOs are omitted from
  P0 unless BP-127 proves the ADC-only cadence cannot satisfy the timing budget.
- `W5500` and Würth `7499011121A` provide required wired Ethernet. The MDI
  pairs stay on the PCB.
- `TSOP38438` provides the 38 kHz, 940 nm encrypted-remote receive path through
  an ESP32 RMT-capable input. Authentication, replay protection, and workflow
  handling cannot fabricate, qualify, clear, or reclassify an electrical hit.
- Two `SN74AHCT245PWR` buffers drive the selected HUB75 panel and hold it blank
  before firmware, during reset, and during brownout.
- USB-C PD remains the only populated power input. Labeled rail test pads and
  removable current links support de-energized diagnosis without a second
  connector or source selector.
- Primary lamps, buzzer, recovery access, labeled test points, and direct-wire
  prototype weapon connections remain on the board.

## Provisional zoning and access

The old 300 mm by 160 mm drawing and isolation corridor are superseded. BP-010
must produce a smaller dimensioned planning drawing after BP-127 proves the
ESP32 peripheral allocation and acquisition boundary. The new drawing uses a
lower-left datum and reserves, in order:

1. weapon connection, protection, and analog acquisition;
2. reference, ADC, and guarded test access;
3. ESP32, reset/recovery, primary outputs, and IR;
4. USB-C PD, conversion, W5500, and board-edge MagJack; and
5. HUB75 buffering and protected display power.

Use one low-impedance digital ground system with explicit sensitive analog
return, reference return, ESD return, chassis/shield, and high-current display
rules. There is no processor isolation corridor or isolated scoring supply on
the P0 board. This does not waive isolation that may be required at exposed
external interfaces or in a future production partition.

The next drawing must place the weapon connection, Ethernet jack, USB-C,
HUB75, IR optical window, ESP32 integrated-antenna clearance, and recovery access
on appropriate edges. It must preserve probe access and
mechanical strain transfer around the direct-wire weapon landing.

## Fixed prototype interfaces

| Function | Fixed P0 decision |
| --- | --- |
| Processor | Exact `ESP32-S3-WROOM-1-N16R2` with integrated PCB antenna; no second MCU on P0. |
| Scoring software | One portable C17 core with target-neutral input/output byte contracts; no TypeScript scoring fallback. |
| Analog acquisition | Existing protected seven-channel AFE and ADS8881 daisy-chain concept; exact ADC-only cadence and timestamp budget to be closed by BP-127 and BP-103. |
| Ethernet | Exact `W5500` plus committed support network and Würth `7499011121A`. |
| IR receiver | Exact `TSOP38438`, 38 kHz carrier, 940 nm assumption, protected supply, test point, optical access, and ESP32 RMT capture. |
| Display | Adafruit product `2277`, 64 by 32, 1/16 scan, with two `SN74AHCT245PWR` buffers and protected 5 V branch. |
| Normal power | Amphenol `10177070-00011LF` USB-C receptacle and selected PD/protection/eFuse/conversion path. |
| Bench power diagnosis | No populated alternate input. Use labeled rail test pads and removable current links only under a de-energized, USB-disconnected procedure. |
| Weapon prototype | Six labeled A/B/C solder landings, probe points, and mechanical strain relief; the owner-validated OK Fencing cable is accepted. |
| Recovery | Native USB plus 3.3 V UART/boot/reset access; no STM32 SWD. |

## Failure and validation boundary

BP-127 is the architecture feasibility gate. It must bind the exact ESP32 pins,
timer, external ADC transfer, sample ordering, queue sizes, serialized primary
outputs, inactive states, watchdog/brownout behavior, recovery path, and rail
budget. It must measure or conservatively prove FIE-relevant acquisition under
simultaneous Ethernet, HUB75, IR, USB, and storage load. No paper allocation
receives physical timing credit.

The C17 core receives only explicit canonical timestamps and normalized
observations. It imports no wall clock, network, display, storage, random, or
ESP-IDF behavior. Platform overload and malformed input must return an explicit
unavailable/fault record before any scoring output can change.

## Explicitly deferred

The P0 board does not decide the enclosure, production body-cord socket,
miniaturization, final board partition, battery/UPS implementation, regulatory
certification, or factory panelization. It must nevertheless expose enough
measurement and fault-injection access to determine whether the simplified
architecture can meet FIE timing, resistance, output, power, and recovery
requirements.

Ethernet and encrypted IR are not deferred. Wi-Fi is not required for
prototype-ready connectivity and must not receive timing credit until the
loaded acquisition tests pass. F-RAM, RTC, secure element, audio, speaker,
STM32, processor isolators, isolated-link power, SWD, and
dual-domain-only support are removed from the populated P0 BOM. One ESP32
reset/brownout/watchdog path remains because it protects the sole scoring
authority. Encrypted-remote identity and counters use ESP32 eFuses plus
encrypted NVS under a reviewed wear, recovery, and no-write-during-scoring
policy.
