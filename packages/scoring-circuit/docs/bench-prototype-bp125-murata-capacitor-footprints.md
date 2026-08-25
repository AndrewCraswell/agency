# BP-125 Murata MLCC candidate footprints

This isolated review artifact supplies candidate tscircuit footprints for the
five Murata MLCC MPNs already selected by BP-125. It does not modify the
processor-support contract, processor-footprint ledger, backlog, or retained
evidence bytes. It is not instantiated on a board, is not accepted, and has no
fabrication authority.

Murata's retained `GCM21BR71E225KA73-01` reference sheet includes
JEMCGC-2702S page 25, Table 2, the GC-series reflow land guidance. In that
table, `a` is the inner copper gap, `b` is pad length, and `c` is pad width.
Murata requires an actual set and PCB evaluation to confirm a suitable land
dimension. This artifact therefore records midpoint or fixed selections only
as project review inputs, not released manufacturer CAD.

The selected MPN identities below are copied from the BP-125
processor-support contract baseline at main `7a3566b` and are bound to the
current contract source SHA-256
`DE4FCC8DE1FE349EF529F320D864C6D33D819874BB7E14254094469355430AB2`.
The candidate test hashes that source file and fails closed if the upstream
selection drifts. Each MPN has retained, SHA-256-bound Murata evidence. A
retained characteristic response supports the selected MPN's source part
number, but does not supply a body drawing, land pattern, or CAD. The only
retained land-pattern guidance used here is JEMCGC-2702S page 25 in the 0805
reference sheet.

## Source applicability and CAD disposition

JEMCGC-2702S page 25, Table 2 is the retained manufacturer-primary source for
the nominal package body and reflow land ranges used here. Its code-18,
code-21, and code-32 rows apply to the BP-125 selections solely because the
unchanged processor-support contract at main `7a3566b` assigns those parts to
0603 (1608M), 0805 (2012M), and 1210 (3225M), respectively. It is not
exact-MPN CAD, and it does not convert the candidate dimensions into a release.

On 2026-08-24, the official [Murata CAD-data
page](https://www.murata.com/en-global/tool/data/caddata) was audited. Murata
states that a CAD download button is shown on a part's product-detail page when
data is prepared. The exact PIM product-detail paths did not expose a
downloadable CAD artifact during the anonymous audit, so availability for each
of the five MPNs remains `not-confirmed`. The disposition is
`not-acquired-no-substitute`: do not replace this evidence with a generic,
distributor, or third-party footprint.

| Exact selected MPN | Package | Retained evidence | Official CAD disposition | SHA-256 |
| --- | --- | --- | --- | --- |
| `GCM188R71H103KA37D` | 0603 (1608M) | `murata-gcm188r71h103ka37-dcbias-tc125.json`, selected-MPN characteristic response | `not-confirmed`; `not-acquired-no-substitute` | `541BB5E1738D24528E43A654464F20365E90163A385C0B0E44ACA451B1319879` |
| `GCM188R71H104KA57D` | 0603 (1608M) | `murata-gcm188r71h104ka57-01a.pdf`, exact-MPN reference sheet | `not-confirmed`; `not-acquired-no-substitute` | `5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A` |
| `GCM21BR71E225KA73L` | 0805 (2012M) | `murata-gcm21br71e225ka73-01.pdf`, exact-MPN reference sheet and GC-series land guide | `not-confirmed`; `not-acquired-no-substitute` | `26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19` |
| `GCM32ER71E106KA57L` | 1210 (3225M) | `murata-gcm32er71e106ka57-dcbias-tc25.json`, selected-MPN characteristic response | `not-confirmed`; `not-acquired-no-substitute` | `8DECC721E40C71BB41FAEDE8037A5A50A1AB7A95E7403A3C0E6AD9D2DBBB53EC` |
| `GCM32EC71A476KE02L` | 1210 (3225M) | `murata-gcm32ec71a476ke02-dcbias-tc25.json`, selected-MPN characteristic response | `not-confirmed`; `not-acquired-no-substitute` | `6FB8BB5B26B094D92156968AF9DC9E56DD68F4E93D86817F7DBEF19D264F906D` |

| Package | MPN and exact references | Nominal body mm | Murata reflow `a` / `b` / `c` mm | Candidate copper pad and inner gap mm |
| --- | --- | --- | --- | --- |
| 0603 (1608M), code 18 | `GCM188R71H103KA37D`: `C_STM_VDDA_HF`; `GCM188R71H104KA57D`: `C_STM_VDD16`, `C_STM_VDD32`, `C_STM_VDD48`, `C_STM_VDD64`, `C_STM_VREF_HF`, `C_STM_VBAT`, `C_ESP_3V3_HF` | 1.60 by 0.80 | 0.6 to 0.8 / 0.6 to 0.7 / 0.6 to 0.8 | 0.65 by 0.70 pads, 0.70 gap |
| 0805 (2012M), code 21 | `GCM21BR71E225KA73L`: `C_STM_VDDA_BULK`, `C_STM_VREF_BULK` | 2.00 by 1.25 | 1.2 / 0.6 to 0.8 / 1.2 to 1.4 | 0.70 by 1.30 pads, 1.20 gap |
| 1210 (3225M), code 32 | `GCM32ER71E106KA57L`: `C_STM_3V3_BULK`; `GCM32EC71A476KE02L`: `C_ESP_3V3_BULK` | 3.20 by 2.50 | 2.0 to 2.4 / 1.0 to 1.2 / 1.8 to 2.3 | 1.10 by 2.05 pads, 2.20 gap |

The pads are separated along X, so Murata land-guide pad length `b` is rendered
as X `width`, and pad width `c` as Y `height`. The rendered-footprint test
derives the copper X minimum/maximum, inner gap, overall span, Y extent,
mask/paste apertures, and copper/body courtyard clearances from circuit
elements rather than trusting the candidate records. The pads use a 0.05 mm
project solder-mask expansion and a 0.05 mm per-edge project paste reduction.
Courtyards enclose both the copper and nominal body with at least 0.25 mm on
every side. They produce the following apertures and review-only courtyards:

| Package | Mask opening mm | Paste opening mm | Courtyard mm |
| --- | --- | --- | --- |
| 0603 (1608M) | 0.75 by 0.80 | 0.55 by 0.60 | 2.50 by 1.30 |
| 0805 (2012M) | 0.80 by 1.40 | 0.60 by 1.20 | 3.10 by 1.80 |
| 1210 (3225M) | 1.20 by 2.15 | 1.00 by 1.95 | 4.90 by 3.00 |

All terminals are electrically non-polar. There is no pin-one or assembly
orientation assertion. Before board use, layout and assembly review must choose
the orientation that minimizes PCB-bending stress and review routing axis,
local copper, solder volume, placement process, and assembled-board stress.

No exact-MPN manufacturer CAD was acquired or is claimed for any candidate.
Each candidate has `fabricationAuthority: "deny"` and `accepted: false`; it is
not instantiated on a board or included in a fabrication gate.
