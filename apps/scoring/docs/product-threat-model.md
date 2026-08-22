# Product threat model and firmware trust boundaries

**Contract:** M0-11
**Status:** baseline product security and trust-boundary contract for review

This contract covers the scoring apparatus, its two processor domains, isolated link, service interfaces, manufacturing
flow, firmware delivery, and event records. It is read with the [device delivery plan](device-delivery-plan.md),
[processor fault-containment contract](processor-fault-containment-contract.md), [transport-frame
contract](transport-frame-contract.md), [power and reset-state contract](power-reset-state-contract.md), and
[decision-record contract](decision-record-contract.md). The [production board plan](../../../packages/scoring-circuit/docs/production-board-plan.md),
[candidate ESP32 allocation](../../../packages/scoring-circuit/docs/esp32-pin-allocation.md), and [candidate STM32
allocation](../../../packages/scoring-circuit/docs/stm32-pin-allocation.md) are design inputs, not proof that hardware
paths exist.

This document requires security properties but does not choose cryptographic algorithms, signature formats, key
protocols, secure-boot implementation, anti-rollback counter, tamper circuit, storage-authentication format, or
unresolved pin/reset topology. Physical access to a unit, service connector, update medium, venue network, or factory
fixture is an adversarial capability. A denial of service is never a hit, no-hit, reset, or claim of scoring availability.

## Authority and trust zones

The STM32 scoring domain (Z1) is the sole scoring authority after local recovery gates pass. It owns seven-line
acquisition, monotonic sample time, qualification and rejection, lockout, line faults, source decision records, and
primary red, green, white, and buzzer outputs. The ESP32 application domain (Z3) owns presentation, application workflow,
network/BLE/Wi-Fi, identity, storage, replay, non-authoritative time, and update delivery. It may mirror, store, and
render an accepted STM32 record; it cannot create, alter, reorder, clear, or reclassify one.

| Zone | Contents and threat assumption | Boundary rule |
| --- | --- | --- |
| Z0 physical | Body cords, piste, connectors, power, ESD/EFT, enclosure, cables | Observations and faults are untrusted; unsafe or indeterminate acquisition suppresses qualification. |
| Z1 scoring | STM32G474, acquisition, scoring state, outputs, local watchdog/supervisor | Trusted scoring TCB only after self-test, reference, clock, configuration, and safe-output gates. |
| Z2 isolation/link | Isolators, framed SPI, interrupt, heartbeats, reset controls | Treat as untrusted transport; check direction, reset defaults, frame validity, sequence, and authorization at endpoints. |
| Z3 application | ESP32-S3, network stack, display/audio, journal, RTC, identity, updater | Compromise may deny or corrupt application state, never grant scoring authority or direct primary output control. |
| Z4 peripherals/service | W5500, radio, USB-C, UART0, F-RAM/flash, display, audio, field serial, modules | Untrusted inputs and reset faults; enables/chip selects must default inactive. Candidate wiring remains a gate. |
| Z5 venue/network | Ethernet, BLE/Wi-Fi peers, field-serial peers, update servers, remote controllers | Fully untrusted; authentication and authorization are required for control and update. |
| Z6 privileged operations | Build/release, provisioning, factory fixture, authorized service | Least privilege, physical control, attribution, and audit are required; it is not an always-on device trust zone. |

The product invariants are: no network or ESP32 parser runs in the STM32 scoring TCB; a healthy STM32 continues when
application services or the link fail; malformed, missing, duplicated, reordered, corrupt, unknown, or unauthenticated
data is a diagnostic, not a score or reset; and an STM32 reset, brownout, update, failed recovery, or uncertain power
state is `unavailable` with excitation and primary outputs `safeInactive`.

## Assets, actors, and abuse cases

Actors include authorized operators, referees, service technicians, manufacturers, release/provisioning staff, venue or
remote-network peers, compromised ESP32 software, physical attackers, counterfeit suppliers, and non-malicious power,
EMC, connector, and storage faults.

