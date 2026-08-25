# BP-032 Yageo RC0603 resistor candidate-footprint review

## Decision

This is a bounded BP-032 review-only candidate for the two exact Yageo 0603
orderables used by the reset, watchdog, boot, and processor-support contracts:

| Exact MPN | Value | Retained official source | References |
| --- | ---: | --- | --- |
| `RC0603FR-0710KL` | 10 kOhm, 1% | BP-125 PDF, SHA-256 `EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497` | `R_STM_WD_CWD`, `R_ESP_WD_CWD`, `R_STM_NRST_PULLUP`, `R_ESP_EN_PULLUP`, `R_APP_SUPERVISOR_RESET_PULLUP`, `R_W5500_RESET_PULLUP`, `R_STM_RESET_ISO_SERIES`, `R_STM_RESET_GATE`, `R_DEBUG_RESET_GATE`, `R_STM_BOOT0`, `R_ESP_BOOT_PULLUP` |
| `RC0603FR-07100KL` | 100 kOhm, 1% | BP-033 PDF, SHA-256 `E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054` | `R_STM_WDI_PULLUP`, `R_ESP_WDI_PULLUP`, `R_STM_RESET_ISO_PD`, `R_STM_RESET_GATE_PD`, `R_DEBUG_RESET_GATE_PD` |

The exact MPN rows are separate. The 10 kOhm source is never used to support
the 100 kOhm orderable, and the 100 kOhm source is never used to support the
10 kOhm orderable. No generic Yageo RC-family or series substitution is
accepted.

All 16 references are reconciled in the BP-032 processor-footprint ledger by
the executable `footprintEvidence` record. The ledger preserves fabrication
deny, `accepted: false`, and unresolved review state. The `C_ESP_EN_DELAY`
TDK capacitor is intentionally outside this slice.

## Dependency distinction

The 10 kOhm and 100 kOhm electrical selections originate across two upstream
contracts:

- `R_STM_BOOT0` and `R_ESP_BOOT_PULLUP` are exact BP-125 support selections.
- `R_ESP_EN_PULLUP` is the BP-123 reset selection reconciled into the BP-125
  support ledger.
- The remaining reset and watchdog resistor references are BP-123 reset/
  watchdog selections. Their resistor footprint evidence was absent from the
  BP-032 candidate map at the audited boundary.

The official bytes are retained separately from those dependency rows: the
BP-125 10 kOhm PDF is at
`packages/scoring-circuit/docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf`;
the BP-033 100 kOhm PDF is at
`packages/scoring-circuit/docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf`.
Each source record binds its exact MPN, source owner, URL, page 1, and
SHA-256. The product specifications publish package dimensions but do not
publish an exact land pattern, solder-mask opening, paste aperture, courtyard,
or CAD object.

## Review geometry and disposition

The retained PDFs establish the common EIA 0603 / IEC 1608 package envelope:
1.6 mm nominal length (1.5--1.7 mm), 0.8 mm nominal width (0.7--0.9 mm),
0.45 mm nominal thickness (0.35--0.55 mm), and two terminals. The candidate
uses an explicitly project-derived reflow review input, not manufacturer CAD:

- rectangular copper pads: 0.9 mm by 0.9 mm, 0.5 mm edge gap, 1.4 mm center
  span;
- solder mask: 0.05 mm per-edge expansion, giving 1.0 mm by 1.0 mm openings;
- paste: 0.05 mm per-edge reduction, giving 0.8 mm by 0.8 mm apertures;
- courtyard: 2.4 mm by 1.4 mm project review envelope;
- two-terminal, non-polar orientation; pin one is not applicable and assembly
  marking/stress review remains pending.

Manufacturer CAD is `not-acquired` with null artifact path and deny authority.
The generated tscircuit artwork digest
`C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8` binds
review rendering only. It does not authorize board import or fabrication.

Root review visually confirmed the retained one-page Yageo sheets identify the
exact 10 kOhm and 100 kOhm orderables and their 0603 / 1608 body envelopes. That
review accepts the source and 16-reference mapping only. Because neither sheet
publishes a land pattern, the project copper, mask, paste, courtyard, and stress
assumptions remain unapproved review inputs.

## Verification and open gaps

`bp032-yageo-rc0603-resistor-footprint-evidence.test.tsx` verifies both exact
MPNs, all 16 reference bindings, the two retained source hashes and ownership,
project copper/mask/paste/courtyard rendering, orientation, artwork digest,
ledger reconciliation, and fail-closed mutation cases. Exact-orderable CAD,
manufacturer mask/paste data, independent assembly orientation, stress,
fabricator review, and fabrication release remain open.
