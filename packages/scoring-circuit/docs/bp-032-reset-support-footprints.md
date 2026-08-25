# BP-032 reset-support footprint evidence

Status: review-only candidate. Release and fabrication authority remain denied.

This slice records the exact selected reset-support parts used by the BP-032
reset/watchdog architecture:

| Reference | Exact MPN | Manufacturer package | Retained primary source |
| --- | --- | --- | --- |
| `U_APP_RESET_FANOUT` | `SN74LVC2G07DCKR` | TI `DCK`, SC70-6 | `docs/evidence/bp-032/ti-sn74lvc2g07-datasheet.pdf` |
| `Q_ESP_RESET_STM`, `Q_ESP_DEBUG_RESET` | `BSS138AKA` | Nexperia SOT23 | `docs/evidence/bp-032/nexperia-bss138aka-datasheet.pdf` |

## Evidence retained

The TI source is `SCES308L`, revision L, downloaded from the official TI
datasheet URL. Its SHA-256 is
`71BBB2FC452E2949B332C030B004B094BA679AC8CCE27123F806A0A6B1FDE660`.
The retained PDF contains 34 physical pages. PDF page 3 (printed page 3)
establishes the DCK top-view pin map. PDF page 11 (printed page 11)
establishes DCK0006A package and example-board dimensions: 0.65 mm pitch,
2.2 mm pad-row span, 0.9 mm x 0.4 mm exposed metal, and the preferred NSMD
maximum 0.07 mm mask surround. PDF page 12 is printed as `Addendum-Page 1`
and lists the exact active `SN74LVC2G07DCKR` orderable as `SC70 (DCK)`, six
pins. The exact-orderable binding is deliberately recorded separately from
`reviewedPrintedPages: [3, 11]`, which covers only the ordinary pin-map and
geometry pages.

The Nexperia source is the `BSS138AKA` product data sheet dated 2 February
2024. Its SHA-256 is
`39D145F3B39A916F88B21CF8E19C865437D200752A7CD37872EF976C2BFD69F9`.
Printed page 2 establishes the exact SOT23 orderable, 1.9 mm pitch, 2.9 mm x
1.3 mm x 1 mm body, and pin map: pin 1 gate, pin 2 source, pin 3 drain.
Printed page 12 Figure 19 provides the SOT23 reflow guidance used by the
candidate: three 0.6 mm x 0.7 mm solder lands, 1.9 mm upper-row pitch, and
1.4 mm upper-to-lower center span.

## Orientation and authority

The TI top view uses pin 1 at the upper-left. With the candidate at zero board
rotation, pins 1, 2, and 3 are the left row from top to bottom; pins 6, 5, and
4 are the right row from top to bottom. The Nexperia top view uses pin 1 at
the lower-left, pin 2 at the lower-right, and pin 3 at the upper center.
These are explicit assembly datums, not an independent approval.

The candidate geometry is project-review input derived from the cited
manufacturer drawings. No exact manufacturer CAD archive was retained for
either part, no board-library artwork is released, and no orientation,
courtyard, solder-mask, paste, schematic, or fabrication gate is accepted.
The machine-readable record and validator are
`src/bp032-reset-support-footprints.ts`; focused tests intentionally fail
closed on source hash, MPN/package, pin, pad, orientation, and CAD-authority
drift.

Required next steps are independent root review against the final PCB-tool
output, exact CAD/library retention where available, and reconciliation with
BP-123 and BP-033 before any fabrication authority is considered.
