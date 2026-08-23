# Rules source

The cross-software-and-hardware execution plan is in [device-delivery-plan.md](device-delivery-plan.md). It defines the
milestones, dependencies, granular agent-sized tasks, acceptance evidence, and the boundary between emulation,
fabrication readiness, EVT, DVT, and production validation.

The approved sequencing for the immediate RGB LED web player, two-chip OTA launch gate, Rust proof after the current
code-complete baseline, and open-source preparation is in
[software-product-evolution-roadmap.md](software-product-evolution-roadmap.md). It keeps the current
TypeScript/C17/ESP-IDF implementation and its test corpus as the oracle until equivalence evidence supports a separate
migration decision; neither that proof nor public source publication requires commercial hardware launch first.

The production UX brief for the Shadcn-based test selector, 64 × 32 scoring display, bout state, and synchronized event
timeline is in [simulator-product-design-spec.md](simulator-product-design-spec.md).

The reproducible `rules-1` baseline, its pinned executable inputs and toolchain,
and its review-sensitive digest workflow are defined in
[behavior-oracle-contract.md](behavior-oracle-contract.md).

The normative requirements are decomposed in
[fie-traceability-matrix.md](fie-traceability-matrix.md). Project terminology and the distinction between rule terms,
electrical observations, decisions, and diagnostics are defined in [scoring-glossary.md](scoring-glossary.md). The
[seven-conductor contract](seven-conductor-signal-contract.md) and
[processor fault-containment contract](processor-fault-containment-contract.md) define the hardware/software boundary.
Immutable replay payloads and portable test vectors are specified in
[decision-record-contract.md](decision-record-contract.md) and [golden-scenario-contract.md](golden-scenario-contract.md).
Stored-record replay rendering is specified in
[replay-renderer-contract.md](replay-renderer-contract.md).
The bounded M2-12 scenario-runner CLI and stable JSON report are specified in
[scenario-runner-contract.md](scenario-runner-contract.md).
The released scalar timing selections, strict revision loading, and M1-08
boundary-vector handoff are specified in
[timing-table-contract.md](timing-table-contract.md).
The generated M1-08 coverage, stable ordering, and unresolved exclusions are
specified in [timing-boundary-vector-contract.md](timing-boundary-vector-contract.md).
The bounded, replayable M1-09 property corpus and safety properties are
specified in [scoring-property-test-contract.md](scoring-property-test-contract.md).
The host-only foil resistance boundaries and logical contact-context results
are specified in
[foil-resistance-and-context-contract.md](foil-resistance-and-context-contract.md).
The M2-05 canonical binary frame implementation and acceptance evidence are
specified in [m2-05-transport-codec-evidence.md](m2-05-transport-codec-evidence.md).
The bounded M2-13 seeded protocol, decision-record, and journal fuzz evidence
is specified in [m2-13-seeded-fuzz-evidence.md](m2-13-seeded-fuzz-evidence.md).
The M3-10 ESP32-S3 production identity, signed-update, rollback, and locked
recovery decision is specified in [esp32-production-security-recovery-adr.md](esp32-production-security-recovery-adr.md).
The M3-09 SDK-free receiver, atomic journal, power-loss recovery, and opaque
byte replay evidence is specified in
[`firmware/esp32/docs/receiver-journal-replay-evidence.md`](../firmware/esp32/docs/receiver-journal-replay-evidence.md).
The independent two-reel scoring-box tester, physical-output observer, and
timeline-evidence program is defined in
[box-tester-roadmap.md](box-tester-roadmap.md).
The M3-13 bounded ESP32-S3 QEMU feasibility result and optional smoke probe are
specified in
[`firmware/esp32/docs/qemu-feasibility-evidence.md`](../firmware/esp32/docs/qemu-feasibility-evidence.md).

`fie-material-rules-2026-08-en.pdf` is the English FIE Material Rules, Book 3, dated August 2026.

- Official index: https://fie.org/documents/rules
- Official PDF: https://static.fie.org/uploads/40/204157-book%20material%20August%202026%20ang.pdf
- Downloaded: 2026-08-22
- SHA-256: `1489D28ED6F3C91E27ECDF75BB29B4ED65C688A012F544D37D946A9DA81AFC26`

The scoring implementation should cite the relevant article or Annex B section in test names or nearby comments. Keep the original PDF unchanged; replace it only when the FIE publishes a newer edition, then update the filename, date, checksum, and rule-derived tests together.

## Favero FA-15 reference

These official Favero files document the current comparison machine identified for this project:

| File | Official source | SHA-256 |
| --- | --- | --- |
| `favero-fa15-user-manual-en.pdf` | https://www.favero.com/get_file.php?id=398 | `C4AC240F4E81795D966EDE9909450CAE8AD9FCC7A19E138C83AB999664D33D20` |
| `favero-fa15-t2016-specifications-en.pdf` | https://www.favero.com/get_file.php?id=399 | `F575C8A7630FBF104CA8AFA4CD28544CB2D75A35A4FF4C5716A19C31513DB72F` |
| `favero-fa15-fie-homologation.pdf` | https://www.favero.com/get_file.php?id=391 | `1314E203ED3E0B5890B1EE9FF826778DDF6A6E4345439534128342AD2E0EE529` |

- Official product page: https://www.favero.com/en2_fencing_sport_fencing_apparatus_fa_15-319-17.html
- Downloaded: 2026-08-22

The T2016 document records the FA-15's published timing profile, but the August 2026 FIE Material Rules remain the normative source for our implementation. Favero does not publish the internal weapon-line voltages or complete analog schematic in these documents, so those values still require bench measurement rather than assumption.
