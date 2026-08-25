# BP-032 supervisor and watchdog footprint evidence review

Status: prototype-first review candidate only. This document does not approve a board footprint, placement, CAD library item, assembly, fabrication, or production release.

## Boundary and exact references

BP-123 freezes exactly four supervisor and watchdog references. The candidate source binds those references without adding any other part:

| Reference | BP-123 exact MPN | Package drawing | Domain | Role |
| --- | --- | --- | --- | --- |
| `U_STM_SUPERVISOR` | `TPS389033DSER` | `DSE0006A` | `SCORING_3V3` | scoring-rail supervisor |
| `U_ESP_SUPERVISOR` | `TPS389033DSER` | `DSE0006A` | `V3_3` | application-rail supervisor |
| `U_STM_WATCHDOG` | `TPS3431SDRBR` | `DRB0008A` | `SCORING_3V3` | scoring-rail watchdog |
| `U_ESP_WATCHDOG` | `TPS3431SDRBR` | `DRB0008A` | `V3_3` | application-rail watchdog |

The exact identity is an orderable-part claim. The land pattern is a package-level datasheet example. A package drawing that is shared by several orderables is not an exact released CAD footprint, and this candidate does not pretend otherwise.

The source of truth for the exact selection is `packages/scoring-circuit/src/bench-prototype-reset-watchdog.ts`, SHA-256 `0F10F1E308C0B3760C38A5A30405D727F1115BFFAC1C3F141D8EAF8789DD7E23`. The related BP-123 review fragment is `packages/scoring-circuit/src/bp-123-reset-watchdog-fragment.circuit.tsx`, SHA-256 `4E5B3A84F6B1F22F233665B94AED9CAFF3151446D4272250D25E090619AF822C`, with geometry and net digest `fb93b8246349389cb25c7ff69aba7d0ec0257dc5681c2ccd0161f345cbf21958`.

## Manufacturer sources and provenance

Both retained artifacts are Texas Instruments series datasheets. Exact MPN identity is tied to the orderable addendum row. Package dimensions, pad coordinates, solder-mask examples, and stencil examples remain package-level evidence.

