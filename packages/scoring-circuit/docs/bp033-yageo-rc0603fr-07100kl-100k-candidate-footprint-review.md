# BP-033 Yageo RC0603FR-07100KL 100 kOhm candidate-footprint review

## Decision and exact scope

This is a three-row BP-033 footprint-evidence project-review candidate for the
exact Yageo `RC0603FR-07100KL` orderable. BP-033 owns the footprint-evidence
state for every affected row, while upstream work units retain their selection
provenance:

| Exact MPN | Manufacturer facts | Affected reference | Retained primary source |
| --- | --- | --- | --- |
| `RC0603FR-07100KL` | 100 kOhm, 1%, EIA 0603 / IEC 1608 | `R_W5500_INT_BIAS` | Ethernet selection contract `BP-140/BP-033`; exact Yageo source retained |
| `RC0603FR-07100KL` | 100 kOhm, 1%, EIA 0603 / IEC 1608 | `R_BUFFER_A_GATE_PD` | Carrier selection provenance `BP-144`; exact Yageo source retained |
| `RC0603FR-07100KL` | 100 kOhm, 1%, EIA 0603 / IEC 1608 | `R_BUFFER_B_GATE_PD` | Carrier selection provenance `BP-144`; exact Yageo source retained |

The retained primary source for all three rows is
`packages/scoring-circuit/docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf`,
page 1, SHA-256
`E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054`.

The source URL is the Yageo product specification:
<https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL>.
The retained one-page PDF binds the exact MPN, the 100 kOhm value, 1 percent
tolerance, 0603 / 1608 case code, and the published body dimensions. It does
not publish an exact copper land pattern, solder-mask opening, paste aperture,
courtyard, or manufacturer CAD object. The candidate never substitutes the
generic Yageo RC family, the `RC0603FR-0710KL` 10 kOhm orderable, or another
0603 resistor.

The executable candidate is
`src/bp033-yageo-rc0603fr-07100kl-100k-candidate-footprint.tsx` and its
focused test is the same stem with `.test.tsx`. The retained PDF is reused;
no duplicate evidence is added.

## Canonical application/display inventory reconciliation

The exact-MPN inventory at the audited commit contains exactly these three
rows. BP-033 owns the footprint-evidence closure for all three; the two
carrier rows retain BP-144 selection provenance:

| Inventory | Reference | Owner/source contract | Candidate treatment |
| --- | --- | --- | --- |
| `bench-prototype-application-footprints.ts` | `R_W5500_INT_BIAS` | Ethernet selection row, `BP-140/BP-033` | Included in `affectedReferences`; BP-033 footprint-evidence owner |
| `bench-prototype-application-footprints.ts` and `application-display-carrier-support.ts` | `R_BUFFER_A_GATE_PD` | HUB75 carrier selection row, `BP-144` | Included in `affectedReferences`; BP-144 provenance retained, BP-033 footprint-evidence owner |
| `bench-prototype-application-footprints.ts` and `application-display-carrier-support.ts` | `R_BUFFER_B_GATE_PD` | HUB75 carrier selection row, `BP-144` | Included in `affectedReferences`; BP-144 provenance retained, BP-033 footprint-evidence owner |

The two `R_BUFFER_*` rows remain included in the BP-033 candidate because this
closure owns their footprint evidence. They are not attributed to the W5500
bias source and are not silently transferred from BP-144 selection ownership.
The executable candidate records the mutable application and display inventory
paths as a root-integration handoff, with the exact required set
`R_W5500_INT_BIAS`, `R_BUFFER_A_GATE_PD`, and `R_BUFFER_B_GATE_PD`. It does not
use a full-file SHA-256 of a mutable canonical ledger as authority. Root must
revalidate the live ledgers and exact reference set during integration.

Stable upstream contracts remain bound in the candidate: `BP-140/BP-033`
provides the W5500 bias reference, value, rail, policy reason, and retained
Yageo source evidence; `BP-144` provides the two carrier references, exact
Yageo MPN/package/value, source URL, and selection provenance. A source or
package drift fails closed through the executable exact-row and contract
checks.

The Ethernet contract independently binds `R_W5500_INT_BIAS` to `V3_3`, the
100 kOhm weak pull-up, and the policy that `INTn` is polled over SPI without
allocating an ESP32 GPIO. That circuit behavior is a manufacturer/application
contract; it is not evidence that the resistor land pattern is approved. The
BP-144 carrier contract similarly establishes selection provenance only; it
does not approve the project footprint for those rows.

## Manufacturer facts versus project geometry

The Yageo sheet establishes the EIA 0603 / IEC 1608 package envelope:

- body length: 1.6 mm nominal, 1.5--1.7 mm;
- body width: 0.8 mm nominal, 0.7--0.9 mm;
- body thickness: 0.45 mm nominal, 0.35--0.55 mm;
- terminal length: 0.25 mm nominal, 0.1--0.4 mm; and
- two terminals.

Those are manufacturer facts only. Exact manufacturer land-pattern guidance,
CAD, mask, paste, and courtyard data are absent, so their authority remains
`deny`.

The candidate's separate project review input uses the existing 0603 review
geometry: two 0.9 mm by 0.9 mm rectangular SMT pads with a 0.5 mm edge gap,
0.05 mm solder-mask expansion, 0.05 mm paste reduction, and a 2.4 mm by
1.4 mm courtyard. Pad 1 is at negative local X and pad 2 at positive local X
in the chosen project datum. The resistor is non-polar and 180-degree
rotationally equivalent; pin-one polarity is not applicable. This is generated
review artwork, not manufacturer CAD or released board artwork. Its rendered
geometry SHA-256 is
`C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8`.

## Gate disposition

All authority gates remain denied: manufacturer land pattern, manufacturer
CAD, board placement, fit/clearance, thermal, schematic integration,
mechanical load, assembly process, acceptance, release, and fabrication.
The project footprint remains `accepted: false`. The source and exact row
binding are review evidence only; they do not authorize CAD import, placement,
DRC, thermal or assembly sign-off, fabrication, or release.

The candidate's private frozen baseline compares exact prototypes, own-key
sets including non-enumerable and symbol keys, data-property descriptors and
their enumerable/configurable/writable flags, and separate actual/expected
object seen sets. Accessors, proxies, sparse arrays, null-prototype objects,
cycles, aliases, changed MPN/source/package fields, and reference-set drift
are rejected fail-closed. The focused test exercises these adversarial cases.

## Verification

The focused Vitest test must pass together with its dependent BP-032 Yageo
source test and the canonical application-footprint validator. Package type
checking, targeted `oxlint`, targeted `oxfmt --check`, and a three-file diff
scope check are required. No ledger, backlog, board, closure, staging,
approval, or commit action is part of this candidate.
