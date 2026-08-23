# Production scoring board plan

## Decision

Build one serviceable apparatus from three electrically and mechanically distinct assemblies:

1. A scoring and body-cord I/O board owns weapon excitation, sensing, the STM32G474, primary touch lamps, and the
   buzzer. It remains deterministic and functional if the application controller crashes or is removed.
2. An application and display carrier owns the ESP32-S3, Ethernet, BLE/Wi-Fi, storage, real-time clock, secure element,
   HUB75 display, controls, and update interfaces.
3. Replaceable connector modules carry body-cord sockets, USB-C, RJ45, field serial, and front-panel controls. Chassis
   fasteners, not PCB solder joints, absorb insertion and cable loads.

The assemblies share a power source but not logic ground. Reinforced digital isolation separates the scoring domain
from the electrically noisy display and communications domain. This is a reliability boundary rather than a claim that
the product requires safety isolation from mains; the product uses an external certified Class II supply.

## Product requirements and acceptance evidence

| Requirement | Design response | Release evidence |
| --- | --- | --- |
| FIE three-weapon scoring | STM32-exclusive acquisition and scoring state machines with versioned timing tables | Automated rule vectors plus calibrated weapon/cord fixture runs against the current FIE rules |
| Event replay without copying Skewered's display | Immutable decision record with pre-event and post-event electrical history, rejection reason, timing boundary, and firmware identity | Golden replay corpus proves an event renders identically after reboot and software updates |
| Survive application faults | STM32 directly drives primary red/green/white lamps and buzzer; ESP32 only mirrors decisions | Remove, reset, and corrupt ESP32 traffic while scoring continues correctly |
| Wired venue connectivity | Native W5500 Ethernet and two isolated field-serial ports | Sustained traffic and fault injection cannot change scoring timestamps or reset the STM32 |
| Remote control | PIN-paired BLE control, remembered devices, explicit controller lease, and local-button override | Authentication, replay, lockout, and multi-controller conflict tests |
| Long service life | Active industrial-temperature silicon, external antenna, replaceable wear modules, derated capacitors, protected interfaces, and component lifecycle monitoring | Approved-vendor list, PCN/EOL review, accelerated thermal cycling, drop, vibration, connector-cycle, and burn-in results |
| Serviceability | VESA 100 mounting, serial traceability, self-test, factory test points, field-replaceable power/I/O/display modules | Documented diagnostics and a module replacement that requires no soldering |
| Honest compatibility | Native protocol is documented and isolated; Favero electrical compatibility uses a separately validated adapter | Oscilloscope captures, protocol conformance corpus, cable-length and mixed-device tests |

## Authority and fault containment

The STM32G474 is authoritative for sample time, line classification, debouncing, minimum contact, lockout, hit
qualification, primary lamps, and buzzer. The ESP32-S3 owns the human interface, bout state, network services, event
storage, identity, and signed updates. It may request configuration changes, but the STM32 validates them against a
read-only timing-table manifest and acknowledges the exact applied revision.

The processor link uses framed SPI with sequence number, monotonic timestamp, payload length, CRC-32C, message type,
and protocol version. `ISO7762` carries four STM32-to-ESP32 signals (SCK, MOSI, CS, and the application reset
assertion) and two ESP32-to-STM32 signals (MISO and the ESP32 heartbeat); `ISO7721` carries the STM32 heartbeat.
The STM32 is SPI master, so a separate event-interrupt wire is not required. Each processor has its own TPS3431
watchdog and TPS3890 supervisor. The STM32 may assert the ESP32 `EN` reset through a reset-qualified isolated stage;
the ESP32 has no automatic electrical path to STM32 `NRST`. Link loss freezes the last valid display state, records a
fault, and leaves STM32 scoring operational.

The isolated NXE1S0505MC is followed by a low-noise scoring-domain regulator and filtered analog rail. Its one-watt
budget must be proven with worst-case STM32 clocking, excitation, lamps-driver control, temperature, and converter
derating. Primary lamp power may come from the system rail, but its control and safe defaults remain in the scoring
domain.

## Event replay model

This section describes the production target. The current emulator implements qualified epee records with packed
samples, capture bounds, scoring boot ID, firmware digest, timing revision, sequence validation, and CRC-32C. Rejection
records, application-controller boot identity, RTC uncertainty, and the fixed binary transport remain later increments.