| Exact MPN | Retained source and SHA-256 | Exact orderable evidence | Package geometry evidence |
| --- | --- | --- | --- |
| `TPS389033DSER` | [TI TPS3890 datasheet](https://www.ti.com/lit/ds/symlink/tps3890.pdf), `packages/scoring-circuit/docs/evidence/bp-032/ti-tps3890.pdf`, `EE79599730E7606BA9718D9820B411020E3DCD9FF7D44572F8EE63FEAD15B9D0` | Page 19: `TPS389033DSER`, `WSON (DSE) | 6` | Pages 24 to 26: `DSE0006A` package outline, example board layout, mask details, and 0.125 mm stencil example |
| `TPS3431SDRBR` | [TI TPS3431 datasheet](https://www.ti.com/lit/ds/symlink/tps3431.pdf), `packages/scoring-circuit/docs/evidence/bp-032/ti-tps3431.pdf`, `99BF5DBFFFE06E8F85D9A86CFB777A0151E85B4A103033BC025F4897A0BDC6F3` | Page 23: `TPS3431SDRBR`, `SON (DRB) | 8` | Pages 28 to 30: `DRB0008A` package outline, example board layout, mask details, and stencil example |

The functional pin maps are also visible on page 3 of each series datasheet. The source records page 3 together with the exact orderable page and package pages so that exact MPN identity is not inferred from a series title alone.

## Transcribed geometry

### `TPS389033DSER`, DSE0006A, WSON-6

- Nominal body is 1.5 mm by 1.5 mm with 0.8 mm maximum height. The package limits recorded in the candidate are 1.45 mm to 1.55 mm for width and length.
- Six perimeter pads are 0.7 mm by 0.25 mm on 0.5 mm side-row pitch, with row centers at x = -0.6 mm and x = 0.6 mm and a 1.0 mm row span.
- Pin order is 1 SENSE, 2 GND, 3 MR, 4 VDD, 5 CT, 6 RESET. Pin 1 is the upper-left pad in the TI top view at (-0.6 mm, 0.5 mm) in the nominal candidate coordinate system.
- TI shows SMD mask treatment for pads 1 to 3 with a 0.05 mm minimum opening overlap and NSMD preferred for pads 4 to 6 with a 0.05 mm maximum opening expansion.
- TI's stencil example is based on a 0.125 mm stencil with six 0.7 mm by 0.25 mm apertures. It is retained as review data only.
- No exposed thermal pad is shown. No courtyard is published, and none is inferred.

### `TPS3431SDRBR`, DRB0008A, VSON-8

- Nominal body is 3 mm by 3 mm with 1 mm maximum height. The package limits recorded in the candidate are 2.9 mm to 3.1 mm for width and length.
- Eight perimeter pads are 0.6 mm by 0.31 mm on 0.65 mm side-row pitch, with row centers at x = -1.1 mm and x = 1.1 mm and a 1.95 mm row span.
- Pin order is 1 VDD, 2 CWD, 3 EN, 4 GND, 5 SET1, 6 WDI, 7 WDO, 8 ENOUT. Pin 1 is the upper-left pad in the TI top view at (-1.1 mm, 0.975 mm) in the nominal candidate coordinate system.
- The exposed GND thermal pad example is 1.5 mm by 1.75 mm. TI shows four optional 0.2 mm vias at (0, 0.625), (-0.625, 0), (0.625, 0), and (0, -0.625) mm.
- TI's mask example prefers NSMD with a 0.07 mm maximum opening expansion and gives a 0.07 mm minimum overlap alternative for SMD treatment.
- TI's stencil example uses a 0.125 mm stencil and reports 84 percent printed thermal-pad coverage inside a 1.34 mm by 1.55 mm envelope. The aperture segmentation is not transcribed.
- No courtyard is published, and none is inferred.

The React renderers intentionally emit the named copper pads and the DRB thermal-pad/via example without a courtyard. They are isolated review renderers and are not imported by a board circuit.

## Safe prototype handoff

The candidate may be used to prepare an isolated coupon or adapter for a bench experiment. It is not a release footprint.

- After an independent pin-one inspection, short insulated pigtails may be soldered to named coupon pads only. For DSE0006A those points are pins 1 through 6 in the SENSE, GND, MR, VDD, CT, RESET order. For DRB0008A they are pins 1 through 8 in the VDD, CWD, EN, GND, SET1, WDI, WDO, ENOUT order, plus the EP GND pad.
- Anchor each pigtail or probe lead to the coupon or fixture body. No tensile load may pass through package lands, solder fillets, the exposed pad, or the thermal-via array.
- With power removed, verify package, exact MPN, pin-one index, pad numbering, continuity, and absence of shorts between VDD, GND, reset, and watchdog-output points. Check VDD-to-GND resistance before inserting the IC, current-limit first power-up, and remove power before rework.
- Pad geometry does not establish open-drain pullups, reset polarity, watchdog timing, or BP-123 topology. Those remain electrical-contract and measurement gates.

## Denied gates and remaining evidence

The candidate records `accepted: false` and denies mechanical acceptance, placement acceptance, CAD release, fabrication release, assembly release, and electrical-integration authority. It includes no board placement, courtyard, keepout, thermal solution, return-path analysis, DRC, stencil release, panelization, fabricator approval, or physical sample evidence.

Before any release decision, the following remain required:

- Independent overlay against the exact package drawing and current fabricator rules, including pad numbering and pin-one orientation.
- Package sample fit, placement, courtyard and keepout review, thermal and return-path review, and assembly review.
- An official CAD artifact or separately reviewed library reconstruction if release geometry is required.
- DRC, stencil, panel, and fabricator acceptance.
- BP-123 electrical and physical capture gates.

## Graph integrity

`packages/scoring-circuit/src/bp032-supervisor-watchdog-footprint-evidence.tsx` constructs a private deep-frozen baseline and exports a separately `structuredClone`d and deep-frozen public graph. The validator compares an input candidate with the private baseline using separate actual and expected seen sets. It rejects cycles, aliases, accessors, symbols, sparse arrays, non-plain records, descriptor drift, part substitutions, and any relaxation of denied gates. The private baseline is not exported.

## Verification

The focused test is `packages/scoring-circuit/src/bp032-supervisor-watchdog-footprint-evidence.test.tsx`. Verification is limited to the candidate and its dependent BP-123 contracts:

- focused and dependent Vitest tests
- scoring-circuit package type check
- targeted `oxlint`
- targeted `oxfmt --check`
- `git diff --check`

Observed in the isolated worktree: 4 Vitest files passed, 24 tests passed; the scoring-circuit TypeScript check passed; targeted oxlint passed; targeted oxfmt check passed; and tracked plus untracked-file diff checks reported no whitespace errors. The worktree dependency bootstrap required `pnpm install --ignore-scripts --prefer-offline` before direct local tool binaries were available.

No staging, commit, approval, closure, backlog, board, convergence, or canonical-ledger change is part of this candidate.
