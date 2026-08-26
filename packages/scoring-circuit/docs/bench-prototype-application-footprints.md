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

Some BP-050 selections do not yet state an exact package in their upstream
contract. They are recorded as `upstream-package-not-specified`, not guessed.
Those references block schematic and layout release until the manufacturer
package identity is added. The ledger therefore reconciles every proposed
reference without pretending an unproved geometry is correct.

The BP-140 reference set is reconciled separately and completely. Its two
observation points, `TP_W5500_RESET_N` and `TP_W5500_INT_N`, have no selected
test-point identity. `R_W5500_INT_BIAS` is still explicitly TBD pending the
BP-123 power-sequence review. All three remain `DNP-or-selection-blocked`, with
no manufacturer, MPN, package, or geometry inferred. Selecting a test point or
bias part starts the same drawing, CAD, artwork, orientation, and independent
review gates as every other populated reference.

RTC, secure element, audio amplifier, speaker, and external antenna are
explicitly DNP. In particular, audio must remain DNP because GPIO35 is the
selected encrypted-IR RMT input. The TSOP38438 and its support network are
included, but its optical aperture, front-panel coupon, electrical timing,
range, flood, and power-off tests remain BP-146 gates.

Fabrication remains denied. BP-300 can consume a row only after all four
evidence classes are complete and independently reviewed.