At 20 kHz, seven packed binary inputs require 20 kB/s before metadata when stored as one byte per sample. The STM32
keeps a DMA-fed circular buffer containing packed inputs plus monotonic time anchors and classification transitions. A
touch, rejection, short, parry, whipover, late hit, or line fault freezes a bounded before/after window and attaches:

- the raw packed samples and transition index;
- interpreted weapon state and rejection reason;
- threshold/timing-table revision and scoring-firmware digest;
- both processors' boot identifiers and sequence range;
- device and bout time, with RTC uncertainty recorded when network time is unavailable.

The ESP32 copies the immutable record, verifies its CRC, renders our own timeline, and persists completed records. Two
megabytes of PSRAM comfortably holds bounded replay windows and UI working state, so the industrial-temperature N16R2
module is preferred over N16R8. F-RAM holds configuration transactions, event indexes, and the current journal tail; it
is not used for continuous sample writes. Bulk event records use wear-leveled module flash with a defined retention and
export policy.

## Selected components

The canonical, machine-checked list is `src/component-decisions.ts`. Important choices are:

| Function | Choice | Reason |
| --- | --- | --- |
| Scoring MCU | STM32G474RET3TR | 125 C grade, five 4 MSPS ADCs, seven comparators, six op-amps, high-resolution timers, ECC flash |
| Application module | ESP32-S3-WROOM-1U-N16R2 | 16 MB flash, 2 MB PSRAM, external antenna, 85 C ambient rating |
| Processor barrier | ISO7762FDWR plus ISO7721FDR | Reinforced, fast, correct channel directions, wide operating range |
| Scoring power | NXE1S0505MC plus local regulation | Certified one-watt isolated source; separation from display/network noise |
| ADC reference | REF5025AQDRQ1 | Automotive-qualified, low drift, and specified through 125 C |
| Power entry and service | 10177070-00011LF, TPS25730ADREFR, TPD4S201TRGRRQ1, TVS2200DRVR, B340A-13-F, TPS259474ARPWR, TPS56A37RPAR | Sole USB-PD SPR 20 V/3 A input with native USB 2.0 service data; no battery, charger, or dual-input arbitration |
| Ethernet | W5500 with integrated-magnetics RJ45 | Stable dedicated controller; networking cannot consume the scoring SPI bus |
| Field serial | ISO1410BDWR | Isolated protected RS-485 for our documented long-cable protocol |
| Journal | CY15B104Q-LHXIT | High-endurance F-RAM for atomic metadata and configuration transactions |
| Device identity | STSAFE-A110 | Non-exportable device key and authenticated service identity |
| Audio | TAS2505TRGERQ1 | Active automotive-qualified TAS2505-Q1, VQFN RGE0024K; acoustic output remains a system test |

The machine-enforced critical-part register is `src/part-readiness.ts`. It distinguishes selection, footprint, CAD, and
mechanical evidence instead of treating a supplier search result or a visible 3D body as production approval. Current
external-I/O selections are Würth 7499011121A for 10/100 Ethernet and Amphenol 10177070-00011LF for the high-cycle USB-C
power-and-service port. Stäubli XUB-G 66.9684-* remains a reel-socket
family candidate until exact colors, fencing plug fit, sweat exposure, and cycle life are tested.

Connector families, magnetics, TVS arrays, speaker, LED modules, inductors, capacitors, and the exact analog line
protection network remain controlled selections rather than guessed values. They must be chosen with supplier samples,
FIE resistance thresholds, capacitance budgets, surge testing, acoustic measurements, and two qualified sources where
the interface permits it.

## Power and thermal budgets

The apparatus has one USB-PD SPR 20 V, 3 A input through its USB-C receptacle. It is also a USB 2.0 UFP service port.
The sink-only PD controller negotiates the contract and isolates the apparatus from the mandatory initial 5 V and an
insufficient adapter. There is no battery, charger, PD source role, locking 24 V inlet, or dual-source arbitration.
`usb-c-service-power-architecture.md` controls the selected connector, PD controller, protection parts, test points,
grounding approach, provisional 60 W envelope, and remaining port-specific gates. TPS259474A remains the post-contract
apparatus fault barrier and TPS56A37 converts the negotiated input to V5. The present eFuse current-limit tolerance
does not support the declared 100 ms peak envelope; `v5-power-stage.md` records the denied condition and the required
resolution before power release.

The internal scoring and reference rails must produce identical rule-test results across the negotiated input range,
brownout, adapter removal, and PD hard reset. INA238 telemetry lets firmware reduce display brightness before brownout
without affecting the scoring domain. Because present FIE m.58 prescribes 12 V, approval of this PD-powered apparatus is
a release gate. The standards case is in `fie-modern-power-proposal.md`.

