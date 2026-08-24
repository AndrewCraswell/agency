# M4-05 socketed analog fixture design

**Status:** design contract only. This artifact does not release a schematic,
PCB, footprint, BOM, fabrication package, energized procedure, or scoring
behavior.

The executable contract is
[`../src/m4-05-socketed-analog-fixture.ts`](../src/m4-05-socketed-analog-fixture.ts).
It carries forward the fixture requirements in
[`analog-front-end.md`](../../../packages/scoring-circuit/docs/analog-front-end.md)
and the complete M4-01/BP-106 resistance, capacitance, temperature, and
timing matrix.

## Fixture boundary

The fixture has exactly six labeled three-pin body-cord connectors: weapon,
lame, and guard paths for each fencer. They terminate at a labeled seven-
conductor scoring-box patch boundary and a separate piste terminal. It has
socketed, one-at-a-time passive resistance and capacitance modules, an
isolated dry-contact pulse interface, and oscilloscope access at the connector
line, protected node, ADC input, comparator output, precision reference, and
scoring ground. A four-wire reading at the fixture output characterizes each
installed resistance module, including its short-link, socket, and lead
contribution. The archived reading rather than a component marking is the
test stimulus.

It covers the 20 required resistance values from 0 through 505 ohms, all four
line-capacitance values from 500 pF through 10 nF, the four temperatures from
-40 C through 125 C, and the named pulse-width neighbourhoods. That yields
320 normal resistance/capacitance/temperature points, plus the pulse points.
The fixture makes no assertion that any point has been measured.

Its passive continuity map explicitly carries open, short, cross-line,
blade/guard, opponent-target, self-lame, and piste combinations for both left
and right fencers. These are de-energized map identities only, never touch or
score qualifications. The pulse interface requires break-before-make relay
behavior, with closed resistance and bounce recorded separately from the
selected external stimulus path. A non-relay mechanical alternative needs a
root review that demonstrates the same obligations.

## Calibration and safety

Every future run must preserve traceable calibration identities and readings
for its resistance, capacitance, pulse width, and temperature standards. The
contract sets a k=2 expanded uncertainty limit of 0.25 ohm for the resistance
path, 100 pF for capacitance, 1 us for pulse width, and 0.5 C for temperature.
These are fixture requirements, not calibration evidence.

Its default state is de-energized and open. Normal passive modules and any
future guarded-force connector must be physically incompatible. The DUT is
unmated before a module change, and all fixture and DUT measurement points are
verified at zero source potential before mating. The pulse interface defines a
mechanical dry-contact boundary only: it names no source and does not authorize
an energized pulse or fault injection.

The timing uncertainty is intentionally conservative: with k=2 expanded
uncertainty of 1 us, the boundary-minus, exact-boundary, and boundary-plus
observations (for example 99, 100, and 101 us) can touch the 100-us boundary.
They are therefore `indeterminate-no-credit`, not a pass or fail. A later
qualified measurement task must tighten and approve its uncertainty before it
classifies a boundary observation.

USB-C PD remains the normal apparatus input. This design adds no VBUS, CC,
battery, or laboratory-power connection to the DUT.

Future runs must include minimum, room, and maximum qualified temperature
cases, USB-C PD lower-declared-tolerance, nominal, and upper-declared-
tolerance cases, plus falling and rising brownout ramps. The fixture contract
does not invent a voltage tolerance: each future energized record must bind
the negotiated source's declared limits to immutable evidence.

## Handoffs and gates

M4-06 owns the reviewed fabrication package. M4-07 owns incoming socket,
relay, and harness measurements. BP-102 owns a separately reviewed guarded
fault procedure. Only after those gates and an operator procedure with named
source, current limit, stop condition, recovery sequence, and independent
observer may a future task propose energized work. Results remain evidence
only until the downstream qualification tasks explicitly accept them.

The executable design pins the M4-01, BP-106, and analog-front-end source
artifacts to their producing commits and normalized SHA-256 identities. Its
test rejects upstream drift instead of silently inheriting a changed matrix.
