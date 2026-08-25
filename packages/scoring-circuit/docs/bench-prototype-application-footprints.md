# BP-033 Application Footprint Closure Ledger

BP-033 reconciles the proposed populated application-carrier references from
BP-050 and BP-140 through BP-146. Its machine-readable source is
`src/bench-prototype-application-footprints.ts`.

The ledger deliberately does not contain pad sizes, drills, paste, mask,
courtyard, copper, placement coordinates, or rotations. A package descriptor
is only an identity check. Each listed record remains `DNP-unresolved` until
the exact manufacturer drawing and CAD are archived, the project artwork is
generated and hashed, and a second reviewer checks orientation and mating
constraints.

## Source mapping scope

The BP-033 ledger retains a bounded batch of exact manufacturer PDFs for the
BP-050 USB-C power/protection path, the display eFuse, and the BP-142
application inductor. Each record binds the exact MPN and package to a
repository-relative source path, manufacturer URL, and SHA-256. The test reads
and hashes every retained file. This is source acquisition only: it does not
alter any CAD, artwork, orientation, schematic, layout, or fabrication `DENY`
state.

References without retained source bytes have no source URL in this ledger.
They must not receive a guessed family or distributor link merely to make the
ledger appear complete.

## U_USB_PD REF0038A review-only candidate

`U_USB_PD` binds the exact TI orderable `TPS25730ADREFR` to the
`TPS25730AD` REF0038A WQFN drawing: 38 perimeter pins, exposed pad 39 (GND),
and exposed pad 40 (DRAIN). The retained TI datasheet
`docs/evidence/bp-033/ti-tps25730a-datasheet.pdf` has SHA-256
`B7D9836E4C82D28BF400FC1747586F24C26DAF94A629AAB4EE57C49072371D28`.

`src/bp033-tps25730a-ref-project-footprint.tsx` renders the source-controlled
copper into one isolated review candidate. Its normalized rendered copper and
courtyard geometry is hash-bound as
`b35cde8711ffe20c9c1f38804c2e885bc7caa610db4f9bb5243f760a00e3e7e0`.
The top-view datum holds pin 1 at the upper-left of the left edge at zero board
rotation, with counter-clockwise numbering. The 7.0 mm by 5.0 mm courtyard is
an explicit project DRC envelope, because TI does not publish a courtyard.

TI's 0.1 mm stencil example records 78% printed area for exposed pad 39 and
80% for exposed pad 40. The rendered symmetric apertures preserve only those
total areas; they are not a claim that TI's aperture segmentation, any
fabricator rule, or an assembly process has been accepted. No native ECAD is
imported. Board import, independent orientation and courtyard review, DRC,
release, and fabrication remain denied.

Root reviewer `root-final-reviewer` visually inspected retained TI pages 1,
4 through 6, and 61 through 63 on 2026-08-25. Root review accepts the exact
orderable/device/package binding, top-view pin order, published copper,
exposed-pad identities, `U_USB_PD` mapping, rendered-review hash, and deny-state
integrity. It does not accept the project mask, symmetric paste approximation,
courtyard, board fit, DRC, or fabrication release.

## `J_USB_C` Amphenol source and candidate disposition

The BP-050 `J_USB_C` selection is now exact-package-identified as Amphenol ICC
`10177070-00011LF`, a USB Type-C 16-position right-angle SMT receptacle for a
0.80 mm PCB. BP-033 retains the official Amphenol FCI drawing at
`docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf` with SHA-256
`A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF`.
The isolated project-review artwork and orientation candidate is documented in
[`bp-033-usb-c-project-footprint.md`](bp-033-usb-c-project-footprint.md) and
mapped in `projectFootprintMappings[0]`. Page 2 publishes the recommended
12-land row, four shell slots, two datum holes, and product-edge datum; the
isolated artifact transcribes that manufacturer layout without adding mask,
paste, courtyard, or chassis geometry. The official 3D archive remains
access-gated. Root review accepts the exact orderable/package, 12-land
source-pin/net order, slot and datum-hole geometry, product-edge wording, and
top-view orientation. The `J_USB_C` row remains `DNP-unresolved`; CAD import,
mask, paste, courtyard, chassis, board fit, release, and fabrication remain
denied.

## J_HUB75 Samtec source and candidate disposition

