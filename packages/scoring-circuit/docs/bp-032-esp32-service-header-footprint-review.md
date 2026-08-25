# BP-032 ESP32 service-header footprint evidence review

Status: prototype-first review candidate only. This artifact does not approve placement, mating, continuity, CAD, fabrication, assembly, acceptance, or release.

## Exact boundary

The candidate covers exactly `J_ESP_SERVICE` and no other board reference:

| Field | Frozen value |
| --- | --- |
| Board reference | `J_ESP_SERVICE` |
| BOM reference | `J_ESP32_SERVICE` |
| Header manufacturer and MPN | Samtec `TSW-106-07-G-S` |
| Header configuration | six positions, single row, 2.54 mm pitch, through-hole, straight `-07` lead, `-G` plating |
| BP-124 mating candidate | Samtec `SSW-106-01-G-S` |
| Mating configuration | six positions, single row, 2.54 mm pitch socket strip with solder tails |

The exact identity and pin order are inherited from `packages/scoring-circuit/src/bench-prototype-service-headers.ts` at SHA-256 `CD1967756EFDF98DBF31B1AB820D54B9306C8C8D7CA00541DAFD69E6435588EE`. The BP-121 ESP32 allocation source is `packages/scoring-circuit/src/bench-prototype-esp32-allocation.ts` at SHA-256 `F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B`. The BP-010 fixed-interface source is `packages/scoring-circuit/src/bench-prototype-contract.ts` at SHA-256 `87CBC75B3CE07D615C6959BE32434585F7B9ED9E4BA13EF98BA80803AC92DBF7`.

## BP-124 pinout

The row is recorded in pin-one order from the Samtec series figure and BP-124 contract:

| Pin | Net | Direction and electrical rule |
| ---: | --- | --- |
| 1 | `APP_GND` | adapter reference and ground |
| 2 | `APP_3V3_SENSE` | high-impedance sense only, never a power source |
| 3 | `UART0_TX` | board to adapter, 3.3 V CMOS |
| 4 | `UART0_RX` | adapter to board, 3.3 V CMOS |
| 5 | `BOOT_N` | adapter open-drain sink for the boot strap |
| 6 | `MANUAL_RESET_ASSERT` | 3.3 V control into the local reset-sink stage, never direct `EN_RESET` |

The service adapter must reference `APP_GND`, remain 3.3 V compatible, and never source either sense pin. 5 V TTL and RS-232 voltage are prohibited. `MANUAL_RESET_ASSERT` remains behind the BP-123 BSS138AKA gate network.

## Manufacturer evidence

No TSW or SSW evidence was retained at the start of this task. The candidate retains only the exact Samtec product pages and the two manufacturer series documents required to justify the bounded geometry.

