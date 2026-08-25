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