| Asset or actor | Threat and impact | Required mitigation | Planned evidence |
| --- | --- | --- | --- |
| Acquisition, timing, lockout, primary outputs | Physical bridge/short/ground/swap, probe, ESD, brownout, or reset causes false/missed hit, unsafe output, or silent latch clear. | STM32-only authority; physical output and excitation defaults off; classify open, cross-line, grounded, out-of-range, and indeterminate states as faults/non-qualification; reset is not `boutReset`. | M0-10; M4 analog/fixture and M4-13 harness evidence; M5 power/reset schematic; M6-02/M6-04/M6-05/M6-07/M6-10; M7-09. |
| Network, link, and service inputs | A peer injects commands, floods queues, or uses malformed traffic to alter timing, reset STM32, or create a result. | Network parsers stay in Z3; STM32 accepts bounded, manifest-approved, current-state-valid requests with required local confirmation; no automatic application-driven STM32 reset; bound parser and queues. | M2-06/M2-07/M2-13; M3-11; M6-07/M6-08; M7-08. |
| Transport and replay | Forged, corrupted, delayed, duplicated, reordered, omitted, or stale frame produces a second score, replacement record, or false current state. | Exact frame/parser boundary in Section 5; expected sequence per direction; reject duplicate/reorder and retain link-degraded state; never buffer, repair, infer, or treat receipt as acknowledgment. CRC-32C detects corruption only, not authenticity. | M0-06; M2-05/M2-06/M2-07/M2-13; M3-05/M3-09; M7-08. |
| Decision records and journal | Partial/corrupt storage is replayed, raw samples are re-decided, or an ESP32 rewrites history. | STM32 creates immutable source record with firmware/boot/revision/capture provenance; ESP32 validates then atomically copies and renders without re-running scoring; partial/unknown records become diagnostics/uncertainty. | M0-05; M2-04/M2-08/M2-11; M3-09; M6-06; M7-08. |
| Firmware and configuration | Unauthorized, wrong-target, stale, or compromised image/configuration changes scoring or recovery. | Target-bound signed image/manifest, compatibility and identity checks, local STM32 authorization for scoring firmware, atomic activation, health gates, last-known-good recovery, and anti-rollback floor. See Section 3. | M3-10; M6-03/M6-07; M7-08; M8-02. |
| Rollback and power loss | Media removal or power loss selects a partial image or silently resumes an interrupted bout. | Stage and verify before activation; retain old valid image; choose only approved image at/above security floor; update makes STM32 `unavailable` and creates new boot identity; no volatile candidate/lockout resume. | M2-08; M3-10; M6-06/M6-07; M7-08/M7-09. |
| Identity and manufacturing | Duplicate identity, leaked provisioning key, counterfeit/substituted part, wrong image, or open debug defeats fleet trust. | Per-apparatus and per-processor identity; controlled provisioning read-back without exporting private keys; serial/lot/image/calibration/test binding; approved-vendor and incoming-inspection controls; failed provisioning is non-releasable. | M6-01/M6-03; M8-01/M8-02/M8-03; M7-08. |
| Physical service and debug | Unauthorized SWD/JTAG/UART/boot access bypasses image or reset controls. | No network-triggered debug; physical authorized service with audit; safe outputs during debug/reset; production lock or authenticated unlock with documented recovery. See Section 4. | M5-04/M5-06; M6-03; M7-08; M8-02/M8-07. |
| ESP32 compromise | A fully compromised app/network/storage/display service invents a hit, clears a lamp, alters time, or resets STM32. | Isolation and directionality; no direct path to acquisition, excitation, primary lamps/buzzer, or scoring reset; STM32 validates requests and continues or becomes unavailable based only on local trust; ESP32 may only report degraded state. | M2-07; M3-09/M3-11; M6-07/M6-08; M7-08. |
| Event privacy and disclosure | Records expose venue, bout timing, service history, or secrets through exports or diagnostics. | Keep names, credentials, private keys, and unnecessary network identifiers out of canonical records; restrict captures/replay/service reports; define retention, export, deletion, and access policy before production. | M2-08/M2-09/M2-11; M6-06; M7-08; M8-07/M8-08. |

High-impact residual risk remains a compromised STM32, modified scoring hardware, or a factory/service authority that
defeats the physical boundary. Application isolation cannot contain those cases; authorized physical recovery is required.

## 3. Signed update, rollback, identity, and key custody

### Firmware update and rollback

For each processor, an update must bind product, processor, board/module revision, image role, protocol/schema/config
compatibility, image digest, and release revision. The receiving authority must verify an approved release signature or
equivalent authenticated authorization before activation. Download location, filename, transport CRC, or digest alone is
not authorization. The receiver records image identity, digest, update cause, and new boot identity.

