# Proposed advanced fencing scoring apparatus product specification

**Status:** product proposal for review

**Purpose:** define a commercially competitive three-weapon scoring apparatus, its major hardware interfaces, operator
features, protocols, remote control, and firmware behavior. This is a product specification, not a schematic release,
manufacturing procedure, or claim of FIE homologation.

## Contents

- [1. Product overview](#1-product-overview)
- [2. Proposed feature catalog](#2-proposed-feature-catalog)
- [3. System and PCB architecture](#3-system-and-pcb-architecture)
  - [3.3 Weapon-facing analog front end](#33-weapon-facing-analog-front-end)
  - [3.6 External inputs](#36-external-inputs)
  - [3.7 External outputs](#37-external-outputs)
  - [3.8 Power and charging](#38-power-and-charging)
- [4. Scoring and bout behavior](#4-scoring-and-bout-behavior)
  - [4.6 Scoring-to-clock stop contract](#46-scoring-to-clock-stop-contract)
- [5. Controls, display, and referee remote](#5-controls-display-and-referee-remote)
  - [5.4 Remote button actions](#54-remote-button-actions)
- [6. Communications, events, and state authority](#6-communications-events-and-state-authority)
  - [6.3 Protocol support](#63-protocol-support)
  - [6.4 Events emitted by the product](#64-events-emitted-by-the-product)
  - [6.5 Commands ingested by the product](#65-commands-ingested-by-the-product)
  - [6.6 Cyrano EFP1.1 behavior](#66-cyrano-efp11-behavior)
  - [6.7 RS422-FPA 3.04a output](#67-rs422-fpa-304a-output)
- [7. Firmware requirements](#7-firmware-requirements)
- [8. Faults, calibration, and conformance](#8-faults-calibration-and-conformance)
- [9. Open decisions](#9-open-decisions)
- [References](#references)

## 1. Product overview

The product is a modern wired fencing scoring apparatus for clubs, training venues, and competitions. One electronics
platform supports a wall-mounted enclosure and a tabletop version held upright by a stable pedestal. The apparatus
scores wired foil, epee, and sabre, manages the visible bout workflow, accepts an authenticated referee remote, and can
connect to competition and repeater systems without making networking part of the scoring path.

The product combines the conventional workflow and installation flexibility documented for Favero apparatuses with
the diagnostics, replay, and recovery ideas documented by Virtual Scoring Machine and Skewered Fencing. OpenPiste,
wnew, JBox, and Sentinel are implementation prior art, not conformance authorities. The FIE Material Rules and the
project's FIE-derived weapon specification remain the scoring authority.

### 1.1 Product principles

1. Electrical hits are decided only by the deterministic scoring subsystem.
2. Display, network, remote, storage, or application failure cannot create, reclassify, or clear a hit.
3. The machine remains a useful standalone scoring box with no phone, account, cloud service, or network.
4. Routine referee actions are direct, visible, and reversible where the rules permit.
5. The product implements only the FIE T2016 scoring timings. It has no legacy, alternate-league, or user-adjustable
   qualification or lockout profile.
6. Internal repair and maintenance are limited to qualified service.
7. Failed updates and interrupted power have a local recovery path.

### 1.2 Product configurations

| Configuration | Included capability |
| --- | --- |
| Wall | VESA-compatible mounting and the same electronics platform |
| Tabletop | The same apparatus on a rigid, non-leaning pedestal with cable strain relief and anti-tip feet |
| Competition | Targeted EFP1.1 and isolated RS422-FPA integration; optional P2 fencer identity after named interoperability qualification |
| Repeater/finals | Wired light repeaters and external score, clock, card, priority, and identity displays |

The scoring behavior is identical in every configuration. Accessories and network features do not select a different
scoring implementation.

### 1.3 Prototype design targets

These are engineering targets for prototype selection and validation, not customer claims. Published specifications
must use final production hardware and declared test conditions.

| Property | Proposed target |
| --- | --- |
| Weapons | Wired foil, epee, and sabre |
| Rules profile | FIE T2016 timings derived from the pinned August 2026 Material Rules |
| Score digit height | At least 70 mm |
| Clock and period digit height | At least 50 mm |
| Remote range | At least 20 m frontal in the declared venue-light and interference envelope |
| Remote latency | No more than 100 ms from completed gesture to authenticated command delivery; 70 ms is an engineering stretch target |
| Remote endurance | 300 operating hours is an engineering stretch target; publish only after measurement under a declared referee-use profile |
| Operating environment | 0 to 40 degrees C, 10 to 90 percent relative humidity, non-condensing |
| Installation | Wall and stable tabletop pedestal |
| Standalone operation | Complete scoring and ordinary bout control without network or companion application |

### 1.4 Scope and exclusions

The first product includes wired weapons and an authenticated referee remote. Wireless body-cord or wireless weapon
scoring is out of scope. Plastic-weapon modes, the Favero WF1 feature set, automatic right-of-way decisions, and video
referee decisions are out of scope. Video systems may receive synchronization and state information but cannot decide a
hit or point.

### 1.5 Sources and precedence

If sources conflict, apply this order:

1. The pinned [August 2026 FIE Material Rules](fie-material-rules-2026-08-en.pdf).
2. The [FIE traceability matrix](fie-traceability-matrix.md) and
   [weapon-scoring programming specification](weapon-scoring-programming-specification.md), corrected whenever the FIE
   source requires it.
3. Pinned protocol documents in [`protocols/`](protocols/).
4. Approved product decisions in this specification.
5. The [commercial feature catalog](commercial-scoring-machine-feature-catalog.md), manufacturer manuals, and
   [open-source prior art](prior-art/fencing-scoring-prior-art-analysis.md).

Commercial manuals show useful behavior and customer expectations. They do not prove FIE conformance or define an
electrical threshold that the FIE source leaves open.

### 1.6 Priority

| Priority | Meaning |
| --- | --- |
| P0 | Required for correct scoring, safe operation, or a usable first product |
| P1 | Planned commercial capability, subject to explicit release planning and validation |
| P2 | Valuable advanced or premium capability |
| P3 | Post-launch product expansion; excluded from the first product release |
| Later | Deliberately deferred from the first product |

Priority describes intended product phasing, not current implementation or qualification status. A feature is supported
only after its stated verification and, where applicable, named interoperability testing pass.

## 2. Proposed feature catalog

The IDs match the commercial feature catalog so the proposed product can be compared directly with Favero, VSM,
Skewered, and the retained public repositories.

### 2.1 Scoring authority and weapon modes

| ID | Feature | Explanation | Priority | Source or rationale |
| --- | --- | --- | --- | --- |
| `SC-001` | Wired foil scoring | Score standard wired foil with on-target and off-target indications. | P0 | FIE and commercial baseline |
| `SC-002` | Wired epee scoring | Score standard wired epee, including double hits and grounded-material rejection. | P0 | FIE and commercial baseline |
| `SC-003` | Wired sabre scoring | Score standard wired sabre, including control-circuit diagnostics and whipover handling. | P0 | FIE and commercial baseline |
| `SC-006` | Foil hit qualification | Qualify the foil circuit break using the approved timing and resistance profile. | P0 | FIE |
| `SC-007` | Foil second-hit window | Accept the eligible opposite-side signal only inside the approved foil window. | P0 | FIE |
| `SC-008` | Epee hit qualification | Reject subminimum contacts and qualify a trusted epee tip closure. | P0 | FIE |
| `SC-009` | Epee double-hit window | Produce one or two lamps according to the approved epee interval policy. | P0 | FIE |
| `SC-010` | Sabre hit qualification | Qualify conductive target contact and reject subminimum contact. | P0 | FIE |
| `SC-011` | Sabre second-hit window | Accept the eligible opposite-side signal only inside the approved sabre window. | P0 | FIE |
| `SC-012` | Sabre whipover rejection | Track blade-contact history and interruption count instead of using generic debounce. | P0 | FIE; major public prior-art gap |
| `SC-013` | Foil valid/off-target distinction | Drive red/green for on-target and white for off-target without deciding right of way. | P0 | FIE |
| `SC-014` | Grounded-piste rejection | Reject hits on conductive piste, guard, or other grounded material as required by weapon. | P0 | FIE |
| `SC-015` | Own-equipment suppression | Apply the weapon-specific guard, blade, and own-conductive-equipment rules. | P0 | FIE |
| `SC-016` | Disconnected/open-circuit handling | Show the correct fault or idle state without creating a hit. | P0 | FIE and commercial baseline |
| `SC-017` | Automatic rearm | Rearm after the selected delay only through the scoring subsystem. | P0 | Commercial baseline |
| `SC-018` | Manual rearm | Give the referee an explicit rearm control distinct from reset or new bout. | P0 | Favero, JBox, and Skewered |

### 2.2 Training and alternate modes

| ID | Feature | Explanation | Priority | Source or rationale |
| --- | --- | --- | --- | --- |
| `TR-001` | Rapid-hit epee training | Rearm rapidly for repetitive epee drills without changing T2016 touch qualification or double-hit timing. | P2 | Favero |
| `TR-002` | Automatic epee score | Add a score from an accepted epee hit when enabled. | P1 | Broad commercial baseline |
| `TR-003` | Manual epee score | Allow normal referee score entry when automatic epee scoring is disabled. | P1 | Broad commercial baseline |
| `TR-006` | Self-referee start | Allow an explicit training-only fencer action to start the clock. | P2 | VSM and Skewered |
| `TR-007` | Fencer score acknowledgement | Let a fencer acknowledge a training hit without granting scoring authority. | Later | VSM and Skewered |

### 2.3 Bout, score, clock, and referee workflow

| ID | Feature | Explanation | Priority | Source or rationale |
| --- | --- | --- | --- | --- |
| `BT-001` | Two-sided score | Display and control left and right scores independently. | P0 | Commercial baseline |
| `BT-002` | Score correction | Increment or decrement either score without permitting negative values. | P0 | Commercial baseline |
| `BT-003` | Bout clock | Start and stop the countdown from the remote or active referee controller. | P0 | FIE and commercial baseline |
| `BT-004` | Configured bout time | Load a reviewed initial time and reject invalid or absent configurations. | P0 | Commercial baseline |
| `BT-005` | One-minute break | Run the standard break separately from the bout clock. | P1 | Commercial baseline |
| `BT-006` | One-minute extra time | Enter overtime with explicit priority state. | P1 | Commercial baseline |
| `BT-007` | Final-ten-second precision | Show tenths while running and hundredths while stopped in the final ten seconds. | P0 | FIE |
| `BT-008` | Match or period counter | Show the applicable individual period or team round. | P1 | Commercial baseline |
| `BT-009` | Random priority | Assign unbiased priority for overtime. | P1 | Commercial baseline |
| `BT-010` | Manual priority control | Permit an authorized supervisor to set or clear priority with visible state. | P1 | Commercial baseline |
| `BT-011` | Yellow-card state | Track and display the applicable yellow penalty state. | P1 | Commercial baseline |
| `BT-012` | Red-card scoring | Record the card and opponent point atomically. | P1 | Commercial baseline |
| `BT-013` | P-card workflow | Track and display rules-valid P-card progression for each side. | P1 | Modern competition baseline |
| `BT-014` | Passivity timer | Display the authoritative elapsed passivity time. | P1 | Favero, VSM, and Skewered |
| `BT-015` | Passivity expiry | Stop the clock and block further touches until the required referee action. | P1 | Favero, VSM, and Skewered |
| `BT-016` | Medical intervention | Run a separate intervention clock without corrupting bout time. | P1 | Four commercial peers |
| `BT-017` | Fencer status | Represent victory, defeat, abandonment, and exclusion for tournament integration. | P2 | FA-07 and Cyrano |
| `BT-018` | Team reserve | Represent reserve-fencer introduction for team events. | P2 | FA-07 and Cyrano |
| `BT-019` | Side swap | Swap the complete left/right workflow state, identity, and presentation atomically. | P1 | Commercial baseline |
| `BT-020` | Undo | Apply a compensating correction for the latest reversible referee action. | P1 | FA-15, VSM, and Skewered |
| `BT-021` | Running-clock guards | Reject destructive configuration and reset actions while the clock runs. | P0 | Favero, VSM, and Skewered |
| `BT-022` | New bout | Clear the appropriate workflow state through a guarded, visibly confirmed action. | P0 | Commercial baseline |

### 2.4 Display, sound, and diagnostics

| ID | Feature | Explanation | Priority | Source or rationale |
| --- | --- | --- | --- | --- |
| `UI-001` | Valid-hit lights | Provide unmistakable red and green valid-hit indications. | P0 | FIE |
| `UI-002` | White off-target lights | Provide left and right white foil off-target indications. | P0 | FIE |
| `UI-003` | Ground/fault indicators | Show weapon-specific insulation, earth, and line faults separately from hits. | P0 | FIE and commercial baseline |
| `UI-004` | Live event timeline | Show recent contact and scoring activity for diagnostics and training. | P2 | Skewered |
| `UI-005` | Freeze timeline on touch | Freeze the relevant pre-hit window when a hit latches. | P2 | Skewered |
| `UI-006` | Touch review | Review a bounded history without changing the live scoring decision. | P2 | VSM and Skewered |
| `UI-008` | Rejected-contact evidence | Show the measured observation and rule that rejected a contact without claiming an unmeasured physical cause. | P2 | VSM and Skewered |
| `UI-009` | Second-touch delta | Show the measured interval between first and second qualified signals. | P2 | VSM and Skewered |
| `UI-010` | Display rotation | Rotate score and clock presentation for supported mounting orientations. | P1 | FA-07 and Skewered |
| `UI-011` | Volume control | Provide venue-appropriate levels without allowing volume control to clear lights. | P1 | Commercial baseline |
| `UI-012` | Primary hit sound | Sound from the scoring domain for each qualified hit, independent of display or network operation. | P0 | FIE and commercial baseline |
| `UI-013` | Distinct control sounds | Distinguish hit, clock, warning, acceptance, and rejection sounds. | P1 | Commercial baseline |
| `UI-014` | Local self-test | Exercise lamps, digits, buzzer, remote indication, and major interfaces. | P0 | Commercial baseline |
| `UI-015` | Line-fault visualization | Identify the affected side and conductor group without presenting a false hit. | P1 | VSM and Skewered |
| `UI-016` | Visible firmware identity | Show product firmware, scoring rules profile, and hardware revision. | P1 | Commercial baseline |
| `UI-017` | Remote battery status | Show remote low-battery state on the apparatus. | P0 | Favero and Skewered |

### 2.5 Remote, networking, repeaters, and integration

| ID | Feature | Explanation | Priority | Source or rationale |
| --- | --- | --- | --- | --- |
| `IO-001` | Dedicated referee remote | Supply a purpose-built handheld for routine bout operation. | P0 | Commercial baseline |
| `IO-002` | Remote association | Bind a remote to one apparatus and visibly manage replacement or revocation. | P0 | Commercial baseline |
| `IO-003` | 20 m remote range | Meet a 20 m frontal range target without cross-piste command acceptance. | P0 | FA-15 and first-product usability |
| `IO-004` | Bluetooth phone/tablet control | Offer an optional authenticated Bluetooth mobile-app controller; default connections are read-only. | P3 | FA-15 and Skewered |
| `IO-005` | Read-only state broadcast | Publish box state for displays and observers without granting control. | P1 | Favero and OpenPiste |
| `IO-006` | Authenticated remote control | Encrypt and authenticate remote commands with replay prevention. | P0 | Commercial baseline and product safety |
| `IO-007` | Multiple observer clients | Permit bounded simultaneous read-only clients while retaining one active writer. | P2 | FA-15 and VSM |
| `IO-008` | Wired light repeater | Drive external red, green, and white repeaters. | P1 | FIE finals and commercial baseline |
| `IO-010` | RS422-FPA output | Target the public FPA 3.04a messages over an isolated RS422 output; claim compatibility only after named receiver tests. | P1 | FA-07, VSM, Skewered, and OpenPiste |
| `IO-011` | Cyrano integration | Target competition assignment and apparatus-state exchange using EFP1.1; claim compatibility only after named system tests. | P1 | FA-07 and OpenPiste |
| `IO-012` | Ethernet management | Provide wired LAN configuration and competition integration. | P1 | FA-07 and VSM |
| `IO-013` | Fencer identity display | Show name and country when supplied by an authorized competition system. | P2 | FA-07, VSM, Cyrano, and FPA |
| `IO-014` | Video synchronization | Publish timing and state markers for replay systems without accepting video decisions. | P2 | VSM and Skewered |
| `IO-015` | Communications-independent scoring | Continue correct scoring when the remote, app, or networking is unavailable. | P0 | All commercial peers and product principle |
| `IO-016` | Communications recovery | Restart a failed remote receiver or network subsystem without rebooting scoring. | P1 | Skewered and prior-art gap analysis |

### 2.6 Update, service, power, and mechanical capabilities

| ID | Feature | Explanation | Priority | Source or rationale |
| --- | --- | --- | --- | --- |
| `SV-001` | Field firmware update | Update product firmware through an authenticated local or network workflow. | P1 | Commercial baseline |
| `SV-002` | Recovery update | Recover locally from an invalid or interrupted update. | P0 | Favero and Skewered |
| `SV-003` | Release history | Publish customer-readable firmware changes and compatibility notes. | P1 | VSM and Skewered |
| `SV-004` | Serial and version display | Expose immutable device identity and installed firmware locally. | P1 | Commercial baseline |
| `SV-005` | USB-C power operation | Power the apparatus through one protected USB-C input; mains never enters the enclosure. | P0 | Favero and commercial baseline |
| `SV-008` | Low-input warning | Warn when the active USB-C source can no longer maintain the approved power profile. | P1 | Commercial baseline adapted to external power |
| `SV-009` | Tabletop installation | Use a rigid upright pedestal rather than a leaning backstand. | P0 | Product requirement |
| `SV-010` | Wall installation | Support secure wall mounting and clear connector access. | P0 | Commercial baseline |
| `SV-012` | Transport case | Offer a case for the apparatus, remote, power supply, pedestal, and cables. | P2 | Favero and JBox |
| `SV-013` | Drop-resistant enclosure | Survive the declared handling/drop test without unsafe damage or false scoring. | P1 | FA-15 product-quality benchmark |
| `SV-014` | Isolated weapon circuit | Isolate the weapon-facing scoring domain from application, network, and external display grounds. | P0 | FIE and Favero |
| `SV-015` | Safety and service guidance | Publish cleaning, battery, disposal, power, and user-service boundaries. | P0 | Commercial product baseline |

### 2.7 Repeater and companion-display capabilities

| ID | Feature | Explanation | Priority | Source or rationale |
| --- | --- | --- | --- | --- |
| `RP-001` | Hit-light repetition | Repeat red, green, and both white lights at long distance. | P1 | FIE finals and Favero |
| `RP-002` | Repeater expansion | Permit multiple repeaters within the published electrical load limit. | P2 | Favero |
| `RP-003` | Finals display | Present score, clock, round, cards, priority, and fencer identity. | P2 | Favero FR240 and VSM |
| `RP-004` | FPA input/output repeater | Permit a dedicated display accessory to receive and regenerate FPA. | P2 | Favero FR240 |
| `RP-005` | Cyrano fencer identity | Project names and countries received through the competition path. | P2 | Favero FR240 |
| `RP-006` | Standalone identity injection | Let an authorized computer supply identity when tournament data is unavailable. | Later | Favero FR240 |
| `RP-007` | Repeater self-test | Show missing data and exercise all repeater LEDs locally. | P1 | Favero FR240 |

## 3. System and PCB architecture

### 3.1 Proposed architecture

The product uses two electrically separated processing domains with selected controllers:

```text
Left A/B/C   Right A/B/C   Piste
       \        |        /
       Protected analog acquisition
                  |
     STM32G474 scoring controller
          |                 |
   Primary lights       Primary buzzer
          |
 Isolated power, UART, and hit-stop signal
                          |
      ESP32-S3 application controller
        /        |        |        \
   Display    Remote   Ethernet   Storage/service
```

The STM32G474 owns acquisition, weapon qualification, lockout, rearm, scoring timestamps, and primary hit outputs. The
ESP32-S3 owns score, countdown clock, cards, priority, display composition, remote command validation, networking,
storage, and application updates. The production product does not combine these roles in one processor. Neither an
ESP32 reset nor application firmware behavior may reset the STM32, drive a primary scoring output, or enter the
weapon-facing electrical domain.

### 3.2 Physical board partition

| Assembly | Functions | Service approach |
| --- | --- | --- |
| Scoring I/O PCB | Left/right body-cord and piste sockets, connector protection, analog front end, STM32G474, calibration storage, isolated scoring supply, and processor-link isolation | Qualified service only |
| Application/power PCB | ESP32-S3 module, USB-C PD and rail conversion, W5500 Ethernet, persistent application storage, USB service, FPA, and external application I/O | Qualified service only |
| Display/output PCB | Score, clock, cards, priority, mode, local buttons, IR receivers, display drivers, primary lamp drivers, and audio paths | Qualified service only |
| Primary lamp circuits | Red, green, white, and selected diagnostics commanded only by STM32 signals crossing fail-low isolation | Qualified service only |
| Tabletop pedestal | Rigid stand, cable management, and anti-tip mass | External accessory |

The first hardware design uses these three PCB assemblies. A later board consolidation must preserve the same galvanic,
authority, test, and failure boundaries. Users do not open the enclosure. No primary hit indication depends on an
ESP32 task, W5500 transaction, or serial display refresh completing.

### 3.3 Weapon-facing analog front end

The scoring domain receives seven named conductors: left A, B, and C; right A, B, and C; and piste. Each conductor has
documented protection, observability, and the acquisition functions required for its role so a schematic repetition
cannot hide a conductor swap. Electrical equivalence is required only where the weapon model requires it.

Each channel provides:

- connector-side ESD and current limiting;
- a fail-off excitation/source switch;
- a protected high-impedance sense path;
- a protected comparator path for edge capture and an ADC path for resistance and context measurement;
- a controlled sink or relation-test path where the weapon model requires it;
- input and reference test points; and
- an explicit unavailable result for saturation, contradictory readings, invalid calibration, or rail failure.

The STM32 uses a weapon-specific phase scheduler rather than energizing multiple unknown paths at once. Hardware
comparators timestamp fast transitions through timer capture; ADC/DMA observations classify resistance, target, ground,
and fault context. A candidate qualifies only when its timing and electrical context agree. A slower bounded health
sweep checks references, leakage, unused relations, and cross-line faults without delaying a weapon-critical phase.
Source and sink controls are mutually exclusive unless a reviewed weapon phase requires both. Reset, boot, watchdog,
and unpowered states leave all excitation fail-off and all scoring outputs inactive.

The exact ADC topology and component choices remain schematic decisions. The selected design must resolve the complete
resistance range, uncertainty, scan time, crosstalk, and common-mode cases required by the weapon specification. A
digital threshold without measured error margin is insufficient.

### 3.4 Processing and memory

| Function | Proposed implementation class | Minimum behavior |
| --- | --- | --- |
| Scoring controller | STM32G474RET3TR | Use its timer capture, ADC, comparator, op-amp, DMA, GPIO, and watchdog resources; complete scoring while the ESP32-S3 is reset or absent |
| Application controller | ESP32-S3-WROOM-1-N16R8 module with 16 MB flash and 8 MB PSRAM | Own workflow, display, IR, W5500 Ethernet, USB service, Bluetooth P3, storage, and signed A/B updates; restart independently without clearing an STM32 latch |
| Remote controller | Low-power MCU, IR emitter, protected battery, and USB-C charging | Authenticated command frames, long sleep life, and locally recoverable pairing |
| Rules/configuration storage | Signed scoring image plus nonvolatile calibration accessible to the scoring controller | T2016 table compiled into the signed image; separately protected calibration and boot identity |
| Bout/event storage | Nonvolatile memory in the application domain | Atomic current snapshot plus a bounded diagnostic and operator-event journal |

The STM32G474 and ESP32-S3 selections are product decisions. A package, module, or silicon revision substitution requires
an explicit compatibility review and repeated target timing, analog, reset, security, radio, and recovery evidence.
ESP32 internal SRAM holds scoring-link, clock-correlation, authority, and command state; PSRAM is limited to noncritical
UI assets, display buffers, and bounded diagnostics.

### 3.5 Scoring-to-application link

The processors communicate through an isolated 2 Mbit/s full-duplex UART using DMA, COBS framing, a fixed 512-byte
maximum decoded frame, and CRC32C. Every frame contains a protocol version, direction, message type, length, sender boot
identity, sequence number, payload, and integrity check. The receiver rejects malformed, oversized, out-of-order, stale,
duplicate, wrong-direction, and unsupported frames.

Two additional fail-low isolated signals cross from the STM32 domain to the ESP32 domain. `HIT_STOP` pulses once for the
first qualified hit in a scoring cycle that requires the bout clock to stop; the ESP32 timestamps the edge and later
associates it with the authoritative decision frame. `SCORING_AVAILABLE` reports that the STM32 has completed its boot,
configuration, calibration, clock, rail, and acquisition checks. UART traffic alone cannot assert either signal. There
is no ESP32-controlled STM32 reset, boot-mode, debug, or primary-output line.

The scoring controller emits decisions, latch state, rearm results, selected weapon, diagnostics, health, and heartbeat.
The application controller may request weapon selection, manual or configured automatic rearm, lamp test, scoring reset,
and approved configuration load. There is no inbound command that supplies a hit classification, scoring timestamp, or
primary lamp state.

Link loss leaves an existing hit latched. The scoring controller continues scoring if its approved configuration and
local outputs remain healthy. Application controls that require a scoring acknowledgement become unavailable rather
than assuming success.

### 3.6 External inputs

| Input | Proposed physical interface | Purpose and ownership |
| --- | --- | --- |
| Left weapon A/B/C | Standard three-contact fencing body-cord socket | Scoring-domain acquisition only |
| Right weapon A/B/C | Standard three-contact fencing body-cord socket | Scoring-domain acquisition only |
| Piste/earth | Dedicated keyed or clearly labelled low-voltage connector | Grounded-material classification and diagnostics |
| Local controls | Protected buttons or encoder on the front/display board | Application workflow and service access |
| Referee remote | Paired encrypted infrared command link | Authenticated application commands; never hit facts |
| Ethernet | W5500 SPI Ethernet controller and shielded RJ45 with isolation magnetics | Cyrano, service, and read-only state clients in the application domain |
| USB-C | USB-C PD sink with USB 2.0 service data | Normal power, local update, diagnostics, and recovery |
| RS422 receiver | Not fitted in the base apparatus | A display/repeater accessory may provide FPA input at P2 |

No connector exposes weapon conductors to USB, Ethernet shield, application ground, or an external power-source return
without the approved isolation path.

### 3.7 External outputs

| Output | Proposed physical interface | Behavior |
| --- | --- | --- |
| Red and green valid-hit lamps | Direct scoring-controller drivers | Latch from immutable scoring decisions and remain until rearm/reset |
| Left/right white lamps | Direct scoring-controller drivers | Foil off-target or weapon-specific diagnostic behavior |
| Yellow/orange diagnostics | Direct scoring-controller drivers where selected | Report insulation, earth, or control faults; never imply a hit |
| Primary buzzer | Scoring-controller request and independent power driver | Starts with the hit and follows weapon-specific duration |
| Score/clock display | Internal display bus from application controller | Presents workflow state; failure cannot suppress primary lights |
| Wired light repeater | Protected, isolated accessory connector | Repeats primary lamp state with published voltage/current limits |
| RS422-FPA | Isolated DB9 transmitter | Emits FPA 3.04a at 38400 baud, 8 data bits, no parity, one stop bit |
| Ethernet | RJ45 | Sends Cyrano INFO and read-only product state; accepts only permitted commands |
| USB service | USB-C | Local diagnostics, signed update, and recovery; no weapon data authority |

### 3.8 Power and charging

The apparatus contains no direct mains voltage and no battery. Its one product power input is USB-C. The internal
architecture derives the isolated, monitored scoring,
application, display, and output rails required by the intended FIE power arrangement.

| Power path | Proposed behavior |
| --- | --- |
| USB-C PD | Sink-only 20 V/3 A SPR input. Protect VBUS/CC/data, current-limit the input, and convert to the regulated internal bus. No source or dual-role behavior. |
| Source connection | Connecting, disconnecting, or losing USB-C power must not create a false hit. |
| Apparatus charging | None. The apparatus does not contain a battery charger or charge an external pack. |
| Remote charging | Charging-only USB-C 5 V sink, protected single-cell charger, charge-temperature inhibit, and internal rechargeable battery. |

The production apparatus ships with a compliant 60 W USB-C supply and cable. A replacement source must offer the same
20 V/3 A contract. Default USB power and lower contracts do not arm the apparatus; local update and recovery require an
approved powered USB-C service host or dock. Final production power budgeting must measure simultaneous maximum display,
lamp, buzzer, networking, and accessory load with margin before this input rating is frozen.

Brownout or invalid rails place new scoring acquisition into `unavailable` and drive excitation safe-off. An already
latched hit may remain in nonvolatile evidence, but total power loss never restores or reasserts primary lamps, sound, or
a live hit. Boot always starts unavailable and unarmed; an operator may restore a complete bout snapshot and then
explicitly rearm scoring. A brownout never creates a hit.

### 3.9 Mechanical and operator-facing design

- Wall mounting uses VESA 100 x 100 or an adapter plate with an anti-lift retention feature.
- The tabletop pedestal keeps the face upright without leaning on a rear leg and remains stable with all body cords
  attached.
- Body-cord and piste connectors are reachable from the front or lower edge without hiding the display.
- Power, Ethernet, FPA, and repeater cables exit separately from weapon cables.
- The enclosure permits cleaning with ordinary venue procedures and prevents routine access to the PCB.
- The front face remains readable from either end of a standard piste and the primary lights remain visible from above.

## 4. Scoring and bout behavior

### 4.1 Scoring authority

| State or action | Authority |
| --- | --- |
| Analog observations and uncertainty | Acquisition front end in the isolated scoring domain |
| Hit qualification, classification, signal time, and lockout | Deterministic scoring controller |
| Primary lights and hit sound | Scoring controller and its output drivers |
| Score, countdown, cards, priority, period, and fencer identity | Application bout workflow |
| Referee bout-control commands | One active referee controller, workflow guards, and scoring acknowledgement when required |
| Tournament assignment and validation | Separately authorized Cyrano/local competition workflow while the machine is waiting or ending |
| Repeater and external display | Read-only projection of authoritative state |

A referee, remote, app, or tournament system may correct the displayed score because scoring apparatuses do not decide
right of way. None may add a physical weapon hit, alter its classification, move its timestamp, or suppress an already
latched primary indication.

### 4.2 Common scoring sequence

1. Boot into safe inactive with excitation and outputs off.
2. Load and validate calibration, the immutable T2016 timing table, and scoring firmware identity.
3. Acquire named conductor relations with resistance and timing evidence.
4. Start, continue, reset, qualify, or reject a weapon-specific candidate.
5. On the first qualified hit, latch the applicable output and open the opposite-side window.
6. Accept an eligible second-side hit inside that window and ignore later hits.
7. Keep the decision, lights, and required diagnostics latched until the scoring controller accepts rearm or reset.
8. Emit the decision and resulting state to the application controller and external read-only projections.

Unavailable or contradictory evidence is never normalized into a favorable hit. Changing weapons while a candidate,
open window, or latched hit exists requires an explicit scoring rearm/reset transition.

### 4.3 Weapon summary

This table is an implementation summary. The detailed
[weapon-scoring programming specification](weapon-scoring-programming-specification.md) and its FIE references control
all endpoints, resistance cases, and unresolved interpretations.

| Weapon | Qualification | Opposite-side window | Required classification and special behavior |
| --- | --- | --- | --- |
| Foil | Meet the FIE 14 ms +/- 1 ms qualification envelope under the approved resistance policy | Meet the FIE 300 ms +/- 25 ms opposite-side window | On-target red/green, off-target white, no right-of-way decision, anti-blocking and insulation diagnostics |
| Epee | Never register below 2 ms and reliably register by 10 ms under the approved resistance policy | Use one deterministic opposite-side boundary within the FIE 40 to 50 ms envelope | Double hit only when both independently qualify; reject guard, piste, and grounded material |
| Sabre | Never register below 0.1 ms and reliably register by 1 ms under the approved resistance policy | Meet the FIE 170 ms +/- 10 ms opposite-side window | No off-target hit; track blade contact and 0/4/15 ms whipover history; independent yellow/white diagnostics |

The production comparator values are internal, immutable, and selected only after measured clock, acquisition, analog,
temperature, and fixture uncertainty show that the complete apparatus meets these envelopes. They are not user timing
profiles. For every weapon, test just below, at, and just above qualification, lockout, resistance, and diagnostic
boundaries on both sides and in both hit orders.

### 4.4 Primary indications

- Red and green valid-hit outputs identify the configured sides and remain latched until reset.
- Foil off-target drives the applicable white lamp and the normal hit sound.
- Sabre white and yellow conditions are diagnostics defined by the weapon rules, not foil off-target hits.
- Epee provides valid-hit lamp paths for each side that remain independent of the application/display domain.
- Lamp test exercises physical outputs without creating a decision or score.
- Ordinary hit sound is P0 and follows the weapon-specific duration. The separate FIE disconnected-audio system is not
  part of the base apparatus; if later supplied for homologation, it must provide the required 80 to 100 dB at piste
  centre for 2 to 3 seconds without stopping the clock or blocking the central apparatus.
- Extension outputs reproduce a latched state but cannot feed a new state into the scoring controller.

### 4.5 Bout workflow

The application owns the countdown and referee-managed bout state. Scoring timestamps remain a separate monotonic
domain.

| Workflow | Required behavior |
| --- | --- |
| Score | Independent left/right values, zero floor, explicit correction, optional automatic epee increment |
| Clock | Configured load, start/stop, bounded correction, and final-ten-second display precision |
| Break/medical/overtime | Separate modes that preserve the configured bout duration and cannot run simultaneously |
| Priority | Unbiased assignment plus an explicit audited supervisor override |
| Cards | Yellow, red with atomic opponent point, and rules-valid P-card state |
| Passivity | One authoritative elapsed timer with explicit expiry, acknowledgement, and clear behavior |
| Period/team | Typed individual period or team round, never an ambiguous display-only number |
| Side swap | Atomic swap of score, cards, priority, fencer identity, and presentation |
| Undo | Compensating event for a reversible referee action; immutable scoring decisions remain unchanged |
| New bout | Guarded operation while stopped; creates a new bout identity and requests scoring reset |

Destructive configuration, full reset, snapshot load, weapon change, and score clear are rejected while the countdown
runs. Every accepted or rejected control action produces immediate apparatus feedback.

### 4.6 Scoring-to-clock stop contract

The scoring and application controllers share a continuously checked monotonic-clock correlation. Every qualified
decision carries a scoring boot identity, decision sequence, scoring-cycle identity, and signal timestamp. When a
qualified hit requires the bout clock to stop, the application maps that signal timestamp into its bout-clock domain;
it does not subtract communication or display latency from the fencer's remaining time.

The required order is `scoring.decision`, `bout.clock.stopped`, then the resulting `bout.state.changed`. The clock-stop
event identifies the causing scoring cycle. A second qualified hit in the same open window joins that cycle and does not
stop the clock again. The mapped stop instant must be accurate within 10 ms, and the apparatus must visibly show the
stopped state within 100 ms of receiving the decision. These bounds require target-hardware evidence.

If clock correlation is missing, stale, outside its error budget, or invalidated by an application reset, the
application stops presenting a running clock and shows clock unavailable. It may restore a complete checksum-valid bout
snapshot for referee review, but it does not resume the countdown or infer elapsed time. Cyrano and FPA project the same
authoritative stopped time and running state; they never maintain an independent countdown.

## 5. Controls, display, and referee remote

### 5.1 Front display and local controls

The normal face follows the familiar commercial layout: left and right hit indications at the outer edges, large score
digits, a central clock, and smaller weapon, period, card, passivity, priority, power, remote, and network state. Hit
lights remain visually dominant over configuration or connectivity information.

Local controls provide power/wake, lamp test, pairing entry, and a bounded configuration menu. Routine fencing should
not require opening a menu. A service menu cannot be entered while the bout clock runs or while a scoring result is
latched.

The display supports:

- left/right score, clock, final-ten-second precision, period/round, priority, cards, and passivity;
- weapon and T2016 rules identity;
- remote received, accepted, rejected, and low-battery indications;
- line fault, scoring unavailable, network status, input voltage, and firmware identity;
- mirrored/rotated mounting presentation without changing scoring-side identity; and
- optional P2 timeline/review presentation that cannot obscure live primary indications.

### 5.2 Remote product

The supplied remote is a dedicated one-handed controller with tactilely separated buttons and a charging-only USB-C
port. Its primary transport is an encrypted, paired infrared command link, matching the dedicated handheld approach
documented for Favero FA-15, FA-07, FULL-ARM-05, Skewered, and VSM. Optical delivery is only the transport: command
authentication, pairing, freshness, and replay prevention remain mandatory.

| Property | Requirement |
| --- | --- |
| Range | Prototype target: at least 20 m frontal with adjacent-piste rejection and declared interference conditions |
| Latency | Product requirement: at most 100 ms; 70 ms is an engineering stretch target |
| Battery | Rechargeable single-cell battery; 300 operating hours is a stretch target published only after measured-profile validation |
| Charging | USB-C 5 V sink, no data and no USB PD requirement, protected charge path and temperature inhibit |
| Pairing | Available only during a physically initiated pairing window on the apparatus |
| Identity | Unique remote and apparatus identities; no fleet-wide default command key |
| Replay protection | Persistent monotonic counter or equivalent reviewed anti-replay construction |
| Feedback | Remote LED means transmitted; apparatus feedback means accepted or rejected |
| Failure | Lost, noisy, flooded, depleted, or reset remote leaves all box state unchanged; a paired spare remote is the first-product fallback |

The remote transmission LED proves only that the handheld emitted a frame. The apparatus is the only indicator that a
command was received, authenticated, and accepted by the workflow.

Exactly one referee-control interface has bout-control authority at a time. The handheld normally holds that role;
companion applications remain read-only unless an explicit supervisor action transfers it. A separately authorized
tournament interface may assign or validate a match, but it cannot use that role to change score, clock, cards, or
scoring state. Pairing a device does not automatically transfer either authority.

### 5.3 Remote face

| Left | Centre | Right |
| --- | --- | --- |
| Left score `+` | `Start/Stop` | Right score `+` |
| Left card | `Pause 1 min` | Right card |
| Left score `-` | `+Time` | Right score `-` |
| `Back` | `OPT` | `Rearm` |
| `Reset Cards` | `-Time` | `Load Time` |

### 5.4 Remote button actions

A direct press performs the printed action. Hold `OPT`, press the other control, then release it for the modified
action. A held or double action emits once and never auto-repeats. Guarded operations are accepted only while the
countdown is stopped and after the apparatus shows the operation's scope.

The [referee remote button reference](../remote-control-button-reference.md) is the canonical native command-key and
acceptance-test lookup. This table defines the same behavior in product terms.

| Position/button | Direct action | `OPT`, held, or double action | Guard and result |
| --- | --- | --- | --- |
| Top left, Left score `+` | Add one left score. | Reserved. | Allowed bout modes only. |
| Top centre, `Start/Stop` | Toggle the bout clock. | Reserved. | Direct; passivity follows the accepted clock transition. |
| Top right, Right score `+` | Add one right score. | Reserved. | Allowed bout modes only. |
| Second left, Left card | Preview the next rules-valid yellow/red state selected by the referee. | `OPT`: preview the next rules-valid left P-card. | A second confirmation applies it; red and the opponent point are atomic. Black-card/exclusion remains a supervisor action. |
| Second centre, `Pause 1 min` | Start a one-minute break. | `OPT`: preview one-minute overtime with random priority. Held: medical clock. | Countdown must be stopped; overtime requires visible confirmation. Priority correction remains in the supervisor interface. |
| Second right, Right card | Preview the next rules-valid yellow/red state selected by the referee. | `OPT`: preview the next rules-valid right P-card. | A second confirmation applies it; red and the opponent point are atomic. Black-card/exclusion remains a supervisor action. |
| Third left, Left score `-` | Remove one left score. | Reserved. | Reject at zero. |
| Third centre, `+Time` | Add one second, or one hundredth while stopped in the final ten seconds. | `OPT`: advance the configured period/round. | Countdown must be stopped. |
| Third right, Right score `-` | Remove one right score. | Reserved. | Reject at zero. |
| Fourth left, `Back` | Undo the latest reversible referee workflow action. | `OPT`: swap left/right workflow state. | Never rewrites an electrical decision. |
| Fourth centre, `OPT` | Preview weapon; a second standalone press in the selection window advances the proposal. | Modifier for another button. Hold alone opens configuration after the approved threshold. | Weapon change requires a stopped clock, no candidate or latch, visible proposed weapon, and scoring-controller acknowledgement. A chord never also emits the standalone action. |
| Fourth right, `Rearm` | Request manual scoring rearm. | `OPT`: advance auto-rearm through manual, one, three, and five seconds. | Requires scoring-controller acceptance. |
| Bottom left, `Reset Cards` | Preview clearing card presentation. | Held: confirm the preview. `OPT`: guarded new bout. | Countdown stopped; no card is cleared on the first press. Sleep remains a local-menu action. |
| Bottom centre, `-Time` | Remove one second, or one hundredth while stopped in the final ten seconds. | `OPT`: retreat the configured period/round. | Countdown stopped; floor zero. |
| Bottom right, `Load Time` | Load the configured starting time. | `OPT`: cycle reviewed time presets. Double: load one minute. | Countdown stopped; actual preset values are configured locally and invalid or absent values are rejected. |

Complete snapshot load, manual priority override, detailed timeline review, pairing, venue configuration, and service
diagnostics stay in the authenticated local or tournament interface. Cyrano `NEXT`, `PREV`, `BEGIN`, and `VALIDATE`
are presented by the tournament control screen; the first handheld does not overload routine fencing buttons with a
hidden tournament profile.

## 6. Communications, events, and state authority

### 6.1 Information classes

The product uses five simple information classes:

| Class | Meaning |
| --- | --- |
| Command | A request to perform an action. It has not happened merely because it was received or authenticated. |
| Command result | Accepted or rejected, with command identity, reason, and resulting state revision. |
| Authoritative event | An immutable scoring or workflow fact emitted by the subsystem that owns it. |
| State snapshot | The current complete state used for display, reconnect, and protocol refresh. |
| Telemetry | Health, power, version, diagnostic, or performance data that does not alter scoring. |

Native interprocessor, remote, local-service, and companion commands have a unique identity and produce one result. A
duplicate native command returns the existing result instead of executing again. Cyrano and FPA retain their specified
wire formats and use protocol-specific state, content, and idempotency rules instead of invented command identifiers.
All inputs are bounded in size and rate. Unknown fields, unsupported versions, and invalid values are rejected before
state mutation.

### 6.2 State ownership

| State | Authoritative owner | Permitted external input |
| --- | --- | --- |
| Conductor observations | Scoring acquisition | Calibration and approved profile only |
| Hit, classification, scoring timestamp, and lockout | Scoring controller | None |
| Primary lights and hit sound | Scoring controller | Rearm/reset request only |
| Selected weapon | Scoring controller | Validated weapon request while safely rearmed |
| Score, clock, cards, priority, and period | Application workflow | Active referee-controller commands only |
| Fencer/competition identity | Application workflow | Valid Cyrano `DISP` or authorized local entry |
| Referee bout-control authority | Application workflow | Explicit local supervisor transfer |
| Tournament assignment/validation authority | Competition workflow | Explicit local competition-mode enable and permitted Cyrano peer |
| Repeater/finals presentation | None; read-only projection | Authoritative snapshot/events only |

### 6.3 Protocol support

| Protocol/interface | Transport and direction | What the apparatus sends | What the apparatus accepts | Priority |
| --- | --- | --- | --- | --- |
| Scoring link | Isolated point-to-point binary, bidirectional | Decisions, outputs, lockout, diagnostics, health, acknowledgements | Whitelisted weapon, rearm, reset, lamp-test, and configuration requests | P0 |
| Referee remote | Encrypted paired infrared, inbound only | Nothing | Authenticated referee commands and battery telemetry | P0 |
| Cyrano EFP1.1 | UDP port 50100, bidirectional | `INFO`, `NEXT`, `PREV` | `HELLO`, `DISP`, `ACK`, `NAK` | P1 |
| RS422-FPA 3.04a | Isolated RS422 transmitter, 38400 8N1 | Messages 1 through 9 | Nothing on the base transmitter | P1 |
| Wired light repeater | Protected isolated lamp-state output | Red, green, and both white states | Nothing | P1 |
| Local service | USB 2.0 and authenticated Ethernet | State, logs, versions, diagnostics, update result | Configuration, test, signed update, and recovery commands | P1 |
| Companion state | Authenticated LAN | Read-only state only | Nothing | P2 |
| Bluetooth mobile app | Authenticated Bluetooth, bidirectional | Read-only state by default | Control only after explicit authority transfer | P3 |

EFP1.1 and FPA are targeted implementations until their conformance tests and named-system interoperability tests pass;
the product does not advertise a broader compatibility claim. The ESP32-S3 module and antenna layout are fitted at P0,
but Wi-Fi is disabled in the baseline product and Bluetooth remains disabled until the P3 application and qualification
exist.

### 6.4 Events emitted by the product

Every native event uses a common envelope containing schema version, owning subsystem, sender boot identity, event
sequence, monotonic timestamp, and event identity. Workflow events also carry the resulting state revision. Caused
events carry the initiating command or scoring-cycle identity. A scoring cycle starts with the first qualified decision,
contains one or two immutable side decisions, remains open only for the weapon's opposite-side window, and ends in
lockout/rearm. It is never reconstructed by comparing application receive times.

| Event | Owner | Required information | Primary consumers |
| --- | --- | --- | --- |
| `scoring.decision` | Scoring controller | Scoring-cycle ID, weapon, side, classification, signal time, rules/timing identity, evidence range | Primary outputs, application, journal |
| `scoring.lockout.changed` | Scoring controller | Scoring-cycle ID, transition, current open/closed state, first side, and transition time | Application diagnostics |
| `scoring.rearm.result` | Scoring controller | Request ID, accepted/rejected, cause, resulting armed state | Active referee controller and display |
| `scoring.diagnostic.changed` | Scoring controller | Side, conductor/condition, resistance bucket, persistence | Lamps, display, service |
| `scoring.availability.changed` | Scoring controller | Available/unavailable and reason | Display, protocols, service |
| `output.primary.changed` | Scoring controller | Red, green, whites, diagnostics, sound, latch | Physical outputs and repeaters |
| `bout.clock.stopped` | Application workflow | Causing scoring-cycle ID, mapped stop instant, remaining time, and correlation error bound | Display, Cyrano, FPA, journal |
| `bout.state.changed` | Application workflow | Score, clock, mode, period, priority, cards, passivity, identities, revision | Display, Cyrano, FPA, observers |
| `command.result` | Applying subsystem | Command ID, source, accepted/rejected, reason, resulting revision | Remote feedback, controller, journal |
| `referee.authority.changed` | Application workflow | Referee-controller identity/kind and authority revision | Referee control interfaces |
| `tournament.authority.changed` | Competition workflow | Competition mode, peer identity, piste/competition binding, and authority revision | Tournament interface and display |
| `system.health.changed` | Owning processor | Boot/reset reason, firmware, link, power, storage, and network health | Local display and service |
| `power.state.changed` | Power/application service | Source, voltage/PD state, warning, shutdown reason | Display and service |
| `remote.state.changed` | Remote service | Paired identity, received counter, battery status, signal diagnostics | Local display and service |

External protocols receive only the fields they define. Diagnostic detail that does not fit Cyrano or FPA remains in
the local service interface.

### 6.5 Commands ingested by the product

| Command family | Accepted sources | Required guard | Result |
| --- | --- | --- | --- |
| Score and ordinary clock control | Active handheld or authorized local/companion referee interface | Correct referee-authority revision and valid bout mode | Application state event or rejection |
| Cards, priority, break, medical, and period | Active referee controller | Rules-valid state and applicable stopped-clock guard | Atomic workflow event or rejection |
| Weapon selection | Active referee controller or approved Cyrano assignment | No candidate or latch; scoring controller available | Scoring acknowledgement then state change |
| Rearm/reset | Active referee controller | Request type and permission appropriate to current scoring state | Scoring acknowledgement or rejection |
| New bout/snapshot | Local supervisor | Countdown stopped, complete valid state, no pending scoring request | New bout revision or rejection |
| Tournament assignment/validation | Permitted Cyrano peer or local competition workflow | Competition mode, protocol state, piste/competition binding, and valid complete payload | Assignment/validation event or protocol-defined ignore/rejection |
| Referee-controller transfer | Local supervisor | Target authenticated and no pending scoring request | Atomic referee-authority revision |
| Configuration | Local authorized service | Safe idle and compatible hardware/rules revision | Persisted configuration or rejection |
| Firmware update | Local authorized service or approved updater | Signed compatible artifact and safe update state | Booted new version or rollback |

The apparatus never ingests an external `scoring.decision`, primary hit-lamp command, or scoring timestamp as a live
fact.

### 6.6 Cyrano EFP1.1 behavior

The targeted implementation follows the pinned
[Cyrano 1.1 specification](protocols/cyrano-protocol-1.1-2019-10-11.pdf). It uses UDP port 50100 by default and allows
a venue-configured port. Cyrano is enabled only through a visible local competition mode with configured piste and
competition identities. That mode permits one configured peer address; accepting a different peer or identity requires
local authorization. Stable addresses or reservations keep the piste binding predictable. Cyrano 1.0/EFP1 is not
advertised, negotiated, or accepted as a compatibility mode.

EFP1.1 has no authenticated transport. The apparatus therefore treats the configured competition LAN and peer binding
as an operational trust boundary, not cryptographic proof. The parser accepts datagrams no larger than 2048 bytes,
enforces every specified field length and delimiter, and rate-limits a peer to 20 datagrams per second sustained with a
40-datagram burst. Excess, malformed, wrong-peer, wrong-piste, or wrong-competition traffic is dropped and counted
without consuming scoring resources. The display shows competition mode, connection state, bound piste/competition,
and peer status.

| Message | Direction | Product behavior |
| --- | --- | --- |
| `HELLO` | Software to apparatus | Mark the permitted software peer present and emit a full `INFO`. Turn the connection indication off after 40 seconds without `HELLO`; scoring continues. |
| `DISP` | Software to apparatus | While waiting, validate and load match/round, weapon, identities, and supplied state. Ignore while active as required by Cyrano. |
| `ACK` | Software to apparatus | Approve an ending match/round and transition to waiting. Ignore outside the applicable state. |
| `NAK` | Software to apparatus | Keep the ending state, show rejection, and allow referee correction/resubmission. |
| `INFO` | Apparatus to software | Send changed fields on state change, a full state in response to `HELLO`, and one stopwatch update per second while running; do not send running-clock updates more frequently. Include hundredths when required. |
| `NEXT` | Apparatus to software | Request the next match/round only from the waiting tournament workflow. |
| `PREV` | Apparatus to software | Request the previous match/round only from the waiting tournament workflow. |

`INFO` projects protocol, command, piste and competition IDs, phase, pool/table, match, round, stopwatch, competition
type, weapon, priority, apparatus state, referee, fencer identity, score, status, cards, hit/white lights, medical,
reserve, and P-card fields when known. Unknown optional values remain empty/default as the protocol defines; they are
not fabricated.

The apparatus maintains Fencing, Halt, Pause, Ending, and Waiting protocol states. It emits a full `INFO` after each
`HELLO`, a partial `INFO` on local changes, and an ending `INFO` only after an explicit tournament validate action.
Network loss leaves the current local bout and scoring state unchanged.

### 6.7 RS422-FPA 3.04a output

The isolated transmitter follows the pinned
[RS422-FPA 3.04a specification](protocols/rs422-fpa-protocol-3.04a-2019-05-21.pdf): 38400 baud, eight data bits, no
parity, one stop bit, with the documented DB9 transmit and ground pins. It is output-only in the base apparatus.

| Message | Data projected |
| --- | --- |
| 1 | Red, green, right white, and left white lamps |
| 2 | Bout/break/injury time and running/stopped status |
| 3 | Left/right scores, yellow/red/black cards, priority, period/round, and video requests |
| 4 | Match status, weapon, service call, and doctor/technician call |
| 5 | Optional left competitor ID, name, and nation |
| 6 | Optional right competitor ID, name, and nation |
| 7 | Optional competition, phase, pool/table, and match identity |
| 8 | Passivity timer and left/right P-card state |
| 9 | `NEXT`, `BEGIN`, `VALIDATE`, or `PREVIOUS` tournament control action |

Changed data is sent immediately with message 1 highest priority. Messages 1 through 3 refresh after 1.2 seconds
without a change. Optional messages 5 through 8 refresh after 12 seconds when the selected scheduling option requires
it. Receivers must be able to hot-connect and obtain a current state without affecting the apparatus.

### 6.8 Local and companion interfaces

The local service API exposes current state, bounded logs, self-test, calibration status, firmware identity, update,
and recovery. Configuration and control require local authorization. Read-only live state may be published to displays
and observers, but the rate, client count, message size, and queue depth are bounded so a slow client cannot consume
scoring resources.

The P3 Bluetooth mobile application may provide remote control, timeline review, configuration, and a repeater view.
It is read-only unless it visibly becomes the active referee controller. The product has no required cloud account and
no remote Internet control in the first release.

## 7. Firmware requirements

### 7.1 Common requirements

| Area | Requirement |
| --- | --- |
| Release identity | Every image exposes product, board, firmware, scoring-rules, timing-table, and build identities. |
| Determinism | Weapon scoring uses integer time and bounded work. No network, display, file, or remote operation runs in its critical path. |
| Memory | Critical scoring and parser paths use fixed capacities and defined overflow behavior; allocation failure cannot become a hit. |
| Clocks | Scoring timestamps, bout countdown, and wall-clock metadata remain separate. Clock wrap and reset are tested. |
| Rules artifact | The one approved T2016 timing table is compiled into and authenticated with the signed scoring image; calibration remains a separate protected record. |
| Input validation | All interprocessor, remote, network, configuration, and update inputs are versioned and bounded before use. |
| Watchdogs | Each processor has an independent watchdog and reports its last reset reason after recovery. |
| Logging | Logs are bounded and must not contain pairing keys or update-signing secrets. Logging failure cannot stop scoring. |
| Tests | The same scoring vectors run against the portable scoring core, target firmware, and independent electrical fixture. |

The deterministic scoring core should be portable between host tests and the real-time target. C17 is the current
implementation candidate, but the product requirement is the deterministic interface and evidence, not a language
brand.

### 7.2 Scoring-controller firmware

The scoring firmware shall:

- boot with excitation and primary outputs safe-off;
- validate hardware identity, calibration, the immutable T2016 timing table, and monotonic clock before arming;
- schedule named source, settle, sample, and sink phases for all seven conductors;
- preserve measurement uncertainty, indeterminate observations, and fault provenance;
- implement foil, epee, and sabre candidate, qualification, whipover, lockout, latch, and rearm state machines;
- drive primary red, green, white, diagnostic, and audible outputs without waiting for the application controller;
- accept only whitelisted configuration, weapon, rearm, reset, and lamp-test requests;
- maintain a scoring boot identity and strictly increasing decision sequence;
- enter unavailable rather than guess after reference, calibration, clock, acquisition, rail, or watchdog failure; and
- continue healthy scoring if application display, remote reception, storage, or networking fails.

No diagnostic or lamp-test operation may reuse the live decision path in a way that emits a hit record. A production
test mode is visibly distinct and requires safe idle.

### 7.3 Application-controller firmware

The application firmware shall:

- maintain a complete bout snapshot containing score, countdown, mode, period, priority, cards, passivity, fencer and
  competition identity, referee and tournament authority, and correlated scoring state;
- validate and apply referee commands atomically;
- render the local display and generate non-hit control sounds;
- receive and authenticate the remote, deduplicate transmissions, and report acceptance or rejection;
- implement Cyrano, FPA projection, service, and bounded read-only client interfaces;
- persist configuration, the current bout snapshot, and a bounded event/diagnostic journal;
- restore only complete, checksum-valid state after power loss;
- supervise scoring-link health without attempting to replace the scoring controller;
- perform signed updates, compatibility checks, health confirmation, and rollback; and
- expose useful local diagnostics without requiring an Internet service.

The initial ESP-IDF task partition keeps Ethernet, Cyrano, FPA, Bluetooth, USB, update, and storage services on one core
and keeps scoring-link reception, hit-stop capture, clock correlation, bout workflow, IR command processing, and display
state on the other. Target scheduling evidence, not the core number itself, controls the final pinning. Scoring-link,
clock, authority, and command state use internal SRAM and fixed-capacity queues; PSRAM is non-authoritative. Wi-Fi is not
enabled in the baseline firmware. W5500, display, storage, Bluetooth, or USB saturation must not delay hit-stop capture
or mutate an STM32 decision.

Undo uses the bounded journal to apply a new compensating workflow event. The journal is not the only copy of current
state and is not an unbounded event-sourcing system.

### 7.4 Remote firmware

The remote firmware shall:

- scan the complete key matrix with diode-supported ghost prevention;
- emit exactly one command for each direct, modified, held, or double gesture;
- ensure an `OPT` chord does not also emit the standalone `OPT` action;
- encrypt and authenticate every command for the paired apparatus;
- preserve anti-replay state across reset, depleted battery, and interrupted persistence;
- retransmit only within a bounded delivery window using the same command identity;
- include battery status without trusting it for command authorization;
- inhibit transmission during reset and invalid key-matrix states;
- enter low-power sleep between uses; and
- show local transmission, charging, charged, and low-battery states without claiming command acceptance.

### 7.5 Persistent state and power-loss recovery

The application writes state using an atomic two-copy or transactional scheme. A write is complete only after content,
version, length, sequence, and integrity metadata are durable. At boot, the application selects the newest complete
compatible snapshot; it never combines fields from two incomplete records.

Scoring decisions carry scoring boot and sequence identities so an application restart cannot replay an old decision as
new. A command result is durable before a destructive command is acknowledged where duplicate execution would matter.
Remote counter updates reserve values ahead or use an equivalent scheme that prevents nonce/counter reuse after power
loss.

An application-only restart may resynchronize to a still-powered scoring controller and its existing latch. After total
power loss, historical hit evidence may be retained for review, but primary lamps and sound remain off, scoring remains
unarmed, and the operator chooses whether to restore the last complete bout snapshot or begin a new bout.

### 7.6 Firmware update and recovery

| Component | Normal update | Recovery behavior |
| --- | --- | --- |
| Application controller | Signed A/B image through local USB or approved network updater | Bootloader selects the previous healthy image after failed boot/health confirmation; physical local recovery remains available |
| Scoring controller | Signed image delivered through the application or service fixture only while safely unavailable | Keep a known-good bank or immutable recovery loader; never resume until firmware/rules/calibration compatibility passes |
| Remote | No customer field update. Qualified service uses protected SWD/pogo contacts and a signed image. | Failed service programming uses the fixture recovery path; pairing is explicitly re-established if credentials cannot be preserved. |

A release manifest binds compatible application, scoring, remote, rules, timing, hardware, and configuration versions.
An incompatible partial update remains unavailable rather than silently running mixed behavior. Recovery must work with
no cloud account and no production signing key at the venue.

## 8. Faults, calibration, and conformance

### 8.1 Fault behavior

| Fault | Detection | Apparatus behavior | Recovery |
| --- | --- | --- | --- |
| Open/disconnected weapon line | Weapon-phase observations and persistence rule | Show applicable side/line diagnostic; do not create a hit | Correct equipment; automatic clear only under the approved rule |
| Crossed or shorted lines | Contradictory relation or out-of-range measurement | Preserve diagnostic and reject an untrusted candidate | Correct equipment, then explicit or rule-defined clear |
| Piste/guard ground path | Ground-reference phase | Reject prohibited hit and show ground diagnostic where supported | Remove ground path; verify clear |
| ADC/reference/calibration invalid | Rail/reference monitor, range check, or checksum | Scoring unavailable, excitation safe-off | Service/self-test and valid calibration load |
| Scoring-controller reset/watchdog | Hardware supervisor and boot identity change | Primary outputs safe-off during reset; application shows scoring unavailable | Complete scoring self-test, then explicit supervisor rearm |
| Application-controller reset | Heartbeat/link detection | Healthy scoring and existing primary latch continue; workflow controls unavailable | Restore complete snapshot and re-establish link |
| Processor-link loss | Heartbeat timeout or frame failure | Scoring continues locally if healthy; acknowledged controls become unavailable | Link restart and state resynchronization without replaying decisions |
| Display failure | Display watchdog/self-test | Primary lamps and buzzer continue; show service fault where another indicator exists | Qualified service |
| Buzzer/output failure | Electrical self-test or operator test | Show service fault; never synthesize another output as a hit | Qualified service |
| Remote loss/noise/flood | Authentication, rate, queue, and timeout checks | Reject frames; keep bout and scoring state unchanged | Re-aim/retry or use a paired spare/replacement remote; local controls only support pairing and bounded setup |
| Ethernet/Cyrano loss | HELLO timeout/link state | Local bout and scoring continue; show offline state | Reconnect and send current full snapshot |
| Input power low/brownout | Rail supervisors and PD/DC telemetry | Warn when margin remains; safe unavailable/reset below the verified limit; no false hit | Restore approved source and run recovery checks |
| State-storage corruption | Integrity/version failure | Do not load partial bout state; permit fresh bout or authorized recovery | Recover last complete snapshot or start a new bout |
| Invalid firmware/update | Signature, compatibility, and boot health checks | Do not boot or arm the invalid image | Automatic rollback or physical local recovery |

Fault indicators are not scoring lamps and do not automatically award, remove, or correct a point. The operator must be
able to distinguish unavailable scoring from an ordinary open weapon circuit.

### 8.2 Calibration

Factory calibration covers every weapon conductor, excitation path, sense path, reference, ADC/comparator range, and
timing source. The stored record includes apparatus serial number, hardware revision, calibration revision, date,
fixture identity, per-channel corrections, measured uncertainty, and integrity check.

The product shall:

- reject missing, corrupt, wrong-board, or out-of-range calibration;
- perform a non-invasive reference and line sanity check at boot;
- expose calibration status and revision in local service information;
- retain calibration through ordinary firmware updates;
- provide a controlled service recalibration procedure; and
- verify that calibration and temperature drift preserve the FIE boundary decisions across the declared environment.

Routine users cannot edit raw scoring thresholds. Training features may change rearm and workflow behavior, but they
never change T2016 touch qualification, opposite-side windows, lockout, or factory analog calibration.

### 8.3 Minimum conformance tests

| Area | Required evidence |
| --- | --- |
| Weapon timing | Below, at, and above every qualification, double-hit, lockout, diagnostic, and whipover boundary for both sides |
| Resistance and grounding | Boundary sweeps for target, off-target, guard, piste, own-equipment, cross-line, and open-circuit cases |
| Sabre whipover | Physical and simulated sequences at zero, ten, and eleven interruptions across the applicable timing regions |
| Primary outputs | Correct side/color, independence from the application/display domain, latch/reset, sound onset/duration, lamp test, and repeater projection |
| Clock/workflow | Start/stop, correction, final-ten-second precision, cards, P-cards, priority, passivity, breaks, undo, side swap, and new bout |
| Remote | Every button/gesture, 20 m range, adjacent-piste rejection, 100 ms delivery bound, battery warning, replay/corruption/flood rejection, spare-remote procedure, and pairing recovery |
| Cyrano | EFP1.1 message/state conformance, 40-second HELLO expiry, running-clock cadence, parser/rate/peer controls, followed by named compatibility qualification against Fencing Time and other selected systems |
| FPA | Byte/message conformance, refresh scheduling, hot connection, and named receiver compatibility qualification |
| Power | Shipped and replacement 20 V/3 A source/cable, inadequate contracts, maximum simultaneous load, disconnect, brownout, scoring noise, and no false output |
| Update/recovery | Good update, incompatible update, interrupted write, failed boot, rollback, physical offline recovery, and qualified-service remote programming |
| Installation | Wall retention, tabletop anti-tip behavior, connector strain, visibility, transport, and declared drop test |

Software tests are necessary but do not replace an independent electrical fixture observing physical lamp, buzzer, and
protocol outputs. Public repository tests and successful fencing sessions are prior art, not conformance evidence.

## 9. Open decisions

| Decision | Proposed direction | Status |
| --- | --- | --- |
| Main apparatus battery | No built-in battery or charger; the apparatus has one USB-C power input | Selected for this proposal |
| USB-C power contract | Require 20 V/3 A SPR and ship a compliant 60 W supply/cable; freeze only after measured maximum-load budgeting | Selected pending production power validation |
| Remote transport | Encrypted paired infrared command link | Selected for this proposal |
| Remote field update | No customer field update; qualified service uses protected SWD/pogo contacts | Selected for the first product |
| FIE radio start/stop system | Do not include it in the product baseline unless SEMI confirms that the separate 810-960 MHz two-remote clock system is required for the intended approval | Homologation clarification required |
| Scoring/application processors | STM32G474RET3TR scoring controller and ESP32-S3-WROOM-1-N16R8 application module | Selected for this proposal |
| Processor link | Isolated 2 Mbit/s UART with DMA, COBS, CRC32C, bounded frames, `HIT_STOP`, and `SCORING_AVAILABLE`; no ESP32 reset control over STM32 | Selected for the first hardware design |
| Analog conversion | Seven protected conductor cells with comparator edge capture, ADC/DMA context measurement, and weapon-specific phased acquisition | Architecture selected; excitation and analog component values open |
| Ethernet controller | W5500 on a dedicated ESP32-S3 SPI host with isolated-magnetics RJ45 | Proposed; schematic and interoperability qualification open |
| Main display | Efficient high-visibility LED segments/matrix sized to the stated digit targets | Technology and supplier open |
| Ordinary buzzer level | Adjustable commercial level while preserving the separate FIE disconnected-audio requirement | Acoustic target open |
| Optional epee orange lamps | Include if they improve service diagnostics without confusing primary indications | Industrial-design review open |
| Internal scoring thresholds | Select immutable comparator values only after the complete measured uncertainty budget proves the FIE T2016 envelopes | Engineering validation open |
| Homologation claim | Build evidence toward FIE conformance; make no claim until physical and procedural acceptance | Open release decision |
| Timeline/replay | Preserve enough bounded evidence in P1 hardware; ship operator review UI at P2 | Proposed |
| Bluetooth mobile-app control | Read-only first; exclusive authenticated control at P3 | Deferred from the first release |

## References

- [FIE Material Rules, August 2026](fie-material-rules-2026-08-en.pdf)
- [FIE traceability matrix](fie-traceability-matrix.md)
- [Weapon-scoring programming specification](weapon-scoring-programming-specification.md)
- [Commercial scoring-machine feature catalog](commercial-scoring-machine-feature-catalog.md)
- [Open-source/commercial feature gap analysis](prior-art/open-source-commercial-feature-gap-analysis.md)
- [Fencing-scoring prior-art analysis](prior-art/fencing-scoring-prior-art-analysis.md)
- [GitHub repository catalog](prior-art/fencing-scoring-github-catalog.md)
- [Cyrano 1.1 protocol](protocols/cyrano-protocol-1.1-2019-10-11.pdf)
- [RS422-FPA 3.04a protocol](protocols/rs422-fpa-protocol-3.04a-2019-05-21.pdf)
- [Fencing Time scoring-machine integration guide](protocols/fencing-time-scoring-machine-integration-guide.pdf)
- [FIE wireless start/stop basic radio specifications](protocols/fie-fencing-radio-specifications-rev2.0.pdf)
- [ESP32-S3-WROOM-1/WROOM-1U datasheet](https://www.espressif.com/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf)
- [STM32G474 product and documentation](https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html)
- [W5500 product documentation](https://docs.wiznet.io/Product/Chip/Ethernet/W5500)
- [Referee remote button reference](../remote-control-button-reference.md)
- [Encrypted remote-control contract](../encrypted-ir-remote-control-contract.md)