`J_HUB75` is the exact Samtec `TST-108-04-G-D-RA`: a 16-position, double-row,
2.54 mm-pitch, right-angle through-hole shrouded header. BP-033 retains the
official [TST series print](https://suddendocs.samtec.com/prints/tst-1xx-xx-x-x-xx-xx-mkt.pdf)
and [double-row footprint print](https://suddendocs.samtec.com/prints/tss-tstd.pdf):

| Evidence | Repository artifact | SHA-256 | Disposition |
| --- | --- | --- | --- |
| Series print | `docs/evidence/bp-143/samtec-tst-series-print.pdf` | `56AE927287856E76D57FF3B0953D3D4F853183E397794A31EE6DC5D3E07B6059` | canonical BP-143 configuration source |
| Double-row footprint print | `docs/evidence/bp-143/samtec-tst-footprint.pdf` | `ED9B9280C24AA99BB4714557997CA5452FE7E245961599A4C39537FEFCD366DC` | canonical BP-143 source, no project geometry accepted |
| Samtec 3D CAD | product-page CAD download | not acquired | access requires a valid email address; no substitute model is claimed |
| Pin-map and orientation overlay | `docs/evidence/bp-033/samtec-tst-108-04-g-d-ra-pin-map-orientation-overlay.svg` | `08FD50CDF71A209D936B6B74FD7DBBDAEDEF0404EA105A168623707FFA9D02F7` | source-controlled, not a footprint |

The overlay records only the 2 by 8 pin sequence at 2.54 mm pitch, with pin 1
at the keyed-end datum. It is not a project footprint, CAD import, or
manufacturing artwork, and it supplies no drill, pad, mask, paste, courtyard,
placement, or rotation release.

BP-143 supplies the electrical mating contract: the 16-pin cable is
straight-through, its white stripe identifies pin 1, and the panel mate must be
the `INPUT` header. The overlay uses that pin sequence only. It does not
claim that the key is seated, that either mating orientation fits, or that the
pin-one datums agree on a received sample. Sample fit, orientation, signal
continuity, current, and fabrication remain false or denied until the separate
physical-evidence gate records them.

Some BP-050 selections do not yet state an exact package in their upstream
contract. They are recorded as `upstream-package-not-specified`, not guessed.
Those references block schematic and layout release until the manufacturer
package identity is added. The ledger therefore reconciles every proposed
reference without pretending an unproved geometry is correct.

The BP-140 reference set is reconciled separately and completely. The reset and
interrupt observation points select the already-reviewed Keystone Electronics
`5001` miniature black through-hole test point with a 0.040 inch (catalog 1.0 mm)
mounting hole.
The Keystone catalog is retained at
`docs/evidence/bp-033/keystone-terminal-test-points.pdf` with SHA-256
`00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C`. The
catalog mounting-hole callout is not a finished PCB drill instruction. The points
remain `DNP-unresolved` in BP-033 until their exact drawing, CAD,
artwork, orientation, and probe-clearance review are complete; this decision
closes only the exact orderable identity.

`R_W5500_INT_BIAS` selects Yageo `RC0603FR-07100KL`, 100 kOhm, 1%, 0603, to
provide the locally pulled-inactive high state required by the canonical ESP32
polling policy. WIZnet identifies `INTn` as an active-low digital output, and
its DC-characteristics pull-up list names `SCSn`, `RSTn`, and `PMODE[2:0]`, not
`INTn`; the cited pin and DC-characteristics tables do not specify whether the
output stage is push-pull, open-drain, or another topology. The external bias
is therefore an application policy rather than a claimed W5500 internal
feature. The ESP32 allocation reserves no GPIO for this
signal because status and socket state are polled over SPI. The WIZnet datasheet is retained at
`docs/evidence/bp-033/wiznet-w5500-datasheet.pdf` with SHA-256
`7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D`. No
resistor geometry is inferred; the Yageo specification is retained at
`docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf` with SHA-256
`E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054`.

RTC, secure element, audio amplifier, speaker, and external antenna are
explicitly DNP. In particular, audio must remain DNP because GPIO35 is the
selected encrypted-IR RMT input. The TSOP38438 and its support network are
included, but its optical aperture, front-panel coupon, electrical timing,
range, flood, and power-off tests remain BP-146 gates.

Fabrication remains denied. BP-300 can consume a row only after all four
evidence classes are complete and independently reviewed.
