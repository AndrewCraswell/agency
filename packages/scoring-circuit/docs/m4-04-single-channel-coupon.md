# M4-04 single-channel sensing coupon

**Status:** review evidence is pending. The coupon is not approved for
fabrication, power, procurement, or scoring use.

The schematic is the existing
[`one-channel-analog-experiment.circuit.tsx`](../src/one-channel-analog-experiment.circuit.tsx).
It is a one-channel learning article, not a seven-channel scoring-board
implementation. Its source path is `REF5025AQDRQ1 -> ERA3AEB2491V ->
TMUX1112PWR -> LINE`; its acquisition path uses the connector-side
TPD4E05U06DQAR shunt, 22-ohm series resistor, ADA4177-1BRZ buffer, and
ADS8881IDGS converter.

`m4-04-single-channel-coupon.ts` performs a source-bound static ERC over the
named functional nets. It confirms the defined line, quiet, source, guarded
force, reference, converter, isolated-rail, ground, and SPI connections. This
ERC is deliberately narrower than PCB or simulation output and does not
replace physical continuity, component behaviour, or generated-artwork checks.

## Footprint review queue

The executable artifact has one exact-MPN review record for each 45-reference
coupon BOM entry. An implementation reconciliation binds each reference, MPN,
package, and manufacturer-primary URL to the schematic BOM. A separate field
names `root-final-reviewer` for every drawing review. It is deliberately
`pending`; implementation work cannot approve its own footprints.

For every reference, the root review must acquire and hash the exact
manufacturer package drawing and CAD object, or record the manufacturer-source
absence. It then needs to compare generated artwork, pin one or polarity,
orientation, courtyard, and assembly constraints before changing any approval
state. No generic package, family drawing, or renderer output counts as this
evidence.

The existing tscircuit render test timed out in this environment. The static
ERC passes, but that timeout must be resolved or independently reproduced
before treating renderer-generated circuit output as verified.

USB-C PD remains normal apparatus power. The coupon has no USB-C, VBUS, CC, or
PD-controller connection; its isolated input is strictly an experiment
boundary. M4-06 owns a fabrication package and later M4 tasks own physical,
powered, and calibration evidence.
