# BP-033 Littelfuse 0451 common-fuse footprint evidence

This is a bounded BP-033 review artifact for the three canonical fuse
references. It proves whether one exact Littelfuse 451 package and copper land
pattern can cover all three orderables. It is not imported by a board model and
does not authorize current, thermal, placement, routing, release, assembly, or
fabrication work.

## Exact orderables and common-package decision

The canonical references bind these exact orderables:

| Reference | Manufacturer | Exact MPN | Nominal current | Amp code |
| --- | --- | --- | ---: | --- |
| `F_APPLICATION` | Littelfuse | `0451002.MRL` | 2 A | `002.` |
| `F_DISPLAY` | Littelfuse | `045106.3MRL` | 6.3 A | `06.3` |
| `F_SCORING` | Littelfuse | `0451.500MRL` | 0.5 A | `.500` |

The retained source covers all three as Littelfuse NANO2 451-series, MRL
two-end-cap ceramic surface-mount fuses. The page-2 electrical rows vary by
ampere rating: amp code, nominal cold resistance, nominal melting I2t,
interrupting rating, and agency data are not interchangeable. For package and
copper-land applicability, no distinction is published for these three exact
451 MRL orderables, so this slice accepts only the common package/land-pattern
coverage decision. Generic family substitution remains denied: the three exact
MPNs are still bound independently.

## Retained manufacturer evidence

The source is the official [Littelfuse 451/453 Series Fuse
Datasheet](https://www.littelfuse.com/assetdocs/fuse-451-and-453-datasheet?assetguid=533cd5cc-956c-4243-867f-6ab5a62f6ba1),
revision `GD. 12/01/25`, retained at
`docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf` with SHA-256
`399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2`.

Page 2 binds the three exact amp codes and ratings. Page 4 binds the common
package and the `Recommended pad layout`. The package drawing gives a ceramic
body of `6.10 +/-0.20 mm` by `2.69 +/-0.25 mm` by `2.69 +/-0.25 mm`, with two
end-cap terminals. It shows no exposed central thermal pad. The non-polar
disposition is a design inference from the two-end-cap drawing with no polarity
or pin-one marking; Littelfuse does not state polarity on the reviewed pages.
Pad 1 and pad 2 are therefore treated as arbitrary electrical end-cap
assignments, and 180-degree reversal is electrically equivalent. Marking
readability and assembly orientation remain unreviewed.

## Copper land transcription

`src/bp033-littelfuse-0451-fuses.tsx` emits an isolated two-pad review
transcription of the page-4 recommended copper layout. The rendered
two-pad/no-paste geometry digest is SHA-256
`B127B7445657B735B30DF96B333D8B6EDD9C7154634DF032AFCC97C78E0EE2C0` for all
three references; it is recorded in the source artifact and remains
review-only:

| Dimension | Value | Disposition |
| --- | ---: | --- |
| Pad length along fuse axis | `1.96 mm` | manufacturer-published nominal |
| Pad width across fuse axis | `3.15 mm` | manufacturer-published nominal |
| Copper gap | `2.95 mm` | manufacturer-published nominal |
| Pad-center spacing | `4.91 mm` | derived from the published pad and gap values |
| Rendered outer copper span | `6.87 mm` | derived from the rendered geometry |

The source drawing labels the overall recommended-layout span as `6.86 mm`; it
is retained as a source dimension even though the rounded pad and gap labels
derive a rendered span of `6.87 mm`. This one-hundredth-millimetre rounding
discrepancy is documented, not silently normalized.

The source does not publish solder-mask openings, paste apertures, a courtyard,
or a first-party CAD object. Those fields remain not published and unaccepted.
The candidate emits no courtyard or thermal pad and carries no fabrication
authority.

## Deny state and review boundary

The module binds source path and hash, exact MPN, package, terminal count,
non-polar orientation, page-4 copper geometry, and the three reference
mappings. It deliberately keeps all release gates denied:

- current-rating/continuous-derating review: not accepted;
- thermal review: not accepted;
- board fit and placement review: not accepted;
- release and fabrication authority: `deny`.

The review-only artifact is validated by
`src/bp033-littelfuse-0451-fuses.test.tsx`. No canonical ledger, BOM, backlog,
board, or shared source is changed by this slice. Canonical application-ledger
and power-contract tests cross-check the three mappings without granting
footprint or fabrication credit. Root review remains pending; this artifact
does not claim root approval.
