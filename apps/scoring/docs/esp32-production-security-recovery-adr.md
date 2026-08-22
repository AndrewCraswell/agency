# ADR: ESP32-S3 production identity, update, and recovery

- **Status:** proposed for M3-10 review
- **Decision date:** 2026-08-22
- **Applies to:** production ESP32-S3 application-controller units and their provisioning, OTA, and service flow
- **Depends on:** [M0-11 threat model](product-threat-model.md) and [M3-08 host scaffold evidence](../firmware/esp32/docs/host-scaffold-evidence.md)
- **Does not authorize:** an ESP32 scoring decision, STM32 scoring-firmware activation, target firmware implementation,
  eFuse programming, hardware claims, or release of a production unit

## Decision

The first production release uses ESP32-S3 hardware Secure Boot v2, flash encryption in Release mode, an `otadata` plus
`ota_0`/`ota_1` application layout, ESP-IDF application rollback, and ESP-IDF app anti-rollback. It has no factory or
test application partition, no bootloader or partition-table OTA, no release-mode JTAG, USB-JTAG, or ROM download
recovery, and no network-triggered debug path.

Secure Boot v2 is the only executable-authorization root. It verifies the second-stage bootloader and each application
with an appended RSA-3072 RSA-PSS signature block whose public-key digest is in eFuse. The hardware verifies an
application on boot and before the candidate is selected after OTA. [Espressif Secure Boot v2](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/secure-boot-v2.html)
documents this ESP32-S3 behavior. Flash encryption uses a unique per-unit AES-XTS key in read-protected eFuse and
Release mode. It protects application and explicitly encrypted data partitions at rest; it does not authorize an image.
Secure Boot and flash encryption are therefore always enabled together.

The current M3-08 function-table scaffold is not a secure-update implementation. In particular,
`scoring_esp32_stage_signed_update` accepts opaque bytes and has no verifier, target matcher, partition writer, or
eFuse interaction. M3-09 through M3-11 must preserve its non-authoritative boundary while adding the target adapters
and tests defined here.

## First-release security profile

The pinned ESP-IDF release and `sdkconfig` review must demonstrate all of the following before an eFuse is programmed:

| Control | First-release selection | Review evidence |
| --- | --- | --- |
| Code execution | Secure Boot v2, RSA-3072, hardware enabled | Signed bootloader and apps, key-digest fingerprints, read-back eFuse report |
| Flash confidentiality | Flash encryption enabled in Release mode with a unique per-unit AES-XTS key; application, `otadata`, identity/configuration, and journal partitions are marked encrypted where supported by the pinned ESP-IDF partition-table contract | Partition-table review, non-secret eFuse status, encrypted-partition inspection |
| Application update | `otadata`, `ota_0`, and `ota_1`; rollback and app anti-rollback enabled; no `factory` or `test` app partition | Generated partition table and pinned `sdkconfig` diff |
| Anti-rollback capacity | Use the ESP32-S3 16-bit application `secure_version` field. It is a security floor, not the release number. | Signed application descriptor and eFuse floor read-back |
| Initial provisioning | Controlled external factory workflow, with flash encryption enabled before Secure Boot v2 as required by Espressif | Fixture transcript, independent eFuse read-back, controlled provisioning record |
| Boot media and debug | Program only the reviewed ESP32-S3 controls in the next table, after the irreversible-programming gate passes | eFuse read-back and attempted-access tests |

ESP-IDF documents that Release mode prevents the ROM bootloader from performing flash-encryption operations and that
new plaintext application images then arrive by OTA. It also recommends disabling ROM download mode entirely when it is
not needed. [Espressif Flash Encryption](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/flash-encryption.html)
The ESP-IDF anti-rollback scheme requires `ota_0` and `ota_1` without a factory/test partition, and provides 16
security-version increments on this target. [Espressif OTA and anti-rollback](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/api-reference/system/ota.html)

