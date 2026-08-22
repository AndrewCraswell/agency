# M3-13 ESP32-S3 QEMU feasibility evidence

## Decision

QEMU is useful as an optional ESP32-S3 application-integration smoke test. It
is not a replacement for the required C17 host tests, target bring-up, or
board evidence, and it is not a required repository or CI dependency.

The repository keeps one small probe script,
`scripts/probe-qemu-feasibility.ps1`, that checks the S3 machine and starts it
with bounded blank flash and eFuse files. It does not download QEMU, build an
ESP-IDF application, emulate the STM32 scoring authority, or make claims for
peripherals that QEMU does not document.

## Reproduction

The evidence used the official Espressif Windows artifact listed in the ESP-IDF
tool table:

```text
qemu-xtensa-softmmu-esp_develop_9.2.2_20250817-x86_64-w64-mingw32.tar.xz
SHA-256: EF550B912726997F3C1FF4A4FB13C1569E2B692EFDC5C9F9C3C926A8F7C540FA
```

The archive was unpacked outside the repository. With its `bin` directory on
`PATH`, run the following from `apps/scoring`:

```powershell
powershell -ExecutionPolicy Bypass -File `
  firmware/esp32/scripts/probe-qemu-feasibility.ps1 `
  -QemuPath qemu-system-xtensa.exe
```

Observed output from the pinned artifact:

```text
QEMU emulator version 9.2.2 (esp_develop_9.2.2_20250817)
esp32s3 machine: PASS
blank flash and eFuse startup: PASS (process initialized for 5 seconds)
startup diagnostics: Adding SPI flash device
```

The machine list also reported `esp32`, `esp32s3`, and the generic Xtensa
machines. The probe uses a 4 MiB zero-filled SPI flash image and a 1 KiB
zero-filled ESP32-S3 eFuse image, then starts QEMU paused (`-S`). A process
that remains alive for the bounded interval proves only that the machine,
flash medium, and eFuse device initialize; it does not prove application boot.
The probe drains both redirected process streams, waits for QEMU termination,
and removes only its validated direct child of the system temp directory. Two
consecutive runs left no `scoring-qemu-m3-13-*` directory or QEMU process.

## Official capability boundary

The following table is based on the ESP32-S3-specific Espressif QEMU notes and
was checked against the machine and startup probe above.

| Behavior | QEMU result | Product value | Required caveat |
| --- | --- | --- | --- |
| ESP32-S3 ROM, CPU, RAM, UART, and SPI flash boot | Supported | Optional target-app boot, linker, ROM, and serial smoke tests | Requires a real ESP-IDF S3 application image; the current M3-08 C17 component is SDK-free |
| GDB and paused/reset execution | Supported | Debug application startup and application boot-ID/reset paths | Does not model board reset wiring or STM32 reset authority |
| eFuse file and eFuse device | Supported | Exercise application checks around emulated identity/security state | File-backed eFuses are reversible test state, not irreversible production provisioning |
| SHA, AES including flash-encryption primitives, RSA, HMAC, and Digital Signature | Documented as supported | Check target crypto API linkage and non-authoritative update plumbing | Does not qualify production keys, Secure Boot, timing, or hardware security behavior |
| ESP32-S3 Secure Boot | Not supported by the S3-specific QEMU notes | None for M3-10's authorization root | Secure Boot v2 remains a target and sacrificial-device gate |
| OpenCores Ethernet (`open_eth`) with user-mode TCP/UDP | Supported | Optional network-stack and parser/load smoke tests | No magnetics, ESD, EMC, cable, PHY, or venue-network evidence |
| PSRAM and MMU, including the documented sizes and octal mode | Supported | Optional allocation and application-load smoke tests | Does not prove the selected module, SI, thermal, or memory reliability |
| Virtual RGB panel | Supported | Optional display-renderer smoke test | It is a QEMU-only panel, not the product display or its electrical path |
| Timer-group watchdog | Partially supported | Limited watchdog/application reset smoke test | The S3 implementation uses the documented ESP32-C3 timer-group model |
| RTC watchdog | Not emulated | None | M3-10 and M6/M7 must test the real watchdog behavior |
| Wi-Fi, Bluetooth, USB Serial/JTAG, USB-OTG, ADC, RTC, and board-specific external devices | Not claimed | None | These are not covered by the cited S3 QEMU material and remain target/board work |

## Value against M3-08 through M3-11

| Existing milestone | What QEMU can add | What it cannot replace |
| --- | --- | --- |
| M3-08 service scaffold | Once an ESP-IDF application wrapper exists, compile and boot the target wrapper and exercise UART, reset, and selected network/crypto adapters | The current function-table tests, missing-service normalization, bounds, and safe defaults; those are intentionally SDK-free |
| M3-09 receiver, journal, and replay | Once a target flash adapter exists, run a real ESP-IDF application through boot and application reset while observing journal-open and replay calls | The current power-loss boundary matrix, opaque byte equality, sequence rules, and durable medium atomicity; QEMU does not make the inline host model a flash implementation |
| M3-10 identity, update, rollback, and recovery | Exercise eFuse-file reads and target crypto API wiring in a non-production image | ESP32-S3 Secure Boot, irreversible eFuse lockdown, signed production provisioning, rollback assurance, and locked recovery policy |
| M3-11 load isolation | Add optional CPU/network/RGB application load around a target wrapper | STM32 authority containment, physical isolation, deterministic scoring timing, and real watchdog/thermal/EMC behavior |

The incremental value is therefore narrow but real: QEMU can catch mistakes in
ESP-IDF target configuration, ROM/application boot, application reset, and
selected Ethernet/PSRAM/crypto integration before boards arrive. It cannot
validate the scoring algorithm because scoring authority remains on STM32 and
the QEMU model has no fencing inputs or primary output wiring.

## Release policy and explicit deferrals

1. Keep the M3-08 through M3-11 native host tests as required, deterministic,
   and dependency-free.
2. Keep the probe script optional. Do not add a QEMU binary, ESP-IDF SDK, or
   QEMU-generated image to source control or the required package lockfile.
3. M3-14 may add an optional QEMU lane only after a pinned ESP-IDF S3 target
   wrapper and flash-backed journal adapter exist. Unsupported peripherals
   must remain host fakes and must be listed in its report.
4. Treat Secure Boot, RTC watchdog, physical reset/isolation, electrical
   Ethernet, production eFuse provisioning, and flash power-loss behavior as
   target or board gates owned by M3-10 and M6/M7.

## Sources

- Espressif ESP32-S3 QEMU instructions:
  https://github.com/espressif/esp-toolchain-docs/blob/main/qemu/esp32s3/README.md
- Espressif ESP-IDF QEMU API guide:
  https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/tools/qemu.html
- Espressif QEMU release artifact:
  https://github.com/espressif/qemu/releases/tag/esp-develop-9.2.2-20250817
- ESP-IDF security feature example showing `esp32s3` QEMU target use:
  https://github.com/espressif/esp-idf/blob/master/examples/security/security_features_app/README.md
