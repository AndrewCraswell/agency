# BP-033 Molex Mini-Fit Jr measurement-link candidate

This isolated review slice records the exact Molex `39-28-1023` vertical
Mini-Fit Jr header candidate for `J_LINK_INPUT`, `J_LINK_APPLICATION`,
`J_LINK_DISPLAY`, and `J_LINK_SCORING`. The selected mating housing is
`39-01-2020`; the selected female crimp terminal is `39-00-0039`. This slice
does not edit the canonical application ledger, instantiate any board
connector, or authorize PCB release.

## Retained official drawing evidence

The retained bytes are manufacturer product-page exports containing the
Molex customer drawings. Their source URLs remain the Molex URLs; the
acquisition mirrors are recorded in the executable source because the Molex
host did not provide a stable downloadable response during acquisition.

| Item | Molex identity | Retained artifact | SHA-256 | Source coverage |
| --- | --- | --- | --- | --- |
| Header | `39-28-1023`, engineering `5566-02A` | `molex-39281023-product-page.pdf` | `BFEB1A0BEC2417BE7C8E09E0D17800CC7AED1C403F6D93D0747223829F331691` | SD-5566-002 vertical header drawing, 2-circuit layout, circuit-1 rib, 4.20 mm pitch, 1.40 mm recommended holes |
| Mating housing | `39-01-2020`, `5557-02R` | `molex-5557-39-01-2020-housing-drawing.pdf` | `BE541BD8F81F3E5FBE001F04EA344E6FC373B98154CE94561590D0F17821DCE1` | SD-5557-003 5557 housing family chart and drawing |
| Terminal | `39-00-0039`, series `5556` | `molex-5556-39-00-0039-product-page.pdf` | `C6BD24AC80092892161422F2953C76AD26BB0A429B3AD2FA71BBEF29896E081A` | Molex product-page export: exact bag terminal, tin-plated brass, 18-24 AWG, crimp/compression, and official drawing link |

Molex lists CAD, STEP, and PRO/E links for the header and housing product
pages. No official CAD artifact is retained or imported here. The terminal's
official drawing URL is recorded, but its standalone drawing bytes were not
acquired; the retained product-page export is evidence for the exact terminal
identity and published electrical/mechanical range only.

For `39-01-2020`, the exact `5557-02R` chart row is on retained PDF page 6,
which is SD-5557-003 drawing sheet 2 of 2. The preceding retained pages are
the related Molex product-page export and family drawing context, not a claim
that the exact row appears on PDF pages 1 or 2.

The rendered Circuit JSON is persisted by its SHA-256 evidence file
`molex-links-rendered-artwork.sha256`:
`CEC9ABB31F10EA6703138506E62B8AE51D708A6B63D66B68ED88E2554AAE29FD`. Tests
recompute this digest from `JSON.stringify(renderTestCircuit(...))` and compare
both the independent literal and retained evidence bytes.

## Header orientation and candidate geometry

The header drawing is viewed from the component side. The circuit-1 rib marks
pin 1. For the 2-circuit layout, pin 1 is the upper contact and pin 2 is the
lower contact, centered on `X = 0` at `Y = +2.10/-2.10 mm`. The source pitch is
4.20 mm. Molex recommends a `1.40 +/- 0.05 mm` finished hole and publishes a
3.50 mm tail length.

The renderer emits two plated holes with a 1.40 mm hole and a 2.40 mm
equal-width/height rounded-rectangle pad candidate. The pad candidate is
project review input only: Molex does not publish a released copper annulus,
solder mask, paste, courtyard, or board placement for this project
measurement-link slice. The relative pin pattern follows the source drawing,
but the local `pcbX=0` artwork is not a board-level placement and remains
denied.

## Four source/load net pairs

The isolated record preserves the existing BP-050 net contracts without
integrating them into a board:

| Reference | Pin 1 source | Pin 2 load |
| --- | --- | --- |
| `J_LINK_INPUT` | `V20_TO_V5_BUCK` | `V20_BUCK_INPUT` |
| `J_LINK_APPLICATION` | `V5` | `V5_APPLICATION` |
| `J_LINK_DISPLAY` | `V5_DISPLAY_LIMITED` | `V5_DISPLAY_LOAD` |
| `J_LINK_SCORING` | `V5` | `V5_SCORING_ISOLATOR_INPUT` |

These names are imported from the canonical BP-050 power contract and
cross-checked in this isolated slice. They establish the candidate's identity
and intended measurement-link direction. They do not approve live insertion,
current carrying, source/load switching, or electrical integration.

## Denied gates

The candidate keeps housing and terminal CAD import, candidate pad acceptance,
electrical integration, board import, panel placement, fit and clearance,
courtyard, mechanical load, assembly process, release, and fabrication
denied. The four reference connectors are not instantiated by this module.
Root review must separately resolve received-part identity, mating fit,
pin-one marking, finished-hole process, annular copper, board edge and
enclosure clearances, current/load behavior, service procedure, and any
live-power insertion risk.