The pinned `sdkconfig` must show `CONFIG_SECURE_BOOT_V2_ENABLED`, `CONFIG_SECURE_FLASH_ENC_ENABLED`,
`CONFIG_SECURE_FLASH_ENCRYPTION_MODE_RELEASE`, `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`, and
`CONFIG_BOOTLOADER_APP_ANTI_ROLLBACK`. The review records the exact value selected for
`CONFIG_SECURE_UART_ROM_DL_MODE`; the production selection is permanent disablement, not secure-download mode.

Bootloader and partition-table replacement are excluded from OTA. ESP-IDF calls their temporary-copy update mode unsafe
under interruption. A released, locked unit with an immutable-boot failure needs module replacement, not a hidden field
backdoor.

The programming work instruction must name and verify the following pinned ESP32-S3 controls, rather than use an
imprecise instruction to "disable direct boot":

| Surface | Required reviewed control | First-release disposition |
| --- | --- | --- |
| External JTAG | `HARD_DIS_JTAG` | Program after production acceptance. |
| USB-device JTAG | `DIS_USB_JTAG` | Program after production acceptance. |
| ROM download boot modes, including UART0 | `DIS_DOWNLOAD_MODE` and the pinned `CONFIG_SECURE_UART_ROM_DL_MODE` setting that selects permanent disablement | Program after production acceptance. Secure download mode is not an acceptable production recovery path. |
| USB Serial/JTAG ROM download route | `DIS_USB_SERIAL_JTAG_DOWNLOAD_MODE` | Program after production acceptance. |
| USB-OTG ROM download route | `DIS_USB_OTG_DOWNLOAD_MODE` | Program after production acceptance. |
| ROM USB Serial/JTAG output | `DIS_USB_SERIAL_JTAG_ROM_PRINT` | Program after production acceptance to prevent ROM diagnostic output on that route. |
| Legacy direct-boot path | `DIS_DIRECT_BOOT` | Program after production acceptance; the work instruction must cite its exact eFuse name and read-back state. |

The [ESP32-S3 eFuse reference](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/system/efuse.html)
distinguishes these controls: `DIS_DOWNLOAD_MODE` covers download boot modes, while the USB Serial/JTAG and USB-OTG
download controls are separate. USB ROM download routes are not UART ROM download mode, and neither is an application
UART service. The exact pinned ESP-IDF/espefuse versions and target revision must be reviewed before burning.

No production eFuse is enabled automatically on first boot. Before any irreversible burn, the release must pass a
dry-run configuration review and demonstrate the signed image, full boot, OTA, rollback, and disabled-access behavior
on sacrificial units. Two authorized operators then perform each production programming step, capture an independent
read-back, and quarantine a unit on any mismatch. The flash-encryption-before-Secure-Boot order remains mandatory for
the controlled external workflow.

Before irreversible lockdown, a quarantined fixture unit may be re-provisioned through the controlled factory workflow.
After lockdown, a released unit with a still-running valid signed application may recover only through this ADR's
normal signed OTA path. A locked unit with no bootable, floor-compatible signed application, or an immutable-boot
failure, is not reflashable and requires application-module replacement.

## Identity and provisioning

Each released ESP32 application controller has these distinct identifiers:

| Identifier | Source and use | Secrecy |
| --- | --- | --- |
| `espChipId` | The ESP32-S3 base MAC, normalized as a 48-bit lowercase hexadecimal value. It is the immutable silicon binding for this controller. | Non-secret |
| `apparatusId` | Random 128-bit UUID assigned once by the controlled provisioning fixture and bound to serial number, board revision, `espChipId`, and STM32 serial/identity when available | Non-secret |
| `applicationBootId` | Fresh random 128-bit value for every ESP32 boot; used in update and lifecycle evidence | Non-secret |
| `provisioningRecord` | Bounded versioned record containing the identifiers above, fixture ID/version, lot, approved initial image digest, and security profile | Non-secret, stored encrypted for confidentiality but not used as an authorization credential |

The device treats a missing, malformed, or mismatched provisioning record as an application fault. It does not
synthesize an identity or claim current presentation after that fault. This does not make the base MAC or the
provisioning record an authentication credential. It is controlled production provenance; Secure Boot is the execution
authorization root and the signed application descriptor supplies release compatibility.