ESP32 application updates may use the application update path after its gates pass. ESP32 may transport STM32 material but
cannot install, select, roll back, or activate scoring firmware unilaterally. STM32 activation requires a signed,
locally authorized, recoverable path. Activation and resulting STM32 boot are `unavailable`; no hit is qualified.

Staging and activation must be atomic. The old valid image remains available until the candidate passes local integrity,
clock, RAM/flash, configuration, acquisition/reference, safe-output, and watchdog gates. A failed health check selects a
permitted last-known-good image or enters physical recovery, never silently resumes a bout.

Rollback is recovery, not compatibility fallback. It may select only a target-compatible, authenticated, known-good image
at or above the device's accepted security floor. The floor's durable representation, monotonic counter or equivalent,
revocation, recovery exception, and reset protection are **open design gates**; no algorithm or irreversible hardware
setting is invented here. Rollback creates new firmware and boot identities and remains unavailable until recovery gates
and supervisor-authorized interrupted-bout disposition pass.

### Identity and provisioning

Each apparatus needs a unique non-secret identity and traceable serial/lot identity; each processor needs a distinct
firmware/boot provenance context. Identity is checked during provisioning, service, update authorization, and record
creation. Missing identity produces an uncertainty/reset record, not a fabricated value. Timing-affecting configuration
still requires an approved STM32 manifest and local confirmation.

The production plan names STSAFE-A110 as a candidate for a non-exportable device key and authenticated service identity.
Its final circuit, key slots, protocol, attestation, and provisioning flow are not established by the part name. M3-10,
M6-03, and M8-02 must demonstrate unique identity, protected secrets, read-back, revocation/recovery, and serialized
results without exporting private keys.

Release-signing, device-provisioning, service-authorization, and recovery secrets have separate roles and least
privilege. Private material is never committed, embedded as a general firmware constant, copied to ordinary media, or
printed in reports. Custody, operator separation, audit, rotation, compromise response, revocation, backup, destruction,
and factory-reset behavior are M3-10/M8-02 gates. Hardware-backed custody may be used, but no vendor, algorithm,
certificate hierarchy, or cloud service is mandated here.

## 4. Debug, SWD, JTAG, and service policy

- Development may use physically controlled debug, but debug firmware preserves authority, parser bounds, and safe output
  defaults. EVT/DVT access is authorized, attributable, and restricted to service fixtures.
- Production has no network-triggered SWD, JTAG, bootloader, or memory-debug path. Physical service may unlock only by an
  authorized procedure; it must not expose private keys or arbitrary primary-output control. The choice between a
  reversible lock, authenticated unlock, and irreversible lock is a hardware/firmware release gate with a documented
  recovery path.
- STM32 PA13/PA14 are SWD; candidate production SWD excludes JTAG/SWO, and PB3/PB4/reset behavior must not defeat
  source/sink or output pulldowns. Final lock and reset circuitry remain unproven.
- ESP32 USB Serial/JTAG on GPIO19/GPIO20 is the candidate factory/development path. External JTAG GPIO39-GPIO42 is not
  allocated; the allocation warns against irreversible eFuse changes merely to recover that header. UART0 with `EN` and
  `BOOT_N` is candidate service/recovery. `STM32_LINK_RESET_N` on GPIO16 is not a hardware reset to `EN`.

## 5. Parser, frame, event integrity, and replay

The first parser boundary is the [M0-06 frame](transport-frame-contract.md). Version 1 accepts only magic `SC`, version
`1`, legal receiver-direction type, zero flags, exact length, payload length 0 through 4,096, valid CRC-32C, and the
expected sequence after a separately established sender boot/link boundary. The adapter supplies one complete bounded
frame of 18 through 4,114 bytes. It does not scan, concatenate, wait after truncation, buffer, reorder, or guess a version.
Malformed fields are rejected before payload bytes are returned. CRC-32C is accidental-corruption detection, not sender
authentication or freshness.

The payload parser separately accepts only supported schema versions and stable vocabularies from [M0-05](decision-record-contract.md),
with bounded capture references and ordered times/sequences. STM32 validates requests against its approved manifest and
current state. Unknown versions/reasons, unsafe sizes, missing identities, invalid units, or contradictions fail closed.

