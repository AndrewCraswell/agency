# BP-032 exact STM32G474RET3TR LQFP64 project-footprint review

This isolated candidate binds the single canonical scoring reference `U_SCORING`
to the exact orderable `STM32G474RET3TR`. It is review evidence only. It does
not alter the canonical ledger, BP-120 allocation, BP-125 reconciliation, a
schematic, a board, or a fabrication release.

The executable candidate is
[`bp032-stm32g474ret3tr-lqfp64-project-footprint.tsx`](../src/bp032-stm32g474ret3tr-lqfp64-project-footprint.tsx)
and its focused test is
[`bp032-stm32g474ret3tr-lqfp64-project-footprint.test.tsx`](../src/bp032-stm32g474ret3tr-lqfp64-project-footprint.test.tsx).

## Exact orderable and retained manufacturer evidence

| Field | Bound value |
| --- | --- |
| Canonical reference | `U_SCORING` |
| Manufacturer | STMicroelectronics |
| Exact orderable | `STM32G474RET3TR` |
| Package | `LQFP64`, 64 perimeter leads, no exposed thermal pad |
| Primary source | STMicroelectronics `STM32G474xB STM32G474xC STM32G474xE`, DS12288 Rev 6 |
| Retained source | [`st-stm32g474re-ds12288-rev6-datasheet.pdf`](evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf) |
| Retained source SHA-256 | `B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD` |
| Printed source pages | Identity: 1, 2, 3, 232. LQFP64 outline, mechanical data, recommended land pattern, and top view: 210, 211, 212. |
| Identity evidence | Table 124 ordering-information scheme decodes the `R` 64-pin, `T` LQFP, `3` temperature, and `TR` tape-and-reel fields. |
| Geometry evidence | Figure 62 outline, Table 115 mechanical data, Figure 63 recommended footprint, Figure 64 LQFP64 top-view orientation; drawing code `ai14909c`. |

The retained PDF is reused from BP-125; this candidate intentionally adds no
duplicate manufacturer evidence under `docs/evidence/bp-032`.

## Manufacturer facts versus project geometry

Manufacturer facts are kept in `package` and `source`: nominal
10 mm by 10 mm body, 1.35/1.40/1.45 mm height range, 0.5 mm lead pitch, and
Figure 63's 0.3 mm tangential by 1.2 mm radial recommended copper. The
recommended copper spans are 10.3 mm inner pad edge, 12.7 mm outer pad edge,
and 7.8 mm tangential outer edge.

The project review geometry is separate: 0.05 mm solder-mask expansion,
0.05 mm paste reduction, 13.2 mm courtyard with 0.25 mm clearance, and a
0.25 mm pin-one silkscreen circle centered at (-5.35, -5.35) mm. The candidate
renders 64 rectangular perimeter pads with pin 1 at (-3.75, -5.75) mm and
zero-degree board rotation. Pins 1-16 run left-to-right on the bottom edge,
17-32 bottom-to-top on the right, 33-48 right-to-left on the top, and 49-64
top-to-bottom on the left. Orientation remains `pending-independent-review`;
the project marker and rotation are not an assembly approval.

LQFP64 has no exposed pad in the retained package drawings. The candidate
therefore records `present: false` and `padNumber: null`; it does not invent a
thermal pad, via pattern, or paste strategy.

## BP-120 allocation binding

The candidate carries a private, frozen snapshot of the complete BP-120
`STM32G474RET3TR` / `LQFP64` allocation: all 64 pin, pad-name, and net tuples;
the exact 64-entry package map; one-channel ADS8881 acquisition (`PA4` pin 18
CONVST, `PA5` pin 19 SPI1 SCK, `PA6` pin 20 SPI1 MISO); the denied BP-103
seven-channel daisy-chain plan; isolated SPI3 nets and control pins; safe
states; clock and backup-domain notes; and BP-120's denied authority fields.

The private snapshot is independently compared with the current canonical
BP-120 source in the focused test and records the canonical source SHA-256:

`stm32-pin-allocation.ts` —
`4CF3FF02889064C204BD5FC7557719E9501925AC99677F0F2825291E066EF2F3`

The BP-125 reconciliation binding is also recorded by path and SHA-256:

`bench-prototype-bp125-processor-footprint-reconciliation.ts` —
`3FF36883B336525E50503DF8F45E70F6E6CD453A9FE57070470C597FDD5130C1`

## Descriptor-safe, fail-closed validation

Validation compares the supplied value to an independently cloned and frozen
baseline. It reads only own data descriptors and requires exact enumerable,
configurable, and writable flags. Separate actual and expected seen sets reject
cycles and aliases in either graph. Accessors, sparse arrays, throwing proxy
traps, prototype changes including null-prototype substitution, hidden
properties, symbol properties, pad-map drift, exact-MPN/source drift,
exposed-pad changes, and authority changes all fail closed. The test suite
exercises each mutation class and confirms a getter is never invoked. The
candidate graph is frozen, but the validator treats any external value as
hostile and catches reflective or validation failures before returning errors.

## Explicit deny gates

The following remain denied and are not implied by the geometry render:

- exact-orderable manufacturer CAD import (`not-acquired`, no retained CAD hash)
- independent orientation acceptance and placement review
- schematic integration or BP-120 electrical sign-off
- courtyard, mask web, paste aperture, assembly, or fabrication approval
- measured clock, reset, power, safe-state, acquisition, timing, or crosstalk proof
- board import, fabrication authority, scoring authority, and release (`deny`)

## Verification

The focused test covers source bytes/pages, exact identity, full BP-120 snapshot,
package and orientation geometry, rendered pad/paste/courtyard/marker counts,
freeze behavior, and adversarial descriptor-safe mutations. Root review should
run the focused/dependent tests, scoring-circuit package type-check, targeted
`oxlint`, `oxfmt --check`, and a diff check before deciding whether to retain
this candidate.