The provisioning fixture reads `espChipId` directly from the target, generates `apparatusId`, writes the controlled
record, and proves by read-back that it matches the eFuse/security state and initial signed image. It must never export
the flash-encryption key. There is no device private key, remote-attestation service, or privileged production service
in the first release. Adding any of those mechanisms requires a separate hardware, security, and privacy decision.

## Release artifact and target binding

An ESP32 application delivery consists of `app.bin`, the ESP-IDF Secure Boot v2 signed application binary. An unsigned
transport envelope may carry a declared length and SHA-256 to bound download, resume transport, and diagnose corruption.
Neither field authorizes the image, selects a target, or survives as security evidence unless it matches the verified
image.

`app.bin` contains a bounded, versioned compatibility descriptor in a known application-image section. Because the
Secure Boot v2 signature covers the application image, it authorizes this descriptor along with executable bytes. The
descriptor includes `descriptorVersion`, `artifactType: esp32-application`, product ID, processor ID `esp32-s3`,
allowed board revisions, minimum bootloader ABI, required protocol/schema/config revisions, release ID, and the
ESP-IDF application `secure_version`. It contains no secret, Wi-Fi credential, or scoring configuration.

First release accepts **cohort** updates only: exact product ID, exact processor ID, and a listed board revision must
match local hardware/provisioning inputs. Product-only wildcards and unit-targeted releases are invalid. Unit-targeted
releases are deferred. The verification order is:

1. bound the incoming binary and any unsigned envelope before writing;
2. write only the inactive OTA slot and finish the ESP-IDF OTA image validation, including Secure Boot v2 signature
   verification;
3. read the descriptor from the validated candidate, reject an unknown descriptor version, and require exact product,
   processor, board-revision, and compatibility matches;
4. check the signed app descriptor's `secure_version` against the eFuse floor; and
5. record the verified candidate identity and atomically select it with `otadata`.

TLS, a download URL, an unsigned envelope, transport checksum, or SHA-256 digest alone is never authorization. A
release tool must fail closed if its recorded image hash, the Secure Boot signature information, the compatibility
descriptor, or the signed app descriptor's `secure_version` disagree.

## Rollback, anti-rollback, and interrupted updates

Routine releases retain the current `secure_version` so the last known-good application remains a rollback candidate.
Increase `secure_version` only for a confirmed vulnerability that makes every lower version unacceptable. The release
manager must explicitly approve that irreversible operation and confirm that the candidate has passed the first-boot
health gate before the eFuse floor advances. A semantic version, build number, or unsigned envelope time can never
advance the security floor.

| State | Entry | Required behavior and exit |
| --- | --- | --- |
| `valid` | Previously health-confirmed app | May provide application services. STM32 remains the sole scoring authority. |
| `downloading` | Candidate transfer begins | Stream only to inactive slot. Power loss, link loss, malformed bytes, digest mismatch, or signature failure leaves the current valid slot selected. |
| `staged` | Inactive slot fully written and verified | Persist artifact identity and select the candidate using `otadata`; no update is active until reboot. |
| `pending-verify` | Candidate's first boot | Keep network control, service commands, and presentation of new current state disabled until health checks pass. Mark valid only through `esp_ota_mark_app_valid_cancel_rollback()`. |
| `invalid` or `aborted` | Health check fails, explicit rejection, crash, watchdog, or power loss before confirmation | Mark invalid and reboot, or allow ESP-IDF's pending verification to abort on the next boot. Boot the previous valid, floor-compatible slot. |
| `rollback-recovery` | Candidate did not become valid | Create a new `applicationBootId`, retain diagnostic evidence, and offer only non-authoritative application recovery. Do not resume an interrupted bout. |
| `physical-recovery` | No compatible valid app, provisioning/security fault, or immutable boot path failure | Before lockdown, quarantine and use the controlled factory re-provisioning workflow. After lockdown, use normal signed OTA only if a valid signed app is still running; otherwise replace the application module and repeat production acceptance. Never bypass Secure Boot, flash encryption, or ROM-download lock. |

