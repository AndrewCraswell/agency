# BP-031 Vishay RCWE0603R220FKEA footprint-evidence review

## Outcome

`RCWE0603R220FKEA` remains a project-selected identity for the seven BP-031
reference-feed resistors. No official Vishay source located in this review
names that complete orderable as an individual product record, drawing, or CAD
object. It is therefore not exact-orderable manufacturer evidence.

The retained evidence is deliberately split:

| Evidence class | Source | Permitted claim |
| --- | --- | --- |
| Project identity | `packages/scoring-circuit/src/one-channel-analog-readiness.ts` | The project selects `RCWE0603R220FKEA` at 0.22 ohm for `R_REF_SAR`. |
| Manufacturer series | Vishay RCWE datasheet 20019, revision 24-Oct-2023 | RCWE0603 package limits and the 0.033 to 0.976 ohm 0603 reflow land-pattern row. |
| Exact manufacturer orderable | Not acquired | No exact-MPN package, CAD, mask, paste, courtyard, or release claim. |

The source graph and its executable validator are frozen. The public reference
list is a separately frozen clone; the private baseline does not reuse any
exported object. Validation accepts only a plain-data graph that exactly
matches the private frozen baseline. Separate actual and expected identity
sets reject aliases and cycles, while accessors, proxies, changed values, and
added properties also fail closed. A clean validation result still does not
grant fabrication authority.

## Affected references

The project canonical source defines the base reference `R_REF_SAR`. BP-031
uses its seven replicated instances:

| Reference | Exact project-selected MPN | Evidence scope |
| --- | --- | --- |
| `R_REF_SAR_1` | `RCWE0603R220FKEA` | Project identity plus RCWE0603 series geometry only |
| `R_REF_SAR_2` | `RCWE0603R220FKEA` | Project identity plus RCWE0603 series geometry only |
| `R_REF_SAR_3` | `RCWE0603R220FKEA` | Project identity plus RCWE0603 series geometry only |
| `R_REF_SAR_4` | `RCWE0603R220FKEA` | Project identity plus RCWE0603 series geometry only |
| `R_REF_SAR_5` | `RCWE0603R220FKEA` | Project identity plus RCWE0603 series geometry only |
| `R_REF_SAR_6` | `RCWE0603R220FKEA` | Project identity plus RCWE0603 series geometry only |
| `R_REF_SAR_7` | `RCWE0603R220FKEA` | Project identity plus RCWE0603 series geometry only |

## Manufacturer search and retained source

The official Vishay RCWE product page and datasheet were searched for the
complete string `RCWE0603R220FKEA`. Neither result named the exact orderable.
The datasheet does publish the RCWE ordering-field grammar: `RCWE0603`, `R220`,
`F`, `K`, and `EA` can be decoded as the series and size, 0.22 ohm value, 1
percent tolerance, 100 ppm per degree Celsius TCR, and Pb-free tape-and-reel
packaging. That grammar shows the selected string is syntactically consistent
with the series. It does not establish that Vishay offers the complete string,
does not bind a manufacturing lot or revision, and does not turn a series
drawing into exact-orderable evidence.

The retained manufacturer artifact is
`packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf`,
Vishay document 20019, revision 24-Oct-2023, SHA-256
`5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374`.
The authoritative online locations checked were the
[Vishay RCWE product page](https://www.vishay.com/en/product/20019/) and the
[Vishay RCWE datasheet](https://www.vishay.com/docs/20019/rcwe.pdf).

The 0603 row for the applicable 0.033 to 0.976 ohm series range supplies a
0.70 millimeter pad length, 1.00 millimeter pad width, and 0.80 millimeter
inner gap. These are series reflow-land inputs only. The project candidate
derives its review copper from them, while its mask, paste, courtyard, and
assembly orientation remain project review inputs.

## Release boundary and remaining blockers

The candidate remains `review-only`, `accepted: false`, and
`fabricationAuthority: deny`. It does not update the shared closure, ledger,
board, or BOM.

Before these seven reference mappings can be treated as exact-orderable
manufacturer-backed footprint evidence, retain at least all of the following:

1. An official Vishay document, orderable record, or written manufacturer
   response that names `RCWE0603R220FKEA` and binds its package and electrical
   attributes.
2. An official exact-orderable CAD object, or a manufacturer statement that
   the exact orderable has no CAD object.
3. Manufacturer-specific mask, stencil, and courtyard data, or separately
   reviewed project process rules that explicitly authorize those derivations.
4. Independent assembly-orientation, board-fit, artwork, and fabricator review
   followed by the required release decision outside this review slice.

Until then, a distributor listing may assist procurement discovery but cannot
close this manufacturer-evidence gap or authorize fabrication.