Each directed stream accepts only `sequence === expected`; lower is duplicate and higher is reordering/loss. Neither is
delivered or repaired. A valid record is delivered once. The STM32 source record binds `recordId`, decision/capture bounds,
firmware identity/digest, `scoringBootId`, hardware/rule/timing/line/calibration revisions, and bounded raw-capture
references. Existing `sha256:` content digests identify raw captures; this does not select storage authentication.

ESP32 validates frame and schema before atomic durable copy. Replay renders the stored result and never re-runs scoring.
Corrupt, partial, unknown, duplicate, or unverifiable records are withheld and reported as diagnostics/uncertainty.
Corrections are new immutable records, not rewrites. M0-06 currently defers message authenticity, so a production
decision must define sender binding, freshness, keys, rotation/revocation, failure behavior, and resource bounds.

## 6. Recovery modes and residual gates

| Mode | Entry and required behavior | Exit |
| --- | --- | --- |
| `normal` | STM32 local gates pass; it scores and drives primary outputs. ESP32 mirrors accepted records. | Local health monitoring and contract-valid requests. |
| `degraded` | ESP32, network, storage, display/audio service, or link fails while STM32 is trusted. STM32 continues; application freezes last accepted state or reports diagnostic. | Valid link/application recovery. |
| `unavailable` | STM32 boot/reset/watchdog/brownout/update, unsafe line/reference/clock, failed self-test, or uncertain power. Outputs/excitation are `safeInactive`; no qualification. | STM32 recovery gates plus supervisor-authorized interrupted-bout disposition. |
| `update-recovery` | Candidate rejected, interrupted update, or permitted rollback. Select prior valid image or physical recovery; create new identities. | Authorized image and normal startup gates. |
| `physical-service-recovery` | Unrecoverable image/identity, suspected compromise, or service fault. Restore approved image/config and repeat identity, debug, safe-output, and self-test checks. | Authorized service/release procedure; never automatic bout resume. |
| `whole-device-recovery` | Power absent or both domains untrusted. Treat restoration as cold boot; recover only durable valid records and discard volatile candidates/lockout. | Independent gates, then supervisor disposition if interrupted. |

The [M0-10 recovery gates](power-reset-state-contract.md#recovery-gates) govern rail/reset, image/configuration,
reference/acquisition, safe outputs, watchdog, and new `scoringBootId`. Warm STM32 reset does not claim to preserve a lamp
latch; that external-latch or retained/revalidated-output decision is a release blocker.

## 7. M0-11 acceptance and evidence mapping

| M0-11 criterion | Contract sections and exact downstream evidence |
| --- | --- |
| Signed updates | Section 3; M0-04 signed/local/recoverable STM32 path; M3-10 design; M6-03 bring-up; M7-08 security/update review; M8-02 signing/provisioning audit. |
| Rollback and anti-rollback | Sections 3 and 6; M0-10 `updateReset`; M3-10 recovery design; M6-06/M6-07 interruption/fault tests; M7-08/M7-09; M8-02. |
| Device identity | Section 3; M0-05 provenance; M3-10 identity design; M6-03 unique provisioning; M8-02 protected-secret audit. |
| Debug access | Section 4; candidate STM32/ESP32 allocations; M5-04/M5-06 schematics; M6-03 programming/recovery; M7-08 service review; M8-02 debug-state audit. |
| Network isolation | Authority/trust zones, Sections 2 and 5; M0-04; production-board isolation/watchdog plan; M2-06/M2-07; M3-11; M6-07/M6-08; M7-08. |
| Malformed frames | Section 5; M0-06 exact bounds/outcomes; M2-05 decoder and M2-13 fuzz; M3-05/M3-09 firmware parser tests; M7-08 penetration review. |
| Recovery | Section 6; M0-04/M0-10 degraded/unavailable/safe-state contracts; M2-08 power-fail transactions; M3-10 update recovery; M6-06/M6-07; M7-08/M7-09; M8-02/M8-07 service recovery. |

The abuse table additionally maps physical, service, manufacturing, replay/duplication/corruption, ESP32-compromise,
key-custody, event-integrity, and privacy risks. M0-12 must carry these requirements into the requirements-to-evidence
ledger. This documentation-only contract does not claim completed firmware, cryptography, schematic, manufacturing, or
compliance evidence.