ESP-IDF's rollback state machine changes a first-boot candidate from `NEW` to `PENDING_VERIFY`; a reset before
confirmation makes it `ABORTED` and selects the preceding valid image. It also refuses an app below the eFuse security
floor. [Espressif OTA rollback states](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/api-reference/system/ota.html)

The pending-verify health gate is limited to application-domain checks: signed image metadata and cohort-compatibility
match, encrypted storage availability, journal recovery, bounded scoring-link decoder readiness, reset-safe peripheral
defaults, watchdog availability, and a record that the application is in a new boot. It must not evaluate a weapon,
create a decision, reset the STM32, or require network service. A healthy STM32 may continue scoring during an ESP32-only
update as `degraded`; an operator may not start that update during an active bout. STM32 firmware activation remains a
separate locally authorized, recoverable path and makes scoring `unavailable`, as required by M0-04 and M0-11.

## Key roles, custody, rotation, and revocation

| Role | Mechanism and custody | Use and revocation |
| --- | --- | --- |
| Secure Boot root | Three independently generated RSA-3072 key pairs under offline HSM-backed custody. Program all three public-key digests during factory provisioning; sign the immutable bootloader with all three. | An app normally carries one current signature. For planned rotation or compromise, sign the transition app with current and replacement keys, validate it, then revoke only the compromised digest under the documented ESP-IDF flow. |
| Flash encryption | Unique device key in read-protected eFuse. | Never exported, backed up, logged, or reused. It is not a signing or service key and cannot be rotated in the field. |

The production fixture records only public-key fingerprints and eFuse state. It uses dual control for eFuse programming
and final release, verifies every irreversible operation with a second read-back, and quarantines a unit on mismatch.
Private keys, flash keys, and raw provisioning secrets are prohibited from source control, CI logs, fixture exports,
customer records, and diagnostic bundles.

Espressif supports up to three Secure Boot v2 public-key digests and documents HSM/remote signing use. The production
key plan deliberately programs all three digests before shipping because the same documentation requires unused digest
slots to be revoked. [Espressif Secure Boot key management](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/secure-boot-v2.html)

## Debug and physical service

Production policy is deny by default:

- External JTAG and USB-device JTAG are permanently disabled with `HARD_DIS_JTAG` and `DIS_USB_JTAG`. Secure Boot also
  disables JTAG by default, but the production read-back must prove the hard-disable controls.
- `DIS_DOWNLOAD_MODE` permanently disables ROM download boot modes. `DIS_USB_SERIAL_JTAG_DOWNLOAD_MODE` and
  `DIS_USB_OTG_DOWNLOAD_MODE` separately disable the two USB ROM download routes. A production unit has no serial,
  USB Serial/JTAG, or USB-OTG reflashing or download-mode recovery path.
- UART0, if populated for manufacturing, has no shell, GDB stub, memory dump, arbitrary read/write, raw flash, or
  bootloader command in production. Application UART output is disabled; `DIS_USB_SERIAL_JTAG_ROM_PRINT` suppresses
  the separate ROM USB Serial/JTAG print route.
- Privileged production service is disabled. No device accepts an unlock request or command that installs firmware,
  exposes keys, alters scores, drives primary outputs, or resets STM32. Controlled factory re-provisioning applies only
  before irreversible lockdown. On a locked released unit, normal signed OTA is the only recovery path while a valid
  signed app runs; no bootable app or immutable-boot failure requires module replacement.
- The candidate UART0/`BOOT_N` allocation remains a factory design input, not proof of a production service path.
  M5/M6 must prove reset-safe electrical behavior and that manufacturing pads do not back-power either domain.

Provisioning, update, rollback, access-test, pre-lockdown re-provisioning, and module-replacement events emit redacted
audit evidence with identity, boot ID where available, operator/fixture identity, outcome, eFuse summary, and firmware
identity. It never records private material or raw flash.

## Required tests and release gates

