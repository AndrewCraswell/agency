# BP-032 Murata processor-support capacitor candidate footprints

This isolated `BP-032` review artifact makes the existing `BP-125` Murata
processor-support capacitor selection root-reviewable without changing the
processor ledger, convergence state, backlog, board models, or retained
evidence bytes. It is not instantiated on a board, is not accepted, and has
no fabrication or release authority.

The executable candidate and focused test are
[`bench-prototype-bp125-murata-capacitor-footprints.tsx`](../src/bench-prototype-bp125-murata-capacitor-footprints.tsx)
and
[`bench-prototype-bp125-murata-capacitor-footprints.test.tsx`](../src/bench-prototype-bp125-murata-capacitor-footprints.test.tsx).
The exported review projection contains exactly 12 rows, all with
`footprintEvidenceState: "not-started"`.

## Upstream selection revalidation

The private independent baseline in the executable artifact was revalidated
against the current
`packages/scoring-circuit/src/bench-prototype-processor-support.ts` bytes.
The source selection was originally frozen at baseline commit `7a3566b`; the
current source SHA-256 is
`6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20`.
The baseline is deliberately not imported from the processor-support module,
so a source edit cannot make this candidate validate itself.

| Exact MPN | Candidate package | Exact characteristic or reference-sheet evidence | References | Review state |
| --- | --- | --- | --- | --- |
| `GCM188R71H104KA57D` | 0603 (1608M) | Retained exact-MPN reference sheet, SHA-256 `5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A` | `C_STM_VDD16`, `C_STM_VDD32`, `C_STM_VDD48`, `C_STM_VDD64`, `C_STM_VREF_HF`, `C_STM_VBAT`, `C_ESP_3V3_HF` | `not-started` |
| `GCM188R71H103KA37D` | 0603 (1608M) | Retained selected-MPN characteristic response, SHA-256 `541BB5E1738D24528E43A654464F20365E90163A385C0B0E44ACA451B1319879` | `C_STM_VDDA_HF` | `not-started` |
| `GCM21BR71E225KA73L` | 0805 (2012M) | Retained exact-MPN reference sheet, SHA-256 `26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19` | `C_STM_VDDA_BULK`, `C_STM_VREF_BULK` | `not-started` |
| `GCM32ER71E106KA57L` | 1210 (3225M) | Retained selected-MPN characteristic response, SHA-256 `8DECC721E40C71BB41FAEDE8037A5A50A1AB7A95E7403A3C0E6AD9D2DBBB53EC` | `C_STM_3V3_BULK` | `not-started` |
| `GCM32EC71A476KE02L` | 1210 (3225M) | Retained selected-MPN characteristic response, SHA-256 `6FB8BB5B26B094D92156968AF9DC9E56DD68F4E93D86817F7DBEF19D264F906D` | `C_ESP_3V3_BULK` | `not-started` |

The reference multiplicities are exactly seven
`GCM188R71H104KA57D` rows, one `GCM188R71H103KA37D` row, two
`GCM21BR71E225KA73L` rows, one `GCM32ER71E106KA57L` row, and one
`GCM32EC71A476KE02L` row. The candidate test also hashes the current
processor-support source and rejects MPN, reference, package, evidence, or
geometry drift before a candidate could be reused.

## Evidence boundary and land guidance

The exact-MPN entries above are source-part evidence. A retained Murata
characteristic response is typical characterization for that selected source
part; it is not exact-MPN CAD, a guaranteed lot result, an assembled-board
result, or a released capacitance claim.

The only land guidance used by these candidates is the common Murata GC-family
guide `JEMCGC-2702S`, page 25, Table 2 Reflow Soldering Method, retained in
`evidence/bp-125/murata-gcm21br71e225ka73-01.pdf` with SHA-256
`26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19`. Its
package-code rows apply as family-level manufacturer guidance to codes 18, 21,
and 32. They are project review inputs, not exact-MPN manufacturer CAD. No
generic, distributor, or third-party footprint substitutes for unavailable
exact-MPN CAD.

## Denied release boundary

Every candidate keeps `manufacturerCad.state: "not-acquired"`,
`manufacturerCad.authority: "deny"`, `fabricationAuthority: "deny"`, and
`accepted: false`. Orientation and assembled-board stress remain pending.
The candidate is therefore suitable for root review of identity, evidence,
references, and project geometry only; processor-support approval, board
placement, CAD import, fabrication, and release remain denied.
