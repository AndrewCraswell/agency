# BP-033 display-limiter 0402 footprint candidate

This prototype-first review slice covers exactly seven canonical BP-033 rows:

| Reference | Manufacturer | Exact MPN | Package | Role |
| --- | --- | --- | --- | --- |
| `R_DISPLAY_ILM` | Yageo | `RC0402FR-07698RL` | `0402` | TPS259474A ILM current-limit resistor |
| `C_DISPLAY_BYPASS` | KEMET | `C0402C104K3RACTU` | `0402` | V5 display input bypass |
| `C_DISPLAY_DVDT` | KEMET | `C0402C222K3RACTU` | `0402` | TPS259474A DVDT timing capacitor |
| `C_DISPLAY_ITIMER` | KEMET | `C0402C222K3RACTU` | `0402` | TPS259474A ITIMER retry capacitor |
| `R_DISPLAY_PG_PULLUP` | Yageo | `RC0402FR-0710KL` | `0402` | PG pull-up to V3_3 |
| `R_DISPLAY_PG_LOWER` | Yageo | `RC0402FR-0749K9L` | `0402` | PGTH lower leg to APP_GND |
| `R_DISPLAY_PG_UPPER` | Yageo | `RC0402FR-07137KL` | `0402` | PGTH upper leg to V5_DISPLAY_LIMITED |

The executable candidate is [`src/bp033-display-limiter-0402-footprint.tsx`](../src/bp033-display-limiter-0402-footprint.tsx), with focused tests in [`src/bp033-display-limiter-0402-footprint.test.tsx`](../src/bp033-display-limiter-0402-footprint.test.tsx).

## Exact source retention

Each orderable is bound to its own retained primary manufacturer specsheet. The URLs are official Yageo Group or KEMET search endpoints; no generic 0402 family substitution is accepted.

| Exact MPN | Primary URL | Retained artifact | SHA-256 | Reviewed page |
| --- | --- | --- | --- | --- |
| `RC0402FR-07698RL` | `https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-07698RL` | [`yageo-rc0402fr-07698rl-specsheet.pdf`](evidence/bp-033/yageo-rc0402fr-07698rl-specsheet.pdf) | `B22937845B9DD9352E2959C69AE306C0D74BD998FB072481640602BC469D1DC6` | 1 |
| `RC0402FR-0710KL` | `https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0710KL` | [`yageo-rc0402fr-0710kl-specsheet.pdf`](evidence/bp-033/yageo-rc0402fr-0710kl-specsheet.pdf) | `85ACEB87C42E4093DDDCD9563251F2E47E9EF8D0432D1F03B3A03FAEADD86BA3` | 1 |
| `RC0402FR-0749K9L` | `https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0749K9L` | [`yageo-rc0402fr-0749k9l-specsheet.pdf`](evidence/bp-033/yageo-rc0402fr-0749k9l-specsheet.pdf) | `B531815E39E63385D45860F0C737FF8627681D448DC3497AAE5D46157474EA2B` | 1 |
| `RC0402FR-07137KL` | `https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-07137KL` | [`yageo-rc0402fr-07137kl-specsheet.pdf`](evidence/bp-033/yageo-rc0402fr-07137kl-specsheet.pdf) | `7C76432DCDCB6DCC6D35F07B9281CC0EF5189AF5C9A26A7115FA8818F1B72D7B` | 1 |
| `C0402C104K3RACTU` | `https://search.kemet.com/component-documentation/download/specsheet/C0402C104K3RACTU` | [`kemet-c0402c104k3ractu-specsheet.pdf`](evidence/bp-033/kemet-c0402c104k3ractu-specsheet.pdf) | `889DE4201A2C26835545FC3BE215BE03637E2D3422FCC86B5FA5D96DBE0B30F1` | 1 of 4 |
| `C0402C222K3RACTU` | `https://search.kemet.com/component-documentation/download/specsheet/C0402C222K3RACTU` | [`kemet-c0402c222k3ractu-specsheet.pdf`](evidence/bp-033/kemet-c0402c222k3ractu-specsheet.pdf) | `54F836BE838A054C9E696CD8FDB0C9529A190E11B1372C2ADCD615CD97A22133` | 1 of 4 |

The KEMET retained files include simulation pages 2 through 4. Those pages are explicitly excluded from the exact orderable binding; only page 1 is used for identity, package, and electrical characteristics.

## Evidence and geometry separation

The Yageo sources bind 0402 / 1005 thick-film resistors with 1.00 mm by 0.50 mm body dimensions, 0.35 mm nominal thickness, 1 percent tolerance, and 0.063 W at 70 C. The four exact resistance values remain separate source records even though their package dimensions and review land geometry match.

The KEMET sources bind 0402 / 1005 X7R MLCCs with 1.00 mm by 0.50 mm body dimensions, 0.50 mm nominal thickness, 25 V rating, and 10 percent tolerance. `C0402C104K3RACTU` is 0.1 uF; `C0402C222K3RACTU` is 2.2 nF. They share a review geometry group because the exact source dimensions and two-terminal package envelope match for the project copper input, while their orderable facts and source records remain distinct.

Neither retained manufacturer specsheet publishes a finished copper land pattern, solder mask, paste, courtyard, or CAD object. The candidate therefore records those manufacturer fields as unavailable and keeps the following project-only review geometry separate from manufacturer facts:

- two rectangular SMT pads, 0.6 mm by 0.6 mm;
- pad centers at -0.5 mm and +0.5 mm on the local X axis, giving a 0.4 mm inner gap;
- 0.05 mm project solder-mask margin and 0.05 mm project paste reduction per edge;
- 1.6 mm by 1.1 mm project courtyard review rectangle;
- electrically non-polar orientation, with pad 1 at negative local X and pad 2 at positive local X.

The resistor and MLCC groups are rendered separately even though their copper review dimensions match. This preserves the different retained package thickness and source facts and prevents cross-family substitution.

## Authority gates

This is isolated review artwork and evidence only. The candidate explicitly denies manufacturer CAD import, project CAD import, board placement, project geometry acceptance, orientation acceptance, DRC, fabrication, and release. `accepted` remains `false`; the candidate is not imported into a board or canonical ledger.

Validation compares an independently frozen baseline using exact prototypes, own-key sets, data descriptors, descriptor flags, recursive values, and separate actual/expected seen sets. Cycles, aliases, sparse arrays, hidden fields, symbols, accessors, prototype changes, descriptor-flag changes, and throwing proxy traps fail closed.