These tests are the exact M3-10 acceptance plan. A host-only pass proves parser and state-machine behavior only; target
and later board evidence are mandatory before a production claim.

| ID | Threat-model coverage | Required test or gate | Evidence owner |
| --- | --- | --- | --- |
| `TM-ESP-01` | Unauthorized, malformed, wrong-target, or stale firmware | Host corpus rejects an oversized/truncated candidate, invalid Secure Boot v2 signature, unknown compatibility-descriptor version, missing field, bad field bound, and wrong product/processor/board/protocol/schema/config revision before `otadata` selection. An unsigned envelope cannot override any result. | M3-10 implementation |
| `TM-ESP-02` | Unauthorized executable bytes | Release-artifact gate verifies image SHA-256 for distribution, Secure Boot v2 signature information, compatibility descriptor, app descriptor version, and `secure_version` against the release record. | M3-10 release tooling |
| `TM-ESP-03` | Rollback and power loss | Fault matrix interrupts every download, inactive-slot write, end verification, `otadata` selection, candidate boot, and pending-verify health step. It proves current valid app survives pre-selection interruption and candidate becomes `ABORTED` or `INVALID` after unconfirmed boot. | M3-10 host model, M6-06/M6-07 target/board |
| `TM-ESP-04` | Vulnerable rollback | Target test attempts a signed app below the eFuse `secure_version`, confirms rejection, then confirms same-floor rollback works and a raised-floor release cannot return below the floor. | M6-03/M7-08 |
| `TM-ESP-05` | Wrongly provisioned or cloned provenance | Provisioning fixture verifies read-back of base MAC, serial, lot, board revision, IDs, initial image, and eFuse security state; production records quarantine duplicate `apparatusId` values. The test does not claim a per-device authentication key. | M6-03/M8-02 |
| `TM-ESP-06` | Open debug or recovery bypass | On released hardware, attempt external JTAG, USB-device JTAG, UART ROM download, USB Serial/JTAG ROM download, USB-OTG ROM download, UART shell, and raw-flash access. Each fails without changing flash, eFuse state, scoring output, or STM32 reset. | M6-03/M7-08/M8-02 |
| `TM-ESP-07` | ESP32 compromise crossing authority boundary | Run M3-11 maximum application load and update-parser fuzz while checking opaque STM32 record bytes and sequence stay unchanged and no ESP32 action resets or controls the STM32. | M3-11/M6-07/M7-08 |
| `TM-ESP-08` | Key misuse or untraceable release | Two-person release/provisioning drill proves Secure Boot private keys remain in offline HSM custody, public fingerprints/read-backs agree, revocation transition is recoverable, and audit records are complete but secret-free. | M7-08/M8-02 |
| `TM-ESP-09` | Unsafe physical recovery | Prove the three recovery boundaries: a quarantined pre-lockdown unit can complete controlled re-provisioning; a locked unit with a running valid signed app recovers only through normal signed OTA; and a locked unit with no bootable compatible app or immutable-boot failure has no reflash path and is routed to module replacement. No path resumes a bout. | M6-07/M7-08/M8-07 |

The M3-10 documentation gate passes only when this ADR, the threat model, and the M3-08 interface review agree on the
above controls and explicitly retain the target/board evidence owners. M3-15 may not claim a secure production target
until `TM-ESP-01` through `TM-ESP-03` have executable evidence and the required pinned ESP-IDF configuration is
reviewed. M7-08 and M8-02 close the remaining target, penetration, provisioning, and service gates.

## Deferred decisions

This decision intentionally defers a recovery bootloader, bootloader/partition-table OTA, customer field flashing,
any post-lockdown re-provisioning or reflashing path, remote debug, privileged service and its authorization, remote
attestation, per-device client certificates, an external secure element, unit-targeted updates, fleet management,
automated revocation rollout, and a cloud key-management vendor. It also does not settle the ESP32 board revision,
partition sizes, UART pad population, or STM32 firmware update mechanism.

Those items are not needed to establish the first-release trust boundary. They need their own hardware, privacy,
operational, or failure-mode evidence before being added.