Every rail gets a signed worst-case spreadsheet proving no more than the provisional 60 W contract after maximum current,
minimum conversion efficiency, PD/eFuse loss, 50 C ambient, blocked-vent assumptions, capacitor DC-bias derating, and
supplier tolerance. Production release requires thermal-camera and
thermocouple evidence at full-white display, maximum audio, Ethernet traffic, radio traffic, and continuous scoring.

## Mechanical and service design

- Use an ABS-PC or polycarbonate enclosure, VESA 100 metal inserts, flame-rated internal plastics, and a guarded power
  switch. Do not promise a sealed IP rating around open fencing sockets; target IP30 and test realistic spill paths.
- Put body-cord sockets on replaceable left and right modules with keyed harnesses and connector insertion counters.
  Use panel-supported metal sockets rated from measured cycle and salt/sweat tests.
- Put USB-C, RJ45, and field serial on a replaceable communications module. The USB connector target is at least 10,000
  cycles and must have shell stakes plus chassis strain relief.
- Use four-layer minimum PCBs, high-Tg laminate, ENIG where connector/contact geometry needs it, selective conformal
  coating away from service connectors, and no-clean process qualification. Define creepage across the isolation slot.
- Provide labeled test pads, boundary-scan/SWD access, factory fixture registration holes, per-board serial and lot
  traceability, and a replaceable speaker/display harness.

## Firmware, security, and diagnostics

Secure boot, signed images, anti-rollback policy, A/B application updates, last-known-good scoring firmware, and a
physical recovery path are release requirements. Network and BLE parsers never run on the scoring MCU. The STM32 accepts
only bounded, authenticated configuration messages after local confirmation for timing-affecting changes.

Self-test covers RAM, flash integrity, watchdogs, brownout history, reference voltage, each fencing line's open/short
classification, lamp segments, speaker load, display-current telemetry, RTC, F-RAM, Ethernet, radio, isolated serial,
and the inter-processor link. A service report exports results and firmware identities without private keys or stored
personal data.

## Verification gates

Hardware-in-the-loop is deliberately deferred until boards exist, but it remains a release gate rather than being
deleted from the plan.

1. **Architecture gate:** source-controlled BOM contains only approved lifecycle states; scoring authority and isolated
   nets pass structural tests; threat model and fault tree are reviewed.
2. **Analog gate:** SPICE analysis and a socketed front-end fixture establish excitation, resistance windows, component
   tolerance, temperature drift, ESD capacitance, and all three weapon classifications.
3. **Layout gate:** completed schematic, ERC, controlled PCB stack-up, routed copper, DRC, return-path review, isolation
   creepage, SI/PI review, thermal analysis, assembly drawing, pick-and-place, fabrication notes, and independent review.
4. **Engineering validation:** EVT boards pass bench rule vectors, replay integrity, fault injection, EMC pre-scan,
   thermal, acoustic, cable-length, connector-cycle, and recovery tests.
5. **Design validation:** DVT units pass FIE homologation work, IEC/UL 62368-1 assessment, FCC/CE EMC, ESD/EFT/surge,
   drop/vibration, environmental cycling, RoHS/REACH, and venue trials.
6. **Production validation:** fixture coverage, golden-unit correlation, programming/provisioning audit, burn-in sampling,
   serialized results, supplier control plan, and field-service documentation are accepted.

## Fabrication status

The current tscircuit output is an architectural placement and connectivity model. It is useful for reviewing modules,
ownership, isolation, and connector topology. It is **not ready for PCB fabrication**. Gerbers must not be ordered until
the analog and layout gates above are complete and signed off by an experienced mixed-signal hardware engineer.
Unresolved analog blocks and the ESP32 module are intentionally marked do-not-place rather than being represented by
invented production footprints. The W5500 architecture symbol now uses its actual LQFP-48 package and pin numbering;
the ESP32 symbol uses the manufacturer 41-pad map and official 3D model, but remains do-not-place until its land pattern,
antenna keepout, and candidate GPIO allocation receive independent review.

The preview enables tscircuit's JLC parts engine, part-orientation analysis, board identification, local autorouting,
and fetched CAD geometry. Service results are candidate data only: a supplier match or rendered model does not place a
part on the approved vendor list. The External I/O view shows the replaceable reel, communications, and power modules
separately from the main PCB so chassis-supported connectors are not mistaken for solder-supported board connectors.
