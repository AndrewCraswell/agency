# BP-125 processor footprint reconciliation

This review-only slice binds the selected processors to their retained primary
sources and the isolated candidate footprints already owned by `BP-032`. It
does not import either footprint into a board, alter a schematic, or authorize
fabrication.

The executable reconciliation is
[`bench-prototype-bp125-processor-footprint-reconciliation.ts`](../src/bench-prototype-bp125-processor-footprint-reconciliation.ts)
and its focused test is
[`bench-prototype-bp125-processor-footprint-reconciliation.test.tsx`](../src/bench-prototype-bp125-processor-footprint-reconciliation.test.tsx).

## Exact identities and evidence

| Reference | Exact orderable | Candidate | Retained primary evidence |
| --- | --- | --- | --- |
| `U_SCORING` | `STM32G474RET3TR` | BP-032 LQFP64 candidate, 64 pads | [ST DS12288 Rev 6](evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf), SHA-256 `B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD` |
| `U_APP` | `ESP32-S3-WROOM-1U-N16R2` | BP-032 WROOM-1U candidate, 40 perimeter pads and exposed ground pad 41 | [Espressif WROOM-1/WROOM-1U v1.8](evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf), SHA-256 `27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435` |

The STM32 candidate uses DS12288 Table 124 and Figures 62 through 64. The
module candidate uses Espressif Table 1-2 and Figures 10-2 and 11-2. The
selected `WROOM-1U` is the external-antenna module: the 18 mm by 19.2 mm by
3.2 mm body and connector clearance are not interchangeable with the
PCB-antenna WROOM-1 variant.

## Checklist boundary

The slice checks source identity, candidate geometry counts, the frozen BP-120,
BP-121, and BP-125 selections, and that all release gates remain denied. It
does not claim an independent CAD overlay, external-antenna cable or enclosure
review, EPAD via and paste review, stencil apertures, courtyard approval,
power-sequence measurement, schematic sign-off, or fabrication authority.

See the source citations and unresolved gate list in
[`bp125-processor-footprint-source-checklist.md`](evidence/bp-125/bp125-processor-footprint-source-checklist.md).
