# BP-031 and BP-032 C0603C104K3RACTU footprint review

Status: review-only candidate. The exact orderable identity and rendered
review geometry are recorded, but release, fabrication, CAD, and acceptance
authority remain denied.

## Exact scope

This bounded slice covers one exact MPN and two explicit reference sets:

| Work unit | References | Role |
| --- | --- | --- |
| BP-031 | `C_REF_REG_HF_1` through `C_REF_REG_HF_7` | Seven-channel REF5025A-Q1 local high-frequency output bypass |
| BP-032 | `C_STM_SUPERVISOR_CT`, `C_STM_SUPERVISOR_BYPASS`, `C_STM_WD_BYPASS`, `C_STM_NRST_FILTER`, `C_ESP_SUPERVISOR_CT`, `C_ESP_SUPERVISOR_BYPASS`, `C_ESP_WD_BYPASS`, `C_APP_RESET_FANOUT_BYPASS` | Reset, supervisor, watchdog, and reset-fanout support bypass capacitors |

Every listed reference is bound to KEMET `C0603C104K3RACTU`, package `0603`.
The retained source calls the same orderable an SMD Comm X7R ceramic MLCC,
100 nF, 10%, 25 VDC, X7R, 0603 / 1608. The source also records the alias
`C0603C104K3RAC7867`.

## BP-033 extension scope

The independent BP-031/BP-032 frozen candidate remains unchanged. A separate
extension record reuses its exact-part, rendered-artwork, and project-review
geometry evidence for BP-033 only for these six references:

| Reference | BP-033 source contract | Role |
| --- | --- | --- |
| `C_APP_REG_IN_HF` | BP-142 | Application regulator high-frequency input bypass |
| `C_APP_REG_BOOT` | BP-142 | Application regulator bootstrap capacitor |
| `C_HUB75_BUF_A_BYPASS` | BP-144 | HUB75 buffer A local bypass |
| `C_HUB75_BUF_B_BYPASS` | BP-144 | HUB75 buffer B local bypass |
| `C_IR_VS` | BP-146 | Encrypted-IR receiver filtered-supply bypass |
| `C_FRAM_BYPASS` | BP-145 | F-RAM local bypass |

The extension records source-contract provenance without changing the
application ledger, convergence records, backlog, board, or application
footprint mapping. Its four retained source-contract hashes are:

| Contract | Retained source path | SHA-256 |
| --- | --- | --- |
| BP-142 | `src/bench-prototype-application-rail.ts` | `ED4BFC8B752BE974323BF7ED95B1B5718C1C2F1D903B6444E652245326F35E67` |
| BP-144 | `src/bench-prototype-hub75-safing.ts` | `0DBD6D07A1C10AA93C0DBC92062C271186A0FE5BA6B31B109F771544A4AFAAA2` |
| BP-145 | `src/bench-prototype-optional-peripherals.ts` | `18B19F1BD020DAF861527D32AE4630464AFD5E00E6167460E2816A38C1296FFA` |
| BP-146 | `src/bench-prototype-ir-receiver-selection.ts` | `D716C2702606A7EA7A00D72ED0434B56A3BF4F13B6F9638E92221BDF9E68852D` |

The machine-readable extension is exported from
`src/bp031-032-c0603c104k3ractu-footprint-evidence.tsx` as a separate
BP-031/BP-032/BP-033 candidate. Its validator retains the shared source PDF
hash, rendered-artwork hash, independent graph checks, and all deny gates.
The extension's exact-graph validator also enforces property flags and rejects
sibling aliases for the full traversal. The extension does not authorize mapping, placement, board integration,
acceptance, release, or fabrication.

## Retained primary evidence

The sole retained primary artifact is
`docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf`.
It is hash-bound as
`F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064`.
The PDF has four pages; page 1 is the exact-orderable page used by this
record. Page 1 establishes:

- L `1.6 +/-0.15 mm`, W `0.8 +/-0.15 mm`, and T `0.8 +/-0.15 mm`;
- terminal separation S `0.5 mm minimum`;
- terminal bandwidth B `0.35 +/-0.15 mm`;
- 100 nF, 10%, 25 VDC, X7R, and the `0603 / 1608` case.

The retained product specification does not publish a land pattern, copper
land dimensions, solder-mask opening, stencil aperture, courtyard, or exact
orderable CAD object. Package dimensions are therefore not promoted into
manufacturer CAD or manufacturer land guidance.

## Project-review geometry

The component renders two rectangular SMT pads, centered on the local X axis:

| Item | Project-review value | Authority |
| --- | --- | --- |
| Pad length | `0.90 mm` | Project input |
| Pad width | `0.90 mm` | Project input |
| Pad gap | `0.50 mm` | Project input based on the retained terminal-separation minimum |
| Pad centers | `-0.70 mm`, `+0.70 mm` | Derived project geometry |
| Solder mask opening | `1.00 mm x 1.00 mm` | Project NSMD input, `0.05 mm` per edge |
| Paste opening | `0.80 mm x 0.80 mm` | Project reflow input, `0.05 mm` reduction per edge |
| Courtyard | `2.40 mm x 1.40 mm` | Project review envelope |

These values are deliberately labeled project inputs. They do not claim to
be Yageo, KEMET, IPC, or exact-orderable manufacturer guidance. The rendered
component uses pad 1 at negative local X and pad 2 at positive local X only as
a review datum. The capacitor is non-polar, has no pin-one requirement, and is
180-degree rotationally equivalent.

The machine-readable record and validator are
`src/bp031-032-c0603c104k3ractu-footprint-evidence.tsx`; the focused test
renders the actual tscircuit geometry, checks ports and no render errors, and
hash-binds the geometry. The validator fails closed on identity, package,
reference sets, source hash, PDF page binding, geometry, orientation, CAD
disposition, and release state. The current source-control snapshot binds
integration commit `55fcb34e7af21663ae534dcbf20882553359fa27`; its closure
and M4-04 hashes cover the current source records.

The same review-only evidence is linked to the seven BP-031
`C_REF_REG_HF_n` records and the eight BP-032 BP-123 reset/watchdog rows.
Those links establish reviewed-unapproved provenance only. They do not change
the candidate's CAD, artwork-acceptance, placement, release, or fabrication
deny states.

## Authority and open gates

- No official retained CAD object exists in this slice. `manufacturerCad` is
  `not-acquired` with authority `deny`.
- The project footprint is review-only; artwork authority, fabrication
  authority, release state, and `accepted` are all denied or false.
- No board, schematic, ledger, backlog, manifest, or existing source contract
  is edited by this slice.
- Root review must independently compare the final PCB-tool footprint and
  assembly orientation, decide whether exact manufacturer CAD exists, verify
  mask, paste, courtyard, and package clearances, and reconcile all listed
  references before any release decision.
