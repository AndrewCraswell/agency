# M4-03 fault-protected buffer and differential ADC study

## Decision

**DENY. This is not yet a credible coupon schematic.** A protected instrumentation amplifier remains a useful
direction, but the specific seven-PGA855 plus one-LTC2373-16 proposal has two hard architecture contradictions:

1. With the LTC2373-16 internal 4.096 V reference buffer, its differential-input common mode must remain from
   1.948 V through 2.148 V. The proposed PGA855 `VOCM` of 2.5 V is outside that range.
2. The LTC2373-16 has eight analog input pins, enough for four direct differential pairs. Seven differential PGA
   outputs need a selected external mux or shared conversion stage, or more ADCs. None is selected here.

The 450 ohm error sum and approximately 100 ohm sabre timing below are static arithmetic only. Because the
signal interconnect is invalid and the ADC drive, channel topology, and power are open, neither result validates
a pre-capture or timing gate. This study changes neither the apparatus circuit, BOM, readiness, schematic,
fabrication output, calibration policy, nor FIE claim. The M4 baseline remains DENY.

## Bounded architecture evidence

The proposed input is body-cord line, existing 22 ohm source path, sense node, 56 kohm resistor, PGA855 input.
The PGA input stage uses plus and minus 4.5 V rails, gain 1 V/V, and a proposed 2.5 V `VOCM` on a 0 V to 5 V
output supply. A separate PGA is required for each of seven conductors. Source and sink phase selection remains
a separate SIG decision; they may not be enabled together on a conductor during resistance observation.

The [PGA855 data sheet](https://www.ti.com/lit/ds/sbosae0b/sbosae0b.pdf) specifies input protection to 40 V
beyond its input supplies, input-stage supplies from plus and minus 4 V through plus and minus 18 V, 0.95 us
settling to 0.0015 percent, and gain-1 offset, bias, and drift limits used by the executable arithmetic. For a
0 V to 5 V output supply, its `VOCM` range is 1.5 V through 3.5 V, so 2.5 V is legal for the PGA itself. The
data sheet's output-swing table, under its specified plus and minus 2.25 V output-supply condition, gives
0.1 V from each rail without a load and 0.2 V from each rail with a 10 kohm load. A final design must repeat
the load and swing check at its actual supply and driver load; the current arithmetic does not establish it.

Differential sampling can reject an unwanted signal that is common to both ADC inputs only while both inputs
remain inside the ADC's permitted common-mode window. It does not make a 2.5 V `VOCM` legal, and it does not
remove gain, imbalance, reference, or channel-memory error.

The [LTC2373-16 data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/237316fa.pdf)
specifies a 460 ns minimum acquisition time and 527 ns maximum conversion time. Each ADC core input sees about
50 pF through a 40 ohm sampling switch; the internal mux adds another 40 ohm switch and about 20 pF. A suitable
settling driver and filter has not been selected. Those elements, plus mux memory and cross-channel charge,
must be designed before seven-channel timing or accuracy can be screened.

## Non-validating arithmetic

The executable record is [analog-ovp-buffer.ts](../src/analog-ovp-buffer.ts). At 450 ohms and 125 C, its
absolute sum is about 3.54 ohms. Named terms are PGA offset and drift, PGA bias through 56 kohm, ADC INL and
quantization, independent source and ADC reference temperature coefficients, PGA gain drift, existing source
TCR, fixture uncertainty, and settled source-switch charge. The number is below the 4.50 ohm target, but is
non-validating because it omits the unselected ADC driver/filter and channel architecture and uses an invalid
ADC common mode.

At approximately 100 ohms and 10 nF, 4.81 us source five-time-constant settling plus 0.95 us PGA settling plus
0.460 us minimum acquisition and 0.527 us maximum conversion is about 6.75 us. This is not a sabre timing pass.
It excludes the unselected driver/filter, external channel selection or extra ADCs, mux memory, scheduling,
source-switch turn-on, digital transport, and fault recovery.

At a plus or minus 24 V source fault, a 56 kohm resistor limits the arithmetic source current to 0.509 mA per
channel and 3.56 mA for seven channels. The PGA data sheet warns that fault current enters the input-stage
supply rails and requires external rail clamps if the supplies cannot sink it. Clamp energy and temperature
remain open gates; the resistance alone is not fault qualification.

## One-watt isolated-domain audit

Seven PGA input stages at the published 4.5 mA maximum over a 9 V span consume at most 0.2835 W. Seven output
stages at the published 3.5 mA maximum over 5 V consume at most 0.1225 W, for 0.406 W of PGA maximum load.
The ADC's cited 0.040 W is typical, not maximum. Combining it with the PGA maxima gives a bookkeeping value of
0.446 W and leaves 0.554 W below the provisional 1 W envelope, but that is not worst-case closure. ADC maximum
power, a reference, compatible common-mode generation, positive/negative rail conversion losses, clamps, and
any channel-selection devices remain unbounded.

## Exact next physical experiment

Do not connect the proposed chain to an STM32 or call it a seven-channel coupon. First select a compatible ADC
reference/common-mode arrangement and a manufacturer-supported driver/filter for one differential channel.
On a sacrificial one-channel coupon, inject the normative zero, 450 ohm, open, and approximately 100 ohm sabre
loads, then apply powered, unpowered, rising, falling, and brownout plus or minus 24 V faults. Measure input-rail
clamp current, both PGA outputs, both ADC inputs, acquisition settling, code recovery, and rail energy from room
temperature through 125 C component screening.

Only after that coupon passes should the project select either a characterized external differential mux/shared
conversion path or enough ADC channels for all seven pairs. Then repeat simultaneous-channel crosstalk,
leakage, cable capacitance, safe startup, recovery, full worst-case 1 W rail accounting, and a 50 C blocked-vent
thermal test. Any failed gate remains unavailable, never a scoring state.
