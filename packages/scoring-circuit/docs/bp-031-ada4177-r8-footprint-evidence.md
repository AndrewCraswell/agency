# BP-031 ADA4177-1ARZ R-8 footprint evidence

This is a bounded, review-only footprint record for the exact `ADA4177-1ARZ`
orderable. It retains the primary Analog Devices PDFs needed to identify the
R-8 package and the family land-pattern recommendation. It does not release a
PCB footprint, approve fabrication, or claim that a partner-CAD file was
acquired.

## Primary evidence retained

| Source | Scope used here | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| [ADA4177 Rev. E data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf) | Exact `ADA4177-1ARZ` ordering identity and Figure 101 R-8 package drawing, printed pages 31 and 33 | `packages/scoring-circuit/docs/evidence/bp-031/analog-devices-ada4177-datasheet-rev-e.pdf` | `363C6BB4B4DB88F197F4FB3A0D286CD041FB492B9BFD1900382078B1489078CC` |
| [ADI R-8 outline](https://www.analog.com/media/en/package-pcb-resources/package/pkg_pdf/soic_narrow-r/r_8.pdf) | R-8 outline, pin-one datum, drawing identifier `012407-A`, JEDEC MS-012-AA | `packages/scoring-circuit/docs/evidence/bp-031/analog-devices-r-8-package-outline.pdf` | `83932339A984A08A714727BA5F7F836B6451B9194C3C8DAD160FF4408F28FCAF` |
| [ADI 90-0096 Rev. M](https://www.analog.com/media/en/package-pcb-resources/land-pattern/soicn/90-0096.pdf) | ADI family land-pattern recommendation, pages 1-3 | `packages/scoring-circuit/docs/evidence/bp-031/analog-devices-90-0096-soicn-land-pattern-rev-m.pdf` | `17E97CC5CD3B6348EB44142CDE0F65AC53414F2B963AE6ECC77E9C31D7880729` |

The executable record is
[`bp031-ada4177-r8-footprint-evidence.tsx`](../src/bp031-ada4177-r8-footprint-evidence.tsx),
and its focused contract is
[`bp031-ada4177-r8-footprint-evidence.test.tsx`](../src/bp031-ada4177-r8-footprint-evidence.test.tsx).

## R-8 versus legacy S8

The Rev. E ordering guide identifies `ADA4177-1ARZ` as an 8-lead standard
small-outline `R-8` package. The standalone ADI drawing repeats that R-8
designation, gives the `012407-A` drawing identifier, marks pin 1 at the
lower-left in the top view, and specifies a 1.27 mm pitch. In the drawing's
board-plane convention, 4.80/5.00 mm is the body length along the horizontal
pin-sequence axis, 3.80/4.00 mm is body width, and 5.80/6.20 mm is the overall
lead span. The same drawing gives 1.35/1.75 mm package height, 0.40/1.27 mm
lead length, and 0.31/0.51 mm lead width. These fields are kept separate in
the executable record so a lead span is not mistaken for package height or a
package height for lead length.

ADI document `90-0096` is titled **PACKAGE LAND PATTERN, [S8] 0.150" SOIC,
8 LEADS**. Its 1.98 mm by 0.53 mm pad, 4.93 mm row-center span, and 1.27 mm
pitch are retained as family-reference inputs. `S8` is legacy nomenclature in
that recommendation; it is not silently substituted for the exact `R-8`
package option and it is not an ADA4177-specific approval. The source itself
is a land-pattern recommendation based on typical board parameters. It does
not publish the exact part's CAD object, solder-mask rule, paste rule, or
courtyard.

The project overlay uses the 90-0096 midpoint dimensions, rotates no board
coordinates, and maps the R-8 top-view numbering exactly: pins 1-4 are on the
lower edge from left to right; pins 5-8 return on the upper edge from right to
left. This is a review coordinate convention, not an independent orientation
approval.

## Partner-CAD disposition

The [ADI ADA4177-1 product page](https://www.analog.com/en/products/ada4177-1.html)
lists partner-CAD providers including Ultra Librarian and SamacSys. No direct
ADI-native CAD object or partner-CAD download is retained by this bounded
artifact. The executable record therefore stores the providers as
`listed-by-adi-not-retrieved`, keeps the retained partner path and hash null,
and sets both manufacturer-CAD and partner-CAD authority to `deny`. No
manufacturer CAD is invented from the package drawing or the partner links.

## Review-only project footprint

The project overlay is deliberately deterministic so the exact checks are
testable:

- eight rectangular SMT pads, 0.53 mm wide by 1.98 mm long;
- 4.93 mm row-center span, 1.27 mm pad pitch;
- pin 1 at `(-1.905, -2.465)` mm in the stated top-view convention, with
  project rotation `0` degrees;
- a `5.50 mm` by `7.41 mm` courtyard centered at `(0, 0)` with a project
  minimum clearance of `0.25 mm`, derived as the maximum of the rendered pad
  envelope and the maximum R-8 body/overall-lead envelope, plus twice that
  clearance;
- project solder-mask margin `0.05 mm` and paste reduction `0.05 mm` per edge.

The courtyard and mask/paste values are project review inputs because the
retained ADI documents do not publish them. `independentOrientationReview` is
`pending`, `accepted` is `false`, and `fabricationAuthority` is `deny`. The
component is isolated and is not imported into a board model.