| Evidence | SHA-256 | Use and limits |
| --- | --- | --- |
| [Samtec TSW-106-07-G-S product page](https://www.samtec.com/products/tsw-106-07-g-s), retained as `packages/scoring-circuit/docs/evidence/bp-032/samtec-tsw-106-07-g-s-product.html` | `63FBFCD4D6A549AC290422C5521D506DC19E6459B8DAC5F1B4CCF95385E60F55` | Exact MPN title, six pins, single row, through-hole, 0.100 in pitch, .025 in square post, .230 in post, .430 in overall length |
| [Samtec SSW-106-01-G-S product page](https://www.samtec.com/products/ssw-106-01-g-s), retained as `packages/scoring-circuit/docs/evidence/bp-032/samtec-ssw-106-01-g-s-product.html` | `58C262615BD231FD19EBD7BD33845CDB61563A71F8BE4CCD63B91CACF38F1855` | Exact mating MPN title, six pins, single row, 0.100 in pitch, Tiger Buy socket and solder-tail identity |
| [Samtec TSW series print Revision DS](https://suddendocs.samtec.com/prints/tsw-xxx-xx-xxx-x-xx-xxx-mkt.pdf), retained as `packages/scoring-circuit/docs/evidence/bp-032/samtec-tsw-series-print.pdf` | `047ECEDCC921FB0AED7127F08B9BA0FC1200D92D33FB7DED1B311D0ED8F42063` | Series decoding, `-07` lead style, `-G` plating, `-S` single row, pin-one end in Figure 3, mechanical tables 4 and 8 |
| [Samtec TSW through-hole footprint Revision A](https://suddendocs.samtec.com/prints/tsw-xxx-xx-x-x-xx-xxx-footprint.pdf), retained as `packages/scoring-circuit/docs/evidence/bp-032/samtec-tsw-through-hole-footprint.pdf` | `264658121FF2DAD25EBD6259E726B123BF1EA31F9145BC695607999181AF028F` | Recommended 0.100 in single-row pitch and typical 0.040 in finished-hole callout |

The product pages bind the exact orderable MPNs. The print and footprint are series-level documents. They justify the six-hole pitch and recommended finished-hole diameter, but they do not provide an exact CAD library item, copper annulus, mask expansion, paste, courtyard, placement keepout, or mating acceptance.

## Geometry and orientation

The review coordinate origin is the nominal center of the six-hole row in a top-side board view. The hole centers are:

| Pin | x (mm) | y (mm) | Net |
| ---: | ---: | ---: | --- |
| 1 | -6.35 | 0 | `APP_GND` |
| 2 | -3.81 | 0 | `APP_3V3_SENSE` |
| 3 | -1.27 | 0 | `UART0_TX` |
| 4 | 1.27 | 0 | `UART0_RX` |
| 5 | 3.81 | 0 | `BOOT_N` |
| 6 | 6.35 | 0 | `MANUAL_RESET_ASSERT` |

The six-position row span is 12.70 mm. The manufacturer typical finished-hole callout is 1.02 mm diameter. The manufacturer print gives a .635 mm square post cross-section, .230 in (5.84 mm) post length, and .430 in (10.92 mm) overall length. Its `-S` body rule gives `A +0.015/-0.015 in`, where six positions produce `A = 12.70 mm`; the recorded body envelope is therefore 12.70 mm to 13.46 mm. These are mechanical reference values, not a board courtyard.

Samtec Figure 3 places pin 1 at the first end of the straight single-row sequence. The candidate maps that first position to x = -6.35 mm. TSW-106-07-G-S and SSW-106-01-G-S are unkeyed and reversible. The candidate therefore requires a project pin-one mark and fixture-enforced reversal prevention, neither of which is supplied by the manufacturer footprint.

The series footprint does not publish copper annulus diameter or solder-mask expansion. The candidate records both as null and renders equal-diameter rounded through-hole centers solely as a review visualization. It emits no courtyard, keepout, paste, or inferred land geometry.

## Prototype handoff and miswire gates

An isolated coupon or temporary adapter may use a user-attached SSW socket or individually labeled wires after de-energized inspection. The board itself remains DNP.

- Anchor the temporary harness to the fixture or coupon body. No cable load may pass through TSW solder tails or board holes.
- Power off and discharge before every mate, unmate, continuity change, or rework operation.
- Verify exact MPN, six-pin order, pin-one mark, and row direction against the retained Samtec evidence.
- With power removed, continuity-check all six pins against the BP-124 table and reject swapped UART, BOOT, reset, ground, or sense conductors.
- Verify VDD-to-GND resistance, isolate `APP_3V3_SENSE`, and reject adapters capable of sourcing the sense pin.
- Use only a 3.3 V-compatible adapter. Do not apply 5 V TTL or RS-232 levels.

## Denied gates

The candidate source records `accepted: false`, `dnp: true`, and denies:

- CAD release and library acceptance
- copper annulus, solder-mask, paste, and courtyard release
- board placement, keepout, and assembly acceptance
- TSW to SSW mating fit, insertion, retention, and continuity acceptance
- fixture keying and reversal-prevention acceptance
- fabrication and production release
- electrical integration authority

Before any release, independently verify the exact overlay, pad annulus, mask and hole rules, package orientation, physical TSW to SSW fit, insertion and retention, continuity, no-back-power behavior, adapter voltage, fixture keying, and the complete BP-124 power-off and recovery sequence.

## Graph integrity

`packages/scoring-circuit/src/bp032-esp32-service-header-tsw-106-07-g-s-footprint-evidence.tsx` builds a private deep-frozen baseline and exports a separately `structuredClone`d and deep-frozen public graph. Its validator compares candidates against the private baseline using separate actual and expected seen sets. It rejects accessors, descriptor drift, symbols, sparse arrays, non-plain records, cycles, aliases, exact-MPN substitutions, pin-order changes, inferred land geometry, and any release-gate relaxation. The private baseline is not exported.

## Verification

The focused test is `packages/scoring-circuit/src/bp032-esp32-service-header-tsw-106-07-g-s-footprint-evidence.test.tsx`. The verification scope is the candidate, BP-124, and the package toolchain:

- focused and dependent Vitest tests
- scoring-circuit package type check
- targeted `oxlint`
- targeted `oxfmt --check`
- `git diff --check`, including the untracked candidate and review files

Observed in the isolated worktree: 5 Vitest files passed, 49 tests passed; the scoring-circuit TypeScript check passed; targeted oxlint passed; targeted oxfmt check passed; and tracked plus untracked-file diff checks reported no whitespace errors. The isolated worktree required `pnpm install --ignore-scripts --prefer-offline` before direct local tool binaries were available.

No canonical ledger, backlog, board, approval, staging, or commit change is part of this review candidate.
